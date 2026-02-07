import { EnrollmentResponseDto } from './enrollment-response.dto';

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export interface PaginatedEnrollmentResponseDto {
  items: EnrollmentResponseDto[];
  meta: PaginationMeta;
}
