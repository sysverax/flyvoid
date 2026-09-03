import { IsNotEmpty, IsString, IsOptional, ValidateNested, IsEmail, IsObject } from "class-validator";
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
  @ApiProperty({
    description: "The validated unique rate key to book",
    example: "hb-12345-rate-key-xyz",
  })
  @IsNotEmpty()
  @IsString()
  rateKey!: string;

  @ApiPropertyOptional({ type: PaymentDataDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentDataDto)
  paymentData?: PaymentDataDto;
}
