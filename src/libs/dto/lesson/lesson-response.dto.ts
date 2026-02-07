export class LessonResponseDto {
  id: string;
  course_id: string;
  title: string;
  desc?: string;
  start_date: Date;
  end_date: Date;
}
