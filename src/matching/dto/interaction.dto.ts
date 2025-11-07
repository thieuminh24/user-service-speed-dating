import { IsMongoId } from 'class-validator';

export class InteractionDto {
  @IsMongoId({ message: 'targetUserId must be a valid MongoDB ID' })
  targetUserId: string;
}
