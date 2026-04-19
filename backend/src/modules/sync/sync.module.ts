import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { RepositorySyncEntity } from '../../entities/repository-sync.entity';
import { GithubService } from '../github/github.service';
import { GiteaService } from '../gitea/gitea.service';
import { AppConfigModule } from '../config/config.module';
import { SyncController } from './sync.controller';
import { SyncService } from './sync.service';

@Module({
  imports: [TypeOrmModule.forFeature([RepositorySyncEntity]), AppConfigModule],
  controllers: [SyncController],
  providers: [SyncService, GithubService, GiteaService],
})
export class SyncModule {}
