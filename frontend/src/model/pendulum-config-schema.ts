import { z } from 'zod';

// TODO: could push this into the config.yml if we get to loading that.
export const winSettings = {
  magnitude: {
    min: 0,
    max: 10,
    step: 0.01,
  },
  frequency: {
    min: 0.01,
    max: 10,
    step: 0.01,
  }
}
export const PendulumConfigFormSchema = z.object({
  windMagnitude: z.number().min(winSettings.magnitude.min).max(winSettings.magnitude.max),
  windFrequency: z.number().min(winSettings.frequency.min).max(winSettings.frequency.max),
  restartOnCollision: z.boolean().refine(val => val, {}),
});
export type PendulumConfigForm = z.infer<typeof PendulumConfigFormSchema>;