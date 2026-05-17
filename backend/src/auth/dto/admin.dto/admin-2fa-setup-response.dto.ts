import { ApiProperty } from "@nestjs/swagger";

export class AdminTwoFactorSetupResponseDto {
  @ApiProperty({
    description: "Base32 secret key for manual authenticator app setup",
    example: "JBSWY3DPEHPK3PXP",
  })
  manualEntryKey!: string;

  @ApiProperty({
    description: "QR code image as data URL for authenticator app setup",
    example: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  })
  qrCodeDataUrl!: string;
}
