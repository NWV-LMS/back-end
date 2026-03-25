import { Group } from 'generated/prisma/client';
import { GroupResponseDto } from '../dto/group/group-response.dto';

type GroupWithRelations = Group & {
  course?: { id: string; title: string };
  teacher?: { id: string; full_name: string };
};

// DB entity -> API response DTO mapper.
export const toGroupResponse = (
  group: GroupWithRelations,
): GroupResponseDto => ({
  id: group.id,
  organization_id: group.organization_id,
  name: group.name,
  course_id: group.course_id,
  teacher_id: group.teacher_id,
  start_date: group.start_date,
  end_date: group.end_date,
  created_at: group.created_at,
  course: group.course,
  teacher: group.teacher,
});
