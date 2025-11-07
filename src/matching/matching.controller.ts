// src/matching/matching.controller.ts
import {
  Controller,
  Get,
  UseGuards,
  Req,
  Query,
  Post,
  Body,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MatchingService } from './matching.service';
import { BadRequestException } from 'src/common/exceptions/bad-request.exception';
import { InteractionDto } from './dto/interaction.dto';

@Controller('matching')
export class MatchingController {
  constructor(private matchingService: MatchingService) {}

  @Get('recommendations')
  @UseGuards(JwtAuthGuard)
  async getRecommendations(
    @Req() req: any,
    @Query('maxDistance') maxDistance?: string, // ← string | undefined
  ) {
    const distance = maxDistance ? parseInt(maxDistance, 10) : 50;

    if (isNaN(distance) || distance <= 0) {
      throw new BadRequestException('maxDistance must be a positive number');
    }

    return this.matchingService.getRecommendations(req.user.userId, distance);
  }

  @Post('like')
  @UseGuards(JwtAuthGuard)
  async likeUser(@Req() req: any, @Body() body: InteractionDto) {
    return this.matchingService.likeUser(req.user.userId, body.targetUserId);
  }

  @Post('pass')
  @UseGuards(JwtAuthGuard)
  async passUser(@Req() req: any, @Body() body: InteractionDto) {
    return this.matchingService.passUser(req.user.userId, body.targetUserId);
  }

  @Get('matches')
  @UseGuards(JwtAuthGuard)
  async getMatches(@Req() req: any) {
    return this.matchingService.getMatches(req.user.userId);
  }
}
