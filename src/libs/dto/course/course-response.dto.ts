import { CourseStatus } from 'generated/prisma/enums';

export class CourseResponseDto {
  id: string;
  organization_id: string;
  title: string;
  description: string | null;
  price: string;
  status: CourseStatus;
  created_at: Date;
}
