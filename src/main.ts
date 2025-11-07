import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Bật Validation Pipe toàn cục
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true, // loại bỏ các field không trong DTO
      forbidNonWhitelisted: true, // báo lỗi nếu gửi field lạ
      transform: true, // tự động convert JSON thành class instance
    }),
  );

  app.enableCors({
    origin: 'http://localhost:3000',
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(4000);
}
bootstrap();
