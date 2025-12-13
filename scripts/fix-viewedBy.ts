// scripts/fix-viewedBy.ts

import mongoose from 'mongoose';
import { StorySchema } from '../src/story/schemas/story.schema';

async function runMigration() {
  try {
    // Thay tên DB của bạn vào đây
    await mongoose.connect(
      'mongodb+srv://thieuquangminh2422:XPfRS8kchf3ZjE4D@thieuminhd.auuj8y1.mongodb.net/speed-dating',
      {
        useNewUrlParser: true,
        useUnifiedTopology: true,
      } as any,
    );

    console.log('Đã kết nối MongoDB');

    // Đăng ký model đúng cách
    const StoryModel = mongoose.model('Story', StorySchema);

    console.log('Bắt đầu sửa viewedBy từ string → ObjectId...');

    // Bước 1: Convert tất cả string trong mảng viewedBy thành ObjectId
    const convertResult = await StoryModel.updateMany(
      { viewedBy: { $type: 'string' } }, // chỉ xử lý document có phần tử string
      [
        {
          $set: {
            viewedBy: {
              $map: {
                input: '$viewedBy',
                in: { $toObjectId: '$$this' },
              },
            },
          },
        },
      ],
    );

    console.log(`Đã convert ${convertResult.modifiedCount} story(s)`);

    // Bước 2: Loại trùng lặp + đồng bộ viewCount
    const syncResult = await StoryModel.updateMany({}, [
      {
        $set: {
          viewedBy: { $setUnion: ['$viewedBy', []] }, // loại trùng
        },
      },
      {
        $set: {
          viewCount: { $size: '$viewedBy' },
        },
      },
    ]);

    console.log(
      `Đã đồng bộ viewCount cho ${syncResult.modifiedCount} story(s)`,
    );
    console.log('Migration HOÀN TẤT! Giờ populate sẽ hoạt động 100%');
  } catch (error) {
    console.error('Lỗi migration:', error);
  } finally {
    await mongoose.disconnect();
    process.exit(0);
  }
}

runMigration();
