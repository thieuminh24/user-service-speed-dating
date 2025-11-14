import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { json } from 'express';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Raw body for Stripe webhook
  // app.use(
  //   '/payment/stripe-webhook',
  //   json({
  //     verify: (req: any, res, buf) => {
  //       req.rawBody = buf;
  //     },
  //   }),
  // );

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
