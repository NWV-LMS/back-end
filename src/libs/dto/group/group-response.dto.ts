export class GroupResponseDto {
  id: string;
  organization_id: string;
  name: string;
  course_id: string;
  teacher_id: string;
  start_date: Date;
  end_date: Date;
  start_time: string | null;
  end_time: string | null;
  created_at: Date;

  // Relations (optional in response depending on query, but good to type)
  course?: {
    id: string;
    title: string;
  };
  teacher?: {
    id: string;
    full_name: string;
  };
}
