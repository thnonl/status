"use client";

import { useCallback, useEffect, useState } from "react";
import { ConfirmModal, Modal } from "@/components/Modal";
import type { ProjectDto } from "@/lib/types";

type FormState = { name: string; description: string; slug: string };
const blank: FormState = { name: "", description: "", slug: "" };

export default function ProjectsPage() {
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");
  const load = useCallback(async () => { const res = await fetch("/api/projects", { cache: "no-store" }); setProjects(await res.json()); }, []);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);
  function openCreate() { setEditing(null); setForm(blank); setModalOpen(true); }
  function openEdit(p: ProjectDto) { setEditing(p); setForm({ name: p.name, description: p.description ?? "", slug: p.slug }); setModalOpen(true); }
  async function save(e: React.FormEvent) { e.preventDefault(); setError(""); const res = await fetch(editing ? `/api/projects/${editing._id}` : "/api/projects", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug: form.slug || undefined }) }); if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; } setModalOpen(false); await load(); }
  async function remove() { if (!deleting) return; const res = await fetch(`/api/projects/${deleting._id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) { setError(data.error ?? "Delete failed"); setDeleting(null); return; } setDeleting(null); await load(); }
  return <main className="space-y-3"><div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><div><h1 className="text-2xl font-semibold text-white">Projects</h1><p className="text-slate-400">Project CRUD table. Default project cannot be deleted.</p></div><button onClick={openCreate} className="rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950">New project</button></div>{error && <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-rose-200">{error}</div>}<div className="overflow-x-auto rounded-xl border border-white/10 bg-white/[0.04]"><table className="w-full text-left text-sm"><thead className="bg-white/[0.03] text-slate-400"><tr><th className="p-3">Name</th><th>Slug</th><th>Description</th><th>Default</th><th>Actions</th></tr></thead><tbody className="divide-y divide-white/10">{projects.map((p) => <tr key={p._id} className="text-slate-300"><td className="p-3 font-medium text-white">{p.name}</td><td className="font-mono">{p.slug}</td><td>{p.description || "—"}</td><td>{p.isDefault ? "✓" : "—"}</td><td className="space-x-2"><button onClick={() => openEdit(p)} className="rounded-lg border border-white/10 px-3 py-1">Edit</button>{!p.isDefault && <button onClick={() => setDeleting(p)} className="rounded-lg border border-rose-500/30 px-3 py-1 text-rose-200">Delete</button>}</td></tr>)}</tbody></table></div>{modalOpen && <Modal title={editing ? "Edit project" : "Create project"} onClose={() => setModalOpen(false)}><form onSubmit={save} className="space-y-3"><input required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"/><input placeholder="slug (auto)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 font-mono text-white"/><textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-3 py-2 text-white"/>{error && <p className="text-rose-300">{error}</p>}<div className="flex justify-end gap-3"><button type="button" onClick={() => setModalOpen(false)} className="rounded-xl border border-white/10 px-3 py-2 text-slate-200">Cancel</button><button className="rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950">Save</button></div></form></Modal>}{deleting && <ConfirmModal title="Delete project" message={`Delete "${deleting.name}"? All servers in this project must be removed first.`} onClose={() => setDeleting(null)} onConfirm={remove}/>}</main>;
}


