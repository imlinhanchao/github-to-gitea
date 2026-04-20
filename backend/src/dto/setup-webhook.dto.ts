import { IsString, IsUrl } from 'class-validator';

export class SetupWebhookDto {
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl!: string;
}
