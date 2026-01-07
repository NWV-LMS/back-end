import { StudentResponseDto } from './student-response.dto';

class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class PaginatedStudentResponseDto {
  items: StudentResponseDto[];
  meta: PaginationMeta;
}
