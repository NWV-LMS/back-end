import { PaymentMethod, PaymentStatus } from 'generated/prisma/enums';

export interface PaymentResponseDto {
  id: string;
  organization_id: string;
  student_id: string;
  student_name?: string;
  amount: number;
  method: PaymentMethod;
  status: PaymentStatus;
  description: string | null;
  paid_at: Date;
  created_at: Date;
}

export interface PaginatedPaymentResponseDto {
  items: PaymentResponseDto[];
  meta: {
    total: number;
    page: number;
    limit: number;
    pages: number;
  };
}
