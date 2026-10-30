import {z} from 'zod';
export const portfolioSnapshotSchema=z.object({
 source:z.literal('supabase'),dataMode:z.literal('mock'),snapshot:z.string(),asOf:z.string(),retrievedAt:z.string().datetime(),
 holdings:z.array(z.object({id:z.string(),name:z.string(),category:z.enum(['equity','bond','cash','note']),value:z.number().finite().nonnegative(),owner:z.string(),bank:z.string(),currency:z.enum(['USD','HKD','GBP'])})).min(1).max(100),
 total:z.number().finite().positive()
}).strict();
export type PortfolioSnapshot=z.infer<typeof portfolioSnapshotSchema>;
