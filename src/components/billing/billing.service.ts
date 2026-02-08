import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  InvoiceStatus,
  PaymentStatus,
} from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { GenerateInvoicesDto } from '../../libs/dto/billing/generate-invoices.dto';
import {
  InvoiceResponseDto,
  PaginatedInvoiceResponseDto,
} from '../../libs/dto/billing/invoice-response.dto';
import { QueryInvoiceDto } from '../../libs/dto/billing/query-invoice.dto';
import { PayInvoiceDto } from '../../libs/dto/billing/pay-invoice.dto';

function parseMonthOrThrow(month: string): Date {
  // Expect YYYY-MM
  const m = month.trim();
  if (!/^\d{4}-\d{2}$/.test(m)) {
    throw new BadRequestException('month must be in YYYY-MM format');
  }
  const [yStr, moStr] = m.split('-');
  const y = Number(yStr);
  const mo = Number(moStr);
  const d = new Date(Date.UTC(y, mo - 1, 1));
  if (Number.isNaN(d.getTime())) {
    throw new BadRequestException('Invalid month');
  }
  return d;
}

function fmtYYYYMM(d: Date): string {
  return d.toISOString().slice(0, 7);
}

function fmtYYYYMMDD(d: Date): string {
  return d.toISOString().slice(0, 10);
}

@Injectable()
export class BillingService {
  constructor(private readonly database: DatabaseService) {}

  async generateInvoices(
    organizationId: string,
    dto: GenerateInvoicesDto,
  ): Promise<{ message: string; created: number; updated: number }> {
    const monthDate = parseMonthOrThrow(dto.month);
    const dueDate = monthDate; // 1st of month

    // Pull enrollments + pricing info in one go.
    const enrollments = await this.database.enrollment.findMany({
      where: { organization_id: organizationId, billing_active: true },
      select: {
        id: true,
        student_id: true,
        group_id: true,
        monthly_fee: true,
        group: {
          select: {
            name: true,
            course: { select: { title: true, price: true } },
          },
        },
        student: { select: { name: true, phone: true } },
      },
    });

    if (enrollments.length === 0) {
      return { message: 'No enrollments to invoice', created: 0, updated: 0 };
    }

    // Group by student_id.
    const byStudent = new Map<
      string,
      {
        student: { name: string; phone: string };
        items: {
          enrollment_id: string;
          group_id: string;
          group_name: string;
          course_title: string;
          amount: Prisma.Decimal;
        }[];
        total: Prisma.Decimal;
      }
    >();

    for (const e of enrollments) {
      const fallback = this.tryParseDecimal(e.group.course.price);
      const fee =
        e.monthly_fee && e.monthly_fee.greaterThan(0)
          ? e.monthly_fee
          : fallback ?? new Prisma.Decimal(0);

      if (!byStudent.has(e.student_id)) {
        byStudent.set(e.student_id, {
          student: { name: e.student.name, phone: e.student.phone },
          items: [],
          total: new Prisma.Decimal(0),
        });
      }
      const bucket = byStudent.get(e.student_id)!;
      bucket.items.push({
        enrollment_id: e.id,
        group_id: e.group_id,
        group_name: e.group.name,
        course_title: e.group.course.title,
        amount: fee,
      });
      bucket.total = bucket.total.add(fee);
    }

    const existing = await this.database.invoice.findMany({
      where: { organization_id: organizationId, month: monthDate },
      select: { id: true, student_id: true, status: true },
    });
    const existingByStudent = new Map(existing.map((i) => [i.student_id, i]));

    let created = 0;
    let updated = 0;

    // Use transaction for consistency.
    await this.database.$transaction(async (tx) => {
      for (const [studentId, data] of byStudent.entries()) {
        const prev = existingByStudent.get(studentId);
        if (prev && (prev.status === InvoiceStatus.PAID || prev.status === InvoiceStatus.VOID)) {
          continue; // don't modify closed invoices
        }

        const invoice = await tx.invoice.upsert({
          where: {
            organization_id_student_id_month: {
              organization_id: organizationId,
              student_id: studentId,
              month: monthDate,
            },
          },
          create: {
            organization_id: organizationId,
            student_id: studentId,
            month: monthDate,
            due_date: dueDate,
            status: InvoiceStatus.OPEN,
            amount_due: data.total,
            amount_paid: new Prisma.Decimal(0),
          },
          update: {
            due_date: dueDate,
            amount_due: data.total,
            // status recalculated below after items update
          },
        });

        // Replace items to match current enrollments (keeps invoice stable for the month).
        await tx.invoiceItem.deleteMany({ where: { invoice_id: invoice.id } });
        if (data.items.length > 0) {
          await tx.invoiceItem.createMany({
            data: data.items.map((it) => ({
              invoice_id: invoice.id,
              enrollment_id: it.enrollment_id,
              amount: it.amount,
              description: null,
            })),
          });
        }

        // Recompute status (overdue if due date passed and unpaid).
        const refreshed = await tx.invoice.findUnique({
          where: { id: invoice.id },
          select: { amount_due: true, amount_paid: true, due_date: true },
        });
        const now = new Date();
        const isPaid = refreshed!.amount_paid.greaterThanOrEqualTo(refreshed!.amount_due);
        const isOverdue = !isPaid && now.getTime() > refreshed!.due_date.getTime();
        const nextStatus = isPaid ? InvoiceStatus.PAID : isOverdue ? InvoiceStatus.OVERDUE : InvoiceStatus.OPEN;
        await tx.invoice.update({
          where: { id: invoice.id },
          data: { status: nextStatus },
        });

        if (prev) updated += 1;
        else created += 1;
      }
    });

    return { message: 'Invoices generated', created, updated };
  }

  async listInvoices(
    organizationId: string,
    query: QueryInvoiceDto,
  ): Promise<PaginatedInvoiceResponseDto> {
    const { page = 1, limit = 20, month, status, student_id, search } = query;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (month) where.month = parseMonthOrThrow(month);
    if (status) where.status = status;
    if (student_id) where.student_id = student_id;
    if (search) {
      where.student = {
        OR: [
          { name: { contains: search, mode: 'insensitive' } },
          { phone: { contains: search } },
        ],
      };
    }

    const [items, total] = await Promise.all([
      this.database.invoice.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ month: 'desc' }, { created_at: 'desc' }],
        include: {
          student: { select: { name: true, phone: true } },
          items: {
            include: {
              enrollment: {
                select: {
                  group_id: true,
                  group: {
                    select: {
                      name: true,
                      course: { select: { title: true } },
                    },
                  },
                },
              },
            },
            orderBy: { created_at: 'asc' },
          },
        },
      }),
      this.database.invoice.count({ where }),
    ]);

    return {
      items: items.map((i) => this.toInvoiceResponse(i as any)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async getInvoice(
    organizationId: string,
    invoiceId: string,
  ): Promise<InvoiceResponseDto> {
    const invoice = await this.database.invoice.findFirst({
      where: { id: invoiceId, organization_id: organizationId },
      include: {
        student: { select: { name: true, phone: true } },
        items: {
          include: {
            enrollment: {
              select: {
                group_id: true,
                group: {
                  select: { name: true, course: { select: { title: true } } },
                },
              },
            },
          },
          orderBy: { created_at: 'asc' },
        },
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    return this.toInvoiceResponse(invoice as any);
  }

  async payInvoice(
    organizationId: string,
    invoiceId: string,
    cashierUserId: string,
    dto: PayInvoiceDto,
  ): Promise<{ message: string; invoice: InvoiceResponseDto }> {
    const invoice = await this.database.invoice.findFirst({
      where: { id: invoiceId, organization_id: organizationId },
      select: {
        id: true,
        student_id: true,
        amount_due: true,
        amount_paid: true,
        status: true,
        due_date: true,
      },
    });
    if (!invoice) throw new NotFoundException('Invoice not found');
    if (invoice.status === InvoiceStatus.VOID) {
      throw new BadRequestException('Invoice is void');
    }

    await this.database.$transaction(async (tx) => {
      const payment = await tx.payment.create({
        data: {
          organization_id: organizationId,
          student_id: invoice.student_id,
          invoice_id: invoice.id,
          amount: dto.amount,
          method: dto.method,
          status: dto.status ?? PaymentStatus.COMPLETED,
          description: dto.description,
          cashier_user_id: cashierUserId,
          receipt_number: await this.generateReceiptNumber(organizationId),
        },
      });

      const nextPaid = invoice.amount_paid.add(payment.amount);
      const isPaid = nextPaid.greaterThanOrEqualTo(invoice.amount_due);
      const now = new Date();
      const isOverdue = !isPaid && now.getTime() > invoice.due_date.getTime();
      const nextStatus = isPaid
        ? InvoiceStatus.PAID
        : isOverdue
          ? InvoiceStatus.OVERDUE
          : InvoiceStatus.OPEN;

      await tx.invoice.update({
        where: { id: invoice.id },
        data: {
          amount_paid: nextPaid,
          status: nextStatus,
        },
      });
    });

    const refreshed = await this.getInvoice(organizationId, invoiceId);
    return { message: 'Payment recorded', invoice: refreshed };
  }

  private toInvoiceResponse(invoice: any): InvoiceResponseDto {
    const amountDue = invoice.amount_due?.toString?.() ?? String(invoice.amount_due ?? '0');
    const amountPaid =
      invoice.amount_paid?.toString?.() ?? String(invoice.amount_paid ?? '0');
    const debtDec = new Prisma.Decimal(amountDue).sub(new Prisma.Decimal(amountPaid));

    return {
      id: invoice.id,
      organization_id: invoice.organization_id,
      student_id: invoice.student_id,
      student_name: invoice.student.name,
      student_phone: invoice.student.phone,
      month: fmtYYYYMM(invoice.month),
      due_date: fmtYYYYMMDD(invoice.due_date),
      status: invoice.status,
      amount_due: amountDue,
      amount_paid: amountPaid,
      debt: debtDec.greaterThan(0) ? debtDec.toString() : '0',
      created_at: invoice.created_at,
      updated_at: invoice.updated_at,
      items: (invoice.items ?? []).map((it: any) => ({
        id: it.id,
        enrollment_id: it.enrollment_id,
        group_id: it.enrollment.group_id,
        group_name: it.enrollment.group.name,
        course_title: it.enrollment.group.course.title,
        amount: it.amount?.toString?.() ?? String(it.amount ?? '0'),
        description: it.description ?? null,
      })),
    };
  }

  private tryParseDecimal(value: unknown): Prisma.Decimal | null {
    if (typeof value !== 'string') return null;
    const s = value.trim();
    // Accept integers/decimals only.
    if (!/^\d+(\.\d+)?$/.test(s)) return null;
    try {
      return new Prisma.Decimal(s);
    } catch {
      return null;
    }
  }

  private async generateReceiptNumber(organizationId: string): Promise<string> {
    const ymd = new Date().toISOString().slice(0, 10).replaceAll('-', '');
    const rand = Math.random().toString(36).slice(2, 8).toUpperCase();
    return `RCPT-${organizationId.slice(0, 4).toUpperCase()}-${ymd}-${rand}`;
  }
}

