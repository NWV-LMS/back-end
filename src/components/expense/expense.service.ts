import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateExpenseDto } from '../../libs/dto/expense/create-expense.dto';
import { UpdateExpenseDto } from '../../libs/dto/expense/update-expense.dto';
import { QueryExpenseDto } from '../../libs/dto/expense/query-expense.dto';
import {
  ExpenseResponseDto,
  PaginatedExpenseResponseDto,
} from '../../libs/dto/expense/expense-response.dto';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class ExpenseService {
  constructor(private readonly database: DatabaseService) {}

  async create(
    organizationId: string,
    userId: string,
    input: CreateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.database.expense.create({
      data: {
        organization_id: organizationId,
        category: input.category,
        amount: input.amount,
        description: input.description,
        created_by: userId,
      },
      include: { creator: { select: { full_name: true } } },
    });

    return this.toResponseDto(expense);
  }

  async findAll(
    organizationId: string,
    query: QueryExpenseDto,
  ): Promise<PaginatedExpenseResponseDto> {
    const { page = 1, limit = 20, category, from, to } = query;
    const skip = (page - 1) * limit;

    const where: any = { organization_id: organizationId };
    if (category) where.category = category;
    if (from || to) {
      where.paid_at = {};
      if (from) where.paid_at.gte = new Date(from);
      if (to) where.paid_at.lte = new Date(to);
    }

    const [items, total] = await Promise.all([
      this.database.expense.findMany({
        where,
        skip,
        take: limit,
        orderBy: { paid_at: 'desc' },
        include: { creator: { select: { full_name: true } } },
      }),
      this.database.expense.count({ where }),
    ]);

    return {
      items: items.map((e) => this.toResponseDto(e)),
      meta: {
        total,
        page,
        limit,
        pages: Math.ceil(total / limit),
      },
    };
  }

  async findOne(
    organizationId: string,
    id: string,
  ): Promise<ExpenseResponseDto> {
    const expense = await this.database.expense.findFirst({
      where: { id, organization_id: organizationId },
      include: { creator: { select: { full_name: true } } },
    });

    if (!expense) {
      throw new NotFoundException('Expense not found');
    }

    return this.toResponseDto(expense);
  }

  async update(
    organizationId: string,
    id: string,
    input: UpdateExpenseDto,
  ): Promise<ExpenseResponseDto> {
    const existing = await this.database.expense.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    const updated = await this.database.expense.update({
      where: { id },
      data: {
        category: input.category,
        amount: input.amount,
        description: input.description,
      },
      include: { creator: { select: { full_name: true } } },
    });

    return this.toResponseDto(updated);
  }

  async remove(organizationId: string, id: string): Promise<void> {
    const existing = await this.database.expense.findFirst({
      where: { id, organization_id: organizationId },
    });

    if (!existing) {
      throw new NotFoundException('Expense not found');
    }

    await this.database.expense.delete({ where: { id } });
  }

  private toResponseDto(expense: any): ExpenseResponseDto {
    return {
      id: expense.id,
      organization_id: expense.organization_id,
      category: expense.category,
      amount: Number(expense.amount),
      description: expense.description,
      paid_at: expense.paid_at,
      created_by: expense.created_by,
      creator_name: expense.creator?.full_name,
      created_at: expense.created_at,
    };
  }
}
