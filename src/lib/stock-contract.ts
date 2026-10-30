import {z} from 'zod';
export const stockRanges=['1mo','3mo','6mo','1y'] as const;
export const stockRangeSchema=z.enum(stockRanges);
export const stockSymbolSchema=z.string().regex(/^[A-Z][A-Z0-9.-]{0,14}$/);
export const stockContextSchema=z.object({symbol:stockSymbolSchema,range:stockRangeSchema}).strict();
export const stockResultSchema=z.object({symbol:stockSymbolSchema,name:z.string().max(160),exchange:z.string().max(60),type:z.enum(['EQUITY','ETF'])});
export const stockPointSchema=z.object({time:z.number().int().positive(),close:z.number().finite().positive(),volume:z.number().finite().nonnegative().nullable()});
export const stockQuoteSchema=z.object({symbol:stockSymbolSchema,name:z.string(),exchange:z.string(),currency:z.literal('USD'),price:z.number().finite().positive().nullable(),quoteTime:z.number().int().positive().nullable(),points:z.array(stockPointSchema).min(1).max(400)});
export const stockDataSchema=z.object({query:z.string().max(80),retrievedAt:z.string().datetime(),results:z.array(stockResultSchema).max(8),quote:stockQuoteSchema.nullable(),warnings:z.array(z.string()).max(10)});
export const stockAnalysisSchema=z.object({kind:z.literal('stocks'),range:stockRangeSchema,data:stockDataSchema,modules:z.array(z.enum(['price_history','price_and_volume'])).min(1).max(1),composer:z.object({provider:z.enum(['Laya','Gemini','Local']),model:z.string(),suggestedModule:z.enum(['price_history','price_and_volume']).optional(),elapsed_ms:z.number().nonnegative()}),plannerModel:z.string()});
export type StockRange=z.infer<typeof stockRangeSchema>;
export type StockContext=z.infer<typeof stockContextSchema>;
export type StockData=z.infer<typeof stockDataSchema>;
export type StockAnalysis=z.infer<typeof stockAnalysisSchema>;
export function stockWindow(points:z.infer<typeof stockPointSchema>[],range:StockRange){const days={ '1mo':30,'3mo':90,'6mo':180,'1y':366}[range];const last=points.at(-1)?.time||0;return points.filter(p=>p.time>=last-days*86400);}
