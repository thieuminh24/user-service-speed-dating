// src/auth/dto/google-auth.dto.ts
import { IsString, IsNotEmpty } from 'class-validator';

export class GoogleAuthDto {
  @IsString()
  @IsNotEmpty()
  idToken: string; // Google ID Token từ frontend
}

export class GoogleUserInfo {
  sub: string; // Google User ID
  email: string;
  email_verified: boolean;
  name: string;
  picture: string;
  given_name?: string;
  family_name?: string;
}
