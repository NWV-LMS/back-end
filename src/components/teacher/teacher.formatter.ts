import { User, TeacherProfile } from '@prisma/client';

/**
 * Shared formatter for teacher responses.
 * Keeps all three services returning identical shapes.
 */
export function formatTeacherResponse(
  user: User,
  profile: TeacherProfile | null | undefined,
) {
  return {
    id: user.id,
    email: user.email,
    full_name: user.full_name,
    phone: user.phone,
    role: user.role,
    organization_id: user.organization_id,
    subjects: profile?.subjects || [],
    hourly_rate: profile?.hourly_rate ? Number(profile.hourly_rate) : null,
    fixed_salary: profile?.fixed_salary ? Number(profile.fixed_salary) : null,
    percent_rate: profile?.percent_rate ? Number(profile.percent_rate) : null,
    salary_type: profile?.salary_type ?? 'FIXED',
    qualifications: profile?.qualifications || null,
    bio: profile?.bio || null,
    status: profile?.status || 'INACTIVE',
    deleted_at: profile?.deleted_at ?? null,
    created_at: user.created_at,
    updated_at: user.updated_at,
  };
}
