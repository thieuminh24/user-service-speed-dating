// scripts/migrate-auth-provider.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from '../src/users/schemas/user.schema';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const userModel = app.get<Model<User>>('UserModel');

  console.log('🚀 Starting migration: Add authProvider to existing users...');

  // Update all users without authProvider
  const result = await userModel.updateMany(
    { authProvider: { $exists: false } },
    { $set: { authProvider: 'local' } },
  );

  console.log(`✅ Updated ${result.modifiedCount} users`);
  console.log('✅ Migration completed!');

  await app.close();
}

bootstrap();
