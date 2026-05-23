"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { notFound, useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CheckStatus, ProjectDto, ServerDto, StatusCheckDto } from "@/lib/types";

const pill: Record<CheckStatus, string> = {
  up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  not_found: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  down: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

const statusLabels: Record<CheckStatus, string> = {
  up: "Operational",
  degraded: "Partly",
  not_found: "Down",
  down: "Down",
};
function statusLabel(status: string) { return statusLabels[status as CheckStatus] ?? status; }

function when(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function ServerDetailsPageContent() {
  const params = useParams<{ slug: string; id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const screenshotParam = searchParams.get("screenshot");
  const [server, setServer] = useState<ServerDto | null>(null);
  const [history, setHistory] = useState<StatusCheckDto[]>([]);
  const status = searchParams.get("status") ?? "";
  const [error, setError] = useState("");
  const [notFoundPage, setNotFoundPage] = useState(false);
  const [clearingHistory, setClearingHistory] = useState(false);
  const [lightbox, setLightbox] = useState<{ src: string; checkedAt: string } | null>(null);
  const [historyPage, setHistoryPage] = useState(1);
  const [screenshotPage, setScreenshotPage] = useState(1);
  const suppressScreenshotRef = useRef(false);
  const historyPerPage = 20;
  const screenshotsPerPage = 12;

  const setQuery = useCallback((updates: Record<string, string | null>) => {
    const queryParams = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) queryParams.set(key, value);
      else queryParams.delete(key);
    }
    const query = queryParams.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  const load = useCallback(async () => {
    setError("");
    setNotFoundPage(false);
    try {
      const projectRes = await fetch(`/api/projects?slug=${encodeURIComponent(params.slug)}`, { cache: "no-store" });
      if (projectRes.status === 404) { setNotFoundPage(true); return; }
      if (!projectRes.ok) throw new Error((await projectRes.json()).error ?? "Project lookup failed");
      const project = (await projectRes.json()) as ProjectDto;
      const serverRes = await fetch(`/api/servers/${params.id}?projectId=${encodeURIComponent(project._id)}`, { cache: "no-store" });
      if (serverRes.status === 404) { setNotFoundPage(true); return; }
      if (!serverRes.ok) throw new Error((await serverRes.json()).error ?? "Server not found");
      const historyRes = await fetch(`/api/servers/${params.id}/history?limit=100${status ? `&status=${status}` : ""}`, { cache: "no-store" });
      if (!historyRes.ok) throw new Error((await historyRes.json()).error ?? "History load failed");
      setServer(await serverRes.json());
      setHistory(await historyRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [params.id, params.slug, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  if (notFoundPage) notFound();

  useEffect(() => {
    if (!lightbox) return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") { closeScreenshot(); }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, setQuery]);

  useEffect(() => {
    if (!screenshotParam) {
      suppressScreenshotRef.current = false;
      return;
    }
    if (suppressScreenshotRef.current || lightbox?.src.endsWith(screenshotParam)) return;
    const item = history.find((check) => check.screenshotFileId === screenshotParam);
    if (item) setLightbox({ src: `/api/screenshots/${screenshotParam}`, checkedAt: item.checkedAt }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [history, lightbox?.src, screenshotParam]);

  function openScreenshot(item: StatusCheckDto) {
    if (!item.screenshotFileId) return;
    setLightbox({ src: `/api/screenshots/${item.screenshotFileId}`, checkedAt: item.checkedAt });
    setQuery({ screenshot: item.screenshotFileId });
  }

  function closeScreenshot() { suppressScreenshotRef.current = true; setLightbox(null); setQuery({ screenshot: null }); }

  function setStatusQuery(value: string) { setQuery({ status: value || null }); }

  const screenshotHistory = useMemo(() => history.filter((h) => h.screenshotFileId), [history]);
  const historyPageCount = Math.ceil(history.length / historyPerPage);
  const screenshotPageCount = Math.ceil(screenshotHistory.length / screenshotsPerPage);
  const paginatedHistory = useMemo(() => history.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage), [history, historyPage]);
  const paginatedScreenshots = useMemo(() => screenshotHistory.slice((screenshotPage - 1) * screenshotsPerPage, screenshotPage * screenshotsPerPage), [screenshotHistory, screenshotPage]);

  const uptimePercent = useMemo(() => {
    if (!history.length) return null;
    const up = history.filter((h) => h.status === "up").length;
    return ((up / history.length) * 100).toFixed(1);
  }, [history]);

  const chartData = useMemo(() => [...history].reverse().map((h) => ({
    time: when(h.checkedAt),
    ms: h.responseTimeMs ?? 0,
    status: h.status,
  })), [history]);

  const statusData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const h of history) counts[h.status] = (counts[h.status] ?? 0) + 1;
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [history]);

  async function clearHistory() {
    if (!confirm("Delete all history for this server? This cannot be undone.")) return;
    setClearingHistory(true);
    try {
      const res = await fetch(`/api/servers/${params.id}/history`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to clear history");
      setHistory([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearingHistory(false);
    }
  }

  const dashboardHref = `/project/${params.slug}`;

  if (error) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link href={dashboardHref} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} /> Back
        </Link>
        <p className="text-rose-400">{error}</p>
      </main>
    );
  }

  if (!server) {
    return (
      <main className="mx-auto max-w-5xl px-4 py-10">
        <Link href={dashboardHref} className="mb-6 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} /> Back
        </Link>
        <p className="text-slate-400">Loading…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-6 px-4 py-10">
      <div>
        <Link href={dashboardHref} className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft size={16} /> Back to project
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-white">{server.name}</h1>
            <a href={server.url} target="_blank" rel="noreferrer" className="mt-1 break-all text-sm text-slate-400 hover:text-white">{server.url}</a>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={load}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-white/10 px-3 text-sm text-slate-300 transition hover:bg-white/5"
            >
              <RefreshCw size={15} /> Refresh
            </button>
            <button
              type="button"
              onClick={clearHistory}
              disabled={clearingHistory}
              className="inline-flex h-9 items-center gap-2 rounded-lg border border-rose-500/30 px-3 text-sm text-rose-400 transition hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Trash2 size={15} /> {clearingHistory ? "Clearing…" : "Clear history"}
            </button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3">
          <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-medium ring-1 ${pill[(server.latestCheck?.status ?? "") as CheckStatus] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/30"}`}>
            {statusLabel(server.latestCheck?.status ?? "unknown")}
          </span>
          {uptimePercent !== null && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-3 py-1 text-sm font-medium text-slate-300 ring-1 ring-slate-500/30">
              {uptimePercent}% uptime
            </span>
          )}
          {server.latestCheck?.checkedAt && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-slate-500/15 px-3 py-1 text-sm font-medium text-slate-300 ring-1 ring-slate-500/30">
              Last checked {when(server.latestCheck!.checkedAt)}
            </span>
          )}
        </div>
      </div>

      {chartData.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Response time (ms)</h2>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="msGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#6366f1" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#6366f1" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="time" hide />
              <YAxis width={40} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#a5b4fc" }}
              />
              <Area type="monotone" dataKey="ms" stroke="#6366f1" fill="url(#msGrad)" strokeWidth={2} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </section>
      )}

      {statusData.length > 0 && (
        <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
          <h2 className="mb-3 text-sm font-semibold text-slate-300">Status breakdown</h2>
          <ResponsiveContainer width="100%" height={120}>
            <BarChart data={statusData}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" />
              <XAxis dataKey="name" tick={{ fill: "#94a3b8", fontSize: 12 }} />
              <YAxis width={40} tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <Tooltip
                contentStyle={{ background: "#0f172a", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, fontSize: 12 }}
                labelStyle={{ color: "#94a3b8" }}
                itemStyle={{ color: "#a5b4fc" }}
              />
              <Bar dataKey="value" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </section>
      )}

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold text-slate-300">Check history</h2>
          <div className="relative">
            <select
              value={status}
              onChange={(e) => setStatusQuery(e.target.value)}
              className="h-8 appearance-none rounded-lg border border-white/10 bg-slate-900 pl-3 pr-8 text-sm text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            >
              <option value="">All statuses</option>
              <option value="up">Up</option>
              <option value="degraded">Degraded</option>
              <option value="down">Down</option>
            </select>
            <ChevronDown size={14} className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-slate-400" />
          </div>
        </div>
        {history.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">No history yet.</p>
        ) : (
          <div className="divide-y divide-white/[0.06]">
            {paginatedHistory.map((item) => (
              <div key={item._id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${pill[item.status as CheckStatus] ?? "bg-slate-500/15 text-slate-300 ring-slate-500/30"}`}>
                  {statusLabel(item.status)}
                </span>
                <span className="flex-1 truncate text-slate-400">{when(item.checkedAt)}</span>
                {item.responseTimeMs != null && (
                  <span className="shrink-0 text-slate-500">{item.responseTimeMs}ms</span>
                )}
                {item.screenshotFileId && (
                  <button
                    type="button"
                    onClick={() => openScreenshot(item)}
                    className="shrink-0 text-slate-500 transition hover:text-slate-300"
                    aria-label="View screenshot"
                  >
                    <Camera size={15} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
        {history.length > historyPerPage && (
          <div className="mt-3 flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
            <span>Showing {(historyPage - 1) * historyPerPage + 1}-{Math.min(historyPage * historyPerPage, history.length)} of {history.length}</span>
            <div className="flex gap-2">
              <button type="button" onClick={() => setHistoryPage((page) => Math.max(1, page - 1))} disabled={historyPage === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
                <ChevronLeft size={16} /> Prev
              </button>
              <button type="button" onClick={() => setHistoryPage((page) => Math.min(historyPageCount, page + 1))} disabled={historyPage >= historyPageCount} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
                Next <ChevronRight size={16} />
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {paginatedScreenshots.map((item) => (
          <a
            key={item._id}
            href={`/api/screenshots/${item.screenshotFileId}`}
            onClick={(event) => {
              event.preventDefault();
              openScreenshot(item);
            }}
            className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
          >
            <div className="relative h-48 w-full bg-slate-950">
              <Image
                src={`/api/screenshots/${item.screenshotFileId}`}
                alt="screenshot"
                fill
                className="object-contain"
                unoptimized
              />
            </div>
            <p className="p-3 text-sm text-slate-400">{when(item.checkedAt)}</p>
          </a>
        ))}
      </section>
      {screenshotHistory.length > screenshotsPerPage && (
        <div className="flex flex-col gap-2 text-sm text-slate-400 sm:flex-row sm:items-center sm:justify-between">
          <span>Showing {(screenshotPage - 1) * screenshotsPerPage + 1}-{Math.min(screenshotPage * screenshotsPerPage, screenshotHistory.length)} of {screenshotHistory.length} screenshots</span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setScreenshotPage((page) => Math.max(1, page - 1))} disabled={screenshotPage === 1} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
              <ChevronLeft size={16} /> Prev
            </button>
            <button type="button" onClick={() => setScreenshotPage((page) => Math.min(screenshotPageCount, page + 1))} disabled={screenshotPage >= screenshotPageCount} className="inline-flex h-8 items-center gap-1 rounded-lg border border-white/10 px-3 text-slate-300 transition hover:bg-white/5 disabled:cursor-not-allowed disabled:opacity-50">
              Next <ChevronRight size={16} />
            </button>
          </div>
        </div>
      )}

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot lightbox"
          onMouseDown={closeScreenshot}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeScreenshot}
              className="absolute right-3 top-3 z-10 rounded-lg border border-white/20 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 backdrop-blur hover:bg-slate-900"
            >
              Close
            </button>
            <div className="relative aspect-[16/10] w-full bg-black">
              <Image
                src={lightbox.src}
                alt={`Screenshot from ${when(lightbox.checkedAt)}`}
                fill
                className="object-contain"
                unoptimized
                sizes="100vw"
              />
            </div>
            <div className="border-t border-white/10 p-3 text-sm text-slate-300">
              {when(lightbox.checkedAt)}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function ServerDetailsPage() {
  return (
    <Suspense fallback={null}>
      <ServerDetailsPageContent />
    </Suspense>
  );
}
