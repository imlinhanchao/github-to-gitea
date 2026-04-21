import { IsArray, IsString } from 'class-validator';

export class UpdateIgnoredReposDto {
  @IsArray()
  @IsString({ each: true })
  ignoredRepos!: string[];
}
