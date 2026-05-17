import { ApiProperty } from "@nestjs/swagger";

export class AirlineTwoFactorSetupResponseDto {
  @ApiProperty({ example: "JBSWY3DPEHPK3PXP" })
  manualEntryKey!: string;

  @ApiProperty({
    description: "QR image as data URL for authenticator app setup",
    example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  })
  qrCodeDataUrl!: string;
}
