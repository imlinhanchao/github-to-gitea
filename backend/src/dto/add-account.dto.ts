import { IsNotEmpty, IsString } from 'class-validator';

export class AddAccountDto {
  @IsString()
  @IsNotEmpty()
  account!: string;
}
