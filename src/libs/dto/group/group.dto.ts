export class CreateGroupDto {
  course_id: string;
  teacher_id: string;
  title: string;
  start_date: Date;
  end_date?: Date;
}
