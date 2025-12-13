// scripts/create-admin.ts
// Chạy: npx ts-node scripts/create-admin.ts

import { connect, model, Schema } from 'mongoose';
import * as bcrypt from 'bcryptjs';

const UserSchema = new Schema({
  name: String,
  email: String,
  password: String,
  role: String,
  photos: [String],
  isDeleted: Boolean,
});

const User = model('User', UserSchema);

async function createAdmin() {
  try {
    // Kết nối MongoDB
    await connect(
      'mongodb+srv://thieuquangminh2422:XPfRS8kchf3ZjE4D@thieuminhd.auuj8y1.mongodb.net/speed-dating',
    );

    // Check admin đã tồn tại chưa
    const existingAdmin = await User.findOne({ email: 'admin@dating.com' });
    if (existingAdmin) {
      process.exit(0);
    }

    // Tạo admin mới
    const hashedPassword = await bcrypt.hash('Admin@123456', 10);
    const admin = await User.create({
      name: 'Admin',
      email: 'admin@dating.com',
      password: hashedPassword,
      role: 'admin',
      photos: [],
      isDeleted: false,
    });

    process.exit(0);
  } catch (error) {
    process.exit(1);
  }
}

createAdmin();
