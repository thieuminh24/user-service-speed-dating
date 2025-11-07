import {
  Injectable,
  BadRequestException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { User } from './schemas/user.schema';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { MatchingFilterDto } from './dto/matching-filter.dto';
import { LoginUserDto } from './dto/login-user.dto';
import * as bcrypt from 'bcryptjs';
import { JwtService } from '@nestjs/jwt';
import { CloudinaryService } from 'src/cloudinary/cloudinary.service';
import { StarSign } from 'src/common/enums';
import { Profile } from 'src/types/profile.types';

@Injectable()
export class UsersService {
  constructor(
    @InjectModel(User.name) private userModel: Model<User>,
    private cloudinaryService: CloudinaryService, // ← Inject
  ) {}

  async create(createUserDto: CreateUserDto): Promise<User> {
    const { email, password } = createUserDto;
    const existingUser = await this.userModel.findOne({ email });
    if (existingUser) {
      throw new BadRequestException('Email already exists');
    }
    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new this.userModel({
      ...createUserDto,
      password: hashedPassword,
    });
    return user.save();
  }

  // async login(loginUserDto: LoginUserDto): Promise<{ token: string }> {
  //   const { email, password } = loginUserDto;
  //   const user = await this.userModel.findOne({ email });
  //   if (!user || user.isDeleted) {
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  //   console.log('Logging in user:', user); // Debug log

  //   const isMatch = await bcrypt.compare(password, user.password);
  //   console.log('Logging in isMatch:', isMatch); // Debug log

  //   if (!isMatch) {
  //     throw new UnauthorizedException('Invalid credentials');
  //   }

  //   const userId = user._id?.toString();
  //   if (!userId) {
  //     throw new UnauthorizedException('Invalid user ID');
  //   }

  //   const token = this.jwtService.sign({ id: userId });
  //   return { token };
  // }

  // users.service.ts → update()
  async update(id: string, updateUserDto: UpdateUserDto): Promise<Profile> {
    const user = await this.userModel.findById(id);
    if (!user) throw new NotFoundException('User not found');

    // === CHỈ CẬP NHẬT FIELD NÀO ĐƯỢC GỬI ===
    if (updateUserDto.aboutMe !== undefined)
      user.aboutMe = updateUserDto.aboutMe;
    if (updateUserDto.photos !== undefined) user.photos = updateUserDto.photos;
    if (updateUserDto.prompts !== undefined)
      user.prompts = updateUserDto.prompts;

    // jobsAndEducation: chỉ cập nhật nếu có
    if (updateUserDto.jobsAndEducation) {
      if (updateUserDto.jobsAndEducation.jobs !== undefined) {
        user.jobsAndEducation.jobs = updateUserDto.jobsAndEducation.jobs;
      }
      if (updateUserDto.jobsAndEducation.education !== undefined) {
        user.jobsAndEducation.education =
          updateUserDto.jobsAndEducation.education;
      }
    }

    // basic: merge từng field
    if (updateUserDto.basic) {
      user.basic = { ...user.basic, ...updateUserDto.basic };
    }

    // dateOfBirth
    if (updateUserDto.dateOfBirth !== undefined) {
      const dob = new Date(updateUserDto.dateOfBirth);
      if (isNaN(dob.getTime())) throw new BadRequestException('Invalid date');

      user.dateOfBirth = dob;
      user.numerologyNumber = this.calculateNumerology(dob);
      user.basic = user.basic || {};
      user.basic.starSign = this.getStarSign(dob);
    }

    // location
    if (updateUserDto.location !== undefined) {
      user.location = updateUserDto.location
        ? {
            type: 'Point',
            coordinates: [
              updateUserDto.location.lon,
              updateUserDto.location.lat,
            ],
          }
        : undefined;
    }

    await user.save();

    // === TRẢ VỀ Profile SẠCH ===
    return {
      name: user.name,
      aboutMe: user.aboutMe,
      dateOfBirth: user.dateOfBirth,
      photos: user.photos,
      prompts: user.prompts,
      jobsAndEducation: user.jobsAndEducation,
      basic: user.basic,
      location: user.location?.coordinates
        ? {
            lat: user.location.coordinates[1],
            lon: user.location.coordinates[0],
          }
        : undefined,
    };
  }

  async getProfile(userId: string): Promise<Profile> {
    console.log('hehehe');
    const user = await this.userModel.findById(userId).lean().exec();
    if (!user) throw new NotFoundException('User not found');

    return {
      name: user.name,
      aboutMe: user.aboutMe,
      dateOfBirth: user.dateOfBirth,
      photos: user.photos,
      prompts: user.prompts,
      jobsAndEducation: user.jobsAndEducation,
      basic: user.basic,
    };
  }

  // === HÀM TÍNH NUMEROLOGY ===
  private calculateNumerology(dateOfBirth: Date): number {
    const dobStr = dateOfBirth.toISOString().split('T')[0].replace(/-/g, '');
    let num = dobStr.split('').reduce((a, b) => a + +b, 0);
    while (num > 9) {
      num = String(num)
        .split('')
        .reduce((a, b) => a + +b, 0);
    }
    return num;
  }

  async softDelete(id: string): Promise<{ message: string }> {
    const user = await this.userModel.findByIdAndUpdate(
      id,
      { isDeleted: true },
      { new: true },
    );
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return { message: 'User soft deleted successfully' };
  }

  async findById(id: string): Promise<User> {
    const user = await this.userModel
      .findOne({ _id: id, isDeleted: false })
      .select('-password');
    if (!user) {
      throw new NotFoundException('User not found or deleted');
    }
    return user;
  }

  async findByEmail(email: string): Promise<any> {
    return this.userModel.findOne({ email }).lean().exec();
    // .lean() → trả về plain object (dễ dùng hơn Mongoose document)
  }

  // === GET MATCHING USERS (FILTER) ===
  async getMatchingUsers(
    currentUserId: string,
    filter: MatchingFilterDto,
  ): Promise<User[]> {
    const query: any = { _id: { $ne: currentUserId }, isDeleted: false };

    // Filter tuổi
    if (filter.minAge || filter.maxAge) {
      const currentYear = new Date().getFullYear();
      query.dateOfBirth = {};
      if (filter.minAge) {
        query.dateOfBirth.$lte = new Date(currentYear - filter.minAge, 11, 31);
      }
      if (filter.maxAge) {
        query.dateOfBirth.$gte = new Date(currentYear - filter.maxAge, 0, 1);
      }
    }

    if (filter.preferredGender) {
      query.gender = filter.preferredGender;
    }

    const users = await this.userModel.find(query).select('-password');
    return users;
  }

  async addPhoto(userId: string, photoUrl: string) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (user.photos.length >= 6) {
      throw new BadRequestException('Max 6 photos allowed');
    }

    user.photos.push(photoUrl);
    return user.save();
  }

  async deletePhoto(userId: string, photoIndex: number) {
    const user = await this.userModel.findById(userId);
    if (!user) throw new NotFoundException('User not found');

    if (photoIndex < 0 || photoIndex >= user.photos.length) {
      throw new BadRequestException('Invalid photo index');
    }

    const deletedPhoto = user.photos.splice(photoIndex, 1)[0];

    // Xóa file khỏi Cloudinary (optional, dùng public_id từ URL)
    const publicId = deletedPhoto.split('/').pop()?.split('.')[0]; // Extract public_id
    if (publicId) {
      await this.cloudinaryService.deleteImage(publicId);
    }

    await user.save();
    return { message: 'Photo deleted', deletedUrl: deletedPhoto };
  }

  private getStarSign(dateOfBirth: Date): StarSign {
    const month = dateOfBirth.getMonth() + 1; // JS: 0 = Jan
    const day = dateOfBirth.getDate();

    if ((month === 3 && day >= 21) || (month === 4 && day <= 19))
      return StarSign.Aries;
    if ((month === 4 && day >= 20) || (month === 5 && day <= 20))
      return StarSign.Taurus;
    if ((month === 5 && day >= 21) || (month === 6 && day <= 20))
      return StarSign.Gemini;
    if ((month === 6 && day >= 21) || (month === 7 && day <= 22))
      return StarSign.Cancer;
    if ((month === 7 && day >= 23) || (month === 8 && day <= 22))
      return StarSign.Leo;
    if ((month === 8 && day >= 23) || (month === 9 && day <= 22))
      return StarSign.Virgo;
    if ((month === 9 && day >= 23) || (month === 10 && day <= 22))
      return StarSign.Libra;
    if ((month === 10 && day >= 23) || (month === 11 && day <= 21))
      return StarSign.Scorpio;
    if ((month === 11 && day >= 22) || (month === 12 && day <= 21))
      return StarSign.Sagittarius;
    if ((month === 12 && day >= 22) || (month === 1 && day <= 19))
      return StarSign.Capricorn;
    if ((month === 1 && day >= 20) || (month === 2 && day <= 18))
      return StarSign.Aquarius;
    return StarSign.Pisces;
  }
}
