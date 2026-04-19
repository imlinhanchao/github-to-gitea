import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositorySyncEntity } from '../../entities/repository-sync.entity';
import { SyncTaskEntity } from '../../entities/sync-task.entity';
import { GithubService } from '../github/github.service';
import { GiteaService } from '../gitea/gitea.service';
import { AppConfigModule } from '../config/config.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';
import { SyncQueueService } from './sync-queue.service';
import { WebhookController } from './webhook.controller';

@Module({
  imports: [TypeOrmModule.forFeature([RepositorySyncEntity, SyncTaskEntity]), AppConfigModule],
  controllers: [SyncController, WebhookController],
  providers: [SyncService, SyncQueueService, GithubService, GiteaService],
})
export class SyncModule {}
