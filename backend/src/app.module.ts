import { Module } from '@nestjs/common';
import { ScheduleModule } from '@nestjs/schedule';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositorySyncEntity } from './entities/repository-sync.entity';
import { AppConfigModule } from './modules/config/config.module';
import { SyncModule } from './modules/sync/sync.module';

@Module({
  imports: [
    ScheduleModule.forRoot(),
    TypeOrmModule.forRoot({
      type: 'sqlite',
      database: './data.sqlite',
      entities: [RepositorySyncEntity],
      synchronize: true,
    }),
    AppConfigModule,
    SyncModule,
  ],
})
export class AppModule {}
