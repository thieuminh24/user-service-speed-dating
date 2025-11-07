// src/users/dto/create-user.dto.ts
import {
  IsString,
  MinLength,
  IsOptional,
  IsEmail,
  IsDateString,
  IsEnum,
  IsArray,
} from 'class-validator';
import { Transform } from 'class-transformer';
import {
  Gender,
  Exercise,
  Drinking,
  Smoking,
  LookingFor,
  Kids,
  Politics,
  Religion,
  StarSign,
} from '../../common/enums';

export class CreateUserDto {
  @IsString()
  @MinLength(6)
  password: string;

  @IsEmail()
  email: string; // ← BẮT BUỘC
}
