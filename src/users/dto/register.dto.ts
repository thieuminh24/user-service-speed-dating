// src/auth/dto/register.dto.ts
import {
  IsEmail,
  IsString,
  MinLength,
  IsDateString,
  IsOptional,
  IsNumber,
  IsArray,
} from 'class-validator';

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}

export class RegisterDto {
  @IsString()
  name: string;

  @IsEmail()
  email: string;

  @MinLength(6)
  password: string;

  @IsDateString()
  dateOfBirth: string;

  @IsString()
  gender: string;

  @IsArray()
  photos: string[];

  @IsOptional()
  // @Type(() => LocationDto)
  location: LocationDto;
}
