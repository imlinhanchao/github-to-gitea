import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppModule } from './app.module';

function resolveStaticAssetsPath(): string {
  const candidates = [resolve(process.cwd(), 'public'), resolve(process.cwd(), 'dist/public'), resolve(__dirname, 'public')];
  return candidates.find((dir) => existsSync(dir)) ?? candidates[0];
}

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestExpressApplication>(AppModule, { rawBody: true });
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors();
  app.setGlobalPrefix('api');
  app.useStaticAssets(resolveStaticAssetsPath());
  await app.listen(3001);
}

bootstrap();
