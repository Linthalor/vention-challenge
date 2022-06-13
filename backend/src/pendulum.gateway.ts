import { OnGatewayConnection, OnGatewayDisconnect, OnGatewayInit, SubscribeMessage, WebSocketGateway, WebSocketServer } from '@nestjs/websockets';
import { PendulumService, State } from './pendulum.service';
import { Socket, Server } from 'socket.io';
import { forwardRef, Inject, OnModuleDestroy } from '@nestjs/common';
import { PositionRateMessage } from '../../common/messages/position-rate-message';
import { PositionMessage } from '../../common/messages/possition-message';
import { ConfigService } from '@nestjs/config';
import { SimulationState, SimulationStateMessage } from '../../common/messages/simulation-state-message';
import { MessageTypes } from '../../common/messages/message-types';

@WebSocketGateway({
  cors: {
    // TODO: lock down to localhost
    origin: '*',
  },
})
export class PendulumGateway implements OnGatewayInit, OnModuleDestroy, OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server: Server | undefined = undefined;
  interval: NodeJS.Timer | undefined = undefined;
  previousState: State | undefined = undefined;
  constructor(
    // Need to clean up this circular dependency
    @Inject(forwardRef(() => PendulumService))
    private readonly pendulumService: PendulumService,
    private configService: ConfigService
  ) {}

  afterInit() {
    this.interval = setInterval(() => this.queryPendulumPosition(), this.configService.get('config.simulationPollSpeedMs'));
  }

  // TODO: ensure this lifecycle hook is used otherwise it can be cleaned up as setInterval will be cleaned up on app termination.
  onModuleDestroy() {
    clearInterval(this.interval);
  }

  handleDisconnect(client: Socket) {
    if (!this.server?.sockets.sockets.size) {
      this.pendulumService.stop();
    }
  }
  handleConnection(client: Socket) {
    const message: PositionRateMessage = {
      rate: 200,
    }; 
    client.emit(MessageTypes.PositionRate, message);
    if (this.pendulumService.simulation) {
      this.sendPositionMessage();
      this.sendStatusMessage();
    }
  }

  queryPendulumPosition() {
    if (this.pendulumService.state && (!this.previousState || this.pendulumService.simulation && this.pendulumService.state.theta !== this.previousState.theta)) {
      this.sendPositionMessage();
      this.previousState === this.pendulumService.state;
    }
  }

  sendPositionMessage() {
    if (this.pendulumService.state && this.pendulumService.config) {
      const message: PositionMessage = {
        theta: this.pendulumService.state.theta,
        wind: this.pendulumService.state.wind,
        length: this.pendulumService.config.length,
        mass: this.pendulumService.config.mass,
      };
      this.server?.emit(MessageTypes.Position, message);
    }
  }

  public sendStatusMessage() {
    const message: SimulationStateMessage = {
      state:
      (
        this.pendulumService.simulation
        && SimulationState.Started
      )
      || (
        !this.pendulumService.simulation
        && this.pendulumService.state
        && this.pendulumService.state.time !== 0
        && SimulationState.Paused
      )
      || SimulationState.Stopped
    };
    this.server?.emit(MessageTypes.SimulationState, message);
  }

  public sendRestartingMessage() {
    const message: SimulationStateMessage = {
      state: SimulationState.Restarting,
    };
    this.server?.emit(MessageTypes.SimulationState, message);
  }
}