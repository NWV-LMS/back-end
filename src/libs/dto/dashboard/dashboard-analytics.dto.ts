export class StatusCountDto {
  status: string;
  count: number;
}

export class PaymentsByMethodDto {
  method: string | null;
  count: number;
  totalAmount: string;
}
