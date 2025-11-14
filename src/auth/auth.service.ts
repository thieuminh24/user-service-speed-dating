//authService

import {
  Injectable,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../users/schemas/user.schema';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { RegisterDto } from 'src/users/dto/register.dto';
import { LoginUserDto } from 'src/users/dto/login-user.dto';
import { UsersService } from 'src/users/users.service';

@Injectable()
export class AuthService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private readonly usersService: UsersService,

    private jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const { email, password, dateOfBirth, location, ...rest } = dto;

    console.log('AuthService Register DTO:', dto);

    // Kiểm tra email trùng
    const existing = await this.userModel.findOne({ email });
    if (existing) throw new ConflictException('Email already exists');

    // Hash password
    const hashed = await bcrypt.hash(password, 10);

    // Tính numerology & starSign
    const dob = new Date(dateOfBirth);
    const numerologyNumber = this.calculateNumerology(dob);
    const starSign = this.getStarSign(dob);

    // Tạo user
    const user = await this.userModel.create({
      ...rest,
      email,
      password: hashed,
      dateOfBirth: dob,
      numerologyNumber,
      basic: {
        starSign,
      },
      location: dto.location
        ? {
            type: 'Point',
            coordinates: [dto.location.lon, dto.location.lat],
          }
        : undefined,
      isDeleted: false,
    });

    // Tạo token
    const token = this.jwtService.sign({ sub: user._id, email: user.email });

    return {
      _id: user._id,
      name: user.name,
      email: user.email,
      photos: user.photos,
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

  // src/auth/auth.service.ts
  async login(loginUserDto: LoginUserDto): Promise<{
    _id: any;
    name: string;
    email: string;
    photos?: string[];
    token: string;
  }> {
    const { email, password } = loginUserDto;

    const user = await this.usersService.findByEmail(email);
    if (!user) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('Email hoặc mật khẩu không đúng');
    }

    const { _id, name, photos } = user;

    return {
      _id,
      name,
      email: user.email,
      photos,
      token: this.jwtService.sign({ sub: _id, email: user.email }),
    };
  }
}
