import {z} from 'zod';
export const wealthScenarioSchema=z.object({kind:z.literal('accumulator'),instrumentId:z.string(),name:z.string(),snapshot:z.string(),asOf:z.string(),shockPct:z.number().min(-100).max(30),days:z.number().int().min(1).max(60),shares:z.number().nonnegative(),cost:z.number().nonnegative(),value:z.number().nonnegative(),pnl:z.number(),path:z.array(z.object({day:z.number().int(),shares:z.number(),cost:z.number(),value:z.number()})).max(61),assumptions:z.array(z.string())}).strict();
export type WealthScenario=z.infer<typeof wealthScenarioSchema>;
