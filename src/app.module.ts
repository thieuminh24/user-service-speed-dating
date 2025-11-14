// src/app.module.ts (Updated)
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { UsersModule } from './users/users.module';
import { AuthModule } from './auth/auth.module';
import { ConfigModule } from '@nestjs/config';
import { CloudinaryModule } from './cloudinary/cloudinary.module';
import { MatchingModule } from './matching/matching.module';
import { PaymentModule } from './payment/payment.module';
// import { ChatModule } from './chat/chat.module'; // ← THÊM IMPORT

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    MongooseModule.forRoot(
      'mongodb+srv://thieuquangminh2422:XPfRS8kchf3ZjE4D@thieuminhd.auuj8y1.mongodb.net/speed-dating',
    ),
    AuthModule,
    UsersModule,
    CloudinaryModule,
    MatchingModule,
    PaymentModule,
    // ChatModule, // ← THÊM MODULE
  ],
})
export class AppModule {}
