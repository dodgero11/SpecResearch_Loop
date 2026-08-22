import { InternalApiKeyGuard } from '../src/internal-api-key.guard';
import { getRequiredConfig } from '../src/config';

describe('Backend security hardening', () => {
  it('rejects missing or invalid internal API keys', async () => {
    const guard = new InternalApiKeyGuard();

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: {} }),
        }),
      } as never),
    ).rejects.toThrow(/Missing or invalid internal API key/);

    await expect(
      guard.canActivate({
        switchToHttp: () => ({
          getRequest: () => ({ headers: { 'x-api-key': 'wrong' } }),
        }),
      } as never),
    ).rejects.toThrow(/Missing or invalid internal API key/);

    const original = process.env.INTERNAL_API_KEY;
    process.env.INTERNAL_API_KEY = 'local-dev-key';

    try {
      await expect(
        guard.canActivate({
          switchToHttp: () => ({
            getRequest: () => ({ headers: { 'x-api-key': 'local-dev-key' } }),
          }),
        } as never),
      ).resolves.toBe(true);
    } finally {
      if (original === undefined) {
        delete process.env.INTERNAL_API_KEY;
      } else {
        process.env.INTERNAL_API_KEY = original;
      }
    }
  });

  it('requires required runtime config values', () => {
    expect(() => getRequiredConfig({ DATABASE_URL: 'postgresql://localhost/test', PORT: '3000', INTERNAL_API_KEY: 'secret' })).not.toThrow();
    expect(() => getRequiredConfig({ PORT: '3000', INTERNAL_API_KEY: 'secret' })).toThrow(/DATABASE_URL/);
    expect(() => getRequiredConfig({ DATABASE_URL: 'postgresql://localhost/test', PORT: '0', INTERNAL_API_KEY: 'secret' })).toThrow(/PORT/);
    expect(() => getRequiredConfig({ DATABASE_URL: 'postgresql://localhost/test', PORT: '3000' })).toThrow(/INTERNAL_API_KEY/);
  });
});
