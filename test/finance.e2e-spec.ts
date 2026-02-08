import * as request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getApp,
  getAuthToken,
} from './setup-e2e';

describe('FinanceController (e2e)', () => {
  let authToken: string;

  beforeAll(async () => {
    await createTestApp();
    authToken = await getAuthToken();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('GET /finance/summary', () => {
    it('should return financial summary', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/finance/summary')
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
      const today = new Date().toISOString().split('T')[0];
      const response = await request(getApp().getHttpServer())
        .get(`/finance/summary?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.period.from).toBe(today);
      expect(response.body.period.to).toBe(today);
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .get('/finance/summary')
        .expect(401);
    });
  });

  describe('GET /finance/report', () => {
    it('should return full financial report', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/finance/report')
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
        .get('/finance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.incomeByMethod.length > 0) {
        const item = response.body.incomeByMethod[0];
        expect(item).toHaveProperty('method');
        expect(item).toHaveProperty('total');
        expect(item).toHaveProperty('count');
      }
    });

    it('should include expense breakdown by category', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/finance/report')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      if (response.body.expenseByCategory.length > 0) {
        const item = response.body.expenseByCategory[0];
        expect(item).toHaveProperty('category');
        expect(item).toHaveProperty('total');
        expect(item).toHaveProperty('count');
      }
    });

    it('should accept date range filters', async () => {
      const from = '2026-01-01';
      const to = '2026-12-31';
      const response = await request(getApp().getHttpServer())
        .get(`/finance/report?from=${from}&to=${to}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.summary.period.from).toBe(from);
      expect(response.body.summary.period.to).toBe(to);
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .get('/finance/report')
        .expect(401);
    });
  });
});
