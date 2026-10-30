"use client";
// mercury-localized
import {usePublicMock} from './mobile-preview-content';
import {copy,statusText,localize,useAppPreferences,locale} from "../lib/app-preferences";
import PortfolioScope from "./portfolio-scope";
import WealthDecision from "./wealth-decision";
import DocumentVault from "./document-vault";
import ClientNotifications,{useClientRecords,type ClientNotice} from "./client-notifications";
import {homeResearch} from "../lib/home-research";
import AdvisorProposals from "./advisor-proposals";
import {MercuryMark,MercuryWordmark} from "./mercury-brand";
import HybridChatResult,{type HybridRun} from './hybrid-chat-result';
import RetryExplanation from './retry-explanation';
import WealthScenarioCard from './wealth-scenario';
import {wealthScenarioSchema,type WealthScenario} from '../lib/wealth-scenario-contract';
import { useEffect, useRef, useState, type ReactNode } from "react";
import { FX, type Currency } from "../lib/domain";
import {
  products,
  productById,
  evaluateProduct,
  scenarioPaths,
  projectedPayoff,
  type ProductId,
  type PathPreset,
} from "../lib/structured-products";

import StockAnalysisCard from "./stock-analysis";
import PortfolioImpactCard from "./portfolio-impact";
import {portfolioImpactSchema,type PortfolioImpact} from "../lib/portfolio-impact";
import InteractiveInput from "./interactive-input";
import {inputRequestSchema,type InputRequest,type UIInteraction,type UILanguage} from "../lib/interactive-ui";
import ResearchAnalysisCard from "./research-analysis";
import RichResearchResponse from "./rich-research-response";
import {richResponseSchema,type RichResponse} from "../lib/rich-response";
import {researchAnalysisSchema,type ResearchAnalysis,type ResearchPlan} from "../lib/research-contract";
import {
  stockAnalysisSchema,
  type StockAnalysis,
  type StockContext,
} from "../lib/stock-contract";
import FedAnalysisCard, { type FedSelection } from "./fed-analysis";
import { fedAnalysisSchema, type FedAnalysis } from "../lib/fed-contract";
import { requestAssistant } from "../lib/assistant-client";
import { defaultGeminiModel, geminiModelLabels, geminiModelSchema, type GeminiModel } from "../lib/gemini-model";
import {
  actionLabels,
  type ConnectionStatus,
  type AssistantEvent,
  type Destination,
} from "../lib/assistant-contract";

import {
  ChartNoAxesCombined,
  ChartSpline,
  Zap,
  Sparkles,
  ArrowRight,
  ArrowUpRight,
  ChevronDown,
  X,
  Check,
  Clock3,
  FileText,
  SlidersHorizontal,
  ArrowUp,
  Search,
  ArrowLeft,
  Download,
  ShieldCheck,
  CalendarDays,
  Ellipsis,
  Database,
  Wallet,
  Bell,
  CircleHelp,
  House,
  type LucideIcon,
} from "lucide-react";
import { Button } from "./ui/button";
import { Sheet, SheetContent, SheetTitle, SheetDescription } from "./ui/sheet";
import { Tabs, TabsList, TabsTrigger } from "./ui/tabs";
import MercuryComposer from "./kokonutui/mercury-composer";
import FamilyWorkspace from "./family-workspace";
import ChatStarters from "./chat-starters";
import {TouchPicker} from "./touch-sheet";
import ProductCatalog from "./product-catalog";
import AccumulatorSimulator from "./accumulator-simulator";
import {
  family,
  assetNames,
  assetColors,
  allocationFor,
  type FamilyScope,
} from "../lib/family-portfolio";
import {
  familySnapshotSchema,
  type FamilySnapshot,
} from "../lib/family-contract";

type View =
  | "overview"
  | "portfolio"
  | "products"
  | "simulator"
  | "insights"
  | "documents";
type Filter = "all" | "equity" | "bond" | "cash" | "note" | "alternative";
type Draft = { id: string; title: string; body: string; created: string };
type Message = {
  scopeKey?:string;
  hybridRunId?:string;
  hybridRun?:HybridRun;
  inputRequest?:InputRequest;
  role: "user" | "assistant";
  text: string;
  action?: "portfolio" | "products" | "cash" | "proposal" | "brief" | "catalog";
  label?: string;
  id?: string;
  source?: string;
  model?: string;
  aiAction?: AssistantEvent;
  analysis?: FedAnalysis;
  stockAnalysis?: StockAnalysis;
  researchAnalysis?: ResearchAnalysis;
  richResponse?: RichResponse;
  portfolioImpact?:PortfolioImpact;
  wealthScenario?:WealthScenario;
  question?: string;
  issue?: string;
  resumeRequestId?: string;
  retryReadyAt?: number;
  steps?: AssistantEvent[];
};
type Modal =
  | "profile"
  | "help"
  | "notifications"
  | "more"
  | "data"
  | "cash"
  | "proposal"
  | "adviser"
  | "settings"
  | "reset"
  | "terms"
  | "receipt"
  | "brief"
  | null;
const names: Record<Filter, string> = {
  alternative: "Alternatives",
  all: "All assets",
  equity: "Equities",
  bond: "Fixed income",
  cash: "Cash",
  note: "Structured products",
};
const palette: Record<Filter, string> = {
  alternative: "#ba8569",
  all: "#174f4d",
  equity: "#174f4d",
  bond: "#71a297",
  cash: "#d7bc7b",
  note: "#8c82b3",
};
const titles: Record<View, string> = {
  overview: "Overview",
  portfolio: "Portfolio",
  products: "Product studio",
  simulator: "Simulator",
  insights: "Insights & actions",
  documents: "Your documents",
};
const navItems: [View, string, string][] = [
  ["overview", "Overview", "overview"],
  ["portfolio", "Portfolio", "portfolio"],
  ["products", "Structured products", "products"],
  ["insights", "Insights & actions", "insight"],
];
const storage = "mercury-okonkwo-v1";
function uuid() {
  return (
    globalThis.crypto?.randomUUID?.() ||
    Date.now().toString(36) + "-" + Math.random().toString(36).slice(2)
  );
}
const dollars = (n: number, compact = false) =>
  "$" +
  new Intl.NumberFormat(locale(), {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 2 : 0,
  }).format(n);
function Icon({ name, size = 20 }: { name: string; size?: number }) {
 useAppPreferences();

  const icons: Record<string, LucideIcon> = {
    overview: House,
    portfolio: ChartNoAxesCombined,
    products: ChartSpline,
    insight: Zap,
    chat: Sparkles,
    arrow: ArrowRight,
    up: ArrowUpRight,
    down: ChevronDown,
    close: X,
    check: Check,
    clock: Clock3,
    document: FileText,
    settings: SlidersHorizontal,
    send: ArrowUp,
    search: Search,
    back: ArrowLeft,
    download: Download,
    shield: ShieldCheck,
    calendar: CalendarDays,
    more: Ellipsis,
    data: Database,
    cash: Wallet,
    bell: Bell,
    help: CircleHelp,
  };
  const Glyph = icons[name] || ArrowRight;
  return <Glyph size={size} strokeWidth={1.65} aria-hidden="true" />;
}
function Label({ children }: { children: ReactNode }) {
 useAppPreferences();

  return <div className="eyebrow">{localize(children)}</div>;
}
function Badge({
  children,
  tone = "",
}: {
  children: ReactNode;
  tone?: string;
}) {
 useAppPreferences();

  return <span className={"badge " + tone}>{localize(children)}</span>;
}

export default function WealthPortal() {
  const publicMock=usePublicMock();
  const {theme,setTheme,language,setLanguage}=useAppPreferences();
  const clientRecords=useClientRecords();

  const [view, setView] = useState<View>("overview"),
    [currency, setCurrency] = useState<Currency>("USD"),
    [filter, setFilter] = useState<Filter>("all"),
    [group, setGroup] = useState("asset"),
    [search, setSearch] = useState(""),
    [owner, setOwner] = useState("all"),
    [period, setPeriod] = useState("6M"),
    [hover, setHover] = useState<number | null>(null);
  const [scope, setScope] = useState<FamilyScope>({ bank: "all", book: "all" });
  const [simulatorKind, setSimulatorKind] = useState<"note" | "accumulator">(
    "accumulator",
  );
  const [product, setProduct] = useState<ProductId>("phoenix"),
    [preset, setPreset] = useState<PathPreset | null>("base"),
    [path, setPath] = useState([...scenarioPaths.base]),
    [chartTab, setChartTab] = useState<"path" | "payoff">("path"),
    [showLines, setShowLines] = useState(true),
    [observed, setObserved] = useState(3);
  const [chatOpen, setChatOpen] = useState(false),
    [chatContext, setChatContext] = useState("Your whole portfolio"),
    [messages, setMessages] = useState<Message[]>([]),
    [input, setInput] = useState(""),
    [busy, setBusy] = useState(false),
    [drafts, setDrafts] = useState<Draft[]>([]),
    [receipt, setReceipt] = useState<Draft | null>(null),
    [modal, setModal] = useState<Modal>(null),
    [holding, setHolding] = useState<string | null>(null),
    [toast, setToast] = useState(""),
    [ready, setReady] = useState(false);
  const [insightFilter, setInsightFilter] = useState("all"),
    [dismissed, setDismissed] = useState<string[]>([]),
    [brief, setBrief] = useState(""),
    [mandate, setMandate] = useState("APM"),
    [accepted, setAccepted] = useState(false),
    [ack, setAck] = useState(false),
    [cashReserve, setCashReserve] = useState(100000),
    [cashChoice, setCashChoice] = useState("Keep liquid"),
    [showConditional, setShowConditional] = useState(false);
  const [aiStatus, setAiStatus] = useState<ConnectionStatus | null>(null),
    [aiMode, setAiMode] = useState<"demo" | "live">("demo"),
    [geminiModel, setGeminiModel] = useState<GeminiModel>(defaultGeminiModel),
    [connectionError, setConnectionError] = useState("");
  const [databaseSnapshot, setDatabaseSnapshot] =
      useState<FamilySnapshot | null>(null),
    [databaseState, setDatabaseState] = useState<
      "local" | "loading" | "supabase" | "error"
    >("local");
  const [savedResearch,setSavedResearch]=useState<string[]>([]);
  useEffect(()=>{if(view!=="documents")return;try{const v=JSON.parse(localStorage.getItem("mercury-saved-research")||"[]");setSavedResearch(Array.isArray(v)?v.filter((id:unknown)=>typeof id==="string"):[]);}catch{setSavedResearch([]);}},[view]);
  const databaseRevision = useRef(0);
  const holdings = databaseSnapshot?.holdings || family.holdings,
    TOTAL = databaseSnapshot?.total ?? family.total;
  const allocation = allocationFor(holdings.filter(h=>(scope.bank==='all'||h.bank===scope.bank)&&(scope.book==='all'||h.bookId===scope.book))).map((a) => ({
    ...a,
    name: assetNames[a.id],
  }));
  const [stockContext, setStockContext] = useState<StockContext | undefined>(
    undefined,
  );
  const [researchContext,setResearchContext]=useState<ResearchPlan|undefined>(undefined);
  const [fedContext, setFedContext] = useState<FedSelection | undefined>(
    undefined,
  );
  const activeScope=useRef(scope);
  activeScope.current=scope;
  const conversationId = useRef<string>("");
  const aiAbort = useRef<AbortController | null>(null),
    aiRevision = useRef(0),
    aiActive = useRef<string | null>(null);
  useEffect(()=>{aiAbort.current?.abort();aiActive.current=null;setBusy(false);setResearchContext(undefined);setStockContext(undefined);setFedContext(undefined);},[scope.bank,scope.book]);
  const dialog = useRef<HTMLDialogElement>(null),
    focusBefore = useRef<HTMLElement | null>(null),
    chatInput = useRef<HTMLTextAreaElement>(null),
    chatBottom = useRef<HTMLDivElement>(null),
    responseTimer = useRef<ReturnType<typeof setTimeout> | null>(null),
    chatTrigger = useRef<HTMLElement | null>(null);
  const p = productById(product),
    outcome = evaluateProduct(product, path),
    fx = FX[currency];
  const money = (usd: number, compact = false) =>
    dollars(usd * fx, compact).replace("$", currency === "GBP" ? "£" : "$");
  const selected = holdings.find((h) => h.id === holding);
  const messageInScope=(m:Message)=>m.scopeKey===JSON.stringify(scope);
  const filtered = holdings.filter(
    (h) =>
      (filter === "all" || h.category === filter) &&
      (owner === "all" || h.owner === owner) &&
      [h.name, h.bank, h.owner]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase()),
  );
  const totalShown = filtered.reduce((n, h) => n + h.value, 0);
  useEffect(() => {
    try {
      const s = JSON.parse(localStorage.getItem(storage) || "null");
      if (s) {
        setGeminiModel('deepseek-flash');
        if(typeof s.conversationId === "string" && /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(s.conversationId)) conversationId.current=s.conversationId;
        if (["USD", "HKD", "GBP"].includes(s.currency)) setCurrency(s.currency);
        if (Array.isArray(s.drafts))
          setDrafts(
            s.drafts
              .filter(
                (d: Draft) =>
                  typeof d.title === "string" &&
                  typeof d.body === "string" &&
                  typeof d.created === "string",
              )
              .slice(0, 50),
          );
        if (Array.isArray(s.messages))
          setMessages(
            s.messages
              .filter(
                (m: Message) =>
                  ["user", "assistant"].includes(m.role) &&
                  typeof m.text === "string",
              )
              .slice(-60)
              .map((m: Message) => ({
                ...m,
                analysis: fedAnalysisSchema.safeParse(m.analysis).success
                  ? m.analysis
                  : undefined,
                wealthScenario:wealthScenarioSchema.safeParse(m.wealthScenario).success?m.wealthScenario:undefined,
                portfolioImpact:portfolioImpactSchema.safeParse(m.portfolioImpact).success?m.portfolioImpact:undefined,
                inputRequest: inputRequestSchema.safeParse(m.inputRequest).success?m.inputRequest:undefined,
                richResponse: richResponseSchema.safeParse(m.richResponse).success?m.richResponse:undefined,
                researchAnalysis: researchAnalysisSchema.safeParse(m.researchAnalysis).success?m.researchAnalysis:undefined,
                stockAnalysis: stockAnalysisSchema.safeParse(m.stockAnalysis)
                  .success
                  ? m.stockAnalysis
                  : undefined,
              })),
          );
        if (Array.isArray(s.dismissed)) setDismissed(s.dismissed);
        setAccepted(Boolean(s.accepted));
      }
    } catch {}
    function readHash() {
      const id = location.hash.slice(1);
      setHolding(id.startsWith("holding/")?decodeURIComponent(id.slice(8)):null);
      if (id in titles) setView(id as View);
      setChatOpen(id === "chat");
    }
    readHash();
    window.addEventListener("hashchange", readHash);
    window.addEventListener("popstate", readHash);
    setReady(true);
    return () => {
      window.removeEventListener("hashchange", readHash);
      window.removeEventListener("popstate", readHash);
      if (responseTimer.current) clearTimeout(responseTimer.current);
      aiAbort.current?.abort();
    };
  }, []);
  useEffect(() => {
    if (location.protocol === "http:" || location.protocol === "https:") {
      if(!publicMock)void refreshAI();
      void refreshPortfolio();
    }
  }, []);
  useEffect(()=>{
    if(!ready||window.parent===window)return;
    try{
      const parent=window.parent;
      if(parent.location.pathname==='/phone')parent.history.replaceState(null,'',parent.location.pathname+parent.location.search+location.hash);
    }catch{}
  },[ready,view,chatOpen,holding]);
  useEffect(() => {
    if (ready) {
      try {
        localStorage.setItem(
          storage,
          JSON.stringify({ drafts, messages:messages.map(({hybridRun,...message})=>message), dismissed, accepted, currency, geminiModel, conversationId:conversationId.current }),
        );
      } catch {}
    }
  }, [drafts, messages, dismissed, accepted, currency, geminiModel, ready]);
  useEffect(() => {
    if (toast) {
      const id = setTimeout(() => setToast(""), 4500);
      return () => clearTimeout(id);
    }
  }, [toast]);
  const chatScrollTarget=useRef('');
  useEffect(() => {
    if (!chatOpen) { chatScrollTarget.current=''; return; }
    const last=messages.at(-1);
    if(last?.hybridRun){
      // Start at the judgement, not at the footnotes. Do not pull the reader
      // away when they scroll through an already-rendered response.
      const target=String(last.id)+':'+last.hybridRun.status;
      if(chatScrollTarget.current!==target){
        chatScrollTarget.current=target;
        const items=chatBottom.current?.parentElement?.querySelectorAll('.chat-message');
        items?.[items.length-1]?.scrollIntoView({block:'start'});
      }
    }else if(last?.analysis||last?.stockAnalysis||last?.researchAnalysis){
      const items=chatBottom.current?.parentElement?.querySelectorAll('.chat-message');
      items?.[items.length-1]?.scrollIntoView({block:'start'});
    }else chatBottom.current?.scrollIntoView({block:'nearest'});
  }, [messages,busy,chatOpen]);
  useEffect(() => {
    const d = dialog.current;
    if (modal && d && !d.open) {
      focusBefore.current = document.activeElement as HTMLElement;
      d.showModal();
    } else if (!modal && d?.open) {
      d.close();
      if (focusBefore.current?.isConnected) focusBefore.current.focus();
      else document.getElementById("main")?.focus({ preventScroll: true });
    }
  }, [modal, holding]);
  function openHolding(id:string){history.pushState({mercuryHolding:true},"","#holding/"+encodeURIComponent(id));setHolding(id);}
  function closeHolding(){setHolding(null);if(history.state?.mercuryHolding)history.back();else history.replaceState(null,"","#portfolio");}
  function go(next: View) {
    setView(next);
    setModal(null);
    setHolding(null);
    setChatOpen(false);
    if (history.state?.mercuryChat) history.replaceState(null, "", "#" + next);
    else if (location.hash !== "#" + next)
      history.pushState(null, "", "#" + next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }
  function portfolio(next: Filter = "all") {
    setFilter(next);
    setSearch("");
    setOwner("all");
    go("portfolio");
  }
  function selectProduct(id: ProductId) {
    setProduct(id);
    setPreset("base");
    setPath([...scenarioPaths.base]);
    setSimulatorKind("note");
    go("simulator");
  }
  function closeChat() {
    setChatOpen(false);
    if (history.state?.mercuryChat) history.back();
    else if (location.hash === "#chat")
      history.replaceState(null, "", "#" + view);
  }
  function answer(text: string, context: string): Message {
    const qFamily = text.toLowerCase();
    if (
      /my (structured product|note)/.test(qFamily) &&
      !/example|scenario/i.test(context)
    )
      return {
        role: "assistant",
        text: "Your held product is the AAPL Accumulator, not the example coupon notes. Its 88% strike, 105% knock-out and 2× gearing determine the share-purchase obligations. Use its separate simulator to inspect a simplified path.",
        action: "catalog",
        label: "View my product",
      };
    if (
      /accumulat|aapl accumulator/.test(qFamily + " " + context.toLowerCase())
    )
      return {
        role: "assistant",
        text: "Okonkwo holds the CCB AAPL Accumulator in the Thematic Equity book at UBS. Strike 88%, knock-out 105%, no knock-in or fixed coupon. Daily purchases double from 40 to 80 shares below strike. Expected return depends on the full price path and settlement terms.",
      };
    if (/cash|liquid|matur|proceeds/.test(qFamily))
      return {
        role: "assistant",
        text: `Okonkwo’s cash totals ${dollars(holdings.filter((h) => h.category === "cash").reduce((n, h) => n + h.value, 0))} USD across the three investment books. The imported snapshot is dated 19 June 2026. No future product proceeds are counted as available cash.`,
        action: "cash",
        label: "View cash by book",
      };
    if (
      /allocation|holdings|portfolio|wealth|book|custodian|target|proposal|changed|increase|return/.test(
        qFamily,
      ) &&
      !/scenario|note|phoenix|autocall|fcn/.test(qFamily)
    )
      return {
        role: "assistant",
        text: `Okonkwo Family: ${dollars(TOTAL)} USD market value, ${holdings.length} positions, 2 custodians and 3 investment books. ${allocation.map((a) => `${a.name} ${a.percent.toFixed(1)}%`).join(" · ")}. Imported demo as of 19 June 2026. Historical NAV, complete external flows and approved targets are not linked; unrealised gain is not a performance return.`,
        action: "portfolio",
        label: "Review family holdings",
      };
    const requestedProduct: ProductId = /note a/i.test(text + " " + context)
      ? "note-a"
      : /asia equity|fcn/i.test(text + " " + context)
        ? "fcn"
        : /phoenix|technology autocall/i.test(text + " " + context)
          ? "phoenix"
          : product;
    const p = productById(requestedProduct);
    const q = text.toLowerCase(),
      match = q.match(
        /(?:fall(?:s)?|drop(?:s)?|down|decline(?:s)?)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/,
      ),
      up = q.match(/(?:rise|up|gain)\s*(?:by\s*)?(\d+(?:\.\d+)?)\s*%/);
    const holdingContext = holdings.find((h) => h.name === context);
    if (
      holdingContext &&
      holdingContext.category !== "note" &&
      /explain|holding|value|owner|bank/.test(q)
    )
      return {
        role: "assistant",
        text: `${holdingContext.name} is held by ${holdingContext.owner} at ${holdingContext.bank}. Its USD-equivalent value is ${dollars(holdingContext.value)}, representing ${((holdingContext.value / TOTAL) * 100).toFixed(2)}% of your portfolio. Account currency: ${holdingContext.currency}. This is the fictional 19 June 2026 snapshot.`,
        action: "portfolio",
        label: "Open allocation and holdings",
      };
    if (
      /note|structured|autocall|barrier|coupon|payoff|fcn/.test(q) ||
      (/product|note|autocall/i.test(context) &&
        /fall|drop|loss|risk|what if|matur/.test(q))
    ) {
      if ((match && Number(match[1]) > 100) || (up && Number(up[1]) > 30))
        return {
          role: "assistant",
          text: "This demo supports a final underlying level from 0% to 130%: a fall of up to 100% or a rise of up to 30%. Please enter a scenario within that range. Your existing scenario has been kept.",
        };
      const next = [...path];
      if (match) next[6] = Math.max(0, 100 - Number(match[1]));
      if (up) next[6] = Math.min(150, 100 + Number(up[1]));
      const result = evaluateProduct(requestedProduct, next);
      setProduct(requestedProduct);
      if (match || up) {
        setPath(next);
        setPreset(null);
      }
      if (/barrier|how.*work|explain.*terms|explain.*product$/.test(q))
        return {
          role: "assistant",
          text:
            requestedProduct === "phoenix"
              ? `${p.name} checks the worst-performing underlying each month. A coupon is paid only at or above 70%. From month 3, a level of 100% or higher triggers early redemption. If it reaches maturity, the 60% barrier is tested only at the final observation. Below it, capital follows the worst underlying’s final level. These are the sample term sheet’s rules.`
              : `${p.name} pays a fixed ${p.annualCoupon}% annual coupon. At maturity, capital is repaid in full at or above the 80% strike. Below 80%, capital equals notional × final worst-underlying level ÷ 80. This sample note has no autocall or separate knock-in feature.`,
          action: "products",
          label: "Explore the product visually",
        };
      return {
        role: "assistant",
        text: `For ${p.name}, this path ${result.calledAt ? `triggers early redemption in month ${result.calledAt}` : `ends at ${next[6]}% of the initial level`}. Capital returned: USD ${result.redemption.toLocaleString(locale())}. Coupons: USD ${result.coupon.toLocaleString(locale())}. Total: USD ${result.total.toLocaleString(locale())}; net ${result.net < 0 ? "loss" : "gain"} USD ${Math.abs(result.net).toLocaleString(locale())}.${result.calledAt ? " Later prices do not change an already-redeemed note." : ""} This is a scenario, assuming issuer performance and excluding fees and taxes.`,
        action: "products",
        label: "Open this scenario",
      };
    }
    if (/cash|matur|liquid|deposit|tuition/.test(q))
      return {
        role: "assistant",
        text: `Cash is ${dollars(holdings.filter((h) => h.category === "cash").reduce((n, h) => n + h.value, 0))} USD in the imported Okonkwo snapshot.`,
        action: "cash",
        label: "View cash by book",
      };
    if (/allocat|holding|stock|equit|concentrat|portfolio|bank/.test(q))
      return {
        role: "assistant",
        text:
          allocation
            .map((a) => `${a.name}: ${a.percent.toFixed(1)}%`)
            .join(" · ") +
          ". Okonkwo demo, 19 June 2026. No approved target is linked.",
        action: "portfolio",
        label: "Review family holdings",
      };
    if (/proposal|rebalance|adviser|advisor/.test(q))
      return {
        role: "assistant",
        text: "No approved Okonkwo proposal is linked. Prepare a brief with the objectives of each book for your adviser.",
        action: "proposal",
        label: "Prepare adviser review",
      };
    if (/trust|family|succession|tax|relocat|uk|inherit/.test(q))
      return {
        role: "assistant",
        text: "We can turn this into a focused discussion with a specialist. Capture your intended timing, who owns the assets, the jurisdictions involved and what control you want to retain. Which outcome matters most to you?",
        action: "brief",
        label: "Prepare a specialist brief",
      };
    if (/change|return|perform|grow|gain|wealth|increase/.test(q))
      return {
        role: "assistant",
        text: "Historical NAV and complete external flows are not available for Okonkwo. The cost / market value view shows the unrealised change on current holdings, not a time-weighted return.",
        action: "portfolio",
        label: "Review family holdings",
      };
    if (/hello|^hi\b|help|what can/.test(q))
      return {
        role: "assistant",
        text: "I can explain your portfolio, review cash events or help you explore a structured-product scenario. Ask naturally, or use “Discuss” on any insight to bring its context into the conversation.",
      };
    return {
      role: "assistant",
      text: "Which holding, cash event or product would you like to explore? I can explain the available portfolio and product scenarios. Connected market research is unavailable in this offline file.",
    };
  }
  async function refreshPortfolio() {
    if(publicMock){setDatabaseState("local");return;}
    const revision = ++databaseRevision.current;
    setDatabaseState("loading");
    try {
      const headers = { "x-mercury-client": "portal" },
        signal = AbortSignal.timeout(20000);
      const session = await fetch("/api/session", {
        method: "POST",
        headers,
        signal,
      });
      if (!session.ok) throw Error();
      const response = await fetch("/api/portfolio/okonkwo", {
        method: "POST",
        headers,
        cache: "no-store",
        signal,
      });
      if (!response.ok) throw Error();
      const data = await response.json();
      if (revision !== databaseRevision.current) return;
      if (data.status === "not_configured") {
        setDatabaseSnapshot(null);
        setDatabaseState("local");
        return;
      }
      setDatabaseSnapshot(familySnapshotSchema.parse(data));
      setDatabaseState("supabase");
    } catch {
      if (revision === databaseRevision.current) {
        setDatabaseState("error");
      }
    }
  }
  async function refreshAI() {
    try {
      const response = await fetch("/api/health", { cache: "no-store" });
      if (!response.ok) throw Error();
      const status = (await response.json()) as ConnectionStatus;
      if (status.server !== true || typeof status.ready !== "boolean")
        throw Error();
      setAiStatus(status);
      setConnectionError("");
      if (status.ready) setAiMode("live");
      else {
        const hybrid = await fetch("/api/hybrid?health=1", { cache: "no-store" });
        if (hybrid.ok && (await hybrid.json()).ready === true) setAiMode("live");
      }
    } catch {
      setConnectionError(
        "The local AI server is unavailable. Start Mercury AI and retry.",
      );
    }
  }
  function cancelRequest() {
    if (responseTimer.current) clearTimeout(responseTimer.current);
    responseTimer.current = null;
    aiRevision.current++;
    aiAbort.current?.abort();
    aiAbort.current = null;
    const id = aiActive.current;
    aiActive.current = null;
    setBusy(false);
    if (id)
      setMessages((s) =>
        s.map((m) =>
          m.id === id
            ? {
                ...m,
                text: (m.source === "Gemini" || m.source === "Qwen" || m.source === "DeepSeek") ? m.text : "AI request cancelled.",
                issue:
                  "Request cancelled. No further response will be applied.",
              }
            : m,
        ),
      );
  }
  const sqliteRestored=useRef(false);
  useEffect(()=>{
    if(publicMock||!ready||sqliteRestored.current)return;sqliteRestored.current=true;const revision=aiRevision.current;
    void (async()=>{try{await fetch('/api/session',{method:'POST',headers:{'x-mercury-client':'portal'}});const response=await fetch('/api/hybrid?history=1'+(conversationId.current?'&conversationId='+encodeURIComponent(conversationId.current):''));if(!response.ok)return;const data=await response.json() as {conversationId:string|null;turns:{scope:{bank:string;book:string};run:HybridRun}[]};if(aiRevision.current!==revision||!data.conversationId)return;if(!conversationId.current)conversationId.current=data.conversationId;setMessages(old=>{const known=new Set(old.map(m=>m.hybridRunId));const missing=data.turns.filter(t=>!known.has(t.run.id));return [...missing.flatMap(({scope,run}):Message[]=>[{role:'user',text:run.question,scopeKey:JSON.stringify(scope)},{id:run.id,role:'assistant',source:'DeepSeek',text:run.answer,scopeKey:JSON.stringify(scope),hybridRunId:run.id,hybridRun:run,model:'deepseek-flash'}]),...old];});}catch{}})();
  },[ready,publicMock]);
  const hydratedHybridRuns=useRef(new Set<string>());
  useEffect(()=>{
    if(publicMock||!ready)return;
    const pending=messages.filter(m=>m.hybridRunId&&!m.hybridRun&&!hydratedHybridRuns.current.has(m.hybridRunId)).slice(-10);
    for(const message of pending){const id=message.hybridRunId!;hydratedHybridRuns.current.add(id);void fetch('/api/hybrid?run='+encodeURIComponent(id)+'&conversationId='+encodeURIComponent(conversationId.current||(conversationId.current=uuid())),{headers:{'x-mercury-client':'portal'},credentials:'same-origin'}).then(async response=>response.ok?(await response.json()).run:null).then((run:HybridRun|null)=>{if(run)setMessages(items=>items.map(item=>item.hybridRunId===id?{...item,hybridRun:run}:item));}).catch(()=>{});}
  },[ready,messages,publicMock]);
  async function sendHybrid(question:string,followupIndex?:number,sourceRunId?:string){
    if(!question.trim()||busy)return;
    const clean=question.trim().slice(0,2500),requestScope=JSON.stringify(scope),previousId=sourceRunId||[...messages].reverse().find(m=>m.scopeKey===requestScope&&m.hybridRunId)?.hybridRunId;
    setInput('');setBusy(true);setMessages(items=>[...items,{role:'user',text:clean,scopeKey:requestScope}]);
    const id=uuid(),revision=++aiRevision.current,controller=new AbortController();aiAbort.current=controller;aiActive.current=id;
    setMessages(items=>[...items,{id,role:'assistant',source:'Connection',question:clean,scopeKey:requestScope,text:copy('Understanding your question…','正在理解你的問題…','正在理解你的问题…')}]);
    const active=()=>JSON.stringify(activeScope.current)===requestScope&&aiRevision.current===revision&&aiActive.current===id&&!controller.signal.aborted;
    const update=(fn:(message:Message)=>Message)=>{if(active())setMessages(items=>items.map(item=>item.id===id?fn(item):item));};
    try{
      const session=await fetch('/api/session',{method:'POST',headers:{'x-mercury-client':'portal'},credentials:'same-origin',signal:controller.signal});
      if(!session.ok)throw Error('Could not start the Mercury session.');
      const response=await fetch('/api/hybrid',{method:'POST',headers:{'Content-Type':'application/json','x-mercury-client':'portal'},credentials:'same-origin',signal:controller.signal,body:JSON.stringify({conversationId:conversationId.current||(conversationId.current=uuid()),question:clean,previousId,followupIndex,language,scope})});
      if(!response.ok){const error=await response.json().catch(()=>({}));throw Error(typeof error.error==='string'?error.error:'Conversation service unavailable.');}
      if(!response.body)throw Error('Conversation service returned no response.');
      const reader=response.body.getReader(),decoder=new TextDecoder();let buffer='',completed=false;
      let streamedRun:HybridRun|undefined;
      const consume=(line:string)=>{
        if(!line.trim()||!active())return;
        const event=JSON.parse(line) as Partial<HybridRun>&{type:string;text?:string;run?:HybridRun};
        if(event.type==='progress'&&!streamedRun?.answer)update(m=>({...m,text:event.text||m.text}));
        if(event.type==='start'&&event.run)streamedRun=event.run;
        if(event.type==='depth'&&streamedRun)streamedRun={...streamedRun,research_depth:event.research_depth};
        if(event.type==='view'&&streamedRun)streamedRun={...streamedRun,components:event.components||streamedRun.components,results:event.results||streamedRun.results,sources:event.sources||streamedRun.sources};
        if((event.type==='analysis'||event.type==='done')&&event.run)streamedRun=event.run;
        if(streamedRun&&['view','analysis','done'].includes(event.type)&&(streamedRun.answer||streamedRun.components?.length)){
          const run=streamedRun;
          update(m=>({...m,source:'DeepSeek',text:run.answer||m.text,hybridRun:run,model:'deepseek-flash',...(event.type==='done'?{hybridRunId:run.id,issue:run.status==='failed'?run.error||'Analysis did not complete.':undefined}:{})}));
        }
        if(event.type==='done')completed=true;
      };
      try{while(true){const next=await reader.read();if(next.done)break;buffer+=decoder.decode(next.value,{stream:true});if(buffer.length>12000000)throw Error('Conversation response exceeded the supported size.');let at;while((at=buffer.indexOf('\n'))!==-1){consume(buffer.slice(0,at));buffer=buffer.slice(at+1);}}buffer+=decoder.decode();consume(buffer);if(!completed&&!controller.signal.aborted)throw Error('Conversation response was interrupted.');}finally{reader.releaseLock();}
    }catch(error){if(active())update(m=>({...m,source:'Connection',text:copy('The analysis could not complete.','未能完成分析。','未能完成分析。'),issue:error instanceof Error?error.message:'Conversation service unavailable.'}));}
    finally{if(active()){setBusy(false);aiActive.current=null;aiAbort.current=null;}}
  }
  async function send(
    text = input,
    context = chatContext,
    analysisContext = fedContext,
    stockSelection = stockContext,
    researchSelection = researchContext,
    resumeRequestId?:string,
    interaction?: UIInteraction,
  ) {
    return sendHybrid(text);
  }
  async function sendLegacy(
    text = input,
    context = chatContext,
    analysisContext = fedContext,
    stockSelection = stockContext,
    researchSelection = researchContext,
    resumeRequestId?:string,
    interaction?: UIInteraction,
  ) {
    if (!text.trim() || busy) return;
    const clean = text.trim().slice(0, 500);
    setInput("");
    setMessages((s) => [...s, { role: "user", text: clean, scopeKey: JSON.stringify(scope) }]);
    setBusy(true);
    chatInput.current?.focus({ preventScroll: true });
    if (aiMode === "demo") {
      setMessages((s) => [...s, {role:"assistant",source:"Connection",text:"DeepSeek Flash is not configured. Start Mercury with your DeepSeek key and try again."}]);
      setBusy(false);
      return;
    }
    const requestScope=JSON.stringify(scope);
    const id = uuid(),
      revision = ++aiRevision.current,
      controller = new AbortController();
    aiAbort.current = controller;
    aiActive.current = id;
    setMessages((s) => [
      ...s,
      {
        id,
        role: "assistant",
        source: "Connection",
        question: clean,
        scopeKey: JSON.stringify(scope),
        text: "Understanding your question…",
      },
    ]);
    const active = () =>
      JSON.stringify(activeScope.current) === requestScope &&
      aiRevision.current === revision &&
      aiActive.current === id &&
      !controller.signal.aborted;
    const update = (fn: (message: Message) => Message) => {
      if (active()) setMessages((s) => s.map((m) => (m.id === id ? fn(m) : m)));
    };
    try {
      await requestAssistant(
        {
          conversationId: conversationId.current || (conversationId.current = uuid()),
          language,interaction,
          requestId: id,
          resumeRequestId,
          revision,
          message: clean,
          geminiModel,
          context,
          view: view === "simulator" ? "products" : view,
          product,
          path: [...path],
          portfolioScope:{household:"hh_okonkwo",bank:scope.bank,book:scope.book},
          researchContext:researchSelection,
          fedContext: context === "US stocks" ? undefined : analysisContext,
          stockContext: context === "Fed analysis" ? undefined : stockSelection,
          history: messages
            .filter((m) => m.scopeKey === JSON.stringify(scope) && (m.role === "user" || (m.role === "assistant" && m.source !== "Connection")))
            .slice(-30)
            .map((m) => ({ role: m.role, text: m.text.slice(0, 6000) })),
        },
        controller.signal,
        (event) => {
          if (!active()) return;
          if (event.type === "progress")
            update((m) => ({ ...m, text: event.text || m.text,
              ...(event.stage?{steps:[...(m.steps||[]).filter(s=>s.stage!==event.stage),event]}:{}) }));
          if(event.type==="input_request" && inputRequestSchema.safeParse(event.inputRequest).success)update(m=>({...m,inputRequest:event.inputRequest,text:""}));
          if (event.type === "wealth_scenario" && event.wealthScenario) update(m=>({...m,wealthScenario:event.wealthScenario}));
          if (event.type === "portfolio_impact" && event.portfolioImpact) update(m=>({...m,portfolioImpact:event.portfolioImpact}));
          if (event.type === "rich_response" && event.richResponse) update(m=>({...m,richResponse:event.richResponse}));
          if (event.type === "research_analysis" && event.researchAnalysis) {
            update(m=>({...m,researchAnalysis:event.researchAnalysis}));
            setChatContext("Public market research");
            setResearchContext(event.researchAnalysis.plan);setFedContext(undefined);setStockContext(undefined);
          }
          if (event.type === "stock_analysis" && event.stockAnalysis) {
            setResearchContext(undefined);
            const stockAnalysis = event.stockAnalysis;
            update((m) => ({ ...m, stockAnalysis }));
            setFedContext(undefined);
            if (stockAnalysis.data.quote)
              setStockContext({
                symbol: stockAnalysis.data.quote.symbol,
                range: stockAnalysis.range,
              });
          }
          if (event.type === "analysis" && event.analysis) {
            setResearchContext(undefined);
            setStockContext(undefined);
            const analysis = event.analysis;
            update((m) => ({ ...m, analysis }));
            setFedContext({
              question: clean,
              meetingMonth: analysis.plan.meetingMonth,
              historyDays: analysis.plan.historyDays,
            });
          }
          if (event.type === "local_account") update(m=>({...m,...answer(clean,context),source:"Okonkwo demo"}));
          if (event.type === "reply")
            update((m) => ({
              ...m,
              source: event.provider === "Local" ? "Portfolio engine" : event.provider === "DeepSeek" ? "DeepSeek" : event.provider === "Qwen" ? "Qwen" : "Gemini",
              text: event.text || "No explanation returned.",
              model: event.model,
            }));
          if (event.type === "decision" && event.destination !== "clarify")
            update((m) => ({ ...m, aiAction: event }));
          if (event.type === "error")
            update((m) => ({
              ...m,
              ...(event.resumeAvailable?{resumeRequestId:id,retryReadyAt:Date.now()+(event.retryAfterMs||0)}:{}),
              issue: [m.issue, event.message]
                .filter(Boolean)
                .join(" "),
              ...(event.stage?{steps:[...(m.steps||[]).filter(s=>s.stage!==event.stage),{...event,status:'failed' as const}]}:{}),
              ...((m.source !== "Gemini" && m.source !== "Qwen" && m.source !== "DeepSeek")
                ? {
                    text: m.analysis||m.stockAnalysis||m.researchAnalysis||m.wealthScenario
                      ? "Charts are available. The explanation did not complete."
                      : "The analysis could not complete.",
                    source: "Connection",
                  }
                : {}),
            }));
        },
      );
    } catch (error) {
      if (active())
        update((m) => ({
          ...m,
          text:
            (m.source === "Gemini" || m.source === "Qwen" || m.source === "DeepSeek")
              ? m.text
              : "The live AI request did not complete.",
          issue:
            error instanceof Error ? error.message : "AI connection failed.",
        }));
    } finally {
      if (active()) {
        setBusy(false);
        aiActive.current = null;
        aiAbort.current = null;
      }
    }
  }
  function applyAI(event: AssistantEvent) {
    const destination = event.destination as Destination;
    if (destination === "products" && event.product && event.path) {
      setProduct(event.product);
      setPath([...event.path]);
      setPreset(null);
      setChartTab(event.focus === "downside" ? "payoff" : "path");
      setSimulatorKind("note");
      go("simulator");
    } else if (destination === "portfolio") portfolio();
    else if (destination === "overview") go("overview");
    else action(destination);
    closeChat();
  }
  function chat(context = "Your whole portfolio", question?: string) {
    chatTrigger.current = document.activeElement as HTMLElement;
    setChatContext(context);
    if (!chatOpen) history.pushState({ mercuryChat: true }, "", "#chat");
    setChatOpen(true);
    setModal(null);
    setHolding(null);
    if (question) send(question, context);
  }
  function save(title: string, body: string) {
    const d = {
      id: uuid().slice(0, 8).toUpperCase(),
      title,
      body,
      created: new Date().toISOString(),
    };
    setDrafts((s) => [d, ...s]);
    setReceipt(d);
    setModal("receipt");
    setToast("Saved to your documents. Nothing has been sent.");
  }
  function download(d: Draft) {
    const a = document.createElement("a"),
      url = URL.createObjectURL(
        new Blob([JSON.stringify(d, null, 2)], { type: "application/json" }),
      );
    a.href = url;
    a.download = "Mercury-" + d.id + ".json";
    a.click();
    URL.revokeObjectURL(url);
  }
  function action(id: string) {
    if (id === "catalog") go("products");
    if (id === "portfolio") portfolio("equity");
    if (id === "products") {
      setSimulatorKind("note");
      go("simulator");
    }
    if (id === "cash") setModal("cash");
    if (id === "proposal") setModal("proposal");
    if (id === "brief") setModal("brief");
  }
  function reset() {
    const oldConversation=conversationId.current;
    cancelRequest();
    if(oldConversation)void fetch('/api/conversation',{method:'POST',headers:{'Content-Type':'application/json','x-mercury-client':'portal'},body:JSON.stringify({action:'reset',conversationId:oldConversation,scope:{household:'hh_okonkwo',bank:scope.bank,book:scope.book}})}).catch(()=>{});
    try {
      localStorage.removeItem(storage);
    } catch {}
    setFedContext(undefined);
    setStockContext(undefined);
    setResearchContext(undefined);
    conversationId.current = "";
    setMessages([]);
    setDrafts([]);
    setDismissed([]);
    setAccepted(false);
    setAck(false);
    setBusy(false);
    setInput("");
    setChatOpen(false);
    setChatContext("Your whole portfolio");
    setCurrency("USD");
    setPath([...scenarioPaths.base]);
    setPreset("base");
    setProduct("phoenix");
    setFilter("all");
    setOwner("all");
    setSearch("");
    setGroup("asset");
    setPeriod("6M");
    setHover(null);
    setChartTab("path");
    setShowLines(true);
    setObserved(3);
    setInsightFilter("all");
    setMandate("APM");
    setBrief("");
    setCashReserve(100000);
    setCashChoice("Keep liquid");
    setShowConditional(false);
    setReceipt(null);
    setHolding(null);
    setModal(null);
    go("overview");
    setToast("Demo data reset. Ready for your next presentation.");
  }

  const insightHoldings=holdings.filter(h=>(scope.bank==='all'||h.bank===scope.bank)&&(scope.book==='all'||h.bookId===scope.book));
  const insights = [
    {
      id: "allocation",
      type: "portfolio",
      label: "Asset mix",
      title: "Your equity allocation",
      body: copy("Equity positions and funds within your selected scope. No target allocation is linked.","所選範圍的股票及股票基金，未連結目標配置。","所选范围的股票及股票基金，未关联目标配置。"),
      metric:
        (allocation.find((a) => a.id === "equity")?.percent || 0).toFixed(1) +
        "%",
      detail: copy("of selected market value","佔所選市值","占所选市值"),
      action: "portfolio",
      cta: "Review holdings",
      question: "Explain my portfolio allocation",
      icon: "portfolio",
      tone: "green",
    },
    {
      id: "cash",
      type: "cash",
      label: "Liquidity",
      title: "Cash across your books",
      body: "Balances from the imported 19 June demonstration snapshot.",
      metric: money(
        insightHoldings
          .filter((h) => h.category === "cash")
          .reduce((n, h) => n + h.value, 0),
        true,
      ),
      detail: "USD-based demo balance",
      action: "cash",
      cta: "View balances",
      question: "Show my cash across books",
      icon: "cash",
      tone: "sand",
    },
    {
      id: "product",
      type: "products",
      label: "Product watch",
      title: copy("Structured product review","結構產品檢視","结构产品查看"),
      body: copy("Review terms, issuer exposure and maturity dates for the products in this scope.","檢視此範圍產品的條款、發行商風險及到期日。","查看此范围产品的条款、发行商风险及到期日。"),
      metric: String(insightHoldings.filter(h=>h.category==='note').length),
      detail: copy("held products","持有產品","持有产品"),
      action: "catalog",
      cta: "View product",
      question: copy("Explain my held structured products","解釋我持有的結構產品","解释我持有的结构产品"),
      icon: "products",
      tone: "purple",
    },
  ].filter((x) => !dismissed.includes(x.id)&&(x.id!=='product'||insightHoldings.some(h=>h.category==='note'))&&(x.id!=='cash'||insightHoldings.some(h=>h.category==='cash')));
  const notices:ClientNotice[]=[...insights.map(i=>({id:'snapshot:'+JSON.stringify(scope)+':'+(databaseSnapshot?.version||'imported')+':'+i.id,title:i.title,body:i.body,category:(i.type==='products'?'products':'insights') as 'products'|'insights',destination:i.type==='products'?'products':'portfolio',source:'Snapshot observation'})),...clientRecords.records.documents.filter(d=>scope.book==='all'||d.scope===scope.book).filter(d=>d.status==='Ready for review'||d.status==='Awaiting signature').map(d=>({id:'document:'+d.id+':'+d.current_version+':'+d.status,title:d.title,body:d.status,category:'documents' as const,destination:'documents',source:'Document action'}))].filter(n=>clientRecords.records.preferences[n.category]);
  const unreadCount=notices.filter(n=>!clientRecords.records.notifications.some(s=>s.id===n.id&&s.state!=='unread')).length;
  function dismissInput(message:Message){if(!message.inputRequest)return;const kind=message.inputRequest.kind;setMessages(s=>s.map(m=>m===message?{...m,inputRequest:undefined}:m));if(conversationId.current)void fetch('/api/conversation',{method:'POST',headers:{'Content-Type':'application/json','x-mercury-client':'portal'},body:JSON.stringify({action:'dismiss_input',conversationId:conversationId.current,scope:{household:'hh_okonkwo',...scope},inputKind:kind})});}
  function insightCards(limit = 3) {
    return (
      <div className="insight-grid">
        {localize(insights
          .filter((x) => insightFilter === "all" || x.type === insightFilter)
          .slice(0, limit)
          .map((i) => (
            <article className={"insight-card " + i.tone} key={i.id}>
              <div className="insight-top">
                <span className="insight-icon">
                  <Icon name={i.icon} />
                </span>
                <span>{localize(i.label)}</span>
                {localize(view === "insights" && (
                  <button
                    className="icon-button small"
                    aria-label={localize("Dismiss " + i.label)}
                    onClick={() => setDismissed((s) => [...s, i.id])}
                  >
                    <Icon name="close" size={15} />
                  </button>
                ))}
              </div>
              <h3>{localize(i.title)}</h3>
              <details className="insight-detail">
                <summary>{localize("Why it matters")}<Icon name="down" size={13} />
                </summary>
                <p>{localize(i.body)}</p>
              </details>
              <div className="insight-metric">
                <strong>{localize(i.metric)}</strong>
                <span>{localize(i.detail)}</span>
              </div>
              <div className="insight-actions">
                <button onClick={() => action(i.action)}>
                  {localize(i.cta)}
                  <Icon name="arrow" size={17} />
                </button>
                <button
                  className="discuss"
                  onClick={() => chat(i.title, i.question)}
                  aria-label={localize("Discuss " + i.label)}
                >
                  <Icon name="chat" size={17} />
                  <span>{localize("Discuss")}</span>
                </button>
              </div>
            </article>
          )))}
      </div>
    );
  }
  function requestedBarrierLabel() {
    return (
      (product === "phoenix" ? "Final barrier " : "Strike ") +
      p.protectionBarrier +
      "%"
    );
  }
  function productChart() {
    const w = 680,
      h = 270,
      x = (i: number) => 52 + i * 96,
      y = (v: number) => 235 - (v / 150) * 205;
    const colors = ["#2a746b", "#92a16c", "#8c74b2"];
    return (
      <div className="product-chart">
        <div className="chart-toolbar">
          <div className="segmented">
            <button
              aria-pressed={chartTab === "path"}
              onClick={() => setChartTab("path")}
            >{localize("Underlying path")}</button>
            <button
              aria-pressed={chartTab === "payoff"}
              onClick={() => setChartTab("payoff")}
            >{localize("Capital payoff")}</button>
          </div>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={showLines}
              onChange={(e) => setShowLines(e.target.checked)}
            />{localize("Show barriers")}</label>
        </div>
        <svg
          viewBox={`0 0 ${w} ${h}`}
          role="img"
          aria-label={localize(
            chartTab === "path"
              ? `${p.name} hypothetical underlying path with coupon, autocall and capital thresholds.`
              : "Capital redemption at maturity, conditional on no earlier autocall. Coupons shown separately."
          )}
        >
          {localize([0, 50, 100, 150].map((n) => (
            <g key={n}>
              <line x1="52" x2="642" y1={y(n)} y2={y(n)} stroke="#e4e9e5" />
              <text x="6" y={y(n) + 4}>
                {localize(n)}%
              </text>
            </g>
          )))}
          {localize(chartTab === "path" ? (
            <>
              {localize(showLines &&
                [
                  [p.autocallLevel, "Autocall", "#517b57"],
                  [p.couponBarrier, "Coupon", "#b99348"],
                  [
                    p.protectionBarrier,
                    product === "phoenix" ? "Final barrier" : "Strike",
                    "#a57979",
                  ],
                ]
                  .filter(([n]) => Number(n) > 0)
                  .map(([n, label, color]) => (
                    <g key={label}>
                      <line
                        x1="52"
                        x2="642"
                        y1={y(Number(n))}
                        y2={y(Number(n))}
                        stroke={String(color)}
                        strokeDasharray="6 5"
                      />
                      <text
                        data-threshold-label="true"
                        x="635"
                        y={y(Number(n)) - 6}
                        textAnchor="end"
                        style={{ fill: String(color), fontSize: 10 }}
                      >
                        {localize(label)} {localize(n)}%
                      </text>
                    </g>
                  )))}
              {localize(p.underlyings.map((name, line) => {
                const values = path.map((v, i) =>
                  i === 0
                    ? 100
                    : Math.min(150, v + (p.underlyings.length - 1 - line) * 4),
                );
                return (
                  <g key={name}>
                    <path
                      d={values
                        .map((v, i) => `${i ? "L" : "M"}${x(i)},${y(v)}`)
                        .join(" ")}
                      fill="none"
                      stroke={colors[line]}
                      strokeWidth="2.5"
                      strokeLinejoin="round"
                    />
                    {localize(values.map((v, i) => (
                      <circle
                        key={i}
                        cx={x(i)}
                        cy={y(v)}
                        r={i === observed ? 5 : 2.4}
                        fill={colors[line]}
                        stroke="white"
                        strokeWidth="1.4"
                      />
                    )))}
                  </g>
                );
              }))}
              <line
                x1={x(observed)}
                x2={x(observed)}
                y1="20"
                y2="240"
                stroke="#53655e"
                strokeDasharray="2 4"
              />
              {localize(["Start", "M1", "M2", "M3", "M4", "M5", "M6"].map((n, i) => (
                <text key={n} x={x(i)} y="260" textAnchor="middle">
                  {localize(n)}
                </text>
              )))}
              {localize(outcome.calledAt !== null && (
                <g>
                  <circle
                    cx={x(outcome.calledAt)}
                    cy={y(path[outcome.calledAt])}
                    r="10"
                    fill="none"
                    stroke="#497947"
                    strokeWidth="2"
                  />
                  <text
                    x={x(outcome.calledAt)}
                    y={y(path[outcome.calledAt]) - 18}
                    textAnchor="middle"
                  >{localize("Called")}</text>
                </g>
              ))}
            </>
          ) : (
            <>
              {localize(showLines && (
                <g>
                  <line
                    x1={52 + (p.protectionBarrier / 150) * 576}
                    x2={52 + (p.protectionBarrier / 150) * 576}
                    y1="20"
                    y2="235"
                    stroke="#a57979"
                    strokeDasharray="6 5"
                  />
                  <text
                    x={58 + (p.protectionBarrier / 150) * 576}
                    y="24"
                    style={{ fill: "#a57979", fontSize: 10 }}
                  >
                    {localize(requestedBarrierLabel())}
                  </text>
                </g>
              ))}
              <path
                d={Array.from(
                  { length: 151 },
                  (_, i) =>
                    `${i ? "L" : "M"}${52 + (i / 150) * 576},${y(projectedPayoff(product, i))}`,
                ).join(" ")}
                fill="none"
                stroke="#7561a4"
                strokeWidth="3"
              />
              <circle
                cx={52 + (path[6] / 150) * 576}
                cy={y(projectedPayoff(product, path[6]))}
                r="5"
                fill="#7561a4"
              />
              {localize([0, 50, 100, 150].map((n) => (
                <text
                  key={n}
                  x={52 + (n / 150) * 576}
                  y="260"
                  textAnchor="middle"
                >
                  {localize(n)}%
                </text>
              )))}
            </>
          ))}
        </svg>
        {localize(showLines && chartTab === "path" && (
          <div className="barrier-legend">
            {localize(p.autocallLevel > 0 && (
              <span>{localize("Autocall")}<b>{localize(p.autocallLevel)}%</b>
              </span>
            ))}
            {localize(p.couponBarrier > 0 && (
              <span>{localize("Coupon")}<b>{localize(p.couponBarrier)}%</b>
              </span>
            ))}
            <span>
              {localize(product === "phoenix" ? "Final barrier" : "Strike")}{localize(" ")}
              <b>{localize(p.protectionBarrier)}%</b>
            </span>
          </div>
        ))}
        <div className="chart-legend">
          {localize(chartTab === "path" ? (
            p.underlyings.map((u, i) => (
              <span key={u}>
                <i style={{ background: colors[i] }} />
                {localize(u)}
                {localize(i === p.underlyings.length - 1 ? " · worst performer" : "")}
              </span>
            ))
          ) : (
            <span>{localize("Final worst-underlying level → capital returned (% of notional). Excludes coupons.")}</span>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className={"portal " + (chatOpen ? "chat-is-open" : "")}>
      <a className="skip-link" href="#main">{localize("Skip to content")}</a>
      <aside className="sidebar" inert={chatOpen}>
        <a className="brand" href="#overview" onClick={() => go("overview")}>
          <MercuryWordmark/>
        </a>
        <Label>{localize("YOUR PRIVATE OFFICE")}</Label>
        <nav aria-label={localize("Main navigation")}>
          {localize(navItems.map(([id, label, icon]) => (
            <button
              key={id}
              aria-label={localize(label)}
              aria-current={
                view === id || (id === "products" && view === "simulator")
                  ? "page"
                  : undefined
              }
              onClick={() => go(id)}
            >
              <Icon name={icon} />
              <span>{localize(label)}</span>
              {localize(id === "insights" && (
                <b className="nav-count">{localize(insights.length)}</b>
              ))}
            </button>
          )))}
          <button
            aria-label={localize("Chat")}
            onClick={() => chat()}
            aria-expanded={chatOpen}
          >
            <Icon name="chat" />
            <span>{localize("Chat")}</span>
            <span className="new-dot" />
          </button>
          <button
            aria-label={localize("Documents")}
            aria-current={view === "documents" ? "page" : undefined}
            onClick={() => go("documents")}
          >
            <Icon name="document" />
            <span>{localize("Documents")}</span>
            {localize(drafts.length > 0 && <b className="nav-count">{localize(drafts.length)}</b>)}
          </button>
        </nav>
        <div className="sidebar-bottom">
          <div className="adviser-mini">
            <span className="avatar adviser-avatar">{localize("TW")}</span>
            <div>
              <strong>{localize("Tan Wei-Jie")}</strong>
              <small>{localize("Your wealth adviser")}</small>
            </div>
            <i />
          </div>
          <button
            className="adviser-contact"
            onClick={() => setModal("adviser")}
          >{localize("Contact your adviser")}<Icon name="up" size={16} />
          </button>
          <button
            className="sidebar-settings"
            onClick={() => setModal("more")}
          >
            <Icon name="settings" size={17} />{localize("More")}</button>
          <div className="sidebar-footer">
            <Icon name="shield" size={13} />{localize("Your private wealth, connected.")}</div>
        </div>
      </aside>
      <div className="shell" inert={chatOpen}>
        <header className="topbar">
          <a className="mobile-brand" href="#overview" aria-label={localize("Home")} onClick={()=>go("overview")}><MercuryWordmark/></a>
          <div className="breadcrumbs">{localize("Private office")}<span>/</span>
            <b>{localize(titles[view])}</b>
          </div>
          <div className="header-actions">
            <Button
              variant="outline"
              className="ask-button"
              onClick={() => chat()}
            >
              <Icon name="chat" size={18} />{localize("Mercury")}</Button>
            <button
              className="icon-button header-insight"
              aria-label={localize("Notifications")}
              onClick={() => setModal("notifications")}
            >
              <Icon name="bell" />{localize(unreadCount>0&&<span className="notification-badge">{localize(unreadCount>99?'99+':unreadCount)}</span>)}
            </button>
            <button
              className="avatar profile"
              aria-label={localize("Open profile and more")}
              onClick={() => setModal("more")}
            >{localize("OF")}</button>
          </div>
        </header>
        <main id="main" tabIndex={-1}>
          <div className="page-title">
            <div>
              <Label>
                {localize(view === "overview"
                  ? "YOUR FAMILY OFFICE"
                  : "YOUR PRIVATE OFFICE")}
              </Label>
              <h1>
                {localize(view === "overview"
                  ? "Okonkwo Family"
                  : view === "portfolio"
                    ? "Your portfolio"
                    : view === "products"
                      ? "Product studio"
                      : view === "simulator"
                        ? "Simulator"
                        : view === "insights"
                          ? "Your next moves"
                          : "Your documents")}
              </h1>
            </div>
          </div>
          <div className="data-strip"><span>{publicMock?copy('Demo valuation date','示範估值日期','演示估值日期'):localize(databaseState==='error'?'Holdings could not be refreshed. Showing the last available snapshot.':databaseState==='loading'?'Updating holdings…':'Valuation date')} · {localize(databaseSnapshot?.asOf||'19 Jun 2026')}</span><span>{publicMock?copy("Saved snapshot","已儲存快照","已保存快照"):<button onClick={()=>void refreshPortfolio()}>{localize("Refresh")}</button>}</span></div>
          {["products","documents","insights"].includes(view)&&<PortfolioScope rows={holdings} scope={scope} onChange={setScope} money={money} currency={currency}/>}
          {localize((view === "overview" || view === "portfolio") && (
            <FamilyWorkspace
              view={view}
              rows={holdings}
              currency={currency}
              money={money}
              scope={scope}
              setScope={setScope}
              initialFilter={filter}
              openHolding={openHolding}
              openPortfolio={() => go("portfolio")}
              openProducts={() => go("products")}
              onDiscuss={(context,question)=>{chat(context);setInput(question);}}
            />
          ))}
          {localize(view === "products" && (
            <ProductCatalog
              scope={scope}
              held={holdings.filter(h=>h.category==="note"&&(scope.bank==="all"||h.bank===scope.bank)&&(scope.book==="all"||h.bookId===scope.book))}
              simulate={(id) => {
                setSimulatorKind("note");
                selectProduct(id);
              }}
              accumulate={() => {
                setSimulatorKind("accumulator");
                go("simulator");
              }}
              terms={(id) => {
                setProduct(id);
                setModal("terms");
              }}
            />
          ))}
          {localize(view === "simulator" && (
            <div className="simulator-nav">
              <button className="text-link" onClick={() => go("products")}>
                <Icon name="back" size={17} />{localize("Product studio")}</button>
              <TouchPicker title={localize("Simulator model")} value={simulatorKind==="accumulator"?"accumulator":product} options={[{value:"accumulator",label:"AAPL Accumulator",detail:"Held · simplified daily purchases"},...products.map(item=>({value:item.id,label:item.name,detail:"Example · not held"}))]} onChange={value=>{if(value==="accumulator")setSimulatorKind("accumulator");else{setSimulatorKind("note");setProduct(value as ProductId);setPreset("base");setPath([...scenarioPaths.base]);}}}/>

            </div>
          ))}
          {localize(view === "simulator" && simulatorKind === "accumulator" && (
            <AccumulatorSimulator />
          ))}
          {localize(view === "simulator" && simulatorKind === "note" && (
            <>
              <section className="product-banner">
                <div>
                  <Badge tone="purple">{localize("Sample term sheet · Non-principal-protected")}</Badge>
                  <h2>{localize(p.name)}</h2>
                  <p>
                    {localize(p.subtitle)} <span>·</span> {localize(p.issuer)} <span>·</span>{localize("USD")}</p>
                </div>
                <button className="secondary" onClick={() => setModal("terms")}>
                  <Icon name="document" size={17} />{localize("View terms")}</button>
                <div className="product-metrics">
                  <div>
                    <span>{localize("Notional")}</span>
                    <strong>{localize(dollars(p.notional))}</strong>
                  </div>
                  <div>
                    <span>{localize("Annual coupon")}</span>
                    <strong>
                      {localize(p.annualCoupon)}
                      <small>{localize("% p.a.")}</small>
                    </strong>
                  </div>
                  <div>
                    <span>{localize("Full tenor")}</span>
                    <strong>
                      6<small>{localize("months")}</small>
                    </strong>
                  </div>
                  <div>
                    <span>{localize("Maturity")}</span>
                    <strong className="date-value">{localize(p.maturity)}</strong>
                  </div>
                </div>
              </section>
              <div className="product-workspace">
                <section className="card visualizer">
                  <div className="section-heading">
                    <div>
                      <Label>{localize("PRODUCT VISUALIZER")}</Label>
                      <h2>{localize("Explore a scenario")}</h2>
                    </div>
                  </div>
                  <div
                    className="scenario-presets"
                    aria-label={localize("Product scenarios")}
                  >
                    {localize((
                      [
                        ["base", "Base case"],
                        ["autocall", "Market recovery"],
                        ["stress", "Market sell-off"],
                        ["recovery", "Dip & recover"],
                      ] as const
                    ).map(([id, label]) => (
                      <button
                        key={id}
                        aria-pressed={preset === id}
                        onClick={() => {
                          setPreset(id);
                          setPath([...scenarioPaths[id]]);
                        }}
                      >
                        {localize(label)}
                      </button>
                    )))}
                  </div>
                  {localize(productChart())}
                  <div className="scenario-slider">
                    <div>
                      <label htmlFor="final-level">{localize("Worst performer at maturity")}</label>
                      <output htmlFor="final-level">
                        {localize(path[6])}% <small>{localize("of initial level")}</small>
                      </output>
                    </div>
                    <input
                      id="final-level"
                      type="range"
                      min="0"
                      max="130"
                      step="1"
                      value={path[6]}
                      onChange={(e) => {
                        setPreset(null);
                        setPath((s) =>
                          s.map((v, i) =>
                            i === 6 ? Number(e.target.value) : v,
                          ),
                        );
                      }}
                    />
                    <div className="slider-labels">
                      <span>{localize("0% · total underlying loss")}</span>
                      <span>{localize("100% · unchanged")}</span>
                      <span>130%</span>
                    </div>
                  </div>
                  {localize(outcome.calledAt !== null && (
                    <div className="call-notice">
                      <Icon name="check" size={18} />{localize("Autocalled in month")}{localize(outcome.calledAt)}{localize(". Later price changes do not affect this redeemed note.")}</div>
                  ))}
                  <div className="observation-strip">
                    <span>{localize("Inspect a hypothetical monthly observation")}</span>
                    <div>
                      {localize(outcome.observations.map((o) => (
                        <button
                          key={o.month}
                          onClick={() => setObserved(o.month)}
                          aria-pressed={observed === o.month}
                          className={
                            !o.active
                              ? "inactive"
                              : o.called
                                ? "called"
                                : o.coupon > 0
                                  ? "paid"
                                  : "missed"
                          }
                        >
                          <small>{localize("MONTH")}{localize(o.month)}</small>
                          <strong>{localize(o.level)}%</strong>
                          <span>
                            {localize(!o.active
                              ? "Redeemed"
                              : o.called
                                ? "Autocalled"
                                : o.coupon > 0
                                  ? "Coupon paid"
                                  : "No coupon")}
                          </span>
                        </button>
                      )))}
                    </div>
                    <p>{localize("Month")}{localize(observed)}:{localize(" ")}
                      {localize(observed === 0
                        ? "Initial level 100%."
                        : !outcome.observations[observed - 1].active
                          ? "The note has already redeemed. No later coupon is due."
                          : `Worst underlying ${path[observed]}%. Coupon ${dollars(outcome.observations[observed - 1].coupon)}.${outcome.observations[observed - 1].called ? " Early redemption triggered." : ""}`)}
                    </p>
                  </div>
                </section>
                <aside className="outcome-column">
                  <section className="outcome-card">
                    <Label>{localize("THIS SCENARIO")}</Label>
                    <Badge tone={outcome.net < 0 ? "red" : "green"}>
                      {localize(outcome.calledAt
                        ? "Early redemption"
                        : outcome.net < 0
                          ? "Capital at risk"
                          : "Held to maturity")}
                    </Badge>
                    <span className="outcome-label">{localize("Total cash returned")}</span>
                    <div className="outcome-total" data-testid="product-total">
                      {localize(dollars(outcome.total))}
                    </div>
                    <div
                      className={
                        "net-result " +
                        (outcome.net < 0 ? "negative" : "positive")
                      }
                      data-testid="product-net"
                    >
                      {localize(outcome.net < 0 ? "−" : "+")}
                      {localize(dollars(Math.abs(outcome.net)))}{localize(" ")}
                      <span>
                        ({localize(((outcome.net / outcome.principal) * 100).toFixed(2))}{localize("%) net")}</span>
                    </div>
                    <div className="cash-breakdown">
                      <div>
                        <span>{localize("Capital returned")}</span>
                        <b>{localize(dollars(outcome.redemption))}</b>
                      </div>
                      <div>
                        <span>{localize("Coupons received")}</span>
                        <b>{localize(dollars(outcome.coupon))}</b>
                      </div>
                      <div>
                        <span>{localize("Original investment")}</span>
                        <b>{localize(dollars(outcome.principal))}</b>
                      </div>
                    </div>
                    <div className="outcome-bars">
                      <span
                        style={{
                          width:
                            Math.min(
                              100,
                              (outcome.redemption / outcome.principal) * 100,
                            ) + "%",
                        }}
                      />
                      <i
                        style={{
                          width:
                            Math.min(
                              100,
                              (outcome.coupon / outcome.principal) * 100,
                            ) + "%",
                        }}
                      />
                    </div>
                    <small>{localize("USD · Issuer performance assumed · Fees and taxes excluded. Scenario, not a quote.")}</small>
                    <button
                      className="primary"
                      onClick={() =>
                        save(
                          "Product scenario · " + p.name,
                          `${p.name}\nSample term sheet v1; USD ${p.notional} notional.\nWorst-underlying path: ${path.join(" → ")}%.\nCapital: USD ${outcome.redemption}; coupons: USD ${outcome.coupon}; total: USD ${outcome.total}; net: USD ${outcome.net}.\n${outcome.calledAt ? "Autocalled at month " + outcome.calledAt : "Held to maturity"}.\nAssumes issuer performance. Excludes fees and taxes. No quote requested or trade submitted.`,
                        )
                      }
                    >{localize("Save scenario")}<Icon name="download" size={17} />
                    </button>
                    <button
                      className="text-link"
                      onClick={() =>
                        chat(
                          p.name + " · product scenario",
                          "Explain this structured product scenario",
                        )
                      }
                    >{localize("Discuss this outcome")}<Icon name="chat" size={16} />
                    </button>
                  </section>
                  <section className="product-risks">
                    <Icon name="shield" size={20} />
                    <h3>{localize("Downside at a glance")}</h3>
                    <p>
                      {localize(product === "phoenix"
                        ? "Below the 60% final barrier, capital follows the final worst-underlying level. Coupons are conditional and have no memory."
                        : "Below the 80% strike, capital is reduced in proportion to the final worst-underlying level / strike.")}
                    </p>
                    <p>{localize("Issuer default can cause total loss. Early exit requires a market valuation.")}</p>
                    <button onClick={() => setModal("terms")}>{localize("Full sample terms")}<Icon name="arrow" size={14} />
                    </button>
                  </section>
                </aside>
              </div>
            </>
          ))}
          {localize(view === "insights" && (
            <>
              <div className="insights-toolbar">
                <span>
                  <b>{localize(insights.length)}</b>{" "}{localize("portfolio observations")}</span>
                <div className="filter-chips">
                  {localize([
                    ["all", "All insights"],
                    ["cash", "Cash & events"],
                    ["portfolio", "Allocation"],
                    ["products", "Products"],
                  ].map(([id, label]) => (
                    <button
                      key={id}
                      aria-pressed={insightFilter === id}
                      onClick={() => setInsightFilter(id)}
                    >
                      {localize(label)}
                    </button>
                  )))}
                </div>
              </div>
              {localize(insightCards())}
              <section className="proposal-callout">
                <div>
                  <Badge>{localize("For adviser review")}</Badge>
                  <h2>{localize("Your investment review")}</h2>
                  <p>{copy("Explore your adviser’s proposed changes, review decisions and prepare your questions.","查看顧問提出嘅調整、決定紀錄，並準備討論問題。","查看顾问提出的调整、决定记录，并准备讨论问题。")}</p>
                </div>
                <button
                  className="primary"
                  onClick={() => setModal("proposal")}
                >{localize("Open review")}<Icon name="arrow" size={17} />
                </button>
              </section>
              {localize(dismissed.length > 0 && (
                <button className="text-link" onClick={() => setDismissed([])}>{localize("Restore")}{localize(dismissed.length)}{localize("dismissed insight")}{localize(dismissed.length === 1 ? "" : "s")}
                </button>
              ))}
            </>
          ))}
          {localize(view === "documents" && (
            <>
              <DocumentVault scope={scope}/>
              <section className="card document-list">
                <div className="section-heading">
                  <h2>{localize("Saved items")}</h2>
                  <Badge>{localize(drafts.length)}{localize("local drafts")}</Badge>
                </div>
                {localize(drafts.length ? (
                  drafts.map((d) => (
                    <button
                      key={d.id}
                      className="document-row"
                      onClick={() => {
                        setReceipt(d);
                        setModal("receipt");
                      }}
                    >
                      <span className="document-icon">
                        <Icon name="document" />
                      </span>
                      <span>
                        <strong>{localize(d.title)}</strong>
                        <small>
                          {localize(new Date(d.created).toLocaleDateString(locale()))}{localize("· Draft")}{localize(d.id)}
                        </small>
                      </span>
                      <Badge>{localize("Saved locally")}</Badge>
                      <Icon name="arrow" size={17} />
                    </button>
                  ))
                ) : (
                  <div className="empty">
                    <Icon name="document" size={34} />
                    <h3>{localize("Nothing saved yet")}</h3>
                    <p>{localize("Save a product scenario or a message for your adviser.")}</p>
                    <button
                      className="secondary"
                      onClick={() => go("products")}
                    >{localize("Explore a product")}</button>
                  </div>
                ))}
                <button
                  className="document-row"
                  onClick={() => setModal("terms")}
                >
                  <span className="document-icon">
                    <Icon name="document" />
                  </span>
                  <span>
                    <strong>{localize(p.name)}{localize("· sample term sheet")}</strong>
                    <small>{localize("Version 1 · Product terms and calculation assumptions")}</small>
                  </span>
                  <Badge>{localize("Reference")}</Badge>
                  <Icon name="arrow" size={17} />
                </button>
              </section>
              {localize(savedResearch.length>0&&<section className="card document-list"><h2>{localize("Saved research")}</h2>{localize(homeResearch.filter(r=>savedResearch.includes(r.id)).map(r=><a className="document-row" key={r.id} href={r.url} target="_blank" rel="noreferrer"><span><strong>{localize(r.title)}</strong><small>{localize(r.publisher)} · {localize(r.date)}{localize("· Published source")}</small></span><Icon name="up" size={17}/></a>))}</section>)}
              <p className="page-note">{localize("Drafts stay in this browser. Saving does not send a message, request a quote or submit a trade.")}</p>
            </>
          ))}

        </main>
      </div>
      <nav inert={chatOpen} className="mobile-nav" aria-label={localize("Mobile navigation")}>
       <button aria-current={view==="overview"?"page":undefined} onClick={()=>go("overview")}><Icon name="overview"/><span>{localize("Home")}</span></button>
       <button aria-current={view==="portfolio"?"page":undefined} onClick={()=>go("portfolio")}><Icon name="portfolio"/><span>{localize("Portfolio")}</span></button>
       <button className="mobile-mercury" aria-label={localize("Mercury")} aria-haspopup="dialog" onClick={()=>chat()}><span className="mercury-nav-icon"><MercuryMark size={24}/></span><span>{localize("Mercury")}</span></button>
       <button aria-current={view==="insights"?"page":undefined} onClick={()=>go("insights")}><Icon name="insight"/><span>{localize("Insights")}</span></button>
       <button aria-label={localize("More")} aria-current={view==="documents"||view==="products"?"page":undefined} onClick={()=>setModal("more")}><Icon name="more"/><span>{localize("More")}</span></button>
      </nav>
      <Sheet
        open={chatOpen}
        onOpenChange={(open) => {
          if (!open) closeChat();
        }}
      >
        <SheetContent
          aria-labelledby="chat-title"
          className="chat-drawer mercury-research-chat"
          data-connection={aiMode === "live" ? "connected" : "local"}
          showCloseButton={false}
          onOpenAutoFocus={(e) => {
            e.preventDefault();
            document
              .getElementById("chat-back")
              ?.focus({ preventScroll: true });
          }}
          onCloseAutoFocus={(e) => {
            e.preventDefault();
            if (modal || holding) return;
            if (
              chatTrigger.current?.isConnected &&
              !chatTrigger.current.closest("[inert]")
            )
              chatTrigger.current.focus({ preventScroll: true });
            else
              document.getElementById("main")?.focus({ preventScroll: true });
          }}
        >
          <SheetDescription className="sr-only">{localize("Ask about your wealth. Close to return to")}{localize(titles[view])}.
          </SheetDescription>
          <div className="chat-toolbar">
            <button id="chat-back" className="chat-toolbar-back" aria-label={localize("Close chat")} title={localize("Back to "+titles[view])} onClick={closeChat}><Icon name="back" size={21}/></button>
            <SheetTitle id="chat-title">{localize("Mercury")}</SheetTitle>
            <button className="assistant-settings-button" aria-label={localize("Conversation controls")} title={localize("Conversation controls")} onClick={()=>{closeChat();setModal("reset");}}><Icon name="settings" size={20}/></button>
          </div>
          <div
            className="chat-log"
            role="log"
            aria-label={localize("Conversation")}
            aria-live="polite"
          >
            {localize(!messages.length && <ChatStarters onChoose={(question,context)=>{
              setFedContext(undefined);setStockContext(undefined);setResearchContext(undefined);
              setChatContext(context);setInput(question);chatInput.current?.focus({preventScroll:true});
            }}/>)}
            {localize(messages.map((m, i) => (
              <div
                className={
                  "chat-message " +
                  m.role +
                  (m.hybridRun ? ' has-hybrid' : m.analysis || m.stockAnalysis || m.researchAnalysis || m.portfolioImpact || m.wealthScenario || m.inputRequest ? " has-analysis" : "")
                }
                key={i}
              >
                {m.role === "assistant" && <div className="mercury-reply-label"><i aria-hidden="true"/><span>Mercury</span></div>}
                {m.hybridRun&&<HybridChatResult run={m.hybridRun} language={language} disabled={busy||!messageInScope(m)} onAsk={(question,index)=>{if(messageInScope(m))void sendHybrid(question,index,m.hybridRunId);}}/>}
                {localize(m.role==="assistant"&&(m.analysis||m.stockAnalysis||m.researchAnalysis||m.portfolioImpact||m.wealthScenario||m.inputRequest)&&!messageInScope(m)&&<p className="chart-caption" role="status">{localize("Saved result from another or unrecorded scope. Switch back or start a new analysis to use its actions.")}</p>)}
                {localize(m.wealthScenario && <WealthScenarioCard scenario={m.wealthScenario}/>)}
                {localize(m.portfolioImpact && <PortfolioImpactCard impact={m.portfolioImpact}/>)}
                {localize(m.inputRequest && messageInScope(m) && (['portfolio_proposal','fcn_scenario'].includes(m.inputRequest.kind)?<div><WealthDecision key={m.id+JSON.stringify(scope)} kind={m.inputRequest.kind==='portfolio_proposal'?'proposal':'fcn'} scope={scope} initialShock={m.inputRequest.shockPct}/><button onClick={()=>dismissInput(m)}>{localize('Dismiss')}</button></div>:<InteractiveInput key={m.id} id={m.id||String(i)} request={m.inputRequest} language={language} disabled={busy||!messageInScope(m)} onDismiss={()=>dismissInput(m)} onSubmit={(q,interaction)=>{setMessages(s=>s.map(x=>x===m?{...x,inputRequest:undefined}:x));void send(q,chatContext,fedContext,stockContext,researchContext,undefined,interaction);}}/>))}
                {localize(m.researchAnalysis && m.richResponse && <RichResearchResponse response={m.richResponse} analysis={m.researchAnalysis} disabled={busy||aiMode!=="live"||!messageInScope(m)} onAsk={(q,selection)=>{setResearchContext(selection);void send(q,"Public market research",undefined,undefined,selection);}}/>)}
                {localize(m.researchAnalysis && !m.richResponse && <ResearchAnalysisCard analysis={m.researchAnalysis} disabled={busy||aiMode!=="live"||!messageInScope(m)} onAsk={(q,selection)=>{setResearchContext(selection);void send(q,"Public market research",undefined,undefined,selection);}}/>)}
                {localize(m.analysis && (
                  <FedAnalysisCard
                    analysis={m.analysis}
                    question={m.question || "Fed analysis"}
                    disabled={busy || aiMode !== "live" || !messageInScope(m)}
                    onSelection={setFedContext}
                    onAsk={(q, selection) => {
                      setFedContext(selection);
                      void send(q, "Fed analysis", selection);
                    }}
                  />
                ))}
                {localize(m.stockAnalysis && (
                  <StockAnalysisCard
                    analysis={m.stockAnalysis}
                    disabled={busy || aiMode !== "live" || !messageInScope(m)}
                    onSelection={setStockContext}
                    onAsk={(q, selection) => {
                      setStockContext(selection);
                      setFedContext(undefined);
                      void send(q, "US stocks", undefined, selection);
                    }}
                  />
                ))}
                {localize(!m.hybridRun&&!(m.richResponse?.blocks.some(b=>b.type==="narrative"||b.type==="cited_narrative")) && <p
                  className={
                    m.analysis || m.stockAnalysis || m.researchAnalysis
                      ? "analysis-explanation"
                      : undefined
                  }
                >
                  {m.source==='Connection'?statusText(m.text,busy&&!m.issue?'progress':'error'):m.text}
                </p>)}
                {localize(m.issue && (
                  <p className="ai-issue" role="status">
                    {statusText(m.issue,'error')}
                  </p>
                ))}
                {localize(m.resumeRequestId && <RetryExplanation readyAt={m.retryReadyAt||0} disabled={busy||aiMode!=="live"||!messageInScope(m)} onRetry={()=>void send(m.question||"Retry the previous explanation",chatContext,fedContext,stockContext,researchContext,m.resumeRequestId)}/>)}
                {localize(!!m.steps?.length && <details className="analysis-steps">
                  <summary>{localize("Request steps")}</summary>
                  <ul>{localize(m.steps.map(step=><li key={step.stage}>
                    {localize(step.service)} · {localize(step.stage?.replaceAll('_',' '))} · {localize(step.status)}
                    {localize(step.status!=='started'?` · ${((step.elapsed_ms||0)/1000).toFixed(1)}s`:'')}
                  </li>))}</ul>
                </details>)}
                {localize(m.aiAction && (
                  <button
                    className="chat-action"
                    disabled={!messageInScope(m)}
                    onClick={() => applyAI(m.aiAction!)}
                  >
                    <span>
                      {localize(actionLabels[m.aiAction.destination!])}
                      <small>
                        {localize(m.aiAction.provider)} · {localize(m.aiAction.elapsed_ms)}{localize("ms")}</small>
                    </span>
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
                {localize(m.action && (
                  <button
                    className="chat-action"
                    disabled={!messageInScope(m)}
                    onClick={() => {
                      action(m.action!);
                      closeChat();
                    }}
                  >
                    {localize(m.label)}
                    <Icon name="arrow" size={16} />
                  </button>
                ))}
              </div>
            )))}
            {localize(busy && (
              <div className="typing" role="status">
                <i />
                <i />
                <i />
                <span>{localize("Preparing your explanation…")}</span>
              </div>
            ))}
            <div ref={chatBottom} />
          </div>
          <div className="chat-input-dock">
          <MercuryComposer
            value={input}
            onChange={setInput}
            onSend={() => void send()}
            onCancel={cancelRequest}
            busy={busy}
            inputRef={chatInput}
          />
          <div id="chat-source-note" className="chat-disclosure" role="note">{localize("AI can make mistakes · Check source data")}</div>
          </div>
        </SheetContent>
      </Sheet>
      {localize(toast && (
        <div className="toast" role="status">
          <Icon name="check" size={18} />
          {localize(toast)}
        </div>
      ))}
          {localize(selected && (
            <section className="holding-page" aria-labelledby="holding-title"><button className="holding-back" onClick={closeHolding}>{localize("Back to holdings")}</button>
              <Label>{localize("HOLDING DETAILS /")}{localize(selected.id)}</Label>
              <h2 id="holding-title">{localize(selected.name)}</h2>
              <Badge>{localize(names[selected.category as Filter])}</Badge>
              <div className="holding-detail-value">
                {localize(money(selected.value))}
                <small>{localize(currency)}{localize("equivalent")}</small>
              </div>
              <div className="detail-grid">
                {localize([
                  ["Owner", selected.owner],
                  ["Custodian", selected.bank],
                  ["Account currency", selected.currency],
                  ["Investment book", selected.book],
                  ["Custody account", selected.account],
                  ["Sleeve", selected.sleeve],
                  ["Book cost", money(selected.cost)],
                  [
                    "Portfolio weight",
                    ((selected.value / TOTAL) * 100).toFixed(2) + "%",
                  ],
                  ["Valuation date", databaseSnapshot?.holdings.find(h=>h.id===selected.id)?.valuedAt||databaseSnapshot?.asOf||"2026-06-19"],
                  ["Quantity", selected.quantity.toLocaleString(locale())],
                  [
                    "Data source",
                    databaseState === "supabase"
                      ? "Imported portfolio snapshot"
                      : "Built-in demo snapshot",
                  ],
                ].map(([key, val]) => (
                  <div key={key}>
                    <span>{localize(key)}</span>
                    <strong>{localize(val)}</strong>
                  </div>
                )))}
              </div>
              {selected.instrumentId==="inst_sn_fcn_ustech"&&<WealthDecision kind="fcn" scope={scope}/>}
              <p className="muted">
                {localize(selected.category === "note"
                  ? "Open the sample product terms and explore its observation schedule, coupons and downside."
                  : selected.category === "cash"
                    ? "Reporting value may combine different account currencies. Transfers and foreign exchange have not been executed."
                    : "Fictional position. Fund look-through, live prices and cost-basis details are not connected.")}
              </p>
              {localize(selected.category === "note" && (
                <button
                  className="primary wide"
                  onClick={() => {
                    setHolding(null);
                    go("products");
                  }}
                >{localize("Visualize this product")}<Icon name="products" size={18} />
                </button>
              ))}
              <button
                className="secondary wide"
                onClick={() =>
                  chat(
                    selected.name,
                    "Explain this " +
                      (selected.category === "note"
                        ? "structured product"
                        : "portfolio holding"),
                  )
                }
              >{localize("Discuss this holding")}<Icon name="chat" size={18} />
              </button>
            </section>
          ))}

      <dialog
        ref={dialog}
        className={"modal"+(modal==='more'?' more-shell':modal==='proposal'?' proposal-shell':'')}
        onCancel={() => {
          setModal(null);
          setHolding(null);
        }}
        onClick={(e) => {
          if (e.target === e.currentTarget) {
            setModal(null);
            setHolding(null);
          }
        }}
        aria-labelledby="modal-title"
      >
        <div className="modal-body">
          <button
            className="modal-close icon-button"
            aria-label={localize("Close dialog")}
            onClick={() => {
              setModal(null);
              setHolding(null);
            }}
          >
            <Icon name="close" />
          </button>
          {localize(modal === "notifications" && <ClientNotifications notices={notices} states={clientRecords.records.notifications} error={clientRecords.error} onMark={clientRecords.mark} onOpen={destination=>go(destination as View)}/>)}
          {localize(modal === "more" && (
            <>
              <Label>{localize("YOUR PRIVATE OFFICE")}</Label>
              <h2 id="modal-title">{localize("Adaeze Okonkwo")}</h2>
              <div className="more-profile">
                <span className="avatar">{localize("OF")}</span>
                <div>
                  <strong>{localize("Okonkwo Family")}</strong>
                  <small>{localize("Demonstration account")}</small>
                </div>
              </div>
              <div className="more-menu"><button onClick={()=>setModal('profile')}>{localize("Profile")}</button><button onClick={()=>setModal('help')}>{localize("Help & About")}</button>
                <button onClick={()=>setModal('proposal')}><Icon name="document"/><span>{copy('Proposals','投資方案','投资方案')}</span><Icon name="arrow" size={16}/></button>
                <button onClick={()=>go("products")}><Icon name="products"/><span>{localize("Products")}</span><Icon name="arrow" size={16}/></button>
                <button onClick={() => go("documents")}>
                  <Icon name="document" />
                  <span>{localize("Documents & saved items")}</span>
                  <Icon name="arrow" size={16} />
                </button>

                <button onClick={() => setModal("adviser")}>
                  <Icon name="chat" />
                  <span>{localize("Contact Tan Wei-Jie")}</span>
                  <Icon name="arrow" size={16} />
                </button>
                <button onClick={() => setModal("settings")}>
                  <Icon name="settings" />
                  <span>{localize("Settings")}</span>
                  <Icon name="arrow" size={16} />
                </button>
              </div>
            </>
          ))}
          {localize(modal === "data" && (
            <>
              <Label>{localize("DATA & CONNECTIONS")}</Label>
              <h2 id="modal-title">{localize("Your financial picture")}</h2>
              <p className="data-intro">{localize("What’s connected. What’s still needed.")}</p>
              <div className="coverage-list">
                {localize([
                  [
                    "Holdings & ownership",
                    databaseState === "supabase"
                      ? "Connected · demo snapshot"
                      : "Sample snapshot",
                    true,
                  ],
                  [
                    "Accounts & custodians",
                    holdings.length +
                      " holdings · " +
                      new Set(holdings.map((h) => h.bank)).size +
                      " banks",
                    true,
                  ],
                  [
                    "Verified performance",
                    "Historical NAV & cash flows needed",
                    false,
                  ],
                  [
                    "Client profile",
                    "Verified client details not linked",
                    false,
                  ],
                ].map(([name, status, complete]) => (
                  <div key={String(name)}>
                    <span
                      className={
                        "coverage-icon " + (complete ? "complete" : "")
                      }
                    >
                      <Icon name={complete ? "check" : "clock"} size={18} />
                    </span>
                    <div>
                      <strong>{localize(name)}</strong>
                      <small>{localize(status)}</small>
                    </div>
                  </div>
                )))}
              </div>
              <div className="data-footnote">
                {localize(databaseState === "supabase"
                  ? "Connected to Supabase. Holdings remain demonstration data."
                  : databaseState === "error"
                    ? "Database unavailable. Displaying the built-in sample."
                    : "This standalone preview uses local sample data.")}{localize(" ")}{localize("Product simulations are illustrative. Holdings use the 19 June imported demo snapshot.")}</div>
              <Button
                className="primary wide"
                disabled={
                  databaseState === "loading" || databaseState === "local"
                }
                onClick={() => void refreshPortfolio()}
              >
                <Icon name="data" size={17} />
                {localize(databaseState === "loading"
                  ? "Refreshing…"
                  : "Refresh connection")}
              </Button>
              <button
                className="text-link"
                onClick={() => {
                  setBrief(
                    "Please help complete my verified client profile and historical NAV / cash-flow records.",
                  );
                  setModal("adviser");
                }}
              >{localize("Prepare a data request")}<Icon name="arrow" size={16} />
              </button>
            </>
          ))}
          {localize(modal === "cash" && (
            <>
              <Label>{localize("OKONKWO FAMILY")}</Label>
              <h2 id="modal-title">{localize("Cash by book")}</h2>
              <div className="coverage-list">
                {localize(holdings
                  .filter((h) => h.category === "cash")
                  .map((h) => (
                    <div key={h.id}>
                      <div>
                        <strong>{localize(h.book)}</strong>
                        <small>
                          {localize(h.bank)} · {localize(h.account)}
                        </small>
                      </div>
                      <b>{localize(money(h.value))}</b>
                    </div>
                  )))}
              </div>
              <p className="chart-caption">{localize("Demo balance · 19 Jun 2026. Future product settlements are not available cash.")}</p>
              <button
                className="primary wide"
                onClick={() => portfolio("cash")}
              >{localize("View cash holdings")}</button>
            </>
          ))}
          {modal === "proposal" && <AdvisorProposals scope={scope}/>}
          {localize(modal === "terms" && (
            <>
              <Label>{localize("SAMPLE TERM SHEET / VERSION 1")}</Label>
              <h2 id="modal-title">{localize(p.name)}</h2>
              <Badge tone="purple">{localize("Illustrative product · Not a live security")}</Badge>
              <div className="detail-grid">
                {localize([
                  ["Notional", "USD " + p.notional.toLocaleString()],
                  ["Issuer", p.issuer + " · fictional"],
                  ["Tenor", "6 months"],
                  ["Annual coupon", p.annualCoupon + "% p.a."],
                  ["Underlying basket", p.underlyings.join(" / ")],
                  ["Settlement", "Cash"],
                ].map(([key, val]) => (
                  <div key={key}>
                    <span>{localize(key)}</span>
                    <strong>{localize(val)}</strong>
                  </div>
                )))}
              </div>
              <h3>{localize("How the payoff works")}</h3>
              <p>
                {localize(product === "phoenix"
                  ? "Monthly, non-memory coupons are paid only when the worst performer is at or above 70% of its initial level. Starting in month 3, a level of 100% or more causes autocall: return of principal plus coupons due up to that month. At final maturity only, a worst level below 60% reduces capital to notional × final worst level / 100. Otherwise principal is returned in full. A dip below 60% before maturity does not itself trigger a loss under these illustrative European-barrier terms."
                  : "Fixed monthly coupon = notional × annual coupon / 12. No autocall and no separate knock-in. At maturity, if the final worst-underlying level is at least 80%, return principal in full; otherwise return notional × final worst level / 80.")}
              </p>
              <h3>{localize("What the visualizer assumes")}</h3>
              <p>{localize("All underlyings start at 100. The displayed paths are hypothetical observations, not market prices. The worst performer determines each condition. Coupons stop after early redemption.")}</p>
              <p>{localize("Issuer performance is assumed. Fees, taxes and interim market valuation are excluded. Issuer default can cause total loss. This independent sample engine is not a connection to Mercury’s existing product engine.")}</p>
              <button
                className="secondary wide"
                onClick={() =>
                  download({
                    id: "TERMS-" + product,
                    title: p.name + " · sample terms",
                    created: new Date().toISOString(),
                    body: JSON.stringify(p, null, 2),
                  })
                }
              >{localize("Export sample terms")}<Icon name="download" size={17} />
              </button>
            </>
          ))}
          {localize(modal === "receipt" && receipt && (
            <>
              <Label>{localize("SAVED DRAFT /")}{localize(receipt.id)}</Label>
              <div className="receipt-tick">
                <Icon name="check" size={27} />
              </div>
              <h2 id="modal-title">{localize("Ready for your next conversation.")}</h2>
              <Badge>{localize("Saved in this browser")}</Badge>
              <h3 className="receipt-title">{localize(receipt.title)}</h3>
              <p className="receipt-text">{localize(receipt.body)}</p>
              <small className="muted">{localize("Saved")}{localize(new Date(receipt.created).toLocaleString(locale()))}{localize("· No message or instruction sent")}</small>
              <button
                className="primary wide"
                onClick={() => download(receipt)}
              >{localize("Export draft")}<Icon name="download" size={17} />
              </button>
              <button className="text-link" onClick={() => go("documents")}>{localize("View all documents")}<Icon name="arrow" size={16} />
              </button>
            </>
          ))}
          {localize((modal === "adviser" || modal === "brief") && (
            <>
              <Label>
                {localize(modal === "brief"
                  ? "SPECIALIST DISCUSSION"
                  : "YOUR ADVISER / EMMA LEE")}
              </Label>
              <h2 id="modal-title">{localize("Bring the right context.")}</h2>
              <p>{localize("Capture what you would like to discuss. Your draft stays in this browser until you choose how to share it.")}</p>
              <label className="field-label" htmlFor="brief">{localize("Your question, goals or known facts")}</label>
              <textarea
                id="brief"
                className="field"
                rows={6}
                maxLength={2000}
                value={brief}
                onChange={(e) => setBrief(e.target.value)}
                placeholder={localize("What would you like to explore?")}
              />
              <button
                className="primary wide"
                disabled={!brief.trim()}
                onClick={() =>
                  save(
                    modal === "brief"
                      ? "Specialist discussion brief"
                      : "Draft for Tan Wei-Jie",
                    brief +
                      "\nContext: " +
                      chatContext +
                      ". Draft only; not sent.",
                  )
                }
              >{localize("Save discussion draft")}<Icon name="arrow" size={18} />
              </button>
            </>
          ))}
          {localize(modal === "settings" && <section className="client-settings"><h2 id="modal-title">{localize("Settings")}</h2><h3>{localize("Preferences")}</h3>
            <label>{localize("Language")}<select aria-label={localize("Language")} value={language} onChange={e=>setLanguage(e.target.value as UILanguage)}><option value="en">{localize("English")}</option><option value="zh-Hant">繁體中文</option><option value="zh-Hans">简体中文</option></select></label>
            <label>{localize("Appearance")}<select aria-label={localize("Appearance")} value={theme} onChange={e=>setTheme(e.target.value as 'light'|'dark'|'system')}><option value="system">{localize("Follow system")}</option><option value="light">{localize("Light")}</option><option value="dark">{localize("Dark")}</option></select></label>
            <label>{localize("Display currency")}<select aria-label={localize("Display currency")} value={currency} onChange={e=>setCurrency(e.target.value as Currency)}>{localize(['USD','HKD','GBP'].map(c=><option key={c}>{localize(c)}</option>))}</select></label><p>{localize("Language and currency are independent. Existing conversations and analysis are preserved.")}</p><p>{localize("Display conversion uses fixed demo FX: USD 1 = HKD 7.80 / GBP 0.77. Product contracts retain their currency.")}</p>
            <h3>{localize("Notification preferences")}</h3>{localize((['products','insights','documents'] as const).map(key=><label key={key}><input type="checkbox" checked={clientRecords.records.preferences[key]} onChange={e=>void clientRecords.preferences({...clientRecords.records.preferences,[key]:e.target.checked})}/>{localize({products:'Product events',insights:'Insights',documents:'Documents'}[key])}</label>))}{localize(clientRecords.error&&<p role="alert">{localize("Preferences could not be saved. Please retry.")}</p>)}
            <h3>{localize("Account and support")}</h3><button onClick={()=>setModal('profile')}>{localize("Profile")}</button><button onClick={()=>setModal('help')}>{localize("Help & About")}</button><p>{localize("Device management, identity verification and remote sign-out are not connected in this local demo.")}</p>
          </section>)}
          {localize(modal==='profile'&&<section><h2 id="modal-title">{localize("Profile")}</h2><h3>{localize("Okonkwo Family")}</h3><p>{localize("Adaeze Okonkwo")}</p><h3>{localize("Accounts & Books")}</h3>{localize(family.books.map(b=><p key={b.id}>{localize(b.bank)} · {localize(b.name)}</p>))}<p>{localize("Profile editing and identity verification are not available in this demo.")}</p></section>)}
          {localize(modal==='help'&&<section><h2 id="modal-title">{localize("Help & About")}</h2><h3>{localize("Mercury Wealth")}</h3><p>{localize("This local demonstration uses imported fictional holdings. Valuation dates and illustrative scenarios are labelled separately. No trades or adviser messages are sent.")}</p><details><summary>{localize("How are returns calculated?")}</summary><p>{localize("Market value includes cash flows. Investment growth requires complete valuations and external flows. Missing history is never inferred from a current snapshot.")}</p></details><details><summary>{localize("Are documents signed?")}</summary><p>{localize("Review records are saved locally. Awaiting signature does not mean signed; no signature provider is connected.")}</p></details><p>{localize("Market charts by")}<a href="https://www.tradingview.com/" target="_blank" rel="noreferrer">{localize("TradingView")}</a>{localize("· Lightweight Charts™")}</p><button onClick={()=>setModal('adviser')}>{localize("Contact support")}</button></section>)}
          {localize(modal === "reset" && (
            <>
              <Label>{localize("RESET DEMO")}</Label>
              <h2 id="modal-title">{localize("Start with a clean slate?")}</h2>
              <p>{localize("This clears your saved conversations, drafts, dismissed insights and demo responses in this browser. Cloud demo holdings and API settings are preserved.")}</p>
              <button className="primary wide" onClick={reset}>{localize("Reset demo")}</button>
              <button className="secondary wide" onClick={() => setModal(null)}>{localize("Keep exploring")}</button>
            </>
          ))}
        </div>
      </dialog>
    </div>
  );
}
