import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatDrawNumbers, parseHistoricalGames, type Numbers, type ParsedGame, type ParsedImport } from "@/lib/transition-analyzer";
import { ChevronDown, ChevronRight, Database, FileWarning, Upload, X } from "lucide-react";

type SmartHistoricalImporterProps = {
  initialProvider: string;
  historyText: string;
  onHistoryImported: (value: string) => void;
  onProviderChange: (value: string) => void;
};

type ImportStatus = { kind: "idle" | "importing" | "success" | "error"; message: string; current: number; total: number };
type ImportHistoryRow = { id: string; provider: string; source_name: string | null; source_year: number | null; raw_text: string; games_detected: number; draws_imported: number; draws_rejected: number; duplicates_skipped: number; created_at: string; status: string };

const CHUNK_SIZE = 250;

const canonicalText = (games: ParsedGame[]) => games.filter((game) => game.valid.length > 0).map((game) => [game.name, ...game.valid.sort((a, b) => a.drawNumber - b.drawNumber).map((draw) => `${draw.drawNumber.toString().padStart(4, "0")}: ${draw.drawDate}: ${formatDrawNumbers(draw.numbers)}`)].join("\n")).join("\n\n");
const displayDate = (value: string) => { const [year, month, day] = value.split("-"); return year && month && day ? `${day}/${month}/${year}` : value; };

const drawKey = (draw: { drawNumber: number; drawDate: string; numbers: Numbers }) => `${draw.drawNumber}|${draw.drawDate}|${draw.numbers.join(",")}`;
const isDuplicate = (reason: string) => reason.toLowerCase().startsWith("duplicate");

const chunk = <T,>(items: T[], size: number) => Array.from({ length: Math.ceil(items.length / size) }, (_, index) => items.slice(index * size, index * size + size));

export function SmartHistoricalImporter({ initialProvider, historyText, onHistoryImported, onProviderChange }: SmartHistoricalImporterProps) {
  const [rawText, setRawText] = useState(historyText);
  const [providerMode, setProviderMode] = useState(initialProvider ? "existing" : "custom");
  const [provider, setProvider] = useState(initialProvider);
  const [sourceName, setSourceName] = useState("");
  const [sourceYear, setSourceYear] = useState("");
  const [parsed, setParsed] = useState<ParsedImport | null>(null);
  const [expandedGames, setExpandedGames] = useState<string[]>([]);
  const [providers, setProviders] = useState<string[]>([]);
  const [status, setStatus] = useState<ImportStatus>({ kind: "idle", message: "", current: 0, total: 0 });
  const [importHistory, setImportHistory] = useState<ImportHistoryRow[]>([]);
  const [expandedImport, setExpandedImport] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    void Promise.all([
      supabase.from("games").select("provider"),
      supabase.from("import_batches").select("id, provider, source_name, source_year, raw_text, games_detected, draws_imported, draws_rejected, duplicates_skipped, created_at, status").order("created_at", { ascending: false }).limit(8),
    ]).then(([gameResult, historyResult]) => {
      if (!mounted) return;
      const names = [...new Set((gameResult.data ?? []).map((row) => row.provider.trim()).filter(Boolean))].sort();
      setProviders(names);
      setImportHistory((historyResult.data ?? []) as ImportHistoryRow[]);
      if (!provider && names[0]) {
        setProvider(names[0]);
        setProviderMode("existing");
        onProviderChange(names[0]);
      }
    });
    return () => { mounted = false; };
  }, [initialProvider]);

  const preview = useMemo(() => parsed, [parsed]);
  const validDraws = preview?.games.flatMap((game) => game.valid) ?? [];
  const invalidCount = preview?.invalid.filter((item) => !isDuplicate(item.reason)).length ?? 0;
  const progress = status.total > 0 ? (status.current / status.total) * 100 : 0;

  const parsePreview = () => {
    const next = parseHistoricalGames(rawText);
    setParsed(next);
    setExpandedGames(next.games.filter((game) => game.valid.length > 0).map((game) => game.normalizedName));
    setStatus({ kind: "idle", message: "Preview ready. Nothing has been saved yet.", current: 0, total: 0 });
  };

  const cancelPreview = () => {
    setParsed(null);
    setStatus({ kind: "idle", message: "", current: 0, total: 0 });
  };

  const confirmImport = async () => {
    const selectedProvider = provider.trim();
    if (!preview || !selectedProvider) {
      setStatus({ kind: "error", message: "Choose or enter a provider before importing.", current: 0, total: 0 });
      return;
    }
    if (validDraws.length === 0) {
      setStatus({ kind: "error", message: "There are no valid records available to import.", current: 0, total: 0 });
      return;
    }

    setStatus({ kind: "importing", message: "Starting import…", current: 0, total: validDraws.length });
    const { data: batch, error: batchError } = await supabase.from("import_batches").insert({
      provider: selectedProvider,
      source_name: sourceName.trim() || null,
      source_year: sourceYear ? Number(sourceYear) : null,
      raw_text: rawText,
      games_detected: preview.games.filter((game) => game.valid.length > 0 || game.invalid.length > 0).length,
      draws_detected: preview.drawsDetected,
      draws_rejected: invalidCount,
      duplicates_skipped: preview.duplicates.length,
      status: "importing",
    }).select("id").single();
    if (batchError || !batch) {
      setStatus({ kind: "error", message: "The import could not start. Check the Cloud connection and try again.", current: 0, total: validDraws.length });
      return;
    }

    let imported = 0;
    try {
      for (const game of preview.games.filter((item) => item.valid.length > 0)) {
        const existingGames = (await supabase.from("games").select("id, game_name, provider").ilike("provider", selectedProvider)).data ?? [];
        const normalizedName = game.normalizedName;
        const existingGame = existingGames.find((item) => item.game_name.trim().replace(/\s+/g, " ").toLocaleLowerCase() === normalizedName);
        let gameId = existingGame?.id;
        if (!gameId) {
          const { data: createdGame, error: gameError } = await supabase.from("games").insert({ game_name: game.name, provider: selectedProvider }).select("id").single();
          if (gameError || !createdGame) throw new Error("game");
          gameId = createdGame.id;
        }

        const { data: existingDraws, error: existingError } = await supabase.from("historical_draws").select("draw_number, draw_date, p1, p2, p3, p4, p5, p6, p7, p8, p9, p10").eq("game_id", gameId);
        if (existingError) throw new Error("history");
        const existingKeys = new Set((existingDraws ?? []).map((draw) => drawKey({ drawNumber: draw.draw_number, drawDate: draw.draw_date, numbers: [draw.p1, draw.p2, draw.p3, draw.p4, draw.p5, draw.p6, draw.p7, draw.p8, draw.p9, draw.p10] })));
        const rows = game.valid.filter((draw) => !existingKeys.has(drawKey(draw))).map((draw) => ({
          game_id: gameId,
          draw_number: draw.drawNumber,
          draw_date: draw.drawDate,
          p1: draw.numbers[0], p2: draw.numbers[1], p3: draw.numbers[2], p4: draw.numbers[3], p5: draw.numbers[4],
          p6: draw.numbers[5], p7: draw.numbers[6], p8: draw.numbers[7], p9: draw.numbers[8], p10: draw.numbers[9],
        }));
        for (const rowsChunk of chunk(rows, CHUNK_SIZE)) {
          if (rowsChunk.length > 0) {
            const { error } = await supabase.from("historical_draws").insert(rowsChunk);
            if (error) throw new Error("draws");
          }
          imported += rowsChunk.length;
          setStatus({ kind: "importing", message: `Importing… ${imported} / ${validDraws.length}`, current: imported, total: validDraws.length });
        }
      }

      const { error: batchUpdateError } = await supabase.from("import_batches").update({ draws_imported: imported, status: "completed" }).eq("id", batch.id);
      if (batchUpdateError) throw new Error("batch");
      onHistoryImported(canonicalText(preview.games));
      onProviderChange(selectedProvider);
      setImportHistory((rows) => [{ id: batch.id, provider: selectedProvider, source_name: sourceName.trim() || null, source_year: sourceYear ? Number(sourceYear) : null, raw_text: rawText, games_detected: preview.games.length, draws_imported: imported, draws_rejected: invalidCount, duplicates_skipped: preview.duplicates.length, created_at: new Date().toISOString(), status: "completed" }, ...rows].slice(0, 8));
      setStatus({ kind: "success", message: `Import complete. ${imported} valid records are ready for analysis.`, current: imported, total: validDraws.length });
      setParsed(null);
    } catch {
      await supabase.from("import_batches").update({ draws_imported: imported, status: "failed" }).eq("id", batch.id);
      setStatus({ kind: "error", message: "The import stopped before completion. Existing records were not removed.", current: imported, total: validDraws.length });
    }
  };

  return <div className="space-y-6">
    <Card className="border-primary/20">
      <CardHeader><div className="flex items-start justify-between gap-4"><div><CardTitle className="flex items-center gap-2 text-base"><Upload className="size-4 text-primary" /> Smart historical import</CardTitle><p className="mt-1 max-w-3xl text-sm text-muted-foreground">Paste provider data exactly as received. Game sections, compact numbers, malformed rows, duplicates, and draw gaps are checked before anything is saved.</p></div><Badge variant="outline" className="border-primary/30 text-primary">Preview first</Badge></div></CardHeader>
      <CardContent className="space-y-5">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Provider</label><Select value={providerMode === "custom" ? "__custom__" : provider} onValueChange={(value) => { if (value === "__custom__") { setProviderMode("custom"); setProvider(""); onProviderChange(""); } else { setProviderMode("existing"); setProvider(value); onProviderChange(value); } }}><SelectTrigger><SelectValue placeholder="Select provider" /></SelectTrigger><SelectContent>{providers.map((name) => <SelectItem key={name} value={name}>{name}</SelectItem>)}<SelectItem value="__custom__">Enter a new provider</SelectItem></SelectContent></Select>{providerMode === "custom" && <Input value={provider} onChange={(event) => { setProvider(event.target.value); onProviderChange(event.target.value); }} placeholder="Provider name" />}</div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Source name <span className="text-muted-foreground/60">optional</span></label><Input value={sourceName} onChange={(event) => setSourceName(event.target.value)} placeholder="Provider database or file" /></div>
          <div className="space-y-2"><label className="text-xs font-medium text-muted-foreground">Source year <span className="text-muted-foreground/60">optional</span></label><Input inputMode="numeric" value={sourceYear} onChange={(event) => setSourceYear(event.target.value.replace(/\D/g, "").slice(0, 4))} placeholder="2024" /></div>
        </div>
        <Textarea value={rawText} onChange={(event) => setRawText(event.target.value)} className="min-h-[260px] resize-y font-mono text-xs leading-6" placeholder={'Golden Chance Albarka\n0943: 05/01/2024: 3917742945 | 8341014631\n0944: 12/01/2024: 4114801189 | 5181357521\n\nGolden Chance Bazooka\n0567: 05/01/2024: 1234567890 | 1122334455'} />
        <div className="flex flex-wrap items-center gap-3"><Button onClick={parsePreview} disabled={!rawText.trim()}><Upload className="size-4" /> Parse & preview</Button>{status.message && <span className={status.kind === "error" ? "text-sm text-destructive" : status.kind === "success" ? "text-sm text-emerald-400" : "text-sm text-muted-foreground"}>{status.message}</span>}</div>
      </CardContent>
    </Card>

    {preview && <Card><CardHeader><div className="flex items-center justify-between gap-4"><CardTitle className="text-base">Import preview</CardTitle><div className="flex flex-wrap justify-end gap-2"><Badge variant="outline">{preview.games.length} games detected</Badge><Badge variant="outline">{preview.drawsDetected} draws detected</Badge><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{preview.valid.length} valid</Badge><Badge variant="outline" className="border-amber-500/30 text-amber-300">{invalidCount} invalid</Badge><Badge variant="outline" className="border-amber-500/30 text-amber-300">{preview.duplicates.length} duplicates</Badge><Badge variant="outline" className="border-amber-500/30 text-amber-300">{preview.sequenceWarnings.length} warnings</Badge></div></div></CardHeader><CardContent className="space-y-5">
      {preview.sequenceWarnings.length > 0 && <div className="border border-amber-500/25 bg-amber-500/5 p-3 text-sm text-amber-200"><div className="flex items-center gap-2 font-medium"><FileWarning className="size-4" /> Draw sequence warnings</div><div className="mt-2 space-y-1 text-xs text-amber-100/80">{preview.sequenceWarnings.map((warning) => <div key={`${warning.gameName}-${warning.message}`}>{warning.gameName}: {warning.message}</div>)}</div></div>}
      {preview.invalid.length > 0 && <div className="border border-amber-500/25 bg-amber-500/5 p-3 text-sm"><div className="flex items-center gap-2 font-medium text-amber-200"><X className="size-4" /> Invalid records will be excluded</div><div className="mt-2 max-h-44 space-y-1 overflow-y-auto text-xs text-muted-foreground">{preview.invalid.slice(0, 30).map((item) => <div key={`${item.sourceLine}-${item.reason}`}><span className="text-amber-300">Line {item.sourceLine}</span> · {item.reason}{item.gameName ? ` · ${item.gameName}` : ""}</div>)}</div></div>}
       <div className="space-y-2">{preview.games.map((game) => <div key={game.normalizedName} className="border border-border/80"><Button variant="ghost" className="flex h-auto w-full items-center justify-between gap-3 rounded-none p-3 text-left" onClick={() => setExpandedGames((items) => items.includes(game.normalizedName) ? items.filter((item) => item !== game.normalizedName) : [...items, game.normalizedName])}><span><span className="font-medium">{game.name}</span><span className="ml-3 text-xs text-muted-foreground">{game.valid.length} valid · {game.invalid.filter((item) => !isDuplicate(item.reason)).length} invalid · {game.duplicates.length} duplicates</span></span>{expandedGames.includes(game.normalizedName) ? <ChevronDown className="size-4" /> : <ChevronRight className="size-4" />}</Button>{expandedGames.includes(game.normalizedName) && game.valid.length > 0 && <div className="space-y-2 border-t border-border/70 p-3">{game.valid.slice(0, 100).map((draw) => <div key={draw.id} className="grid gap-2 text-xs sm:grid-cols-[80px_110px_1fr] sm:items-center"><span className="font-mono text-primary">{draw.drawNumber.toString().padStart(4, "0")}</span><span className="text-muted-foreground">{displayDate(draw.drawDate)}</span><span className="font-mono">{formatDrawNumbers(draw.numbers)}</span></div>)}{game.valid.length > 100 && <div className="text-xs text-muted-foreground">Showing the first 100 records.</div>}</div>}</div>)}</div>
      {status.kind === "importing" && <div className="space-y-2"><Progress value={progress} /><div className="text-xs text-muted-foreground">{status.current} / {status.total} valid records</div></div>}
      <div className="flex flex-wrap justify-end gap-2 border-t border-border pt-4"><Button variant="outline" onClick={cancelPreview}><X className="size-4" /> Cancel</Button><Button onClick={() => void confirmImport()} disabled={status.kind === "importing" || preview.valid.length === 0}><Database className="size-4" /> Import {preview.valid.length} valid records</Button></div>
    </CardContent></Card>}

     {importHistory.length > 0 && <Card><CardHeader><CardTitle className="text-base">Import history</CardTitle></CardHeader><CardContent className="space-y-2">{importHistory.map((item) => <div key={item.id} className="border-b border-border/70 py-3 last:border-0"><div className="flex flex-wrap items-center justify-between gap-3"><button className="text-left" onClick={() => setExpandedImport((current) => current === item.id ? null : item.id)}><div className="font-medium">{item.provider}</div><div className="text-xs text-muted-foreground">{new Date(item.created_at).toLocaleString()}{item.source_name ? ` · ${item.source_name}` : ""}{item.source_year ? ` · ${item.source_year}` : ""}</div></button><div className="flex flex-wrap gap-2 text-xs"><Badge variant="outline">{item.games_detected} games</Badge><Badge variant="outline" className="border-emerald-500/30 text-emerald-400">{item.draws_imported} imported</Badge><Badge variant="outline">{item.duplicates_skipped} duplicates skipped</Badge><Badge variant="outline">{item.status}</Badge></div></div>{expandedImport === item.id && <div className="mt-3 border border-border/70 bg-muted/20 p-3"><div className="mb-2 text-xs font-medium text-muted-foreground">Retained source text</div><pre className="max-h-48 overflow-auto whitespace-pre-wrap font-mono text-xs leading-5 text-muted-foreground">{item.raw_text}</pre></div>}</div>)}</CardContent></Card>}
  </div>;
}