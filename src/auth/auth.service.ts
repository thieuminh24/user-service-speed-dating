// src/auth/auth.service.ts
import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User, AuthProvider } from '../users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from 'src/users/dto/register.dto';
import { LoginUserDto } from 'src/users/dto/login-user.dto';
import { UsersService } from 'src/users/users.service';
import { GoogleAuthDto, GoogleUserInfo } from './dto/google-auth.dto';
import { OAuth2Client } from 'google-auth-library';
import { ConfigService } from '@nestjs/config';
import { GoogleCompleteDto } from './dto/google-complete.dto';

@Injectable()
export class AuthService {
  private googleClient: OAuth2Client;

  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly usersService: UsersService,
    private jwtService: JwtService,
    private configService: ConfigService,
  ) {
    // ✅ FIX: Initialize Google OAuth2 Client
    const clientId = this.configService.get<string>('GOOGLE_CLIENT_ID');
    if (clientId) {
      this.googleClient = new OAuth2Client(clientId);
    }
  }

  async register(dto: RegisterDto) {
    const { email, password, dateOfBirth, location, gender, ...rest } = dto;

    const existing = await this.userModel.findOne({ email });
    if (existing) throw new ConflictException('Email already exists');

    const hashed = await bcrypt.hash(password, 10);

    const dob = new Date(dateOfBirth);
    const numerologyNumber = this.calculateNumerology(dob);
    const starSign = this.getStarSign(dob);

    const user = await this.userModel.create({
      ...rest,
      email,
      password: hashed,
      authProvider: AuthProvider.LOCAL,
      dateOfBirth: dob,
      numerologyNumber,
      basic: {
        starSign,
        gender,
      },
      location: dto.location
        ? {
            type: 'Point',
            coordinates: [dto.location.lon, dto.location.lat],
          }
        : undefined,
      isDeleted: false,
    });

    const token = this.jwtService.sign({
      sub: user._id,
      email: user.email,
      isPremium: false,
    });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      photos: user.photos,
      isPremium: false,
      subscriptionTier: 'Free',
      authProvider: user.authProvider,
      token,
    };
  }

  private calculateNumerology(dob: Date): number {
    const str = dob.toISOString().split('T')[0].replace(/-/g, '');
    let num = str.split('').reduce((a, b) => a + +b, 0);
    while (num > 9)
      num = String(num)
        .split('')
        .reduce((a, b) => a + +b, 0);
    return num;
  }

  private getStarSign(dob: Date): string {
    const m = dob.getMonth() + 1,
      d = dob.getDate();
    if ((m === 3 && d >= 21) || (m === 4 && d <= 19)) return 'Aries';
    if ((m === 4 && d >= 20) || (m === 5 && d <= 20)) return 'Taurus';
    if ((m === 5 && d >= 21) || (m === 6 && d <= 20)) return 'Gemini';
    if ((m === 6 && d >= 21) || (m === 7 && d <= 22)) return 'Cancer';
    if ((m === 7 && d >= 23) || (m === 8 && d <= 22)) return 'Leo';
    if ((m === 8 && d >= 23) || (m === 9 && d <= 22)) return 'Virgo';
    if ((m === 9 && d >= 23) || (m === 10 && d <= 22)) return 'Libra';
    if ((m === 10 && d >= 23) || (m === 11 && d <= 21)) return 'Scorpio';
    if ((m === 11 && d >= 22) || (m === 12 && d <= 21)) return 'Sagittarius';
    if ((m === 12 && d >= 22) || (m === 1 && d <= 19)) return 'Capricorn';
    if ((m === 1 && d >= 20) || (m === 2 && d <= 18)) return 'Aquarius';
    return 'Pisces';
  }

  async login(loginUserDto: LoginUserDto) {
    const { email, password } = loginUserDto;

    const user = await this.usersService.findByEmail(email);

    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    if (user.authProvider === AuthProvider.GOOGLE && !user.password) {
      throw new UnauthorizedException(
        'Tài khoản này đã được đăng ký bằng Google. Vui lòng đăng nhập bằng Google.',
      );
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPremiumValid =
      user.isPremium && user.premiumUntil && user.premiumUntil > new Date();

    const { _id, name, photos, isPremium, role } = user;

    return {
      _id,
      name,
      email: user.email,
      photos,
      role,
      isPremium: isPremiumValid,
      subscriptionTier: isPremiumValid ? user.subscriptionTier : 'Free',
      premiumUntil: isPremiumValid
        ? user.premiumUntil?.toISOString()
        : undefined,
      authProvider: user.authProvider,
      token: this.jwtService.sign({
        sub: _id,
        email: user.email,
        isPremium: isPremiumValid,
        role,
      }),
    };
  }

  async logout(userId: string) {
    await this.userModel.findByIdAndUpdate(userId, {
      lastActive: new Date(),
    });

    return {
      message: 'Logged out successfully',
    };
  }

  // ========================================
  // ✅ FIXED: Google OAuth Methods
  // ========================================

  /**
   * Verify Google Access Token
   * OPTION 1: Use Google's tokeninfo endpoint (simple but less secure)
   */
  private async verifyGoogleTokenSimple(
    accessToken: string,
  ): Promise<GoogleUserInfo | null> {
    try {
      const response = await fetch(
        `https://www.googleapis.com/oauth2/v3/userinfo?access_token=${accessToken}`,
      );

      if (!response.ok) {
        console.error(
          'Google API Error:',
          response.status,
          response.statusText,
        );
        return null;
      }

      const data = await response.json();

      console.log('✅ Google User Info:', data); // DEBUG

      if (!data.email_verified) {
        throw new BadRequestException('Google email not verified');
      }

      return {
        sub: data.sub,
        email: data.email,
        email_verified: data.email_verified,
        name: data.name,
        picture: data.picture,
        given_name: data.given_name,
        family_name: data.family_name,
      };
    } catch (error) {
      console.error('❌ Google Token Verification Error:', error);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  /**
   * Verify Google ID Token
   * OPTION 2: Use google-auth-library (recommended for production)
   */
  private async verifyGoogleTokenSecure(
    idToken: string,
  ): Promise<GoogleUserInfo | null> {
    try {
      if (!this.googleClient) {
        throw new Error(
          'Google Client not initialized. Check GOOGLE_CLIENT_ID in .env',
        );
      }

      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: this.configService.get<string>('GOOGLE_CLIENT_ID'),
      });

      const payload = ticket.getPayload();

      if (!payload) {
        throw new UnauthorizedException('Invalid Google token payload');
      }

      console.log('✅ Google Payload:', payload); // DEBUG

      return {
        sub: payload.sub,
        email: payload.email!,
        email_verified: payload.email_verified!,
        name: payload.name!,
        picture: payload.picture!,
        given_name: payload.given_name,
        family_name: payload.family_name,
      };
    } catch (error) {
      console.error('❌ Google Token Verification Error:', error);
      throw new UnauthorizedException('Invalid Google token');
    }
  }

  /**
   * Google OAuth Login/Register
   */
  async googleAuth(dto: GoogleAuthDto) {
    console.log('🔐 Google Auth Request:', { tokenLength: dto.idToken.length });

    // 1. Verify Google token
    let googleUser = await this.verifyGoogleTokenSimple(dto.idToken);

    if (!googleUser) {
      console.log('⚠️ Trying secure verification method...');
      googleUser = await this.verifyGoogleTokenSecure(dto.idToken);
    }

    if (!googleUser) {
      throw new UnauthorizedException('Invalid Google token');
    }

    console.log('✅ Google User Verified:', googleUser.email);

    // 2. Check if user exists
    let user = await this.userModel.findOne({
      $or: [{ googleId: googleUser.sub }, { email: googleUser.email }],
    });

    if (user) {
      // ========================================
      // USER EXISTS - LOGIN FLOW
      // ========================================
      console.log('✅ Existing user found, logging in...');

      // Link Google if not linked yet
      if (!user.googleId && user.authProvider === AuthProvider.LOCAL) {
        user.googleId = googleUser.sub;
        user.authProvider = AuthProvider.GOOGLE;
        user.googleAvatar = googleUser.picture;

        if (!user.photos || user.photos.length === 0) {
          user.photos = [googleUser.picture];
        }

        await user.save();
        console.log('✅ Linked Google account to existing local user');
      }

      user.lastActive = new Date();
      await user.save();

      const isPremiumValid =
        user.isPremium && user.premiumUntil && user.premiumUntil > new Date();

      const token = this.jwtService.sign({
        sub: user._id,
        email: user.email,
        isPremium: isPremiumValid,
        role: user.role,
      });

      return {
        _id: user._id,
        name: user.name,
        email: user.email,
        photos: user.photos,
        role: user.role,
        isPremium: isPremiumValid,
        subscriptionTier: isPremiumValid ? user.subscriptionTier : 'Free',
        premiumUntil: isPremiumValid
          ? user.premiumUntil?.toISOString()
          : undefined,
        authProvider: user.authProvider,
        isNewUser: false, // ✅ Existing user
        token, // ✅ Has token
      };
    } else {
      // ========================================
      // USER DOES NOT EXIST - REGISTRATION FLOW
      // ========================================
      console.log('⚠️ User not found, need to complete registration');

      // Return Google info WITHOUT creating user
      // Frontend will redirect to /registration with this data
      return {
        isNewUser: true, // ✅ Flag for frontend
        googleData: {
          googleId: googleUser.sub,
          email: googleUser.email,
          name: googleUser.name,
          photo: googleUser.picture,
        },
        // ❌ NO token - user must complete registration first
      };
    }
  }

  /**
   * Complete Google Registration
   * Called from frontend after user fills registration form
   */
  async googleComplete(dto: GoogleCompleteDto) {
    console.log(
      '🔐 Google Complete Registration - Received DTO:',
      JSON.stringify(dto, null, 2),
    );

    // Check if user already exists
    const existing = await this.userModel.findOne({
      $or: [{ googleId: dto.googleId }, { email: dto.email }],
    });

    if (existing) {
      throw new ConflictException('User already exists. Please login instead.');
    }

    // Create user
    const dob = new Date(dto.dateOfBirth);
    const numerologyNumber = this.calculateNumerology(dob);
    const starSign = this.getStarSign(dob);

    console.log('📅 Parsed DOB:', dob);
    console.log('🔢 Numerology:', numerologyNumber);
    console.log('⭐ Star Sign:', starSign);

    const user = await this.userModel.create({
      email: dto.email,
      name: dto.name,
      googleId: dto.googleId,
      authProvider: AuthProvider.GOOGLE,
      dateOfBirth: dob,
      numerologyNumber,
      photos: dto.photos,
      basic: {
        starSign,
        gender: dto.gender,
      },
      location: dto.location
        ? {
            type: 'Point',
            coordinates: [dto.location.lon, dto.location.lat],
          }
        : undefined,
      isDeleted: false,
    });

    console.log('✅ Google user created:', user.email);

    // Generate token
    const token = this.jwtService.sign({
      sub: user._id,
      email: user.email,
      isPremium: false,
      role: user.role,
    });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      photos: user.photos,
      role: user.role,
      isPremium: false,
      subscriptionTier: 'Free',
      authProvider: user.authProvider,
      token,
    };
  }
}
