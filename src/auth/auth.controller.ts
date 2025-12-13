// src/auth/auth.controller.ts
import { Controller, Post, Body, UseGuards, Req } from '@nestjs/common';
import { AuthService } from './auth.service';
import { RegisterDto } from 'src/users/dto/register.dto';
import { LoginUserDto } from 'src/users/dto/login-user.dto';
import { JwtAuthGuard } from './jwt-auth.guard';
import { GoogleAuthDto } from './dto/google-auth.dto';
import { GoogleCompleteDto } from './dto/google-complete.dto';

@Controller('auth')
export class AuthController {
  constructor(private authService: AuthService) {}

  @Post('register')
  async register(@Body() dto: RegisterDto) {
    return this.authService.register(dto);
  }

  @Post('login')
  async login(@Body() dto: LoginUserDto) {
    return this.authService.login(dto);
  }

  @Post('logout')
  @UseGuards(JwtAuthGuard)
  async logout(@Req() req: any) {
    return this.authService.logout(req.user.userId);
  }

  // ✅ THÊM MỚI: Google OAuth endpoint
  @Post('google')
  async googleAuth(@Body() dto: GoogleAuthDto) {
    return this.authService.googleAuth(dto);
  }

  // ✅ THÊM MỚI: Complete Google registration
  @Post('google/complete')
  async googleComplete(@Body() dto: GoogleCompleteDto) {
    return this.authService.googleComplete(dto);
  }
}
