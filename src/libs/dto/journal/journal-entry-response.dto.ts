import { JournalStatus } from '@prisma/client';

export class JournalEntryResponseDto {
  id: string;
  organization_id: string;
  group_id: string;
  student_id: string;
  teacher_id: string;
  date: Date;
  status: JournalStatus;
  score: number | null;
  notes: string | null;
  student_name?: string;
  created_at: Date;
  updated_at: Date;
}

export class JournalListResponseDto {
  items: JournalEntryResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
