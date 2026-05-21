"use client";

import Image from "next/image";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, Camera, RefreshCw } from "lucide-react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { ServerDto, StatusCheckDto } from "@/lib/types";

const pill = {
  up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  not_found: "bg-yellow-500/15 text-yellow-300 ring-yellow-500/30",
  down: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
};

function statusLabel(status: string) { return status === "not_found" ? "Not found" : status; }

function when(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export default function ServerDetailsPage() {
  const params = useParams<{ id: string }>();
  const [server, setServer] = useState<ServerDto | null>(null);
  const [history, setHistory] = useState<StatusCheckDto[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; checkedAt: string } | null>(null);

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
      if (event.key === "Escape") setLightbox(null);
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox]);

  async function checkNow() {
    await fetch(`/api/servers/${params.id}/check`, { method: "POST" });
    setTimeout(load, 1500);
  }

  const chartData = useMemo(() => history.slice().reverse().map((item) => ({
    time: new Intl.DateTimeFormat(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }).format(new Date(item.checkedAt)),
    response: item.responseTimeMs ?? 0,
  })), [history]);

  const distribution = useMemo(() => ["up", "degraded", "not_found", "down"].map((name) => ({
    name,
    count: history.filter((item) => item.status === name).length,
  })), [history]);

  if (error) return <main className="p-3 text-rose-200">{error}</main>;
  if (!server) return <main className="p-3 text-slate-200">Loading...</main>;

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-3 px-3 py-2 md:px-8">
      <header className="rounded-xl border border-white/10 bg-white/[0.04] p-3">
        <Link href="/" className="inline-flex items-center gap-2 text-sm text-cyan-300"><ArrowLeft size={16} /> Dashboard</Link>
        <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
          <div>
            <h1 className="text-lg font-semibold text-white">{server.name}</h1>
            <p className="mt-2 text-slate-400">{server.url}</p>
            <p className="mt-2 max-w-2xl text-slate-500">{server.description || "No description"}</p>
          </div>
          <button onClick={checkNow} className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950 hover:bg-cyan-300">
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
          <select value={status} onChange={(e) => setStatus(e.target.value)} className="rounded-xl border border-white/10 bg-slate-950 px-3 py-2 text-slate-200">
            <option value="">All statuses</option>
            <option value="up">Up</option>
            <option value="degraded">Degraded</option>
            <option value="not_found">Not found</option>
            <option value="down">Down</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="text-slate-500">
              <tr>
                <th className="py-2">Status</th><th>Checked</th><th>HTTP</th><th>Response</th><th>Error</th><th>Screenshot</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/10">
              {history.map((item) => (
                <tr key={item._id} className="text-slate-300">
                  <td className="py-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-semibold ring-1 ${pill[item.status]}`}>{statusLabel(item.status)}</span>
                  </td>
                  <td>{when(item.checkedAt)}</td>
                  <td>{item.httpStatus ?? "—"}</td>
                  <td>{item.responseTimeMs ? `${item.responseTimeMs}ms` : "—"}</td>
                  <td className="max-w-xs truncate text-rose-200">{item.error ?? ""}</td>
                  <td>
                    {item.screenshotFileId ? (
                      <a
                        className="inline-flex items-center gap-1 text-cyan-300"
                        href={`/api/screenshots/${item.screenshotFileId}`}
                        onClick={(event) => {
                          event.preventDefault();
                          setLightbox({ src: `/api/screenshots/${item.screenshotFileId}`, checkedAt: item.checkedAt });
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
      </section>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {history.filter((h) => h.screenshotFileId).slice(0, 12).map((item) => (
          <a
            key={item._id}
            href={`/api/screenshots/${item.screenshotFileId}`}
            onClick={(event) => {
              event.preventDefault();
              setLightbox({ src: `/api/screenshots/${item.screenshotFileId}`, checkedAt: item.checkedAt });
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

      {lightbox ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot lightbox"
          onClick={() => setLightbox(null)}
        >
          <div
            className="relative w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setLightbox(null)}
              className="absolute right-3 top-3 z-10 rounded-full bg-white/10 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/20"
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

