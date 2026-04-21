import { IsArray, IsNotEmpty, IsOptional, IsString, IsUrl } from 'class-validator';

export class AddStarredAccountDto {
  @IsString()
  @IsNotEmpty()
  account!: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  ignoredRepos?: string[];

  @IsOptional()
  @IsString()
  @IsUrl({ require_tld: false })
  webhookUrl?: string;
}
