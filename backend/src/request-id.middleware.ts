import { NextFunction, Request, Response } from 'express';

export class RequestIdMiddleware {
  use(req: Request & { id?: string }, res: Response, next: NextFunction): void {
    const requestId = req.headers['x-request-id'] ?? `req-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    req.id = Array.isArray(requestId) ? requestId[0] : requestId;
    res.setHeader('x-request-id', req.id);
    next();
  }
}
