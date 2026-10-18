import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';
import { PrismaExceptionFilter } from '../src/database/prisma-exception.filter';

let app: INestApplication;
let database: DatabaseService;
let authToken: string;
let testOrganizationId: string;
let testStudentId: string;
let testAdminId: string;
let testAdminPhone: string;
const testPassword = 'e2e-fixture-password';

export async function createTestApp(): Promise<INestApplication> {
  // Never reuse the application's DATABASE_URL: this suite creates and removes
  // fixture data and must be explicitly pointed at a disposable test database.
  if (!process.env.TEST_DATABASE_URL) {
    throw new Error(
      'Set TEST_DATABASE_URL to a migrated, disposable PostgreSQL database before running E2E tests',
    );
  }
  process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  authToken = '';
  testOrganizationId = '';
  testStudentId = '';
  testAdminId = '';

  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.setGlobalPrefix('api');
  app.useGlobalFilters(new PrismaExceptionFilter());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  database = app.get(DatabaseService);
  return app;
}

export async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  const fixtureId = randomUUID();
  testAdminPhone = `e2e-${fixtureId}`;
  const password = await bcrypt.hash(testPassword, 10);
  const org = await database.organization.create({
    data: {
      name: `E2E ${fixtureId}`,
      status: 'ACTIVE',
      email: `org-${fixtureId}@example.test`,
      phone: testAdminPhone,
      users: {
        create: {
          full_name: 'E2E Admin',
          email: `admin-${fixtureId}@example.test`,
          phone: testAdminPhone,
          password,
          role: 'ADMIN',
        },
      },
      students: {
        create: {
          name: 'E2E Student',
          phone: `student-${fixtureId}`,
          status: 'ACTIVE',
        },
      },
    },
    include: { users: true, students: true },
  });
  testOrganizationId = org.id;
  testAdminId = org.users[0].id;
  testStudentId = org.students[0].id;

  // Login to get token
  const response = await request(app.getHttpServer())
    .post('/api/auth/login')
    .send({ phone: testAdminPhone, password: testPassword })
    .expect(201);

  expect(response.body.accessToken).toEqual(expect.any(String));
  authToken = response.body.accessToken;
  return authToken;
}

export function getTestOrganizationId(): string {
  return testOrganizationId;
}

export function getTestStudentId(): string {
  return testStudentId;
}

export function getTestAdminId(): string {
  return testAdminId;
}

export function getApp(): INestApplication {
  return app;
}

export function getDatabase(): DatabaseService {
  return database;
}

export async function closeTestApp(): Promise<void> {
  try {
    if (database && testOrganizationId) {
      const where = { organization_id: testOrganizationId };
      await database.$transaction([
        database.payment.deleteMany({ where }),
        database.expense.deleteMany({ where }),
        database.student.deleteMany({ where }),
        database.user.deleteMany({ where }),
        database.organization.delete({ where: { id: testOrganizationId } }),
      ]);
    }
  } finally {
    if (app) await app.close();
    authToken = '';
    testOrganizationId = '';
    testStudentId = '';
    testAdminId = '';
  }
}

// Jest timeout for E2E tests
jest.setTimeout(30000);
