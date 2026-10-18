import {
  ExpenseCategory,
  PrismaClient,
  SalaryStatus,
  SalaryType,
  UserRole,
} from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AuthService } from '../src/components/auth/auth.service';
import { TeacherSalaryService } from '../src/components/teacher/teacher-salary.service';
import { DatabaseService } from '../src/database/database.service';
import { closeTestApp, createTestApp, getApp, getDatabase } from './setup-e2e';

describe('Teacher salary consistency (real PostgreSQL)', () => {
  const suffix = randomUUID();
  const organizationIds: string[] = [];
  let tenant: Awaited<ReturnType<typeof createTenant>>;
  let foreign: Awaited<ReturnType<typeof createTenant>>;
  let previousConnectionLimit: string | undefined;

  async function createTenant(name: string) {
    const organization = await getDatabase().organization.create({
      data: {
        name: `salary-${name}-${suffix}`,
        email: `salary-org-${name}-${suffix}@example.test`,
        phone: `salary-org-${name}-${suffix}`,
        status: 'ACTIVE',
      },
    });
    organizationIds.push(organization.id);

    async function createUser(role: UserRole, label: string) {
      return getDatabase().user.create({
        data: {
          organization_id: organization.id,
          role,
          full_name: `Salary ${name} ${label} ${suffix}`,
          email: `salary-${name}-${label}-${suffix}@example.test`,
          phone: `salary-${name}-${label}-${suffix}`,
          password: 'unused-test-password-hash',
          ...(role === UserRole.TEACHER
            ? {
                teacherProfile: {
                  create: {
                    subjects: ['ENGLISH'],
                    salary_type: SalaryType.FIXED,
                    fixed_salary: '1234.56',
                  },
                },
              }
            : {}),
        },
      });
    }

    const admin = await createUser(UserRole.ADMIN, 'admin');
    const manager = await createUser(UserRole.MANAGER, 'manager');
    const teacher = await createUser(UserRole.TEACHER, 'teacher');
    const peer = await createUser(UserRole.TEACHER, 'peer');

    async function token(user: typeof admin) {
      const tokens = await getApp().get(AuthService).generateTokens({
        sub: user.id,
        id: user.id,
        role: user.role,
        organization_id: organization.id,
        email: user.email,
        phone: user.phone,
        name: user.full_name,
      });
      return tokens.accessToken;
    }

    return {
      organizationId: organization.id,
      admin,
      teacher,
      peer,
      adminToken: await token(admin),
      managerToken: await token(manager),
      teacherToken: await token(teacher),
    };
  }

  function pay(teacherId: string, period: string, token = tenant.adminToken) {
    return request(getApp().getHttpServer())
      .post(`/api/teachers/${teacherId}/salary/pay`)
      .auth(token, { type: 'bearer' })
      .send({ month: period });
  }

  function expenseWhere(teacherName: string, period: string) {
    return {
      organization_id: tenant.organizationId,
      category: ExpenseCategory.SALARY,
      description: `O'qituvchi maoshi: ${teacherName} — ${period}`,
    };
  }

  async function expectOnePayment(
    teacher: typeof tenant.teacher,
    period: string,
  ) {
    const [records, expenses] = await Promise.all([
      getDatabase().teacherSalary.findMany({
        where: {
          organization_id: tenant.organizationId,
          teacher_id: teacher.id,
          period,
        },
      }),
      getDatabase().expense.findMany({
        where: expenseWhere(teacher.full_name, period),
      }),
    ]);
    expect(records).toHaveLength(1);
    expect(expenses).toHaveLength(1);
    expect(records[0]).toMatchObject({
      status: SalaryStatus.PAID,
      salary_type: SalaryType.FIXED,
      expense_id: expenses[0].id,
      breakdown: {
        salary_type: 'FIXED',
        fixed_salary: 1234.56,
        amount: 1234.56,
      },
    });
    expect(records[0].amount.toFixed(2)).toBe('1234.56');
    expect(expenses[0].amount.toFixed(2)).toBe('1234.56');
    expect(expenses[0].created_by).toBe(tenant.admin.id);
    expect(records[0].paid_at).toBeInstanceOf(Date);
    return { record: records[0], expense: expenses[0] };
  }

  beforeAll(async () => {
    // A one-connection pool would hide races by serializing transactions.
    previousConnectionLimit = process.env.DATABASE_CONNECTION_LIMIT;
    process.env.DATABASE_CONNECTION_LIMIT = '8';
    await createTestApp();
    tenant = await createTenant('owner');
    foreign = await createTenant('foreign');
  });

  afterAll(async () => {
    try {
      if (organizationIds.length > 0) {
        const where = { organization_id: { in: organizationIds } };
        await getDatabase().$transaction([
          getDatabase().teacherSalary.deleteMany({ where }),
          getDatabase().expense.deleteMany({ where }),
          getDatabase().teacherProfile.deleteMany({
            where: { user: where },
          }),
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

  it('records exactly one expense when a new salary period is paid concurrently', async () => {
    const period = '2041-01';
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => pay(tenant.teacher.id, period)),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409, 409, 409, 409, 409,
    ]);
    const { record } = await expectOnePayment(tenant.teacher, period);
    expect(
      responses.find((response) => response.status === 200)?.body,
    ).toMatchObject({
      id: record.id,
      teacher_id: tenant.teacher.id,
      period,
      status: SalaryStatus.PAID,
      amount: 1234.56,
      expense_id: record.expense_id,
    });
  });

  it('transitions an existing PENDING salary only once under concurrent requests', async () => {
    const period = '2041-02';
    const pending = await getDatabase().teacherSalary.create({
      data: {
        organization_id: tenant.organizationId,
        teacher_id: tenant.teacher.id,
        period,
        salary_type: SalaryType.HOURLY,
        amount: '10.00',
        breakdown: { preview: 'old pending calculation' },
      },
    });
    const responses = await Promise.all(
      Array.from({ length: 6 }, () => pay(tenant.teacher.id, period)),
    );

    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409, 409, 409, 409, 409,
    ]);
    const { record } = await expectOnePayment(tenant.teacher, period);
    expect(record.id).toBe(pending.id);
  });

  it('treats uppercase and lowercase UUIDs as the same salary payment under contention', async () => {
    const period = '2042-02';
    const responses = await Promise.all(
      Array.from({ length: 6 }, (_, index) =>
        pay(
          index % 2 === 0
            ? tenant.teacher.id.toLowerCase()
            : tenant.teacher.id.toUpperCase(),
          period,
        ),
      ),
    );
    expect(responses.map((response) => response.status).sort()).toEqual([
      200, 409, 409, 409, 409, 409,
    ]);
    await expectOnePayment(tenant.teacher, period);
  });

  it('rejects sequential duplicates without changing the paid snapshot or its expense', async () => {
    const period = '2041-03';
    await pay(tenant.teacher.id, period).expect(200);
    const before = await expectOnePayment(tenant.teacher, period);

    await getDatabase().teacherProfile.update({
      where: { user_id: tenant.teacher.id },
      data: { fixed_salary: '9876.54' },
    });
    try {
      await pay(tenant.teacher.id, period).expect(409);
      await pay(tenant.teacher.id, period, tenant.managerToken).expect(409);
      const after = await expectOnePayment(tenant.teacher, period);
      expect(after).toEqual(before);
    } finally {
      await getDatabase().teacherProfile.update({
        where: { user_id: tenant.teacher.id },
        data: { fixed_salary: '1234.56' },
      });
    }
  });

  it('allows independent periods and teachers to be paid concurrently', async () => {
    const payments = [
      { teacher: tenant.teacher, period: '2041-04' },
      { teacher: tenant.teacher, period: '2041-05' },
      { teacher: tenant.peer, period: '2041-04' },
    ];
    const responses = await Promise.all(
      payments.map(({ teacher, period }) => pay(teacher.id, period)),
    );
    expect(responses.map((response) => response.status)).toEqual([
      200, 200, 200,
    ]);
    for (const { teacher, period } of payments) {
      await expectOnePayment(teacher, period);
    }
  });

  it('does not expose or pay another organization teacher salary', async () => {
    const period = '2041-06';
    const before = await getDatabase().expense.count({
      where: { organization_id: { in: organizationIds } },
    });
    await pay(foreign.teacher.id, period).expect(404);
    expect(
      await getDatabase().expense.count({
        where: { organization_id: { in: organizationIds } },
      }),
    ).toBe(before);
    expect(
      await getDatabase().teacherSalary.count({
        where: { teacher_id: foreign.teacher.id, period },
      }),
    ).toBe(0);
  });

  it('returns 404 for another organization already-paid salary without exposing its status', async () => {
    const period = '2042-03';
    await pay(foreign.teacher.id, period, foreign.adminToken).expect(200);
    const before = await getDatabase().teacherSalary.findUniqueOrThrow({
      where: {
        teacher_id_period: { teacher_id: foreign.teacher.id, period },
      },
    });
    const expenseCount = await getDatabase().expense.count({
      where: { organization_id: { in: organizationIds } },
    });

    await pay(foreign.teacher.id, period).expect(404);

    expect(
      await getDatabase().teacherSalary.findUnique({
        where: {
          teacher_id_period: { teacher_id: foreign.teacher.id, period },
        },
      }),
    ).toEqual(before);
    expect(
      await getDatabase().expense.count({
        where: { organization_id: { in: organizationIds } },
      }),
    ).toBe(expenseCount);
  });

  it('requires login and denies teacher callers without creating financial records', async () => {
    const period = '2041-07';
    await request(getApp().getHttpServer())
      .post(`/api/teachers/${tenant.teacher.id}/salary/pay`)
      .send({ month: period })
      .expect(401);
    await pay(tenant.teacher.id, period, tenant.teacherToken).expect(403);
    expect(
      await getDatabase().teacherSalary.count({
        where: { teacher_id: tenant.teacher.id, period },
      }),
    ).toBe(0);
    expect(
      await getDatabase().expense.count({
        where: expenseWhere(tenant.teacher.full_name, period),
      }),
    ).toBe(0);
  });

  it.each([false, true])(
    'rolls back a real database failure and permits retry (existing pending: %s)',
    async (existingPending) => {
      const period = existingPending ? '2041-09' : '2041-08';
      const pending = existingPending
        ? await getDatabase().teacherSalary.create({
            data: {
              organization_id: tenant.organizationId,
              teacher_id: tenant.teacher.id,
              period,
              salary_type: SalaryType.HOURLY,
              amount: '17.25',
              breakdown: { preview: 'preserve on failure' },
            },
          })
        : null;

      // The creator UUID is absent from User, forcing PostgreSQL to reject
      // Expense's FK rather than mocking a transaction or a Prisma operation.
      await expect(
        getApp()
          .get(TeacherSalaryService)
          .markPaid(
            tenant.teacher.id,
            tenant.organizationId,
            period,
            randomUUID(),
          ),
      ).rejects.toMatchObject({ code: 'P2003' });

      expect(
        await getDatabase().teacherSalary.findUnique({
          where: {
            teacher_id_period: { teacher_id: tenant.teacher.id, period },
          },
        }),
      ).toEqual(pending);
      expect(
        await getDatabase().expense.count({
          where: expenseWhere(tenant.teacher.full_name, period),
        }),
      ).toBe(0);

      await pay(tenant.teacher.id, period).expect(200);
      await expectOnePayment(tenant.teacher, period);
    },
  );
  it('rolls back an expense already written when the salary snapshot fails', async () => {
    const period = '2041-10';
    const pending = await getDatabase().teacherSalary.create({
      data: {
        organization_id: tenant.organizationId,
        teacher_id: tenant.teacher.id,
        period,
        salary_type: SalaryType.HOURLY,
        amount: '3.21',
        breakdown: { preview: 'preserve if snapshot write fails' },
      },
    });
    let createdExpenseId: string | undefined;
    let salaryWriteAttempted = false;
    // Inject one persistence failure without replacing the real transaction.
    // Expense.create still executes against PostgreSQL before snapshot failure.
    const failingClient = getDatabase().$extends({
      query: {
        expense: {
          async create({ args, query }) {
            const expense = await query(args);
            createdExpenseId = expense.id;
            return expense;
          },
        },
        teacherSalary: {
          async upsert() {
            salaryWriteAttempted = true;
            throw new Error('Injected salary snapshot persistence failure');
          },
        },
      },
    });
    const failingService = new TeacherSalaryService(
      failingClient as unknown as DatabaseService,
    );

    await expect(
      failingService.markPaid(
        tenant.teacher.id,
        tenant.organizationId,
        period,
        tenant.admin.id,
      ),
    ).rejects.toThrow('Injected salary snapshot persistence failure');

    expect(salaryWriteAttempted).toBe(true);
    expect(createdExpenseId).toEqual(expect.any(String));
    expect(
      await getDatabase().expense.findUnique({
        where: { id: createdExpenseId },
      }),
    ).toBeNull();
    expect(
      await getDatabase().teacherSalary.findUnique({
        where: { teacher_id_period: { teacher_id: tenant.teacher.id, period } },
      }),
    ).toEqual(pending);

    await pay(tenant.teacher.id, period).expect(200);
    await expectOnePayment(tenant.teacher, period);
  });

  it.each([SalaryType.FIXED, SalaryType.HOURLY, SalaryType.GROUP_PERCENT])(
    'completes %s salary with the deployed default of one database connection',
    async (salaryType) => {
      const period = {
        [SalaryType.FIXED]: '2041-11',
        [SalaryType.HOURLY]: '2041-12',
        [SalaryType.GROUP_PERCENT]: '2042-01',
      }[salaryType];
      const datasourceUrl = new URL(process.env.TEST_DATABASE_URL!);
      datasourceUrl.searchParams.set('connection_limit', '1');
      const client = new PrismaClient({
        datasources: { db: { url: datasourceUrl.toString() } },
      });
      await getDatabase().teacherProfile.update({
        where: { user_id: tenant.teacher.id },
        data: {
          salary_type: salaryType,
          hourly_rate: '12.34',
          percent_rate: '25.00',
        },
      });
      try {
        const service = new TeacherSalaryService(
          client as unknown as DatabaseService,
        );
        const preview = await service.calculate(
          tenant.teacher.id,
          tenant.organizationId,
          period,
        );
        const result = await service.markPaid(
          tenant.teacher.id,
          tenant.organizationId,
          period,
          tenant.admin.id,
        );
        const expectedAmount = salaryType === SalaryType.FIXED ? 1234.56 : 0;
        expect(result).toMatchObject({
          status: SalaryStatus.PAID,
          amount: expectedAmount,
          breakdown: preview.breakdown,
        });
        const expenses = await getDatabase().expense.findMany({
          where: expenseWhere(tenant.teacher.full_name, period),
        });
        expect(expenses).toHaveLength(1);
        expect(result.expense_id).toBe(expenses[0].id);
        expect(Number(expenses[0].amount)).toBe(expectedAmount);
        if (salaryType === SalaryType.HOURLY) {
          expect(result.breakdown).toMatchObject({
            lesson_count: 0,
            hourly_rate: 12.34,
          });
        }
        if (salaryType === SalaryType.GROUP_PERCENT) {
          expect(result.breakdown).toMatchObject({
            payment_count: 0,
            percent_rate: 25,
          });
        }
      } finally {
        await client.$disconnect();
        await getDatabase().teacherProfile.update({
          where: { user_id: tenant.teacher.id },
          data: {
            salary_type: SalaryType.FIXED,
            hourly_rate: null,
            percent_rate: null,
          },
        });
      }
    },
  );
});
