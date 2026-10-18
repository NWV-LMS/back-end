import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { Student, StudentStatus, User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { OrganizationActiveGuard } from '../src/components/auth/guards/organization-active.guard';
import { JwtStrategy } from '../src/components/auth/strategies/jwt.strategy';
import { StudentInviteService } from '../src/components/student/student-invite.service';
import { StudentController } from '../src/components/student/student.controller';
import { StudentService } from '../src/components/student/student.service';
import { DatabaseService } from '../src/database/database.service';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';

describe('Teacher student access (real PostgreSQL)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let organizationA: string;
  let organizationB: string;
  let teacher: User;
  let peerTeacher: User;
  let admin: User;
  let manager: User;
  let superAdmin: User;
  let studentUser: User;
  let assigned: Student;
  let inactive: Student;
  let deleted: Student;
  let peer: Student;
  let foreign: Student;
  let hidden: Student[];
  let localStudents: Student[];
  let ownEnrollmentId: string;
  let peerEnrollmentId: string;
  const organizationIds: string[] = [];
  const suffix = randomUUID();
  const jwt = new JwtService();
  const start = new Date('2026-01-01');
  const end = new Date('2026-12-31');

  async function createUser(
    organizationId: string,
    role: UserRole,
    name: string,
  ) {
    return db.user.create({
      data: {
        organization_id: organizationId,
        full_name: name,
        email: `${name}-${suffix}@example.test`,
        phone: `${name}-${suffix}`,
        password: 'unused-test-only-password-hash',
        role,
      },
    });
  }

  async function createStudent(
    name: string,
    organizationId = organizationA,
    status: StudentStatus = StudentStatus.ACTIVE,
  ) {
    return db.student.create({
      data: {
        organization_id: organizationId,
        name,
        phone: `${name}-${suffix}`,
        status,
        deleted_at: status === StudentStatus.DELETED ? new Date() : null,
      },
    });
  }

  function as(
    actor: User,
    method: 'get' | 'patch',
    path: string,
    organizationId?: string,
  ) {
    const token = jwt.sign(
      {
        sub: actor.id,
        id: actor.id,
        organization_id: actor.organization_id,
        role: actor.role,
        token_use: 'access',
      },
      {
        secret: process.env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: '5m',
      },
    );
    const call = request(app.getHttpServer())
      [method](`/api/student${path}`)
      .auth(token, { type: 'bearer' });
    if (organizationId) call.set('x-organization-id', organizationId);
    return call;
  }

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error('Set TEST_DATABASE_URL to a disposable test database');
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule,
      ],
      controllers: [StudentController],
      providers: [
        StudentService,
        StudentInviteService,
        DatabaseService,
        JwtStrategy,
        OrganizationActiveGuard,
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

    for (const name of ['A', 'B']) {
      const organization = await db.organization.create({
        data: {
          name: `student-access-${name}-${suffix}`,
          email: `${name}-${suffix}@example.test`,
          phone: `${name}-${suffix}`,
          status: 'ACTIVE',
        },
      });
      organizationIds.push(organization.id);
    }
    [organizationA, organizationB] = organizationIds;
    teacher = await createUser(
      organizationA,
      UserRole.TEACHER,
      'assigned-teacher',
    );
    peerTeacher = await createUser(
      organizationA,
      UserRole.TEACHER,
      'peer-teacher',
    );
    admin = await createUser(organizationA, UserRole.ADMIN, 'student-admin');
    manager = await createUser(
      organizationA,
      UserRole.MANAGER,
      'student-manager',
    );
    superAdmin = await createUser(
      organizationA,
      UserRole.SUPER_ADMIN,
      'platform',
    );
    studentUser = await createUser(
      organizationA,
      UserRole.STUDENT,
      'student-user',
    );
    const foreignTeacher = await createUser(
      organizationB,
      UserRole.TEACHER,
      'foreign-teacher',
    );
    const courseA = await db.course.create({
      data: {
        organization_id: organizationA,
        title: 'Local course',
        price: '200',
        status: 'ACTIVE',
      },
    });
    const courseB = await db.course.create({
      data: {
        organization_id: organizationB,
        title: 'Foreign secret course',
        price: '9001',
        status: 'ACTIVE',
      },
    });
    async function group(
      name: string,
      teacherId: string,
      courseId = courseA.id,
      organizationId = organizationA,
    ) {
      return db.group.create({
        data: {
          organization_id: organizationId,
          course_id: courseId,
          teacher_id: teacherId,
          name,
          start_date: start,
          end_date: end,
        },
      });
    }
    const ownGroup = await group('Assigned group', teacher.id);
    const peerGroup = await group('Peer teacher group', peerTeacher.id);
    const foreignGroup = await group(
      'Foreign secret group',
      teacher.id,
      courseB.id,
      organizationB,
    );
    const corruptCourseGroup = await group(
      'Local group foreign course',
      teacher.id,
      courseB.id,
    );
    const corruptTeacherGroup = await group(
      'Local group foreign teacher',
      foreignTeacher.id,
    );
    async function enroll(
      studentId: string,
      groupId: string,
      organizationId = organizationA,
      monthlyFee = '200',
      discount = '0',
    ) {
      return db.enrollment.create({
        data: {
          organization_id: organizationId,
          student_id: studentId,
          group_id: groupId,
          monthly_fee: monthlyFee,
          discount_amount: discount,
        },
      });
    }
    assigned = await createStudent('Assigned active');
    inactive = await createStudent(
      'Assigned inactive',
      organizationA,
      'INACTIVE',
    );
    deleted = await createStudent('Assigned deleted', organizationA, 'DELETED');
    peer = await createStudent('Peer only');
    foreign = await createStudent('Foreign secret student', organizationB);
    const unenrolled = await createStudent('Unenrolled');
    const badCourse = await createStudent('Corrupt foreign course');
    const badTeacher = await createStudent('Corrupt foreign teacher');
    const badEnrollment = await createStudent(
      'Corrupt enrollment organization',
    );
    const badGroup = await createStudent('Corrupt foreign group');
    hidden = [
      peer,
      foreign,
      unenrolled,
      badCourse,
      badTeacher,
      badEnrollment,
      badGroup,
    ];
    localStudents = [
      assigned,
      inactive,
      peer,
      unenrolled,
      badCourse,
      badTeacher,
      badEnrollment,
      badGroup,
    ];
    const ownEnrollment = await enroll(
      assigned.id,
      ownGroup.id,
      organizationA,
      '200',
      '20',
    );
    ownEnrollmentId = ownEnrollment.id;
    const peerEnrollment = await enroll(
      assigned.id,
      peerGroup.id,
      organizationA,
      '300',
    );
    peerEnrollmentId = peerEnrollment.id;
    await enroll(inactive.id, ownGroup.id);
    await enroll(deleted.id, ownGroup.id);
    await enroll(peer.id, peerGroup.id);
    await enroll(foreign.id, ownGroup.id);
    await enroll(badCourse.id, corruptCourseGroup.id);
    await enroll(badTeacher.id, corruptTeacherGroup.id);
    await enroll(badEnrollment.id, ownGroup.id, organizationB);
    await enroll(badGroup.id, foreignGroup.id);
    await enroll(assigned.id, corruptCourseGroup.id, organizationA, '999');
    await enroll(assigned.id, corruptTeacherGroup.id, organizationA, '777');
    await enroll(assigned.id, foreignGroup.id, organizationA, '888');
    const foreignInvoice = await db.invoice.create({
      data: {
        organization_id: organizationB,
        student_id: foreign.id,
        month: start,
        due_date: start,
        amount_due: '9001',
      },
    });
    await db.payment.createMany({
      data: [
        {
          organization_id: organizationA,
          student_id: assigned.id,
          amount: '25',
          method: 'CASH',
        },
        {
          organization_id: organizationA,
          student_id: peer.id,
          amount: '1000',
          method: 'CASH',
        },
        {
          organization_id: organizationA,
          student_id: assigned.id,
          invoice_id: foreignInvoice.id,
          amount: '9001',
          method: 'CASH',
        },
      ],
    });
  });

  afterAll(async () => {
    try {
      if (db && organizationIds.length) {
        const where = { organization_id: { in: organizationIds } };
        await db.$transaction([
          db.payment.deleteMany({ where }),
          db.invoice.deleteMany({ where }),
          db.enrollment.deleteMany({ where }),
          db.group.deleteMany({ where }),
          db.course.deleteMany({ where }),
          db.student.deleteMany({ where }),
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

  it("paginates and counts only the teacher's students", async () => {
    const response = await as(teacher, 'get', '?page=1&limit=1').expect(200);
    expect(response.body.items.map((item: Student) => item.id)).toEqual([
      assigned.id,
    ]);
    expect(response.body.meta).toEqual({
      total: 2,
      page: 1,
      limit: 1,
      pages: 2,
    });
    const pageTwo = await as(teacher, 'get', '?page=2&limit=1').expect(200);
    expect(pageTwo.body.items.map((item: Student) => item.id)).toEqual([
      inactive.id,
    ]);
  });

  it('applies teacher scope before status/search filtering and statistics', async () => {
    const search = await as(teacher, 'get', '?search=Peer').expect(200);
    expect(search.body.items).toEqual([]);
    expect(search.body.meta.total).toBe(0);
    const response = await as(teacher, 'get', '?status=INACTIVE').expect(200);
    expect(response.body.items.map((item: Student) => item.id)).toEqual([
      inactive.id,
    ]);
    const stats = await as(teacher, 'get', '/statistics').expect(200);
    expect(stats.body).toEqual({
      total: 2,
      active: 1,
      inactive: 1,
      deleted: 1,
      enrollmentCount: 3,
    });
  });

  it('allows assigned student reads and limits detail enrollments to the same teacher', async () => {
    await as(teacher, 'get', `/${assigned.id}`).expect(200);
    const detail = await as(teacher, 'get', `/${assigned.id}/detail`).expect(
      200,
    );
    expect(
      detail.body.enrollments.map((item: { id: string }) => item.id),
    ).toEqual([ownEnrollmentId]);
    expect(detail.body.expected_monthly_fee).toBe('180');
    expect(detail.body.paid_current_month).toBe('25');
    expect(detail.body.enrollments[0].group.teacher.id).toBe(teacher.id);
    expect(JSON.stringify(detail.body)).not.toContain('Foreign secret');
  });

  it('rejects unrelated and corrupt students on both direct and detail routes', async () => {
    for (const student of hidden) {
      await as(teacher, 'get', `/${student.id}`).expect(404);
      await as(teacher, 'get', `/${student.id}/detail`).expect(404);
    }
    await as(teacher, 'get', `/${deleted.id}`).expect(404);
    await as(teacher, 'get', `/${deleted.id}/detail`).expect(404);
  });

  it('keeps peer teachers scoped to their own assignments', async () => {
    const response = await as(peerTeacher, 'get', '?limit=100').expect(200);
    expect(response.body.items.map((item: Student) => item.id).sort()).toEqual(
      [assigned.id, peer.id].sort(),
    );
    await as(peerTeacher, 'get', `/${peer.id}/detail`).expect(200);
    await as(peerTeacher, 'get', `/${inactive.id}/detail`).expect(404);
  });

  it.each(['admin', 'manager', 'superAdmin'] as const)(
    'preserves tenant-wide access for %s and removes corrupt nested relations',
    async (role) => {
      const actor = { admin, manager, superAdmin }[role]!;
      const response = await as(actor, 'get', '?limit=100').expect(200);
      expect(
        response.body.items.map((item: Student) => item.id).sort(),
      ).toEqual(localStudents.map((student) => student.id).sort());
      expect(response.body.meta.total).toBe(localStudents.length);
      const stats = await as(actor, 'get', '/statistics').expect(200);
      expect(stats.body).toEqual({
        total: localStudents.length,
        active: localStudents.length - 1,
        inactive: 1,
        deleted: 1,
        enrollmentCount: 5,
      });
      const detail = await as(actor, 'get', `/${assigned.id}/detail`).expect(
        200,
      );
      expect(
        detail.body.enrollments.map((item: { id: string }) => item.id).sort(),
      ).toEqual([ownEnrollmentId, peerEnrollmentId].sort());
      expect(detail.body.expected_monthly_fee).toBe('480');
      expect(detail.body.paid_current_month).toBe('25');
      expect(JSON.stringify(detail.body)).not.toContain('Foreign secret');
      await as(actor, 'get', `/${foreign.id}/detail`).expect(404);
    },
  );

  it('allows a platform admin to select an organization explicitly', async () => {
    const response = await as(superAdmin, 'get', '', organizationB).expect(200);
    expect(response.body.items.map((item: Student) => item.id)).toEqual([
      foreign.id,
    ]);
    await as(superAdmin, 'get', `/${assigned.id}/detail`, organizationB).expect(
      404,
    );
    await as(superAdmin, 'get', `/${foreign.id}/detail`, organizationB).expect(
      200,
    );
  });

  it('preserves write restrictions for teachers and student role restrictions', async () => {
    await as(teacher, 'patch', `/${assigned.id}`)
      .send({ name: 'Forbidden edit' })
      .expect(403);
    await as(studentUser, 'get', '').expect(403);
    await as(studentUser, 'get', `/${assigned.id}/detail`).expect(403);
    const after = await db.student.findUniqueOrThrow({
      where: { id: assigned.id },
    });
    expect(after.name).toBe(assigned.name);
  });
});
