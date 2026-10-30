import { z } from "zod";
export const familySnapshotSchema = z
  .object({
    source: z.literal("supabase"),
    household: z.string().min(1),
    householdId:z.string().optional(),version:z.string().optional(),warnings:z.array(z.string()).optional(),
    dataMode: z.literal("mock"),
    asOf: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    retrievedAt: z.string().datetime(),
    holdings: z
      .array(
        z.object({
          id: z.string(),
          name: z.string(),
          fullName: z.string(),
          category: z.enum(["equity", "bond", "cash", "note", "alternative"]),
          value: z.number().finite().nonnegative(),
          cost: z.number().finite().nonnegative(),
          owner: z.string(),
        owners: z.array(z.string()).min(1),
          bank: z.string(),
          currency: z.string(),
          book: z.string(),
          bookId: z.string(),
          account: z.string(),
          sleeve: z.string(),
          quantity: z.number().finite(),
          instrumentId: z.string(),
          symbol:z.string().nullable().optional(),instrumentType:z.string().optional(),valuedAt:z.string().optional(),
        }),
      )
      .min(0)
      .max(100),
    total: z.number().finite().nonnegative(),
  })
  .strict();
export type FamilySnapshot = z.infer<typeof familySnapshotSchema>;
