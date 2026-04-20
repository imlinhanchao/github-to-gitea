import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class AddAccountDto {
  @IsString()
  @IsNotEmpty()
  account!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;
}
