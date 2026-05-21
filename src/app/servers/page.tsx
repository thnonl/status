"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal, Modal } from "@/components/Modal";
import type { ProjectDto, ServerDto } from "@/lib/types";

type FormState = { name: string; url: string; healthRoute: string; screenshotRoute: string; description: string; tags: string; enabled: boolean };
const blank: FormState = { name: "", url: "", healthRoute: "", screenshotRoute: "", description: "", tags: "", enabled: true };

export default function ServersPage() {
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
    const stored = localStorage.getItem("currentProjectId");
    const selected = stored && data.some((p) => p._id === stored) ? stored : data[0]?._id;
    if (selected) { localStorage.setItem("currentProjectId", selected); setProjectId(selected); }
    else setLoading(false);
  }, []);
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

  function openCreate() { setEditing(null); setForm(blank); setModalOpen(true); }
  function openEdit(server: ServerDto) { setEditing(server); setForm({ name: server.name, url: server.url, healthRoute: server.healthRoute ?? "", screenshotRoute: server.screenshotRoute ?? "", description: server.description ?? "", tags: server.tags.join(", "), enabled: server.enabled }); setModalOpen(true); }
  async function save(e: React.FormEvent) {
    e.preventDefault(); setError("");
    const res = await fetch(editing ? `/api/servers/${editing._id}` : "/api/servers", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, projectId }) });
    if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; }
    setModalOpen(false); await loadServers();
  }
  async function remove() { if (!deleting) return; await fetch(`/api/servers/${deleting._id}`, { method: "DELETE" }); setDeleting(null); await loadServers(); }

  return <main className="space-y-6">
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-3xl font-semibold text-white">Servers</h1><p className="text-slate-400">CRUD table scoped to selected project.</p></div><button onClick={openCreate} className="rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950">New server</button></div>
    <div className="overflow-x-auto rounded-3xl border border-white/10 bg-white/[0.04]"><table className="w-full min-w-[900px] text-left text-sm"><thead className="bg-white/[0.03] text-slate-400"><tr><th className="p-4">Name</th><th>URL</th><th>Enabled</th><th>Status</th><th>Tags</th><th>Actions</th></tr></thead><tbody className="divide-y divide-white/10">{loading ? Array.from({ length: 4 }).map((_, i) => <tr key={i}><td className="p-4"><div className="h-4 w-32 animate-pulse rounded bg-white/10"/></td><td><div className="h-4 w-64 animate-pulse rounded bg-white/10"/></td><td><div className="h-4 w-12 animate-pulse rounded bg-white/10"/></td><td><div className="h-4 w-16 animate-pulse rounded bg-white/10"/></td><td><div className="h-4 w-24 animate-pulse rounded bg-white/10"/></td><td><div className="h-8 w-28 animate-pulse rounded bg-white/10"/></td></tr>) : servers.map((s) => <tr key={s._id} className="text-slate-300"><td className="p-4 font-medium text-white">{s.name}</td><td>{s.url}</td><td>{s.enabled ? "Yes" : "No"}</td><td>{s.latestCheck?.status ?? "—"}</td><td>{s.tags.join(", ") || "—"}</td><td className="space-x-2"><button onClick={() => openEdit(s)} className="rounded-lg border border-white/10 px-3 py-1">Edit</button><button onClick={() => setDeleting(s)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-rose-200">Delete</button></td></tr>)}</tbody></table>{!loading && servers.length === 0 && <div className="border-t border-white/10 p-10 text-center"><h2 className="text-lg font-semibold text-white">No servers in this project</h2><p className="mt-2 text-sm text-slate-400">Create a server to start collecting uptime history and screenshots.</p><button onClick={openCreate} className="mt-5 rounded-2xl bg-cyan-400 px-4 py-3 font-semibold text-slate-950 hover:bg-cyan-300">New server</button></div>}</div>
    {modalOpen && <Modal title={editing ? "Edit server" : "Create server"} onClose={() => setModalOpen(false)}><form onSubmit={save} className="space-y-3"><input required placeholder="Name" value={form.name} onChange={(e)=>setForm({...form,name:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><input required placeholder="https://example.com" value={form.url} onChange={(e)=>setForm({...form,url:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><input placeholder="Health route (default /health)" value={form.healthRoute} onChange={(e)=>setForm({...form,healthRoute:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><input placeholder="Screenshot route (default server URL)" value={form.screenshotRoute} onChange={(e)=>setForm({...form,screenshotRoute:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><textarea placeholder="Description" value={form.description} onChange={(e)=>setForm({...form,description:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><input placeholder="tags" value={form.tags} onChange={(e)=>setForm({...form,tags:e.target.value})} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><button type="button" role="switch" aria-checked={form.enabled} onClick={()=>setForm({...form,enabled:!form.enabled})} className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-left transition hover:bg-white/[0.07] focus:outline-none focus:ring-2 focus:ring-cyan-400/40"><span><span className="block text-sm font-medium text-white">Enabled</span><span className="mt-1 block text-xs text-slate-400">{form.enabled ? "Server will be monitored." : "Server monitoring is paused."}</span></span><span className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition ${form.enabled ? "border-cyan-300/40 bg-cyan-400" : "border-white/10 bg-slate-800"}`}><span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition ${form.enabled ? "left-6" : "left-1"}`} /></span></button>{error && <p className="text-rose-300">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={()=>setModalOpen(false)} className="rounded-xl border border-white/10 px-4 py-2">Cancel</button><button className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950">Save</button></div></form></Modal>}
    {deleting && <ConfirmModal title="Delete server" message={`Delete ${deleting.name} and all history/screenshots?`} onClose={()=>setDeleting(null)} onConfirm={remove}/>} 
  </main>;
}


