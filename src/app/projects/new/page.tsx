"use client";

import Link from "next/link";
import { useState } from "react";
import type { ProjectDto } from "@/lib/types";

export default function NewProjectPage() {
  const [form, setForm] = useState({ name: "", description: "", slug: "" });
  const [error, setError] = useState("");
  const [done, setDone] = useState<ProjectDto | null>(null);
  async function submit(e: React.FormEvent) { e.preventDefault(); setError(""); const res = await fetch("/api/projects", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) }); if (!res.ok) { setError((await res.json()).error ?? "Failed"); return; } const p = await res.json(); localStorage.setItem("currentProjectId", p._id); setDone(p); }
  if (done) return <main className="space-y-4"><p className="text-xl text-emerald-300">Project “{done.name}” created.</p><Link href="/" className="text-cyan-300">Go to Dashboard</Link></main>;
  return <main className="mx-auto max-w-xl space-y-6"><h1 className="text-3xl font-semibold text-white">New project</h1><form onSubmit={submit} className="space-y-4 rounded-3xl border border-white/10 bg-white/[0.04] p-6"><input required placeholder="Project name" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/><input placeholder="slug (auto)" value={form.slug} onChange={(e) => setForm({ ...form, slug: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 font-mono text-white"/><textarea placeholder="Description" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full rounded-xl border border-white/10 bg-black/30 px-4 py-3 text-white"/>{error && <p className="text-rose-300">{error}</p>}<div className="flex justify-end gap-3"><Link href="/projects" className="rounded-xl border border-white/10 px-4 py-2 text-slate-200">Cancel</Link><button className="rounded-xl bg-cyan-400 px-4 py-2 font-semibold text-slate-950">Create</button></div></form></main>;
}

