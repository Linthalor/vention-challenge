// TODO: use a library like mathjs to ensure the units?
export interface PendulumConfig {
  readonly theta: number; // Initial angle of the pendulum units: radian
  readonly length: number; // Length of the rod/string units: m
  /*
     TODO: this should technically be bounded by the length as the mass will dictate the
     volume and thus the radius of the pendulum which should not exceed the length of the rod/string
     Assuming the mass is suspended from the end of the rod at the middle of the mass and not the edge of the mass.
   */
  readonly mass: number; // Mass of the pendulum units: kg (assuming a density of 1.0 for now for calculating pendulum circular volume)
  readonly damping: number; // fricton of the pendulum
  readonly maxWind: number; // Maximum absolute value of the torque of the wind.
  readonly windFreq: number; // The frequency of the wind.
  readonly stopAndRestartOnCollision: boolean;
}
