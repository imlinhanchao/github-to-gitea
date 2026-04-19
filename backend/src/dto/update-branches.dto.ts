import { ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class UpdateBranchesDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  branches!: string[];
}
