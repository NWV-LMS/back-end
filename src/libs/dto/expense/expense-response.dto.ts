import { ExpenseCategory } from 'generated/prisma/enums';

export interface ExpenseResponseDto {
  id: string;
  organization_id: string;
  category: ExpenseCategory;
  amount: number;
  description: string;
  paid_at: Date;
  created_by: string;
  creator_name?: string;
  created_at: Date;
}

export interface PaginatedExpenseResponseDto {
  items: ExpenseResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
