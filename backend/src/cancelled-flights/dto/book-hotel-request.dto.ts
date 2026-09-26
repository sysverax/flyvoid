import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsNotEmpty,
  IsString,
  IsOptional,
  ValidateNested,
  IsEmail,
  IsObject,
} from "class-validator";
import { Type } from "class-transformer";
import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class PaymentCardDto {
  @ApiProperty({ example: "John Doe", description: "Name printed on the credit card" })
  @IsNotEmpty()
  @IsString()
  cardHolderName!: string;

  @ApiProperty({ example: "VI", description: "Card brand: VI (Visa), MC (MasterCard), AX (Amex), etc." })
  @IsNotEmpty()
  @IsString()
  cardType!: string;

  @ApiProperty({ example: "4000123456789010", description: "16-digit credit card number" })
  @IsNotEmpty()
  @IsString()
  cardNumber!: string;

  @ApiProperty({ example: "1229", description: "Expiry date in MMYY format" })
  @IsNotEmpty()
  @IsString()
  expiryDate!: string;

  @ApiProperty({ example: "123", description: "Credit card security code (CVC/CVV)" })
  @IsNotEmpty()
  @IsString()
  cardCVC!: string;
}

export class ContactDataDto {
  @ApiProperty({ example: "passenger@email.com", description: "Contact email address" })
  @IsNotEmpty()
  @IsEmail()
  email!: string;

  @ApiProperty({ example: "+1234567890", description: "Contact phone number" })
  @IsNotEmpty()
  @IsString()
  phoneNumber!: string;
}

export class PaymentDataDto {
  @ApiProperty({ type: PaymentCardDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => PaymentCardDto)
  paymentCard!: PaymentCardDto;

  @ApiProperty({ type: ContactDataDto })
  @IsNotEmpty()
  @ValidateNested()
  @Type(() => ContactDataDto)
  contactData!: ContactDataDto;
}

export class BookHotelRequestDto {
  @ApiPropertyOptional({
    description:
      "Rate key for a single-room booking. Use rateKeys for several rooms; omit both to book the rooms saved on the booking's hotel allocation.",
    example: "rate-key-from-hotel-search",
  })
  @IsOptional()
  @IsNotEmpty()
  @IsString()
  rateKey?: string;

  @ApiPropertyOptional({
    description:
      "One rate key per room (must match the number of allocated rooms when the booking already has an allocation).",
    type: [String],
    example: ["rate-key-room-1", "rate-key-room-2"],
  })
  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(6)
  @IsString({ each: true })
  @IsNotEmpty({ each: true })
  rateKeys?: string[];

  @ApiPropertyOptional({ type: PaymentDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDataDto)
  paymentData?: PaymentDataDto;
}
