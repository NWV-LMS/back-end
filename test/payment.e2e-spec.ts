import * as request from 'supertest';
import { randomUUID } from 'crypto';
import {
  createTestApp,
  closeTestApp,
  getApp,
  getAuthToken,
  getTestStudentId,
  getDatabase,
  getTestOrganizationId,
} from './setup-e2e';

describe('PaymentController (e2e)', () => {
  let authToken: string;
  let testStudentId: string;
  let createdPaymentId: string;

  beforeAll(async () => {
    await createTestApp();
    authToken = await getAuthToken();
    testStudentId = getTestStudentId();
  });

  afterAll(async () => {
    await closeTestApp();
  });

  describe('POST /api/payment', () => {
    it('should create a payment', async () => {
      const response = await request(getApp().getHttpServer())
        .post('/api/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          student_id: testStudentId,
          amount: 500000,
          method: 'CASH',
          description: 'Test payment',
        })
        .expect(201);

      expect(response.body).toHaveProperty('id');
      expect(response.body.amount).toBe(500000);
      expect(response.body.method).toBe('CASH');
      createdPaymentId = response.body.id;
      expect(response.body.organization_id).toBe(getTestOrganizationId());
      await getDatabase().payment.update({
        where: { id: createdPaymentId },
        data: { paid_at: new Date('2026-06-15T12:30:00.000Z') },
      });
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .post('/api/payment')
        .send({ student_id: testStudentId, amount: 100, method: 'CASH' })
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(getApp().getHttpServer())
        .post('/api/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /api/payment', () => {
    it('should return paginated payments', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body).toHaveProperty('meta');
      expect(response.body.meta).toHaveProperty('total');
      expect(response.body.meta).toHaveProperty('page');
      expect(Array.isArray(response.body.items)).toBe(true);
    });

    it('should filter by status', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/payment?status=COMPLETED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(
        response.body.items.every((p: any) => p.status === 'COMPLETED'),
      ).toBe(true);
      expect(response.body.items).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ id: createdPaymentId }),
        ]),
      );
    });

    it('should paginate correctly', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/payment?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(5);
    });

    it('includes payments throughout the final date of a date-only range', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/api/payment?from=2026-06-15&to=2026-06-15')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items).toEqual([
        expect.objectContaining({ id: createdPaymentId }),
      ]);
    });

    it.each(['not-a-date', '2026-02-30'])('rejects invalid date %s', (date) => {
      return request(getApp().getHttpServer())
        .get(`/api/payment?from=${date}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(400);
    });
  });

  describe('GET /api/payment/:id', () => {
    it('should return a single payment', async () => {
      const response = await request(getApp().getHttpServer())
        .get(`/api/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdPaymentId);
    });

    it('should return 404 for non-existent payment', () => {
      return request(getApp().getHttpServer())
        .get(`/api/payment/${randomUUID()}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /api/payment/:id', () => {
    it('should update a payment', async () => {
      const response = await request(getApp().getHttpServer())
        .patch(`/api/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('GET /api/payment/student/:studentId', () => {
    it('should return payments for a student', async () => {
      const response = await request(getApp().getHttpServer())
        .get(`/api/payment/student/${testStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(
        response.body.items.every((p: any) => p.student_id === testStudentId),
      ).toBe(true);
    });
  });

  describe('DELETE /api/payment/:id', () => {
    it('should delete a payment', async () => {
      await request(getApp().getHttpServer())
        .delete(`/api/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(getApp().getHttpServer())
        .get(`/api/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
