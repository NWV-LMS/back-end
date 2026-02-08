export interface TeacherSessionDto {
  group_id: string;
  group_name: string;
  teacher_id: string;
  start_at: string; // ISO string
  end_at: string; // ISO string
  day_of_week: number; // 1..7
  start_time: string; // HH:MM
  duration_minutes: number;
}

