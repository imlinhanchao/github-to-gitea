import { Body, Controller, Get, Headers, HttpCode, Post, Res, UnauthorizedException } from '@nestjs/common';
import { LoginDto } from '../../dto/login.dto';
import { Public } from './public.decorator';
import { AuthService, AuthStatusView } from './auth.service';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Get('status')
  @Public()
  getStatus(@Headers('cookie') cookieHeader?: string): AuthStatusView {
    return this.authService.getStatus(cookieHeader);
  }

  @Post('login')
  @Public()
  @HttpCode(200)
  login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: { setHeader(name: string, value: string): void },
  ): AuthStatusView {
    if (!this.authService.validateCredentials(dto.username, dto.password)) {
      throw new UnauthorizedException('Invalid username or password');
    }

    res.setHeader('Set-Cookie', this.authService.createLoginCookie());
    return {
      configured: true,
      authenticated: true,
      username: dto.username,
    };
  }

  @Post('logout')
  @Public()
  @HttpCode(200)
  logout(@Res({ passthrough: true }) res: { setHeader(name: string, value: string): void }): AuthStatusView {
    res.setHeader('Set-Cookie', this.authService.createLogoutCookie());
    return {
      configured: this.authService.getStatus().configured,
      authenticated: false,
      username: null,
    };
  }
}