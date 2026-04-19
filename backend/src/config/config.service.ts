import { Injectable } from '@nestjs/common';
import { chmodSync, existsSync, readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { AppConfig, defaultConfigPath } from './app-config';

@Injectable()
export class RuntimeConfigService {
  private config?: AppConfig;

  isConfigured(configPath = defaultConfigPath): boolean {
    if (this.config) {
      return true;
    }
    const filePath = resolve(process.cwd(), configPath);
    return existsSync(filePath);
  }

  loadConfig(configPath = defaultConfigPath): AppConfig {
    if (this.config) {
      return this.config;
    }
    const filePath = resolve(process.cwd(), configPath);
    if (!existsSync(filePath)) {
      throw new Error('App is not configured yet. Please complete setup via the web UI.');
    }
    const parsed = JSON.parse(readFileSync(filePath, 'utf-8')) as AppConfig;
    this.config = parsed;
    return parsed;
  }

  getConfigOrNull(configPath = defaultConfigPath): AppConfig | null {
    if (!this.isConfigured(configPath)) {
      return null;
    }
    try {
      return this.loadConfig(configPath);
    } catch {
      return null;
    }
  }

  saveConfig(config: AppConfig, configPath = defaultConfigPath): void {
    const filePath = resolve(process.cwd(), configPath);
    writeFileSync(filePath, `${JSON.stringify(config, null, 2)}\n`, { encoding: 'utf-8', mode: 0o600 });
    try {
      chmodSync(filePath, 0o600);
    } catch {}
    this.config = config;
  }
}
