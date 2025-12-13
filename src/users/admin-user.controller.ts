// src/users/admin-user.controller.ts
import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { AdminUserService } from './admin-user.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../auth/admin.guard';
import {
  GetUsersQueryDto,
  BanUserDto,
  RestrictUserDto,
  AdminUpdateUserDto,
} from './dto/admin-user.dto';

@Controller('admin/users')
@UseGuards(JwtAuthGuard, AdminGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  // ===== GET ALL USERS =====
  @Get()
  async getAllUsers(@Query() query: GetUsersQueryDto) {
    return this.adminUserService.getAllUsers(query);
  }

  // ===== GET STATISTICS =====
  @Get('statistics')
  async getStatistics() {
    return this.adminUserService.getStatistics();
  }

  // ===== GET USER DETAIL =====
  @Get(':id')
  async getUserDetail(@Param('id') id: string) {
    return this.adminUserService.getUserDetail(id);
  }

  // ===== BAN USER =====
  @Post(':id/ban')
  async banUser(
    @Param('id') id: string,
    @Req() req: any,
    @Body() dto: BanUserDto,
  ) {
    return this.adminUserService.banUser(id, req.user.userId, dto);
  }

  // ===== UNBAN USER =====
  @Post(':id/unban')
  async unbanUser(@Param('id') id: string) {
    return this.adminUserService.unbanUser(id);
  }

  // ===== RESTRICT USER =====
  @Post(':id/restrict')
  async restrictUser(@Param('id') id: string, @Body() dto: RestrictUserDto) {
    return this.adminUserService.restrictUser(id, dto);
  }

  // ===== UNRESTRICT USER =====
  @Post(':id/unrestrict')
  async unrestrictUser(@Param('id') id: string) {
    return this.adminUserService.unrestrictUser(id);
  }

  // ===== DELETE USER =====
  @Delete(':id')
  async deleteUser(@Param('id') id: string) {
    return this.adminUserService.deleteUser(id);
  }

  // ===== ADMIN UPDATE USER =====
  @Patch(':id')
  async adminUpdateUser(
    @Param('id') id: string,
    @Body() dto: AdminUpdateUserDto,
  ) {
    return this.adminUserService.adminUpdateUser(id, dto);
  }
}
