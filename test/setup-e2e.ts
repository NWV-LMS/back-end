import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { AppModule } from '../src/app.module';
import { DatabaseService } from '../src/database/database.service';

let app: INestApplication;
let database: DatabaseService;
let authToken: string;
let testOrganizationId: string;
let testStudentId: string;

export async function createTestApp(): Promise<INestApplication> {
  const moduleFixture: TestingModule = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();

  app = moduleFixture.createNestApplication();
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  database = app.get(DatabaseService);
  return app;
}

export async function getAuthToken(): Promise<string> {
  if (authToken) return authToken;

  // Get test organization
  const org = await database.organization.findFirst({
    where: { status: 'ACTIVE' },
  });
  if (!org) throw new Error('No active organization found for testing');
  testOrganizationId = org.id;

  // Get test admin user
  const user = await database.user.findFirst({
    where: { organization_id: org.id, role: 'ADMIN' },
  });
  if (!user) throw new Error('No admin user found for testing');

  // Get test student
  const student = await database.student.findFirst({
    where: { organization_id: org.id },
  });
  if (student) testStudentId = student.id;

  // Login to get token
  const response = await request(app.getHttpServer())
    .post('/user/login')
    .send({ phone: user.phone, password: 'test123' });

  authToken = response.body.accessToken;
  return authToken;
}

export function getTestOrganizationId(): string {
  return testOrganizationId;
}

export function getTestStudentId(): string {
  return testStudentId;
}

export function getApp(): INestApplication {
  return app;
}

export function getDatabase(): DatabaseService {
  return database;
}

export async function closeTestApp(): Promise<void> {
  if (app) {
    await app.close();
  }
}

// Jest timeout for E2E tests
jest.setTimeout(30000);
