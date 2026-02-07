export class ProgressResponseDto {
  id: string;
  organization_id: string;
  enrollment_id: string;
  lesson_id: string;
  completed: boolean;
  title: string;
  created_at: Date;
  updated_at: Date;

  // Related data
  enrollment?: {
    id: string;
    student_id: string;
    group_id: string;
  };

  lesson?: {
    id: string;
    title: string;
    course_id: string;
  };
}
