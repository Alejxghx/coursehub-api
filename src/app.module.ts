import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { AppService } from './app.service.js';
import { WelcomeService } from './welcome.service.js';
import { WelcomeController } from './welcome.controller.js';

@Module({
  imports: [],
  controllers: [AppController, WelcomeController],
  providers: [AppService, WelcomeService],
})
export class AppModule {}
