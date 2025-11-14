// src/payment/dto/create-payment.dto.ts
import { IsEnum, IsNotEmpty, IsOptional, IsString } from 'class-validator';
import { PaymentGateway, ProductType } from '../schemas/transaction.schema';

export class CreatePaymentDto {
  @IsEnum(ProductType)
  @IsNotEmpty()
  productType: ProductType;

  @IsEnum(PaymentGateway)
  @IsNotEmpty()
  gateway: PaymentGateway;

  @IsOptional()
  @IsString()
  returnUrl?: string; // For VNPay/MoMo redirect
}
