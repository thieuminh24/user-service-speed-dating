// src/auth/auth.module.ts
import { forwardRef, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { MongooseModule } from '@nestjs/mongoose';
import { ConfigModule, ConfigService } from '@nestjs/config';

import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtStrategy } from './jwt.strategy';
import { User, UserSchema } from '../users/schemas/user.schema';
import { UsersModule } from 'src/users/users.module';

@Module({
  imports: [
    // Kết nối User model
    MongooseModule.forFeature([{ name: User.name, schema: UserSchema }]),
    forwardRef(() => UsersModule),
    // Cấu hình JWT
    ConfigModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.get('JWT_SECRET') || 'your-secret-key',
        signOptions: { expiresIn: '7d' }, // Tăng thời gian sống token
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService, // ← Service xử lý register/login
    JwtStrategy, // ← Xác thực token
  ],
  exports: [
    AuthService,
    JwtStrategy,
    PassportModule,
    JwtModule, // ← Bắt buộc để inject JwtService ở nơi khác
  ],
})
export class AuthModule {}
