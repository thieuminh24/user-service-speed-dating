// src/payment/dto/vnpay-return.dto.ts
import { IsNotEmpty, IsString } from 'class-validator';

export class VNPayReturnDto {
  @IsString()
  @IsNotEmpty()
  vnp_TmnCode: string;

  @IsString()
  @IsNotEmpty()
  vnp_Amount: string;

  @IsString()
  @IsNotEmpty()
  vnp_BankCode: string;

  @IsString()
  @IsNotEmpty()
  vnp_OrderInfo: string;

  @IsString()
  @IsNotEmpty()
  vnp_ResponseCode: string;

  @IsString()
  @IsNotEmpty()
  vnp_TransactionNo: string;

  @IsString()
  @IsNotEmpty()
  vnp_TxnRef: string;

  @IsString()
  @IsNotEmpty()
  vnp_SecureHash: string;
}
