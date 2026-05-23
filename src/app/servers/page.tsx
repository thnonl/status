"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/confirm-modal";
import type { ProjectDto, ServerDto } from "@/lib/types";

type FormState = { name: string; url: string; healthRoute: string; screenshotRoute: string; description: string; tags: string; enabled: boolean };
const blank: FormState = { name: "", url: "", healthRoute: "", screenshotRoute: "", description: "", tags: "", enabled: true };


function ServersPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const projectParam = searchParams.get("project");
  const actionParam = searchParams.get("action");
  const serverParam = searchParams.get("server");
  const suppressActionRef = useRef(false);
  const [servers, setServers] = useState<ServerDto[]>([]);
  const [projectId, setProjectId] = useState("");
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<ServerDto | null>(null);
  const [deleting, setDeleting] = useState<ServerDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  const loadProjects = useCallback(async () => {
    const res = await fetch("/api/projects", { cache: "no-store" });
    const data: ProjectDto[] = await res.json();
    const stored = projectParam ?? localStorage.getItem("currentProjectId");
    const selected = stored && data.some((p) => p._id === stored) ? stored : data[0]?._id;
    if (selected) { localStorage.setItem("currentProjectId", selected); setProjectId(selected); }
    else setLoading(false);
  }, [projectParam]);

  const loadServers = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    const res = await fetch(`/api/servers?projectId=${projectId}`, { cache: "no-store" });
    setServers(await res.json());
    setLoading(false);
  }, [projectId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadProjects();
  }, [loadProjects]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadServers();
  }, [loadServers]);

  const setQuery = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    for (const [key, value] of Object.entries(updates)) {
      if (value) params.set(key, value); else params.delete(key);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [pathname, router, searchParams]);

  function closeModal() { suppressActionRef.current = true; setModalOpen(false); setEditing(null); setDeleting(null); setQuery({ action: null, server: null }); }
  function openCreate(updateUrl = true) { suppressActionRef.current = false; setEditing(null); setForm(blank); setModalOpen(true); if (updateUrl) setQuery({ action: "create", server: null }); }
  function openEdit(server: ServerDto, updateUrl = true) { suppressActionRef.current = false; setEditing(server); setForm({ name: server.name, url: server.url, healthRoute: server.healthRoute ?? "", screenshotRoute: server.screenshotRoute ?? "", description: server.description ?? "", tags: server.tags.join(", "), enabled: server.enabled }); setModalOpen(true); if (updateUrl) setQuery({ action: "edit", server: server._id }); }

  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch(editing ? `/api/servers/${editing._id}` : "/api/servers", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectId }) });
    if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; }
    closeModal(); await loadServers();
  }

  async function remove() { if (!deleting) return; await fetch(`/api/servers/${deleting._id}`, { method: "DELETE" }); closeModal(); await loadServers(); }

  useEffect(() => {
    if (!actionParam) { suppressActionRef.current = false; return; }
    if (suppressActionRef.current) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (actionParam === "create" && !modalOpen) openCreate(false);
    if ((actionParam === "edit" || actionParam === "delete") && !servers.length) return;
    if (actionParam === "edit" && serverParam && editing?._id !== serverParam) { const server = servers.find((item) => item._id === serverParam); if (server) openEdit(server, false); }
    if (actionParam === "delete" && serverParam && deleting?._id !== serverParam) { const server = servers.find((item) => item._id === serverParam); if (server) setDeleting(server); }
  }, [actionParam, deleting?._id, editing?._id, modalOpen, serverParam, servers]); // eslint-disable-line react-hooks/exhaustive-deps

  const statusBadge: Record<string, string> = {
    up: "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20",
    degraded: "bg-amber-400/10 text-amber-300 ring-1 ring-amber-400/20",
    down: "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20",
    not_found: "bg-rose-400/10 text-rose-300 ring-1 ring-rose-400/20",
  };

  return (
    <main className="page-shell">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Servers</h1>
          <p className="mt-1 text-sm text-slate-400">Manage and monitor your servers.</p>
        </div>
        <button
          onClick={() => openCreate()}
          className="ui-btn ui-btn-primary"
        >
          New server
        </button>
      </div>

      <div className="page-card overflow-x-auto">
        <table className="ui-table min-w-[900px]">
          <thead>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">URL</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Enabled</th>
              <th className="px-4 py-3">Tags</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <tr key={i}>
                    <td className="px-4 py-3"><div className="h-4 w-32 animate-pulse rounded bg-white/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-64 animate-pulse rounded bg-white/10" /></td>
                    <td className="px-4 py-3"><div className="h-5 w-16 animate-pulse rounded-full bg-white/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-9 animate-pulse rounded bg-white/10" /></td>
                    <td className="px-4 py-3"><div className="h-4 w-24 animate-pulse rounded bg-white/10" /></td>
                    <td className="px-4 py-3"><div className="h-8 w-28 animate-pulse rounded bg-white/10" /></td>
                  </tr>
                ))
              : servers.map((s) => (
                  <tr key={s._id} className="group text-slate-300 transition-colors hover:bg-white/[0.02]">
                    <td className="px-4 py-3 font-medium text-white">{s.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">{s.url}</td>
                    <td className="px-4 py-3">
                      {s.latestCheck?.status
                        ? <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${statusBadge[s.latestCheck.status] ?? "bg-white/5 text-slate-400 ring-1 ring-white/10"}`}>{s.latestCheck.status}</span>
                        : <span className="text-slate-500">—</span>
                      }
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.enabled ? "bg-emerald-400/10 text-emerald-300 ring-1 ring-emerald-400/20" : "bg-white/5 text-slate-400 ring-1 ring-white/10"}`}>
                        {s.enabled ? "Active" : "Paused"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-400">{s.tags.join(", ") || <span className="text-slate-600">—</span>}</td>
                    <td className="px-4 py-3">
                      <div className="flex gap-2">
                        <button onClick={() => openEdit(s)} className="ui-btn ui-btn-secondary">Edit</button>
                        <button onClick={() => { suppressActionRef.current = false; setDeleting(s); setQuery({ action: "delete", server: s._id }); }} className="ui-btn ui-btn-danger">Delete</button>
                      </div>
                    </td>
                  </tr>
                ))
            }
          </tbody>
        </table>
        {!loading && servers.length === 0 && (
          <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">🖥️</div>
            <div>
              <h2 className="text-base font-semibold text-white">No servers yet</h2>
              <p className="mt-1 text-sm text-slate-400">Create a server to start collecting uptime history and screenshots.</p>
            </div>
            <button onClick={() => openCreate()} className="ui-btn ui-btn-primary">
              New server
            </button>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Edit server" : "Create server"} onClose={closeModal}>
          <form onSubmit={save} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Name *</label>
                <input required placeholder="My Server" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="ui-input" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">URL *</label>
                <input required placeholder="https://example.com" value={form.url} onChange={(e) => setForm({ ...form, url: e.target.value })} className="ui-input" />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Health route</label>
                <input placeholder="/health" value={form.healthRoute} onChange={(e) => setForm({ ...form, healthRoute: e.target.value })} className="ui-input" />
              </div>
              <div className="space-y-1.5">
                <label className="block text-xs font-medium text-slate-400">Screenshot route</label>
                <input placeholder="(defaults to server URL)" value={form.screenshotRoute} onChange={(e) => setForm({ ...form, screenshotRoute: e.target.value })} className="ui-input" />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Description</label>
              <textarea placeholder="Optional description..." rows={2} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="ui-input h-auto resize-none" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Tags <span className="text-slate-600">(comma-separated)</span></label>
              <input placeholder="production, api, critical" value={form.tags} onChange={(e) => setForm({ ...form, tags: e.target.value })} className="ui-input" />
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
                <span className="mt-0.5 block text-xs text-slate-400">{form.enabled ? "Server will be checked on schedule." : "Monitoring is paused for this server."}</span>
              </span>
              <span className={`relative ml-4 inline-flex h-6 w-11 shrink-0 rounded-full border transition-colors ${form.enabled ? "border-cyan-300/40 bg-cyan-400" : "border-white/10 bg-slate-800"}`}>
                <span className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition-all ${form.enabled ? "left-[22px]" : "left-1"}`} />
              </span>
            </button>
            {error && <p className="rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 ring-1 ring-rose-500/20">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="ui-btn ui-btn-secondary">Cancel</button>
              <button className="ui-btn ui-btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

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

export default function ServersPage() {
  return (
    <Suspense fallback={null}>
      <ServersPageContent />
    </Suspense>
  );
}





