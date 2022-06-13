import { forwardRef, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import fetch from 'cross-fetch';
import { Circle, Polygon, testCircleCircle, testPolygonCircle, Vector } from 'sat';
import { io, Socket } from 'socket.io-client';
import { PositionMessage } from '../../common/messages/possition-message';
import { PendulumConfig } from '../../common/pendulum-config';
import { getRadius } from '../../common/util';
import { PendulumGateway } from './pendulum.gateway';
import { PendulumService, State } from './pendulum.service';

const pendulumURL = (port: number) => `http://localhost:${port}/`;

enum Side {
  Left,
  Right
}

@Injectable()
export class CollisionService {
  ports: number[]; 
  index: number;
  leftWs: Socket | undefined;
  rightWs: Socket | undefined;
  spacing: number;
  private restarting: NodeJS.Timeout | undefined;
  constructor(
    private configService: ConfigService,
    // TODO: clean up this circular depenency between the collisionService and the pendulumService (pull state out to it's own service).
    @Inject(forwardRef(() => PendulumService))
    private pendulumService: PendulumService,
    private pendulumGateway: PendulumGateway,
  ) {
    this.ports = this.configService.get('config.ports') || [];
    this.index = this.configService.get('index') || 0;

    this.spacing = this.configService.get('config.distanceBetween') || 1;
  }

  start() {
    if (!this.leftWs) {
      this.leftWs = this.listenToNeighbour(this.ports[this.index - 1], Side.Left);
    }
    if (!this.rightWs) {
      this.rightWs = this.listenToNeighbour(this.ports[this.index + 1], Side.Right);
    }
  }

  stop() {
    if (this.leftWs) {
      this.leftWs.close();
      this.leftWs = undefined;
    }
    if (this.rightWs) {
      this.rightWs.close();
      this.rightWs = undefined;
    }
    if (this.restarting) {
      clearTimeout(this.restarting);
    }
  }

  stopRestart() {
    /*
      TODO: figure out why this causes collision issues... 
      or could just be pendulums phase through eachother due to sampling rates
     */
    // if (this.restarting) {
    //   console.log("---------");
    //   clearTimeout(this.restarting);
    // }
  }

  listenToNeighbour(port: number | undefined, side: Side): Socket | undefined {
    if (!port) return;
    
    const url = pendulumURL(port);
    const socket = io(url)
    socket.on('position', (message: PositionMessage) => {
      if (this.pendulumService.config && this.pendulumService.state) {
        this.checkCollision(
          message.theta,
          message.length,
          message.mass,
          side,
          this.pendulumService.config,
          this.pendulumService.state
        );
      }
    });
    socket.on("connect_error", (err) => {
      console.error(`connection error to neighbour ${url} due to ${err.message}`);
    });
    return socket;
  }

  private checkCollision(
    theta: number,
    length: number,
    mass: number,
    side: Side,
    config: PendulumConfig,
    state: State,
  ) {
    /*
      TODO: improve this to use a collider cast of some sort along the arcs
      so that pendulums can not pass through eachother
      Something like this: https://docs.unity3d.com/Packages/com.unity.physics@0.3/manual/collision_queries.html
    */

    // assuming a density of 1 for (V = m/p).
    const volume = config.mass;
    const otherVolume = mass; 

    const pendulumRadius = getRadius(volume);
    const otherPendulumRadius = getRadius(otherVolume);

    // If the pendulums cannot possibly collide along the shortest path then bail.
    if (length + otherPendulumRadius + config.length + pendulumRadius < this.spacing) return;

    const rod: Polygon = new Polygon(
      new Vector(),
      [
        new Vector(0, 0),
        new Vector(0, config.length).rotate(state.theta),
      ]
    );
    const pendulum = new Circle(rod.points[1], pendulumRadius);
    const offset = side === Side.Right ? this.spacing : -this.spacing;
    const otherRod: Polygon = new Polygon(
      new Vector(),
      [
        new Vector(offset, 0),
        new Vector(0, length).rotate(theta).add(new Vector(offset, 0))
      ],
    );
    const otherPendulum = new Circle(otherRod.points[1], pendulumRadius);
    
    if (
      // Check if the other pendulum collides with this one's rod/string 
      testPolygonCircle(rod, otherPendulum)
      // Check if this pendulum collides with the other's rod/string
      || testPolygonCircle(otherRod, pendulum)
      // Check if both pendulums collide
      || testCircleCircle(pendulum, otherPendulum)
      /*
        Ignoring the line (rod) line case as I am assuming that would require
        a user to preconfigure the pendulums to intersect in such a way and thus.
       */
    ) {
      this.handleCollision(config);
    }
  }

  private handleCollision(config: PendulumConfig) {
    console.log('pendulum collided');
    if (config.stopAndRestartOnCollision && !this.restarting) {
      console.log('stopping', JSON.stringify(this.ports));
      Promise.all(this.ports.map(port => {
        const baseUrl = pendulumURL(port);
        return fetch(`${baseUrl}stop`).then(() => baseUrl);
      })).then((baseUrls) => {
        console.log('restarting');
        this.pendulumGateway.sendRestartingMessage();
        this.restarting = setTimeout(() => {
            baseUrls.map(url => fetch(`${url}continue`));
            this.restarting = undefined;
          },
          this.configService.get('config.collideTimeoutMs') || 5000
        );
      }); 
    }
  }
}