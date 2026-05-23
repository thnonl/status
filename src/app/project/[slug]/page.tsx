"use client";

import Image from "next/image";
import Link from "next/link";
import { useParams, usePathname, useRouter, useSearchParams } from "next/navigation";
import {
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  GripVertical,
  Clock,
  Globe2,
  Info,
  Pencil,
  Plus,
  RefreshCw,
  Server,
} from "lucide-react";
import { Modal } from "@/components/Modal";
import type { CheckStatus, ServerDto, StatusCheckDto } from "@/lib/types";

const DASHBOARD_REFRESH_MS = 5 * 60 * 1000;

type DashboardStatus = CheckStatus | "unknown";

const statusStyle: Record<DashboardStatus, string> = {
  up: "bg-emerald-500/15 text-emerald-300 ring-emerald-500/30",
  degraded: "bg-amber-500/15 text-amber-300 ring-amber-500/30",
  not_found: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  down: "bg-rose-500/15 text-rose-300 ring-rose-500/30",
  unknown: "bg-slate-500/15 text-slate-300 ring-slate-500/30",
};

function fmt(value?: string) {
  return value
    ? new Intl.DateTimeFormat(undefined, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(value))
    : "Never";
}
function pct(value: number | null) {
  return value === null ? "—" : `${value}%`;
}
const statusLabels: Record<DashboardStatus, string> = {
  up: "Operational",
  degraded: "Partly",
  not_found: "Down",
  down: "Down",
  unknown: "Not checked",
};
function statusLabel(status: string) {
  return statusLabels[status as DashboardStatus] ?? status;
}

type StatusFilter = "all" | "up" | "degraded" | "down";

function ProjectDashboardContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const { slug } = useParams<{ slug: string }>();
  const [projectId, setProjectId] = useState("");
  const historyParam = searchParams.get("history");
  const screenshotParam = searchParams.get("screenshot");
  const suppressHistoryRef = useRef(false);
  const suppressScreenshotRef = useRef(false);
  const loadSeqRef = useRef(0);
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [checkingIds, setCheckingIds] = useState<string[]>([]);
  const [lightbox, setLightbox] = useState<{
    src: string;
    alt: string;
    id?: string;
  } | null>(null);
  const [historyServer, setHistoryServer] = useState<ServerDto | null>(null);
  const [historyItems, setHistoryItems] = useState<StatusCheckDto[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [historyError, setHistoryError] = useState("");
  const [clearingHistory, setClearingHistory] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const [editing, setEditing] = useState<ServerDto | null>(null);
  const [editForm, setEditForm] = useState({
    name: "",
    url: "",
    healthRoute: "",
    screenshotRoute: "",
    description: "",
    tags: "",
  });
  const [editError, setEditError] = useState("");
  const statusParam = searchParams.get("status") as StatusFilter | null;
  const statusFilter: StatusFilter =
    statusParam && ["all", "up", "degraded", "down"].includes(statusParam)
      ? statusParam
      : "all";

  const setQuery = useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) params.set(key, value);
        else params.delete(key);
      }
      const query = params.toString();
      router.replace(query ? `${pathname}?${query}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams],
  );

  const load = useCallback(
    async (options?: { silent?: boolean }) => {
      const seq = ++loadSeqRef.current;
      if (!options?.silent) setLoading(true);
      setError("");
      try {
        if (!projectId) {
          setServers([]);
          return;
        }
        const res = await fetch(
          `/api/servers?projectId=${encodeURIComponent(projectId)}`,
          { cache: "no-store" },
        );
        if (!res.ok) throw new Error((await res.json()).error ?? "Load failed");
        const data = await res.json();
        if (seq === loadSeqRef.current) setServers(data);
      } catch (err) {
        if (seq === loadSeqRef.current)
          setError(err instanceof Error ? err.message : String(err));
      } finally {
        if (seq === loadSeqRef.current && !options?.silent) setLoading(false);
      }
    },
    [projectId],
  );

  useEffect(() => {
    async function resolveProject() {
      setLoading(true);
      setError("");
      try {
        const res = await fetch("/api/projects", { cache: "no-store" });
        if (!res.ok)
          throw new Error((await res.json()).error ?? "Project load failed");
        const projects = (await res.json()) as Array<{
          _id: string;
          slug?: string;
        }>;
        const project = projects.find((item) => item.slug === slug);
        if (!project) throw new Error("Project not found");
        setProjectId(project._id);
      } catch (err) {
        setProjectId("");
        setServers([]);
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      }
    }
    void resolveProject();
  }, [slug]);

  useEffect(() => {
    if (projectId) void load();
  }, [load, projectId]);

  useEffect(() => {
    const timer = window.setInterval(
      () => void load({ silent: true }),
      DASHBOARD_REFRESH_MS,
    );
    return () => window.clearInterval(timer);
  }, [load]);

  useEffect(() => {
    if (!lightbox && !historyServer) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        if (lightbox) closeScreenshot();
        else closeHistory();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [lightbox, historyServer]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!historyParam) {
      suppressHistoryRef.current = false;
      return;
    }
    if (suppressHistoryRef.current || historyServer?._id === historyParam)
      return;
    const server = servers.find((item) => item._id === historyParam);
    if (server) void openHistory(server, false);
  }, [historyParam, historyServer?._id, servers]); // eslint-disable-line react-hooks/exhaustive-deps

  function closeHistory() {
    suppressHistoryRef.current = true;
    setHistoryServer(null);
    if (historyParam) setQuery({ history: null });
  }

  function closeScreenshot() {
    suppressScreenshotRef.current = true;
    setLightbox(null);
    setQuery({ screenshot: null });
  }

  function setStatusQuery(filter: StatusFilter) {
    setQuery({ status: filter === "all" ? null : filter });
  }

  function openScreenshot(id: string, alt: string) {
    setLightbox({ src: `/api/screenshots/${id}`, alt, id });
    setQuery({ screenshot: id });
  }

  useEffect(() => {
    if (!screenshotParam) {
      suppressScreenshotRef.current = false;
      return;
    }
    if (suppressScreenshotRef.current || lightbox?.id === screenshotParam)
      return;
    const server = servers.find(
      (item) => item.latestCheck?.screenshotFileId === screenshotParam,
    );
    if (server)
      setLightbox({
        src: `/api/screenshots/${screenshotParam}`,
        alt: server.name,
        id: screenshotParam,
      }); // eslint-disable-line react-hooks/set-state-in-effect
  }, [lightbox?.id, screenshotParam, servers]);

  useEffect(() => {
    setLightbox(null);
    setHistoryServer(null);
    setHistoryItems([]);
    suppressHistoryRef.current = false;
    suppressScreenshotRef.current = false;
  }, [slug]);


  async function checkNow(id: string) {
    setCheckingIds((ids) => (ids.includes(id) ? ids : [...ids, id]));
    try {
      const res = await fetch(`/api/servers/${id}/check`, { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Check failed");
      const latestCheck = (await res.json()) as StatusCheckDto;
      const serverRes = await fetch(
        `/api/servers/${id}?projectId=${encodeURIComponent(projectId)}`,
        { cache: "no-store" },
      );
      if (!serverRes.ok)
        throw new Error(
          (await serverRes.json()).error ?? "Server reload failed",
        );
      const updatedServer = (await serverRes.json()) as ServerDto;
      setServers((items) =>
        items.map((server) => (server._id === id ? updatedServer : server)),
      );
      setHistoryServer((server) =>
        server?._id === id ? updatedServer : server,
      );
      if (historyServer?._id === id)
        setHistoryItems((items) => [latestCheck, ...items]);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setCheckingIds((ids) => ids.filter((checkingId) => checkingId !== id));
    }
  }

  async function openHistory(server: ServerDto, updateUrl = true) {
    suppressHistoryRef.current = false;
    setHistoryServer(server);
    setHistoryItems([]);
    setHistoryError("");
    setHistoryLoading(true);
    if (updateUrl && historyParam !== server._id)
      setQuery({ history: server._id });
    try {
      const res = await fetch(`/api/servers/${server._id}/history?limit=50`, {
        cache: "no-store",
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "History load failed");
      setHistoryItems(await res.json());
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setHistoryLoading(false);
    }
  }

  async function clearHistory() {
    if (
      !historyServer ||
      !window.confirm(`Clear all history for ${historyServer.name}?`)
    )
      return;
    setClearingHistory(true);
    setHistoryError("");
    try {
      const res = await fetch(`/api/servers/${historyServer._id}/history`, {
        method: "DELETE",
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Clear history failed");
      setHistoryItems([]);
      setHistoryServer((server) =>
        server
          ? { ...server, latestCheck: null, uptime24h: null, uptime10d: null }
          : server,
      );
      setServers((items) =>
        items.map((server) =>
          server._id === historyServer._id
            ? { ...server, latestCheck: null, uptime24h: null, uptime10d: null }
            : server,
        ),
      );
      void load({ silent: true });
    } catch (err) {
      setHistoryError(err instanceof Error ? err.message : String(err));
    } finally {
      setClearingHistory(false);
    }
  }

  async function saveServerOrder(
    nextServers: ServerDto[],
    previousServers: ServerDto[],
  ) {
    setServers(nextServers);
    try {
      const res = await fetch("/api/servers", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          orderedIds: nextServers.map((server) => server._id),
        }),
      });
      if (!res.ok)
        throw new Error((await res.json()).error ?? "Reorder failed");
    } catch (err) {
      setServers(previousServers);
      setError(err instanceof Error ? err.message : String(err));
    }
  }

  function openEdit(server: ServerDto) {
    setEditing(server);
    setEditError("");
    setEditForm({
      name: server.name,
      url: server.url,
      healthRoute: server.healthRoute ?? "",
      screenshotRoute: server.screenshotRoute ?? "",
      description: server.description ?? "",
      tags: server.tags.join(", "),
    });
  }

  async function saveEdit(event: React.FormEvent) {
    event.preventDefault();
    if (!editing) return;
    setEditError("");
    const res = await fetch(`/api/servers/${editing._id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(editForm),
    });
    if (!res.ok) {
      setEditError((await res.json()).error ?? "Save failed");
      return;
    }
    setEditing(null);
    await load();
  }

  async function dropServer(targetIndex: number) {
    const sourceIndex = servers.findIndex(
      (server) => server._id === draggingId,
    );
    setDraggingId("");
    if (sourceIndex < 0 || sourceIndex === targetIndex) return;
    const nextServers = [...servers];
    const [movedServer] = nextServers.splice(sourceIndex, 1);
    nextServers.splice(targetIndex, 0, movedServer);
    await saveServerOrder(nextServers, servers);
  }

  const stats = useMemo(
    () => ({
      total: servers.length,
      up: servers.filter((s) => s.latestCheck?.status === "up").length,
      degraded: servers.filter((s) => s.latestCheck?.status === "degraded")
        .length,
      down: servers.filter(
        (s) =>
          s.latestCheck?.status === "down" ||
          s.latestCheck?.status === "not_found",
      ).length,
    }),
    [servers],
  );
  const filteredServers = useMemo(
    () =>
      servers.filter((server) => {
        const status = server.latestCheck?.status;
        if (statusFilter === "all") return true;
        if (statusFilter === "degraded") return status === "degraded";
        if (statusFilter === "down")
          return status === "down" || status === "not_found";
        return status === statusFilter;
      }),
    [servers, statusFilter],
  );
  const cards = [
    ["Total", stats.total, Globe2, "all"],
    ["Up", stats.up, Activity, "up"],
    ["Partly", stats.degraded, Clock, "degraded"],
    ["Down", stats.down, Server, "down"],
  ] as const;

  return (
    <main className="space-y-3">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">
            Dashboard
          </h1>
          <p className="text-slate-400">Current project server health.</p>
        </div>
      </div>
      <section className="grid max-w-4xl grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map(([label, value, Icon, filter]) => (
          <button
            key={label}
            type="button"
            onClick={() => setStatusQuery(filter)}
            className={`rounded-xl border p-3 text-left transition hover:border-cyan-400/40 hover:bg-white/[0.07] ${statusFilter === filter ? "border-cyan-400/60 bg-cyan-400/10" : "border-white/10 bg-white/[0.04]"}`}
          >
            <div className="flex items-center justify-between text-slate-400">
              <span>{label}</span>
              <Icon size={20} />
            </div>
            <div className="mt-3 text-3xl font-bold leading-none text-white md:text-4xl">
              {value}
            </div>
          </button>
        ))}
      </section>
      {error && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
          {error}
        </div>
      )}
      {loading && (
        <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div
              key={index}
              className="overflow-hidden rounded-xl border border-white/10 bg-white/[0.04]"
            >
              <div className="h-32 animate-pulse bg-white/5" />
              <div className="space-y-3 p-3">
                <div className="h-5 w-2/3 animate-pulse rounded bg-white/10" />
                <div className="h-4 w-full animate-pulse rounded bg-white/5" />
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: 3 }).map((__, item) => (
                    <div
                      key={item}
                      className="h-9 animate-pulse rounded-xl bg-black/25"
                    />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </section>
      )}
      {!loading && !error && servers.length === 0 && (
        <section className="rounded-xl border border-dashed border-cyan-400/30 bg-cyan-400/5 p-3 text-center">
          <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-xl bg-cyan-400/15 text-cyan-200">
            <Server size={22} />
          </div>
          <h2 className="mt-3 text-xl font-semibold text-white">
            No servers yet
          </h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-slate-400">
            Add your first server to start monitoring uptime, response time, and
            screenshots.
          </p>
          <Link
            href={`/project/${slug}/servers`}
            className="mt-3 inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950 hover:bg-cyan-300"
          >
            <Plus size={18} /> Add server
          </Link>
        </section>
      )}
      {!loading &&
        !error &&
        statusFilter !== "all" &&
        filteredServers.length === 0 && (
          <section className="rounded-xl border border-dashed border-white/10 bg-white/[0.03] p-3 text-center text-slate-400">
            No {statusLabel(statusFilter)} servers.
          </section>
        )}
      <section className="grid grid-cols-[repeat(auto-fill,minmax(260px,1fr))] gap-3">
        {filteredServers.map((server) => {
          const index = servers.findIndex((item) => item._id === server._id);
          const status = server.latestCheck?.status ?? "unknown";
          return (
            <article
              key={server._id}
              draggable
              onDragStart={(event) => {
                setDraggingId(server._id);
                event.dataTransfer.effectAllowed = "move";
              }}
              onDragOver={(event) => {
                event.preventDefault();
                event.dataTransfer.dropEffect = "move";
              }}
              onDrop={() => dropServer(index)}
              onDragEnd={() => setDraggingId("")}
              className={`overflow-hidden rounded-xl border bg-white/[0.04] shadow-xl shadow-black/20 transition ${draggingId === server._id ? "scale-[0.98] border-cyan-400/60 opacity-60" : "border-white/10"}`}
            >
              <div className="relative h-32 w-full bg-slate-950">
                <div className="absolute right-2 top-2 z-19 flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => openEdit(server)}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-black/70 bg-black/85 text-white shadow-lg shadow-black/50 ring-1 ring-white/20 backdrop-blur hover:bg-black hover:ring-cyan-300/60"
                    title="Edit server"
                    aria-label={`Edit ${server.name}`}
                  >
                    <Pencil size={14} />
                  </button>
                  <span
                    className="inline-flex h-8 w-8 cursor-grab items-center justify-center rounded-full border border-black/70 bg-black/85 text-white shadow-lg shadow-black/50 ring-1 ring-white/20 backdrop-blur active:cursor-grabbing"
                    title="Drag to reorder"
                    aria-label={`Drag ${server.name} to reorder`}
                  >
                    <GripVertical size={15} />
                  </span>
                </div>
                {server.latestCheck?.screenshotFileId ? (
                  <>
                    <button
                      type="button"
                      onClick={() =>
                        openScreenshot(
                          server.latestCheck!.screenshotFileId!,
                          server.name,
                        )
                      }
                      className="absolute inset-0 z-10 cursor-zoom-in"
                      aria-label={`Preview screenshot for ${server.name}`}
                    />
                    <Image
                      src={`/api/screenshots/${server.latestCheck.screenshotFileId}`}
                      alt={server.name}
                      fill
                      className="object-contain opacity-90"
                      unoptimized
                    />
                  </>
                ) : (
                  <div className="flex h-full items-center justify-center text-slate-500">
                    No screenshot
                  </div>
                )}
              </div>
              <div className="space-y-3 p-3">
                <div>
                  <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-2">
                    <Link
                      href={`/project/${slug}/server/${server._id}`}
                      className="min-w-0 truncate text-lg font-semibold text-white hover:text-cyan-300"
                    >
                      {server.name}
                    </Link>
                    <span
                      className={`justify-self-end whitespace-nowrap rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyle[status]}`}
                    >
                      {statusLabel(status)}
                    </span>
                  </div>
                  <a
                    href={server.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 block truncate text-sm text-slate-400 hover:text-cyan-300"
                    title={server.url}
                  >
                    {server.url}
                  </a>
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-slate-500">24h</p>
                    <b>{pct(server.uptime24h)}</b>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-slate-500">10d</p>
                    <b>{pct(server.uptime10d)}</b>
                  </div>
                  <div className="rounded-xl bg-black/25 p-3">
                    <p className="text-slate-500">RT</p>
                    <b>
                      {server.latestCheck?.responseTimeMs
                        ? `${server.latestCheck.responseTimeMs}ms`
                        : "—"}
                    </b>
                  </div>
                </div>
                <p className="text-xs text-slate-500">
                  Last checked: {fmt(server.latestCheck?.checkedAt)}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => checkNow(server._id)}
                    disabled={checkingIds.includes(server._id)}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-emerald-500 px-2.5 py-2 !text-sm !leading-5 text-white transition hover:bg-emerald-400 disabled:cursor-wait disabled:opacity-60"
                  >
                    <RefreshCw
                      size={15}
                      className={
                        checkingIds.includes(server._id) ? "animate-spin" : ""
                      }
                    />
                    {checkingIds.includes(server._id)
                      ? "Checking..."
                      : "Check now"}
                  </button>
                  <Link
                    href={`/project/${slug}/server/${server._id}`}
                    className="inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-xl bg-blue-500 px-2.5 py-2 !text-sm !leading-5 text-white transition hover:bg-blue-400"
                  >
                    <Info size={15} /> Details
                  </Link>
                </div>
              </div>
            </article>
          );
        })}
      </section>

      {editing ? (
        <Modal title="Edit server" onClose={() => setEditing(null)}>
          <form onSubmit={saveEdit} className="space-y-3">
            <input
              required
              placeholder="Name"
              value={editForm.name}
              onChange={(e) =>
                setEditForm({ ...editForm, name: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <input
              required
              placeholder="https://example.com"
              value={editForm.url}
              onChange={(e) =>
                setEditForm({ ...editForm, url: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <input
              placeholder="Health route (optional, default /health, fallback URL)"
              value={editForm.healthRoute}
              onChange={(e) =>
                setEditForm({ ...editForm, healthRoute: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <input
              placeholder="Screenshot route (default server URL)"
              value={editForm.screenshotRoute}
              onChange={(e) =>
                setEditForm({ ...editForm, screenshotRoute: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <textarea
              placeholder="Description"
              value={editForm.description}
              onChange={(e) =>
                setEditForm({ ...editForm, description: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            <input
              placeholder="tags"
              value={editForm.tags}
              onChange={(e) =>
                setEditForm({ ...editForm, tags: e.target.value })
              }
              className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"
            />
            {editError && <p className="text-rose-300">{editError}</p>}
            <div className="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="rounded-xl border border-white/10 px-3 py-2 text-slate-200"
              >
                Cancel
              </button>
              <button className="rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950">
                Save
              </button>
            </div>
          </form>
        </Modal>
      ) : null}
      {lightbox ? (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Screenshot preview"
          onMouseDown={closeScreenshot}
        >
          <div
            className="relative w-full max-w-6xl overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              onClick={closeScreenshot}
              className="absolute right-3 top-3 z-10 rounded-full border border-white/20 bg-slate-950/90 px-3 py-2 text-sm font-semibold text-white shadow-lg shadow-black/40 backdrop-blur hover:bg-slate-900"
            >
              Close
            </button>
            <div className="relative aspect-video w-full bg-black">
              <Image
                src={lightbox.src}
                alt={lightbox.alt}
                fill
                className="object-contain"
                unoptimized
                sizes="100vw"
              />
            </div>
          </div>
        </div>
      ) : null}
      {historyServer ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/85 p-3"
          role="dialog"
          aria-modal="true"
          aria-label="Server history"
          onMouseDown={closeHistory}
        >
          <div
            className="max-h-[85vh] w-full max-w-5xl overflow-hidden rounded-xl border border-white/10 bg-slate-950 shadow-2xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-white/10 p-3">
              <div>
                <p className="text-xs uppercase tracking-[0.3em] text-cyan-300">
                  History
                </p>
                <h2 className="mt-1 text-lg font-semibold text-white">
                  {historyServer.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {historyServer.url}
                </p>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={clearHistory}
                  disabled={clearingHistory || historyItems.length === 0}
                  className="h-10 rounded-lg border border-rose-500/30 px-4 text-sm font-semibold text-rose-200 hover:bg-rose-500/10 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {clearingHistory ? "Clearing..." : "Clear history"}
                </button>
                <button
                  type="button"
                  onClick={closeHistory}
                  className="h-10 rounded-lg bg-white/10 px-4 text-sm font-semibold text-white hover:bg-white/20"
                >
                  Close
                </button>
              </div>
            </div>
            <div className="max-h-[65vh] overflow-auto p-3">
              {historyLoading && (
                <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-slate-300">
                  Loading history...
                </div>
              )}
              {historyError && (
                <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">
                  {historyError}
                </div>
              )}
              {!historyLoading &&
                !historyError &&
                historyItems.length === 0 && (
                  <div className="rounded-xl border border-white/10 bg-white/[0.04] p-3 text-center text-slate-400">
                    No history yet.
                  </div>
                )}
              {!historyLoading && !historyError && historyItems.length > 0 && (
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead className="text-slate-500">
                    <tr>
                      <th className="pb-2 font-medium">Status</th>
                      <th>Checked</th>
                      <th>HTTP</th>
                      <th>Response</th>
                      <th>Error</th>
                      <th>Screenshot</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/10">
                    {historyItems.map((item) => (
                      <tr key={item._id} className="text-slate-300">
                        <td className="py-2">
                          <span
                            className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ring-1 ${statusStyle[item.status]}`}
                          >
                            {statusLabel(item.status)}
                          </span>
                        </td>
                        <td>{fmt(item.checkedAt)}</td>
                        <td>{item.httpStatus ?? "—"}</td>
                        <td>
                          {item.responseTimeMs
                            ? `${item.responseTimeMs}ms`
                            : "—"}
                        </td>
                        <td className="max-w-xs truncate text-rose-200">
                          {item.error ?? ""}
                        </td>
                        <td>
                          {item.screenshotFileId ? (
                            <button
                              type="button"
                              onClick={() =>
                                openScreenshot(
                                  item.screenshotFileId!,
                                  `${historyServer.name} screenshot`,
                                )
                              }
                              className="text-cyan-300 hover:text-cyan-200"
                            >
                              Open
                            </button>
                          ) : (
                            "—"
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}

export default function ProjectDashboardPage() {
  return (
    <Suspense fallback={null}>
      <ProjectDashboardContent />
    </Suspense>
  );
}
