import { BadRequestException, HttpStatus } from '@nestjs/common';
import { HttpExceptionFilter } from '../src/http-exception.filter';

describe('HttpExceptionFilter', () => {
  it('normalizes validation errors into a consistent payload', () => {
    const filter = new HttpExceptionFilter();
    const req = { method: 'POST', url: '/projects', headers: {} };
    const json = jest.fn();
    const status = jest.fn().mockReturnValue({ json });
    const res = { status };

    filter.catch(new BadRequestException('Invalid payload'), {
      switchToHttp: () => ({
        getRequest: () => req,
        getResponse: () => res,
      }),
    } as never);

    expect(status).toHaveBeenCalledWith(HttpStatus.BAD_REQUEST);
    expect(json).toHaveBeenCalledWith(expect.objectContaining({
      statusCode: HttpStatus.BAD_REQUEST,
      error: 'Bad Request',
      message: 'Invalid payload',
      path: '/projects',
    }));
  });
});
