import { User } from './user-response.dto';

class PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

export class PaginatedUserResponseDto {
  items: User[];
  meta: PaginationMeta;
}

