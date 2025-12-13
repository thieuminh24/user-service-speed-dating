import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { JwtModule } from '@nestjs/jwt';
import { Match, MatchSchema } from '../matching/schemas/match.schema';
import { User, UserSchema } from '../users/schemas/user.schema';
import { CloudinaryModule } from '../cloudinary/cloudinary.module';
import {
  Conversation,
  ConversationSchema,
} from './schemas/conversation.schema';
import { Message, MessageSchema } from './schemas/message.schema';
import {
  MessageReaction,
  MessageReactionSchema,
} from './schemas/message-reaction.schema';
import { ChatController } from './chat.controller';
import { ChatService } from './chat.service';
import { ChatGateway } from './chat.gateway';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Conversation.name, schema: ConversationSchema },
      { name: Message.name, schema: MessageSchema },
      { name: MessageReaction.name, schema: MessageReactionSchema },
      { name: Match.name, schema: MatchSchema },
      { name: User.name, schema: UserSchema },
    ]),
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'abc',
      signOptions: { expiresIn: '7d' },
    }),
    CloudinaryModule,
  ],
  controllers: [ChatController],
  providers: [ChatService, ChatGateway],
  exports: [ChatService],
})
export class ChatModule {}
