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
    @Query('minAge') minAge?: string,
    @Query('maxAge') maxAge?: string,
    @Query('gender') gender?: string,
  ) {
    const filters: any = {};

    // Validate minAge
    if (minAge) {
      const parsedMinAge = parseInt(minAge, 10);
      if (isNaN(parsedMinAge) || parsedMinAge < 18 || parsedMinAge > 100) {
        throw new BadRequestException('minAge must be between 18 and 100');
      }
      filters.minAge = parsedMinAge;
    }

    // Validate maxAge
    if (maxAge) {
      const parsedMaxAge = parseInt(maxAge, 10);
      if (isNaN(parsedMaxAge) || parsedMaxAge < 18 || parsedMaxAge > 100) {
        throw new BadRequestException('maxAge must be between 18 and 100');
      }
      filters.maxAge = parsedMaxAge;
    }

    // Validate minAge <= maxAge
    if (filters.minAge && filters.maxAge && filters.minAge > filters.maxAge) {
      throw new BadRequestException('minAge cannot be greater than maxAge');
    }

    // Validate gender
    if (gender) {
      const validGenders = ['Male', 'Female', 'Non-binary', 'Other'];
      if (!validGenders.includes(gender)) {
        throw new BadRequestException(
          `gender must be one of: ${validGenders.join(', ')}`,
        );
      }
      filters.gender = gender;
    }

    return this.matchingService.getRecommendations(req.user.userId, filters);
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

  @Get('likes-received')
  @UseGuards(JwtAuthGuard)
  async getLikesReceived(@Req() req: any) {
    return this.matchingService.getLikesReceived(req.user.userId);
  }
}
