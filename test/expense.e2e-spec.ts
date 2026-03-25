import * as request from 'supertest';
import { createTestApp, closeTestApp, getApp, getAuthToken } from './setup-e2e';

describe('ExpenseController (e2e)', () => {
  let authToken: string;
  let createdExpenseId: string;

  beforeAll(async () => {
    await createTestApp();
    authToken = await getAuthToken();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /expense', () => {
    it('should create an expense', async () => {
      const response = await request(getApp().getHttpServer())
        .post('/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          category: 'SALARY',
          amount: 1000000,
          description: 'Teacher salaries',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.category).toBe('SALARY');
      expect(response.body.amount).toBe(1000000);
      createdExpenseId = response.body.id;
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .post('/expense')
        .send({ category: 'RENT', amount: 500000, description: 'Office rent' })
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(getApp().getHttpServer())
        .post('/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should validate enum values', () => {
      return request(getApp().getHttpServer())
        .post('/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'INVALID', amount: 100, description: 'Test' })
        .expect(400);
    });
  });

  describe('GET /expense', () => {
    it('should return paginated expenses', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/expense?category=SALARY')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.items.every((e: any) => e.category === 'SALARY'),
      ).toBe(true);
    });

    it('should filter by date range', async () => {
      const today = new Date().toISOString().split('T')[0];
      const response = await request(getApp().getHttpServer())
        .get(`/expense?from=${today}&to=${today}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
    });
  });

  describe('GET /expense/:id', () => {
    it('should return a single expense', async () => {
      if (!createdExpenseId) return;

      const response = await request(getApp().getHttpServer())
        .get(`/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdExpenseId);
    });

    it('should return 404 for non-existent expense', () => {
      return request(getApp().getHttpServer())
        .get('/expense/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /expense/:id', () => {
    it('should update an expense', async () => {
      if (!createdExpenseId) return;

      const response = await request(getApp().getHttpServer())
        .patch(`/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 1500000 })
        .expect(200);

      expect(response.body.amount).toBe(1500000);
    });
  });

  describe('DELETE /expense/:id', () => {
    it('should delete an expense', async () => {
      if (!createdExpenseId) return;

      await request(getApp().getHttpServer())
        .delete(`/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(getApp().getHttpServer())
        .get(`/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
