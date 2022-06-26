import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { MyLogger } from './logger.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: process.env.NODE_ENV === 'production' ? new MyLogger() : false,
  });
  app.enableCors();
  app.enableShutdownHooks();
  await app.listen(process.env.PORT || 3000);
}
bootstrap();
