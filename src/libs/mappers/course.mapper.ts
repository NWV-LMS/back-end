import { Course } from 'generated/prisma/client';
import { CourseResponseDto } from '../dto/course/course-response.dto';

// DB entity -> API response DTO mapper.
export const toCourseResponse = (course: Course): CourseResponseDto => ({
  id: course.id,
  organization_id: course.organization_id,
  title: course.title,
  description: course.description,
  price: course.price,
  status: course.status,
  created_at: course.created_at,
});
