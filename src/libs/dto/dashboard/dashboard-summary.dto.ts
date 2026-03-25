export class DashboardUpcomingLessonDto {
  id: string;
  course_id: string;
  course_title: string;
  title: string;
  start_date: Date;
  end_date: Date;
}

export class DashboardSummaryDto {
  from?: Date;
  to?: Date;

  studentsTotal: number;
  studentsActive: number;
  studentsInactive: number;

  leadsTotal: number;
  leadsNew: number;
  leadsContacted: number;
  leadsConverted: number;
  leadsLost: number;

  coursesTotal: number;
  coursesActive: number;
  coursesInactive: number;

  groupsTotal: number;
  enrollmentsTotal: number;

  paymentsCount: number;
  paymentsTotalAmount: string; // Decimal as string for safety

  attendancePresent: number;
  attendanceAbsent: number;
  attendanceRate: number; // 0..100

  progressTotal: number;
  progressCompleted: number;
  progressCompletionRate: number; // 0..100

  upcomingLessons: DashboardUpcomingLessonDto[];
}
