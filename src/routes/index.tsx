import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { supabase } from "@/integrations/supabase/client";
import { AuthPanel } from "@/components/auth-panel";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  analyzeTransitions,
  formatDrawNumbers,
  formatNumber,
  normalizeGameName,
  parseHistoricalGames,
  positionLabel,
  POSITIONS,
  type AnalysisResult,
  type HistoricalDraw,
  type Numbers,
  type TransitionGroup,
} from "@/lib/transition-analyzer";
import { cn } from "@/lib/utils";
import { SmartHistoricalImporter } from "@/components/smart-historical-importer";
import {
  Activity,
  ArrowDown,
  ArrowRight,
  BarChart3,
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Database,
  FileClock,
  Filter,
  Layers3,
  Menu,
  Play,
  Plus,
  Save,
  Search,
  Settings2,
  Sparkles,
  Target,
  Trash2,
  Upload,
  X,
} from "lucide-react";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Positional Transition Analyzer" },
      { name: "description", content: "Analyze historical source-position to target-position relationships across sequential draws." },
      { property: "og:title", content: "Positional Transition Analyzer" },
      { property: "og:description", content: "A quantitative workspace for repeated positional transitions and historical evidence." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AnalyzerApp,
});

type View = "dashboard" | "new" | "history" | "saved" | "settings";

function AnalyzerApp() {
  const [view, setView] = useState<View>("dashboard");
  const [mobileNav, setMobileNav] = useState(false);
  const [gameName, setGameName] = useState("");
  const [provider, setProvider] = useState("");
  const [playedDate, setPlayedDate] = useState("");
  const [currentNumbers, setCurrentNumbers] = useState<Numbers>([0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
  const [historyText, setHistoryText] = useState("");
  const [minimumOccurrences, setMinimumOccurrences] = useState("2");
  const [sourceFilter, setSourceFilter] = useState("all");
  const [targetFilter, setTargetFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
  const [invalidDismissed, setInvalidDismissed] = useState<number[]>([]);
  const [activeMatrixCell, setActiveMatrixCell] = useState<{ source: number; target: number } | null>(null);
  const [expandedTransition, setExpandedTransition] = useState<string | null>(null);
  const [activeSource, setActiveSource] = useState("all");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [signedInEmail, setSignedInEmail] = useState<string | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  useEffect(() => {
    setPlayedDate(new Date().toISOString().slice(0, 10));
    void supabase.auth.getUser().then(({ data }) => {
      setSignedInEmail(data.user?.email ?? null);
      setAuthChecked(true);
    });
    const { data: authSubscription } = supabase.auth.onAuthStateChange((_event, session) => {
      setSignedInEmail(session?.user.email ?? null);
      setAuthChecked(true);
    });
    return () => authSubscription.subscription.unsubscribe();
  }, []);
  const parsed = useMemo(() => parseHistoricalGames(historyText), [historyText]);
  const visibleInvalid = parsed.invalid.filter((item) => !invalidDismissed.includes(item.sourceLine));

  const runAnalysis = () => {
    if (currentNumbers.length !== 10 || currentNumbers.some((number) => number < 1 || number > 90)) {
      setNotice("Enter exactly 10 numbers from 01 to 90 before running the analysis.");
      return;
    }
    if (parsed.valid.length < 2) {
      setNotice("Add at least two valid source-to-following draw pairs so repeated relationships can be inspected.");
      return;
    }
    setAnalysis(analyzeTransitions(currentNumbers, parsed.valid, Number(minimumOccurrences), parsed.duplicates.length));
    setView("dashboard");
    setNotice(`Analysis complete across ${parsed.valid.length} chronological draws.`);
  };

  const saveAnalysis = async () => {
    if (!analysis) return;
    setSaving(true);
    setNotice("");
    const { data: authData, error: authError } = await supabase.auth.getUser();
    if (authError || !authData.user) {
      setNotice("Sign in before saving an analysis.");
      setSaving(false);
      return;
    }
    const userId = authData.user.id;
    const normalizedGameName = normalizeGameName(gameName);
    const normalizedProvider = normalizeGameName(provider);
    const { data: existingGames, error: existingGamesError } = await supabase.from("games").select("id, game_name, provider");
    let game = (existingGames ?? []).find((item) => normalizeGameName(item.game_name) === normalizedGameName && normalizeGameName(item.provider) === normalizedProvider);
    if (!game && !existingGamesError) {
      const { data: createdGame, error: gameError } = await supabase.from("games").insert({ game_name: gameName, provider, user_id: userId }).select("id, game_name, provider").single();
      if (createdGame) game = createdGame;
      if (gameError && !game) {
        const { data: concurrentGames, error: concurrentLookupError } = await supabase.from("games").select("id, game_name, provider");
        game = (concurrentGames ?? []).find((item) => normalizeGameName(item.game_name) === normalizedGameName && normalizeGameName(item.provider) === normalizedProvider);
        if (concurrentLookupError) game = undefined;
      }
    }
    if (!game) {
      setNotice("The analysis could not be saved. Check the Cloud connection and try again.");
      setSaving(false);
      return;
    }
     const persistedDraws = [...new Map([...analysis.orderedDraws, ...analysis.orderedDraws.flatMap((draw) => draw.followingDraw ? [draw.followingDraw] : [])].map((draw) => [draw.id, draw])).values()];
     const drawRows = persistedDraws.map((draw) => ({
      game_id: game.id,
       user_id: userId,
      draw_number: draw.drawNumber,
      draw_date: draw.drawDate,
      p1: draw.numbers[0], p2: draw.numbers[1], p3: draw.numbers[2], p4: draw.numbers[3], p5: draw.numbers[4],
      p6: draw.numbers[5], p7: draw.numbers[6], p8: draw.numbers[7], p9: draw.numbers[8], p10: draw.numbers[9],
    }));
    const { data: savedDraws, error: drawError } = await supabase.from("historical_draws").insert(drawRows).select("id, draw_number, draw_date, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10");
    if (drawError || !savedDraws) {
      setNotice("The analysis details could not be saved. Please try again.");
      setSaving(false);
      return;
    }
    const { data: session, error: sessionError } = await supabase.from("analysis_sessions").insert({
       user_id: userId,
      game_id: game.id,
      game_name: gameName,
      provider,
      played_date: playedDate,
      current_p1: currentNumbers[0], current_p2: currentNumbers[1], current_p3: currentNumbers[2], current_p4: currentNumbers[3], current_p5: currentNumbers[4],
      current_p6: currentNumbers[5], current_p7: currentNumbers[6], current_p8: currentNumbers[7], current_p9: currentNumbers[8], current_p10: currentNumbers[9],
      minimum_occurrences: Number(minimumOccurrences),
    }).select("id").single();
    if (sessionError || !session) {
      setNotice("The session could not be saved. Please try again.");
      setSaving(false);
      return;
    }
    const idByKey = new Map(savedDraws.map((draw) => [`${draw.draw_number}|${draw.draw_date}`, draw.id]));
     const transitionRows = analysis.allTransitions.flatMap((transition) => transition.evidence.map((evidence) => ({
      analysis_session_id: session.id,
       user_id: userId,
      historical_draw_id: idByKey.get(`${evidence.historicalDraw.drawNumber}|${evidence.historicalDraw.drawDate}`),
      next_draw_id: idByKey.get(`${evidence.nextDraw.drawNumber}|${evidence.nextDraw.drawDate}`),
      source_position: transition.sourcePosition,
      source_number: transition.sourceNumber,
      target_position: transition.targetPosition,
      target_number: transition.targetNumber,
    }))).filter((row): row is typeof row & { historical_draw_id: string; next_draw_id: string } => Boolean(row.historical_draw_id && row.next_draw_id));
    if (transitionRows.length > 0) await supabase.from("transitions").insert(transitionRows);
    setSaving(false);
    setNotice("Analysis saved to your workspace.");
    setView("saved");
  };

  const removeInvalid = (line: number) => {
    setInvalidDismissed((lines) => [...lines, line]);
    setHistoryText((text) => text.split(/\r?\n/).filter((_, index) => index + 1 !== line).join("\n"));
  };

  if (!authChecked) {
    return <div className="flex min-h-screen items-center justify-center bg-background text-sm text-muted-foreground">Checking your account…</div>;
  }

  if (!signedInEmail) {
    return <AuthPanel />;
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <aside className={cn("fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-border bg-sidebar px-4 py-5 transition-transform lg:translate-x-0", mobileNav ? "translate-x-0" : "-translate-x-full")}>
        <div className="flex items-center gap-3 px-2">
          <div className="flex size-9 items-center justify-center rounded-lg bg-primary text-primary-foreground"><Activity className="size-5" /></div>
          <div><div className="text-sm font-semibold tracking-wide">POSITIONAL</div><div className="text-xs text-muted-foreground">Transition Analyzer</div></div>
        </div>
        <div className="mt-9 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Workspace</div>
        <nav className="mt-3 space-y-1">
          <NavItem icon={BarChart3} label="Dashboard" active={view === "dashboard"} onClick={() => { setView("dashboard"); setMobileNav(false); }} />
          <NavItem icon={Plus} label="New Analysis" active={view === "new"} onClick={() => { setView("new"); setMobileNav(false); }} />
          <NavItem icon={Database} label="Historical Data" active={view === "history"} onClick={() => { setView("history"); setMobileNav(false); }} />
          <NavItem icon={FileClock} label="Saved Analyses" active={view === "saved"} onClick={() => { setView("saved"); setMobileNav(false); }} />
        </nav>
        <div className="mt-auto space-y-1"><NavItem icon={Settings2} label="Settings" active={view === "settings"} onClick={() => { setView("settings"); setMobileNav(false); }} /><div className="mt-5 border-t border-border pt-4"><div className="px-2 text-xs text-muted-foreground">Cloud workspace</div><div className="mt-2 flex items-center gap-2 px-2 text-xs text-emerald-400"><span className="size-2 rounded-full bg-emerald-400" /> Connected</div></div></div>
      </aside>
      <div className="lg:pl-64">
         <header className="sticky top-0 z-30 border-b border-border bg-background/90 backdrop-blur-xl"><div className="flex h-16 items-center justify-between px-5 lg:px-8"><Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setMobileNav(true)} aria-label="Open navigation"><Menu /></Button><div className="hidden lg:block"><div className="text-xs font-medium uppercase tracking-[0.2em] text-muted-foreground">Historical pattern workspace</div></div><div className="flex items-center gap-3"><Badge variant="outline" className="hidden border-primary/30 bg-primary/10 text-primary sm:flex"><Sparkles className="mr-1 size-3" /> Analysis mode</Badge><span className="hidden text-xs text-muted-foreground xl:inline">{signedInEmail}</span><Button variant="outline" size="sm" onClick={() => setView("new")}><Plus className="size-4" /> New analysis</Button><Button variant="ghost" size="sm" onClick={() => void supabase.auth.signOut()}>Sign out</Button></div></div></header>
        {mobileNav && <button className="fixed inset-0 z-30 bg-background/70 lg:hidden" onClick={() => setMobileNav(false)} aria-label="Close navigation" />}
        <main className="mx-auto max-w-[1600px] px-5 py-7 lg:px-9 lg:py-9">
          {notice && <div className="mb-6 flex items-center justify-between border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary"><span>{notice}</span><Button variant="ghost" size="icon" onClick={() => setNotice("")} aria-label="Dismiss message"><X /></Button></div>}
          {view === "dashboard" && <Dashboard analysis={analysis} currentNumbers={currentNumbers} gameName={gameName} provider={provider} playedDate={playedDate} minimumOccurrences={minimumOccurrences} setMinimumOccurrences={setMinimumOccurrences} sourceFilter={sourceFilter} setSourceFilter={setSourceFilter} targetFilter={targetFilter} setTargetFilter={setTargetFilter} search={search} setSearch={setSearch} activeMatrixCell={activeMatrixCell} setActiveMatrixCell={setActiveMatrixCell} expandedTransition={expandedTransition} setExpandedTransition={setExpandedTransition} activeSource={activeSource} setActiveSource={setActiveSource} onSave={saveAnalysis} saving={saving} onNew={() => setView("new")} />}
          {view === "new" && <NewAnalysis gameName={gameName} setGameName={setGameName} provider={provider} setProvider={setProvider} playedDate={playedDate} setPlayedDate={setPlayedDate} currentNumbers={currentNumbers} setCurrentNumbers={setCurrentNumbers} historyText={historyText} setHistoryText={setHistoryText} parsed={parsed} visibleInvalid={visibleInvalid} removeInvalid={removeInvalid} runAnalysis={runAnalysis} />}
           {view === "history" && <HistoricalData historyText={historyText} setHistoryText={setHistoryText} provider={provider} setProvider={setProvider} parsed={parsed} visibleInvalid={visibleInvalid} removeInvalid={removeInvalid} />}
           {view === "saved" && <SavedAnalyses onOpen={(row) => { setGameName(row.game_name); setProvider(row.provider); setPlayedDate(row.played_date); setCurrentNumbers([row.current_p1, row.current_p2, row.current_p3, row.current_p4, row.current_p5, row.current_p6, row.current_p7, row.current_p8, row.current_p9, row.current_p10]); setMinimumOccurrences(String(row.minimum_occurrences)); setView("dashboard"); setNotice("Saved session loaded. Re-run it with the current historical dataset to refresh evidence."); }} />}
          {view === "settings" && <SettingsView />}
        </main>
      </div>
    </div>
  );
}

function NavItem({ icon: Icon, label, active, onClick }: { icon: typeof Activity; label: string; active: boolean; onClick: () => void }) { return <Button variant="ghost" className={cn("w-full justify-start gap-3 px-3 text-muted-foreground hover:bg-accent hover:text-foreground", active && "bg-primary/10 text-primary hover:bg-primary/10 hover:text-primary")} onClick={onClick}><Icon className="size-4" />{label}</Button>; }

function NewAnalysis({ gameName, setGameName, provider, setProvider, playedDate, setPlayedDate, currentNumbers, setCurrentNumbers, historyText, setHistoryText, parsed, visibleInvalid, removeInvalid, runAnalysis }: { gameName: string; setGameName: (value: string) => void; provider: string; setProvider: (value: string) => void; playedDate: string; setPlayedDate: (value: string) => void; currentNumbers: Numbers; setCurrentNumbers: (value: Numbers) => void; historyText: string; setHistoryText: (value: string) => void; parsed: ReturnType<typeof parseHistoricalGames>; visibleInvalid: ReturnType<typeof parseHistoricalGames>["invalid"]; removeInvalid: (line: number) => void; runAnalysis: () => void }) {
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  return <div className="space-y-8"><PageHeading eyebrow="New analysis" title="Build a positional transition study" description="Set the current draw, load chronological history, then inspect exact source-position → target-position relationships." action={<Button onClick={runAnalysis}><Play className="size-4" /> Run analysis</Button>} />
    <div className="grid gap-6 xl:grid-cols-[0.82fr_1.18fr]"><Card><CardHeader><CardTitle className="flex items-center gap-2 text-base"><Target className="size-4 text-primary" /> Current game</CardTitle></CardHeader><CardContent className="space-y-5"><div className="grid gap-4 sm:grid-cols-2"><Field label="Game name"><Input value={gameName} onChange={(event) => setGameName(event.target.value)} /></Field><Field label="Provider"><Input value={provider} onChange={(event) => setProvider(event.target.value)} /></Field><Field label="Date played"><Input type="date" value={playedDate} onChange={(event) => setPlayedDate(event.target.value)} /></Field></div><div><div className="mb-3 flex items-center justify-between"><label className="text-sm font-medium">Current 10 numbers</label><span className="text-xs text-muted-foreground">Ordered input · 01–90</span></div><div className="grid grid-cols-5 gap-2 sm:grid-cols-10">{currentNumbers.map((number, index) => <div key={index} className="space-y-1"><div className="text-center text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">P{index + 1}</div><Input inputMode="numeric" maxLength={2} value={number === 0 ? "" : editingIndex === index ? String(number) : formatNumber(number)} onFocus={() => setEditingIndex(index)} onBlur={() => setEditingIndex(null)} onChange={(event) => { const next = [...currentNumbers] as Numbers; const raw = event.target.value.replace(/\D/g, ""); next[index] = raw ? Math.min(90, Number(raw)) : 0; setCurrentNumbers(next); }} className="px-1 text-center font-mono text-lg" /></div>)}</div><div className="mt-4 flex items-center justify-center gap-2 font-mono text-sm text-primary"><span>{currentNumbers.slice(0, 5).map(formatNumber).join(" ")}</span><span className="text-muted-foreground">|</span><span>{currentNumbers.slice(5).map(formatNumber).join(" ")}</span></div></div></CardContent></Card>
          <Card><CardHeader><div className="flex items-center justify-between"><div><CardTitle className="flex items-center gap-2 text-base"><Upload className="size-4 text-primary" /> Paste historical games</CardTitle><p className="mt-1 text-sm text-muted-foreground">Dated records are analyzed consecutively: every draw is compared with its immediately following draw. Plain three-line records use line 2 as the source and line 3 as its target.</p></div><Badge variant="outline" className="border-primary/30 text-primary">{parsed.valid.length} valid</Badge></div></CardHeader><CardContent><Textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} className="min-h-[340px] resize-y font-mono text-xs leading-6" placeholder="Paste your historical draw records here" /><div className="mt-4 flex flex-wrap gap-2 text-xs">{parsed.threeLinePairs > 0 && <Badge variant="outline" className="border-primary/30 text-primary">Plain three-line mode · line 2 → line 3</Badge>}<Badge variant="outline" className="border-emerald-500/30 text-emerald-400"><Check className="mr-1 size-3" /> {parsed.valid.length} detected</Badge><Badge variant="outline" className="border-amber-500/30 text-amber-300"><X className="mr-1 size-3" /> {visibleInvalid.length} invalid</Badge></div>{visibleInvalid.length > 0 && <div className="mt-4 space-y-2">{visibleInvalid.map((item) => <div key={item.sourceLine} className="flex items-start justify-between gap-3 border border-amber-500/20 bg-amber-500/5 p-3 text-xs"><div><div className="font-semibold text-amber-300">Line {item.sourceLine}</div><div className="mt-1 text-muted-foreground">{item.reason}</div></div><Button variant="ghost" size="icon" onClick={() => removeInvalid(item.sourceLine)} aria-label={`Remove line ${item.sourceLine}`}><Trash2 className="size-4 text-muted-foreground" /></Button></div>)}</div>}</CardContent></Card></div>
  </div>;
}

function HistoricalData({ historyText, setHistoryText, provider, setProvider, parsed, visibleInvalid, removeInvalid }: { historyText: string; setHistoryText: (value: string) => void; provider: string; setProvider: (value: string) => void; parsed: ReturnType<typeof parseHistoricalGames>; visibleInvalid: ReturnType<typeof parseHistoricalGames>["invalid"]; removeInvalid: (line: number) => void }) {
  return <div className="space-y-8"><PageHeading eyebrow="Historical data" title="Import and inspect the source library" description="Normalize provider records into the existing positional draw library before analysis." /><SmartHistoricalImporter initialProvider={provider} historyText={historyText} onHistoryImported={setHistoryText} onProviderChange={setProvider} /><Card><CardHeader><div className="flex items-center justify-between"><CardTitle className="text-base">Current analysis dataset</CardTitle><div className="flex gap-2"><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{parsed.valid.length} valid</Badge><Badge variant="outline" className="border-amber-500/30 text-amber-300">{visibleInvalid.length} invalid</Badge></div></div></CardHeader><CardContent><Textarea value={historyText} onChange={(event) => setHistoryText(event.target.value)} className="min-h-[160px] font-mono text-xs leading-6" placeholder="Imported records used by the current analysis" />{visibleInvalid.length > 0 && <div className="mt-5 space-y-2">{visibleInvalid.map((item) => <div key={`${item.sourceLine}-${item.reason}`} className="flex items-center justify-between border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs"><span><span className="font-semibold text-amber-300">Line {item.sourceLine}</span> · {item.reason}</span><Button variant="ghost" size="icon" onClick={() => removeInvalid(item.sourceLine)} aria-label={`Remove line ${item.sourceLine}`}><Trash2 className="size-4" /></Button></div>)}</div>}</CardContent></Card><div className="grid gap-3">{parsed.valid.map((draw) => <div key={draw.id} className="grid gap-2 border border-border bg-card/40 px-4 py-3 sm:grid-cols-[90px_130px_1fr] sm:items-center"><span className="font-mono text-sm text-primary">{draw.drawNumber.toString().padStart(4, "0")}</span><span className="text-xs text-muted-foreground">{draw.drawDate}</span><span className="font-mono text-sm">{formatDrawNumbers(draw.numbers)}</span></div>)}</div></div>;
}

function Dashboard({ analysis, currentNumbers, gameName, provider, playedDate, minimumOccurrences, setMinimumOccurrences, sourceFilter, setSourceFilter, targetFilter, setTargetFilter, search, setSearch, activeMatrixCell, setActiveMatrixCell, expandedTransition, setExpandedTransition, activeSource, setActiveSource, onSave, saving, onNew }: { analysis: AnalysisResult | null; currentNumbers: Numbers; gameName: string; provider: string; playedDate: string; minimumOccurrences: string; setMinimumOccurrences: (value: string) => void; sourceFilter: string; setSourceFilter: (value: string) => void; targetFilter: string; setTargetFilter: (value: string) => void; search: string; setSearch: (value: string) => void; activeMatrixCell: { source: number; target: number } | null; setActiveMatrixCell: (value: { source: number; target: number } | null) => void; expandedTransition: string | null; setExpandedTransition: (value: string | null) => void; activeSource: string; setActiveSource: (value: string) => void; onSave: () => void; saving: boolean; onNew: () => void }) {
  const result = analyzeTransitions(currentNumbers, analysis?.orderedDraws ?? [], Number(minimumOccurrences), analysis?.duplicateCount ?? 0);
  const filtered = result.transitions.filter((transition) => (activeSource === "all" || String(transition.sourcePosition) === activeSource) && (sourceFilter === "all" || String(transition.sourcePosition) === sourceFilter) && (targetFilter === "all" || String(transition.targetPosition) === targetFilter) && (!search || `${positionLabel(transition.sourcePosition, transition.sourceNumber)} ${positionLabel(transition.targetPosition, transition.targetNumber)}`.toLowerCase().includes(search.toLowerCase())));
  const matrixDetails = activeMatrixCell ? result.allTransitions.filter((item) => item.occurrenceCount >= Number(minimumOccurrences) && item.sourcePosition === activeMatrixCell.source && item.targetPosition === activeMatrixCell.target) : [];
  const targetGroups = [...filtered.reduce((groups, transition) => { const key = `${transition.targetPosition}|${transition.targetNumber}`; const list = groups.get(key) ?? []; list.push(transition); groups.set(key, list); return groups; }, new Map<string, TransitionGroup[]>()).entries()]
    .map(([key, sources]) => { const [targetPosition, targetNumber] = key.split("|").map(Number); return { targetPosition: targetPosition ?? 0, targetNumber: targetNumber ?? 0, sources }; })
    .sort((a, b) => b.sources.reduce((sum, item) => sum + item.occurrenceCount, 0) - a.sources.reduce((sum, item) => sum + item.occurrenceCount, 0));
  return <div className="space-y-8"><PageHeading eyebrow="Dashboard" title="Repeated positional transitions" description="Read every result as a historical source-position → target-position relationship, not as simple number reappearance." action={<div className="flex gap-2"><Button variant="outline" onClick={onSave} disabled={saving || !analysis}><Save className="size-4" /> {saving ? "Saving…" : "Save analysis"}</Button><Button onClick={onNew}><Plus className="size-4" /> New analysis</Button></div>} />
    <CurrentSummary gameName={gameName} provider={provider} playedDate={playedDate} currentNumbers={currentNumbers} analysis={result} />
     {!analysis && <div className="border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">Start a new analysis to enter historical data and inspect repeated relationships.</div>}
    <div className="flex flex-wrap items-center gap-3 border-y border-border py-4"><div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground"><Filter className="size-3" /> Filters</div><Select value={minimumOccurrences} onValueChange={setMinimumOccurrences}><SelectTrigger className="w-[145px]"><SelectValue /></SelectTrigger><SelectContent>{[1, 2, 3, 4, 5, 10].map((value) => <SelectItem key={value} value={String(value)}>{value}+ occurrences</SelectItem>)}</SelectContent></Select><Select value={sourceFilter} onValueChange={setSourceFilter}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All sources</SelectItem>{POSITIONS.map((position) => <SelectItem key={position} value={String(position)}>Source P{position}</SelectItem>)}</SelectContent></Select><Select value={targetFilter} onValueChange={setTargetFilter}><SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All targets</SelectItem>{POSITIONS.map((position) => <SelectItem key={position} value={String(position)}>Target P{position}</SelectItem>)}</SelectContent></Select><div className="relative ml-auto min-w-[190px] flex-1 sm:flex-none"><Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" /><Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search relationships" className="pl-9" /></div></div>
    <section><SectionHeading icon={ArrowRight} title="Repeated transitions" meta={`${filtered.length} relationships`} /><div className="grid gap-3 lg:grid-cols-2">{filtered.slice(0, 12).map((transition) => <TransitionCard key={transition.key} transition={transition} expanded={expandedTransition === transition.key} onToggle={() => setExpandedTransition(expandedTransition === transition.key ? null : transition.key)} />)}{filtered.length === 0 && <EmptyState title="No repeated relationships at this threshold" description="Lower the minimum occurrence filter to inspect single historical transitions." />}</div></section>
    <section><SectionHeading icon={Layers3} title="Positional convergence" meta={`${result.convergence.length} shared targets`} /><div className="grid gap-4 lg:grid-cols-2">{result.convergence.slice(0, 6).map((group) => <ConvergenceCard key={`${group.targetPosition}-${group.targetNumber}`} group={group} />)}{result.convergence.length === 0 && <EmptyState title="No positional convergence found" description="Convergence appears when different source observations lead to the same target position and number." />}</div></section>
    <section><SectionHeading icon={Target} title="Target analysis" meta="What source patterns led to each target" /><div className="grid gap-3 lg:grid-cols-2">{targetGroups.slice(0, 8).map((group) => <Card key={`${group.targetPosition}-${group.targetNumber}`}><CardContent className="p-4"><div className="flex items-center justify-between border-b border-border pb-3"><span className="text-xs uppercase tracking-wider text-muted-foreground">Target</span><span className="font-mono text-lg font-semibold text-primary">P{group.targetPosition}:{formatNumber(group.targetNumber)}</span></div><div className="mt-3 space-y-2">{group.sources.map((source) => <div key={source.key} className="flex items-center justify-between text-sm"><span className="font-mono">{positionLabel(source.sourcePosition, source.sourceNumber)} <span className="text-muted-foreground">→</span> P{source.targetPosition}:{formatNumber(source.targetNumber)}</span><Badge variant="outline" className="border-primary/30 text-primary">×{source.occurrenceCount}</Badge></div>)}</div></CardContent></Card>)}{targetGroups.length === 0 && <EmptyState title="No target relationships at this threshold" description="Lower the minimum occurrence filter to inspect more target patterns." />}</div></section>
    <section><SectionHeading icon={BookOpen} title="Source position analysis" meta="Current observations" /><div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">{result.sources.map((source) => <SourceCard key={source.position} source={source} active={activeSource === "all" || activeSource === String(source.position)} onClick={() => setActiveSource(activeSource === String(source.position) ? "all" : String(source.position))} />)}</div></section>
    <section><SectionHeading icon={BarChart3} title="Position transition matrix" meta="Click a cell to drill into number relationships" /><Matrix result={result} activeCell={activeMatrixCell} onSelect={setActiveMatrixCell} />{activeMatrixCell && <Card className="mt-4"><CardHeader><CardTitle className="flex items-center gap-2 text-base">P{activeMatrixCell.source} → P{activeMatrixCell.target}<Badge variant="outline" className="ml-auto">{matrixDetails.length} relationships</Badge></CardTitle></CardHeader><CardContent className="space-y-2">{matrixDetails.map((transition) => <TransitionLine key={transition.key} transition={transition} />)}</CardContent></Card>}</section>
    <section><SectionHeading icon={FileClock} title="Historical evidence" meta="Trace each relationship back to the draw pair" /><div className="space-y-3">{filtered.slice(0, 6).map((transition) => <EvidenceAccordion key={transition.key} transition={transition} expanded={expandedTransition === transition.key} onToggle={() => setExpandedTransition(expandedTransition === transition.key ? null : transition.key)} />)}</div></section>
  </div>;
}

function CurrentSummary({ gameName, provider, playedDate, currentNumbers, analysis }: { gameName: string; provider: string; playedDate: string; currentNumbers: Numbers; analysis: AnalysisResult }) { return <Card className="overflow-hidden border-primary/20 bg-gradient-to-r from-card to-primary/5"><CardContent className="p-5 lg:p-6"><div className="grid gap-6 lg:grid-cols-[1fr_1.4fr_1fr]"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current game</div><div className="mt-2 text-xl font-semibold">{gameName || "Untitled analysis"}</div><div className="mt-1 text-sm text-muted-foreground">{provider || "Provider not set"} · {playedDate}</div></div><div className="border-y border-border/70 py-4 lg:border-x lg:border-y-0 lg:px-6 lg:py-0"><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground">Current numbers</div><div className="mt-3 flex items-center gap-2 font-mono text-lg font-semibold"><span>{currentNumbers.slice(0, 5).map(formatNumber).join(" ")}</span><span className="text-primary">|</span><span>{currentNumbers.slice(5).map(formatNumber).join(" ")}</span></div></div><div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-2"><Metric label="Draws analyzed" value={analysis.analyzedDrawCount} /><Metric label="Repeated transitions" value={analysis.transitions.length} /><Metric label="Convergence targets" value={analysis.convergence.length} /><Metric label="Duplicate draws" value={analysis.duplicateCount} /></div></div></CardContent></Card>; }
function Metric({ label, value }: { label: string; value: number }) { return <div><div className="text-2xl font-semibold tracking-tight">{value}</div><div className="mt-1 text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div></div>; }
function TransitionCard({ transition, expanded, onToggle }: { transition: TransitionGroup; expanded: boolean; onToggle: () => void }) { return <Card className="border-border/80"><button className="flex w-full items-center justify-between gap-4 p-4 text-left" onClick={onToggle}><div className="flex items-center gap-3"><div className="font-mono text-base font-semibold text-primary">{positionLabel(transition.sourcePosition, transition.sourceNumber)}</div><ArrowRight className="size-4 text-muted-foreground" /><div className="font-mono text-base font-semibold text-foreground">{positionLabel(transition.targetPosition, transition.targetNumber)}</div></div><div className="flex items-center gap-3"><Badge className="bg-primary/15 text-primary hover:bg-primary/15">×{transition.occurrenceCount}</Badge>{expanded ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronRight className="size-4 text-muted-foreground" />}</div></button>{expanded && <CardContent className="border-t border-border/70 bg-muted/20 px-4 py-4"><EvidenceList transition={transition} /></CardContent>}</Card>; }
function TransitionLine({ transition }: { transition: TransitionGroup }) { return <div className="flex items-center justify-between border-b border-border/60 py-2 last:border-0"><span className="font-mono text-sm">{positionLabel(transition.sourcePosition, transition.sourceNumber)} <span className="text-muted-foreground">→</span> {positionLabel(transition.targetPosition, transition.targetNumber)}</span><Badge variant="outline" className="text-primary">×{transition.occurrenceCount}</Badge></div>; }
function SourceCard({ source, active, onClick }: { source: AnalysisResult["sources"][number]; active: boolean; onClick: () => void }) { return <button onClick={onClick} className={cn("border bg-card p-4 text-left transition-colors hover:border-primary/50", active ? "border-primary/60 bg-primary/5" : "border-border/80")}><div className="flex items-center justify-between"><span className="font-mono font-semibold">{positionLabel(source.position, source.number)}</span><ChevronRight className="size-4 text-muted-foreground" /></div><div className="mt-3 text-xs text-muted-foreground">Historical occurrences</div><div className="mt-1 text-2xl font-semibold">{source.historicalOccurrences}</div><div className="mt-3 border-t border-border pt-3 text-xs text-muted-foreground">{source.occurrencesWithNextDraw} with a valid next draw</div><div className="mt-3 space-y-1">{source.transitions.slice(0, 3).map((transition) => <div key={transition.key} className="flex items-center justify-between font-mono text-xs"><span>P{transition.targetPosition}:{formatNumber(transition.targetNumber)}</span><span className="text-primary">×{transition.occurrenceCount}</span></div>)}{source.transitions.length === 0 && <span className="text-xs text-muted-foreground">No repeated transitions</span>}</div></button>; }
function ConvergenceCard({ group }: { group: AnalysisResult["convergence"][number] }) { return <Card className="border-primary/25 bg-primary/[0.04]"><CardContent className="p-5"><div className="flex items-center justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-primary">Target convergence</div><div className="mt-1 font-mono text-xl font-semibold">P{group.targetPosition}:{formatNumber(group.targetNumber)}</div></div><Badge variant="outline" className="border-primary/30 text-primary">{group.sources.length} source paths</Badge></div><div className="my-4 flex items-center gap-3 text-primary"><div className="space-y-1">{group.sources.map((source) => <div key={source.key} className="flex items-center gap-2 font-mono text-xs"><span className="inline-block h-px w-6 bg-primary/60" />{positionLabel(source.sourcePosition, source.sourceNumber)}</div>)}</div><div className="flex-1 border-t border-dashed border-primary/50" /><ArrowRight className="size-4" /><div className="font-mono text-xs font-semibold">P{group.targetPosition}:{formatNumber(group.targetNumber)}</div></div><div className="space-y-2 border-t border-primary/15 pt-3">{group.sources.map((source) => <div key={source.key} className="flex justify-between text-xs"><span className="font-mono">{positionLabel(source.sourcePosition, source.sourceNumber)} → P{source.targetPosition}:{formatNumber(source.targetNumber)}</span><span className="text-primary">{source.occurrenceCount} occurrences</span></div>)}</div><p className="mt-4 text-[11px] text-muted-foreground">Observed positional convergence — not a guaranteed prediction.</p></CardContent></Card>; }
function Matrix({ result, activeCell, onSelect }: { result: AnalysisResult; activeCell: { source: number; target: number } | null; onSelect: (value: { source: number; target: number }) => void }) { const getCount = (source: number, target: number) => result.matrix.find((cell) => cell.sourcePosition === source && cell.targetPosition === target)?.count ?? 0; return <div className="overflow-x-auto border border-border"><table className="w-full min-w-[760px] border-collapse text-center text-xs"><thead><tr><th className="border-b border-r border-border bg-muted/30 p-3 text-left font-medium text-muted-foreground">Source → Target</th>{POSITIONS.map((position) => <th key={position} className="border-b border-border bg-muted/30 p-3 font-mono font-medium text-muted-foreground">P{position}</th>)}</tr></thead><tbody>{POSITIONS.map((source) => <tr key={source}><th className="border-r border-border bg-muted/20 p-3 text-left font-mono font-medium text-muted-foreground">P{source}</th>{POSITIONS.map((target) => { const count = getCount(source, target); const selected = activeCell?.source === source && activeCell.target === target; return <td key={target} className="border-b border-border/60 p-1"><button onClick={() => onSelect({ source, target })} className={cn("flex h-10 w-full min-w-[48px] items-center justify-center font-mono transition-colors", count > 0 ? "bg-primary/10 text-primary hover:bg-primary/20" : "text-muted-foreground/50 hover:bg-accent", selected && "ring-1 ring-inset ring-primary bg-primary/25")}>{count || "·"}</button></td>; })}</tr>)}</tbody></table></div>; }
function EvidenceAccordion({ transition, expanded, onToggle }: { transition: TransitionGroup; expanded: boolean; onToggle: () => void }) { return <Card><button className="flex w-full items-center justify-between p-4 text-left" onClick={onToggle}><span className="font-mono text-sm font-semibold">{positionLabel(transition.sourcePosition, transition.sourceNumber)} <span className="text-muted-foreground">→</span> {positionLabel(transition.targetPosition, transition.targetNumber)}</span><span className="flex items-center gap-3"><Badge variant="outline" className="border-primary/30 text-primary">{transition.occurrenceCount} occurrences</Badge>{expanded ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</span></button>{expanded && <CardContent className="border-t border-border pt-4"><EvidenceList transition={transition} /></CardContent>}</Card>; }
function EvidenceList({ transition }: { transition: TransitionGroup }) { return <div className="space-y-4">{transition.evidence.map((evidence, index) => <div key={`${evidence.historicalDraw.id}-${index}`} className="border border-border/70 bg-background/40 p-4"><div className="mb-3 flex flex-wrap items-center justify-between gap-2"><div className="text-xs font-semibold uppercase tracking-wider text-primary">Occurrence #{index + 1}</div><div className="text-xs text-muted-foreground">Historical draw {evidence.historicalDraw.drawNumber} · {evidence.historicalDraw.drawDate}</div></div><div className="grid gap-4 lg:grid-cols-[1fr_auto_1fr] lg:items-center"><DrawMini label="Historical draw" draw={evidence.historicalDraw} highlightPosition={transition.sourcePosition} /><div className="flex justify-center text-primary"><ArrowDown className="size-5 lg:rotate-[-90deg]" /></div><DrawMini label="Immediately following draw" draw={evidence.nextDraw} highlightPosition={transition.targetPosition} /></div><div className="mt-4 flex flex-wrap gap-2 text-xs"><Badge className="bg-amber-500/15 text-amber-300 hover:bg-amber-500/15">Source: {positionLabel(transition.sourcePosition, transition.sourceNumber)}</Badge><Badge className="bg-primary/15 text-primary hover:bg-primary/15">Target: {positionLabel(transition.targetPosition, transition.targetNumber)}</Badge></div></div>)}</div>; }
function DrawMini({ label, draw, highlightPosition }: { label: string; draw: HistoricalDraw; highlightPosition: number }) { return <div><div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</div><div className="grid grid-cols-5 gap-1 sm:grid-cols-10">{draw.numbers.map((number, index) => <div key={index} className={cn("border px-1 py-2 text-center font-mono text-xs", index + 1 === highlightPosition ? "border-primary bg-primary/15 text-primary" : "border-border bg-muted/20 text-muted-foreground")}><div className="mb-1 text-[9px]">P{index + 1}</div>{formatNumber(number)}</div>)}</div></div>; }
function SavedAnalyses({ onOpen }: { onOpen: (row: SavedRow) => void }) {
  const [rows, setRows] = useState<SavedRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [pendingDelete, setPendingDelete] = useState<SavedRow | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  useEffect(() => {
    let mounted = true;
    void supabase.from("analysis_sessions").select("*").order("created_at", { ascending: false }).limit(25).then(({ data }) => {
      if (!mounted) return;
      setRows((data ?? []) as SavedRow[]);
      setLoaded(true);
    });
    return () => { mounted = false; };
  }, []);

  const deleteSavedAnalysis = async () => {
    if (!pendingDelete) return;
    const row = pendingDelete;
    setDeletingId(row.id);
    setDeleteError("");
    const { error: sessionError } = await supabase.from("analysis_sessions").delete().eq("id", row.id);
    if (sessionError) {
      setDeleteError("This saved analysis could not be deleted. Please try again.");
      setDeletingId(null);
      return;
    }
    if (row.game_id) {
      const { error: gameError } = await supabase.from("games").delete().eq("id", row.game_id);
      if (gameError) {
        setDeleteError("The saved analysis was removed, but its historical details could not be cleaned up.");
      }
    }
    setRows((currentRows) => currentRows.filter((savedRow) => savedRow.id !== row.id));
    setPendingDelete(null);
    setDeletingId(null);
  };

  return <>
    <div className="space-y-8">
      <PageHeading eyebrow="Saved analyses" title="Reopen prior studies" description="Saved sessions retain the current draw, filters, and underlying transition evidence." />
      {deleteError && <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">{deleteError}</div>}
      <div className="grid gap-3">
        {!loaded && <div className="border border-dashed border-border px-5 py-8 text-center text-sm text-muted-foreground">Loading saved sessions…</div>}
        {rows.length === 0 && loaded && <EmptyState title="No saved analyses yet" description="Run an analysis and save it to build a reusable study history." />}
        {rows.map((row) => <Card key={row.id}><CardContent className="flex flex-wrap items-center justify-between gap-4 p-5"><div><div className="font-semibold">{row.game_name}</div><div className="mt-1 text-sm text-muted-foreground">{row.provider} · played {row.played_date}</div><div className="mt-3 font-mono text-xs text-primary">{[row.current_p1, row.current_p2, row.current_p3, row.current_p4, row.current_p5].map(formatNumber).join(" ")} <span className="text-muted-foreground">|</span> {[row.current_p6, row.current_p7, row.current_p8, row.current_p9, row.current_p10].map(formatNumber).join(" ")}</div></div><div className="flex items-center gap-2"><div className="mr-2 text-right"><div className="text-[10px] uppercase tracking-wider text-muted-foreground">Minimum</div><div className="font-mono text-sm">{row.minimum_occurrences}+</div></div><Button variant="outline" onClick={() => onOpen(row)}>Open <ArrowRight className="size-4" /></Button><Button variant="ghost" size="icon" onClick={() => setPendingDelete(row)} disabled={deletingId !== null} aria-label={`Delete saved analysis ${row.game_name}`} title="Delete saved analysis"><Trash2 className="size-4 text-destructive" /></Button></div></CardContent></Card>)}
      </div>
    </div>
    <AlertDialog open={pendingDelete !== null} onOpenChange={(open) => { if (!open && deletingId === null) setPendingDelete(null); }}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete saved analysis?</AlertDialogTitle>
          <AlertDialogDescription>This will permanently remove “{pendingDelete?.game_name}” and its saved transition evidence.</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deletingId !== null}>Cancel</AlertDialogCancel>
          <AlertDialogAction onClick={(event) => { event.preventDefault(); void deleteSavedAnalysis(); }} disabled={deletingId !== null} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">{deletingId !== null ? "Deleting…" : "Delete analysis"}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  </>;
}
type SavedRow = { id: string; game_id: string | null; game_name: string; provider: string; played_date: string; minimum_occurrences: number; current_p1: number; current_p2: number; current_p3: number; current_p4: number; current_p5: number; current_p6: number; current_p7: number; current_p8: number; current_p9: number; current_p10: number };
function SettingsView() { return <div className="space-y-8"><PageHeading eyebrow="Settings" title="Workspace preferences" description="Keep the analytical workspace focused on observable relationships and traceable evidence." /><div className="grid gap-5 lg:grid-cols-2"><Card><CardHeader><CardTitle className="text-base">Analysis language</CardTitle></CardHeader><CardContent className="space-y-4 text-sm text-muted-foreground"><div className="flex items-center justify-between border-b border-border pb-3"><span>Primary terminology</span><Badge variant="outline">Neutral analytical</Badge></div><div className="flex items-center justify-between border-b border-border pb-3"><span>Default threshold</span><Badge variant="outline">2 occurrences</Badge></div><div className="flex items-center justify-between"><span>Prediction claims</span><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">Disabled</Badge></div></CardContent></Card><Card><CardHeader><CardTitle className="text-base">Data safeguards</CardTitle></CardHeader><CardContent className="space-y-3 text-sm text-muted-foreground"><div className="flex gap-3"><Check className="mt-0.5 size-4 text-emerald-400" />Every transition keeps its historical draw pair.</div><div className="flex gap-3"><Check className="mt-0.5 size-4 text-emerald-400" />Draw positions remain immutable during analysis.</div><div className="flex gap-3"><Check className="mt-0.5 size-4 text-emerald-400" />Duplicate rows are excluded from imported history.</div></CardContent></Card></div></div>; }
function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: React.ReactNode }) { return <div className="flex flex-col gap-5 border-b border-border pb-7 md:flex-row md:items-end md:justify-between"><div><div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">{eyebrow}</div><h1 className="mt-2 text-3xl font-semibold tracking-tight lg:text-4xl">{title}</h1><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{description}</p></div>{action}</div>; }
function SectionHeading({ icon: Icon, title, meta }: { icon: typeof Activity; title: string; meta: string }) { return <div className="mb-4 flex items-center justify-between"><h2 className="flex items-center gap-2 text-lg font-semibold"><Icon className="size-4 text-primary" />{title}</h2><span className="text-xs text-muted-foreground">{meta}</span></div>; }
function Field({ label, children }: { label: string; children: React.ReactNode }) { return <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">{label}</label>{children}</div>; }
function EmptyState({ title, description }: { title: string; description: string }) { return <div className="border border-dashed border-border px-5 py-8 text-center"><div className="text-sm font-medium">{title}</div><div className="mt-1 text-xs text-muted-foreground">{description}</div></div>; }
