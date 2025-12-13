// src/anonymous-chat/dto/start-matching.dto.ts
import { IsOptional, IsString } from 'class-validator';

export class StartMatchingDto {
  @IsOptional()
  @IsString()
  preferences?: string; // For future: gender, age preferences
}

// src/anonymous-chat/dto/cancel-matching.dto.ts
export class CancelMatchingDto {
  // No fields needed, userId comes from JWT
}

// src/anonymous-chat/dto/send-anonymous-message.dto.ts
import { IsNotEmpty, MaxLength } from 'class-validator';

export class SendAnonymousMessageDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  content: string;
}

// src/anonymous-chat/dto/leave-room.dto.ts
export class LeaveRoomDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;
}

// src/anonymous-chat/dto/get-messages.dto.ts
import { IsInt, Min, Max } from 'class-validator';
import { Type } from 'class-transformer';

export class GetAnonymousMessagesDto {
  @IsString()
  roomId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(10)
  @Max(100)
  limit?: number = 50;
}

// src/anonymous-chat/dto/typing.dto.ts
export class TypingDto {
  @IsString()
  @IsNotEmpty()
  roomId: string;

  @IsOptional()
  isTyping?: boolean;
}
