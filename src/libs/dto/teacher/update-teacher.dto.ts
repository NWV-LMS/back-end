import { TeacherSubject } from '../../enums/teacher-subjects.enum';

export class UpdateTeacherDto {
  full_name?: string;
  phone?: string;
  subjects?: TeacherSubject[];
  hourly_rate?: number;
  qualifications?: string;
  bio?: string;
  status?: 'ACTIVE' | 'INACTIVE' | 'ON_LEAVE';
}