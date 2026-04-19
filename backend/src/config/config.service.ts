import { Injectable } from '@nestjs/common';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig, defaultConfigPath } from './app-config';

@Injectable()
export class RuntimeConfigService {
  private config?: AppConfig;

  loadConfig(configPath = defaultConfigPath): AppConfig {
    if (this.config) {
      return this.config;
    }
    const filePath = resolve(process.cwd(), configPath);
    if (!existsSync(filePath)) {
      throw new Error(`Missing config file: ${filePath}`);
    }
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as AppConfig;
    this.config = parsed;
    return parsed;
  }
}
