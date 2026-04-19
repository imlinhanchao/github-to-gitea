import { IsNotEmpty, IsString } from 'class-validator';

export class AddRepoDto {
  @IsString()
  @IsNotEmpty()
  fullName!: string;
}
