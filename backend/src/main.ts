import 'reflect-metadata';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { ensureConfigFile } from './config/bootstrap-config';
import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  await ensureConfigFile();
  const app = await NestFactory.create(AppModule);
  app.useGlobalPipes(new ValidationPipe({ transform: true, whitelist: true }));
  app.enableCors();
  await app.listen(3001);
}

bootstrap();
