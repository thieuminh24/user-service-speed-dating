// src/payment/payment.config.ts
import { ProductType } from './schemas/transaction.schema';

export interface ProductConfig {
  name: string;
  nameVi: string;
  price: number; // VND
  priceUSD: number; // USD (in cents for Stripe)
  duration?: number; // days (for subscriptions)
  features: string[];
}

export const PRODUCT_CONFIGS: Record<ProductType, ProductConfig> = {
  [ProductType.PREMIUM_MONTHLY]: {
    name: 'Premium Monthly',
    nameVi: 'Premium 1 Tháng',
    price: 99000, // 99k VND
    priceUSD: 499, // $4.99
    duration: 30,
    features: [
      'Unlimited likes',
      '5 Super Likes/day',
      'See who liked you',
      'Rewind last swipe',
      '1 free Boost/month',
    ],
  },
  [ProductType.PREMIUM_YEARLY]: {
    name: 'Premium Yearly',
    nameVi: 'Premium 1 Năm',
    price: 999000, // 999k VND (save 17%)
    priceUSD: 4999, // $49.99
    duration: 365,
    features: ['All Premium Monthly features', 'Save 17%', 'Priority support'],
  },
  [ProductType.VIP_MONTHLY]: {
    name: 'VIP Monthly',
    nameVi: 'VIP 1 Tháng',
    price: 199000, // 199k VND
    priceUSD: 999, // $9.99
    duration: 30,
    features: [
      'All Premium features',
      'Unlimited Super Likes',
      '2 free Boosts/month',
      'Advanced filters',
      'Incognito mode',
      'Read receipts',
    ],
  },
  [ProductType.VIP_YEARLY]: {
    name: 'VIP Yearly',
    nameVi: 'VIP 1 Năm',
    price: 1990000, // 1.99M VND (save 17%)
    priceUSD: 9999, // $99.99
    duration: 365,
    features: [
      'All VIP Monthly features',
      'Save 17%',
      'VIP badge',
      'Premium support',
    ],
  },
  [ProductType.SUPER_LIKE]: {
    name: '5 Super Likes',
    nameVi: '5 Super Like',
    price: 29000, // 29k VND
    priceUSD: 149, // $1.49
    features: ['Stand out to matches', 'Get noticed first'],
  },
  [ProductType.BOOST]: {
    name: 'Profile Boost',
    nameVi: 'Tăng Hiển Thị',
    price: 49000, // 49k VND
    priceUSD: 249, // $2.49
    features: ['Be top profile for 30 minutes', '10x more views'],
  },
};

export const getProductConfig = (productType: ProductType): ProductConfig => {
  return PRODUCT_CONFIGS[productType];
};
