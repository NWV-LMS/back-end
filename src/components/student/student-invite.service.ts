import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { InviteStudentDto } from '../../libs/dto/student/invite-student.dto';

export interface InviteStudentResult {
  userId: string;
  phone: string;
  role: UserRole;
  temporaryPassword: string | undefined;
}

@Injectable()
export class StudentInviteService {
  constructor(private readonly database: DatabaseService) {}

  async inviteStudent(
    studentId: string,
    organizationId: string,
    dto: InviteStudentDto,
  ): Promise<InviteStudentResult> {
    const student = await this.database.student.findFirst({
      where: { id: studentId, organization_id: organizationId },
    });

    if (!student) {
      throw new NotFoundException('Student not found');
    }

    if (student.user_id) {
      throw new BadRequestException(
        'Student already has a linked user account',
      );
    }

    const existingUser = await this.database.user.findUnique({
      where: { phone: student.phone },
    });

    // Prevent cross-tenant user linking: if a user with this phone exists
    // but belongs to a different organization, reject the request.
    if (existingUser && existingUser.organization_id !== organizationId) {
      throw new ForbiddenException(
        'A user account with this phone number belongs to another organization',
      );
    }

    const password = dto.password ?? Math.random().toString(36).slice(-10);
    const isNewUser = !existingUser;

    const user = await this.database.$transaction(async (tx) => {
      let linkedUser = existingUser;

      if (!linkedUser) {
        linkedUser = await tx.user.create({
          data: {
            organization_id: organizationId,
            full_name: student.name,
            phone: student.phone,
            email: `${student.phone.replace('+', '')}@system.local`,
            password: await bcrypt.hash(password, 10),
            role: UserRole.STUDENT,
          },
        });
      }

      await tx.student.update({
        where: { id: studentId },
        data: { user_id: linkedUser.id },
      });

      return linkedUser;
    });

    return {
      userId: user.id,
      phone: user.phone,
      role: user.role,
      temporaryPassword: isNewUser ? password : undefined,
    };
  }
}
