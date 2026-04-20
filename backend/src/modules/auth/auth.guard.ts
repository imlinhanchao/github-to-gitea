import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { RuntimeConfigService } from '../../config/config.service';
import { IS_PUBLIC_KEY } from './auth.constants';
import { AuthService } from './auth.service';

@Injectable()
export class AppAuthGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly configService: RuntimeConfigService,
    private readonly authService: AuthService,
  ) {}

  canActivate(context: ExecutionContext): boolean {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [context.getHandler(), context.getClass()]);
    if (isPublic) {
      return true;
    }

    if (!this.configService.isConfigured()) {
      return true;
    }

    const request = context.switchToHttp().getRequest<{ headers?: { cookie?: string } }>();
    if (this.authService.isAuthenticated(request.headers?.cookie)) {
      return true;
    }

    throw new UnauthorizedException('Authentication required');
  }
}