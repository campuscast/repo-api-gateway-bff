import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { AppModule } from './app.module';
import { CorrelationIdInterceptor, LoggingInterceptor, AllExceptionsFilter, initTracing } from '@campuscast/shared-libs';
import { AuthRateLimitMiddleware } from './common/auth-rate-limit.middleware';
import { CsrfProtectionMiddleware } from './common/csrf.middleware';
import type { NextFunction, Request, Response } from 'express';

initTracing('api-gateway');

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  app.useWebSocketAdapter(new WsAdapter(app));
  const authRateLimit = new AuthRateLimitMiddleware();
  const csrfProtection = new CsrfProtectionMiddleware();

  app.use((req: Request, res: Response, next: NextFunction) => authRateLimit.use(req, res, next));
  app.use((req: Request, res: Response, next: NextFunction) => csrfProtection.use(req, res, next));

  app.useGlobalPipes(new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }));
  app.useGlobalInterceptors(new CorrelationIdInterceptor(), new LoggingInterceptor());
  app.useGlobalFilters(new AllExceptionsFilter());

  const origins = (process.env.CORS_ORIGIN || 'http://localhost:3000').split(',').map(o => o.trim());
  app.enableCors({ origin: origins, credentials: true });

  const port = process.env.PORT || 3000;
  await app.listen(port);
  console.log(`[api-gateway] listening on :${port}`);
}
bootstrap();
