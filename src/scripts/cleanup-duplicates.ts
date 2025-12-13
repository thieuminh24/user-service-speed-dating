import { NestFactory } from '@nestjs/core';
import { AppModule } from '../app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Conversation } from '../chat/schemas/conversation.schema';
import { Match } from '../matching/schemas/match.schema';

async function cleanupDuplicates() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const conversationModel = app.get<Model<Conversation>>('ConversationModel');
  const matchModel = app.get<Model<Match>>('MatchModel');

  console.log('🧹 Cleaning up duplicate conversations...');

  // Find duplicate conversations by matchId
  const duplicates = await conversationModel.aggregate([
    {
      $group: {
        _id: '$matchId',
        count: { $sum: 1 },
        docs: { $push: '$$ROOT' },
      },
    },
    {
      $match: { count: { $gt: 1 } },
    },
  ]);

  console.log(`Found ${duplicates.length} duplicate conversation groups`);

  for (const dup of duplicates) {
    // Keep the oldest one (first created)
    const toKeep = dup.docs.sort(
      (a: any, b: any) => a.createdAt.getTime() - b.createdAt.getTime(),
    )[0];

    const toDelete = dup.docs
      .filter((d: any) => d._id.toString() !== toKeep._id.toString())
      .map((d: any) => d._id);

    if (toDelete.length > 0) {
      await conversationModel.deleteMany({ _id: { $in: toDelete } });
      console.log(
        `Deleted ${toDelete.length} duplicate conversations for match ${dup._id}`,
      );
    }
  }

  console.log('✅ Cleanup complete!');
  await app.close();
}

cleanupDuplicates();
