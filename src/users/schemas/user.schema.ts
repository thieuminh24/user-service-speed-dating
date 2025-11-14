// src/users/schemas/user.schema.ts
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document, Schema as MongooseSchema } from 'mongoose';
import {
  Gender,
  StarSign,
  Exercise,
  Drinking,
  Smoking,
  LookingFor,
  Kids,
  Politics,
  Religion,
  EducationLevel,
} from '../../common/enums';

export enum SubscriptionTier {
  FREE = 'Free',
  PREMIUM = 'Premium',
  VIP = 'VIP',
}

@Schema({ timestamps: true })
export class User extends Document {
  // === THÔNG TIN CƠ BẢN ===
  @Prop({ required: true })
  name: string;

  @Prop()
  aboutMe?: string;

  @Prop({ type: Date })
  dateOfBirth?: Date;

  @Prop({ type: [String], default: [] })
  photos: string[];

  // === PROMPTS ===
  @Prop({
    type: [
      {
        prompt: { type: String, required: true },
        answer: { type: String, required: true },
      },
    ],
    default: [],
  })
  prompts: { prompt: string; answer: string }[];

  // === CÔNG VIỆC & HỌC VẤN ===
  @Prop({
    type: {
      jobs: {
        type: [
          {
            _id: false,
            title: { type: String },
            company: { type: String },
          },
        ],
        default: [],
      },
      education: {
        type: [
          {
            _id: false,
            institution: { type: String },
            graduation: { type: Number },
          },
        ],
        default: [],
      },
    },
    default: { jobs: [], education: [] },
  })
  jobsAndEducation: {
    jobs: { title: string; company: string }[];
    education: { institution: string; graduation: number }[];
  };

  // === THÔNG TIN CƠ BẢN (BASIC) ===
  @Prop({
    type: {
      whereFrom: { type: String },
      placesLived: { type: String },
      gender: { type: String, enum: Gender },
      height: { type: Number },
      exercise: { type: String, enum: Exercise },
      educationLevel: { type: String, enum: EducationLevel },
      drinking: { type: String, enum: Drinking },
      smoking: { type: String, enum: Smoking },
      lookingFor: { type: String, enum: LookingFor },
      kids: { type: String, enum: Kids },
      politics: { type: String, enum: Politics },
      religion: { type: String, enum: Religion },
      starSign: { type: String, enum: StarSign },
    },
    default: {},
  })
  basic: {
    whereFrom?: string;
    placesLived?: string;
    gender?: Gender;
    height?: number;
    exercise?: Exercise;
    educationLevel?: EducationLevel;
    drinking?: Drinking;
    smoking?: Smoking;
    lookingFor?: LookingFor;
    kids?: Kids;
    politics?: Politics;
    religion?: Religion;
    starSign?: StarSign;
  };

  @Prop({
    type: MongooseSchema.Types.Mixed,
    default: { type: 'Point', coordinates: [0, 0] },
    index: '2dsphere',
  })
  location?: {
    type: 'Point';
    coordinates: [number, number]; // [lon, lat]
  };

  // === CÁC TRƯỜNG HỆ THỐNG ===
  @Prop({ unique: true, required: true })
  email: string;

  @Prop({ required: true })
  password: string;

  @Prop({ type: Number, default: null })
  numerologyNumber: number | null;

  @Prop({ type: Date })
  lastActive?: Date;

  // === PREMIUM FEATURES ===
  @Prop({
    type: String,
    enum: Object.values(SubscriptionTier),
    default: SubscriptionTier.FREE,
  })
  subscriptionTier: SubscriptionTier;

  @Prop({ default: false })
  isPremium: boolean;

  @Prop({ type: Date })
  premiumUntil?: Date;

  // Super Likes (renew monthly for premium users)
  @Prop({ default: 0 })
  superLikesLeft: number;

  @Prop({ type: Date })
  superLikesResetAt?: Date;

  // Profile Boosts (one-time purchase or included in VIP)
  @Prop({ default: 0 })
  boostsLeft: number;

  @Prop({ type: Date })
  lastBoostUsed?: Date;

  // Unlimited likes for Premium/VIP
  @Prop({ default: 5 }) // Free users: 5 likes/day
  dailyLikesLimit: number;

  @Prop({ default: 5 })
  dailyLikesUsed: number;

  @Prop({ type: Date })
  likesResetAt?: Date;

  @Prop({ default: false })
  isDeleted: boolean;
}

export const UserSchema = SchemaFactory.createForClass(User);

// === PRE-SAVE HOOK: TÍNH numerologyNumber ===
UserSchema.pre('save', function (next) {
  if (
    this.dateOfBirth &&
    this.dateOfBirth instanceof Date &&
    !isNaN(this.dateOfBirth.getTime())
  ) {
    const dobStr = this.dateOfBirth
      .toISOString()
      .split('T')[0]
      .replace(/-/g, '');
    let num = dobStr.split('').reduce((a, b) => a + +b, 0);
    while (num > 9) {
      num = String(num)
        .split('')
        .reduce((a, b) => a + +b, 0);
    }
    this.numerologyNumber = num;
  } else {
    this.numerologyNumber = null;
  }
  next();
});

// === INDEXES ===
UserSchema.index({ 'location.lat': 1, 'location.lon': 1 });
UserSchema.index({ isDeleted: 1 });
UserSchema.index({ email: 1 });
UserSchema.index({ isPremium: 1, premiumUntil: 1 });
