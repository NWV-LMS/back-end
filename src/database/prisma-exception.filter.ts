import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost) {
    // Known request errors (e.g., unique constraint, record not found).
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          throw new ConflictException('Unique constraint violation');
        case 'P2025':
          throw new NotFoundException('Record not found');
        default:
          throw new BadRequestException('Database request error');
      }
    }

    // Validation errors (bad where/select/include etc).
    if (exception instanceof Prisma.PrismaClientValidationError) {
      throw new BadRequestException('Database validation error');
    }

    // Fallback (should not happen because of @Catch above).
    throw new InternalServerErrorException('Database error');
  }
}
