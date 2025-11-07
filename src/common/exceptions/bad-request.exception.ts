import { BadRequestException as NestBadRequest } from '@nestjs/common';

export class BadRequestException extends NestBadRequest {
  constructor(message: string) {
    super(message);
  }
}
