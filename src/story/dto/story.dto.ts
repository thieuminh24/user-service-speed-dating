// src/story/dto/story.dto.ts
import {
  IsEnum,
  IsString,
  IsOptional,
  IsNumber,
  IsBoolean,
  ValidateIf,
  MinLength,
  MaxLength,
  Min,
  Max,
} from 'class-validator';
import { StoryType, TextAlign } from '../schemas/story.schema';

export class CreateTextStoryDto {
  @IsEnum(StoryType)
  type: StoryType.TEXT;

  @IsString()
  @MinLength(1)
  @MaxLength(500)
  text: string;

  @IsOptional()
  @IsString()
  textColor?: string; // hex: #000000

  @IsOptional()
  @IsString()
  fontFamily?: string;

  @IsOptional()
  @IsNumber()
  @Min(16)
  @Max(72)
  fontSize?: number;

  @IsOptional()
  @IsEnum(TextAlign)
  textAlign?: TextAlign;

  @IsOptional()
  @IsBoolean()
  textBold?: boolean;

  @IsOptional()
  @IsBoolean()
  textItalic?: boolean;

  @IsOptional()
  @IsString()
  backgroundColor?: string; // CSS gradient
}

export class CreateVideoStoryDto {
  @IsEnum(StoryType)
  type: StoryType.VIDEO;

  @IsOptional()
  @IsNumber()
  videoDuration?: number;
}

// For marking story as viewed
export class ViewStoryDto {
  @IsString()
  storyId: string;
}
