import { BadRequestException, Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { TeacherSessionDto } from '../../libs/dto/calendar/teacher-session.dto';

function parseDateOrDefault(raw: string | undefined, fallback: Date): Date {
  if (!raw) return fallback;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) throw new BadRequestException('Invalid date');
  return d;
}

function minuteToHHMM(min: number): string {
  const hh = Math.floor(min / 60);
  const mm = min % 60;
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function isoWeekday(date: Date): number {
  // JS: 0=Sun..6=Sat -> ISO: 1=Mon..7=Sun
  const d = date.getUTCDay();
  return d === 0 ? 7 : d;
}

function addDaysUtc(date: Date, days: number): Date {
  const d = new Date(date);
  d.setUTCDate(d.getUTCDate() + days);
  return d;
}

@Injectable()
export class CalendarService {
  constructor(private readonly database: DatabaseService) {}

  async teacherCalendar(
    organizationId: string,
    teacherId: string,
    query: { from?: string; to?: string },
  ): Promise<TeacherSessionDto[]> {
    const now = new Date();
    const from = parseDateOrDefault(query.from, now);
    const to = parseDateOrDefault(query.to, addDaysUtc(now, 7));
    if (from.getTime() > to.getTime()) {
      throw new BadRequestException('from must be <= to');
    }

    // Fetch active groups overlapping the date range and their weekly schedules.
    const groups = await this.database.group.findMany({
      where: {
        organization_id: organizationId,
        teacher_id: teacherId,
        start_date: { lte: to },
        end_date: { gte: from },
      },
      select: {
        id: true,
        name: true,
        teacher_id: true,
        start_date: true,
        end_date: true,
        schedules: {
          select: { day_of_week: true, start_minute: true, duration_minutes: true },
        },
      },
    });

    const sessions: TeacherSessionDto[] = [];

    // Generate occurrences per day in [from..to].
    // This stays lightweight for a 7-31 day window.
    for (let d = new Date(Date.UTC(from.getUTCFullYear(), from.getUTCMonth(), from.getUTCDate())); d <= to; d = addDaysUtc(d, 1)) {
      const dow = isoWeekday(d);

      for (const g of groups) {
        if (d < g.start_date || d > g.end_date) continue;
        for (const s of g.schedules) {
          if (s.day_of_week !== dow) continue;
          const startAt = new Date(d);
          startAt.setUTCHours(0, 0, 0, 0);
          startAt.setUTCMinutes(s.start_minute);
          const endAt = new Date(startAt);
          endAt.setUTCMinutes(endAt.getUTCMinutes() + s.duration_minutes);

          sessions.push({
            group_id: g.id,
            group_name: g.name,
            teacher_id: g.teacher_id,
            start_at: startAt.toISOString(),
            end_at: endAt.toISOString(),
            day_of_week: s.day_of_week,
            start_time: minuteToHHMM(s.start_minute),
            duration_minutes: s.duration_minutes,
          });
        }
      }
    }

    // Sort by time.
    sessions.sort((a, b) => a.start_at.localeCompare(b.start_at));
    return sessions;
  }
}

