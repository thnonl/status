"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/confirm-modal";
import type { ProjectDto, ServerDto } from "@/lib/types";

type FormState = {
  name: string;
  url: string;
  healthRoute: string;
  screenshotRoute: string;
  description: string;
  tags: string;
  enabled: boolean;
};

const blank: FormState = {
  name: "",
  url: "",
  healthRoute: "",
  screenshotRoute: "",
  description: "",
  tags: "",
  enabled: true,
};

const inputCls =
  "h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3.5 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-cyan-400/40 focus:bg-black/40";
const btnCls = "h-10 rounded-lg px-4 text-sm font-medium transition-colors";

export default function ProjectServersPage() {
  const { slug } = useParams<{ slug: string }>();
  const router = useRouter();

  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectNotFound, setProjectNotFound] = useState(false);
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<ServerDto | null>(null);
  const [deleting, setDeleting] = useState<ServerDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  // Resolve projectId from slug once on mount
  useEffect(() => {
    let cancelled = false;
    async function resolve() {
      const res = await fetch("/api/projects", { cache: "no-store" });
      const data: ProjectDto[] = await res.json();
      const project = data.find((p) => p.slug === slug);
      if (cancelled) return;
      if (!project) {
        setProjectNotFound(true);
        setLoading(false);
        return;
      }
      setProjectId(project._id);
    }
    resolve();
    return () => { cancelled = true; };
  }, [slug]);

  const loadServers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const res = await fetch(`/api/servers?projectId=${projectId}`, { cache: "no-store" });
    setServers(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    loadServers();
  }, [loadServers]);

  function openCreate() {
    setEditing(null);
    setForm(blank);
    setError("");
    setModalOpen(true);
  }

  function openEdit(server: ServerDto) {
    setEditing(server);
    setForm({
      name: server.name,
      url: server.url,
      healthRoute: server.healthRoute ?? "",
      screenshotRoute: server.screenshotRoute ?? "",
      description: server.description ?? "",
      tags: (server.tags ?? []).join(", "),
      enabled: server.enabled !== false,
    });
    setError("");
    setModalOpen(true);
  }

  function closeModal() {
    setModalOpen(false);
    setEditing(null);
    setDeleting(null);
    setError("");
  }

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!projectId) return;
    setError("");
    const payload = {
      ...form,
      tags: form.tags
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean),
      projectId,
    };
    const url = editing ? `/api/servers/${editing._id}` : "/api/servers";
    const method = editing ? "PUT" : "POST";
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      setError((body as { error?: string }).error ?? "Something went wrong");
      return;
    }
    closeModal();
    loadServers();
  }

  async function remove() {
    if (!deleting) return;
    await fetch(`/api/servers/${deleting._id}`, { method: "DELETE" });
    closeModal();
    loadServers();
  }

  if (projectNotFound) {
    return (
      <main className="min-h-screen bg-slate-950 p-8 text-white">
        <p className="text-rose-400">Project &quot;{slug}&quot; not found.</p>
        <Link href="/" className="mt-4 inline-block text-sm text-cyan-400 hover:underline">
          ← Home
        </Link>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 px-4 py-10 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between gap-4">
          <div>
            <Link
              href={`/project/${slug}`}
              className="mb-1 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-200"
            >
              ← Dashboard
            </Link>
            <h1 className="text-2xl font-semibold tracking-tight text-white">Servers</h1>
          </div>
          <button
            onClick={openCreate}
            className="h-10 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
          >
            New server
          </button>
        </div>

        {/* List */}
        {loading ? (
          <div className="py-24 text-center text-sm text-slate-500">Loading…</div>
        ) : servers.length > 0 ? (
          <div className="divide-y divide-white/[0.06] overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.03]">
            {servers.map((server) => (
              <div
                key={server._id}
                className="flex items-center justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="truncate font-medium text-white">{server.name}</span>
                    {!server.enabled && (
                      <span className="rounded-full bg-slate-700 px-2 py-0.5 text-xs text-slate-400">
                        paused
                      </span>
                    )}
                  </div>
                  <p className="truncate text-sm text-slate-400">{server.url}</p>
                  {server.tags && server.tags.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {server.tags.map((tag) => (
                        <span
                          key={tag}
                          className="rounded-full bg-cyan-400/10 px-2 py-0.5 text-xs text-cyan-300"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    onClick={() => openEdit(server)}
                    className={`${btnCls} border border-white/10 text-slate-200 hover:bg-white/10`}
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => { setDeleting(server); setModalOpen(false); }}
                    className={`${btnCls} border border-rose-500/30 text-rose-400 hover:bg-rose-500/10`}
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-6 rounded-2xl border border-dashed border-white/10 py-24 text-center">
            <div>
              <h2 className="text-lg font-medium text-white">No servers yet</h2>
              <p className="mt-1 text-sm text-slate-400">
                Create a server to start collecting uptime history and screenshots.
              </p>
            </div>
            <button
              onClick={openCreate}
              className="h-10 rounded-lg bg-cyan-400 px-4 text-sm font-semibold text-slate-950 transition-colors hover:bg-cyan-300"
            >
              New server
            </button>
          </div>
        )}
      </div>

      {/* Create / Edit modal */}
      {modalOpen && (
        <Modal title={editing ? "Edit server" : "Create server"} onClose={closeModal}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Name *</label>
                <input
                  required
                  placeholder="My Server"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">URL *</label>
                <input
                  required
                  placeholder="https://example.com"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Health route</label>
                <input
                  placeholder="/health"
                  value={form.healthRoute}
                  onChange={(e) => setForm({ ...form, healthRoute: e.target.value })}
                  className={inputCls}
                />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Screenshot route</label>
                <input
                  placeholder="(defaults to server URL)"
                  value={form.screenshotRoute}
                  onChange={(e) => setForm({ ...form, screenshotRoute: e.target.value })}
                  className={inputCls}
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Description</label>
              <textarea
                placeholder="Optional description..."
                rows={2}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                className={`${inputCls} h-auto resize-none`}
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">
                Tags <span className="text-slate-600">(comma-separated)</span>
              </label>
              <input
                placeholder="production, api, critical"
                value={form.tags}
                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                className={inputCls}
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={form.enabled}
              onClick={() => setForm({ ...form, enabled: !form.enabled })}
              className="flex w-full items-center justify-between rounded-lg border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition-colors hover:bg-white/[0.07]"
            >
              <span>
                <span className="block text-sm font-medium text-white">Monitoring enabled</span>
                <span className="mt-0.5 block text-xs text-slate-400">
                  {form.enabled
                    ? "Server will be checked on schedule."
                    : "Monitoring is paused for this server."}
                </span>
              </span>
              <span
                className={`relative ml-4 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${
                  form.enabled
                    ? "border-cyan-300/40 bg-cyan-400"
                    : "border-white/10 bg-slate-800"
                }`}
              >
                <span
                  className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${
                    form.enabled ? "left-[22px]" : "left-1"
                  }`}
                />
              </span>
            </button>
            {error && (
              <p className="rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 ring-1 ring-rose-500/20">
                {error}
              </p>
            )}
            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={closeModal}
                className={`${btnCls} border border-white/10 text-slate-200 hover:bg-white/10`}
              >
                Cancel
              </button>
              <button className={`${btnCls} bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300`}>
                Save
              </button>
            </div>
          </form>
        </Modal>
      )}

      {/* Delete confirm */}
      {deleting && (
        <ConfirmModal
          open={!!deleting}
          title="Delete server"
          description={`Delete "${deleting.name}" and all its history and screenshots? This cannot be undone.`}
          confirmLabel="Delete"
          onConfirm={remove}
          onCancel={closeModal}
        />
      )}
    </main>
  );
}
