import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import configuration from 'config/configuration';
import { AppController } from './app.controller';
import { CollisionService } from './collision.service';
import { PendulumGateway } from './pendulum.gateway';
import { PendulumService } from './pendulum.service';

@Module({
  imports: [
    ConfigModule.forRoot({
      load: [configuration],
    }),
  ],
  controllers: [AppController],
  providers: [PendulumService, PendulumGateway, CollisionService],
})
export class AppModule {}
