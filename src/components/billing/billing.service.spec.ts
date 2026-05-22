import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Prisma, InvoiceStatus, PaymentStatus } from '@prisma/client';
import { BillingService } from './billing.service';
import { DatabaseService } from '../../database/database.service';

const ORG = 'org-111';
const STUDENT_A = 'student-aaa';
const STUDENT_B = 'student-bbb';
const INVOICE_ID = 'invoice-001';
const CASHIER_ID = 'user-cashier';

// Fake enrollment — billing_active, has monthly_fee
const enrollment = (
  studentId: string,
  monthlyFee: string | null,
  coursePrice: string,
) => ({
  id: `enroll-${studentId}`,
  student_id: studentId,
  group_id: 'group-1',
  monthly_fee: monthlyFee ? new Prisma.Decimal(monthlyFee) : null,
  group: {
    name: 'Math A',
    course: { title: 'Mathematics', price: coursePrice },
  },
  student: { name: 'Test Student', phone: '+996700000001' },
});

const fakeInvoice = (
  studentId: string,
  status: InvoiceStatus,
  amountDue = '5000',
  amountPaid = '0',
) => ({
  id: INVOICE_ID,
  organization_id: ORG,
  student_id: studentId,
  month: new Date('2026-05-01T00:00:00.000Z'),
  due_date: new Date('2026-05-01T00:00:00.000Z'),
  status,
  amount_due: new Prisma.Decimal(amountDue),
  amount_paid: new Prisma.Decimal(amountPaid),
  created_at: new Date(),
  updated_at: new Date(),
  student: { name: 'Test Student', phone: '+996700000001' },
  items: [],
});

describe('BillingService', () => {
  let service: BillingService;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockDb = {
      enrollment: { findMany: jest.fn() },
      invoice: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
        count: jest.fn(),
      },
      invoiceItem: {
        deleteMany: jest.fn(),
        createMany: jest.fn(),
      },
      payment: { create: jest.fn() },
      $transaction: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
    db = module.get(DatabaseService);

    // Default: $transaction runs callback immediately with db as tx
    (db.$transaction as jest.Mock).mockImplementation(async (cb) => cb(db));
  });

  // ── generateInvoices ──────────────────────────────────────────────────────

  describe('generateInvoices', () => {
    it('throws BadRequestException for invalid month format', async () => {
      await expect(
        service.generateInvoices(ORG, { month: '05-2026' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateInvoices(ORG, { month: '2026/05' }),
      ).rejects.toThrow(BadRequestException);
      await expect(
        service.generateInvoices(ORG, { month: 'invalid' }),
      ).rejects.toThrow(BadRequestException);
    });

    it('accepts valid YYYY-MM month format', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.generateInvoices(ORG, { month: '2026-05' });
      expect(result.created).toBe(0);
    });

    it('returns early with zero counts when no enrollments', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([]);
      const result = await service.generateInvoices(ORG, { month: '2026-05' });
      expect(result).toMatchObject({ created: 0, updated: 0 });
      expect(db.$transaction).not.toHaveBeenCalled();
    });

    it('creates one invoice per student (not per enrollment)', async () => {
      // Student A has 2 enrollments — should produce 1 invoice
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, '2000', '2000'),
        enrollment(STUDENT_A, '3000', '3000'),
      ]);
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const upsertedInvoice = {
        id: INVOICE_ID,
        amount_paid: new Prisma.Decimal('0'),
        amount_due: new Prisma.Decimal('5000'),
        due_date: new Date('2026-05-01'),
      };
      (db.invoice.upsert as jest.Mock).mockResolvedValue(upsertedInvoice);
      (db.invoice.findUnique as jest.Mock).mockResolvedValue(upsertedInvoice);
      (db.invoice.update as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.deleteMany as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.createMany as jest.Mock).mockResolvedValue({});

      const result = await service.generateInvoices(ORG, { month: '2026-05' });

      expect(db.invoice.upsert).toHaveBeenCalledTimes(1);
      expect(result.created).toBe(1);
    });

    it('uses monthly_fee when set (not course price)', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, '1500', '9999'), // monthly_fee=1500, course.price=9999
      ]);
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const capturedUpsert = {
        id: INVOICE_ID,
        amount_paid: new Prisma.Decimal('0'),
        amount_due: new Prisma.Decimal('1500'),
        due_date: new Date(),
      };
      (db.invoice.upsert as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.findUnique as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.update as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.deleteMany as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.createMany as jest.Mock).mockResolvedValue({});

      await service.generateInvoices(ORG, { month: '2026-05' });

      expect(db.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            amount_due: new Prisma.Decimal('1500'),
          }),
        }),
      );
    });

    it('falls back to course price when monthly_fee is null', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, null, '4500'),
      ]);
      (db.invoice.findMany as jest.Mock).mockResolvedValue([]);

      const capturedUpsert = {
        id: INVOICE_ID,
        amount_paid: new Prisma.Decimal('0'),
        amount_due: new Prisma.Decimal('4500'),
        due_date: new Date(),
      };
      (db.invoice.upsert as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.findUnique as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.update as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.deleteMany as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.createMany as jest.Mock).mockResolvedValue({});

      await service.generateInvoices(ORG, { month: '2026-05' });

      expect(db.invoice.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            amount_due: new Prisma.Decimal('4500'),
          }),
        }),
      );
    });

    it('skips PAID invoices — does not update them', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, '5000', '5000'),
      ]);
      // Existing PAID invoice for student A
      (db.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: INVOICE_ID, student_id: STUDENT_A, status: InvoiceStatus.PAID },
      ]);

      const result = await service.generateInvoices(ORG, { month: '2026-05' });

      expect(db.invoice.upsert).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
      expect(result.updated).toBe(0);
    });

    it('skips VOID invoices', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, '5000', '5000'),
      ]);
      (db.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: INVOICE_ID, student_id: STUDENT_A, status: InvoiceStatus.VOID },
      ]);

      const result = await service.generateInvoices(ORG, { month: '2026-05' });
      expect(db.invoice.upsert).not.toHaveBeenCalled();
      expect(result.created).toBe(0);
    });

    it('counts existing invoice as updated (not created)', async () => {
      (db.enrollment.findMany as jest.Mock).mockResolvedValue([
        enrollment(STUDENT_A, '5000', '5000'),
      ]);
      (db.invoice.findMany as jest.Mock).mockResolvedValue([
        { id: INVOICE_ID, student_id: STUDENT_A, status: InvoiceStatus.OPEN },
      ]);

      const capturedUpsert = {
        id: INVOICE_ID,
        amount_paid: new Prisma.Decimal('0'),
        amount_due: new Prisma.Decimal('5000'),
        due_date: new Date(),
      };
      (db.invoice.upsert as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.findUnique as jest.Mock).mockResolvedValue(capturedUpsert);
      (db.invoice.update as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.deleteMany as jest.Mock).mockResolvedValue({});
      (db.invoiceItem.createMany as jest.Mock).mockResolvedValue({});

      const result = await service.generateInvoices(ORG, { month: '2026-05' });
      expect(result.updated).toBe(1);
      expect(result.created).toBe(0);
    });
  });

  // ── getInvoice ────────────────────────────────────────────────────────────

  describe('getInvoice', () => {
    it('throws NotFoundException when invoice not found', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.getInvoice(ORG, INVOICE_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns invoice dto when found', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(
        fakeInvoice(STUDENT_A, InvoiceStatus.OPEN),
      );
      const result = await service.getInvoice(ORG, INVOICE_ID);
      expect(result.id).toBe(INVOICE_ID);
      expect(result.status).toBe(InvoiceStatus.OPEN);
      expect(result.debt).toBe('5000');
    });
  });

  // ── payInvoice ────────────────────────────────────────────────────────────

  describe('payInvoice', () => {
    it('throws NotFoundException when invoice not found', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
          amount: 5000,
          method: 'CASH',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException for VOID invoice', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue({
        id: INVOICE_ID,
        student_id: STUDENT_A,
        amount_due: new Prisma.Decimal('5000'),
        amount_paid: new Prisma.Decimal('0'),
        status: InvoiceStatus.VOID,
        due_date: new Date(),
      });

      await expect(
        service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
          amount: 5000,
          method: 'CASH',
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('marks invoice PAID when full amount received', async () => {
      (db.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: INVOICE_ID,
          student_id: STUDENT_A,
          amount_due: new Prisma.Decimal('5000'),
          amount_paid: new Prisma.Decimal('0'),
          status: InvoiceStatus.OPEN,
          due_date: new Date(Date.now() + 86400000), // future
        })
        // second call inside getInvoice refresh at end of payInvoice
        .mockResolvedValueOnce(
          fakeInvoice(STUDENT_A, InvoiceStatus.PAID, '5000', '5000'),
        );

      (db.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-x',
        amount: new Prisma.Decimal('5000'),
      });
      (db.invoice.update as jest.Mock).mockResolvedValue({});

      await service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
        amount: 5000,
        method: 'CASH',
      });

      expect(db.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.PAID }),
        }),
      );
    });

    it('keeps invoice OPEN after partial payment', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      (db.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: INVOICE_ID,
          student_id: STUDENT_A,
          amount_due: new Prisma.Decimal('5000'),
          amount_paid: new Prisma.Decimal('0'),
          status: InvoiceStatus.OPEN,
          due_date: futureDate,
        })
        .mockResolvedValueOnce(
          fakeInvoice(STUDENT_A, InvoiceStatus.OPEN, '5000', '2000'),
        );

      (db.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-x',
        amount: new Prisma.Decimal('2000'),
      });
      (db.invoice.update as jest.Mock).mockResolvedValue({});

      await service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
        amount: 2000,
        method: 'CASH',
      });

      expect(db.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.OPEN }),
        }),
      );
    });

    it('marks invoice OVERDUE for partial payment on past-due invoice', async () => {
      const pastDate = new Date(Date.now() - 86400000); // yesterday
      (db.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: INVOICE_ID,
          student_id: STUDENT_A,
          amount_due: new Prisma.Decimal('5000'),
          amount_paid: new Prisma.Decimal('0'),
          status: InvoiceStatus.OVERDUE,
          due_date: pastDate,
        })
        .mockResolvedValueOnce(
          fakeInvoice(STUDENT_A, InvoiceStatus.OVERDUE, '5000', '1000'),
        );

      (db.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-x',
        amount: new Prisma.Decimal('1000'),
      });
      (db.invoice.update as jest.Mock).mockResolvedValue({});

      await service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
        amount: 1000,
        method: 'CASH',
      });

      expect(db.invoice.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: InvoiceStatus.OVERDUE }),
        }),
      );
    });

    it('creates a payment record linked to invoice', async () => {
      const futureDate = new Date(Date.now() + 86400000);
      (db.invoice.findFirst as jest.Mock)
        .mockResolvedValueOnce({
          id: INVOICE_ID,
          student_id: STUDENT_A,
          amount_due: new Prisma.Decimal('5000'),
          amount_paid: new Prisma.Decimal('0'),
          status: InvoiceStatus.OPEN,
          due_date: futureDate,
        })
        .mockResolvedValueOnce(
          fakeInvoice(STUDENT_A, InvoiceStatus.PAID, '5000', '5000'),
        );

      (db.payment.create as jest.Mock).mockResolvedValue({
        id: 'pay-x',
        amount: new Prisma.Decimal('5000'),
      });
      (db.invoice.update as jest.Mock).mockResolvedValue({});

      await service.payInvoice(ORG, INVOICE_ID, CASHIER_ID, {
        amount: 5000,
        method: 'TRANSFER',
        description: 'Monthly fee May',
      });

      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            invoice_id: INVOICE_ID,
            student_id: STUDENT_A,
            amount: 5000,
            method: 'TRANSFER',
            description: 'Monthly fee May',
            cashier_user_id: CASHIER_ID,
          }),
        }),
      );
    });
  });

  // ── debt calculation in toInvoiceResponse ────────────────────────────────

  describe('debt calculation', () => {
    it('debt = 0 when fully paid', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(
        fakeInvoice(STUDENT_A, InvoiceStatus.PAID, '5000', '5000'),
      );
      const result = await service.getInvoice(ORG, INVOICE_ID);
      expect(result.debt).toBe('0');
    });

    it('debt = amount_due - amount_paid when partially paid', async () => {
      (db.invoice.findFirst as jest.Mock).mockResolvedValue(
        fakeInvoice(STUDENT_A, InvoiceStatus.OPEN, '5000', '2000'),
      );
      const result = await service.getInvoice(ORG, INVOICE_ID);
      expect(result.debt).toBe('3000');
    });
  });
});
