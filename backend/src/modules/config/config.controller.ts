import { Body, Controller, Get, Post } from '@nestjs/common';
import { AppConfig } from '../../config/app-config';
import { RuntimeConfigService } from '../../config/config.service';
import { SaveConfigDto } from '../../dto/save-config.dto';

export interface ConfigView {
  githubToken: string;
  giteaToken: string;
  giteaBaseUrl: string;
  giteaAdminUsername: string;
  giteaAdminPassword: string;
  dbPath: string;
}

@Controller('config')
export class ConfigController {
  constructor(private readonly configService: RuntimeConfigService) {}

  @Get('status')
  getStatus(): { configured: boolean } {
    return { configured: this.configService.isConfigured() };
  }

  @Get()
  getConfig(): ConfigView | null {
    const config = this.configService.getConfigOrNull();
    if (!config) {
      return null;
    }
    return {
      githubToken: config.githubToken ? '***' : '',
      giteaToken: config.giteaToken ? '***' : '',
      giteaBaseUrl: config.giteaBaseUrl,
      giteaAdminUsername: config.giteaAdminUsername,
      giteaAdminPassword: config.giteaAdminPassword ? '***' : '',
      dbPath: config.dbPath,
    };
  }

  @Post()
  saveConfig(@Body() dto: SaveConfigDto): { configured: boolean } {
    const existing = this.configService.getConfigOrNull();
    const config: AppConfig = {
      githubToken: dto.githubToken === '***' && existing ? existing.githubToken : dto.githubToken,
      giteaToken: dto.giteaToken === '***' && existing ? existing.giteaToken : dto.giteaToken,
      giteaBaseUrl: dto.giteaBaseUrl,
      giteaAdminUsername: dto.giteaAdminUsername,
      giteaAdminPassword:
        dto.giteaAdminPassword === '***' && existing ? existing.giteaAdminPassword : dto.giteaAdminPassword,
      dbPath: dto.dbPath ?? existing?.dbPath ?? './data.sqlite',
    };
    this.configService.saveConfig(config);
    return { configured: true };
  }
}
