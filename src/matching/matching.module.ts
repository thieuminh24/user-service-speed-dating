// src/matching/matching.module.ts
import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MatchingController } from './matching.controller';
import { MatchingService } from './matching.service';
import { CompatibilityService } from './compatibility.service';
import { Interaction, InteractionSchema } from './schemas/interaction.schema';
import { Match, MatchSchema } from './schemas/match.schema';
import { User, UserSchema } from 'src/users/schemas/user.schema';

@Module({
  imports: [
    MongooseModule.forFeature([
      { name: Interaction.name, schema: InteractionSchema },
      { name: Match.name, schema: MatchSchema },
      { name: User.name, schema: UserSchema },
    ]),
  ],
  controllers: [MatchingController],
  providers: [MatchingService, CompatibilityService],
  exports: [MatchingService],
})
export class MatchingModule {}
