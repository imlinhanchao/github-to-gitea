import { IsBoolean } from 'class-validator';

export class SetEnabledDto {
  @IsBoolean()
  enabled!: boolean;
}
