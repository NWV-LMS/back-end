import * as request from 'supertest';
import {
  createTestApp,
  closeTestApp,
  getApp,
  getAuthToken,
  getTestStudentId,
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

  describe('POST /payment', () => {
    it('should create a payment', async () => {
      const response = await request(getApp().getHttpServer())
        .post('/payment')
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
    });

    it('should fail without auth', () => {
      return request(getApp().getHttpServer())
        .post('/payment')
        .send({ student_id: testStudentId, amount: 100, method: 'CASH' })
        .expect(401);
    });

    it('should validate required fields', () => {
      return request(getApp().getHttpServer())
        .post('/payment')
        .set('Authorization', `Bearer ${authToken}`)
        .send({})
        .expect(400);
    });
  });

  describe('GET /payment', () => {
    it('should return paginated payments', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/payment')
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
        .get('/payment?status=COMPLETED')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.items.every((p: any) => p.status === 'COMPLETED')).toBe(true);
    });

    it('should paginate correctly', async () => {
      const response = await request(getApp().getHttpServer())
        .get('/payment?page=1&limit=5')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.meta.limit).toBe(5);
    });
  });

  describe('GET /payment/:id', () => {
    it('should return a single payment', async () => {
      if (!createdPaymentId) return;

      const response = await request(getApp().getHttpServer())
        .get(`/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body.id).toBe(createdPaymentId);
    });

    it('should return 404 for non-existent payment', () => {
      return request(getApp().getHttpServer())
        .get('/payment/00000000-0000-0000-0000-000000000000')
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });

  describe('PATCH /payment/:id', () => {
    it('should update a payment', async () => {
      if (!createdPaymentId) return;

      const response = await request(getApp().getHttpServer())
        .patch(`/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .send({ description: 'Updated description' })
        .expect(200);

      expect(response.body.description).toBe('Updated description');
    });
  });

  describe('GET /payment/student/:studentId', () => {
    it('should return payments for a student', async () => {
      if (!testStudentId) return;

      const response = await request(getApp().getHttpServer())
        .get(`/payment/student/${testStudentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('items');
      expect(response.body.items.every((p: any) => p.student_id === testStudentId)).toBe(true);
    });
  });

  describe('DELETE /payment/:id', () => {
    it('should delete a payment', async () => {
      if (!createdPaymentId) return;

      await request(getApp().getHttpServer())
        .delete(`/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(200);

      // Verify deletion
      await request(getApp().getHttpServer())
        .get(`/payment/${createdPaymentId}`)
        .set('Authorization', `Bearer ${authToken}`)
        .expect(404);
    });
  });
});
