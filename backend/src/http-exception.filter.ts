import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<{ status: (code: number) => { json: (payload: unknown) => void } }>();
    const request = ctx.getRequest<{ method: string; url: string; headers?: Record<string, string | string[] | undefined> }>();

    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const errorResponse = exception instanceof HttpException ? exception.getResponse() : { message: 'Internal server error' };
    const message = this.extractMessage(errorResponse);
    const errorName = this.normalizeErrorName(exception, status);

    response.status(status).json({
      statusCode: status,
      error: errorName,
      message,
      path: request.url,
      method: request.method,
    });
  }

  private normalizeErrorName(exception: unknown, status: number): string {
    if (exception instanceof HttpException) {
      const name = exception.name.replace(/Exception$/, '');
      return name
        .replace(/([a-z])([A-Z])/g, '$1 $2')
        .trim() || HttpStatus[status] || 'Error';
    }

    return 'Internal Server Error';
  }

  private extractMessage(payload: unknown): string | string[] {
    if (typeof payload === 'string') {
      return payload;
    }

    if (payload && typeof payload === 'object') {
      const record = payload as Record<string, unknown>;
      if (typeof record.message === 'string') {
        return record.message;
      }
      if (Array.isArray(record.message)) {
        return record.message;
      }
      if (typeof record.error === 'string') {
        return record.error;
      }
    }

    return 'Unexpected error';
  }
}
