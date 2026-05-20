import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { SalaryType, SalaryStatus, ExpenseCategory } from '@prisma/client';
import { Decimal } from '@prisma/client/runtime/library';

@Injectable()
export class TeacherSalaryService {
  constructor(private readonly db: DatabaseService) {}

  /**
   * Calculate salary for a teacher for a given month (YYYY-MM).
   * Does NOT save — returns computed amount + breakdown.
   */
  async calculate(teacherId: string, organizationId: string, period: string) {
    const [year, month] = period.split('-').map(Number);
    const startDate = new Date(year, month - 1, 1);
    const endDate = new Date(year, month, 1); // exclusive

    const teacher = await this.db.user.findFirst({
      where: { id: teacherId, organization_id: organizationId, role: 'TEACHER' },
      include: { teacherProfile: true },
    });
    if (!teacher || !teacher.teacherProfile) throw new NotFoundException('Teacher not found');

    const profile = teacher.teacherProfile;
    const salaryType = profile.salary_type;

    let amount = new Decimal(0);
    let breakdown: Record<string, unknown> = {};

    if (salaryType === SalaryType.HOURLY) {
      // Count distinct (group_id, date) — each unique group+date = 1 lesson
      const entries = await this.db.journalEntry.findMany({
        where: {
          teacher_id: teacherId,
          organization_id: organizationId,
          date: { gte: startDate, lt: endDate },
        },
        select: { group_id: true, date: true },
        distinct: ['group_id', 'date'],
      });
      const lessonCount = entries.length;
      const rate = profile.hourly_rate ?? new Decimal(0);
      amount = new Decimal(lessonCount).mul(rate);
      breakdown = {
        salary_type: 'HOURLY',
        lesson_count: lessonCount,
        hourly_rate: Number(rate),
        amount: Number(amount),
      };
    } else if (salaryType === SalaryType.FIXED) {
      amount = profile.fixed_salary ?? new Decimal(0);
      breakdown = {
        salary_type: 'FIXED',
        fixed_salary: Number(amount),
        amount: Number(amount),
      };
    } else if (salaryType === SalaryType.GROUP_PERCENT) {
      // Sum completed payments from students enrolled in this teacher's groups in this month
      const payments = await this.db.payment.findMany({
        where: {
          organization_id: organizationId,
          status: 'COMPLETED',
          paid_at: { gte: startDate, lt: endDate },
          student: {
            enrollments: {
              some: {
                group: { teacher_id: teacherId },
              },
            },
          },
        },
        select: { amount: true },
      });
      const totalPayments = payments.reduce(
        (sum, p) => sum.add(p.amount),
        new Decimal(0),
      );
      const rate = profile.percent_rate ?? new Decimal(0);
      amount = totalPayments.mul(rate).div(100);
      breakdown = {
        salary_type: 'GROUP_PERCENT',
        total_student_payments: Number(totalPayments),
        percent_rate: Number(rate),
        payment_count: payments.length,
        amount: Number(amount),
      };
    } else {
      // MONTHLY/DAILY legacy — use fixed_salary or hourly_rate
      amount = profile.fixed_salary ?? profile.hourly_rate ?? new Decimal(0);
      breakdown = { salary_type: salaryType, amount: Number(amount) };
    }

    return {
      teacher_id: teacherId,
      period,
      salary_type: salaryType,
      amount: Number(amount),
      breakdown,
    };
  }

  /**
   * Get salary payment history for a teacher
   */
  async getHistory(teacherId: string, organizationId: string) {
    const records = await this.db.teacherSalary.findMany({
      where: { teacher_id: teacherId, organization_id: organizationId },
      orderBy: { period: 'desc' },
    });
    return records.map((r) => ({
      ...r,
      amount: Number(r.amount),
    }));
  }

  /**
   * Mark salary as PAID: snapshot TeacherSalary + create Expense
   */
  async markPaid(
    teacherId: string,
    organizationId: string,
    period: string,
    paidBy: string,
  ) {
    const existing = await this.db.teacherSalary.findUnique({
      where: { teacher_id_period: { teacher_id: teacherId, period } },
    });
    if (existing?.status === SalaryStatus.PAID) {
      throw new ConflictException(`Salary for ${period} already paid`);
    }

    const calculated = await this.calculate(teacherId, organizationId, period);

    const teacher = await this.db.user.findUnique({
      where: { id: teacherId },
      select: { full_name: true },
    });

    return this.db.$transaction(async (tx) => {
      const expense = await tx.expense.create({
        data: {
          organization_id: organizationId,
          category: ExpenseCategory.SALARY,
          amount: calculated.amount,
          description: `O'qituvchi maoshi: ${teacher?.full_name} — ${period}`,
          paid_at: new Date(),
          created_by: paidBy,
        },
      });

      const record = await tx.teacherSalary.upsert({
        where: { teacher_id_period: { teacher_id: teacherId, period } },
        create: {
          organization_id: organizationId,
          teacher_id: teacherId,
          period,
          salary_type: calculated.salary_type as SalaryType,
          amount: calculated.amount,
          breakdown: calculated.breakdown as object,
          status: SalaryStatus.PAID,
          paid_at: new Date(),
          expense_id: expense.id,
        },
        update: {
          salary_type: calculated.salary_type as SalaryType,
          amount: calculated.amount,
          breakdown: calculated.breakdown as object,
          status: SalaryStatus.PAID,
          paid_at: new Date(),
          expense_id: expense.id,
        },
      });

      return { ...record, amount: Number(record.amount) };
    });
  }
}
