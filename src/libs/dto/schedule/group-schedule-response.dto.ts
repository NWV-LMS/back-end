export interface GroupScheduleResponseDto {
  id: string;
  day_of_week: number; // 1..7
  start_time: string; // HH:MM
  duration_minutes: number;
}

