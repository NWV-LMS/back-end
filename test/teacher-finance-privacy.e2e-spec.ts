import {
  INestApplication,
  NotFoundException,
  ValidationPipe,
} from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { OrganizationActiveGuard } from '../src/components/auth/guards/organization-active.guard';
import { JwtStrategy } from '../src/components/auth/strategies/jwt.strategy';
import { BillingController } from '../src/components/billing/billing.controller';
import { BillingService } from '../src/components/billing/billing.service';
import { TeacherController } from '../src/components/teacher/teacher.controller';
import { TeacherQueryService } from '../src/components/teacher/teacher-query.service';
import { TeacherMutationService } from '../src/components/teacher/teacher-mutation.service';
import { TeacherBulkService } from '../src/components/teacher/teacher-bulk.service';
import { TeacherSalaryService } from '../src/components/teacher/teacher-salary.service';
import { DatabaseService } from '../src/database/database.service';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';

describe('Teacher financial privacy (real PostgreSQL)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let own: Awaited<ReturnType<typeof createTeacher>>;
  let peer: Awaited<ReturnType<typeof createTeacher>>;
  let foreign: Awaited<ReturnType<typeof createTeacher>>;
  let admin: User;
  let manager: User;
  let ownInvoice: string;
  let peerInvoice: string;
  let mixedInvoice: string;
  let emptyInvoice: string;
  let corruptInvoice: string;
  let foreignStudentInvoice: string;
  let foreignEnrollmentInvoice: string;
  let foreignInvoice: string;
  const organizationIds: string[] = [];
  const label = randomUUID();
  const jwt = new JwtService();
  const teacherPaths = [
    '',
    '/groups',
    '/schedule',
    '/performance',
    '/salary',
    '/salary/history',
  ];

  async function user(organizationId: string, role: UserRole, name: string) {
    return db.user.create({
      data: {
        organization_id: organizationId,
        role,
        full_name: name,
        email: `${name}-${label}@example.test`,
        phone: `${name}-${label}`,
        password: 'unused-test-password-hash',
      },
    });
  }

  async function createTeacher(
    organizationId: string,
    name: string,
    salary: number,
  ) {
    const teacher = await user(organizationId, UserRole.TEACHER, name);
    await db.teacherProfile.create({
      data: {
        user_id: teacher.id,
        subjects: ['ENGLISH'],
        fixed_salary: salary,
      },
    });
    await db.teacherSalary.create({
      data: {
        organization_id: organizationId,
        teacher_id: teacher.id,
        period: '2026-01',
        salary_type: 'FIXED',
        amount: salary,
        breakdown: { fixed_salary: salary },
      },
    });
    const course = await db.course.create({
      data: {
        organization_id: organizationId,
        title: name,
        price: '100',
        status: 'ACTIVE',
      },
    });
    const group = await db.group.create({
      data: {
        organization_id: organizationId,
        teacher_id: teacher.id,
        course_id: course.id,
        name: `${name} private group`,
        start_date: new Date('2026-01-01'),
        end_date: new Date('2026-12-31'),
      },
    });
    await db.groupSchedule.create({
      data: {
        organization_id: organizationId,
        group_id: group.id,
        day_of_week: 1,
        start_minute: 540,
      },
    });
    const student = await db.student.create({
      data: {
        organization_id: organizationId,
        name: `${name} student`,
        phone: `${name}-student-${label}`,
        status: 'ACTIVE',
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        organization_id: organizationId,
        group_id: group.id,
        student_id: student.id,
      },
    });
    return { teacher, group, course, student, enrollment };
  }

  async function invoice(
    organizationId: string,
    studentId: string,
    month: number,
    enrollmentIds: string[],
    itemOrganizationId?: string,
  ) {
    const record = await db.invoice.create({
      data: {
        organization_id: organizationId,
        student_id: studentId,
        month: new Date(Date.UTC(2026, month - 1, 1)),
        due_date: new Date(Date.UTC(2026, month - 1, 10)),
        amount_due: 100 * enrollmentIds.length,
        items: {
          create: enrollmentIds.map((enrollmentId) => ({
            enrollment_id: enrollmentId,
            amount: 100,
            organization_id: itemOrganizationId,
          })),
        },
      },
    });
    return record.id;
  }

  function get(actor: User, path: string) {
    const accessToken = jwt.sign(
      {
        sub: actor.id,
        id: actor.id,
        role: actor.role,
        organization_id: actor.organization_id,
        token_use: 'access',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: '5m',
      },
    );
    return request(app.getHttpServer())
      .get(`/api${path}`)
      .auth(accessToken, { type: 'bearer' });
  }

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL)
      throw new Error(
        'TEST_DATABASE_URL must identify a disposable migrated database',
      );
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule,
      ],
      controllers: [TeacherController, BillingController],
      providers: [
        DatabaseService,
        JwtStrategy,
        OrganizationActiveGuard,
        TeacherQueryService,
        TeacherMutationService,
        TeacherBulkService,
        TeacherSalaryService,
        BillingService,
      ],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalFilters(new PrismaExceptionFilter());
    app.useGlobalPipes(
      new ValidationPipe({ whitelist: true, transform: true }),
    );
    await app.init();
    db = app.get(DatabaseService);
    for (const name of ['own', 'foreign']) {
      const organization = await db.organization.create({
        data: {
          name: `teacher-privacy-${name}-${label}`,
          email: `${name}-${label}@example.test`,
          phone: `${name}-${label}`,
          status: 'ACTIVE',
        },
      });
      organizationIds.push(organization.id);
    }
    const [organizationId, foreignId] = organizationIds;
    admin = await user(organizationId, UserRole.ADMIN, 'admin');
    manager = await user(organizationId, UserRole.MANAGER, 'manager');
    own = await createTeacher(organizationId, 'own', 650);
    peer = await createTeacher(organizationId, 'peer', 990);
    foreign = await createTeacher(foreignId, 'foreign', 1500);
    ownInvoice = await invoice(organizationId, own.student.id, 1, [
      own.enrollment.id,
    ]);
    peerInvoice = await invoice(organizationId, peer.student.id, 1, [
      peer.enrollment.id,
    ]);
    const extraEnrollment = await db.enrollment.create({
      data: {
        organization_id: organizationId,
        group_id: peer.group.id,
        student_id: own.student.id,
      },
    });
    mixedInvoice = await invoice(organizationId, own.student.id, 2, [
      own.enrollment.id,
      extraEnrollment.id,
    ]);
    emptyInvoice = await invoice(organizationId, own.student.id, 3, []);
    corruptInvoice = await invoice(
      organizationId,
      own.student.id,
      4,
      [own.enrollment.id],
      foreignId,
    );
    foreignStudentInvoice = await invoice(
      organizationId,
      foreign.student.id,
      5,
      [own.enrollment.id],
    );
    foreignEnrollmentInvoice = await invoice(
      organizationId,
      own.student.id,
      6,
      [foreign.enrollment.id],
    );
    foreignInvoice = await invoice(foreignId, foreign.student.id, 1, [
      foreign.enrollment.id,
    ]);
  });

  afterAll(async () => {
    try {
      if (db && organizationIds.length) {
        const where = { organization_id: { in: organizationIds } };
        await db.$transaction([
          db.invoice.deleteMany({ where }),
          db.enrollment.deleteMany({ where }),
          db.group.deleteMany({ where }),
          db.course.deleteMany({ where }),
          db.student.deleteMany({ where }),
          db.teacherSalary.deleteMany({ where }),
          db.user.deleteMany({ where }),
          db.organization.deleteMany({
            where: { id: { in: organizationIds } },
          }),
        ]);
      }
    } finally {
      await app?.close();
    }
  });

  it('teacher directory reveals only the caller including salary fields and totals', async () => {
    const response = await get(own.teacher, '/teachers?limit=1').expect(200);
    expect(
      response.body.teachers.map((item: { id: string }) => item.id),
    ).toEqual([own.teacher.id]);
    expect(response.body.pagination.total).toBe(1);
    expect(response.body.teachers[0].fixed_salary).toBe(650);
    const searched = await get(own.teacher, '/teachers?search=peer').expect(
      200,
    );
    expect(searched.body.teachers).toEqual([]);
    expect(searched.body.pagination.total).toBe(0);
  });

  it.each(teacherPaths)(
    'teacher can read their own %s endpoint',
    async (path) => {
      await get(own.teacher, `/teachers/${own.teacher.id}${path}`).expect(200);
    },
  );

  it.each(teacherPaths)(
    'teacher cannot read peer or foreign %s endpoint',
    async (path) => {
      await get(own.teacher, `/teachers/${peer.teacher.id}${path}`).expect(404);
      await get(own.teacher, `/teachers/${foreign.teacher.id}${path}`).expect(
        404,
      );
    },
  );

  it('admin and manager retain tenant teacher visibility', async () => {
    for (const actor of [admin, manager]) {
      const response = await get(actor, '/teachers').expect(200);
      expect(response.body.pagination.total).toBe(2);
      for (const path of teacherPaths)
        await get(actor, `/teachers/${peer.teacher.id}${path}`).expect(200);
      await get(actor, `/teachers/${foreign.teacher.id}`).expect(404);
    }
  });

  it('teacher invoice pages and count include only fully owned invoices', async () => {
    const response = await get(own.teacher, '/billing/invoices?limit=1').expect(
      200,
    );
    expect(response.body.items.map((item: { id: string }) => item.id)).toEqual([
      ownInvoice,
    ]);
    expect(response.body.meta.total).toBe(1);
    const ownSearch = await get(
      own.teacher,
      '/billing/invoices?search=own',
    ).expect(200);
    expect(ownSearch.body.meta.total).toBe(1);
    for (const filter of [`student_id=${peer.student.id}`, 'search=peer']) {
      const searched = await get(
        own.teacher,
        `/billing/invoices?${filter}`,
      ).expect(200);
      expect(searched.body.items).toEqual([]);
      expect(searched.body.meta.total).toBe(0);
    }
  });

  it('teacher cannot retrieve peer, mixed, empty or corrupt invoices by ID', async () => {
    await get(own.teacher, `/billing/invoices/${ownInvoice}`).expect(200);
    for (const id of [
      peerInvoice,
      mixedInvoice,
      emptyInvoice,
      corruptInvoice,
      foreignInvoice,
      foreignStudentInvoice,
      foreignEnrollmentInvoice,
    ]) {
      await get(own.teacher, `/billing/invoices/${id}`).expect(404);
    }
  });

  it('admin and manager retain organization invoice visibility', async () => {
    for (const actor of [admin, manager]) {
      const response = await get(actor, '/billing/invoices').expect(200);
      expect(response.body.meta.total).toBe(4);
      await get(actor, `/billing/invoices/${peerInvoice}`).expect(200);
      await get(actor, `/billing/invoices/${mixedInvoice}`).expect(200);
      await get(actor, `/billing/invoices/${foreignInvoice}`).expect(404);
      for (const id of [
        corruptInvoice,
        foreignStudentInvoice,
        foreignEnrollmentInvoice,
      ]) {
        await get(actor, `/billing/invoices/${id}`).expect(404);
      }
    }
  });

  it('rejects payment of inconsistent invoices before recording any payment', async () => {
    const billing = app.get(BillingService);
    for (const id of [
      corruptInvoice,
      foreignStudentInvoice,
      foreignEnrollmentInvoice,
    ]) {
      await expect(
        billing.payInvoice(admin.organization_id, id, admin.id, {
          amount: 1,
          method: 'CASH',
        }),
      ).rejects.toBeInstanceOf(NotFoundException);
      const invoice = await db.invoice.findUniqueOrThrow({ where: { id } });
      expect(invoice.amount_paid.toString()).toBe('0');
    }
    expect(
      await db.payment.count({
        where: { organization_id: admin.organization_id },
      }),
    ).toBe(0);
  });
});
