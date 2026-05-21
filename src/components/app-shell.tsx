"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, FolderKanban, LayoutDashboard, Menu, PanelLeftClose, PanelLeftOpen, RefreshCw, Server } from "lucide-react";

type ProjectItem = {
  _id?: string;
  id?: string;
  name?: string;
  title?: string;
};

const STORAGE_KEYS = {
  collapsed: "sidebarCollapsed",
  currentProjectId: "currentProjectId",
};

const navItems = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard },
  { href: "/servers", label: "Servers", icon: Server },
  { href: "/projects", label: "Projects", icon: FolderKanban },
] as const;

function readStorage(key: string) {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(key);
}

function writeStorage(key: string, value: string) {
  window.localStorage.setItem(key, value);
}

export function AppShell({ children }: Readonly<{ children: React.ReactNode }>) {
  const pathname = usePathname();
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [projectLoading, setProjectLoading] = useState(true);
  const [currentProjectId, setCurrentProjectId] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [projectMenuOpen, setProjectMenuOpen] = useState(false);
  const projectMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timeout = window.setTimeout(() => {
      const savedCollapsed = readStorage(STORAGE_KEYS.collapsed);
      const savedProject = readStorage(STORAGE_KEYS.currentProjectId);
      setCollapsed(savedCollapsed === "1");
      setCurrentProjectId(savedProject ?? "");
      setReady(true);
    }, 0);
    return () => window.clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (!ready) return;
    writeStorage(STORAGE_KEYS.collapsed, collapsed ? "1" : "0");
  }, [collapsed, ready]);

  useEffect(() => {
    function handlePointerDown(event: PointerEvent) {
      if (!projectMenuRef.current?.contains(event.target as Node)) setProjectMenuOpen(false);
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setProjectMenuOpen(false);
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    async function loadProjects() {
      setProjectLoading(true);
      try {
        const response = await fetch("/api/projects", { cache: "no-store" });
        if (!response.ok) throw new Error("Failed to load projects");
        const data = (await response.json()) as ProjectItem[];
        if (ignore) return;
        const list = Array.isArray(data) ? data : [];
        setProjects(list);
        const fallbackId = list[0]?._id ?? list[0]?.id ?? "";
        const knownIds = new Set(list.map((project) => project._id ?? project.id).filter(Boolean) as string[]);
        setCurrentProjectId((existing) => {
          const stored = existing || readStorage(STORAGE_KEYS.currentProjectId) || "";
          const next = stored && knownIds.has(stored) ? stored : fallbackId;
          if (next) writeStorage(STORAGE_KEYS.currentProjectId, next);
          return next;
        });
      } catch {
        if (!ignore) setProjects([]);
      } finally {
        if (!ignore) setProjectLoading(false);
      }
    }
    loadProjects();
    return () => {
      ignore = true;
    };
  }, [ready]);

  const currentProject = useMemo(() => {
    return projects.find((project) => (project._id ?? project.id) === currentProjectId) ?? null;
  }, [currentProjectId, projects]);

  function handleProjectChange(value: string) {
    setProjectMenuOpen(false);
    if (value === "__new__") {
      router.push("/projects/new");
      return;
    }
    setCurrentProjectId(value);
    writeStorage(STORAGE_KEYS.currentProjectId, value);
    window.location.reload();
  }

  function refreshPage() {
    setRefreshing(true);
    window.location.reload();
  }

  return (
    <div className="h-dvh overflow-hidden bg-[radial-gradient(circle_at_top_left,_rgba(56,189,248,0.12),_transparent_30rem),radial-gradient(circle_at_top_right,_rgba(168,85,247,0.12),_transparent_24rem),linear-gradient(180deg,_#05070d_0%,_#070b14_100%)] text-slate-100">
      <div className="flex h-full min-h-0">
        <aside
          className={[
            "fixed inset-y-0 left-0 z-40 h-dvh w-72 shrink-0 border-r border-white/10 bg-slate-950/90 backdrop-blur-xl transition-transform duration-200 md:static md:translate-x-0",
            mobileOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0",
            collapsed ? "md:w-20" : "md:w-72",
          ].join(" ")}
        >
          <div className="flex h-full flex-col">
            <div className="flex items-center justify-between gap-3 border-b border-white/10 px-3 py-2">
              <div className={collapsed ? "md:hidden" : "min-w-0"}>
                <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Status</p>
                <h1 className="mt-1 truncate text-lg font-semibold text-white">Admin Console</h1>
              </div>
              <button
                type="button"
                onClick={() => setCollapsed((value) => !value)}
                className="ml-auto hidden rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:inline-flex"
                aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
              >
                {collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}
              </button>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
                aria-label="Close navigation"
              >
                <Menu size={18} />
              </button>
            </div>

            <nav className="flex-1 space-y-2 p-3">
              {navItems.map(({ href, label, icon: Icon }) => {
                const active = pathname === href || (href !== "/" && pathname.startsWith(`${href}/`));
                return (
                  <Link
                    key={href}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={[
                      "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition",
                      active ? "bg-cyan-400/15 text-cyan-200 ring-1 ring-cyan-400/20" : "text-slate-300 hover:bg-white/5 hover:text-white",
                      collapsed ? "md:justify-center md:px-2" : "",
                    ].join(" ")}
                    title={collapsed ? label : undefined}
                  >
                    <Icon size={18} />
                    <span className={collapsed ? "md:hidden" : ""}>{label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="border-t border-white/10 p-3">
              <div className={`rounded-xl border border-white/10 bg-white/5 p-3 ${collapsed ? "md:hidden" : ""}`}>
                <p className="text-xs uppercase tracking-[0.3em] text-slate-400">Project</p>
                <p className="mt-2 truncate text-sm font-medium text-white">
                  {currentProject?.name ?? currentProject?.title ?? "No project selected"}
                </p>
              </div>
              <div className={`hidden justify-center ${collapsed ? "md:flex" : ""}`} title={currentProject?.name ?? currentProject?.title ?? "No project selected"}>
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-xs font-semibold text-cyan-200">
                  {(currentProject?.name ?? currentProject?.title ?? "?").slice(0, 1).toUpperCase()}
                </div>
              </div>
            </div>
          </div>
        </aside>

        {mobileOpen ? <button type="button" aria-label="Close sidebar backdrop" className="fixed inset-0 z-30 bg-slate-950/60 md:hidden" onClick={() => setMobileOpen(false)} /> : null}

        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto">
          <header className="sticky top-0 z-20 border-b border-white/10 bg-slate-950/70 backdrop-blur-xl">
            <div className="flex flex-col gap-3 px-3 py-2 md:flex-row md:items-center md:justify-between md:px-3">
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={() => setMobileOpen((value) => !value)}
                  className="inline-flex rounded-xl border border-white/10 p-2 text-slate-300 transition hover:bg-white/10 hover:text-white md:hidden"
                  aria-label="Open navigation"
                >
                  <Menu size={18} />
                </button>
                <div>
                  <p className="text-xs uppercase tracking-[0.35em] text-cyan-300">Admin Status</p>
                  <h2 className="mt-1 text-lg font-semibold text-white md:text-lg">Operations shell</h2>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div ref={projectMenuRef} className="relative min-w-60">
                  <button
                    type="button"
                    onClick={() => setProjectMenuOpen((value) => !value)}
                    disabled={projectLoading}
                    aria-haspopup="listbox"
                    aria-expanded={projectMenuOpen}
                    className="flex w-full items-center justify-between gap-3 rounded-xl border border-white/10 bg-white/5 px-3 py-2 text-left shadow-lg shadow-black/10 transition hover:border-cyan-400/30 hover:bg-white/10 focus:outline-none focus:ring-2 focus:ring-cyan-400/40 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    <span className="min-w-0">
                      <span className="block text-[10px] uppercase tracking-[0.25em] text-slate-400">Project</span>
                      <span className="mt-0.5 block truncate text-sm font-medium text-white">
                        {projectLoading ? "Loading..." : currentProject?.name ?? currentProject?.title ?? "No projects"}
                      </span>
                    </span>
                    <ChevronDown size={16} className={`shrink-0 text-slate-400 transition ${projectMenuOpen ? "rotate-180 text-cyan-300" : ""}`} />
                  </button>

                  {projectMenuOpen ? (
                    <div className="absolute right-0 top-full z-50 mt-2 w-full overflow-hidden rounded-xl border border-white/10 bg-slate-950/95 p-1 shadow-2xl shadow-black/40 backdrop-blur-xl ring-1 ring-cyan-400/10">
                      <div className="max-h-72 overflow-y-auto py-1" role="listbox" aria-label="Project selector">
                        {projects.length === 0 ? (
                          <div className="px-3 py-2 text-sm text-slate-400">No projects</div>
                        ) : null}
                        {projects.map((project) => {
                          const id = project._id ?? project.id ?? "";
                          const label = project.name ?? project.title ?? id;
                          const active = id === currentProjectId;
                          return (
                            <button
                              key={id}
                              type="button"
                              role="option"
                              aria-selected={active}
                              onClick={() => handleProjectChange(id)}
                              className={`flex w-full items-center gap-3 rounded-xl px-3 py-2 text-left text-sm transition ${active ? "bg-cyan-400/15 text-cyan-100 ring-1 ring-cyan-400/20" : "text-slate-300 hover:bg-white/8 hover:text-white"}`}
                            >
                              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-white/5 text-xs font-semibold text-cyan-200">{label.slice(0, 1).toUpperCase()}</span>
                              <span className="min-w-0 flex-1 truncate">{label}</span>
                              {active ? <span className="h-2 w-2 rounded-full bg-cyan-300" /> : null}
                            </button>
                          );
                        })}
                        <button type="button" onClick={() => handleProjectChange("__new__")} className="mt-1 flex w-full items-center justify-center rounded-xl border border-dashed border-cyan-400/30 px-3 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-400/10">
                          New project...
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={refreshPage}
                  disabled={refreshing}
                  title="Làm mới dữ liệu"
                  className="inline-flex items-center justify-center gap-2 rounded-xl bg-cyan-400 px-3 py-2 font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:cursor-wait disabled:opacity-70"
                >
                  <RefreshCw size={16} className={refreshing ? "animate-spin" : ""} />
                </button>
              </div>
            </div>
          </header>

          <main className="min-w-0 flex-1 px-3 py-2 md:px-3">
            <div className="mx-auto w-full max-w-7xl">{children}</div>
          </main>
        </div>
      </div>
    </div>
  );
}
