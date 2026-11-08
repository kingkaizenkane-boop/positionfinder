import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  analyzeZsa,
  compareZsaValidation,
  createZsaValidationBaseline,
  formatZsaNumber,
  parseZsaSource,
  type ZsaAnalysisResult,
  type ZsaConfirmedGroup,
  type ZsaGroup,
  type ZsaNumbers,
  type ZsaParseResult,
} from "@/lib/zsa-analyzer";
import {
  Activity,
  ArrowRight,
  Check,
  ClipboardCheck,
  Database,
  FileClock,
  Filter,
  Layers3,
  Play,
  Save,
  ShieldAlert,
  Upload,
} from "lucide-react";

type WorkspaceView =
  | "overview"
  | "import"
  | "pairs"
  | "positions"
  | "mappings"
  | "combinations"
  | "validation"
  | "reports";
type GroupRow = {
  id: string;
  game_id: string | null;
  import_batch_id: string | null;
  group_sequence: number;
  game_name: string;
  provider: string;
  line1_occurrence_id: string | null;
  line2_occurrence_id: string | null;
  line3_occurrence_id: string | null;
  completeness_status: ZsaGroup["completeness"];
  grouping_confirmed: boolean;
  draw_date: string | null;
};
type OccurrenceRow = {
  id: string;
  game_id: string | null;
  import_batch_id: string | null;
  source_order: number;
  source_line_start: number;
  source_text: string;
  game_name: string;
  draw_number: number | null;
  draw_date: string | null;
  line_role: number | null;
  position_values: number[] | null;
  record_status: string;
  issues: unknown;
};
type WinnerRow = {
  id: string;
  group_id: string;
  winning_numbers: number[];
  winning_positions: number[] | null;
  confirmation_status: string;
  result_date: string | null;
};
type WinnerRevisionRow = {
  id: string;
  group_id: string;
  confirmed_result_id: string;
  proposed_winning_numbers: number[];
  proposed_winning_positions: number[] | null;
  review_status: string;
  source_text: string;
  created_at: string;
};
type ValidationRow = {
  id: string;
  case_name: string;
  game_name: string;
  provider: string;
  line2_values: number[];
  line3_values: number[] | null;
  winning_numbers: number[];
  winning_positions: number[] | null;
  validation_status: string;
  analysis_snapshot: Record<string, unknown>;
};
type SavedRun = {
  id: string;
  name: string;
  dataset_version: string;
  created_at: string;
  result_summary: Record<string, unknown>;
  dataset_snapshot: unknown;
};
type WinningResultPayload = {
  group_id: string;
  winning_numbers: number[];
  winning_positions: number[] | null;
  confirmation_status: string;
  result_date: string | null;
  source_type: string;
  source_text: string;
  confirmed_at: string;
};

const parseList = (value: string, expected: number) => {
  const numbers = value
    .trim()
    .split(/[\s,|;]+/)
    .filter(Boolean)
    .map(Number);
  return numbers.length === expected &&
    numbers.every((number) => Number.isInteger(number) && number >= 1 && number <= 90)
    ? numbers
    : null;
};
const normalized = (value: string) => value.trim().replace(/\s+/g, " ").toLocaleLowerCase();
const positionValues = (values: number[] | null): ZsaNumbers | null =>
  values?.length === 10 ? (values as ZsaNumbers) : null;
const prettyPair = (pair: [number, number]) =>
  `${formatZsaNumber(pair[0])}–${formatZsaNumber(pair[1])}`;

export function ZsaWorkspace() {
  const [activeView, setActiveView] = useState<WorkspaceView>("overview");
  const [provider, setProvider] = useState("");
  const [sourceName, setSourceName] = useState("");
  const [sourceText, setSourceText] = useState("");
  const [preview, setPreview] = useState<ZsaParseResult | null>(null);
  const [confirmations, setConfirmations] = useState<Record<string, boolean>>({});
  const [groups, setGroups] = useState<ZsaConfirmedGroup[]>([]);
  const [winnerRows, setWinnerRows] = useState<WinnerRow[]>([]);
  const [winnerRevisionRows, setWinnerRevisionRows] = useState<WinnerRevisionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [minimumOccurrences, setMinimumOccurrences] = useState("2");
  const [minimumGames, setMinimumGames] = useState("1");
  const [selectedGroup, setSelectedGroup] = useState("");
  const [winnersInput, setWinnersInput] = useState("");
  const [winnerPositionsInput, setWinnerPositionsInput] = useState("");
  const [caseRow, setCaseRow] = useState<ValidationRow | null>(null);
  const [caseLine3, setCaseLine3] = useState("");
  const [casePositions, setCasePositions] = useState("");
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  const [savedRunName, setSavedRunName] = useState("ZSA research snapshot");
  const [loadError, setLoadError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const loadWorkspace = async () => {
    setLoading(true);
    const [groupsResult, occurrencesResult, winnersResult, revisionsResult, casesResult, runsResult] =
      await Promise.all([
        supabase.from("zsa_groups").select("*").order("game_name").order("group_sequence"),
        supabase.from("zsa_source_occurrences").select("*").order("source_order"),
        supabase.from("zsa_winning_results").select("*"),
        supabase.from("zsa_winning_result_revisions").select("*"),
        supabase
          .from("zsa_validation_cases")
          .select("*")
          .order("created_at", { ascending: false })
          .limit(1),
        supabase
          .from("zsa_analysis_runs")
          .select("id, name, dataset_version, created_at, result_summary, dataset_snapshot")
          .order("created_at", { ascending: false })
          .limit(20),
      ]);
    const failedRead = [
      groupsResult,
      occurrencesResult,
      winnersResult,
      revisionsResult,
      casesResult,
      runsResult,
    ].find((result) => result.error)?.error;
    if (failedRead)
      setLoadError(
        "ZSA records could not be loaded. Check the shared Cloud connection and try again.",
      );
    else setLoadError("");
    const occurrences = (occurrencesResult.data ?? []) as OccurrenceRow[];
    const occurrenceById = new Map(occurrences.map((row) => [row.id, row]));
    const winningRows = (winnersResult.data ?? []) as WinnerRow[];
    const winningByGroup = new Map(
      winningRows
        .filter((item) => item.confirmation_status === "confirmed")
        .map((item) => [item.group_id, item]),
    );
    const mappedGroups = ((groupsResult.data ?? []) as GroupRow[]).map((row) => {
      const line1 = row.line1_occurrence_id
        ? occurrenceById.get(row.line1_occurrence_id)
        : undefined;
      const line2 = row.line2_occurrence_id
        ? occurrenceById.get(row.line2_occurrence_id)
        : undefined;
      const line3 = row.line3_occurrence_id
        ? occurrenceById.get(row.line3_occurrence_id)
        : undefined;
      const winner = winningByGroup.get(row.id);
      return {
        id: row.id,
        gameId: row.game_id ?? `unlinked-${row.id}`,
        gameName: row.game_name,
        provider: row.provider,
        groupSequence: row.group_sequence,
        drawDate: row.draw_date,
        groupingConfirmed: row.grouping_confirmed,
        completeness: row.completeness_status,
        line1: positionValues(line1?.position_values ?? null),
        line2: positionValues(line2?.position_values ?? null),
        line3: positionValues(line3?.position_values ?? null),
        line2DrawNumber: line2?.draw_number ?? null,
        line3DrawNumber: line3?.draw_number ?? null,
        winningNumbers: winner?.winning_numbers ?? null,
        winningPositions: winner?.winning_positions ?? null,
        winnerConfirmed: Boolean(winner),
      } satisfies ZsaConfirmedGroup;
    });
    setGroups(mappedGroups);
    setWinnerRows(winningRows);
    setWinnerRevisionRows((revisionsResult.data ?? []) as WinnerRevisionRow[]);
    const firstCase = ((casesResult.data ?? []) as ValidationRow[])[0] ?? null;
    setCaseRow(firstCase);
    setCaseLine3(firstCase?.line3_values?.map(formatZsaNumber).join(" ") ?? "");
    setCasePositions(firstCase?.winning_positions?.join(" ") ?? "");
    setSavedRuns((runsResult.data ?? []) as SavedRun[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadWorkspace();
  }, []);

  const analysis = useMemo(
    () =>
      analyzeZsa(groups, {
        minimumOccurrences: Number(minimumOccurrences),
        minimumDistinctGames: Number(minimumGames),
      }),
    [groups, minimumOccurrences, minimumGames],
  );
  const completeGroups = groups.filter(
    (group) =>
      group.completeness === "complete" && group.groupingConfirmed && group.line3 && group.line2,
  );
  const statusCounts = groups.reduce<Record<string, number>>((counts, group) => {
    counts[group.completeness] = (counts[group.completeness] ?? 0) + 1;
    return counts;
  }, {});

  const makePreview = () => {
    if (!provider.trim()) {
      setStatus("Choose a provider before previewing this source.");
      return;
    }
    const parsed = parseZsaSource(sourceText, provider);
    setPreview(parsed);
    setConfirmations(Object.fromEntries(parsed.groups.map((group) => [group.id, false])));
    setStatus(
      `${parsed.records.length} source records grouped into ${parsed.groups.length} provisional groups. Nothing has been saved.`,
    );
  };

  const importPreview = async () => {
    if (
      !preview ||
      !preview.groups.length ||
      preview.groups.some((group) => !confirmations[group.id])
    ) {
      setStatus("Review and confirm every proposed group boundary before importing.");
      return;
    }
    setBusy(true);
    setStatus("Saving source text and group evidence…");
    const roleByLine = new Map<number, number>();
    for (const group of preview.groups) {
      if (group.line1) roleByLine.set(group.line1.sourceLine, 1);
      if (group.line2) roleByLine.set(group.line2.sourceLine, 2);
      if (group.line3) roleByLine.set(group.line3.sourceLine, 3);
    }
    const occurrencesPayload = preview.records.map((record) => ({
      sourceOrder: record.sourceOrder,
      sourceLine: record.sourceLine,
      rawText: record.rawText,
      gameName: record.gameName,
      drawNumber: record.drawNumber,
      drawDate: record.drawDate,
      numbers: record.numbers,
      lineRole: record.declaredRole ?? roleByLine.get(record.sourceLine) ?? null,
      recordStatus: record.issues.some((issue) => issue.startsWith("Duplicate"))
        ? "duplicate"
        : record.issues.length > 0
          ? "invalid"
          : "valid",
      issues: record.issues,
    }));
    const groupsPayload = preview.groups.map((group) => ({
      sequence: group.sequence,
      gameName: group.gameName,
      completeness: group.completeness,
      line1SourceLine: group.line1?.sourceLine ?? null,
      line2SourceLine: group.line2?.sourceLine ?? null,
      line3SourceLine: group.line3?.sourceLine ?? null,
      drawDate: group.line3?.drawDate ?? group.line2?.drawDate ?? null,
    }));
    const batchId = crypto.randomUUID();
    const { data: atomicSaveId, error: atomicSaveError } = await supabase.rpc(
      "save_zsa_source_import",
      {
        p_batch_id: batchId,
        p_provider: preview.provider,
        p_source_name: sourceName.trim() || "Pasted ZSA source",
        p_raw_text: preview.rawText,
        p_occurrences: occurrencesPayload,
        p_groups: groupsPayload,
      },
    );
    if (atomicSaveError || !atomicSaveId) {
      setStatus(
        "The source group could not be saved atomically; no partial source rows were written.",
      );
      setBusy(false);
      return;
    }
    setSourceText("");
    setSourceName("");
    setPreview(null);
    setStatus(
      `Saved ${preview.records.length} source records and ${preview.groups.length} confirmed group boundaries. Invalid and incomplete records remain reviewable and are excluded from analysis.`,
    );
    await loadWorkspace();
    setBusy(false);
  };

  const saveWinners = async () => {
    const group = groups.find((item) => item.id === selectedGroup);
    const winningNumbers = parseList(winnersInput, 5);
    if (!group || !winningNumbers || !group.line3) {
      setStatus("Select a group with Line 3 and enter five valid winning numbers.");
      return;
    }
    if (
      new Set(winningNumbers).size !== 5 ||
      !winningNumbers.every((number) => group.line3?.includes(number))
    ) {
      setStatus(
        "Each confirmed winner must be a distinct value present in the Line 3 candidate record.",
      );
      return;
    }
    const rawPositions = winnerPositionsInput.trim() ? parseList(winnerPositionsInput, 5) : null;
    if (
      winnerPositionsInput.trim() &&
      (!rawPositions ||
        new Set(rawPositions).size !== 5 ||
        !rawPositions.every(
          (position, index) => group.line3?.[position - 1] === winningNumbers[index],
        ))
    ) {
      setStatus(
        "Winner positions must be five distinct positions from 1–10 and match the five winners in the same order.",
      );
      return;
    }
    setBusy(true);
    const prior = winnerRows.find((item) => item.group_id === group.id);
    if (
      prior?.confirmation_status === "confirmed" &&
      (prior.winning_numbers.join(",") !== winningNumbers.join(",") ||
        (prior.winning_positions?.join(",") ?? "") !== (rawPositions?.join(",") ?? ""))
    ) {
      const { error: versionError } = await supabase
        .from("zsa_winning_result_revisions")
        .insert({
          confirmed_result_id: prior.id,
          group_id: group.id,
          proposed_winning_numbers: winningNumbers,
          proposed_winning_positions: rawPositions,
          review_status: "requires_review",
          source_text: "Correction submitted for shared review; original confirmation is preserved.",
      });
      setStatus(
        versionError
          ? "The correction evidence could not be retained; the prior confirmed result remains unchanged."
          : "Correction saved as a separate review record; the prior confirmed result remains unchanged.",
      );
      setBusy(false);
      if (!versionError) await loadWorkspace();
      return;
    }
    if (
      prior?.confirmation_status === "confirmed" &&
      rawPositions &&
      (prior.winning_positions?.join(",") ?? "") !== rawPositions.join(",")
    ) {
      const { error: versionError } = await supabase
        .from("zsa_winning_result_revisions")
        .insert({
          confirmed_result_id: prior.id,
          group_id: group.id,
          proposed_winning_numbers: winningNumbers,
          proposed_winning_positions: rawPositions,
          review_status: "requires_review",
          source_text: "Position correction submitted for shared review; original confirmation is preserved.",
      });
      setStatus(
        versionError
          ? "The position correction could not be retained; the prior confirmed result remains unchanged."
          : "Position correction saved as separate review evidence; the prior confirmed result remains unchanged.",
      );
      setBusy(false);
      if (!versionError) await loadWorkspace();
      return;
    }
    const winnerPayload: WinningResultPayload = {
      group_id: group.id,
      winning_numbers: winningNumbers,
      winning_positions: rawPositions,
      confirmation_status: "confirmed",
      result_date: group.drawDate,
      source_type: "manual",
      source_text: "Explicit user confirmation in ZSA workspace",
      confirmed_at: new Date().toISOString(),
    };
    const result = prior
      ? await supabase.from("zsa_winning_results").update(winnerPayload).eq("id", prior.id)
      : await supabase.from("zsa_winning_results").insert(winnerPayload);
    if (result.error) setStatus("The confirmed result could not be saved.");
    else {
      setWinnersInput("");
      setWinnerPositionsInput("");
      setStatus("Five Line 3 winners saved as explicitly confirmed.");
      await loadWorkspace();
    }
    setBusy(false);
  };

  const saveReport = async () => {
    setBusy(true);
    const groupSnapshot = groups.map((group) => ({ ...group }));
    const datasetVersion = `${groups.length}-${groups
      .map(
        (group) =>
          `${group.id}:${group.winnerConfirmed ? group.winningNumbers?.join(",") : "unconfirmed"}`,
      )
      .sort()
      .join("|")}`;
    const response = await supabase.from("zsa_analysis_runs").insert({
      name: savedRunName.trim() || "ZSA research snapshot",
      filters: {
        minimumOccurrences: Number(minimumOccurrences),
        minimumDistinctGames: Number(minimumGames),
      },
      threshold_settings: {
        minimumOccurrences: Number(minimumOccurrences),
        minimumDistinctGames: Number(minimumGames),
      },
      dataset_snapshot: groupSnapshot,
      result_summary: analysis,
      dataset_version: datasetVersion,
      engine_version: "zsa-v1",
    });
    if (response.error) setStatus("The immutable research snapshot could not be saved.");
    else {
      setStatus("Saved a reproducible ZSA snapshot with its source groups and results.");
      await loadWorkspace();
    }
    setBusy(false);
  };

  const saveValidationUpdate = async () => {
    if (!caseRow) return;
    const values = caseLine3.trim() ? parseList(caseLine3, 10) : null;
    const positions = casePositions.trim() ? parseList(casePositions, 5) : null;
    if (caseLine3.trim() && !values) {
      setStatus("Line 3 must contain exactly ten values from 01 to 90.");
      return;
    }
    if (
      casePositions.trim() &&
      (!positions ||
        new Set(positions).size !== 5 ||
        !caseRow.winning_numbers.every(
          (number, index) =>
            values?.[positions[index] !== undefined ? positions[index] - 1 : -1] === number,
        ))
    ) {
      setStatus("Confirmed positions must match all five supplied winning numbers.");
      return;
    }
    if (values && !caseRow.winning_numbers.every((number) => values.includes(number))) {
      setStatus("The Line 3 candidate record must contain all five confirmed winners.");
      return;
    }
    setBusy(true);
    const result = await supabase
      .from("zsa_validation_cases")
      .update({
        line3_values: values,
        winning_positions: positions,
        validation_status: values
          ? positions
            ? "ready"
            : "awaiting_confirmation"
          : "awaiting_line3",
      })
      .eq("id", caseRow.id);
    if (result.error) setStatus("The validation case could not be updated.");
    else {
      setStatus("Validation case updated separately from the historical training groups.");
      await loadWorkspace();
    }
    setBusy(false);
  };

  const evaluateValidation = async () => {
    if (!caseRow?.line3_values || !caseRow.winning_positions) {
      setStatus(
        "Add the Line 3 candidate record and confirm all five winner positions before evaluation.",
      );
      return;
    }
    if (caseRow.validation_status === "evaluated") {
      setStatus("This evaluation is already frozen. Start a new validation case for another comparison.");
      return;
    }
    const baseline = createZsaValidationBaseline(groups, analysis, new Date().toISOString());
    const comparison = compareZsaValidation(baseline, caseRow.winning_numbers);
    const snapshot = { ...baseline, ...comparison };
    setBusy(true);
    const result = await supabase
      .from("zsa_validation_cases")
      .update({ analysis_snapshot: snapshot, validation_status: "evaluated" })
      .eq("id", caseRow.id);
    if (result.error) setStatus("The frozen validation snapshot could not be saved.");
    else {
      setStatus(
        "Validation compared against the saved historical baseline; this case was not included in it.",
      );
      await loadWorkspace();
    }
    setBusy(false);
  };

  const nav: Array<{ key: WorkspaceView; label: string; icon: typeof Activity }> = [
    { key: "overview", label: "Overview", icon: Activity },
    { key: "import", label: "Import & data quality", icon: Upload },
    { key: "pairs", label: "Pair recurrence", icon: Database },
    { key: "positions", label: "Position & number analysis", icon: Filter },
    { key: "mappings", label: "Exact mapping", icon: ArrowRight },
    { key: "combinations", label: "Position combinations", icon: Layers3 },
    { key: "validation", label: "Live validation", icon: ClipboardCheck },
    { key: "reports", label: "Saved ZSA reports", icon: FileClock },
  ];

  return (
    <div className="space-y-7">
      <div className="flex flex-col gap-4 border-b border-border pb-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-xs font-semibold uppercase text-primary">
            <Activity className="size-4" /> Zero-Separated Analysis
          </div>
          <h1 className="mt-2 text-3xl font-semibold">Historical relationships, fully evidenced</h1>
          <p className="mt-2 max-w-3xl text-sm text-muted-foreground">
            Analyze confirmed winning pairs and their Line 2 positional evidence. Recurrence is
            historical evidence, not a guarantee of future outcomes.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Select value={minimumOccurrences} onValueChange={setMinimumOccurrences}>
            <SelectTrigger className="w-36">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3, 5, 10].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  Pairs {value}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={minimumGames} onValueChange={setMinimumGames}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[1, 2, 3].map((value) => (
                <SelectItem key={value} value={String(value)}>
                  Games {value}+
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      <div className="flex gap-2 overflow-x-auto border-b border-border pb-2">
        {nav.map(({ key, label, icon: Icon }) => (
          <Button
            key={key}
            variant={activeView === key ? "default" : "ghost"}
            size="sm"
            className="shrink-0"
            onClick={() => setActiveView(key)}
          >
            <Icon className="size-4" />
            {label}
          </Button>
        ))}
      </div>
      {status && (
        <div className="flex items-center justify-between border border-primary/25 bg-primary/5 px-4 py-3 text-sm text-primary">
          <span>{status}</span>
          <Button variant="ghost" size="sm" onClick={() => setStatus("")}>
            Dismiss
          </Button>
        </div>
      )}
      {loadError && (
        <div className="border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {loadError}
          <Button variant="ghost" size="sm" className="ml-2" onClick={() => void loadWorkspace()}>
            Retry
          </Button>
        </div>
      )}
      {loading ? (
        <div className="border border-dashed border-border px-5 py-10 text-center text-sm text-muted-foreground">
          Loading ZSA records…
        </div>
      ) : (
        <>
          {activeView === "overview" && (
            <Overview
              analysis={analysis}
              groups={groups}
              statusCounts={statusCounts}
              onView={setActiveView}
              onSave={() => void saveReport()}
              busy={busy}
            />
          )}
          {activeView === "import" && (
            <ImportView
              provider={provider}
              setProvider={setProvider}
              sourceName={sourceName}
              setSourceName={setSourceName}
              sourceText={sourceText}
              setSourceText={setSourceText}
              preview={preview}
              confirmations={confirmations}
              setConfirmations={setConfirmations}
              makePreview={makePreview}
              importPreview={() => void importPreview()}
              busy={busy}
              groups={groups}
              selectedGroup={selectedGroup}
              setSelectedGroup={setSelectedGroup}
              winnersInput={winnersInput}
              setWinnersInput={setWinnersInput}
              winnerPositionsInput={winnerPositionsInput}
              setWinnerPositionsInput={setWinnerPositionsInput}
              saveWinners={() => void saveWinners()}
              revisions={winnerRevisionRows}
            />
          )}
          {activeView === "pairs" && (
            <PairView
              analysis={analysis}
              minimumOccurrences={minimumOccurrences}
              setMinimumOccurrences={setMinimumOccurrences}
              minimumGames={minimumGames}
              setMinimumGames={setMinimumGames}
            />
          )}
          {activeView === "positions" && <PositionView analysis={analysis} />}
          {activeView === "mappings" && <MappingView analysis={analysis} />}
          {activeView === "combinations" && <CombinationView analysis={analysis} />}
          {activeView === "validation" && (
            <ValidationView
              caseRow={caseRow}
              line3={caseLine3}
              setLine3={setCaseLine3}
              positions={casePositions}
              setPositions={setCasePositions}
              save={() => void saveValidationUpdate()}
              evaluate={() => void evaluateValidation()}
              busy={busy}
            />
          )}
          {activeView === "reports" && (
            <ReportsView
              runs={savedRuns}
              name={savedRunName}
              setName={setSavedRunName}
              save={() => void saveReport()}
              busy={busy}
            />
          )}
        </>
      )}
    </div>
  );
}

function Overview({
  analysis,
  groups,
  statusCounts,
  onView,
  onSave,
  busy,
  revisions,
}: {
  analysis: ZsaAnalysisResult;
  groups: ZsaConfirmedGroup[];
  statusCounts: Record<string, number>;
  onView: (view: WorkspaceView) => void;
  onSave: () => void;
  busy: boolean;
}) {
  const metrics = [
    ["Source groups", groups.length],
    ["Confirmed results", analysis.confirmedResultCount],
    ["Qualifying winning pairs", analysis.pairs.length],
    ["Cross-game pairs", analysis.pairs.filter((item) => item.crossGame).length],
  ];
  return (
    <div className="space-y-7">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {metrics.map(([label, value]) => (
          <Card key={label}>
            <CardContent className="p-5">
              <div className="text-3xl font-semibold">{value}</div>
              <div className="mt-1 text-xs text-muted-foreground">{label}</div>
            </CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Data readiness</h2>
            <Button variant="outline" size="sm" onClick={() => onView("import")}>
              Review source <ArrowRight className="size-4" />
            </Button>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {["complete", "incomplete", "invalid"].map((key) => (
              <div key={key} className="border border-border px-3 py-4">
                <div className="text-2xl font-semibold">{statusCounts[key] ?? 0}</div>
                <div className="text-xs capitalize text-muted-foreground">{key} groups</div>
              </div>
            ))}
          </div>
          <div className="border border-amber-500/25 bg-amber-500/5 p-4 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ShieldAlert className="size-4" /> No historical source data has been imported into
              ZSA
            </div>
            <p className="mt-2 text-muted-foreground">
              Existing draws do not retain trusted three-line group boundaries or confirmed winners.
              Upload the original source, confirm each group, and explicitly confirm winners before
              it contributes to ZSA.
            </p>
          </div>
        </section>
        <section className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Most repeated confirmed pairs</h2>
            <Button variant="ghost" size="sm" onClick={() => onView("pairs")}>
              All pairs <ArrowRight className="size-4" />
            </Button>
          </div>
          {analysis.pairs.slice(0, 6).map((pair) => (
            <div
              key={pair.key}
              className="flex items-center justify-between border-b border-border py-2"
            >
              <span className="font-mono">{prettyPair(pair.pair)}</span>
              <span className="flex gap-2">
                <Badge variant="outline">{pair.distinctGames} games</Badge>
                <Badge variant="outline">×{pair.occurrenceCount}</Badge>
              </span>
            </div>
          ))}
          {analysis.pairs.length === 0 && (
            <Empty
              title="No qualifying winning-pair evidence"
              description="Confirmed five-number results from complete, reviewed groups will appear here."
            />
          )}
        </section>
      </div>
      <div className="flex justify-end">
        <Button onClick={onSave} disabled={busy || groups.length === 0}>
          <Save className="size-4" /> Save analysis snapshot
        </Button>
      </div>
    </div>
  );
}

function ImportView(props: {
  provider: string;
  setProvider: (value: string) => void;
  sourceText: string;
  setSourceText: (value: string) => void;
  preview: ZsaParseResult | null;
  confirmations: Record<string, boolean>;
  setConfirmations: (value: Record<string, boolean>) => void;
  makePreview: () => void;
  importPreview: () => void;
  busy: boolean;
  groups: ZsaConfirmedGroup[];
  selectedGroup: string;
  setSelectedGroup: (value: string) => void;
  winnersInput: string;
  setWinnersInput: (value: string) => void;
  winnerPositionsInput: string;
  setWinnerPositionsInput: (value: string) => void;
  saveWinners: () => void;
  revisions: WinnerRevisionRow[];
}) {
  const line2AvailableGroups = props.groups.filter(
    (group) => group.groupingConfirmed && group.line2 && group.line3,
  );
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Upload className="size-4 text-primary" /> Lossless three-record source import
          </CardTitle>
          <p className="text-sm text-muted-foreground">
            Blank lines, end markers, and game headings close a group section. Every detected record
            keeps its original text, line number, order, and validation issues. Proposed grouping
            stays provisional until you confirm it.
          </p>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-sm space-y-2">
            <label className="text-xs font-medium text-muted-foreground">
              Provider — selected by you, never inferred
            </label>
            <Input
              value={props.provider}
              onChange={(event) => props.setProvider(event.target.value)}
              placeholder="Enter provider name"
            />
          </div>
          <Textarea
            value={props.sourceText}
            onChange={(event) => props.setSourceText(event.target.value)}
            className="min-h-64 font-mono text-xs leading-6"
            placeholder={
              "Golden Chance Albarka\nLine 1: 01 02 03 04 05 | 06 07 08 09 10\nLine 2: 11 12 13 14 15 | 16 17 18 19 20\nLine 3: 21 22 23 24 25 | 26 27 28 29 30\nEND"
            }
          />
          <Button onClick={props.makePreview} disabled={!props.sourceText.trim()}>
            <Play className="size-4" /> Parse & preview
          </Button>
        </CardContent>
      </Card>
      {props.preview && (
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-base">Source preview</CardTitle>
              <div className="flex gap-2">
                <Badge variant="outline">{props.preview.records.length} records</Badge>
                <Badge variant="outline">{props.preview.groups.length} groups</Badge>
                <Badge variant="outline">
                  {props.preview.records.filter((record) => record.issues.length).length} with
                  issues
                </Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {props.preview.warnings.map((warning) => (
              <div key={warning} className="border border-amber-500/25 bg-amber-500/5 p-3 text-sm">
                {warning}
              </div>
            ))}
            {props.preview.groups.map((group) => (
              <div key={group.id} className="border border-border p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="font-semibold">
                      {group.gameName} · Group {group.sequence}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {group.completeness} · source lines {group.line1?.sourceLine ?? "—"},{" "}
                      {group.line2?.sourceLine ?? "—"}, {group.line3?.sourceLine ?? "—"}
                    </div>
                  </div>
                  <Badge variant={group.completeness === "complete" ? "outline" : "destructive"}>
                    {group.completeness}
                  </Badge>
                </div>
                <div className="mt-4 grid gap-2">
                  {[group.line1, group.line2, group.line3].map((record, index) => (
                    <div
                      key={record?.id ?? `missing-${index}`}
                      className="grid gap-2 border-t border-border/60 pt-2 text-xs sm:grid-cols-[80px_1fr]"
                    >
                      <span className="font-semibold text-primary">
                        Line {index + 1}
                        {record ? ` · ${record.drawNumber ?? "no draw ID"}` : " · missing"}
                      </span>
                      <span className="font-mono break-words">
                        {record?.rawText ?? "No source record"}
                      </span>
                      {record?.issues.map((issue) => (
                        <span key={issue} className="text-destructive sm:col-start-2">
                          {issue}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
                {group.issues.length > 0 && (
                  <div className="mt-3 space-y-1 text-xs text-amber-700">
                    {group.issues.map((issue) => (
                      <div key={issue}>{issue}</div>
                    ))}
                  </div>
                )}
                <label className="mt-4 flex items-center gap-2 border-t border-border pt-3 text-sm">
                  <Checkbox
                    checked={props.confirmations[group.id] ?? false}
                    onCheckedChange={(checked) =>
                      props.setConfirmations({
                        ...props.confirmations,
                        [group.id]: checked === true,
                      })
                    }
                  />{" "}
                  I confirm these three records belong to this group, in this order.
                </label>
              </div>
            ))}
            <div className="flex justify-end">
              <Button
                onClick={props.importPreview}
                disabled={
                  props.busy ||
                  props.preview.groups.length === 0 ||
                  props.preview.groups.some((group) => !props.confirmations[group.id])
                }
              >
                <Database className="size-4" /> Save source groups
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Confirm five actual winners</CardTitle>
          <p className="text-sm text-muted-foreground">
            Winners are kept separately from the ten Line 3 candidates. Positions are optional until
            explicitly verified against the source.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Reviewed group with Line 2 and Line 3
            </label>
            <Select value={props.selectedGroup} onValueChange={props.setSelectedGroup}>
              <SelectTrigger>
                <SelectValue placeholder="Choose a group" />
              </SelectTrigger>
              <SelectContent>
                {line2AvailableGroups.map((group) => (
                  <SelectItem key={group.id} value={group.id}>
                    {group.gameName} · Group {group.groupSequence}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Five winning numbers, in the order shown by source
            </label>
            <Input
              value={props.winnersInput}
              onChange={(event) => props.setWinnersInput(event.target.value)}
              placeholder="47, 57, 70, 27, 64"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Five verified Line 3 positions (optional)
            </label>
            <Input
              value={props.winnerPositionsInput}
              onChange={(event) => props.setWinnerPositionsInput(event.target.value)}
              placeholder="1, 2, 3, 4, 5"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={props.saveWinners} disabled={props.busy || !props.selectedGroup}>
              <Check className="size-4" /> Confirm winners
            </Button>
          </div>
        </CardContent>
      </Card>
      {props.revisions.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Unresolved correction evidence</CardTitle>
            <p className="text-sm text-muted-foreground">
              These submissions do not replace confirmed results or contribute to the analysis.
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            {props.revisions.map((revision) => (
              <div
                key={revision.id}
                className="flex flex-wrap items-center justify-between gap-3 border-b border-border pb-3 text-sm"
              >
                <div>
                  <div className="font-mono">
                    {revision.proposed_winning_numbers.map(formatZsaNumber).join(" · ")}
                    {revision.proposed_winning_positions?.length
                      ? ` — P${revision.proposed_winning_positions.join(", P")}`
                      : " — positions unconfirmed"}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Submitted {new Date(revision.created_at).toLocaleString()} · original confirmation retained
                  </div>
                </div>
                <Badge variant="outline">{revision.review_status.replaceAll("_", " ")}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function PairView({
  analysis,
  minimumOccurrences,
  setMinimumOccurrences,
  minimumGames,
  setMinimumGames,
}: {
  analysis: ZsaAnalysisResult;
  minimumOccurrences: string;
  setMinimumOccurrences: (value: string) => void;
  minimumGames: string;
  setMinimumGames: (value: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
        <h2 className="mr-auto text-lg font-semibold">Winning-pair recurrence</h2>
        <Select value={minimumOccurrences} onValueChange={setMinimumOccurrences}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3, 5, 10].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}+ records
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={minimumGames} onValueChange={setMinimumGames}>
          <SelectTrigger className="w-36">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {[1, 2, 3].map((value) => (
              <SelectItem key={value} value={String(value)}>
                {value}+ games
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[720px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              {["Winning pair", "Occurrences", "Groups", "Games", "Recurrence", "Latest"].map(
                (label) => (
                  <th className="px-4 py-3" key={label}>
                    {label}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {analysis.pairs.map((pair) => (
              <tr className="border-t border-border" key={pair.key}>
                <td className="px-4 py-3 font-mono font-semibold">{prettyPair(pair.pair)}</td>
                <td className="px-4 py-3">{pair.occurrenceCount}</td>
                <td className="px-4 py-3">{pair.distinctGroups}</td>
                <td className="px-4 py-3">{pair.distinctGames}</td>
                <td className="px-4 py-3">
                  {pair.crossGame
                    ? "Across games"
                    : pair.sameGameRecurrence
                      ? "Within one game"
                      : "Single record"}
                </td>
                <td className="px-4 py-3">{pair.latestDate ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {analysis.pairs.map((pair) => (
        <details key={`${pair.key}-evidence`} className="border border-border">
          <summary className="cursor-pointer px-4 py-3 font-medium">
            {prettyPair(pair.pair)} · inspect {pair.evidence.length} occurrences
          </summary>
          <EvidenceRows pair={pair} />
        </details>
      ))}
      {analysis.pairs.length === 0 && (
        <Empty
          title="No qualifying pairs"
          description="Confirm complete groups and five actual winners before analyzing recurrence."
        />
      )}
    </div>
  );
}

function EvidenceRows({ pair }: { pair: ZsaAnalysisResult["pairs"][number] }) {
  return (
    <div className="space-y-3 border-t border-border p-4">
      {pair.evidence.map((item) => (
        <div
          className="grid gap-3 border-b border-border/70 pb-3 text-xs md:grid-cols-4"
          key={`${item.groupId}-${pair.key}`}
        >
          <div>
            <div className="text-muted-foreground">Game / group</div>
            {item.gameName} · {item.groupSequence}
          </div>
          <div>
            <div className="text-muted-foreground">Line 3 draw</div>
            {item.drawNumber ?? "—"} · {item.date ?? "date unavailable"}
          </div>
          <div>
            <div className="text-muted-foreground">Winning pair</div>
            {prettyPair(item.winningNumbers)} · positions{" "}
            {item.winningPositions?.join(", ") ?? "unconfirmed"}
          </div>
          <div>
            <div className="text-muted-foreground">Line 2 source</div>
            <span className="font-mono">{item.line2.map(formatZsaNumber).join(" ")}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

function PositionView({ analysis }: { analysis: ZsaAnalysisResult }) {
  return (
    <div className="space-y-5">
      <h2 className="text-lg font-semibold">Line 2 position and number analysis</h2>
      <div className="overflow-x-auto border border-border">
        <table className="w-full min-w-[540px] text-left text-sm">
          <thead className="bg-muted/40 text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Source position</th>
              <th className="px-4 py-3">Pair-weighted evidence</th>
              <th className="px-4 py-3">Share</th>
            </tr>
          </thead>
          <tbody>
            {analysis.positionFrequency.map((item) => (
              <tr key={item.position} className="border-t border-border">
                <td className="px-4 py-2 font-mono">P{item.position}</td>
                <td className="px-4 py-2">{item.occurrences}</td>
                <td className="px-4 py-2">{item.percentage.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <h3 className="text-base font-semibold">Source-number recurrence</h3>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {analysis.sourceNumberFrequency.slice(0, 80).map((item) => (
          <div
            key={item.number}
            className="flex items-center justify-between border border-border px-3 py-2"
          >
            <span className="font-mono">
              {formatZsaNumber(item.number)}{" "}
              <span className="text-xs text-muted-foreground">
                {Object.keys(item.byPosition)
                  .map((position) => `P${position}`)
                  .join(" · ")}
              </span>
            </span>
            <Badge variant="outline">×{item.occurrences}</Badge>
          </div>
        ))}
      </div>
      {analysis.sourceNumberFrequency.length === 0 && (
        <Empty
          title="No confirmed Line 2 evidence"
          description="Source frequencies appear after at least one winning pair meets the active threshold."
        />
      )}
    </div>
  );
}

function MappingView({ analysis }: { analysis: ZsaAnalysisResult }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Exact Line 2 → winning-position mappings</h2>
      {analysis.exactMappings.map((item) => (
        <details className="border border-border" key={item.key}>
          <summary className="cursor-pointer px-4 py-3 font-mono">
            P{item.sourcePosition}:{formatZsaNumber(item.sourceNumber)} → P{item.targetPosition}:
            {formatZsaNumber(item.targetNumber)}{" "}
            <Badge className="ml-2" variant="outline">
              ×{item.occurrenceCount}
            </Badge>
          </summary>
          <div className="border-t border-border p-4 text-sm">
            {item.distinctGames} games · {item.distinctGroups} groups · {item.evidence.length} group
            evidence rows
          </div>
        </details>
      ))}
      {analysis.exactMappings.length === 0 && (
        <Empty
          title="No confirmed winner positions yet"
          description="Exact target mappings require the five actual Line 3 positions to be confirmed."
        />
      )}
    </div>
  );
}

function CombinationView({ analysis }: { analysis: ZsaAnalysisResult }) {
  return (
    <div className="space-y-3">
      <h2 className="text-lg font-semibold">Two-position source combinations</h2>
      {analysis.positionCombinations.slice(0, 250).map((item) => (
        <div
          className="flex flex-wrap items-center justify-between gap-2 border border-border px-4 py-3"
          key={item.key}
        >
          <span className="font-mono">
            P{item.sourcePositions[0]}:{formatZsaNumber(item.sourceNumbers[0])} + P
            {item.sourcePositions[1]}:{formatZsaNumber(item.sourceNumbers[1])}{" "}
            <span className="text-muted-foreground">→</span> P{item.targetPositions[0]}:
            {formatZsaNumber(item.targetNumbers[0])} + P{item.targetPositions[1]}:
            {formatZsaNumber(item.targetNumbers[1])}
          </span>
          <Badge variant="outline">
            ×{item.occurrenceCount} · {item.distinctGames} games
          </Badge>
        </div>
      ))}
      {analysis.positionCombinations.length === 0 && (
        <Empty
          title="No exact combinations yet"
          description="Confirm winner positions to examine direction-preserving two-source mappings."
        />
      )}
    </div>
  );
}

function ValidationView({
  caseRow,
  line3,
  setLine3,
  positions,
  setPositions,
  save,
  evaluate,
  busy,
}: {
  caseRow: ValidationRow | null;
  line3: string;
  setLine3: (value: string) => void;
  positions: string;
  setPositions: (value: string) => void;
  save: () => void;
  evaluate: () => void;
  busy: boolean;
}) {
  if (!caseRow)
    return (
      <Empty
        title="Validation Case 001 is unavailable"
        description="The separate live-validation record could not be loaded."
      />
    );
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">{caseRow.case_name}</CardTitle>
          <Badge variant="outline">{caseRow.validation_status.replaceAll("_", " ")}</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          This case is separate from historical groups and its result is not added to its analysis
          baseline.
        </p>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="text-xs text-muted-foreground">Line 2 source</div>
          <div className="mt-2 grid grid-cols-5 gap-2 sm:grid-cols-10">
            {caseRow.line2_values.map((number, index) => (
              <div
                className="border border-border p-2 text-center font-mono"
                key={`${index}-${number}`}
              >
                <div className="text-[10px] text-muted-foreground">P{index + 1}</div>
                {formatZsaNumber(number)}
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-xs text-muted-foreground">Confirmed actual winners</div>
          <div className="mt-2 flex flex-wrap gap-2">
            {caseRow.winning_numbers.map((number) => (
              <Badge variant="outline" key={number}>
                {formatZsaNumber(number)}
              </Badge>
            ))}
          </div>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">
              Add Line 3 candidates when available
            </label>
            <Input
              value={line3}
              onChange={(event) => setLine3(event.target.value)}
              placeholder="Ten candidate values"
            />
          </div>
          <div className="space-y-2">
            <label className="text-xs text-muted-foreground">Confirm winner positions</label>
            <Input
              value={positions}
              onChange={(event) => setPositions(event.target.value)}
              placeholder="Five positions, in winner order"
            />
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="text-xs text-muted-foreground">
            Current Line 3:{" "}
            {caseRow.line3_values
              ? caseRow.line3_values.map(formatZsaNumber).join(" ")
              : "Not supplied; no values invented."}
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={save} disabled={busy}>
              Save validation details
            </Button>
            <Button
              onClick={evaluate}
              disabled={busy || !caseRow.line3_values || !caseRow.winning_positions}
            >
              Compare with frozen baseline
            </Button>
          </div>
        </div>
        {caseRow.validation_status === "evaluated" && (
          <div className="border-t border-border pt-4 text-sm">
            <div className="font-medium">Saved validation comparison</div>
            <div className="mt-2 flex flex-wrap gap-2">
              {(
                (caseRow.analysis_snapshot["actualWinningPairs"] as string[] | undefined) ?? []
              ).map((pair) => (
                <Badge
                  key={pair}
                  variant="outline"
                  className={
                    (
                      (caseRow.analysis_snapshot["historicallyObservedWinningPairs"] as
                        string[] | undefined) ?? []
                    ).includes(pair)
                      ? "border-primary/40 text-primary"
                      : ""
                  }
                >
                  {pair}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReportsView({
  runs,
  name,
  setName,
  save,
  busy,
}: {
  runs: SavedRun[];
  name: string;
  setName: (value: string) => void;
  save: () => void;
  busy: boolean;
  revisions: WinnerRevisionRow[];
}) {
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap gap-2">
        <Input
          value={name}
          onChange={(event) => setName(event.target.value)}
          className="max-w-sm"
        />
        <Button onClick={save} disabled={busy}>
          <Save className="size-4" /> Save frozen report
        </Button>
      </div>
      <div className="space-y-2">
        {runs.map((run) => {
          const savedPairs = Array.isArray(run.result_summary["pairs"])
            ? (run.result_summary["pairs"] as ZsaAnalysisResult["pairs"])
            : [];
          const frozenGroups = Array.isArray(run.dataset_snapshot)
            ? (run.dataset_snapshot as ZsaConfirmedGroup[])
            : [];
          return (
            <Card key={run.id}>
              <CardContent className="space-y-3 p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{run.name}</div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {new Date(run.created_at).toLocaleString()} · dataset {run.dataset_version.slice(0, 24)}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Badge variant="outline">{frozenGroups.length} groups</Badge>
                    <Badge variant="outline">{savedPairs.length} pairs</Badge>
                  </div>
                </div>
                <details className="border-t border-border pt-3">
                  <summary className="cursor-pointer text-sm font-medium">Open frozen evidence</summary>
                  <div className="mt-4 space-y-4">
                    {savedPairs.map((pair) => (
                      <div key={pair.key} className="border border-border p-3">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="font-mono font-semibold">{prettyPair(pair.pair)}</span>
                          <Badge variant="outline">×{pair.occurrenceCount} · {pair.distinctGames} games</Badge>
                        </div>
                        <EvidenceRows pair={pair} />
                      </div>
                    ))}
                    {frozenGroups.length > 0 && (
                      <div className="space-y-2">
                        <h3 className="text-sm font-semibold">Frozen source groups</h3>
                        {frozenGroups.map((group) => (
                          <div key={group.id} className="border border-border px-3 py-2 text-xs">
                            <div className="font-medium">{group.gameName} · group {group.groupSequence}</div>
                            <div className="mt-1 font-mono text-muted-foreground">
                              Line 2: {group.line2?.map(formatZsaNumber).join(" ") ?? "unavailable"}
                            </div>
                            <div className="font-mono text-muted-foreground">
                              Line 3: {group.line3?.map(formatZsaNumber).join(" ") ?? "unavailable"}
                            </div>
                            <div className="text-muted-foreground">
                              Winners: {group.winningNumbers?.map(formatZsaNumber).join(" · ") ?? "unconfirmed"}
                              {group.winningPositions ? ` · positions ${group.winningPositions.join(", ")}` : " · positions unconfirmed"}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </details>
              </CardContent>
            </Card>
          );
        })}
        {runs.length === 0 && (
          <Empty
            title="No saved ZSA reports"
            description="Save a snapshot to preserve the exact source groups, winners, filters, and results used."
          />
        )}
      </div>
    </div>
  );
}

function Empty({ title, description }: { title: string; description: string }) {
  return (
    <div className="border border-dashed border-border px-5 py-10 text-center">
      <div className="font-medium">{title}</div>
      <div className="mt-1 text-sm text-muted-foreground">{description}</div>
    </div>
  );
}
