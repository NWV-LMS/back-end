import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  AttendanceStatus,
  CourseStatus,
  LeadStatus,
  StudentStatus,
} from 'generated/prisma/enums';
import { DatabaseService } from '../../database/database.service';
import { QueryDashboardDto } from '../../libs/dto/dashboard/query-dashboard.dto';
import {
  DashboardSummaryDto,
  DashboardUpcomingLessonDto,
} from '../../libs/dto/dashboard/dashboard-summary.dto';
import {
  PaymentsByMethodDto,
  StatusCountDto,
} from '../../libs/dto/dashboard/dashboard-analytics.dto';

function dateRangeOrUndefined(query: QueryDashboardDto) {
  // Inclusive from, inclusive to-day. We use < toPlusOneDay to avoid timezone edge cases for date fields.
  const from = query.from ? new Date(query.from) : undefined;
  const to = query.to ? new Date(query.to) : undefined;
  return { from, to };
}

@Injectable()
export class DashboardService {
  constructor(private readonly database: DatabaseService) {}

  async getSummary(
    organizationId: string,
    query: QueryDashboardDto,
  ): Promise<DashboardSummaryDto> {
    const { from, to } = dateRangeOrUndefined(query);

    const studentsWhere: any = { organization_id: organizationId };
    const leadsWhere: any = { organization_id: organizationId };
    const coursesWhere: any = { organization_id: organizationId };
    const groupsWhere: any = { organization_id: organizationId };
    const enrollmentsWhere: any = { organization_id: organizationId };
    const paymentsWhere: any = { organization_id: organizationId };
    const attendanceWhere: any = { organization_id: organizationId };
    const progressWhere: any = { organization_id: organizationId };

    // Time filters where relevant.
    if (from || to) {
      // Most models have created_at.
      const createdAt: any = {};
      if (from) createdAt.gte = from;
      if (to) createdAt.lte = to;

      leadsWhere.created_at = createdAt;
      coursesWhere.created_at = createdAt;
      groupsWhere.created_at = createdAt;
      enrollmentsWhere.created_at = createdAt;
      progressWhere.created_at = createdAt;

      // These models have their own timestamps.
      const paidAt: any = {};
      if (from) paidAt.gte = from;
      if (to) paidAt.lte = to;
      paymentsWhere.paid_at = paidAt;

      const markedAt: any = {};
      if (from) markedAt.gte = from;
      if (to) markedAt.lte = to;
      attendanceWhere.marked_at = markedAt;
    }

    const [
      studentsTotal,
      studentsActive,
      studentsInactive,
      leadsTotal,
      leadsNew,
      leadsContacted,
      leadsConverted,
      leadsLost,
      coursesTotal,
      coursesActive,
      coursesInactive,
      groupsTotal,
      enrollmentsTotal,
      paymentsAgg,
      attendancePresent,
      attendanceAbsent,
      progressTotal,
      progressCompleted,
      upcomingLessons,
    ] = await Promise.all([
      this.database.student.count({ where: studentsWhere }),
      this.database.student.count({
        where: { ...studentsWhere, status: StudentStatus.ACTIVE },
      }),
      this.database.student.count({
        where: { ...studentsWhere, status: StudentStatus.INACTIVE },
      }),
      this.database.lead.count({ where: leadsWhere }),
      this.database.lead.count({ where: { ...leadsWhere, status: LeadStatus.NEW } }),
      this.database.lead.count({
        where: { ...leadsWhere, status: LeadStatus.CONTACTED },
      }),
      this.database.lead.count({
        where: { ...leadsWhere, status: LeadStatus.CONVERTED },
      }),
      this.database.lead.count({ where: { ...leadsWhere, status: LeadStatus.LOST } }),
      this.database.course.count({ where: coursesWhere }),
      this.database.course.count({
        where: { ...coursesWhere, status: CourseStatus.ACTIVE },
      }),
      this.database.course.count({
        where: { ...coursesWhere, status: CourseStatus.INACTIVE },
      }),
      this.database.group.count({ where: groupsWhere }),
      this.database.enrollment.count({ where: enrollmentsWhere }),
      this.database.payment.aggregate({
        where: paymentsWhere,
        _count: { _all: true },
        _sum: { amount: true },
      }),
      this.database.attendance.count({
        where: { ...attendanceWhere, status: AttendanceStatus.PRESENT },
      }),
      this.database.attendance.count({
        where: { ...attendanceWhere, status: AttendanceStatus.ABSENT },
      }),
      this.database.progress.count({ where: progressWhere }),
      this.database.progress.count({
        where: { ...progressWhere, completed: true },
      }),
      this.getUpcomingLessons(organizationId),
    ]);

    const attendanceTotal = attendancePresent + attendanceAbsent;
    const attendanceRate =
      attendanceTotal === 0 ? 0 : Math.round((attendancePresent / attendanceTotal) * 100);

    const progressCompletionRate =
      progressTotal === 0 ? 0 : Math.round((progressCompleted / progressTotal) * 100);

    const paymentsTotalAmount = paymentsAgg._sum.amount
      ? paymentsAgg._sum.amount.toString()
      : '0';

    return {
      from,
      to,
      studentsTotal,
      studentsActive,
      studentsInactive,
      leadsTotal,
      leadsNew,
      leadsContacted,
      leadsConverted,
      leadsLost,
      coursesTotal,
      coursesActive,
      coursesInactive,
      groupsTotal,
      enrollmentsTotal,
      paymentsCount: paymentsAgg._count._all,
      paymentsTotalAmount,
      attendancePresent,
      attendanceAbsent,
      attendanceRate,
      progressTotal,
      progressCompleted,
      progressCompletionRate,
      upcomingLessons,
    };
  }

  async leadsByStatus(
    organizationId: string,
    query: QueryDashboardDto,
  ): Promise<StatusCountDto[]> {
    const { from, to } = dateRangeOrUndefined(query);
    const where: any = { organization_id: organizationId };
    if (from || to) {
      const createdAt: any = {};
      if (from) createdAt.gte = from;
      if (to) createdAt.lte = to;
      where.created_at = createdAt;
    }

    // Prisma groupBy is fine here.
    const rows = await this.database.lead.groupBy({
      by: ['status'],
      where,
      _count: { _all: true },
    });

    return rows.map((r) => ({ status: r.status, count: r._count._all }));
  }

  async paymentsByMethod(
    organizationId: string,
    query: QueryDashboardDto,
  ): Promise<PaymentsByMethodDto[]> {
    const { from, to } = dateRangeOrUndefined(query);
    const where: any = { organization_id: organizationId };
    if (from || to) {
      const paidAt: any = {};
      if (from) paidAt.gte = from;
      if (to) paidAt.lte = to;
      where.paid_at = paidAt;
    }

    // `method` is a string field; groupBy works.
    const rows = await this.database.payment.groupBy({
      by: ['method'],
      where,
      _count: { _all: true },
      _sum: { amount: true },
    });

    return rows.map((r) => ({
      method: r.method ?? null,
      count: r._count._all,
      totalAmount: r._sum.amount ? r._sum.amount.toString() : '0',
    }));
  }

  async paymentsByDay(
    organizationId: string,
    query: QueryDashboardDto,
  ): Promise<{ day: string; count: number; totalAmount: string }[]> {
    const { from, to } = dateRangeOrUndefined(query);
    const fromDate = from ?? new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const toDate = to ?? new Date();

    // Use raw SQL for date bucketing (Prisma groupBy can't do date_trunc).
    const rows = await this.database.$queryRaw<
      { day: Date; count: number; total_amount: any }[]
    >(Prisma.sql`
      SELECT
        date_trunc('day', paid_at) AS day,
        COUNT(*)::int AS count,
        COALESCE(SUM(amount), 0) AS total_amount
      FROM "Payment"
      WHERE organization_id = ${organizationId}::uuid
        AND paid_at >= ${fromDate}
        AND paid_at <= ${toDate}
      GROUP BY 1
      ORDER BY 1 ASC
    `);

    return rows.map((r) => ({
      day: r.day.toISOString().slice(0, 10),
      count: r.count,
      totalAmount: r.total_amount?.toString?.() ?? String(r.total_amount ?? '0'),
    }));
  }

  private async getUpcomingLessons(
    organizationId: string,
  ): Promise<DashboardUpcomingLessonDto[]> {
    const now = new Date();
    const lessons = await this.database.lesson.findMany({
      where: {
        start_date: { gte: now },
        course: { organization_id: organizationId },
      },
      orderBy: { start_date: 'asc' },
      take: 5,
      select: {
        id: true,
        course_id: true,
        title: true,
        start_date: true,
        end_date: true,
        course: { select: { title: true } },
      },
    });

    return lessons.map((l) => ({
      id: l.id,
      course_id: l.course_id,
      course_title: l.course.title,
      title: l.title,
      start_date: l.start_date,
      end_date: l.end_date,
    }));
  }
}

