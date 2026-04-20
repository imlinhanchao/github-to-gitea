import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig, defaultConfigPath } from './config/app-config';
import { RepositorySyncEntity } from './entities/repository-sync.entity';
import { SyncTaskEntity } from './entities/sync-task.entity';
import { AppAuthGuard } from './modules/auth/auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { AppConfigModule } from './modules/config/config.module';
import { SyncModule } from './modules/sync/sync.module';

function buildTypeOrmOptions(config: AppConfig | null) {
  if (!config) {
    // In-memory SQLite fallback so the HTTP server can start and serve the web config UI
    return {
      type: 'sqlite' as const,
      database: ':memory:',
      entities: [RepositorySyncEntity, SyncTaskEntity],
      synchronize: true,
    };
  }
  return {
    type: 'mysql' as const,
    host: config.dbHost,
    port: config.dbPort,
    username: config.dbUser,
    password: config.dbPassword,
    database: config.dbDatabase,
    entities: [RepositorySyncEntity, SyncTaskEntity],
    synchronize: true,
    charset: 'utf8mb4',
    retryAttempts: 3,
    retryDelay: 3000,
  };
}

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      useFactory: () => {
        const configPath = resolve(process.cwd(), defaultConfigPath);
        if (!existsSync(configPath)) {
          return buildTypeOrmOptions(null);
        }
        try {
          const raw = require('node:fs').readFileSync(configPath, 'utf-8') as string;
          const config = JSON.parse(raw) as AppConfig;
          return buildTypeOrmOptions(config);
        } catch {
          return buildTypeOrmOptions(null);
        }
      },
    }),
    AppConfigModule,
    AuthModule,
    SyncModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: AppAuthGuard,
    },
  ],
})
export class AppModule {}
