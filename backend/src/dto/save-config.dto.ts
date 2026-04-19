import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class SaveConfigDto {
  @IsString()
  @IsNotEmpty()
  githubToken!: string;

  @IsString()
  @IsNotEmpty()
  giteaToken!: string;

  @IsString()
  @IsNotEmpty()
  giteaBaseUrl!: string;

  @IsString()
  @IsNotEmpty()
  giteaAdminUsername!: string;

  @IsString()
  @IsNotEmpty()
  giteaAdminPassword!: string;

  @IsString()
  @IsOptional()
  dbPath?: string;
}
