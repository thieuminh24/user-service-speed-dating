import {
  Controller,
  Post,
  Body,
  Get,
  Param,
  Put,
  Delete,
  UseGuards,
  Req,
  Query,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MatchingFilterDto } from './dto/matching-filter.dto';
import { LoginUserDto } from './dto/login-user.dto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtAuthGuard } from 'src/auth/jwt-auth.guard';
import { FileInterceptor } from '@nestjs/platform-express';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { Profile } from 'src/types/profile.types';

@Controller('users')
export class UsersController {
  constructor(
    private readonly usersService: UsersService,
    private readonly cloudinaryService: CloudinaryService,
  ) {}

  @Post()
  async create(@Body() createUserDto: CreateUserDto) {
    return this.usersService.create(createUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Put()
  async update(
    @Body() updateUserDto: UpdateUserDto,
    @Req() req,
  ): Promise<Profile> {
    return this.usersService.update(req.user.userId, updateUserDto);
  }

  @Put(':id')
  async updateAdmin(
    @Body() updateUserDto: UpdateUserDto,
    @Param('id') id: string,
  ) {
    return this.usersService.update(id, updateUserDto);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req) {
    if (req.user.id !== id) {
      throw new UnauthorizedException('Unauthorized');
    }
    return this.usersService.softDelete(id);
  }

  @Get()
  @UseGuards(JwtAuthGuard)
  async getOne(@Req() req) {
    return this.usersService.getProfile(req.user.userId);
  }

  @UseGuards(JwtAuthGuard)
  @Get('matching')
  async getMatchingUsers(@Req() req, @Query() filter: MatchingFilterDto) {
    return this.usersService.getMatchingUsers(req.user.id, filter);
  }

  @Post(':id/photos')
  @UseGuards(JwtAuthGuard)
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  ) // 5MB limit
  async uploadProfilePhoto(
    @Param('id') id: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: any,
  ) {
    if (req.user.userId !== id) {
      throw new UnauthorizedException('Unauthorized');
    }

    const result = await this.cloudinaryService.uploadImage(file);
    const photoUrl = result.secure_url; // URL ảnh an toàn

    // Cập nhật photos array trong user
    return this.usersService.addPhoto(id, photoUrl);
  }

  // Endpoint xóa ảnh
  @Delete(':id/photos/:photoIndex')
  @UseGuards(JwtAuthGuard)
  async deleteProfilePhoto(
    @Param('id') id: string,
    @Param('photoIndex') photoIndex: number,
    @Req() req: any,
  ) {
    if (req.user.userId !== id) {
      throw new UnauthorizedException('Unauthorized');
    }

    return this.usersService.deletePhoto(id, photoIndex);
  }
}
