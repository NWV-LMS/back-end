import { Injectable } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import * as bcrypt from 'bcrypt';
import { CreateTeacherDto } from '../../libs/dto/teacher';

@Injectable()
export class TeacherBulkService {
  constructor(private readonly prisma: DatabaseService) {}

  /**
   * Bulk create teachers
   */
  async bulkCreate(organizationId: string, teachers: CreateTeacherDto[]) {
    let createdCount = 0;

    // Optimization: Pre-hash passwords in parallel
    const hashedTeachers = await Promise.all(
      teachers.map(async (t) => {
        const password = t.password ?? Math.random().toString(36).slice(-10);
        const hashed = await bcrypt.hash(password, 10);
        return { ...t, password, hashed };
      }),
    );

    await this.prisma.$transaction(async (tx) => {
      for (const t of hashedTeachers) {
        // Check if email already exists
        const existingUser = await tx.user.findFirst({
          where: {
            organization_id: organizationId,
            email: t.email,
          },
        });

        if (existingUser) continue;

        // Check if phone already exists
        const existingPhone = await tx.user.findUnique({
          where: { phone: t.phone },
        });

        if (existingPhone) continue;

        // Create user
        const user = await tx.user.create({
          data: {
            email: t.email,
            password: t.hashed,
            full_name: t.full_name,
            phone: t.phone,
            role: 'TEACHER',
            organization_id: organizationId,
          },
        });

        // Create profile
        await tx.teacherProfile.create({
          data: {
            user_id: user.id,
            subjects: t.subjects,
            hourly_rate: t.hourly_rate,
            qualifications: t.qualifications,
            bio: t.bio,
            status: 'ACTIVE',
          },
        });

        createdCount++;
      }
    });

    return { count: createdCount };
  }
}
