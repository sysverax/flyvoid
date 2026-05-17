import { Expose } from "class-transformer";
import { IsDateString, IsInt, IsString, IsUUID, Min } from "class-validator";

export class HealthLogDto {
  @Expose()
  @IsUUID()
  id!: string;

  @Expose()
  @IsDateString()
  checkedAt!: string;

  @Expose()
  @IsString()
  status!: string;

  @Expose()
  @IsInt()
  @Min(0)
  uptimeSeconds!: number;

  @Expose()
  @IsDateString()
  createdAt!: string;

  @Expose()
  @IsDateString()
  updatedAt!: string;
}
