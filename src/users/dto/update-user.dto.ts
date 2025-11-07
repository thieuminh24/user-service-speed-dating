// src/users/dto/update-user.dto.ts
import {
  IsOptional,
  IsString,
  IsNumber,
  IsEnum,
  IsArray,
  IsDateString,
} from 'class-validator';
import {
  Exercise,
  Drinking,
  Smoking,
  LookingFor,
  Kids,
  Politics,
  Religion,
  StarSign,
  EducationLevel,
  Gender,
} from '../../common/enums';
import { Transform } from 'class-transformer';

export class LocationDto {
  @IsNumber()
  lat: number;

  @IsNumber()
  lon: number;
}

export class PromptsDto {
  @IsString()
  prompt: string;

  @IsString()
  answer: string;
}

export class JobsDto {
  @IsString()
  title: string;

  @IsString()
  company: string;
}

export class educationDto {
  @IsString()
  institution: string;

  @IsString()
  graduation: number;
}

export class jobsAndEducationDto {
  @IsOptional()
  jobs?: JobsDto[];

  @IsOptional()
  education?: educationDto[];
}

export class basicDto {
  @IsOptional()
  whereFrom?: string;

  @IsOptional()
  placesLived?: string;

  @IsOptional()
  @IsEnum(Gender)
  gender?: Gender;

  @IsOptional()
  @IsNumber()
  height?: number;

  @IsOptional()
  @IsEnum(Exercise)
  exercise?: Exercise;

  @IsOptional()
  @IsEnum(EducationLevel)
  educationLevel?: EducationLevel;

  @IsOptional()
  @IsEnum(Drinking)
  drinking?: Drinking;

  @IsOptional()
  @IsEnum(Smoking)
  smoking?: Smoking;

  @IsOptional()
  @IsEnum(LookingFor)
  lookingFor?: LookingFor;

  @IsOptional()
  @IsEnum(Kids)
  kids?: Kids;

  @IsOptional()
  @IsEnum(Politics)
  politics?: Politics;

  @IsOptional()
  @IsEnum(Religion)
  religion?: Religion;

  @IsOptional()
  @IsEnum(StarSign)
  starSign?: StarSign;
}

export class UpdateUserDto {
  @IsOptional()
  @IsString()
  aboutMe?: string;

  @IsOptional()
  @Transform(({ value }) => {
    if (!value) return undefined;
    const date = new Date(value);
    return isNaN(date.getTime()) ? undefined : date;
  })
  dateOfBirth?: Date;

  @IsOptional()
  @IsArray()
  photos?: string[];

  @IsOptional()
  prompts?: PromptsDto[];

  @IsOptional()
  basic?: basicDto;

  @IsOptional()
  jobsAndEducation?: jobsAndEducationDto;

  @IsOptional()
  location?: LocationDto;
}
