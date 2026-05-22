export class TeacherResponseDto {
  id: string;
  email: string;
  full_name: string;
  phone: string;
  role: string;
  organization_id: string;
  subjects: string[];
  hourly_rate: number | null;
  salary_type: string;
  qualifications: string | null;
  bio: string | null;
  status: string;
  created_at: Date;
  updated_at: Date;
}

export class TeacherListResponseDto {
  teachers: TeacherResponseDto[];
  total: number;
}

export class TeacherGroupsResponseDto {
  groups: {
    id: string;
    name: string;
    course_title: string;
    start_date: Date;
    end_date: Date;
    student_count: number;
  }[];
}

export class TeacherScheduleResponseDto {
  schedule: {
    day_of_week: number;
    start_minute: number;
    duration_minutes: number;
    group_name: string;
    course_title: string;
  }[];
}
