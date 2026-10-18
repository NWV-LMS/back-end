import { InvoiceStatus, PaymentStatus, Prisma, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AuthService } from '../src/components/auth/auth.service';
import { closeTestApp, createTestApp, getApp, getDatabase } from './setup-e2e';

describe('Payment and invoice consistency (real PostgreSQL)', () => {
  const suffix = randomUUID();
  const organizationIds: string[] = [];
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  let otherTenant: Awaited<ReturnType<typeof createTenant>>;
  let invoiceSequence = 0;
  let previousConnectionLimit: string | undefined;

  async function createTenant(name: string) {
    const organization = await getDatabase().organization.create({
      data: {
        name: `payment-invoice-${name}-${suffix}`,
        email: `${name}-${suffix}@example.test`,
        phone: `org-${name}-${suffix}`,
        status: 'ACTIVE',
        users: {
          create: {
            full_name: `Invoice ${name} Admin`,
            email: `admin-${name}-${suffix}@example.test`,
            phone: `admin-${name}-${suffix}`,
            password: 'unused-test-only-password-hash',
            role: UserRole.ADMIN,
          },
        },
        students: {
          create: {
            name: `Invoice ${name} Student`,
            phone: `student-${name}-${suffix}`,
            status: 'ACTIVE',
          },
        },
      },
      include: { users: true, students: true },
    });
    organizationIds.push(organization.id);
    const admin = organization.users[0];
    const tokens = await getApp().get(AuthService).generateTokens({
      sub: admin.id,
      id: admin.id,
      role: admin.role,
      organization_id: organization.id,
      email: admin.email,
      phone: admin.phone,
      name: admin.full_name,
    });
    return {
      organizationId: organization.id,
      studentId: organization.students[0].id,
      adminId: admin.id,
      token: tokens.accessToken,
    };
  }

  async function createInvoice(
    amountDue = '100.00',
    dueDate = new Date('2100-01-01T00:00:00.000Z'),
  ) {
    const month = new Date(Date.UTC(2040, invoiceSequence++, 1));
    return getDatabase().invoice.create({
      data: {
        organization_id: tenant.organizationId,
        student_id: tenant.studentId,
        month,
        due_date: dueDate,
        amount_due: amountDue,
        status: InvoiceStatus.OPEN,
      },
    });
  }

  async function pay(
    invoiceId: string,
    amount: number,
    status: PaymentStatus = PaymentStatus.COMPLETED,
  ) {
    await request(getApp().getHttpServer())
      .post(`/api/billing/invoices/${invoiceId}/pay`)
      .auth(tenant.token, { type: 'bearer' })
      .send({ amount, method: 'CASH', status })
      .expect(201);
    return getDatabase().payment.findFirstOrThrow({
      where: { invoice_id: invoiceId, amount, status },
      orderBy: { created_at: 'desc' },
    });
  }

  function updatePayment(id: string, payload: object, token = tenant.token) {
    return request(getApp().getHttpServer())
      .patch(`/api/payment/${id}`)
      .auth(token, { type: 'bearer' })
      .send(payload);
  }

  function deletePayment(id: string, token = tenant.token) {
    return request(getApp().getHttpServer())
      .delete(`/api/payment/${id}`)
      .auth(token, { type: 'bearer' });
  }

  async function expectInvoice(
    id: string,
    amountPaid: string,
    status: InvoiceStatus,
  ) {
    const [invoice, completedPayments] = await Promise.all([
      getDatabase().invoice.findUniqueOrThrow({ where: { id } }),
      getDatabase().payment.aggregate({
        where: {
          invoice_id: id,
          organization_id: tenant.organizationId,
          status: PaymentStatus.COMPLETED,
        },
        _sum: { amount: true },
      }),
    ]);
    expect(invoice.amount_paid.toFixed(2)).toBe(amountPaid);
    expect(invoice.status).toBe(status);
    expect(invoice.amount_paid.toFixed(2)).toBe(
      (completedPayments._sum.amount ?? new Prisma.Decimal(0)).toFixed(2),
    );
  }

  beforeAll(async () => {
    // More than one connection is necessary to exercise real concurrent
    // transactions rather than serializing them in Prisma's connection pool.
    previousConnectionLimit = process.env.DATABASE_CONNECTION_LIMIT;
    process.env.DATABASE_CONNECTION_LIMIT = '8';
    await createTestApp();
    tenant = await createTenant('owner');
    otherTenant = await createTenant('other');
  });

  afterAll(async () => {
    try {
      if (organizationIds.length > 0) {
        const where = { organization_id: { in: organizationIds } };
        await getDatabase().$transaction([
          getDatabase().payment.deleteMany({ where }),
          getDatabase().invoice.deleteMany({ where }),
          getDatabase().student.deleteMany({ where }),
          getDatabase().user.deleteMany({ where }),
          getDatabase().organization.deleteMany({
            where: { id: { in: organizationIds } },
          }),
        ]);
      }
    } finally {
      await closeTestApp();
      if (previousConnectionLimit === undefined) {
        delete process.env.DATABASE_CONNECTION_LIMIT;
      } else {
        process.env.DATABASE_CONNECTION_LIMIT = previousConnectionLimit;
      }
    }
  });

  it('counts a pending payment only after completion and exposes the new balance through the API', async () => {
    const invoice = await createInvoice('100.25');
    const payment = await pay(invoice.id, 100.25, PaymentStatus.PENDING);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);

    const response = await updatePayment(payment.id, {
      status: PaymentStatus.COMPLETED,
    }).expect(200);
    expect(response.body).toMatchObject({
      id: payment.id,
      invoice_id: invoice.id,
      amount: 100.25,
      status: PaymentStatus.COMPLETED,
    });
    await expectInvoice(invoice.id, '100.25', InvoiceStatus.PAID);

    const result = await request(getApp().getHttpServer())
      .get(`/api/billing/invoices/${invoice.id}`)
      .auth(tenant.token, { type: 'bearer' })
      .expect(200);
    expect(result.body).toMatchObject({
      id: invoice.id,
      amount_paid: '100.25',
      status: InvoiceStatus.PAID,
    });
  });

  it.each([
    PaymentStatus.PENDING,
    PaymentStatus.CANCELLED,
    PaymentStatus.REFUNDED,
  ])('removes a completed payment from the balance on %s', async (status) => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);
    await updatePayment(payment.id, { status }).expect(200);

    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
    expect(
      await getDatabase().payment.findUniqueOrThrow({
        where: { id: payment.id },
      }),
    ).toMatchObject({ status });
  });

  it('sums remaining completed payments and excludes every non-completed status', async () => {
    const invoice = await createInvoice();
    const first = await pay(invoice.id, 60);
    await pay(invoice.id, 40);
    await getDatabase().payment.createMany({
      data: [
        PaymentStatus.PENDING,
        PaymentStatus.CANCELLED,
        PaymentStatus.REFUNDED,
      ].map((status) => ({
        organization_id: tenant.organizationId,
        student_id: tenant.studentId,
        invoice_id: invoice.id,
        amount: 300,
        method: 'CASH' as const,
        status,
      })),
    });

    await updatePayment(first.id, { status: PaymentStatus.REFUNDED }).expect(
      200,
    );
    await expectInvoice(invoice.id, '40.00', InvoiceStatus.OPEN);
  });

  it('recalculates amount increases, decreases, and zero without counting metadata edits twice', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 75);

    await updatePayment(payment.id, { amount: 100 }).expect(200);
    await expectInvoice(invoice.id, '100.00', InvoiceStatus.PAID);
    await updatePayment(payment.id, { amount: 25 }).expect(200);
    await expectInvoice(invoice.id, '25.00', InvoiceStatus.OPEN);
    await updatePayment(payment.id, {
      description: 'Corrected receipt description',
      method: 'CARD',
    }).expect(200);
    await expectInvoice(invoice.id, '25.00', InvoiceStatus.OPEN);
    await updatePayment(payment.id, { amount: 0 }).expect(200);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
  });

  it('reopens a refunded overdue invoice as OVERDUE', async () => {
    const invoice = await createInvoice(
      '100.00',
      new Date('2020-01-01T00:00:00.000Z'),
    );
    const payment = await pay(invoice.id, 100);
    await expectInvoice(invoice.id, '100.00', InvoiceStatus.PAID);

    await updatePayment(payment.id, { status: PaymentStatus.REFUNDED }).expect(
      200,
    );
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OVERDUE);
  });

  it('keeps exact decimal totals and PAID status for an overpayment', async () => {
    const invoice = await createInvoice('0.30');
    const first = await pay(invoice.id, 0.1);
    const second = await pay(invoice.id, 0.2);
    await expectInvoice(invoice.id, '0.30', InvoiceStatus.PAID);

    await updatePayment(second.id, { amount: 0.3 }).expect(200);
    await expectInvoice(invoice.id, '0.40', InvoiceStatus.PAID);
    await updatePayment(first.id, { status: PaymentStatus.PENDING }).expect(
      200,
    );
    await expectInvoice(invoice.id, '0.30', InvoiceStatus.PAID);
  });

  it('repairs stale cached totals on a metadata edit and a pending billing payment', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 60);
    await getDatabase().invoice.update({
      where: { id: invoice.id },
      data: { amount_paid: 0, status: InvoiceStatus.PAID },
    });

    await updatePayment(payment.id, {
      description: 'Receipt correction',
    }).expect(200);
    await expectInvoice(invoice.id, '60.00', InvoiceStatus.OPEN);
    await getDatabase().invoice.update({
      where: { id: invoice.id },
      data: { amount_paid: 90 },
    });
    await pay(invoice.id, 20, PaymentStatus.PENDING);
    await expectInvoice(invoice.id, '60.00', InvoiceStatus.OPEN);
  });

  it('resets a paid invoice when its only payment is deleted', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);

    await deletePayment(payment.id).expect(200);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
    expect(
      await getDatabase().payment.findUnique({ where: { id: payment.id } }),
    ).toBeNull();
  });

  it('keeps other completed payments after deleting one payment', async () => {
    const invoice = await createInvoice();
    await pay(invoice.id, 30);
    const removed = await pay(invoice.id, 70);

    await deletePayment(removed.id).expect(200);
    await expectInvoice(invoice.id, '30.00', InvoiceStatus.OPEN);
  });

  it('preserves standalone payment operations without changing unrelated invoices', async () => {
    const invoice = await createInvoice();
    const created = await request(getApp().getHttpServer())
      .post('/api/payment')
      .auth(tenant.token, { type: 'bearer' })
      .send({ student_id: tenant.studentId, amount: 75, method: 'CASH' })
      .expect(201);
    expect(created.body.invoice_id).toBeNull();

    await updatePayment(created.body.id, {
      amount: 30,
      status: PaymentStatus.REFUNDED,
    }).expect(200);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
    await deletePayment(created.body.id).expect(200);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
  });

  it('denies another tenant update and deletion without changing either record', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);

    await updatePayment(
      payment.id,
      { amount: 1, status: PaymentStatus.REFUNDED },
      otherTenant.token,
    ).expect(404);
    await deletePayment(payment.id, otherTenant.token).expect(404);

    await expectInvoice(invoice.id, '100.00', InvoiceStatus.PAID);
    const persisted = await getDatabase().payment.findUniqueOrThrow({
      where: { id: payment.id },
    });
    expect(persisted.amount.toFixed(2)).toBe('100.00');
    expect(persisted.status).toBe(PaymentStatus.COMPLETED);
  });

  it('preserves VOID while correcting or removing historical payments', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);
    await getDatabase().invoice.update({
      where: { id: invoice.id },
      data: { status: InvoiceStatus.VOID },
    });

    await updatePayment(payment.id, { amount: 40 }).expect(200);
    await expectInvoice(invoice.id, '40.00', InvoiceStatus.VOID);
    await deletePayment(payment.id).expect(200);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.VOID);
    await request(getApp().getHttpServer())
      .post(`/api/billing/invoices/${invoice.id}/pay`)
      .auth(tenant.token, { type: 'bearer' })
      .send({ amount: 1, method: 'CASH' })
      .expect(400);
  });

  it('rolls back the payment change if the invoice total cannot be persisted', async () => {
    const invoice = await createInvoice('9999999999.99');
    await getDatabase().invoice.update({
      where: { id: invoice.id },
      data: { amount_paid: '6000000000.00' },
    });
    await getDatabase().payment.create({
      data: {
        organization_id: tenant.organizationId,
        student_id: tenant.studentId,
        invoice_id: invoice.id,
        amount: '6000000000.00',
        method: 'CASH',
        status: PaymentStatus.COMPLETED,
      },
    });
    const pending = await getDatabase().payment.create({
      data: {
        organization_id: tenant.organizationId,
        student_id: tenant.studentId,
        invoice_id: invoice.id,
        amount: '6000000000.00',
        method: 'CASH',
        status: PaymentStatus.PENDING,
      },
    });

    await updatePayment(pending.id, {
      status: PaymentStatus.COMPLETED,
    }).expect(500);
    const after = await getDatabase().payment.findUniqueOrThrow({
      where: { id: pending.id },
    });
    expect(after.status).toBe(PaymentStatus.PENDING);
    expect(after.amount.toFixed(2)).toBe('6000000000.00');
    await expectInvoice(invoice.id, '6000000000.00', InvoiceStatus.OPEN);
  });

  it('preserves the completed sum across concurrent refunds and billing payments', async () => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const invoice = await createInvoice();
      const original = await pay(invoice.id, 100);

      await Promise.all([
        updatePayment(original.id, {
          status: PaymentStatus.REFUNDED,
        }).expect(200),
        request(getApp().getHttpServer())
          .post(`/api/billing/invoices/${invoice.id}/pay`)
          .auth(tenant.token, { type: 'bearer' })
          .send({ amount: 35, method: 'CASH' })
          .expect(201),
      ]);

      await expectInvoice(invoice.id, '35.00', InvoiceStatus.OPEN);
    }
  });

  it('serializes concurrent amount edits, deletion, and a new invoice payment', async () => {
    const invoice = await createInvoice();
    const corrected = await pay(invoice.id, 100);
    const removed = await pay(invoice.id, 50);

    await Promise.all([
      updatePayment(corrected.id, { amount: 25 }).expect(200),
      deletePayment(removed.id).expect(200),
      request(getApp().getHttpServer())
        .post(`/api/billing/invoices/${invoice.id}/pay`)
        .auth(tenant.token, { type: 'bearer' })
        .send({ amount: 75, method: 'CASH' })
        .expect(201),
    ]);

    await expectInvoice(invoice.id, '100.00', InvoiceStatus.PAID);
  });

  it('deletes a linked payment once under concurrent duplicate deletion', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);

    const responses = await Promise.all([
      deletePayment(payment.id),
      deletePayment(payment.id),
    ]);

    expect(responses.map(({ status }) => status).sort()).toEqual([200, 404]);
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
  });

  it('does not resurrect a payment when an amount edit races with deletion', async () => {
    const invoice = await createInvoice();
    const payment = await pay(invoice.id, 100);

    const [updated, removed] = await Promise.all([
      updatePayment(payment.id, { amount: 25 }),
      deletePayment(payment.id),
    ]);

    expect([200, 404]).toContain(updated.status);
    expect(removed.status).toBe(200);
    expect(
      await getDatabase().payment.findUnique({ where: { id: payment.id } }),
    ).toBeNull();
    await expectInvoice(invoice.id, '0.00', InvoiceStatus.OPEN);
  });
});
