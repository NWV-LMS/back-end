import { User, UserRole } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'crypto';
import * as request from 'supertest';
import { AuthService } from '../src/components/auth/auth.service';
import { closeTestApp, createTestApp, getApp, getDatabase } from './setup-e2e';

describe('Profile update security (PostgreSQL e2e)', () => {
  const suffix = randomUUID();
  const currentPassword = 'profile-security-current-password';
  const newPassword = 'profile-security-new-password';
  let originalHash: string;
  let organizationId: string;
  let self: User;
  let victim: User;
  let accessToken: string;
  let refreshToken: string;
  let originalSession: string | null;

  beforeAll(async () => {
    await createTestApp();
    originalHash = await bcrypt.hash(currentPassword, 10);
    const organization = await getDatabase().organization.create({
      data: {
        name: `profile-security-${suffix}`,
        status: 'ACTIVE',
        email: `profile-org-${suffix}@example.test`,
        phone: `profile-org-${suffix}`,
        users: {
          create: [
            {
              full_name: 'Profile Self',
              email: `profile-self-${suffix}@example.test`,
              phone: `profile-self-${suffix}`,
              password: originalHash,
              role: UserRole.STUDENT,
            },
            {
              full_name: 'Profile Victim',
              email: `profile-victim-${suffix}@example.test`,
              phone: `profile-victim-${suffix}`,
              password: originalHash,
              role: UserRole.ADMIN,
            },
          ],
        },
      },
      include: { users: true },
    });
    organizationId = organization.id;
    self = organization.users.find((user) => user.role === UserRole.STUDENT)!;
    victim = organization.users.find((user) => user.role === UserRole.ADMIN)!;
  });

  beforeEach(async () => {
    const auth = getApp().get(AuthService);
    await getDatabase().user.update({
      where: { id: self.id },
      data: {
        full_name: self.full_name,
        email: self.email,
        phone: self.phone,
        password: originalHash,
      },
    });
    const tokens = await auth.generateTokens({
      sub: self.id,
      id: self.id,
      role: self.role,
      organization_id: organizationId,
      email: self.email,
      phone: self.phone,
      name: self.full_name,
    });
    accessToken = tokens.accessToken;
    refreshToken = tokens.refreshToken;
    await auth.storeRefreshToken(self.id, refreshToken);
    originalSession = (
      await getDatabase().user.findUniqueOrThrow({ where: { id: self.id } })
    ).refresh_token;
  });

  afterAll(async () => {
    try {
      if (organizationId) {
        await getDatabase().$transaction([
          getDatabase().user.deleteMany({
            where: { organization_id: organizationId },
          }),
          getDatabase().organization.delete({ where: { id: organizationId } }),
        ]);
      }
    } finally {
      await closeTestApp();
    }
  });

  const update = (payload: object) =>
    request(getApp().getHttpServer())
      .post('/api/user/update')
      .auth(accessToken, { type: 'bearer' })
      .send(payload);

  it.each([
    ['missing current password', { password: undefined }],
    ['wrong current password', { password: 'wrong-current-password' }],
    ['mismatched confirmation', { confirm_new_password: 'different-password' }],
    ['missing confirmation', { confirm_new_password: undefined }],
  ])(
    'preserves the entire profile/password/session on %s',
    async (_name, changes) => {
      await update({
        phone: `attempt-${self.phone}`,
        full_name: 'Must not persist',
        email: `attempt-${self.email}`,
        password: currentPassword,
        new_password: newPassword,
        confirm_new_password: newPassword,
        ...changes,
      }).expect(400);

      const after = await getDatabase().user.findUniqueOrThrow({
        where: { id: self.id },
      });
      expect(after).toMatchObject({
        id: self.id,
        full_name: self.full_name,
        phone: self.phone,
        email: self.email,
        password: originalHash,
        refresh_token: originalSession,
      });
    },
  );

  it('requires authentication for profile updates', async () => {
    await request(getApp().getHttpServer())
      .post('/api/user/update')
      .send({ phone: self.phone })
      .expect(401);
  });

  it('updates only the authenticated user and ignores privilege/session/password assignment', async () => {
    const response = await update({
      phone: self.phone,
      full_name: 'Allowed own name',
      id: victim.id,
      userId: victim.id,
      role: UserRole.SUPER_ADMIN,
      organization_id: randomUUID(),
      password: 'raw-password-assignment-attempt',
      refresh_token: 'attacker-refresh-token',
      token: 'attacker-token',
    }).expect(201);

    expect(response.body).toMatchObject({
      id: self.id,
      full_name: 'Allowed own name',
      role: self.role,
      organization_id: organizationId,
    });
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('refresh_token');
    const [afterSelf, afterVictim] = await Promise.all([
      getDatabase().user.findUniqueOrThrow({ where: { id: self.id } }),
      getDatabase().user.findUniqueOrThrow({ where: { id: victim.id } }),
    ]);
    expect(afterSelf).toMatchObject({
      password: originalHash,
      refresh_token: originalSession,
      role: self.role,
      organization_id: organizationId,
    });
    expect(afterVictim).toEqual(victim);
  });

  it('stores a bcrypt password, commits profile fields and revokes the old refresh token', async () => {
    const response = await update({
      phone: self.phone,
      full_name: 'Valid password change',
      password: currentPassword,
      new_password: newPassword,
      confirm_new_password: newPassword,
    }).expect(201);

    const after = await getDatabase().user.findUniqueOrThrow({
      where: { id: self.id },
    });
    expect(after.full_name).toBe('Valid password change');
    expect(after.password).not.toBe(newPassword);
    expect(await bcrypt.compare(newPassword, after.password)).toBe(true);
    expect(await bcrypt.compare(currentPassword, after.password)).toBe(false);
    expect(after.refresh_token).toBeNull();
    expect(response.body).not.toHaveProperty('password');
    expect(response.body).not.toHaveProperty('refresh_token');

    await request(getApp().getHttpServer())
      .post('/api/auth/refresh')
      .send({ refreshToken })
      .expect(401);
    await request(getApp().getHttpServer())
      .post('/api/auth/login')
      .send({ phone: self.phone, password: currentPassword })
      .expect(401);
    const login = await request(getApp().getHttpServer())
      .post('/api/auth/login')
      .send({ phone: self.phone, password: newPassword })
      .expect(201);
    expect(login.body.user).not.toHaveProperty('password');
    expect(login.body.user).not.toHaveProperty('refresh_token');
  });

  it('allows only one of two changes that both verified the old password', async () => {
    const database = getDatabase();
    const read = database.user.findUnique.bind(database.user);
    let releaseReads!: () => void;
    const bothRead = new Promise<void>((resolve) => {
      releaseReads = resolve;
    });
    let reads = 0;
    const spy = jest
      .spyOn(database.user, 'findUnique')
      .mockImplementation((async (args: any) => {
        const snapshot = await read(args);
        if (args.where.id === self.id && args.select?.password) {
          reads += 1;
          if (reads === 2) releaseReads();
          await bothRead;
        }
        return snapshot;
      }) as any);

    let responses: request.Response[];
    try {
      responses = await Promise.all(
        ['one', 'two'].map((label) =>
          update({
            phone: self.phone,
            full_name: `Winner ${label}`,
            password: currentPassword,
            new_password: `new-password-${label}`,
            confirm_new_password: `new-password-${label}`,
          }),
        ),
      );
    } finally {
      spy.mockRestore();
    }

    expect(responses.map((response) => response.status).sort()).toEqual([
      201, 400,
    ]);
    const winner = responses.findIndex((response) => response.status === 201);
    const winningLabel = ['one', 'two'][winner];
    const after = await database.user.findUniqueOrThrow({
      where: { id: self.id },
    });
    expect(after.full_name).toBe(`Winner ${winningLabel}`);
    expect(
      await bcrypt.compare(`new-password-${winningLabel}`, after.password),
    ).toBe(true);
    expect(after.refresh_token).toBeNull();
  });
});
