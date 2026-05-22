import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { PaymentService } from './payment.service';
import { DatabaseService } from '../../database/database.service';

const ORG = 'org-111';
const STUDENT_ID = 'student-aaa';
const CASHIER_ID = 'user-cashier';
const PAYMENT_ID = 'pay-001';

const fakeStudent = { id: STUDENT_ID, organization_id: ORG, name: 'Alisher' };

const fakePayment = {
  id: PAYMENT_ID,
  organization_id: ORG,
  student_id: STUDENT_ID,
  amount: 5000,
  method: 'CASH',
  status: PaymentStatus.COMPLETED,
  description: null,
  receipt_number: 'RCPT-ORG1-20260520-ABCDEF',
  cashier_user_id: CASHIER_ID,
  invoice_id: null,
  paid_at: new Date(),
  created_at: new Date(),
  student: { name: 'Alisher' },
};

describe('PaymentService', () => {
  let service: PaymentService;
  let db: jest.Mocked<DatabaseService>;

  beforeEach(async () => {
    const mockDb = {
      student: {
        findFirst: jest.fn(),
      },
      payment: {
        create: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        findFirst: jest.fn(),
        update: jest.fn(),
        delete: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PaymentService,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    service = module.get<PaymentService>(PaymentService);
    db = module.get(DatabaseService);
  });

  // ── create ────────────────────────────────────────────────────────────────

  describe('create', () => {
    it('throws BadRequestException when student not in org', async () => {
      (db.student.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          ORG,
          { student_id: STUDENT_ID, amount: 1000, method: 'CASH' },
          CASHIER_ID,
        ),
      ).rejects.toThrow(BadRequestException);
    });

    it('creates payment with COMPLETED status by default', async () => {
      (db.student.findFirst as jest.Mock).mockResolvedValue(fakeStudent);
      (db.payment.create as jest.Mock).mockResolvedValue(fakePayment);

      const result = await service.create(
        ORG,
        { student_id: STUDENT_ID, amount: 5000, method: 'CASH' },
        CASHIER_ID,
      );

      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: PaymentStatus.COMPLETED,
            student_id: STUDENT_ID,
            amount: 5000,
          }),
        }),
      );
      expect(result.id).toBe(PAYMENT_ID);
      expect(result.amount).toBe(5000);
    });

    it('uses provided status when given', async () => {
      (db.student.findFirst as jest.Mock).mockResolvedValue(fakeStudent);
      (db.payment.create as jest.Mock).mockResolvedValue({
        ...fakePayment,
        status: PaymentStatus.PENDING,
      });

      await service.create(
        ORG,
        {
          student_id: STUDENT_ID,
          amount: 500,
          method: 'CARD',
          status: PaymentStatus.PENDING,
        },
        CASHIER_ID,
      );

      expect(db.payment.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: PaymentStatus.PENDING }),
        }),
      );
    });

    it('verifies student belongs to same org (not different org)', async () => {
      (db.student.findFirst as jest.Mock).mockResolvedValue(null);

      await expect(
        service.create(
          'other-org',
          { student_id: STUDENT_ID, amount: 1000, method: 'CASH' },
          CASHIER_ID,
        ),
      ).rejects.toThrow('Student not found in this organization');

      expect(db.student.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ organization_id: 'other-org' }),
        }),
      );
    });
  });

  // ── findAll ───────────────────────────────────────────────────────────────

  describe('findAll', () => {
    beforeEach(() => {
      (db.payment.findMany as jest.Mock).mockResolvedValue([fakePayment]);
      (db.payment.count as jest.Mock).mockResolvedValue(1);
    });

    it('returns paginated results', async () => {
      const result = await service.findAll(ORG, { page: 1, limit: 10 });
      expect(result.items).toHaveLength(1);
      expect(result.meta.total).toBe(1);
      expect(result.meta.pages).toBe(1);
    });

    it('passes student_id filter to query', async () => {
      await service.findAll(ORG, { student_id: STUDENT_ID });
      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ student_id: STUDENT_ID }),
        }),
      );
    });

    it('passes date range filter when from/to provided', async () => {
      await service.findAll(ORG, { from: '2026-05-01', to: '2026-05-31' });
      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            paid_at: expect.objectContaining({
              gte: expect.any(Date),
              lte: expect.any(Date),
            }),
          }),
        }),
      );
    });

    it('skips correctly for page 2', async () => {
      await service.findAll(ORG, { page: 2, limit: 10 });
      expect(db.payment.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10 }),
      );
    });
  });

  // ── findOne ───────────────────────────────────────────────────────────────

  describe('findOne', () => {
    it('throws NotFoundException when payment not found', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.findOne(ORG, PAYMENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns payment dto when found', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(fakePayment);
      const result = await service.findOne(ORG, PAYMENT_ID);
      expect(result.id).toBe(PAYMENT_ID);
      expect(result.student_name).toBe('Alisher');
    });
  });

  // ── update ───────────────────────────────────────────────────────────────

  describe('update', () => {
    it('throws NotFoundException when payment not found', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(
        service.update(ORG, PAYMENT_ID, { amount: 9000 }),
      ).rejects.toThrow(NotFoundException);
    });

    it('updates payment fields', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(fakePayment);
      (db.payment.update as jest.Mock).mockResolvedValue({
        ...fakePayment,
        amount: 9000,
        description: 'updated',
      });

      const result = await service.update(ORG, PAYMENT_ID, {
        amount: 9000,
        description: 'updated',
      });

      expect(db.payment.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: PAYMENT_ID },
          data: expect.objectContaining({
            amount: 9000,
            description: 'updated',
          }),
        }),
      );
      expect(result.amount).toBe(9000);
    });
  });

  // ── remove ───────────────────────────────────────────────────────────────

  describe('remove', () => {
    it('throws NotFoundException when payment not found', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(null);
      await expect(service.remove(ORG, PAYMENT_ID)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('deletes payment when found', async () => {
      (db.payment.findFirst as jest.Mock).mockResolvedValue(fakePayment);
      (db.payment.delete as jest.Mock).mockResolvedValue(undefined);

      await service.remove(ORG, PAYMENT_ID);

      expect(db.payment.delete).toHaveBeenCalledWith({
        where: { id: PAYMENT_ID },
      });
    });
  });
});
