// src/auth/dto/google-complete.dto.ts
import {
  IsString,
  IsNotEmpty,
  IsEmail,
  IsDateString,
  IsArray,
  IsOptional,
  IsNumber,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}

export class GoogleCompleteDto {
  @IsString()
  @IsNotEmpty()
  googleId: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsString()
  @IsNotEmpty()
  name: string;

  @IsDateString()
  @IsNotEmpty()
  dateOfBirth: string;

  @IsString()
  @IsNotEmpty()
  gender: string;

  @IsArray()
  @IsString({ each: true })
  photos: string[];

  @IsOptional()
  @ValidateNested()
  @Type(() => LocationDto)
  location?: LocationDto;
}
