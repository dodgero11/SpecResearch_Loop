import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';

@Injectable()
export class InternalApiKeyGuard implements CanActivate {
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{ headers?: Record<string, string | string[] | undefined> }>();
    const apiKey = request.headers?.['x-api-key'];
    const expectedKey = process.env.INTERNAL_API_KEY?.trim() ?? 'local-dev-key';

    const provided = Array.isArray(apiKey) ? apiKey[0] : apiKey;
    if (provided === expectedKey) {
      return true;
    }

    throw new UnauthorizedException('Missing or invalid internal API key');
  }
}
