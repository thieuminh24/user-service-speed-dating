// src/chat/dto/send-message.dto.ts
import {
  IsString,
  IsOptional,
  IsEnum,
  IsMongoId,
  ValidateIf,
  IsNotEmpty,
  IsNumber,
} from 'class-validator';
import { MessageType } from '../schemas/message.schema';

export class SendMessageDto {
  @IsMongoId()
  conversationId: string;

  @IsEnum(MessageType)
  type: MessageType;

  @ValidateIf((o) => o.type === MessageType.TEXT)
  @IsString()
  @IsNotEmpty()
  content?: string;

  @ValidateIf((o) => o.type !== MessageType.TEXT)
  @IsString()
  @IsOptional()
  fileUrl?: string;

  @IsOptional()
  @IsString()
  fileName?: string;

  @IsOptional()
  @IsNumber()
  fileSize?: number;

  @IsOptional()
  @IsMongoId()
  replyTo?: string;
}

// src/chat/dto/delete-message.dto.ts
export class DeleteMessageDto {
  @IsMongoId()
  messageId: string;
}

// src/chat/dto/react-message.dto.ts
export class ReactMessageDto {
  @IsMongoId()
  messageId: string;

  @IsString()
  @IsNotEmpty()
  emoji: string; // '❤️', '👍', '😂', etc.
}

// src/chat/dto/mark-as-read.dto.ts
export class MarkAsReadDto {
  @IsMongoId()
  conversationId: string;
}

// src/chat/dto/unmatch.dto.ts
export class UnmatchDto {
  @IsMongoId()
  conversationId: string;
}

// src/chat/dto/block-user.dto.ts
export class BlockUserDto {
  @IsMongoId()
  conversationId: string;

  @IsMongoId()
  userId: string;
}

// src/chat/dto/typing.dto.ts
export class TypingDto {
  @IsMongoId()
  conversationId: string;

  @IsOptional()
  isTyping?: boolean;
}
