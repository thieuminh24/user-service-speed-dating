// src/ai-chat/dto/send-message.dto.ts
import { IsString, IsNotEmpty, MaxLength } from 'class-validator';

export class SendMessageDto {
  @IsString()
  @IsNotEmpty({ message: 'Tin nhắn không được để trống' })
  @MaxLength(2000, { message: 'Tin nhắn không được vượt quá 2000 ký tự' })
  message: string;
}

// src/ai-chat/dto/chat-response.dto.ts
export class ChatResponseDto {
  message: string;
  timestamp: Date;

  constructor(message: string) {
    this.message = message;
    this.timestamp = new Date();
  }
}

// src/ai-chat/dto/chat-history.dto.ts
export class ChatHistoryDto {
  messages: {
    role: 'user' | 'assistant';
    content: string;
    timestamp: Date;
  }[];
  totalMessages: number;
  lastMessageAt?: Date;
}
