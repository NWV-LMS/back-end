import {
  ArgumentsHost,
  BadRequestException,
  Catch,
  ConflictException,
  ExceptionFilter,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';

@Catch(Prisma.PrismaClientKnownRequestError, Prisma.PrismaClientValidationError)
export class PrismaExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    // Write the response to the host. Throwing here would escape the
    // request/response pipeline: NestJS invokes this filter from inside the
    // router proxy's async catch block, so a throw rejects that promise with
    // no handler — an unhandledRejection that crashes the process (Node's
    // default) or leaves the request hanging. Either way it's a DoS vector.
    const response = host.switchToHttp().getResponse<Response>();
    const httpException = this.toHttpException(exception);

    response.status(httpException.getStatus()).json(httpException.getResponse());
  }

  private toHttpException(exception: unknown): HttpException {
    // Known request errors (e.g., unique constraint, record not found).
    if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          return new ConflictException('Unique constraint violation');
        case 'P2025':
          return new NotFoundException('Record not found');
        default:
          return new BadRequestException('Database request error');
      }
    }

    // Validation errors (bad where/select/include etc).
    if (exception instanceof Prisma.PrismaClientValidationError) {
      return new BadRequestException('Database validation error');
    }

    // Fallback (should not happen because of @Catch above).
    return new InternalServerErrorException('Database error');
  }
}
