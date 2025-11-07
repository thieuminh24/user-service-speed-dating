import {
  IsOptional,
  IsNumber,
  IsEnum,
  IsArray,
  IsString,
} from 'class-validator';
import { Gender } from '../../common/enums';

export class MatchingFilterDto {
  @IsOptional()
  @IsNumber()
  minAge?: number;

  @IsOptional()
  @IsNumber()
  maxAge?: number;

  @IsOptional()
  @IsEnum(Gender)
  preferredGender?: Gender;

  @IsOptional()
  @IsNumber()
  maxDistance?: number;
}
