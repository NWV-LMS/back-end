import { NotFoundException } from '@nestjs/common';
import { InvoiceStatus, PaymentStatus, Prisma } from '@prisma/client';

export type InvoiceBalance = {
  id: string;
  student_id: string;
  amount_due: Prisma.Decimal;
  status: InvoiceStatus;
  due_date: Date;
};

// All payment writers lock the invoice before any payment row. Keep this order
// so create, update and delete serialize on the same financial aggregate.
export async function lockInvoice(
  tx: Prisma.TransactionClient,
  organizationId: string,
  invoiceId: string,
): Promise<void> {
  const invoices = await tx.$queryRaw<{ id: string }[]>`
    SELECT "id" FROM "Invoice"
    WHERE "id" = ${invoiceId}::uuid
      AND "organization_id" = ${organizationId}::uuid
    FOR UPDATE
  `;
  if (invoices.length === 0) {
    throw new NotFoundException('Invoice not found');
  }
}

// Caller must hold the invoice lock in this transaction. Completed payments are
// the source of truth; recomputing also repairs a previously stale cached total.
export async function reconcileInvoiceBalance(
  tx: Prisma.TransactionClient,
  organizationId: string,
  invoice: InvoiceBalance,
): Promise<void> {
  const payments = await tx.payment.aggregate({
    where: {
      organization_id: organizationId,
      student_id: invoice.student_id,
      invoice_id: invoice.id,
      status: PaymentStatus.COMPLETED,
    },
    _sum: { amount: true },
  });
  const amountPaid = payments._sum.amount ?? new Prisma.Decimal(0);
  const status =
    invoice.status === InvoiceStatus.VOID
      ? InvoiceStatus.VOID
      : amountPaid.greaterThanOrEqualTo(invoice.amount_due)
        ? InvoiceStatus.PAID
        : Date.now() > invoice.due_date.getTime()
          ? InvoiceStatus.OVERDUE
          : InvoiceStatus.OPEN;

  await tx.invoice.update({
    where: { id: invoice.id, organization_id: organizationId },
    data: { amount_paid: amountPaid, status },
  });
}
