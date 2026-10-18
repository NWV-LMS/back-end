import { INestApplication, ValidationPipe } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { User, UserRole } from '@prisma/client';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AttendanceController } from '../src/components/attendance/attendance.controller';
import { AttendanceService } from '../src/components/attendance/attendance.service';
import { OrganizationActiveGuard } from '../src/components/auth/guards/organization-active.guard';
import { JwtStrategy } from '../src/components/auth/strategies/jwt.strategy';
import { EnrollmentController } from '../src/components/enrollment/enrollment.controller';
import { EnrollmentService } from '../src/components/enrollment/enrollment.service';
import { JournalController } from '../src/components/journal/journal.controller';
import { JournalService } from '../src/components/journal/journal.service';
import { LessonController } from '../src/components/lesson/lesson.controller';
import { LessonService } from '../src/components/lesson/lesson.service';
import { ProgressController } from '../src/components/progress/progress.controller';
import { ProgressService } from '../src/components/progress/progress.service';
import { DatabaseService } from '../src/database/database.service';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';

describe('Tenant and learning ownership boundaries (real PostgreSQL)', () => {
  let app: INestApplication;
  let db: DatabaseService;
  let a: Awaited<ReturnType<typeof createTenant>>;
  let b: Awaited<ReturnType<typeof createTenant>>;
  let other: Awaited<ReturnType<typeof createOtherGroup>>;
  let legacyLessonId: string;
  let inconsistentLessonIds: string[];
  let corruptEnrollmentId: string;
  let corruptProgressId: string;
  let corruptAttendanceId: string;
  const organizationIds: string[] = [];
  const label = randomUUID();
  const jwt = new JwtService();
  const startDate = new Date('2026-01-01');
  const endDate = new Date('2026-12-31');

  async function createUser(
    organizationId: string,
    role: UserRole,
    name: string,
  ) {
    return db.user.create({
      data: {
        organization_id: organizationId,
        full_name: name,
        email: `${name}-${label}@example.test`,
        phone: `${name}-${label}`,
        password: 'unused-test-only-password-hash',
        role,
      },
    });
  }

  async function createTenant(name: string) {
    const organization = await db.organization.create({
      data: {
        name: `tenant-security-${name}-${label}`,
        email: `${name}-${label}@example.test`,
        phone: `org-${name}-${label}`,
        status: 'ACTIVE',
      },
    });
    organizationIds.push(organization.id);
    const admin = await createUser(
      organization.id,
      UserRole.ADMIN,
      `${name}-admin`,
    );
    const manager = await createUser(
      organization.id,
      UserRole.MANAGER,
      `${name}-manager`,
    );
    const teacher = await createUser(
      organization.id,
      UserRole.TEACHER,
      `${name}-teacher`,
    );
    const studentUser = await createUser(
      organization.id,
      UserRole.STUDENT,
      `${name}-student`,
    );
    const student = await db.student.create({
      data: {
        organization_id: organization.id,
        user_id: studentUser.id,
        name: `${name} private student`,
        phone: `student-${name}-${label}`,
        status: 'ACTIVE',
      },
    });
    const course = await db.course.create({
      data: {
        organization_id: organization.id,
        title: `${name} private course`,
        price: '100',
        status: 'ACTIVE',
      },
    });
    const group = await db.group.create({
      data: {
        organization_id: organization.id,
        course_id: course.id,
        teacher_id: teacher.id,
        name: `${name} private group`,
        start_date: startDate,
        end_date: endDate,
      },
    });
    const lesson = await db.lesson.create({
      data: {
        organization_id: organization.id,
        course_id: course.id,
        title: `${name} private lesson`,
        start_date: startDate,
        end_date: startDate,
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        organization_id: organization.id,
        student_id: student.id,
        group_id: group.id,
      },
    });
    const progress = await db.progress.create({
      data: {
        organization_id: organization.id,
        enrollment_id: enrollment.id,
        lesson_id: lesson.id,
        title: `${name} private progress`,
        completed: false,
      },
    });
    const attendance = await db.attendance.create({
      data: {
        organization_id: organization.id,
        enrollment_id: enrollment.id,
        lesson_id: lesson.id,
        status: 'PRESENT',
      },
    });
    return {
      organization,
      admin,
      manager,
      teacher,
      studentUser,
      student,
      course,
      group,
      lesson,
      enrollment,
      progress,
      attendance,
    };
  }

  async function createOtherGroup() {
    const organizationId = a.organization.id;
    const teacher = await createUser(
      organizationId,
      UserRole.TEACHER,
      'A-other-teacher',
    );
    const studentUser = await createUser(
      organizationId,
      UserRole.STUDENT,
      'A-peer',
    );
    const student = await db.student.create({
      data: {
        organization_id: organizationId,
        user_id: studentUser.id,
        name: 'Peer student',
        phone: `peer-${label}`,
        status: 'ACTIVE',
      },
    });
    const unenrolledStudent = await db.student.create({
      data: {
        organization_id: organizationId,
        name: 'Unenrolled student',
        phone: `unenrolled-${label}`,
        status: 'ACTIVE',
      },
    });
    const course = await db.course.create({
      data: {
        organization_id: organizationId,
        title: 'Other teacher course',
        price: '200',
        status: 'ACTIVE',
      },
    });
    const group = await db.group.create({
      data: {
        organization_id: organizationId,
        course_id: course.id,
        teacher_id: teacher.id,
        name: 'Other teacher group',
        start_date: startDate,
        end_date: endDate,
      },
    });
    const lesson = await db.lesson.create({
      data: {
        organization_id: organizationId,
        course_id: course.id,
        title: 'Other course lesson',
        start_date: startDate,
        end_date: startDate,
      },
    });
    const enrollment = await db.enrollment.create({
      data: {
        organization_id: organizationId,
        student_id: student.id,
        group_id: group.id,
      },
    });
    const peerEnrollment = await db.enrollment.create({
      data: {
        organization_id: organizationId,
        student_id: student.id,
        group_id: a.group.id,
      },
    });
    const progress = await db.progress.create({
      data: {
        organization_id: organizationId,
        enrollment_id: enrollment.id,
        lesson_id: lesson.id,
        title: 'Other teacher private progress',
        completed: false,
      },
    });
    const peerProgress = await db.progress.create({
      data: {
        organization_id: organizationId,
        enrollment_id: peerEnrollment.id,
        lesson_id: a.lesson.id,
        title: 'Same group peer progress',
        completed: false,
      },
    });
    const attendance = await db.attendance.create({
      data: {
        organization_id: organizationId,
        enrollment_id: enrollment.id,
        lesson_id: lesson.id,
        status: 'PRESENT',
      },
    });
    const peerAttendance = await db.attendance.create({
      data: {
        organization_id: organizationId,
        enrollment_id: peerEnrollment.id,
        lesson_id: a.lesson.id,
        status: 'PRESENT',
      },
    });
    return {
      teacher,
      studentUser,
      student,
      unenrolledStudent,
      course,
      group,
      lesson,
      enrollment,
      peerEnrollment,
      progress,
      peerProgress,
      attendance,
      peerAttendance,
    };
  }

  function as(actor: User, method: 'get' | 'post' | 'patch', path: string) {
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
    return request(app.getHttpServer())
      [method](`/api${path}`)
      .auth(token, { type: 'bearer' });
  }

  async function denied(call: request.Test) {
    const response = await call;
    expect([403, 404]).toContain(response.status);
    return response;
  }

  beforeAll(async () => {
    if (!process.env.TEST_DATABASE_URL) {
      throw new Error(
        'Set TEST_DATABASE_URL to a migrated, disposable PostgreSQL database for tenant security tests',
      );
    }
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
    const module = await Test.createTestingModule({
      imports: [
        ConfigModule.forRoot({ isGlobal: true, ignoreEnvFile: true }),
        PassportModule,
      ],
      controllers: [
        EnrollmentController,
        ProgressController,
        AttendanceController,
        JournalController,
        LessonController,
      ],
      providers: [
        EnrollmentService,
        ProgressService,
        AttendanceService,
        JournalService,
        LessonService,
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
    a = await createTenant('A');
    b = await createTenant('B');
    other = await createOtherGroup();
    const legacyLesson = await db.lesson.create({
      data: {
        course_id: a.course.id,
        title: 'Legacy lesson without organization',
        start_date: startDate,
        end_date: startDate,
      },
    });
    legacyLessonId = legacyLesson.id;
    inconsistentLessonIds = [];
    for (const [organizationId, courseId] of [
      [a.organization.id, b.course.id],
      [b.organization.id, a.course.id],
    ]) {
      const lesson = await db.lesson.create({
        data: {
          organization_id: organizationId,
          course_id: courseId,
          title: 'Inconsistent tenant lesson',
          start_date: startDate,
          end_date: startDate,
        },
      });
      inconsistentLessonIds.push(lesson.id);
    }
    // Simulate legacy invalid links. Read defenses must also hide existing rows.
    const corruptEnrollment = await db.enrollment.create({
      data: {
        organization_id: a.organization.id,
        student_id: b.student.id,
        group_id: a.group.id,
      },
    });
    corruptEnrollmentId = corruptEnrollment.id;
    const corruptProgress = await db.progress.create({
      data: {
        organization_id: a.organization.id,
        enrollment_id: a.enrollment.id,
        lesson_id: b.lesson.id,
        title: 'Corrupt foreign lesson progress',
        completed: false,
      },
    });
    corruptProgressId = corruptProgress.id;
    const corruptAttendance = await db.attendance.create({
      data: {
        organization_id: a.organization.id,
        enrollment_id: a.enrollment.id,
        lesson_id: b.lesson.id,
        status: 'PRESENT',
      },
    });
    corruptAttendanceId = corruptAttendance.id;
  });

  afterAll(async () => {
    try {
      if (db && organizationIds.length) {
        const where = { organization_id: { in: organizationIds } };
        await db.$transaction([
          db.journalEntry.deleteMany({ where }),
          db.attendance.deleteMany({ where }),
          db.progress.deleteMany({ where }),
          db.enrollment.deleteMany({ where }),
          db.groupSchedule.deleteMany({ where }),
          db.group.deleteMany({ where }),
          db.lesson.deleteMany({
            where: {
              OR: [
                where,
                { course: { organization_id: { in: organizationIds } } },
              ],
            },
          }),
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

  describe('enrollment relations and teacher reads', () => {
    it.each(['student_id', 'group_id'] as const)(
      'rejects foreign %s on create without inserting a row',
      async (field) => {
        const before = await db.enrollment.count({
          where: { organization_id: a.organization.id },
        });
        const body = {
          student_id: other.unenrolledStudent.id,
          group_id: a.group.id,
          [field]: field === 'student_id' ? b.student.id : b.group.id,
        };
        await as(a.manager, 'post', '/enrollment').send(body).expect(404);
        expect(
          await db.enrollment.count({
            where: { organization_id: a.organization.id },
          }),
        ).toBe(before);
      },
    );

    it.each(['student_id', 'group_id'] as const)(
      'rejects foreign %s on update without changing any fields',
      async (field) => {
        const before = await db.enrollment.findUniqueOrThrow({
          where: { id: a.enrollment.id },
        });
        await as(a.admin, 'patch', `/enrollment/${a.enrollment.id}`)
          .send({
            [field]: field === 'student_id' ? b.student.id : b.group.id,
            monthly_fee: 999,
          })
          .expect(404);
        expect(
          await db.enrollment.findUniqueOrThrow({
            where: { id: a.enrollment.id },
          }),
        ).toEqual(before);
      },
    );

    it('allows a manager to update an enrollment within the tenant', async () => {
      await as(a.manager, 'patch', `/enrollment/${a.enrollment.id}`)
        .send({ monthly_fee: 150 })
        .expect(200);
      expect(
        (
          await db.enrollment.findUniqueOrThrow({
            where: { id: a.enrollment.id },
          })
        ).monthly_fee.toString(),
      ).toBe('150');
    });

    it('rejects moving an enrollment away from its recorded lesson course', async () => {
      const before = await db.enrollment.findUniqueOrThrow({
        where: { id: a.enrollment.id },
      });
      await as(a.admin, 'patch', `/enrollment/${a.enrollment.id}`)
        .send({ group_id: other.group.id, monthly_fee: 999 })
        .expect(400);
      expect(
        await db.enrollment.findUniqueOrThrow({
          where: { id: a.enrollment.id },
        }),
      ).toEqual(before);
    });

    it('limits teacher lists and group reads to valid enrollments in their own groups', async () => {
      const list = await as(a.teacher, 'get', '/enrollment').expect(200);
      expect(
        list.body.items.map((item: { id: string }) => item.id).sort(),
      ).toEqual([a.enrollment.id, other.peerEnrollment.id].sort());
      const group = await as(
        a.teacher,
        'get',
        `/enrollment/group/${a.group.id}`,
      ).expect(200);
      expect(group.body.map((item: { id: string }) => item.id).sort()).toEqual(
        [a.enrollment.id, other.peerEnrollment.id].sort(),
      );
      await denied(as(a.teacher, 'get', `/enrollment/${other.enrollment.id}`));
      await denied(as(a.teacher, 'get', `/enrollment/group/${other.group.id}`));
      await as(a.admin, 'get', `/enrollment/${corruptEnrollmentId}`).expect(
        404,
      );
    });
  });

  describe('progress relations and ownership', () => {
    it.each(['foreignEnrollment', 'foreignLesson', 'wrongCourse'] as const)(
      'rejects %s on create without inserting progress',
      async (kind) => {
        const before = await db.progress.count({
          where: { organization_id: a.organization.id },
        });
        await as(a.admin, 'post', '/progress')
          .send({
            enrollment_id:
              kind === 'foreignEnrollment' ? b.enrollment.id : a.enrollment.id,
            lesson_id:
              kind === 'foreignLesson'
                ? b.lesson.id
                : kind === 'wrongCourse'
                  ? other.lesson.id
                  : a.lesson.id,
            completed: false,
            title: 'Rejected progress',
          })
          .expect(kind === 'wrongCourse' ? 400 : 404);
        expect(
          await db.progress.count({
            where: { organization_id: a.organization.id },
          }),
        ).toBe(before);
      },
    );

    it.each(['foreignEnrollment', 'foreignLesson', 'wrongCourse'] as const)(
      'rejects %s on update atomically',
      async (kind) => {
        const before = await db.progress.findUniqueOrThrow({
          where: { id: a.progress.id },
        });
        const changes =
          kind === 'foreignEnrollment'
            ? { enrollment_id: b.enrollment.id }
            : {
                lesson_id:
                  kind === 'foreignLesson' ? b.lesson.id : other.lesson.id,
              };
        await as(a.admin, 'patch', `/progress/${a.progress.id}`)
          .send({ ...changes, title: 'Must not persist', completed: true })
          .expect(kind === 'wrongCourse' ? 400 : 404);
        expect(
          await db.progress.findUniqueOrThrow({ where: { id: a.progress.id } }),
        ).toEqual(before);
      },
    );

    it('denies a teacher changing progress in another teacher group or moving their own progress there', async () => {
      for (const [id, changes] of [
        [other.progress.id, { completed: true }],
        [a.progress.id, { enrollment_id: other.enrollment.id }],
      ] as const) {
        const before = await db.progress.findUniqueOrThrow({ where: { id } });
        await denied(as(a.teacher, 'patch', `/progress/${id}`).send(changes));
        expect(await db.progress.findUniqueOrThrow({ where: { id } })).toEqual(
          before,
        );
      }
      await denied(as(a.teacher, 'get', `/progress/${other.progress.id}`));
    });

    it('scopes teacher progress lists and student summaries to their own groups', async () => {
      const list = await as(a.teacher, 'get', '/progress').expect(200);
      expect(
        list.body.data.map((item: { id: string }) => item.id).sort(),
      ).toEqual([a.progress.id, other.peerProgress.id].sort());
      const filtered = await as(
        a.teacher,
        'get',
        `/progress?enrollment_id=${other.enrollment.id}`,
      ).expect(200);
      expect(filtered.body.data).toEqual([]);
      const summary = await as(
        a.teacher,
        'get',
        `/progress/student/${other.student.id}`,
      ).expect(200);
      expect(summary.body.data.map((item: { id: string }) => item.id)).toEqual([
        other.peerProgress.id,
      ]);
      await as(a.admin, 'get', `/progress/${corruptProgressId}`).expect(404);
    });

    it('denies peer progress to a student, including a peer in the same group', async () => {
      await denied(
        as(a.studentUser, 'get', `/progress/student/${other.student.id}`),
      );
      const own = await as(
        a.studentUser,
        'get',
        `/progress/student/${a.student.id}`,
      ).expect(200);
      expect(own.body.data.map((item: { id: string }) => item.id)).toEqual([
        a.progress.id,
      ]);
      expect(own.body.summary.total).toBe(1);
    });

    it('allows a teacher to update progress in their own group', async () => {
      const response = await as(
        a.teacher,
        'patch',
        `/progress/${a.progress.id}`,
      )
        .send({ completed: true })
        .expect(200);
      expect(response.body.completed).toBe(true);
      expect(
        (await db.progress.findUniqueOrThrow({ where: { id: a.progress.id } }))
          .completed,
      ).toBe(true);
    });
  });

  describe('attendance relations and ownership', () => {
    it('denies a teacher marking another group and preserves the existing status', async () => {
      const before = await db.attendance.findUniqueOrThrow({
        where: { id: other.attendance.id },
      });
      await denied(
        as(a.teacher, 'post', '/attendance').send({
          enrollment_id: other.enrollment.id,
          lesson_id: other.lesson.id,
          status: 'ABSENT',
        }),
      );
      expect(
        await db.attendance.findUniqueOrThrow({
          where: { id: other.attendance.id },
        }),
      ).toEqual(before);
    });

    it.each(['foreignLesson', 'wrongCourse', 'inconsistentLesson'] as const)(
      'rejects %s without creating or changing attendance',
      async (kind) => {
        const before = await db.attendance.findMany({
          where: { organization_id: a.organization.id },
          orderBy: { id: 'asc' },
        });
        const lessonId =
          kind === 'foreignLesson'
            ? b.lesson.id
            : kind === 'wrongCourse'
              ? other.lesson.id
              : inconsistentLessonIds[1];
        await as(a.admin, 'post', '/attendance')
          .send({
            enrollment_id: a.enrollment.id,
            lesson_id: lessonId,
            status: 'ABSENT',
          })
          .expect(kind === 'wrongCourse' ? 400 : 404);
        expect(
          await db.attendance.findMany({
            where: { organization_id: a.organization.id },
            orderBy: { id: 'asc' },
          }),
        ).toEqual(before);
      },
    );

    it('scopes student lists to their linked student even when group and enrollment filters are supplied', async () => {
      for (const query of [
        '',
        `?group_id=${a.group.id}`,
        `?enrollment_id=${a.enrollment.id}`,
      ]) {
        const own = await as(
          a.studentUser,
          'get',
          `/attendance${query}`,
        ).expect(200);
        expect(own.body.items.map((item: { id: string }) => item.id)).toEqual([
          a.attendance.id,
        ]);
        expect(own.body.meta.total).toBe(1);
      }
      for (const query of [
        `?enrollment_id=${other.peerEnrollment.id}`,
        `?group_id=${other.group.id}`,
        `?enrollment_id=${other.enrollment.id}`,
      ]) {
        const peer = await as(
          a.studentUser,
          'get',
          `/attendance${query}`,
        ).expect(200);
        expect(peer.body.items).toEqual([]);
        expect(peer.body.meta.total).toBe(0);
      }
    });

    it('hides invalid attendance links and another teacher groups from teacher lists', async () => {
      const list = await as(a.teacher, 'get', '/attendance').expect(200);
      expect(
        list.body.items.map((item: { id: string }) => item.id).sort(),
      ).toEqual([a.attendance.id, other.peerAttendance.id].sort());
      expect(
        list.body.items.some(
          (item: { id: string }) => item.id === corruptAttendanceId,
        ),
      ).toBe(false);
      const otherGroup = await as(
        a.teacher,
        'get',
        `/attendance?group_id=${other.group.id}`,
      ).expect(200);
      expect(otherGroup.body.items).toEqual([]);
    });

    it('allows marking the teacher own enrollment', async () => {
      const result = await as(a.teacher, 'post', '/attendance')
        .send({
          enrollment_id: a.enrollment.id,
          lesson_id: a.lesson.id,
          status: 'ABSENT',
        })
        .expect(201);
      expect(result.body.status).toBe('ABSENT');
      expect(
        (
          await db.attendance.findUniqueOrThrow({
            where: { id: a.attendance.id },
          })
        ).status,
      ).toBe('ABSENT');
    });
  });

  describe('journal batch membership', () => {
    it.each(['foreign', 'unenrolled'] as const)(
      'rejects the whole batch for a %s student without partial writes',
      async (kind) => {
        const date = new Date(kind === 'foreign' ? '2026-02-06' : '2026-02-07');
        const before = await db.journalEntry.findMany({
          where: { organization_id: a.organization.id, date },
        });
        await as(a.teacher, 'post', '/journal')
          .send({
            group_id: a.group.id,
            date: date.toISOString(),
            entries: [
              { student_id: a.student.id, status: 'PRESENT' },
              {
                student_id:
                  kind === 'foreign'
                    ? b.student.id
                    : other.unenrolledStudent.id,
                status: 'PRESENT',
              },
            ],
          })
          .expect(404);
        expect(
          await db.journalEntry.findMany({
            where: { organization_id: a.organization.id, date },
          }),
        ).toEqual(before);
      },
    );

    it('allows an enrolled student and rejects the same teacher writing another group', async () => {
      const own = await as(a.teacher, 'post', '/journal')
        .send({
          group_id: a.group.id,
          date: '2026-02-05',
          entries: [{ student_id: a.student.id, status: 'PRESENT', score: 90 }],
        })
        .expect(201);
      expect(own.body).toEqual([
        expect.objectContaining({
          student_id: a.student.id,
          student_name: a.student.name,
          score: 90,
        }),
      ]);
      const before = await db.journalEntry.count({
        where: { organization_id: a.organization.id },
      });
      await denied(
        as(a.teacher, 'post', '/journal').send({
          group_id: other.group.id,
          date: '2026-02-05',
          entries: [{ student_id: other.student.id, status: 'PRESENT' }],
        }),
      );
      expect(
        await db.journalEntry.count({
          where: { organization_id: a.organization.id },
        }),
      ).toBe(before);
    });

    it('revokes the former teacher access and attributes a same-day upsert to the current teacher', async () => {
      const body = {
        group_id: a.group.id,
        date: '2026-02-08',
        entries: [{ student_id: a.student.id, status: 'PRESENT', score: 80 }],
      };
      const initial = await as(a.teacher, 'post', '/journal')
        .send(body)
        .expect(201);
      const entryId = initial.body[0].id;
      expect(initial.body[0].teacher_id).toBe(a.teacher.id);
      try {
        await db.group.update({
          where: { id: a.group.id },
          data: { teacher_id: other.teacher.id },
        });
        const formerTeacher = await as(
          a.teacher,
          'get',
          `/journal?group_id=${a.group.id}&date=${body.date}`,
        ).expect(200);
        expect(formerTeacher.body.items).toEqual([]);
        await denied(as(a.teacher, 'get', `/journal/groups/${a.group.id}`));
        const before = await db.journalEntry.findUniqueOrThrow({
          where: { id: entryId },
        });
        await denied(as(a.teacher, 'post', '/journal').send(body));
        expect(
          await db.journalEntry.findUniqueOrThrow({ where: { id: entryId } }),
        ).toEqual(before);
        const currentTeacher = await as(other.teacher, 'post', '/journal')
          .send({
            ...body,
            entries: [
              { student_id: a.student.id, status: 'ABSENT', score: 55 },
            ],
          })
          .expect(201);
        expect(currentTeacher.body).toEqual([
          expect.objectContaining({
            id: entryId,
            teacher_id: other.teacher.id,
            status: 'ABSENT',
            score: 55,
          }),
        ]);
        expect(
          await db.journalEntry.count({
            where: { group_id: a.group.id, date: new Date(body.date) },
          }),
        ).toBe(1);
      } finally {
        await db.group.update({
          where: { id: a.group.id },
          data: { teacher_id: a.teacher.id },
        });
      }
    });
  });

  describe('lesson tenant and course boundaries', () => {
    const lessonBody = {
      title: 'New safe lesson',
      start_date: '2026-03-01',
      end_date: '2026-03-01',
    };

    it('rejects a foreign course on create and update without moving the lesson', async () => {
      const beforeCount = await db.lesson.count({
        where: { course: { organization_id: a.organization.id } },
      });
      await as(a.admin, 'post', '/lessons')
        .send({ ...lessonBody, course_id: b.course.id })
        .expect(404);
      expect(
        await db.lesson.count({
          where: { course: { organization_id: a.organization.id } },
        }),
      ).toBe(beforeCount);
      const before = await db.lesson.findUniqueOrThrow({
        where: { id: a.lesson.id },
      });
      try {
        await as(a.admin, 'patch', `/lessons/${a.lesson.id}`)
          .send({ course_id: b.course.id, title: 'Must not persist' })
          .expect(404);
        expect(
          await db.lesson.findUniqueOrThrow({ where: { id: a.lesson.id } }),
        ).toEqual(before);
      } finally {
        // Keep later regression checks independent even when this attack works.
        await db.lesson.update({
          where: { id: a.lesson.id },
          data: { course_id: before.course_id, title: before.title },
        });
      }
    });

    it('rejects moving a lesson away from existing enrollment attendance and progress', async () => {
      const before = await db.lesson.findUniqueOrThrow({
        where: { id: a.lesson.id },
      });
      try {
        await as(a.admin, 'patch', `/lessons/${a.lesson.id}`)
          .send({ course_id: other.course.id, title: 'Must not persist' })
          .expect(400);
        expect(
          await db.lesson.findUniqueOrThrow({ where: { id: a.lesson.id } }),
        ).toEqual(before);
      } finally {
        await db.lesson.update({
          where: { id: a.lesson.id },
          data: { course_id: before.course_id, title: before.title },
        });
      }
    });

    it('preserves access to legacy null-organization lessons only through their tenant course', async () => {
      for (const actor of [a.admin, a.teacher, a.studentUser]) {
        await as(actor, 'get', `/lessons/${legacyLessonId}`).expect(200);
      }
      await as(b.admin, 'get', `/lessons/${legacyLessonId}`).expect(404);
    });

    it('hides both directions of inconsistent lesson ownership from both tenants', async () => {
      for (const actor of [a.admin, b.admin]) {
        for (const id of inconsistentLessonIds) {
          await as(actor, 'get', `/lessons/${id}`).expect(404);
          const before = await db.lesson.findUniqueOrThrow({ where: { id } });
          await as(actor, 'patch', `/lessons/${id}`)
            .send({ title: 'Must remain hidden' })
            .expect(404);
          expect(await db.lesson.findUniqueOrThrow({ where: { id } })).toEqual(
            before,
          );
        }
        const list = await as(actor, 'get', '/lessons').expect(200);
        expect(
          list.body.items.some((item: { id: string }) =>
            inconsistentLessonIds.includes(item.id),
          ),
        ).toBe(false);
      }
    });

    it('limits teachers to courses attached to their own groups for reads and writes', async () => {
      await denied(as(a.teacher, 'get', `/lessons/${other.lesson.id}`));
      const before = await db.lesson.findUniqueOrThrow({
        where: { id: other.lesson.id },
      });
      await denied(
        as(a.teacher, 'patch', `/lessons/${other.lesson.id}`).send({
          title: 'Unauthorized change',
        }),
      );
      expect(
        await db.lesson.findUniqueOrThrow({ where: { id: other.lesson.id } }),
      ).toEqual(before);
      await denied(
        as(a.teacher, 'post', '/lessons').send({
          ...lessonBody,
          course_id: other.course.id,
        }),
      );
      const ownBefore = await db.lesson.findUniqueOrThrow({
        where: { id: a.lesson.id },
      });
      await denied(
        as(a.teacher, 'patch', `/lessons/${a.lesson.id}`).send({
          course_id: other.course.id,
        }),
      );
      expect(
        await db.lesson.findUniqueOrThrow({ where: { id: a.lesson.id } }),
      ).toEqual(ownBefore);
      const list = await as(a.teacher, 'get', '/lessons').expect(200);
      expect(
        list.body.items.every(
          (item: { course_id: string }) => item.course_id === a.course.id,
        ),
      ).toBe(true);
      const filtered = await as(
        a.teacher,
        'get',
        `/lessons?course_id=${other.course.id}`,
      ).expect(200);
      expect(filtered.body.items).toEqual([]);
    });

    it('limits student lessons to courses where their own linked student is enrolled', async () => {
      await as(a.studentUser, 'get', `/lessons/${a.lesson.id}`).expect(200);
      await denied(as(a.studentUser, 'get', `/lessons/${other.lesson.id}`));
      const list = await as(a.studentUser, 'get', '/lessons').expect(200);
      expect(list.body.items.length).toBeGreaterThan(0);
      expect(
        list.body.items.every(
          (item: { course_id: string }) => item.course_id === a.course.id,
        ),
      ).toBe(true);
      const filtered = await as(
        a.studentUser,
        'get',
        `/lessons?course_id=${other.course.id}`,
      ).expect(200);
      expect(filtered.body.items).toEqual([]);
    });

    it('allows teacher lesson creation in their own course and persists the tenant id', async () => {
      const response = await as(a.teacher, 'post', '/lessons')
        .send({ ...lessonBody, course_id: a.course.id })
        .expect(201);
      const saved = await db.lesson.findUniqueOrThrow({
        where: { id: response.body.id },
      });
      expect(saved.organization_id).toBe(a.organization.id);
      expect(saved.course_id).toBe(a.course.id);
    });

    it('denies rescheduling another teacher course before resetting any attendance', async () => {
      const beforeLesson = await db.lesson.findUniqueOrThrow({
        where: { id: other.lesson.id },
      });
      const beforeAttendance = await db.attendance.findMany({
        where: { lesson_id: other.lesson.id },
      });
      await denied(
        as(a.teacher, 'patch', `/lessons/${other.lesson.id}/reschedule`).send({
          start_date: '2026-04-01',
          end_date: '2026-04-01',
          resetAttendance: true,
        }),
      );
      expect(
        await db.lesson.findUniqueOrThrow({ where: { id: other.lesson.id } }),
      ).toEqual(beforeLesson);
      expect(
        await db.attendance.findMany({ where: { lesson_id: other.lesson.id } }),
      ).toEqual(beforeAttendance);
    });

    it('resets only the teacher own group attendance for a course shared by two teachers', async () => {
      const sharedGroup = await db.group.create({
        data: {
          organization_id: a.organization.id,
          teacher_id: other.teacher.id,
          course_id: a.course.id,
          name: 'Another teacher sharing the course',
          start_date: startDate,
          end_date: endDate,
        },
      });
      const sharedEnrollment = await db.enrollment.create({
        data: {
          organization_id: a.organization.id,
          student_id: other.student.id,
          group_id: sharedGroup.id,
        },
      });
      const sharedAttendance = await db.attendance.create({
        data: {
          organization_id: a.organization.id,
          enrollment_id: sharedEnrollment.id,
          lesson_id: a.lesson.id,
          status: 'PRESENT',
        },
      });
      await as(a.teacher, 'patch', `/lessons/${a.lesson.id}/reschedule`)
        .send({
          start_date: '2026-04-01',
          end_date: '2026-04-01',
          resetAttendance: true,
        })
        .expect(200);
      expect(
        await db.attendance.count({
          where: { id: { in: [a.attendance.id, other.peerAttendance.id] } },
        }),
      ).toBe(0);
      expect(
        await db.attendance.findUniqueOrThrow({
          where: { id: sharedAttendance.id },
        }),
      ).toEqual(sharedAttendance);
      expect(
        (await db.lesson.findUniqueOrThrow({ where: { id: a.lesson.id } }))
          .start_date,
      ).toEqual(new Date('2026-04-01'));
    });
  });
});
