"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Activity, Clock, Globe2, Plus, Server } from "lucide-react";
import type { ServerDto } from "@/lib/types";

const statusStyle = {
  up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  down: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  unknown: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

function fmt(value?: string) {
  return value ? new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "Never";
}
function pct(value: number | null) { return value === null ? "—" : `${value}%`; }
function currentProject() { return typeof window === "undefined" ? "" : localStorage.getItem("currentProjectId") ?? ""; }

export default function DashboardPage() {
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingId, setCheckingId] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const projectId = currentProject();
      const res = await fetch(`/api/servers${projectId ? `?projectId=${projectId}` : ""}`, { cache: "no-store" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Load failed");
      setServers(await res.json());
    } catch (err) { setError(err instanceof Error ? err.message : String(err)); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function checkNow(id: string) {
    setCheckingId(id);
    try {
      await fetch(`/api/servers/${id}/check`, { method: "POST" });
      setTimeout(load, 1500);
    } finally {
      setTimeout(() => setCheckingId(""), 1500);
    }
  }

  const stats = useMemo(() => ({
    total: servers.length,
    up: servers.filter((s) => s.latestCheck?.status === "up").length,
    degraded: servers.filter((s) => s.latestCheck?.status === "degraded").length,
    down: servers.filter((s) => s.latestCheck?.status === "down").length,
  }), [servers]);
  const cards = [["Total", stats.total, Globe2], ["Up", stats.up, Activity], ["Degraded", stats.degraded, Clock], ["Down", stats.down, Server]] as const;

  return <main className="space-y-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div><h1 className="text-3xl font-semibold text-white">Dashboard</h1><p className="text-slate-400">Current project server health.</p></div>
    </div>
    <section className="grid gap-4 md:grid-cols-4">{cards.map(([label, value, Icon]) => <div key={label} className="rounded-3xl border border-white/10 bg-white/[0.04] p-5"><div className="flex items-center justify-between text-slate-400"><span>{label}</span><Icon size={20}/></div><div className="mt-4 text-4xl font-semibold text-white">{value}</div></div>)}</section>
    {error && <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-rose-200">{error}</div>}
    {loading && <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{Array.from({ length: 3 }).map((_, index) => <div key={index} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04]"><div className="h-44 animate-pulse bg-white/5"/><div className="space-y-4 p-5"><div className="h-5 w-2/3 animate-pulse rounded bg-white/10"/><div className="h-4 w-full animate-pulse rounded bg-white/5"/><div className="grid grid-cols-3 gap-2">{Array.from({ length: 3 }).map((__, item) => <div key={item} className="h-16 animate-pulse rounded-2xl bg-black/25"/>)}</div></div></div>)}</section>}
    {!loading && !error && servers.length === 0 && <section className="rounded-3xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-10 text-center"><div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-cyan-400/15 text-cyan-200"><Server size={22}/></div><h2 className="mt-4 text-xl font-semibold text-white">No servers yet</h2><p className="mx-auto mt-2 max-w-md text-sm text-slate-400">Add your first server to start monitoring uptime, response time, and screenshots.</p><Link href="/servers" className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300"><Plus size={18}/> Add server</Link></section>}
    <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">{servers.map((server) => {
      const status = server.latestCheck?.status ?? "unknown";
      return <article key={server._id} className="overflow-hidden rounded-3xl border border-white/10 bg-white/[0.04] shadow-xl shadow-black/20">
        {server.latestCheck?.screenshotFileId ? <div className="relative h-44 w-full bg-slate-950"><Image src={`/api/screenshots/${server.latestCheck.screenshotFileId}`} alt={server.name} fill className="object-contain opacity-90" unoptimized/></div> : <div className="flex h-44 items-center justify-center bg-slate-900 text-slate-500">No screenshot</div>}
        <div className="space-y-4 p-5"><div className="flex items-start justify-between gap-3"><div><Link href={`/servers/${server._id}`} className="text-xl font-semibold text-white hover:text-cyan-300">{server.name}</Link><p className="mt-1 truncate text-sm text-slate-400">{server.url}</p></div><span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${statusStyle[status]}`}>{status}</span></div>
        <div className="grid grid-cols-3 gap-2 text-sm"><div className="rounded-2xl bg-black/25 p-3"><p className="text-slate-500">24h</p><b>{pct(server.uptime24h)}</b></div><div className="rounded-2xl bg-black/25 p-3"><p className="text-slate-500">10d</p><b>{pct(server.uptime10d)}</b></div><div className="rounded-2xl bg-black/25 p-3"><p className="text-slate-500">RT</p><b>{server.latestCheck?.responseTimeMs ? `${server.latestCheck.responseTimeMs}ms` : "—"}</b></div></div>
        <p className="text-xs text-slate-500">Last checked: {fmt(server.latestCheck?.checkedAt)}</p><button onClick={() => checkNow(server._id)} disabled={checkingId === server._id} className="w-full rounded-xl border border-white/10 px-3 py-2 text-sm text-slate-200 hover:bg-white/10 disabled:cursor-wait disabled:opacity-60">{checkingId === server._id ? "Checking..." : "Check now"}</button></div>
      </article>})}</section>
  </main>;
}


