import { HealthController } from '../src/health.controller';
import { RequestIdMiddleware } from '../src/request-id.middleware';

describe('Backend diagnostics', () => {
  it('adds a correlation id header to each request', () => {
    const middleware = new RequestIdMiddleware();
    const req = { headers: {} } as any;
    const res = { setHeader: jest.fn(), on: jest.fn() } as any;
    const next = jest.fn();

    middleware.use(req, res, next);

    expect(res.setHeader).toHaveBeenCalledWith('x-request-id', expect.any(String));
    expect(req.id).toBeTruthy();
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('reports dependency status in the health payload', async () => {
    const prisma = { $queryRaw: jest.fn().mockResolvedValue([{ '?column?': 1 }]) };
    const controller = new HealthController(prisma as never);

    await expect(controller.check()).resolves.toEqual(expect.objectContaining({
      status: 'ok',
      database: 'ok',
      dependencies: expect.objectContaining({ database: 'ok' }),
    }));
  });
});
