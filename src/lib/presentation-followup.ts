// Narrow presentation-only phrases: new tickers, dates, refreshes and causal requests
// continue through the planner and cannot silently reuse a different analysis.
export function isPresentationFollowup(message:string){
 return /^(?:(?:can|could|would) you )?(?:please )?(?:explain(?: (?:it|this|that))? (?:more|further)|elaborate|tell me more|解釋多[啲點]|解释多[点些])(?:[?.!。？\s]*)$/i.test(message.trim());
}
