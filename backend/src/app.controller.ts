import { Body, Controller, Get, Post } from '@nestjs/common';
import { PendulumService } from './pendulum.service';
import { PendulumConfig } from "../../common/pendulum-config";

@Controller()
export class AppController {
  constructor(private readonly pendulumService: PendulumService) {}

  @Post('/start')
  getStart(@Body() config: PendulumConfig): void {
    // TODO: need to validate config shape.
    this.pendulumService.start(config);
  }

  @Get('/continue')
  getContinue(): void {
    this.pendulumService.continue();
  }

  @Get('/pause')
  getPause(): void {
    this.pendulumService.pause();
  }

  @Get('/stop')
  getStop(): void {
    this.pendulumService.stop();
  }
}
