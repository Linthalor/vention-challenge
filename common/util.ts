// (3V/4π)^1/3;
export const getRadius = (volume: number): number => Math.pow(0.75 * volume / Math.PI, 1 / 3);