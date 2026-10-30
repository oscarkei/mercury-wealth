export const SNAPSHOT = 'MW-DEMO-2026-10-24-v1';
export const DEMO_DATE = '2026-10-24';
export const TOTAL = 8420000;
export const FX = { USD: 1, HKD: 7.8, GBP: 0.77 } as const;
export type Currency = keyof typeof FX;
export const allocation = [
  { id: 'equity', name: 'Equities', value: 3536400, percent: 42, color: '#56685b' },
  { id: 'bond', name: 'Bonds', value: 2357600, percent: 28, color: '#959e88' },
  { id: 'cash', name: 'Cash', value: 1515600, percent: 18, color: '#d3c5a7' },
  { id: 'note', name: 'Structured products', value: 1010400, percent: 12, color: '#9186b0' }
];
export const holdings = [
  { id:'H1', name:'Global equity fund', category:'equity', value:2200000, owner:'Alex Chan', bank:'Bank A', currency:'USD' },
  { id:'H2', name:'Asia equity portfolio', category:'equity', value:1336400, owner:'Family Holdings', bank:'Bank B', currency:'HKD' },
  { id:'H3', name:'Investment-grade bond fund', category:'bond', value:1457600, owner:'Alex Chan', bank:'Bank A', currency:'USD' },
  { id:'H4', name:'Short-duration bonds', category:'bond', value:900000, owner:'Family Holdings', bank:'Bank C', currency:'USD' },
  { id:'H5', name:'USD cash', category:'cash', value:1000000, owner:'Alex Chan', bank:'Bank A', currency:'USD' },
  { id:'H6', name:'HKD cash · USD equivalent', category:'cash', value:515600, owner:'Family Holdings', bank:'Bank B', currency:'HKD' },
  { id:'H7', name:'Note A · scheduled maturity', category:'note', value:250000, owner:'Alex Chan', bank:'Bank A', currency:'USD' },
  { id:'H8', name:'Structured note portfolio', category:'note', value:760400, owner:'Family Holdings', bank:'Bank C', currency:'USD' }
];
export const changes = { opening:8300000, market:80000, fx:10000, flow:30000, unclassified:0, closing:8420000 };
export const events = [
  { id:'coupon', day:'05', month:'NOV', date:'2026-11-05', title:'票息支付', amount:10000, currency:'USD', kind:'scheduled', label:'按條款排期', description:'示範票據組合票息 USD 10,000。付款按條款確認，未計入目前現金。', observation:'2026-10-30', settlement:'2026-11-06' },
  { id:'maturity', day:'20', month:'NOV', date:'2026-11-20', title:'Note A 即將到期', amount:250000, currency:'USD', kind:'scheduled', label:'按條款排期', description:'Note A 本金 USD 250,000。實際回款金額及日期按產品條款、發行商履約與結算確認。', observation:'2026-11-18', settlement:'2026-11-23' },
  { id:'autocall', day:'15', month:'DEC', date:'2026-12-15', title:'提早贖回觀察', amount:150000, currency:'USD', kind:'conditional', label:'取決於條件', description:'只有觀察日達到示範觸發條件，才可能提早贖回；本金未列為已可用現金。', observation:'2026-12-15', settlement:'2026-12-18' }
] as const;
export const TERMS = { id:'SP-DEMO-01', version:'v1', notional:100000, currency:'HKD', years:0.5, annualCoupon:0.08, strike:80, initial:100 } as const;
export function payoff(shock:number) {
  if (!Number.isFinite(shock) || shock < -100 || shock > 30) throw new Error('股價變化必須介乎 -100% 至 +30%。');
  const finalLevel=100+shock, coupon=4000, principal=Math.round(100000*Math.min(1,finalLevel/80)*100)/100;
  return { shock, finalLevel, principal, coupon, total:principal+coupon, net:principal+coupon-100000, terms:TERMS.id+'-'+TERMS.version, snapshot:SNAPSHOT };
}
export function money(n:number, currency:Currency='USD', compact=false) {
  return new Intl.NumberFormat('en-US',{style:'currency',currency,currencyDisplay:'narrowSymbol',maximumFractionDigits:compact?2:0,notation:compact?'compact':'standard'}).format(n);
}
export function cashScenario(includeConditional=false) {
  return { available:1515600, scheduled:260000, conditional:includeConditional?150000:0, projected:1515600+260000+(includeConditional?150000:0) };
}
export const routes = ['overview','allocation','liquidity','sp','research','family','tax','proposal'] as const;
export type Route = typeof routes[number];
export const routeNames:Record<Route,string>={overview:'財富全景',allocation:'配置與持倉',liquidity:'現金與未來事件',sp:'SP 情境模擬',research:'研究與持倉',family:'家庭與傳承',tax:'跨境資產整理',proposal:'顧問提案'};
export const components = ['Source','Allocation','Exposure','Holdings','WealthChange','CashTimeline','Comparison','Terms','ScenarioControl','Payoff','Risk','PortfolioImpact','QuoteDraft','Research','FamilyMap','FactsGap','SpecialistBrief','Proposal'] as const;
export type Component = typeof components[number];
export type Focus = 'balanced'|'downside'|'income'|'portfolio';
export type Spec = { version:1; snapshot:string; route:Route; focus:Focus; components:Component[] };
export function compose(route:Route, focus:Focus='balanced'):Spec {
  const base:Record<Route,Component[]>={
    overview:['Source','Allocation','WealthChange','CashTimeline'],
    allocation:['Source','Allocation','Exposure','Holdings'],
    liquidity:['Source','CashTimeline','Comparison'],
    sp:['Source','Terms','ScenarioControl','Payoff','Risk','QuoteDraft'],
    research:['Source','Research','Allocation'],family:['Source','FamilyMap','FactsGap','SpecialistBrief'],
    tax:['Source','FamilyMap','FactsGap','SpecialistBrief'],proposal:['Source','Proposal']
  };
  let parts=[...base[route]];
  if (route==='sp' && focus==='downside') parts=['Source','Terms','Risk','ScenarioControl','Payoff','Comparison','QuoteDraft'];
  if (route==='sp' && focus==='income') parts=['Source','Terms','Payoff','ScenarioControl','Risk','Comparison','QuoteDraft'];
  if (route==='sp' && focus==='portfolio') parts=['Source','Terms','PortfolioImpact','ScenarioControl','Payoff','Risk','QuoteDraft'];
  if (route==='allocation' && focus==='portfolio') parts=['Source','Exposure','Holdings','Allocation'];
  return {version:1,snapshot:SNAPSHOT,route,focus,components:parts};
}
export function validSpec(input:unknown):input is Spec {
  if (!input || typeof input!=='object') return false;
  const s=input as Spec;
  if (s.version!==1 || s.snapshot!==SNAPSHOT || !routes.includes(s.route) || !['balanced','downside','income','portfolio'].includes(s.focus)) return false;
  if (!Array.isArray(s.components)||s.components.length>12||s.components.length<1||new Set(s.components).size!==s.components.length) return false;
  if (!s.components.every(x=>components.includes(x)) || s.components[0]!=='Source') return false;
  // Match a server-owned candidate set; provider output cannot introduce arbitrary props/actions.
  return JSON.stringify(s.components)===JSON.stringify(compose(s.route,s.focus).components);
}
export function parseShock(message:string, previous=-40) {
  const m=message.match(/(?:跌|下跌|跌咗|fall|down|drop)\s*(\d+(?:\.\d+)?)\s*[%％]/i);
  const signed=message.match(/([+-]\d+(?:\.\d+)?)\s*[%％]/);
  const up=message.match(/(?:升|上升|rise|up)\s*(\d+(?:\.\d+)?)\s*[%％]/i);
  const value=m?-Number(m[1]):signed?Number(signed[1]):up?Number(up[1]):previous;
  if(value < -100 || value > 30) throw new Error('情境範圍為跌 100% 至升 30%，請輸入範圍內嘅數字。');
  return value;
}
export function infer(message:string, context:string):{route:Route|'clarify';focus:Focus} {
  const m=message.toLowerCase();
  const focus:Focus=/集中|持倉|portfolio|exposure/.test(m)?'portfolio':/風險|損失|跌|down|loss|risk/.test(m)?'downside':/息|coupon|income/.test(m)?'income':'balanced';
  if (/唔係.*(?:note|票據)|不是.*(?:note|票據)|not.*(?:note|structured)/i.test(m)) return {route:/股票|equity|stock|配置|持倉/.test(m)?'allocation':'clarify',focus};
  const sp=/\bnote\b|\bsp\b|eln|fcn|票據|結構產品|掛鈎/.test(m) || (context==='note' && /跌|升|風險|票息|本金|情境|loss|coupon|risk/.test(m));
  if (sp) return {route:'sp',focus};
  if (/trust|信託|傳承|交棒|遺囑|賣.*(?:盤|生意)|出售企業|家族/.test(m)) return {route:'family',focus};
  if (/移居|稅|tax|uk|英國|搬.*英|跨境/.test(m)) return {route:'tax',focus};
  if (/research|研究|市場觀點/.test(m)) return {route:'research',focus};
  if (/現金|到期|流動|收息|學費|定存|保本|liquid|cash|matur/.test(m)) return {route:'liquidity',focus};
  if (/提案|proposal|顧問建議/.test(m)) return {route:'proposal',focus};
  if (/股票|equity|stock|配置|集中|持倉|allocation|bank|銀行|擁有/.test(m)) return {route:'allocation',focus};
  if (/變化|點解.*變|changed|回報|收益|總值|資產|wealth/.test(m)) return {route:'overview',focus};
  return {route:'clarify',focus};
}
export function mockReply(route:Route|'clarify',shock:number) {
  const p=payoff(shock);
  const replies:Record<Route|'clarify',string>={
    sp:`按 SP-DEMO-01 v1 示範條款，股價${shock<0?'跌':'升'} ${Math.abs(shock)}%：本金回款 HK$${p.principal.toLocaleString('en-US')}，半年票息 HK$4,000，合計 HK$${p.total.toLocaleString('en-US')}；淨${p.net<0?'損失':'收益'} HK$${Math.abs(p.net).toLocaleString('en-US')}。假設發行商履約、未扣費稅；並非報價。`,
    overview:'本期示範資產增加 USD 120,000：市場 +80,000、匯率 +10,000、淨投入 +30,000。投入唔計作投資收益。來源：2026-10-24 示範快照。',
    allocation:'股票佔示範資產 42%，債券 28%，現金 18%，結構產品 12%。工作區可按擁有人或銀行查看持倉。基金穿透資料未接入。',
    liquidity:'目前現金 USD 1,515,600 等值。未來排期回款 USD 260,000，另有條件性事件 USD 150,000；兩者都未計入目前可用現金。你預計幾時需要用款？',
    research:'研究工作區只提供來源及關聯示意，尚未接入授權研究 feed。債券佔示範資產 28%；可以整理期限與流動性問題俾顧問討論。',
    family:'可以先整理家庭角色、控制權同資金用途，再比較信託、遺囑及公司持有。你最想保留邊一種控制權？工作區可儲存專家討論草稿。',
    tax:'先整理移居日期、居民身份及各地資產，再交跨境專家覆核。你計劃幾時搬？工作區可儲存事實及待確認項目，唔會自動計稅。',
    proposal:'示範 APM 提案 v2 將現金由 18% 增至 23%，結構產品由 12% 減至 7%，其他不變；估算成本 USD 800。可比較及記錄模擬回應。DPM 另顯示授權管理進度。',
    clarify:'你想了解邊項資產或事件？我會保留目前工作區。'
  };
  return replies[route];
}
