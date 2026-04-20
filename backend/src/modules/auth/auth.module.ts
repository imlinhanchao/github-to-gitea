import { Module } from '@nestjs/common';
import { AppConfigModule } from '../config/config.module';
import { AuthController } from './auth.controller';
import { AppAuthGuard } from './auth.guard';
import { AuthService } from './auth.service';

@Module({
  imports: [AppConfigModule],
  controllers: [AuthController],
  providers: [AuthService, AppAuthGuard],
  exports: [AuthService, AppAuthGuard],
})
export class AuthModule {}