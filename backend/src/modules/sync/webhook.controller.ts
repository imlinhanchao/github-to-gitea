import { Body, Controller, Headers, HttpCode, HttpException, HttpStatus, Post, Req } from '@nestjs/common';
import { RawBodyRequest } from '@nestjs/common';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { RuntimeConfigService } from '../../config/config.service';
import { SyncService } from './sync.service';

interface GitHubPushPayload {
  repository?: {
    full_name?: string;
  };
}

@Controller('sync/webhook')
export class WebhookController {
  constructor(
    private readonly syncService: SyncService,
    private readonly configService: RuntimeConfigService,
  ) {}

  @Post('github')
  @HttpCode(200)
  async handleGitHubWebhook(
    @Req() req: RawBodyRequest<{ rawBody?: Buffer }>,
    @Body() body: GitHubPushPayload,
    @Headers('x-hub-signature-256') signature: string | undefined,
    @Headers('x-github-event') event: string | undefined,
  ): Promise<{ ok: boolean }> {
    const config = this.configService.getConfigOrNull();
    if (config?.webhookSecret) {
      const rawBody = req.rawBody;
      if (!signature || !rawBody) {
        throw new HttpException('Missing signature', HttpStatus.UNAUTHORIZED);
      }
      const expectedSig = 'sha256=' + createHmac('sha256', config.webhookSecret).update(rawBody).digest('hex');
      const sigBuffer = Buffer.from(signature, 'utf8');
      const expectedBuffer = Buffer.from(expectedSig, 'utf8');
      if (sigBuffer.length !== expectedBuffer.length || !timingSafeEqual(sigBuffer, expectedBuffer)) {
        throw new HttpException('Invalid signature', HttpStatus.UNAUTHORIZED);
      }
    }

    if (event === 'ping') {
      return { ok: true };
    }

    if (event === 'push') {
      const fullName = body?.repository?.full_name;
      if (fullName) {
        try {
          await this.syncService.syncByFullName(fullName);
        } catch {
          // Repo not registered or app not configured — ignore silently
        }
      }
    }

    return { ok: true };
  }
}
