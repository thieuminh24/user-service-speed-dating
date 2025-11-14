// src/payment/services/vnpay.service.ts
import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import { Transaction } from '../schemas/transaction.schema';
import { ProductConfig } from '../payment.config';
import { PaymentResponseDto } from '../dto/payment-response.dto';

@Injectable()
export class VNPayService {
  private tmnCode: string;
  private hashSecret: string;
  private url: string;
  private returnUrl: string;

  constructor(private configService: ConfigService) {
    this.tmnCode = this.configService.get<string>('VNPAY_TMN_CODE') || '';
    this.hashSecret = this.configService.get<string>('VNPAY_HASH_SECRET') || '';
    this.url = this.configService.get<string>('VNPAY_URL') || '';
    this.returnUrl = this.configService.get<string>('VNPAY_RETURN_URL') || '';

    if (!this.tmnCode || !this.hashSecret || !this.url) {
      throw new Error('VNPay configuration is incomplete');
    }
  }

  createPaymentUrl(
    transaction: Transaction,
    productConfig: ProductConfig,
    customReturnUrl?: string,
  ): PaymentResponseDto {
    const date = new Date();
    const createDate = this.formatDate(date);
    const orderId = transaction.transactionId;
    const amount = transaction.amount;
    const orderInfo = productConfig.nameVi;
    const locale = 'vn';
    const currCode = 'VND';
    const ipAddr = '127.0.0.1';

    let vnp_Params: any = {
      vnp_Version: '2.1.0',
      vnp_Command: 'pay',
      vnp_TmnCode: this.tmnCode,
      vnp_Locale: locale,
      vnp_CurrCode: currCode,
      vnp_TxnRef: orderId,
      vnp_OrderInfo: orderInfo,
      vnp_OrderType: 'other',
      vnp_Amount: amount * 100, // VNPay yêu cầu nhân 100
      vnp_ReturnUrl: customReturnUrl || this.returnUrl,
      vnp_IpAddr: ipAddr,
      vnp_CreateDate: createDate,
    };

    // Sort params
    vnp_Params = this.sortObject(vnp_Params);

    const signData = new URLSearchParams(vnp_Params).toString();
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
    vnp_Params['vnp_SecureHash'] = signed;

    const paymentUrl =
      this.url + '?' + new URLSearchParams(vnp_Params).toString();

    return {
      paymentUrl,
      transactionId: transaction.transactionId,
      amount: transaction.amount,
      currency: 'VND',
    };
  }

  verifyReturnUrl(vnpParams: any): {
    isValid: boolean;
    transactionId?: string;
  } {
    const secureHash = vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHash'];
    delete vnpParams['vnp_SecureHashType'];

    const sortedParams = this.sortObject(vnpParams);
    const signData = new URLSearchParams(sortedParams).toString();
    const hmac = crypto.createHmac('sha512', this.hashSecret);
    const signed = hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');

    if (secureHash === signed) {
      const responseCode = vnpParams['vnp_ResponseCode'];
      const transactionId = vnpParams['vnp_TxnRef'];

      return {
        isValid: responseCode === '00',
        transactionId,
      };
    }

    return { isValid: false };
  }

  private formatDate(date: Date): string {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = String(date.getHours()).padStart(2, '0');
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const seconds = String(date.getSeconds()).padStart(2, '0');
    return `${year}${month}${day}${hours}${minutes}${seconds}`;
  }

  private sortObject(obj: any) {
    const sorted: any = {};
    const keys = Object.keys(obj).sort();
    keys.forEach((key) => {
      sorted[key] = obj[key];
    });
    return sorted;
  }
}
