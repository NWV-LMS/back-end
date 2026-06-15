import { ArgumentsHost, HttpStatus } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaExceptionFilter } from './prisma-exception.filter';

function mockHost() {
  const json = jest.fn();
  const status = jest.fn(() => ({ json }));
  const response = { status, json };
  const host = {
    switchToHttp: () => ({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, status, json };
}

describe('PrismaExceptionFilter', () => {
  const filter = new PrismaExceptionFilter();

  const knownError = (code: string) =>
    new Prisma.PrismaClientKnownRequestError('boom', {
      code,
      clientVersion: '5.22.0',
    });

  it('maps P2002 (unique constraint) to 409 without throwing', () => {
    const { host, status, json } = mockHost();

    expect(() => filter.catch(knownError('P2002'), host)).not.toThrow();

    expect(status).toHaveBeenCalledWith(HttpStatus.CONFLICT);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.CONFLICT,
        message: 'Unique constraint violation',
      }),
    );
  });

  it('maps P2025 (record not found) to 404 without throwing', () => {
    const { host, status, json } = mockHost();

    expect(() => filter.catch(knownError('P2025'), host)).not.toThrow();

    expect(status).toHaveBeenCalledWith(HttpStatus.NOT_FOUND);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.NOT_FOUND,
        message: 'Record not found',
      }),
    );
  });

  it('maps unrecognized known-request codes to 400 without throwing', () => {
    const { host, status, json } = mockHost();

    expect(() => filter.catch(knownError('P2003'), host)).not.toThrow();

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database request error',
      }),
    );
  });

  it('maps validation errors to 400 without throwing', () => {
    const { host, status, json } = mockHost();
    const validationError = new Prisma.PrismaClientValidationError('bad args', {
      clientVersion: '5.22.0',
    });

    expect(() => filter.catch(validationError, host)).not.toThrow();

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(
      expect.objectContaining({
        statusCode: HttpStatus.BAD_REQUEST,
        message: 'Database validation error',
      }),
    );
  });
});
