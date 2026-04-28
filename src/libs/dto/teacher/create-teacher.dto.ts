import { TeacherSubject } from '../../enums/teacher-subjects.enum';

export class CreateTeacherDto {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  organization_id: string;
  subjects: TeacherSubject[];
  hourly_rate?: number;
  qualifications?: string;
  bio?: string;
}