import { IsInt, IsNotEmpty, IsOptional, IsString, Max, Min } from 'class-validator';

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
  dbHost?: string;

  @IsInt()
  @Min(1)
  @Max(65535)
  @IsOptional()
  dbPort?: number;

  @IsString()
  @IsOptional()
  dbUser?: string;

  @IsString()
  @IsOptional()
  dbPassword?: string;

  @IsString()
  @IsOptional()
  dbDatabase?: string;
}
