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
	  console.log(req)
      this.logger.log(`${req.method} ${req.url}`, 'REQUEST');

      return next.handle().pipe(
        tap((data) => {
          const responseTime = Date.now() - recordTime;
          this.logger.log(
            `${this.stringify(data)} - ${responseTime}ms`,
            'RESPONSE',
          );
        }),
      );
    }

    return next.handle();
  }

  private stringify(data: any): string {
    try {
      return JSON.stringify(data, (key, value) => {
        const sensitiveKeys = [
          'accessToken',
          'access_token',
          'refreshToken',
          'refresh_token',
          'token',
		  'id'
        ];
        return sensitiveKeys.includes(key) ? undefined : value;
      }).slice(50, 150);
    } catch (e) {
      return '[Circular or Unserializable]';
    }
  }
}
