import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CollisionService } from './collision.service';
import { PendulumConfig } from '../../common/pendulum-config';
import { PendulumGateway } from './pendulum.gateway';

export interface State {
  readonly time: number;
  readonly theta: number;
  readonly omega: number; // theta' (angular velocity)
  readonly wind: number;
}

@Injectable()
export class PendulumService {
  public _config: PendulumConfig | undefined = undefined;
  public get config() {
    return this._config;
  };
  protected _state: State | undefined = undefined;
  public get state() {
    return this._state;
  };
  protected _simulation?: NodeJS.Timer | undefined = undefined;
  public get simulation() {
    return this._simulation;
  };
  private gravity: number;

  constructor(
    private collisionService: CollisionService,
    private configService: ConfigService,
    private pendulumGateway: PendulumGateway,
  ) {
    this.gravity = this.configService.get('config.gravity') || 9.81;
  }

  start(config: PendulumConfig): void {
    this._config = config;
    this.reset();
    this.continue();
    this.pendulumGateway.sendStatusMessage();
  }

  continue(): void {
    if (this._simulation === undefined) {
      const simulationFreqMs = this.configService.get('config.simulationFreqMs');
      this._simulation = setInterval(() => {
        if (this._config && this._state) {
          this.evaluateNextStep(simulationFreqMs / 1000, this._config, this._state);
        }
      });
      this.collisionService.start();
      this.pendulumGateway.sendStatusMessage();
    }
  }

  pause(): void {
    if (this._simulation) {
      clearInterval(this._simulation);
      this._simulation = undefined;
      console.log('PAUSING')
      this.collisionService.stop();
      this.pendulumGateway.sendStatusMessage();
    } else {
      this.collisionService.stopRestart();
    }
  }

  stop(): void {
    this.pause();
    this.reset();
    this.pendulumGateway.sendStatusMessage();
  }

  private reset() {
    this.setStateFromConfig();
  }

  private setStateFromConfig() {
    this._state = {
      time: 0,
      theta: this._config?.theta || 0,
      omega: 0,
      wind: 0,
    };
  }

  private thetaDot = (omega: number): number => omega;
  private omegaDot = (
    theta: number,
    omega: number,
    time: number,
    dt: number,
    config: PendulumConfig
  ): number => -this.gravity / config.length * Math.sin(theta)
    + -config.damping * omega
    + this.getWindAmplitude(time, config) * Math.cos(config.windFreq * dt);
  private omega_n = (l: number, dt: number, state: State) => state.omega  + 0.5 * dt * l;
  // Using the Runge Kutta method:
  //  https://www.myphysicslab.com/pendulum/chaotic-pendulum-en.html
  //  http://astro.physics.ncsu.edu/CDSA/course_files/Lesson15/index.html
  //  https://stackoverflow.com/questions/64157573/how-to-calculate-movement-of-pendulum
  //  https://webhome.phy.duke.edu/~mbe9/data_science/pendulum/numerical_methods_and_the_dampened_driven_pendulum.pdf
  private evaluateNextStep(
    dt: number, // unit: s
    config: PendulumConfig,
    state: State,
  ) {
    const time = state.time + dt;
    const windAmplitude = this.getWindAmplitude(time, config);
    const k1 = this.thetaDot(state.omega);
    const l1 = this.omegaDot(state.theta, state.omega, time, dt, config);

    const o2 = this.omega_n(l1, dt, state);
    const k2 = this.thetaDot(o2);
    const l2 = this.omegaDot(state.theta  + 0.5 * dt * k1, o2, time, dt, config);

    const o3 = this.omega_n(l2, dt, state);
    const k3 = this.thetaDot(o3);
    const l3 = this.omegaDot(state.theta  + 0.5 * dt * k2, o3, time, dt, config);

    const o4 = this.omega_n(l3, dt, state);
    const k4 = this.thetaDot(o4);
    const l4 = this.omegaDot(state.theta  + 0.5 * dt * k3, o4, time, dt, config);

    const newState: State = {
      time,
      theta: state.theta + ((k1 + 2*k2 + 2*k3 + k4) * dt) / 6,
      omega: state.omega + ((l1 + 2*l2 + 2*l3 + l4) * dt) / 6,
      wind: windAmplitude,
    }
    this._state = newState;
    // TODO: put behind a log level config?
    console.log('angle', this._state.theta * (180/Math.PI));
  }

  // Generates a never periodic continuous wind driving force (if pi is currectly irraitional).
  // Based on the observations here: https://stackoverflow.com/a/60772438
  private getWindAmplitude(t: number, config: PendulumConfig): number {
    // Could bitshift the 2 if speed is needed...
    return (Math.sin(2 * t * config.windFreq)
      + Math.sin(Math.PI * t * config.windFreq)) / 2 * config.maxWind;
  }
}
