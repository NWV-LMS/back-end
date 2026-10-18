import { ForbiddenException } from '@nestjs/common';
import { Prisma, UserRole } from '@prisma/client';
import { JwtPayload } from '../../libs/types/auth';

export type EnrollmentActor = Pick<JwtPayload, 'sub' | 'role'>;

// Scope every joined object as well as the enrollment itself. This also keeps
// legacy inconsistent rows from disclosing data from another organization.
export function enrollmentAccessWhere(
  organizationId: string,
  actor: EnrollmentActor,
): Prisma.EnrollmentWhereInput {
  const group: Prisma.GroupWhereInput = {
    organization_id: organizationId,
    course: { organization_id: organizationId },
    teacher: { organization_id: organizationId },
  };
  const student: Prisma.StudentWhereInput = {
    organization_id: organizationId,
  };

  if (actor.role === UserRole.TEACHER) {
    group.teacher_id = actor.sub;
  } else if (actor.role === UserRole.STUDENT) {
    student.user_id = actor.sub;
  } else if (actor.role !== UserRole.ADMIN && actor.role !== UserRole.MANAGER) {
    throw new ForbiddenException('Enrollment access is not permitted');
  }

  return { organization_id: organizationId, group, student };
}
