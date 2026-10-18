import * as request from 'supertest';
import { randomUUID } from 'crypto';
import {
  createTestApp,
  closeTestApp,
  getApp,
  getAuthToken,
  getDatabase,
  getTestOrganizationId,
} from './setup-e2e';

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

  describe('POST /api/expense', () => {
    it('should create an expense', async () => {
      const response = await request(getApp().getHttpServer())
        .post('/api/expense')
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
      expect(response.body.organization_id).toBe(getTestOrganizationId());
      await getDatabase().expense.update({
        where: { id: createdExpenseId },
        data: { paid_at: new Date('2026-06-15T12:30:00.000Z') },
      });
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .post('/api/expense')
        .send({ category: 'RENT', amount: 500000, description: 'Office rent' })
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(getApp().getHttpServer())
        .post('/api/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });

    it('should validate enum values', () => {
      return request(getApp().getHttpServer())
        .post('/api/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .send({ category: 'INVALID', amount: 100, description: 'Test' })
        .expect(400);
    });
  });

  describe('GET /api/expense', () => {
    it('should return paginated expenses', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/expense')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('meta');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter by category', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/expense?category=SALARY')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.items.every((e: any) => e.category === 'SALARY'),
      ).toBe(true);
      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: createdExpenseId }),
        ]),
      );
    });

    it('should filter by date range', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/expense?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({ id: createdExpenseId }),
      ]);
    });

    it.each(['not-a-date', '2026-02-30'])('rejects invalid date %s', (date) => {
      return request(getApp().getHttpServer())
        .get(`/api/expense?to=${date}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/expense/:id', () => {
    it('should return a single expense', async () => {
      const response = await request(getApp().getHttpServer())
        .get(`/api/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdExpenseId);
    });

    it('should return 404 for non-existent expense', () => {
      return request(getApp().getHttpServer())
        .get(`/api/expense/${randomUUID()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/expense/:id', () => {
    it('should update an expense', async () => {
      const response = await request(getApp().getHttpServer())
        .patch(`/api/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ amount: 1500000 })
        .expect(200);

      expect(response.body.amount).toBe(1500000);
    });
  });

  describe('DELETE /api/expense/:id', () => {
    it('should delete an expense', async () => {
      await request(getApp().getHttpServer())
        .delete(`/api/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(getApp().getHttpServer())
        .get(`/api/expense/${createdExpenseId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
