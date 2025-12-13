// ===== 3. matching.module.ts - Updated =====
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { User, UserSchema } from '../users/schemas/user.schema';
import { Interaction, InteractionSchema } from './schemas/interaction.schema';
import { Match, MatchSchema } from './schemas/match.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: User.name, schema: UserSchema },
      { name: Interaction.name, schema: InteractionSchema },
      { name: Match.name, schema: MatchSchema },
    ]),
  ],
  controllers: [MatchingController],
  providers: [MatchingService],
  exports: [MatchingService],
})
export class MatchingModule {}
