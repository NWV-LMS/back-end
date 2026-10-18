import { ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { EnrollmentActor } from '../enrollment/enrollment-access';

export function lessonTenantWhere(
  organizationId: string,
): Prisma.LessonWhereInput {
  // Older lessons have no organization_id; their course remains authoritative.
  // A non-null, conflicting organization_id must never grant either tenant access.
  return {
    OR: [{ organization_id: organizationId }, { organization_id: null }],
    course: { organization_id: organizationId },
  };
}

export function courseAccessWhere(
  organizationId: string,
  actor: EnrollmentActor,
): Prisma.CourseWhereInput {
  const where: Prisma.CourseWhereInput = { organization_id: organizationId };
  if (actor.role === UserRole.TEACHER) {
    where.groups = {
      some: { organization_id: organizationId, teacher_id: actor.sub },
    };
  } else if (actor.role === UserRole.STUDENT) {
    where.groups = {
      some: {
        organization_id: organizationId,
        enrollments: {
          some: {
            organization_id: organizationId,
            student: { organization_id: organizationId, user_id: actor.sub },
          },
        },
      },
    };
  } else if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
    throw new ForbiddenException('Course access is not permitted');
  }
  return where;
}

export function lessonAccessWhere(
  organizationId: string,
  actor: EnrollmentActor,
): Prisma.LessonWhereInput {
  return {
    ...lessonTenantWhere(organizationId),
    course: courseAccessWhere(organizationId, actor),
  };
}
