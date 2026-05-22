import { PartialType } from "@nestjs/swagger";
import { CreateAirportRequestDto } from "./create-airport-request.dto";

export class UpdateAirportRequestDto extends PartialType(
  CreateAirportRequestDto,
) {}
