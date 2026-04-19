import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RuntimeConfigService } from './config/config.service';
import { RepositorySyncEntity } from './entities/repository-sync.entity';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRootAsync({
      inject: [RuntimeConfigService],
      useFactory: (configService: RuntimeConfigService) => {
        const config = configService.loadConfig();
        return {
          type: 'sqlite' as const,
          database: config.dbPath,
          entities: [RepositorySyncEntity],
          synchronize: true,
        };
      },
    }),
    SyncModule,
  ],
  providers: [RuntimeConfigService],
})
export class AppModule {}
