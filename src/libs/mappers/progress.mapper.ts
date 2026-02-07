import { ProgressResponseDto } from '../dto/progress/progress-response.dto';

export function toProgressResponse(progress: any): ProgressResponseDto {
  return {
    id: progress.id,
    organization_id: progress.organization_id,
    enrollment_id: progress.enrollment_id,
    lesson_id: progress.lesson_id,
    completed: progress.completed,
    title: progress.title,
    created_at: progress.created_at,
    updated_at: progress.updated_at,
    enrollment: progress.enrollment
      ? {
          id: progress.enrollment.id,
          student_id: progress.enrollment.student_id,
          group_id: progress.enrollment.group_id,
        }
      : undefined,
    lesson: progress.lesson
      ? {
          id: progress.lesson.id,
          title: progress.lesson.title,
          course_id: progress.lesson.course_id,
        }
      : undefined,
  };
}
