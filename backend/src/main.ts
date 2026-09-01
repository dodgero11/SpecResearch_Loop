import 'dotenv/config';
import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { AppModule } from './app.module';
import { getRequiredConfig } from './config';
import { RequestIdMiddleware } from './request-id.middleware';
import { HttpExceptionFilter } from './http-exception.filter';

async function bootstrap(): Promise<void> {
  const config = getRequiredConfig();
  const app = await NestFactory.create(AppModule);
  app.enableCors({
    origin: true,
    credentials: true,
  });
  app.use(new RequestIdMiddleware().use.bind(new RequestIdMiddleware()));
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableShutdownHooks();
  await app.listen(config.PORT);
}

void bootstrap();
