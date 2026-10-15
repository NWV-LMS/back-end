import * as request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getApp,
  getAuthToken,
  getDatabase,
  getTestOrganizationId,
  getTestStudentId,
  getTestAdminId,
} from './setup-e2e';

describe('FinanceController (e2e)', () => {
  let authToken: string;

  beforeAll(async () => {
    await createTestApp();
    authToken = await getAuthToken();
    const organization_id = getTestOrganizationId();
    const paid_at = new Date('2026-06-15T12:30:00.000Z');
    await getDatabase().$transaction([
      getDatabase().payment.create({
        data: {
          organization_id,
          student_id: getTestStudentId(),
          amount: 500000,
          method: 'CASH',
          status: 'COMPLETED',
          paid_at,
        },
      }),
      getDatabase().payment.create({
        data: {
          organization_id,
          student_id: getTestStudentId(),
          amount: 900000,
          method: 'CARD',
          status: 'PENDING',
          paid_at,
        },
      }),
      getDatabase().expense.create({
        data: {
          organization_id,
          created_by: getTestAdminId(),
          category: 'SALARY',
          amount: 100000,
          description: 'E2E salary',
          paid_at,
        },
      }),
    ]);
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /api/finance/summary', () => {
    it('should return financial summary', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/finance/summary')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('totalIncome');
      expect(response.body).toHaveProperty('totalExpenses');
      expect(response.body).toHaveProperty('profit');
      expect(response.body).toHaveProperty('paymentCount');
      expect(response.body).toHaveProperty('expenseCount');
      expect(response.body).toHaveProperty('period');
      expect(response.body.period).toHaveProperty('from');
      expect(response.body.period).toHaveProperty('to');
    });

    it('should accept date range filters', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/finance/summary?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toEqual({
        totalIncome: 500000,
        totalExpenses: 100000,
        profit: 400000,
        paymentCount: 1,
        expenseCount: 1,
        period: { from: '2026-06-15', to: '2026-06-15' },
      });
    });

    it.each(['not-a-date', '2026-02-30'])('rejects invalid date %s', (date) => {
      return request(getApp().getHttpServer())
        .get(`/api/finance/summary?from=${date}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .get('/api/finance/summary')
        .expect(401);
    });
  });

  describe('GET /api/finance/report', () => {
    it('should return full financial report', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/finance/report?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('summary');
      expect(response.body).toHaveProperty('incomeByMethod');
      expect(response.body).toHaveProperty('expenseByCategory');

      // Validate summary structure
      expect(response.body.summary).toHaveProperty('totalIncome');
      expect(response.body.summary).toHaveProperty('profit');

      // Validate arrays
      expect(Array.isArray(response.body.incomeByMethod)).toBe(true);
      expect(Array.isArray(response.body.expenseByCategory)).toBe(true);
    });

    it('should include income breakdown by method', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/finance/report?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.incomeByMethod).toEqual([
        { method: 'CASH', total: 500000, count: 1 },
      ]);
    });

    it('should include expense breakdown by category', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/finance/report?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.expenseByCategory).toEqual([
        { category: 'SALARY', total: 100000, count: 1 },
      ]);
    });

    it('should accept date range filters', async () => {
      const from = '2026-01-01';
      const to = '2026-12-31';
      const response = await request(getApp().getHttpServer())
        .get(`/api/finance/report?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary.period.from).toBe(from);
      expect(response.body.summary.period.to).toBe(to);
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .get('/api/finance/report')
        .expect(401);
    });
  });
});
