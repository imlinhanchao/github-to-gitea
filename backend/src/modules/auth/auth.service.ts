import { Injectable } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { AppConfig } from '../../config/app-config';
import { RuntimeConfigService } from '../../config/config.service';
import { AUTH_COOKIE_NAME, AUTH_SESSION_TTL_SECONDS } from './auth.constants';

export interface AuthStatusView {
  configured: boolean;
  authenticated: boolean;
  username: string | null;
}

interface SessionPayload {
  username: string;
  issuedAt: number;
}

@Injectable()
export class AuthService {
  constructor(private readonly configService: RuntimeConfigService) {}

  getStatus(cookieHeader?: string): AuthStatusView {
    const config = this.configService.getConfigOrNull();
    if (!config) {
      return { configured: false, authenticated: false, username: null };
    }

    const payload = this.getSessionPayload(cookieHeader, config);
    return {
      configured: true,
      authenticated: payload !== null,
      username: payload?.username ?? null,
    };
  }

  validateCredentials(username: string, password: string): boolean {
    const config = this.configService.getConfigOrNull();
    if (!config) {
      return false;
    }
    return username === config.giteaAdminUsername && password === config.giteaAdminPassword;
  }

  isAuthenticated(cookieHeader?: string): boolean {
    const config = this.configService.getConfigOrNull();
    if (!config) {
      return false;
    }
    return this.getSessionPayload(cookieHeader, config) !== null;
  }

  createLoginCookie(): string {
    const config = this.configService.loadConfig();
    const payload: SessionPayload = {
      username: config.giteaAdminUsername,
      issuedAt: Date.now(),
    };
    const token = this.signPayload(payload, config);
    return this.serializeCookie(token, AUTH_SESSION_TTL_SECONDS);
  }

  createLogoutCookie(): string {
    return `${AUTH_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`;
  }

  private getSessionPayload(cookieHeader: string | undefined, config: AppConfig): SessionPayload | null {
    const token = this.readCookie(cookieHeader, AUTH_COOKIE_NAME);
    if (!token) {
      return null;
    }

    const parts = token.split('.');
    if (parts.length !== 2) {
      return null;
    }

    const [encodedPayload, providedSignature] = parts;
    const expectedSignature = this.sign(encodedPayload, config);
    const providedBuffer = Buffer.from(providedSignature, 'utf8');
    const expectedBuffer = Buffer.from(expectedSignature, 'utf8');
    if (providedBuffer.length !== expectedBuffer.length || !timingSafeEqual(providedBuffer, expectedBuffer)) {
      return null;
    }

    try {
      const payload = JSON.parse(Buffer.from(encodedPayload, 'base64url').toString('utf8')) as SessionPayload;
      if (payload.username !== config.giteaAdminUsername) {
        return null;
      }
      if (Date.now() - payload.issuedAt > AUTH_SESSION_TTL_SECONDS * 1000) {
        return null;
      }
      return payload;
    } catch {
      return null;
    }
  }

  private signPayload(payload: SessionPayload, config: AppConfig): string {
    const encodedPayload = Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url');
    return `${encodedPayload}.${this.sign(encodedPayload, config)}`;
  }

  private sign(value: string, config: AppConfig): string {
    return createHmac('sha256', this.buildSecret(config)).update(value).digest('base64url');
  }

  private buildSecret(config: AppConfig): string {
    return ['github-to-gitea-admin-auth', config.giteaAdminUsername, config.giteaAdminPassword, config.webhookSecret ?? ''].join(':');
  }

  private serializeCookie(value: string, maxAge: number): string {
    return `${AUTH_COOKIE_NAME}=${encodeURIComponent(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${maxAge}`;
  }

  private readCookie(cookieHeader: string | undefined, name: string): string | null {
    if (!cookieHeader) {
      return null;
    }
    const entries = cookieHeader.split(';');
    for (const entry of entries) {
      const [rawName, ...rest] = entry.trim().split('=');
      if (rawName === name) {
        return decodeURIComponent(rest.join('='));
      }
    }
    return null;
  }
}