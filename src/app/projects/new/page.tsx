"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectDto } from "@/lib/types";

const inputCls = "h-11 w-full rounded-lg border border-white/10 bg-black/30 px-3.5 text-sm text-white placeholder:text-slate-500 transition-colors focus:border-cyan-400/40 focus:bg-black/40";
const btnCls = "inline-flex h-10 items-center justify-center rounded-lg px-4 text-sm font-medium transition-colors";

export default function NewProjectPage() {
  const [form, setForm] = useState({ name: "", description: "", slug: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState<ProjectDto | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
    if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; }
    const p = await res.json();
    localStorage.setItem("currentProjectId", p._id);
    setDone(p);
  }

  if (done) {
    return (
      <main className="mx-auto max-w-xl space-y-6">
        <div className="rounded-xl border border-emerald-400/20 bg-emerald-400/10 p-6 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/20 text-2xl">✓</div>
          <h1 className="text-xl font-semibold text-white">Project created</h1>
          <p className="mt-2 text-sm text-emerald-200">Project “{done.name}” is ready.</p>
          <Link href={`/?project=${done._id}`} className={`${btnCls} mt-6 bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300`}>
            Go to Dashboard
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-white">New project</h1>
        <p className="mt-1 text-sm text-slate-400">Create a project to group servers and status history.</p>
      </div>
      <form onSubmit={submit} className="space-y-4 rounded-xl border border-white/10 bg-white/[0.04] p-6">
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Project name *</label>
          <input required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className={inputCls} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Slug</label>
          <input placeholder="slug-auto-generated" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className={`${inputCls} font-mono`} />
        </div>
        <div className="space-y-1.5">
          <label className="block text-xs font-medium text-slate-400">Description</label>
          <textarea placeholder="Optional description..." rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className={`${inputCls} h-auto resize-none py-3`} />
        </div>
        {error && <p className="rounded-lg bg-rose-500/10 px-4 py-2.5 text-sm text-rose-300 ring-1 ring-rose-500/20">{error}</p>}
        <div className="flex justify-end gap-3 pt-2">
          <Link href="/projects" className={`${btnCls} border border-white/10 text-slate-200 hover:bg-white/10`}>Cancel</Link>
          <button className={`${btnCls} bg-cyan-400 font-semibold text-slate-950 hover:bg-cyan-300`}>Create</button>
        </div>
      </form>
    </main>
  );
}
