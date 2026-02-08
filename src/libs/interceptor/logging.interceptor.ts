import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Logger,
} from '@nestjs/common';
import { Observable, tap } from 'rxjs';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger();

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const recordTime = Date.now();
    const type = context.getType();
    if (type === 'http') {
      const req = context.switchToHttp().getRequest();
      const res = context.switchToHttp().getResponse();
      this.logger.log(`${req.method} ${req.url}`, 'REQUEST');

      return next.handle().pipe(
        tap(() => {
          const responseTime = Date.now() - recordTime;
          const statusCode = res?.statusCode;
          this.logger.log(
            `${statusCode ?? ''} - ${responseTime}ms`,
            'RESPONSE',
          );
        }),
      );
    }

    return next.handle();
  }
}
