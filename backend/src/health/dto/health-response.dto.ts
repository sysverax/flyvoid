import { Expose, Transform } from "class-transformer";
import { IsInt, IsISO8601, IsString, Min } from "class-validator";

export class HealthResponseDto {
  @Expose()
  @IsString()
  status!: string;

  @Expose()
  @IsISO8601()
  timestamp!: string;

  @Expose()
  @IsInt()
  @Min(0)
  @Transform(({ value }) => Math.floor(Number(value)))
  uptimeSeconds!: number;

  @Expose()
  @IsString()
  version!: string;
}
