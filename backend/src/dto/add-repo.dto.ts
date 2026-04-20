import { IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class AddRepoDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;
}
