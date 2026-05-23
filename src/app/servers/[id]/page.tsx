"use client";

import Image from "next/image";
import Link from "next/link";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, Camera, ChevronDown, ChevronLeft, ChevronRight, RefreshCw, Trash2 } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CheckStatus, ServerDto, StatusCheckDto } from "@/lib/types";

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
  const params = useParams<{ id: string }>();
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const screenshotParam = searchParams.get("screenshot");
  const [server, setServer] = useState<ServerDto | null>(null);
  const [history, setHistory] = useState<StatusCheckDto[]>([]);
  const status = searchParams.get("status") ?? "";
  const [error, setError] = useState("");
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
    try {
      const [serverRes, historyRes] = await Promise.all([
        fetch(`/api/servers/${params.id}`, { cache: "no-store" }),
        fetch(`/api/servers/${params.id}/history?limit=100${status ? `&status=${status}` : ""}`, { cache: "no-store" }),
      ]);
      if (!serverRes.ok) throw new Error("Server not found");
      setServer(await serverRes.json());
      setHistory(await historyRes.json());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    }
  }, [params.id, status]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

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
  const paginatedHistory = useMemo(() => history.slice((historyPage - 1) * historyPerPage, historyPage * historyPerPage), [history, historyPage, historyPerPage]);
  const paginatedScreenshots = useMemo(() => screenshotHistory.slice((screenshotPage - 1) * screenshotsPerPage, screenshotPage * screenshotsPerPage), [screenshotHistory, screenshotPage, screenshotsPerPage]);

  useEffect(() => {
    setHistoryPage(1);
    setScreenshotPage(1);
  }, [status]);

  useEffect(() => {
    setHistoryPage((page) => Math.min(page, Math.max(1, historyPageCount)));
  }, [historyPageCount]);

  useEffect(() => {
    setScreenshotPage((page) => Math.min(page, Math.max(1, screenshotPageCount)));
  }, [screenshotPageCount]);

  const project = searchParams.get("project");
  const dashboardHref = project ? `/?project=${encodeURIComponent(project)}` : "/";

  async function checkNow() {
    await fetch(`/api/servers/${params.id}/check`, { method: "POST" });
    setTimeout(load, 1500);
  }

  async function clearHistory() {
    if (!server || !window.confirm(`Clear all history for ${server.name}?`)) return;
    setClearingHistory(true);
    setError("");
    try {
      const res = await fetch(`/api/servers/${params.id}/history`, { method: "DELETE" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Clear history failed");
      setHistory([]);
      setServer((item) => item ? { ...item, latestCheck: null, uptime24h: null, uptime10d: null } : item);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearingHistory(false);
    }
  }

  const chartData = useMemo(() => history.slice().reverse().map((item) => ({
    time: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.checkedAt)),
    response: item.responseTimeMs ?? 0,
  })), [history]);

  const distribution = useMemo(() => (["up", "degraded", "down"] as CheckStatus[]).map((name) => ({
    name: statusLabel(name),
    count: history.filter((item) => item.status === name || (name === "down" && item.status === "not_found")).length,
  })), [history]);

  if (error) return <main className="p-3 text-rose-200">{error}</main>;
  if (!server) return <main className="p-3 text-slate-200">Loading...</main>;

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-col gap-4">
      <Link href={dashboardHref} className="inline-flex w-fit items-center gap-2 text-base font-semibold text-cyan-200 transition hover:text-cyan-100"><ArrowLeft size={18} /> Dashboard</Link>
      <header className="rounded-xl border border-white/10 bg-white/[0.04] p-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{server.name}</h1>
            <p className="mt-2 text-slate-400">{server.url}</p>
            <p className="mt-2 max-w-2xl text-slate-500">{server.description || "No description"}</p>
          </div>
          <button onClick={checkNow} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-white transition hover:bg-emerald-400">
            <RefreshCw size={18} /> Check now
          </button>
        </div>
      </header>

      <section className="grid gap-3 md:grid-cols-3">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-400">Checks</p><b className="mt-2 block text-lg text-white">{history.length}</b></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-400">Avg response</p><b className="mt-2 block text-lg text-white">{history.length ? Math.round(history.reduce((sum, h) => sum + (h.responseTimeMs ?? 0), 0) / history.length) : 0}ms</b></div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3"><p className="text-slate-400">Incidents</p><b className="mt-2 block text-lg text-white">{history.filter((h) => h.status === "down").length}</b></div>
      </section>

      <section className="grid gap-3 lg:grid-cols-2">
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="mb-4 text-lg font-semibold text-white">Response time trend</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <AreaChart data={chartData}>
                <CartesianGrid stroke="#1f2937"/>
                <XAxis dataKey="time" stroke="#94a3b8"/>
                <YAxis stroke="#94a3b8"/>
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b" }}/>
                <Area type="monotone" dataKey="response" stroke="#22d3ee" fill="#22d3ee33" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
          <h2 className="mb-4 text-lg font-semibold text-white">Up/down distribution</h2>
          <div className="h-72">
            <ResponsiveContainer>
              <BarChart data={distribution}>
                <CartesianGrid stroke="#1f2937"/>
                <XAxis dataKey="name" stroke="#94a3b8"/>
                <YAxis stroke="#94a3b8"/>
                <Tooltip contentStyle={{ background: "#020617", border: "1px solid #1e293b" }}/>
                <Bar dataKey="count" fill="#a78bfa" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </section>

      <section className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-lg font-semibold text-white">History timeline</h2>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <button type="button" onClick={clearHistory} disabled={clearingHistory || history.length === 0} className="inline-flex h-10 items-center justify-center gap-2 rounded-lg border border-rose-500/30 px-4 text-sm font-medium text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50">
              <Trash2 size={15} /> {clearingHistory ? "Clearing..." : "Clear history"}
            </button>
            <div className="relative">
              <select value={status} onChange={(e) => setStatusQuery(e.target.value)} className="h-10 min-w-40 appearance-none rounded-lg border border-white/10 bg-slate-950 py-2 pl-3 pr-11 text-sm font-medium text-slate-200 outline-none ring-cyan-400/30 transition hover:bg-slate-900 focus:ring-2">
                <option className="bg-slate-950 text-slate-200" value="">All statuses</option>
                <option className="bg-slate-950 text-slate-200" value="up">Operational</option>
                <option className="bg-slate-950 text-slate-200" value="degraded">Partly</option>
                <option className="bg-slate-950 text-slate-200" value="down">Down</option>
              </select>
              <ChevronDown size={16} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400" />
            </div>
          </div>
        </div>
        <div className="overflow-x-auto rounded-xl border border-white/10 bg-black/20">
          <table className="w-full min-w-[860px] table-fixed text-left text-sm">
            <colgroup>
              <col className="w-36" />
              <col className="w-60" />
              <col className="w-24" />
              <col className="w-32" />
              <col />
              <col className="w-40" />
            </colgroup>
            <thead className="bg-white/[0.04] text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-3 py-3 font-medium">Status</th><th className="px-3 py-3 font-medium">Checked</th><th className="px-3 py-3 font-medium">HTTP</th><th className="px-3 py-3 font-medium">Response</th><th className="px-3 py-3 font-medium">Error</th><th className="px-3 py-3 font-medium">Screenshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {paginatedHistory.map((item) => (
                <tr key={item._id} className="text-slate-300 transition hover:bg-white/[0.03]">
                  <td className="px-3 py-3">
                    <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${pill[item.status]}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td className="px-3 py-3 whitespace-nowrap">{when(item.checkedAt)}</td>
                  <td className="px-3 py-3">{item.httpStatus ?? "—"}</td>
                  <td className="px-3 py-3 whitespace-nowrap">{item.responseTimeMs ? `${item.responseTimeMs}ms` : "—"}</td>
                  <td className="truncate px-3 py-3 text-rose-200">{item.error ?? ""}</td>
                  <td className="px-3 py-3">
                    {item.screenshotFileId ? (
                      <a
                        className="inline-flex items-center gap-1 text-cyan-300"
                        href={`/api/screenshots/${item.screenshotFileId}`}
                        onClick={(event) => {
                          event.preventDefault();
                          openScreenshot(item);
                        }}
                      >
                        <Camera size={15}/> Open
                      </a>
                    ) : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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



