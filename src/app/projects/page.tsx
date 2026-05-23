"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Modal } from "@/components/Modal";
import { ConfirmModal } from "@/components/confirm-modal";
import type { ProjectDto } from "@/lib/types";

type FormState = { name: string; description: string; slug: string };
const blank: FormState = { name: "", description: "", slug: "" };

function ProjectsPageContent() {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const actionParam = searchParams.get("action");
  const projectParam = searchParams.get("project");
  const suppressActionRef = useRef(false);
  const [projects, setProjects] = useState<ProjectDto[]>([]);
  const [form, setForm] = useState<FormState>(blank);
  const [editing, setEditing] = useState<ProjectDto | null>(null);
  const [deleting, setDeleting] = useState<ProjectDto | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => { const res = await fetch("/api/projects", { cache: "no-store" }); setProjects(await res.json()); }, []);
  useEffect(() => { load(); }, [load]); // eslint-disable-line react-hooks/set-state-in-effect

  const setQuery = useCallback((updates: Record<string, string | null>) => { const params = new URLSearchParams(searchParams.toString()); for (const [key, value] of Object.entries(updates)) { if (value) params.set(key, value); else params.delete(key); } const query = params.toString(); router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false }); }, [pathname, router, searchParams]);
  function closeModal() { suppressActionRef.current = true; setModalOpen(false); setEditing(null); setDeleting(null); setQuery({ action: null, project: null }); }
  function openCreate(updateUrl = true) { suppressActionRef.current = false; setEditing(null); setForm(blank); setModalOpen(true); if (updateUrl) setQuery({ action: "create", project: null }); }
  function openEdit(p: ProjectDto, updateUrl = true) { suppressActionRef.current = false; setEditing(p); setForm({ name: p.name, description: p.description ?? "", slug: p.slug }); setModalOpen(true); if (updateUrl) setQuery({ action: "edit", project: p._id }); }

  useEffect(() => {
    if (!actionParam) { suppressActionRef.current = false; return; } if (suppressActionRef.current) return; // eslint-disable-next-line react-hooks/set-state-in-effect
    if (actionParam === "create" && !modalOpen) openCreate(false); if (projectParam) { const project = projects.find((item) => item._id === projectParam); if (actionParam === "edit" && project && editing?._id !== projectParam) openEdit(project, false); if (actionParam === "delete" && project && deleting?._id !== projectParam) setDeleting(project); }
  }, [actionParam, deleting?._id, editing?._id, modalOpen, projectParam, projects]); // eslint-disable-line react-hooks/exhaustive-deps

  async function save(e: React.FormEvent) { e.preventDefault(); setError(""); const res = await fetch(editing ? `/api/projects/${editing._id}` : "/api/projects", { method: editing ? "PUT" : "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, slug: form.slug || undefined }) }); if (!res.ok) { setError((await res.json()).error ?? "Save failed"); return; } closeModal(); await load(); }
  async function remove() { if (!deleting) return; const res = await fetch(`/api/projects/${deleting._id}`, { method: "DELETE" }); const data = await res.json(); if (!res.ok) { setError(data.error ?? "Delete failed"); closeModal(); return; } closeModal(); await load(); }

  return (
    <main className="page-shell">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-white">Projects</h1>
          <p className="mt-1 text-sm text-slate-400">Organize monitored servers by project.</p>
        </div>
        <button onClick={() => openCreate()} className="ui-btn ui-btn-primary">
          New project
        </button>
      </div>

      {error && <div className="rounded-lg border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">{error}</div>}

      <div className="page-card overflow-x-auto">
        <table className="ui-table min-w-[760px]">
          <thead>
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Slug</th>
              <th className="px-4 py-3">Description</th>
              <th className="px-4 py-3">Default</th>
              <th className="px-4 py-3">Actions</th>
            </tr>
          </thead>
          <tbody>
            {projects.map((p) => (
              <tr key={p._id} className="text-slate-300 transition-colors hover:bg-white/[0.02]">
                <td className="px-4 py-3 font-medium text-white">{p.name}</td>
                <td className="px-4 py-3 font-mono text-xs text-slate-400">{p.slug}</td>
                <td className="px-4 py-3 text-slate-400">{p.description || <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-3">{p.isDefault ? <span className="inline-flex rounded-full bg-cyan-400/10 px-2.5 py-1 text-xs font-semibold text-cyan-300 ring-1 ring-cyan-400/20">Default</span> : <span className="text-slate-600">—</span>}</td>
                <td className="px-4 py-3">
                  <div className="flex gap-2">
                    <button onClick={() => openEdit(p)} className="ui-btn ui-btn-secondary">Edit</button>
                    {!p.isDefault && <button onClick={() => { suppressActionRef.current = false; setDeleting(p); setQuery({ action: "delete", project: p._id }); }} className="ui-btn ui-btn-danger">Delete</button>}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {projects.length === 0 && (
          <div className="flex flex-col items-center gap-3 border-t border-white/[0.06] px-4 py-16 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/[0.04] text-2xl">📁</div>
            <div>
              <h2 className="text-base font-semibold text-white">No projects yet</h2>
              <p className="mt-1 text-sm text-slate-400">Create a project to group your monitored servers.</p>
            </div>
          </div>
        )}
      </div>

      {modalOpen && (
        <Modal title={editing ? "Edit project" : "Create project"} onClose={closeModal}>
          <form onSubmit={save} className="space-y-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Project name *</label>
              <input required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="ui-input" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Slug</label>
              <input placeholder="slug-auto-generated" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="ui-input font-mono" />
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-medium text-slate-400">Description</label>
              <textarea placeholder="Optional description..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="ui-input h-auto resize-none py-3" />
            </div>
            {error && <p className="rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 ring-1 ring-rose-500/20">{error}</p>}
            <div className="flex justify-end gap-3 pt-2">
              <button type="button" onClick={closeModal} className="ui-btn ui-btn-secondary">Cancel</button>
              <button className="ui-btn ui-btn-primary">Save</button>
            </div>
          </form>
        </Modal>
      )}

      {deleting && <ConfirmModal open={!!deleting} title="Delete project" description={`Delete "${deleting.name}"? All servers in this project must be removed first.`} confirmLabel="Delete" onCancel={closeModal} onConfirm={remove} />}
    </main>
  );
}

export default function ProjectsPage() {
  return (
    <Suspense fallback={null}>
      <ProjectsPageContent />
    </Suspense>
  );
}




