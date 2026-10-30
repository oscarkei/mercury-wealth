// One budget table for SDK calls, stage guards and the streaming route.
export const AI_TIMEOUTS={
 planning:75000,
 planningAttempt:20000,
 researchData:35000,
 fedData:10000,
 stockData:19000,
 researchComposition:10000,
 compositionRequest:12000,
 fedComposition:25000,
 explanation:100000,
 explanationAttempt:25000,
 explanationRepair:45000,
 routing:25000,
 workflow:230000,
} as const;
export const MAX_BRANCH_BUDGET=Math.max(
 AI_TIMEOUTS.planning+AI_TIMEOUTS.researchData+AI_TIMEOUTS.researchComposition+AI_TIMEOUTS.explanation,
 AI_TIMEOUTS.planning+AI_TIMEOUTS.fedData+AI_TIMEOUTS.fedComposition+AI_TIMEOUTS.explanation,
 AI_TIMEOUTS.planning+AI_TIMEOUTS.stockData+AI_TIMEOUTS.compositionRequest+AI_TIMEOUTS.explanation,
 AI_TIMEOUTS.planning+Math.max(AI_TIMEOUTS.routing,AI_TIMEOUTS.explanation),
);
