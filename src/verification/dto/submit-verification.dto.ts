import {
  IsNotEmpty,
  IsString,
  IsArray,
  ArrayMinSize,
  ArrayMaxSize,
} from 'class-validator';

export class SubmitVerificationDto {
  @IsNotEmpty({ message: 'Ảnh selfie là bắt buộc' })
  @IsString()
  selfieUrl: string;

  @IsArray({ message: 'Cần có 2 ảnh CCCD' })
  @ArrayMinSize(2, { message: 'Cần có 2 ảnh CCCD (mặt trước + mặt sau)' })
  @ArrayMaxSize(2, { message: 'Chỉ được upload tối đa 2 ảnh CCCD' })
  @IsString({ each: true })
  idCardUrls: string[];
}
