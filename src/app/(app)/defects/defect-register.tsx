"use client";

import clsx from "clsx";
import {
  ArrowLeft,
  Bookmark,
  CheckCircle2,
  ExternalLink,
  FolderPlus,
  LockOpen,
  RefreshCw,
  Search,
  Trash2,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useSettings } from "@/components/settings-context";
import { Badge, Button, EmptyState, Notice, Spinner } from "@/components/ui";
import { errorMessage } from "@/lib/client/api";
import { addBucket, listBuckets, removeBucket, updateBucket } from "@/lib/client/defect-buckets";
import { forLaterIds, setForLater } from "@/lib/client/defect-local-review";
import { formatDateTime } from "@/lib/client/format";
import {
  listProjectIncidents,
  readIncidentDescription,
  updateIncidentStatus,
  writeIncidentDescription,
} from "@/lib/client/incident-register";
import { readIncidentOptions } from "@/lib/client/defects";
import {
  filterIncidents,
  FOR_LATER_SELECT,
  incidentsInBucket,
  MAX_BUCKET_NAME,
  pickStatusForOpen,
  sortIncidents,
  type DefectBucket,
  type IncidentOpenFilter,
  type IncidentSort,
} from "@/lib/domain/incident-register";
import type { IncidentStatusOption, ReportIncident } from "@/lib/domain/types";

const FILTERS: { id: IncidentOpenFilter; label: string }[] = [
  { id: "all", label: "All" },
  { id: "open", label: "Open" },
  { id: "closed", label: "Closed" },
  { id: "forLater", label: "For later" },
];

const SORTS: { id: IncidentSort; label: string }[] = [
  { id: "id", label: "Newest id" },
  { id: "created", label: "Newest created" },
  { id: "name", label: "Name A–Z" },
];

type Tone = "neutral" | "brand" | "success" | "warning" | "danger";

function statusTone(status: string | null, open: boolean): Tone {
  const s = (status ?? "").toLowerCase();
  if (!open || /closed|done|resolved|fixed|rejected|duplicate|deferred/.test(s)) return "success";
  if (/ready\s*for\s*qa|in\s*qa|qa/.test(s)) return "brand";
  if (/in\s*dev|in\s*progress|progress|assigned|develop/.test(s)) return "warning";
  if (/to\s*do|new|open|reopen|triage/.test(s)) return "danger";
  return open ? "warning" : "success";
}

function severityTone(severity: string | null): Tone {
  const s = (severity ?? "").toLowerCase();
  if (/1|critical|blocker|highest/.test(s)) return "danger";
  if (/2|high/.test(s)) return "warning";
  if (/3|medium/.test(s)) return "brand";
  return "neutral";
}

function SpiraIncidentLink({
  href,
  incidentId,
  className,
}: {
  href: string | null;
  incidentId: number;
  className?: string;
}) {
  const label = `IN:${incidentId}`;
  if (!href) return <span className={clsx("font-mono tabular-nums", className)}>{label}</span>;
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer noopener"
      className={clsx(
        "inline-flex items-center gap-1 font-mono text-sm font-semibold tabular-nums text-brand-700 underline-offset-2 hover:underline dark:text-brand-300",
        className,
      )}
      title={`Open ${label} in Spira`}
      onClick={(e) => e.stopPropagation()}
    >
      {label}
      <ExternalLink className="size-3 shrink-0 opacity-70" aria-hidden />
    </a>
  );
}

function MetaDot() {
  return <span className="text-slate-300 dark:text-zinc-600" aria-hidden>·</span>;
}

function IncidentMeta({ row }: { row: ReportIncident }) {
  const bits = [
    row.severity,
    row.priority,
    row.detectedRelease ? `Detected ${row.detectedRelease}` : null,
    row.createdAt ? formatDateTime(row.createdAt) : null,
  ].filter(Boolean) as string[];
  if (bits.length === 0) return null;
  return (
    <p className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-500 dark:text-zinc-400">
      {bits.map((bit, i) => (
        <span key={`${bit}-${i}`} className="inline-flex items-center gap-1.5">
          {i > 0 && <MetaDot />}
          {i === 0 && row.severity ? (
            <span className="inline-flex items-center gap-1.5">
              <span
                className={clsx(
                  "size-1.5 rounded-full",
                  severityTone(row.severity) === "danger" && "bg-red-500",
                  severityTone(row.severity) === "warning" && "bg-amber-500",
                  severityTone(row.severity) === "brand" && "bg-brand-500",
                  severityTone(row.severity) === "neutral" && "bg-slate-400",
                )}
                aria-hidden
              />
              {bit}
            </span>
          ) : (
            bit
          )}
        </span>
      ))}
    </p>
  );
}

function StatusSelect({
  row,
  statuses,
  busy,
  later,
  onForLater,
  onStatus,
}: {
  row: ReportIncident;
  statuses: IncidentStatusOption[];
  busy: boolean;
  later: boolean;
  onForLater: () => void;
  onStatus: (status: IncidentStatusOption) => void;
}) {
  return (
    <select
      className="input h-8 w-auto min-w-[8.5rem] py-0 text-xs"
      aria-label={`Status for IN:${row.incidentId}`}
      disabled={busy || statuses.length === 0}
      value={row.statusId && statuses.some((s) => s.id === row.statusId) ? String(row.statusId) : ""}
      onClick={(e) => e.stopPropagation()}
      onChange={(e) => {
        const value = e.target.value;
        if (value === FOR_LATER_SELECT) {
          onForLater();
          return;
        }
        const id = Number(value);
        const status = statuses.find((s) => s.id === id);
        if (status) onStatus(status);
      }}
    >
      <option value="" disabled>
        {statuses.length ? "Set status…" : "No statuses"}
      </option>
      <option value={FOR_LATER_SELECT}>{later ? "Keep For later" : "For later (app only)"}</option>
      {statuses.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
          {s.open ? "" : " (closed)"}
        </option>
      ))}
    </select>
  );
}

export function DefectRegister() {
  const { settings, spira } = useSettings();
  const projectId = settings?.projectId ?? null;
  const configured = spira?.configured === true;
  const siteUrl = spira?.siteUrl ?? null;
  const incidentUrl = (incidentId: number) =>
    siteUrl && projectId !== null ? `${siteUrl}/${projectId}/Incident/${incidentId}.aspx` : null;

  const [incidents, setIncidents] = useState<ReportIncident[] | null>(null);
  const [complete, setComplete] = useState(true);
  const [statuses, setStatuses] = useState<IncidentStatusOption[]>([]);
  const [buckets, setBuckets] = useState<DefectBucket[]>([]);
  const [later, setLater] = useState<Set<number>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filter, setFilter] = useState<IncidentOpenFilter>("open");
  const [sort, setSort] = useState<IncidentSort>("id");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bucketName, setBucketName] = useState("");
  const [activeBucketId, setActiveBucketId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [bulkBusy, setBulkBusy] = useState(false);
  const [descDrafts, setDescDrafts] = useState<Record<number, string>>({});
  const [descSaved, setDescSaved] = useState<Record<number, string>>({});
  const [descLoadingIds, setDescLoadingIds] = useState<Set<number>>(new Set());
  const descStarted = useRef<Set<number>>(new Set());

  const reloadBuckets = useCallback(() => {
    if (projectId === null) return;
    setBuckets(listBuckets(projectId));
  }, [projectId]);

  const reloadLater = useCallback(() => {
    if (projectId === null) return;
    setLater(forLaterIds(projectId));
  }, [projectId]);

  const load = useCallback(async () => {
    if (projectId === null || !configured) return;
    setLoading(true);
    setError(null);
    try {
      const [list, options] = await Promise.all([listProjectIncidents(projectId), readIncidentOptions(projectId)]);
      setIncidents(list.incidents);
      setComplete(list.complete);
      setStatuses(options.statuses);
      setBuckets(listBuckets(projectId));
      setLater(forLaterIds(projectId));
    } catch (err) {
      setError(errorMessage(err));
      setIncidents(null);
    } finally {
      setLoading(false);
    }
  }, [projectId, configured]);

  useEffect(() => {
    void load();
  }, [load]);

  const rows = useMemo(() => {
    if (!incidents) return [];
    return sortIncidents(filterIncidents(incidents, filter, query, later), sort);
  }, [incidents, filter, query, sort, later]);

  const counts = useMemo(() => {
    if (!incidents) return { all: 0, open: 0, closed: 0, forLater: 0 };
    return {
      all: incidents.length,
      open: incidents.filter((i) => i.open).length,
      closed: incidents.filter((i) => !i.open).length,
      forLater: incidents.filter((i) => later.has(i.incidentId)).length,
    };
  }, [incidents, later]);

  const markForLater = (incidentId: number, on: boolean) => {
    if (projectId === null) return;
    setForLater(projectId, incidentId, on);
    reloadLater();
    toast.success(on ? `IN:${incidentId} marked For later (app only).` : `IN:${incidentId} removed from For later.`);
  };

  const openStatus = useMemo(() => pickStatusForOpen(statuses, true), [statuses]);
  const closedStatus = useMemo(() => pickStatusForOpen(statuses, false), [statuses]);
  const activeBucket = buckets.find((b) => b.id === activeBucketId) ?? null;
  const bucketRows = useMemo(() => {
    if (!incidents || !activeBucket) return [];
    return incidentsInBucket(incidents, activeBucket);
  }, [incidents, activeBucket]);

  const patchIncident = (updated: ReportIncident) => {
    setIncidents((list) => (list ? list.map((i) => (i.incidentId === updated.incidentId ? updated : i)) : list));
  };

  const applyStatus = async (incident: ReportIncident, statusId: number, label: string, confirm = true) => {
    if (projectId === null) return;
    if (incident.statusId === statusId) return;
    if (confirm && !window.confirm(`Set IN:${incident.incidentId} to "${label}" in Spira?`)) return;
    setBusyId(incident.incidentId);
    try {
      const updated = await updateIncidentStatus(projectId, incident.incidentId, statusId);
      patchIncident(updated);
      toast.success(`IN:${updated.incidentId} is now ${updated.status ?? label}.`);
    } catch (err) {
      toast.error(errorMessage(err));
      throw err;
    } finally {
      setBusyId(null);
    }
  };

  const bulkStatus = async (wantOpen: boolean) => {
    if (projectId === null || !activeBucket) return;
    const status = wantOpen ? openStatus : closedStatus;
    if (!status) {
      toast.error(wantOpen ? "No open status is configured in Spira." : "No closed status is configured in Spira.");
      return;
    }
    const targets = bucketRows.filter((r) => r.open !== wantOpen);
    if (targets.length === 0) {
      toast.message(wantOpen ? "Everything in this bucket is already open." : "Everything in this bucket is already closed.");
      return;
    }
    if (!window.confirm(`Set ${targets.length} defect${targets.length === 1 ? "" : "s"} to "${status.name}" in Spira?`)) return;
    setBulkBusy(true);
    let ok = 0;
    try {
      for (const row of targets) {
        await applyStatus(row, status.id, status.name, false);
        ok += 1;
      }
      toast.success(`Updated ${ok} of ${targets.length} in Spira.`);
    } catch {
      toast.error(`Stopped after ${ok} of ${targets.length}. Fix the Spira error and try again.`);
    } finally {
      setBulkBusy(false);
    }
  };

  const createFromSelection = () => {
    if (projectId === null || selected.size === 0) return;
    try {
      const bucket = addBucket(projectId, bucketName || `Review (${selected.size})`, [...selected]);
      setBucketName("");
      setSelected(new Set());
      reloadBuckets();
      setActiveBucketId(bucket.id);
      toast.success(`Bucket “${bucket.name}” saved with ${bucket.incidentIds.length} defects.`);
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  const loadDescription = useCallback(
    async (incidentId: number, force = false) => {
      if (projectId === null) return;
      if (!force && descStarted.current.has(incidentId)) return;
      descStarted.current.add(incidentId);
      setDescLoadingIds((prev) => new Set(prev).add(incidentId));
      try {
        const { description } = await readIncidentDescription(projectId, incidentId);
        setDescDrafts((d) => ({ ...d, [incidentId]: description }));
        setDescSaved((d) => ({ ...d, [incidentId]: description }));
      } catch (err) {
        toast.error(`IN:${incidentId}: ${errorMessage(err)}`);
        setDescDrafts((d) => (d[incidentId] === undefined ? { ...d, [incidentId]: "" } : d));
      } finally {
        setDescLoadingIds((prev) => {
          const next = new Set(prev);
          next.delete(incidentId);
          return next;
        });
      }
    },
    [projectId],
  );

  const bucketIncidentKey = useMemo(() => bucketRows.map((r) => r.incidentId).join(","), [bucketRows]);

  useEffect(() => {
    if (!activeBucket || projectId === null || !bucketIncidentKey) return;
    for (const id of bucketIncidentKey.split(",").map(Number).filter((n) => n > 0)) {
      void loadDescription(id);
    }
  }, [activeBucket?.id, bucketIncidentKey, projectId, loadDescription]);

  const saveDescription = async (incidentId: number) => {
    if (projectId === null) return;
    const text = descDrafts[incidentId];
    if (text === undefined) return;
    setBusyId(incidentId);
    try {
      const updated = await writeIncidentDescription(projectId, incidentId, text);
      patchIncident(updated);
      setDescSaved((d) => ({ ...d, [incidentId]: text }));
      toast.success(`Saved description for IN:${incidentId} in Spira.`);
    } catch (err) {
      toast.error(errorMessage(err));
    } finally {
      setBusyId(null);
    }
  };

  const toggleSelected = (incidentId: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(incidentId)) next.delete(incidentId);
      else next.add(incidentId);
      return next;
    });
  };

  const toggleAllVisible = (on: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const r of rows) {
        if (on) next.add(r.incidentId);
        else next.delete(r.incidentId);
      }
      return next;
    });
  };

  if (!configured || projectId === null) {
    return (
      <EmptyState icon={Search} title="Choose a Spira project in Settings">
        The register reads every incident in the project and updates status in Spira.
      </EmptyState>
    );
  }

  if (activeBucket) {
    return (
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center gap-3">
          <Button size="sm" variant="ghost" icon={ArrowLeft} onClick={() => setActiveBucketId(null)}>
            Back to register
          </Button>
          <div className="min-w-0 flex-1">
            <h2 className="text-lg font-semibold tracking-tight">{activeBucket.name}</h2>
            <p className="text-sm text-slate-500 dark:text-zinc-400">
              {bucketRows.length} defect{bucketRows.length === 1 ? "" : "s"} · edit descriptions, then close or reopen in Spira
            </p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" icon={CheckCircle2} busy={bulkBusy} disabled={bulkBusy || !closedStatus} onClick={() => void bulkStatus(false)}>
            Mark all closed
          </Button>
          <Button size="sm" icon={LockOpen} busy={bulkBusy} disabled={bulkBusy || !openStatus} onClick={() => void bulkStatus(true)}>
            Mark all open
          </Button>
          <Button
            size="sm"
            variant="ghost"
            icon={Trash2}
            onClick={() => {
              if (!window.confirm(`Delete bucket “${activeBucket.name}”? Spira defects are not deleted.`)) return;
              removeBucket(projectId, activeBucket.id);
              setActiveBucketId(null);
              reloadBuckets();
            }}
          >
            Delete bucket
          </Button>
        </div>

        {bucketRows.length === 0 ? (
          <EmptyState icon={FolderPlus} title="No matching incidents">
            These ids are not in the loaded list (refresh the register), or they were removed from Spira.
          </EmptyState>
        ) : (
          <div className="flex flex-col gap-3">
            {bucketRows.map((row) => {
              const busy = busyId === row.incidentId || bulkBusy;
              const draft = descDrafts[row.incidentId];
              const parked = later.has(row.incidentId);
              return (
                <article
                  key={row.incidentId}
                  className="rounded-2xl border border-slate-200/80 bg-white p-4 shadow-sm shadow-slate-900/[0.03] dark:border-white/10 dark:bg-white/[0.03] dark:shadow-none"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpiraIncidentLink href={incidentUrl(row.incidentId)} incidentId={row.incidentId} />
                        <Badge tone={statusTone(row.status, row.open)}>{row.status ?? (row.open ? "Open" : "Closed")}</Badge>
                        {parked && <Badge tone="brand">For later</Badge>}
                      </div>
                      <h3 className="mt-1.5 text-[15px] leading-snug font-medium text-slate-900 dark:text-zinc-100">{row.name}</h3>
                      <IncidentMeta row={row} />
                    </div>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <StatusSelect
                      row={row}
                      statuses={statuses}
                      busy={busy}
                      later={parked}
                      onForLater={() => markForLater(row.incidentId, true)}
                      onStatus={(status) => void applyStatus(row, status.id, status.name)}
                    />
                    <Button size="sm" variant="ghost" icon={Bookmark} onClick={() => markForLater(row.incidentId, !parked)}>
                      {parked ? "Clear For later" : "For later"}
                    </Button>
                    {row.open && closedStatus && (
                      <Button size="sm" variant="ghost" icon={CheckCircle2} busy={busy} disabled={busy} onClick={() => void applyStatus(row, closedStatus.id, closedStatus.name)}>
                        Mark closed
                      </Button>
                    )}
                    {!row.open && openStatus && (
                      <Button size="sm" variant="ghost" icon={LockOpen} busy={busy} disabled={busy} onClick={() => void applyStatus(row, openStatus.id, openStatus.name)}>
                        Mark open
                      </Button>
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        if (!activeBucket) return;
                        const next = { ...activeBucket, incidentIds: activeBucket.incidentIds.filter((id) => id !== row.incidentId) };
                        updateBucket(projectId, next);
                        reloadBuckets();
                      }}
                    >
                      Remove from bucket
                    </Button>
                  </div>
                  <div className="mt-4 flex flex-col gap-2 border-t border-slate-100 pt-3 dark:border-white/10">
                    <label className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400" htmlFor={`desc-${row.incidentId}`}>
                      Spira description
                    </label>
                    {draft === undefined || descLoadingIds.has(row.incidentId) ? (
                      <div className="flex items-center gap-2 text-sm text-slate-500">
                        <Spinner /> Loading description from Spira…
                      </div>
                    ) : (
                      <>
                        <textarea
                          id={`desc-${row.incidentId}`}
                          className="input min-h-36 text-sm leading-relaxed"
                          value={draft}
                          onChange={(e) => setDescDrafts((d) => ({ ...d, [row.incidentId]: e.target.value }))}
                          disabled={busy}
                          placeholder="Write or edit the defect description…"
                        />
                        <div className="flex flex-wrap gap-2">
                          <Button
                            size="sm"
                            busy={busy}
                            disabled={busy || draft === descSaved[row.incidentId]}
                            onClick={() => void saveDescription(row.incidentId)}
                          >
                            Save to Spira
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || draft === descSaved[row.incidentId]}
                            onClick={() => setDescDrafts((d) => ({ ...d, [row.incidentId]: descSaved[row.incidentId] ?? "" }))}
                          >
                            Discard edits
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy || descLoadingIds.has(row.incidentId)}
                            onClick={() => {
                              descStarted.current.delete(row.incidentId);
                              void loadDescription(row.incidentId, true);
                            }}
                          >
                            Reload
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
    );
  }

  const allVisibleSelected = rows.length > 0 && rows.every((r) => selected.has(r.incidentId));

  return (
    <div className="flex flex-col gap-5">
      {buckets.length > 0 && (
        <div className="flex flex-col gap-2">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase dark:text-zinc-400">Review buckets</p>
          <div className="flex flex-wrap gap-2">
            {buckets.map((b) => (
              <button
                key={b.id}
                type="button"
                onClick={() => setActiveBucketId(b.id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-sm transition hover:border-brand-400 hover:bg-brand-50/50 dark:border-white/10 dark:bg-white/5 dark:hover:border-brand-400/40 dark:hover:bg-brand-500/10"
              >
                <FolderPlus className="size-3.5 text-slate-400" aria-hidden />
                <span className="font-medium">{b.name}</span>
                <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-slate-600 dark:bg-white/10 dark:text-zinc-300">
                  {b.incidentIds.length}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex flex-col gap-3 rounded-2xl border border-slate-200/80 bg-gradient-to-b from-slate-50/80 to-white p-3 sm:p-4 dark:border-white/10 dark:from-white/[0.04] dark:to-transparent">
        <div className="flex flex-wrap items-center gap-2" role="tablist" aria-label="Show defects">
          {FILTERS.map((f) => {
            const count = counts[f.id];
            const on = filter === f.id;
            return (
              <button
                key={f.id}
                type="button"
                role="tab"
                aria-selected={on}
                onClick={() => setFilter(f.id)}
                className={clsx(
                  "inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-medium transition",
                  on
                    ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-slate-900"
                    : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50 dark:bg-white/5 dark:text-zinc-300 dark:ring-white/10 dark:hover:bg-white/10",
                )}
              >
                {f.label}
                <span
                  className={clsx(
                    "rounded-full px-1.5 py-0.5 text-[11px] font-semibold tabular-nums",
                    on ? "bg-white/20 text-white dark:bg-slate-900/10 dark:text-slate-800" : "bg-slate-100 text-slate-500 dark:bg-white/10 dark:text-zinc-400",
                  )}
                >
                  {count.toLocaleString()}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <span className="sr-only">Search defects</span>
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-slate-400" aria-hidden />
            <input
              className="input h-10 pl-9"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by id, name, or status"
            />
          </label>
          <div className="flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <span className="sr-only sm:not-sr-only sm:font-medium">Sort</span>
              <select
                className="input h-10 w-auto"
                value={sort}
                onChange={(e) => setSort(e.target.value as IncidentSort)}
                aria-label="Sort order"
              >
                {SORTS.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <Button icon={RefreshCw} busy={loading} onClick={() => void load()} className="h-10">
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-end gap-2 rounded-2xl border border-brand-200 bg-brand-50/90 p-3 shadow-lg shadow-brand-900/5 backdrop-blur dark:border-brand-500/30 dark:bg-brand-500/15">
          <p className="w-full text-sm font-semibold text-slate-800 dark:text-zinc-100">
            {selected.size} selected
            <button type="button" className="ml-2 font-medium text-brand-700 underline-offset-2 hover:underline dark:text-brand-300" onClick={() => setSelected(new Set())}>
              Clear
            </button>
          </p>
          <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm">
            <span className="font-medium">Bucket name</span>
            <input
              className="input"
              value={bucketName}
              maxLength={MAX_BUCKET_NAME}
              onChange={(e) => setBucketName(e.target.value)}
              placeholder={`Review (${selected.size})`}
            />
          </label>
          <Button icon={FolderPlus} onClick={createFromSelection}>
            Create bucket
          </Button>
        </div>
      )}

      {!complete && incidents && (
        <Notice tone="warning" title="List may be incomplete">
          Spira returned the most recent incidents only (cap 5,000). Older defects may be missing.
        </Notice>
      )}

      {error && (
        <Notice tone="danger" title="Could not load defects">
          {error}
        </Notice>
      )}

      {loading && !incidents && (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Spinner /> Loading every incident in this project…
        </div>
      )}

      {incidents && rows.length === 0 && !loading && (
        <EmptyState icon={Search} title={filter === "forLater" ? "Nothing marked For later" : filter === "open" ? "No open defects" : "No matching defects"}>
          {query.trim()
            ? "Try a different search."
            : filter === "forLater"
              ? "Pick For Later on a defect to park it here (app only — Spira is unchanged)."
              : filter === "open"
                ? "Everything in Spira for this project is closed, or there are no incidents yet."
                : "Nothing matched these filters."}
        </EmptyState>
      )}

      {rows.length > 0 && (
        <div className="overflow-hidden rounded-2xl border border-slate-200/80 dark:border-white/10">
          <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50/80 px-4 py-2.5 dark:border-white/10 dark:bg-white/[0.03]">
            <label className="flex items-center gap-2 text-sm text-slate-600 dark:text-zinc-400">
              <input
                type="checkbox"
                className="size-4 accent-brand-600"
                checked={allVisibleSelected}
                onChange={(e) => toggleAllVisible(e.target.checked)}
                aria-label="Select all visible"
              />
              Select visible
            </label>
            <p className="text-xs text-slate-500 dark:text-zinc-500">
              <span className="font-medium tabular-nums text-slate-700 dark:text-zinc-300">{rows.length.toLocaleString()}</span>
              {" of "}
              {incidents!.length.toLocaleString()} in project {projectId}
            </p>
          </div>

          <ul className="divide-y divide-slate-100 dark:divide-white/[0.06]">
            {rows.map((row) => {
              const busy = busyId === row.incidentId;
              const on = selected.has(row.incidentId);
              const parked = later.has(row.incidentId);
              const tone = statusTone(row.status, row.open);
              return (
                <li
                  key={row.incidentId}
                  className={clsx(
                    "group relative transition-colors",
                    on ? "bg-brand-50/50 dark:bg-brand-500/[0.08]" : "hover:bg-slate-50/80 dark:hover:bg-white/[0.03]",
                  )}
                >
                  <div
                    className={clsx(
                      "absolute top-0 bottom-0 left-0 w-0.5 transition-opacity",
                      tone === "danger" && "bg-red-500",
                      tone === "warning" && "bg-amber-500",
                      tone === "brand" && "bg-brand-500",
                      tone === "success" && "bg-emerald-500",
                      tone === "neutral" && "bg-slate-300",
                      on ? "opacity-100" : "opacity-0 group-hover:opacity-60",
                    )}
                    aria-hidden
                  />
                  <div className="flex gap-3 px-4 py-3.5 sm:gap-4">
                    <div className="pt-1">
                      <input
                        type="checkbox"
                        className="size-4 accent-brand-600"
                        checked={on}
                        onChange={() => toggleSelected(row.incidentId)}
                        aria-label={`Select IN:${row.incidentId}`}
                      />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <SpiraIncidentLink href={incidentUrl(row.incidentId)} incidentId={row.incidentId} />
                        <Badge tone={tone}>{row.status ?? (row.open ? "Open" : "Closed")}</Badge>
                        {parked && <Badge tone="brand">For later</Badge>}
                      </div>
                      <p className="mt-1 text-[15px] leading-snug font-medium text-slate-900 dark:text-zinc-100">{row.name}</p>
                      <IncidentMeta row={row} />
                    </div>

                    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:min-w-[11rem] sm:items-end">
                      <StatusSelect
                        row={row}
                        statuses={statuses}
                        busy={busy}
                        later={parked}
                        onForLater={() => markForLater(row.incidentId, true)}
                        onStatus={(status) => void applyStatus(row, status.id, status.name)}
                      />
                      <div className="flex flex-wrap items-center justify-end gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          icon={Bookmark}
                          className={clsx(parked && "text-brand-700 dark:text-brand-300")}
                          onClick={() => markForLater(row.incidentId, !parked)}
                          title={parked ? "Clear For later" : "For later"}
                        >
                          {parked ? "Saved" : "Later"}
                        </Button>
                        {row.open && closedStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={CheckCircle2}
                            busy={busy}
                            disabled={busy}
                            onClick={() => void applyStatus(row, closedStatus.id, closedStatus.name)}
                          >
                            Close
                          </Button>
                        )}
                        {!row.open && openStatus && (
                          <Button
                            size="sm"
                            variant="ghost"
                            icon={LockOpen}
                            busy={busy}
                            disabled={busy}
                            onClick={() => void applyStatus(row, openStatus.id, openStatus.name)}
                          >
                            Reopen
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
