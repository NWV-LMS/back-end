import { InvoiceStatus } from '@prisma/client';

export interface InvoiceItemResponseDto {
  id: string;
  enrollment_id: string;
  group_id: string;
  group_name: string;
  course_title: string;
  amount: string; // Decimal as string
  description: string | null;
}

export interface InvoiceResponseDto {
  id: string;
  organization_id: string;
  student_id: string;
  student_name: string;
  student_phone: string;
  month: string; // YYYY-MM
  due_date: string; // YYYY-MM-DD
  status: InvoiceStatus;
  amount_due: string;
  amount_paid: string;
  debt: string;
  created_at: Date;
  updated_at: Date;
  items: InvoiceItemResponseDto[];
}

export interface PaginatedInvoiceResponseDto {
  items: InvoiceResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
