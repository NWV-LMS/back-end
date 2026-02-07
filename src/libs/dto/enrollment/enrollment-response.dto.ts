export interface GroupSummary {
  id: string;
  name: string;
  course?: {
    id: string;
    title: string;
  };
  teacher?: {
    id: string;
    full_name: string;
  };
}

export interface StudentSummary {
  id: string;
  name: string;
  phone: string;
  status: string;
}

export interface EnrollmentResponseDto {
  id: string;
  student_id: string;
  group_id: string;
  enrolled_at: Date;
  student?: StudentSummary;
  group?: GroupSummary;
}

export interface CreateEnrollmentResponseDto {
  message: string;
  enrollment: EnrollmentResponseDto;
}

export interface DeleteEnrollmentResponseDto {
  message: string;
  deletedId: string;
}
