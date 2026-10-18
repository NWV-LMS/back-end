import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PaymentStatus, Prisma } from '@prisma/client';
import { CreatePaymentDto } from '../../libs/dto/payment/create-payment.dto';
import { UpdatePaymentDto } from '../../libs/dto/payment/update-payment.dto';
import { QueryPaymentDto } from '../../libs/dto/payment/query-payment.dto';
import {
  PaymentResponseDto,
  PaginatedPaymentResponseDto,
} from '../../libs/dto/payment/payment-response.dto';
import { DatabaseService } from '../../database/database.service';
import { buildDateRangeFilter } from '../../libs/date-range';
import {
  InvoiceBalance,
  lockInvoice,
  reconcileInvoiceBalance,
} from '../billing/invoice-balance';

@Injectable()
export class PaymentService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    input: CreatePaymentDto,
    cashierUserId: string,
  ): Promise<PaymentResponseDto> {
    const student = await this.database.student.findFirst({
      where: { id: input.student_id, organization_id: organizationId },
    });

    if (!student) {
      throw new BadRequestException('Student not found in this organization');
    }

    const payment = await this.database.payment.create({
      data: {
        organization_id: organizationId,
        student_id: input.student_id,
        amount: input.amount,
        method: input.method,
        status: input.status ?? PaymentStatus.COMPLETED,
        description: input.description,
        cashier_user_id: cashierUserId,
        receipt_number: await this.generateReceiptNumber(organizationId),
      },
      include: { student: { select: { name: true } } },
    });

    return this.toResponseDto(payment);
  }

  async findAll(
    organizationId: string,
    query: QueryPaymentDto,
  ): Promise<PaginatedPaymentResponseDto> {
    const {
      page = 1,
      limit = 20,
      student_id,
      method,
      status,
      from,
      to,
    } = query;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (student_id) where.student_id = student_id;
    if (method) where.method = method;
    if (status) where.status = status;
    if (from || to) {
      where.paid_at = buildDateRangeFilter(from, to);
    }

    const [items, total] = await Promise.all([
      this.database.payment.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paid_at: 'desc' },
        include: { student: { select: { name: true } } },
      }),
      this.database.payment.count({ where }),
    ]);

    return {
      items: items.map((p) => this.toResponseDto(p)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<PaymentResponseDto> {
    const payment = await this.database.payment.findFirst({
      where: { id, organization_id: organizationId },
      include: { student: { select: { name: true } } },
    });

    if (!payment) {
      throw new NotFoundException('Payment not found');
    }

    return this.toResponseDto(payment);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdatePaymentDto,
  ): Promise<PaymentResponseDto> {
    const updated = await this.database.$transaction(async (tx) => {
      const invoice = await this.lockPaymentForMutation(tx, organizationId, id);
      const payment = await tx.payment.update({
        where: { id, organization_id: organizationId },
        data: {
          amount: input.amount,
          method: input.method,
          status: input.status,
          description: input.description,
        },
        include: { student: { select: { name: true } } },
      });
      if (invoice) {
        await reconcileInvoiceBalance(tx, organizationId, invoice);
      }
      return payment;
    });

    return this.toResponseDto(updated);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    await this.database.$transaction(async (tx) => {
      const invoice = await this.lockPaymentForMutation(tx, organizationId, id);
      await tx.payment.delete({
        where: { id, organization_id: organizationId },
      });
      if (invoice) {
        await reconcileInvoiceBalance(tx, organizationId, invoice);
      }
    });
  }

  private async lockPaymentForMutation(
    tx: Prisma.TransactionClient,
    organizationId: string,
    id: string,
  ): Promise<InvoiceBalance | null> {
    // invoice_id is immutable through the API. Discover it before locking, then
    // re-read the payment after the locks to detect concurrent deletion.
    const existing = await tx.payment.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (!existing) {
      throw new NotFoundException('Payment not found');
    }

    let invoice: InvoiceBalance | null = null;
    if (existing.invoice_id) {
      await lockInvoice(tx, organizationId, existing.invoice_id);
      invoice = await tx.invoice.findFirst({
        where: {
          id: existing.invoice_id,
          organization_id: organizationId,
          student_id: existing.student_id,
          student: { organization_id: organizationId },
        },
        select: {
          id: true,
          student_id: true,
          amount_due: true,
          status: true,
          due_date: true,
        },
      });
      if (!invoice) throw new NotFoundException('Invoice not found');
    }

    const locked = await tx.$queryRaw<{ id: string }[]>`
      SELECT "id" FROM "Payment"
      WHERE "id" = ${id}::uuid
        AND "organization_id" = ${organizationId}::uuid
      FOR UPDATE
    `;
    const current = await tx.payment.findFirst({
      where: { id, organization_id: organizationId },
    });
    if (locked.length === 0 || !current) {
      throw new NotFoundException('Payment not found');
    }
    if (
      current.invoice_id !== existing.invoice_id ||
      current.student_id !== existing.student_id
    ) {
      throw new ConflictException(
        'Payment relation changed; retry the request',
      );
    }
    return invoice;
  }

  private toResponseDto(payment: any): PaymentResponseDto {
    return {
      id: payment.id,
      organization_id: payment.organization_id,
      student_id: payment.student_id,
      student_name: payment.student?.name,
      amount: Number(payment.amount),
      method: payment.method,
      status: payment.status,
      description: payment.description,
      receipt_number: payment.receipt_number ?? null,
      cashier_user_id: payment.cashier_user_id ?? null,
      invoice_id: payment.invoice_id ?? null,
      paid_at: payment.paid_at,
      created_at: payment.created_at,
    };
  }

  private async generateReceiptNumber(organizationId: string): Promise<string> {
    // Avoid sequential IDs for now (needs DB sequence/locking). This is unique-ish and safe.
    // Uniqueness should be enforced by DB constraint later if you want hard guarantees.
    const ymd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RCPT-${organizationId.slice(0, 4).toUpperCase()}-${ymd}-${rand}`;
  }
}
