import { Module } from '@nestjs/common';
import { RuntimeConfigService } from '../../config/config.service';
import { ConfigController } from './config.controller';

@Module({
  controllers: [ConfigController],
  providers: [RuntimeConfigService],
  exports: [RuntimeConfigService],
})
export class AppConfigModule {}
