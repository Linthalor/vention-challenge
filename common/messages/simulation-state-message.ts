export enum SimulationState {
  Started = 'started',
  Paused = 'paused',
  Stopped = 'stopped',
  Restarting = 'restarting',
};

export interface SimulationStateMessage {
  state: SimulationState;
};