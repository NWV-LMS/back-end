export class StudentResponseDto {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  phone?: string;
  created_at: Date;
}

//student haqidagi info
export class EnrollStudentDto {
  student_id: string;
}
