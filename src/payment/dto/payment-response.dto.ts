// src/payment/dto/payment-response.dto.ts
export class PaymentResponseDto {
  paymentUrl?: string; // For VNPay
  clientSecret?: string | null; // For Stripe (allow null)
  transactionId: string;
  amount: number;
  currency: string;
}
