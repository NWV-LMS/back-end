export interface FinanceSummaryDto {
  totalIncome: number;
  totalExpenses: number;
  profit: number;
  paymentCount: number;
  expenseCount: number;
  period: {
    from: string;
    to: string;
  };
}

export interface IncomeByMethodDto {
  method: string;
  total: number;
  count: number;
}

export interface ExpenseByCategoryDto {
  category: string;
  total: number;
  count: number;
}

export interface FinanceReportDto {
  summary: FinanceSummaryDto;
  incomeByMethod: IncomeByMethodDto[];
  expenseByCategory: ExpenseByCategoryDto[];
}
