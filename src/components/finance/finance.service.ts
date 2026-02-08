import { Injectable } from '@nestjs/common';
import { PaymentStatus } from '@prisma/client';
import { FinanceQueryDto } from '../../libs/dto/finance/finance-query.dto';
import {
  FinanceSummaryDto,
  FinanceReportDto,
  IncomeByMethodDto,
  ExpenseByCategoryDto,
} from '../../libs/dto/finance/finance-summary.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class FinanceService {
  constructor(private readonly database: DatabaseService) {}

  async getSummary(
    organizationId: string,
    query: FinanceQueryDto,
  ): Promise<FinanceSummaryDto> {
    const { from, to } = this.getDateRange(query);
    const dateFilter = this.buildDateFilter(from, to);

    const [incomeResult, expenseResult, paymentCount, expenseCount] =
      await Promise.all([
        this.database.payment.aggregate({
          where: {
            organization_id: organizationId,
            status: PaymentStatus.COMPLETED,
            paid_at: dateFilter,
          },
          _sum: { amount: true },
        }),
        this.database.expense.aggregate({
          where: {
            organization_id: organizationId,
            paid_at: dateFilter,
          },
          _sum: { amount: true },
        }),
        this.database.payment.count({
          where: {
            organization_id: organizationId,
            status: PaymentStatus.COMPLETED,
            paid_at: dateFilter,
          },
        }),
        this.database.expense.count({
          where: {
            organization_id: organizationId,
            paid_at: dateFilter,
          },
        }),
      ]);

    const totalIncome = Number(incomeResult._sum.amount ?? 0);
    const totalExpenses = Number(expenseResult._sum.amount ?? 0);

    return {
      totalIncome,
      totalExpenses,
      profit: totalIncome - totalExpenses,
      paymentCount,
      expenseCount,
      period: {
        from: from.toISOString().split('T')[0],
        to: to.toISOString().split('T')[0],
      },
    };
  }

  async getReport(
    organizationId: string,
    query: FinanceQueryDto,
  ): Promise<FinanceReportDto> {
    const { from, to } = this.getDateRange(query);
    const dateFilter = this.buildDateFilter(from, to);

    const [summary, incomeByMethod, expenseByCategory] = await Promise.all([
      this.getSummary(organizationId, query),
      this.getIncomeByMethod(organizationId, dateFilter),
      this.getExpenseByCategory(organizationId, dateFilter),
    ]);

    return {
      summary,
      incomeByMethod,
      expenseByCategory,
    };
  }

  private async getIncomeByMethod(
    organizationId: string,
    dateFilter: any,
  ): Promise<IncomeByMethodDto[]> {
    const result = await this.database.payment.groupBy({
      by: ['method'],
      where: {
        organization_id: organizationId,
        status: PaymentStatus.COMPLETED,
        paid_at: dateFilter,
      },
      _sum: { amount: true },
      _count: true,
    });

    return result.map((r) => ({
      method: r.method,
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));
  }

  private async getExpenseByCategory(
    organizationId: string,
    dateFilter: any,
  ): Promise<ExpenseByCategoryDto[]> {
    const result = await this.database.expense.groupBy({
      by: ['category'],
      where: {
        organization_id: organizationId,
        paid_at: dateFilter,
      },
      _sum: { amount: true },
      _count: true,
    });

    return result.map((r) => ({
      category: r.category,
      total: Number(r._sum.amount ?? 0),
      count: r._count,
    }));
  }

  private getDateRange(query: FinanceQueryDto): { from: Date; to: Date } {
    const now = new Date();
    const from = query.from ? new Date(query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
    const to = query.to ? new Date(query.to) : now;
    return { from, to };
  }

  private buildDateFilter(from: Date, to: Date): any {
    return { gte: from, lte: to };
  }
}
