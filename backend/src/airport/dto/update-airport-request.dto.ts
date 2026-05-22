import { BadRequestException } from "@nestjs/common";
import { PartialType } from "@nestjs/swagger";
import { CreateAirportRequestDto } from "./create-airport-request.dto";

export class UpdateAirportRequestDto extends PartialType(
  CreateAirportRequestDto,
) {
  static validateForUpdate(dto: UpdateAirportRequestDto): void {
    const raw = dto as Record<string, unknown>;
    const keys = Object.keys(raw);

    if (keys.length === 0) {
      throw new BadRequestException(
        "At least one field must be provided for update",
      );
    }

    for (const key of keys) {
      if (raw[key] === null && key !== "address") {
        throw new BadRequestException(`${key} must not be null`);
      }
    }

    if (Object.prototype.hasOwnProperty.call(raw, "postalCode")) {
      const postalCode = raw.postalCode;
      if (typeof postalCode !== "string" || postalCode.trim().length === 0) {
        throw new BadRequestException("postalCode should not be empty");
      }
    }
  }
}
