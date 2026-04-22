import { useState, useMemo, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Search, Activity, Wifi, Cpu, Terminal, LayoutList, Target, Box, Github } from "lucide-react";
import { openUrl } from "@tauri-apps/plugin-opener";
import { trackEvent } from "@aptabase/tauri";
import { SniperButton } from "./components/SniperButton";
import { TelemetryBar } from "./components/TelemetryBar";
import { UpdatePrompt } from "./components/UpdatePrompt";
import clsx from "clsx";

interface PortInfo {
  pid: number;
  name: string;
  port: number;
  protocol: string;
}

interface ProcessInfo {
  pid: number;
  name: string;
  app_name?: string;
  cpu_usage: number;
  memory_usage: number;
}

type ViewMode = "ports" | "all";

export default function App() {
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<ViewMode>("ports");
  const queryClient = useQueryClient();

  const { data: ports = [], isLoading: isLoadingPorts } = useQuery<PortInfo[]>({
    queryKey: ["active_ports"],
    queryFn: async () => await invoke("get_active_ports"),
    refetchInterval: 2000,
    enabled: viewMode === "ports",
  });

  const { data: allProcesses = [], isLoading: isLoadingAll } = useQuery<ProcessInfo[]>({
    queryKey: ["all_processes"],
    queryFn: async () => await invoke("get_all_processes"),
    refetchInterval: 2000,
    enabled: viewMode === "all",
  });

  const killMutation = useMutation({
    mutationFn: async (pid: number) => {
      await invoke("kill_process", { pid });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [viewMode === "ports" ? "active_ports" : "all_processes"] });
      trackEvent("single_kill_executed", { mode: viewMode });
    },
    onError: (error) => {
      console.error("Failed to eliminate target:", error);
      alert("Mission Failed: Could not terminate process.");
    }
  });

  const killAllMutation = useMutation({
    mutationFn: async (pids: number[]) => {
      await invoke("kill_all_processes", { pids });
    },
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: [viewMode === "ports" ? "active_ports" : "all_processes"] });
      setSearch("");
      trackEvent("batch_kill_executed", { count: variables.length, mode: viewMode });
    },
    onError: (error) => {
      console.error("Batch elimination failed:", error);
      alert("Execution Error: Some targets may still be active.");
    }
  });

  const filteredItems = useMemo(() => {
    const term = search.toLowerCase();
    if (viewMode === "ports") {
      return ports.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.port.toString().includes(term) ||
        p.pid.toString().includes(term)
      );
    } else {
      return allProcesses.filter((p) =>
        p.name.toLowerCase().includes(term) ||
        p.pid.toString().includes(term) ||
        p.app_name?.toLowerCase().includes(term)
      ).sort((a, b) => b.cpu_usage - a.cpu_usage);
    }
  }, [search, viewMode, ports, allProcesses]);

  const isLoading = viewMode === "ports" ? isLoadingPorts : isLoadingAll;

  // Track session start
  useEffect(() => {
    trackEvent("app_started", { platform: window.navigator.platform });
  }, []);

  // Track view changes
  useEffect(() => {
    trackEvent("view_changed", { mode: viewMode });
  }, [viewMode]);

  // Format bytes to MB
  const formatMB = (bytes: number) => (bytes / 1024 / 1024).toFixed(1);

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background text-slate-100 font-sans selection:bg-red-900/30 selection:text-red-100">
      {/* Header / Title Bar */}
      <div
        data-tauri-drag-region
        className="relative z-10 border-b border-white/[0.05] bg-slate-950/40 backdrop-blur-xl"
      >
        <div className="mx-auto flex h-[56px] max-w-[900px] items-center justify-between px-4 pt-4">
          <div className="flex items-center gap-3 pl-[76px] pointer-events-none">
            <div className="rounded bg-red-500/10 p-1 ring-1 ring-red-500/20">
              <Activity className="h-3.5 w-3.5 text-red-500" />
            </div>
            <h1 className="hidden text-xs font-black tracking-widest text-white uppercase italic md:block">Recoil</h1>
          </div>

          <div className="relative flex items-center gap-1 rounded-lg border border-white/5 bg-slate-950/80 p-1 shadow-inner">
            {/* Sliding Indicator */}
            <div
              className={clsx(
                "absolute h-[calc(100%-8px)] w-[calc(50%-6px)] rounded-md bg-red-600 transition-all duration-300 ease-out shadow-[0_0_15px_rgba(220,38,38,0.4)]",
                viewMode === "ports" ? "left-1" : "left-[calc(50%+2px)]"
              )}
            />

            <button
              onClick={() => setViewMode("ports")}
              className={clsx(
                "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider transition-colors duration-200",
                viewMode === "ports" ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}
              title="View Active Ports"
            >
              <Wifi className="h-3 w-3" />
              <span className="hidden sm:inline">Ports</span>
            </button>
            <button
              onClick={() => setViewMode("all")}
              className={clsx(
                "relative z-10 flex items-center gap-1.5 px-3 py-1.5 text-[8px] font-black uppercase tracking-wider transition-colors duration-200",
                viewMode === "all" ? "text-white" : "text-slate-500 hover:text-slate-300"
              )}
              title="View All Processes"
            >
              <LayoutList className="h-3 w-3" />
              <span className="hidden sm:inline">System</span>
            </button>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="border-b border-white/5 bg-slate-900/20">
        <div className="mx-auto flex max-w-[900px] items-center gap-2 p-4 md:gap-4">
          <div className="relative group flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500 transition-colors group-focus-within:text-red-400" />
            <input
              type="text"
              placeholder={viewMode === "ports" ? "Search PID/Port..." : "Search PID/App..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full rounded-md border border-white/10 bg-slate-950/50 py-2 pl-9 pr-4 text-sm text-slate-200 placeholder-slate-600 outline-none ring-1 ring-transparent transition-all focus:border-red-900/50 focus:bg-slate-950 focus:ring-red-500/10"
            />
          </div>

          {search && filteredItems.length > 1 && (
            <button
              onClick={() => {
                if (confirm(`Authorize massive elimination of ${filteredItems.length} targets?`)) {
                  killAllMutation.mutate(filteredItems.map(p => p.pid));
                }
              }}
              className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-950/40 px-3 py-2 text-[10px] font-bold text-red-400 hover:bg-red-500 hover:text-white transition-all animate-pulse md:px-4"
              title={`Eliminate ${filteredItems.length} targets`}
            >
              <Target className="h-4 w-4" />
              <span className="hidden md:inline">ELIMINATE ALL ({filteredItems.length})</span>
              <span className="md:hidden">KILL_{filteredItems.length}</span>
            </button>
          )}
        </div>
      </div>

      {/* List Area */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar">
        <div className="mx-auto max-w-[900px] p-2 md:p-4">
          {isLoading && filteredItems.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-4 text-slate-600">
              <Activity className="h-8 w-8 animate-pulse text-red-900" />
              <span className="font-mono text-xs tracking-widest uppercase">Initializing_Scan...</span>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="flex h-[400px] flex-col items-center justify-center gap-2 text-slate-600">
              <Terminal className="h-8 w-8 opacity-20" />
              <span className="font-mono text-xs uppercase">No_Targets_Found</span>
            </div>
          ) : (
            <div className="grid gap-2">
              {filteredItems.map((item) => (
                <div
                  key={viewMode === "ports" ? `${item.pid}-${(item as PortInfo).port}` : item.pid}
                  className="group relative flex items-center justify-between rounded-md border border-white/5 bg-slate-800/10 p-2 transition-all hover:bg-slate-800/30 hover:border-white/10 md:p-3"
                >
                  <div className="flex min-w-0 items-center gap-3 md:gap-5">
                    {/* Type Badge */}
                    <div className="hidden h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-slate-900 font-mono text-[10px] font-bold text-slate-500 ring-1 ring-white/5 transition-colors group-hover:text-red-400 group-hover:ring-red-900/40 sm:flex">
                      {viewMode === "ports" ? (item as PortInfo).protocol : "PRC"}
                    </div>

                    <div className="flex min-w-0 flex-col gap-0.5">
                      {/* Process Name & Application Info */}
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                        <h3 className="truncate text-xs font-bold tracking-tight text-slate-200 group-hover:text-white md:text-sm">
                          {item.name}
                        </h3>

                        {viewMode === "all" && (item as ProcessInfo).app_name && (
                          <div className="flex items-center gap-1.5 rounded-full bg-red-500/10 px-2 py-0.5 text-[9px] font-black uppercase tracking-wider text-red-500 ring-1 ring-red-500/30 md:text-[10px]">
                            <Box className="h-2.5 w-2.5" />
                            <span className="hidden xs:inline">{(item as ProcessInfo).app_name}</span>
                            <span className="xs:hidden">{(item as ProcessInfo).app_name?.substring(0, 3)}</span>
                          </div>
                        )}

                        <span className="font-mono text-[10px] font-bold text-slate-600 group-hover:text-red-500/60 md:text-[11px]">
                          #{item.pid}
                        </span>
                      </div>

                      {/* Operational Stats */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 font-mono text-[9px] uppercase tracking-wider text-slate-500 md:text-[10px]">
                        {viewMode === "ports" ? (
                          <div className="flex items-center gap-2 text-red-400">
                            <Wifi className="h-3 w-3" />
                            <span className="hidden xs:inline">PORT</span> :{(item as PortInfo).port}
                          </div>
                        ) : (
                          <>
                            <div className="flex items-center gap-1.5">
                              <Cpu className="h-3 w-3" />
                              CPU: <span className="text-slate-300">{(item as ProcessInfo).cpu_usage.toFixed(1)}%</span>
                            </div>
                            <div className="flex items-center gap-1.5 sm:border-l sm:border-white/10 sm:pl-4">
                              <Activity className="h-3 w-3" />
                              MEM: <span className="text-slate-300">{formatMB((item as ProcessInfo).memory_usage)}MB</span>
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Engagement Control */}
                  <div className="flex flex-shrink-0 items-center pr-1 transition-transform group-hover:scale-110">
                    <SniperButton
                      onClick={() => killMutation.mutateAsync(item.pid)}
                      disabled={killMutation.isPending}
                    />
                  </div>

                  {/* Decorative Reticles */}
                  <div className="absolute -left-px -top-px h-2 w-2 border-l border-t border-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
                  <div className="absolute -bottom-px -right-px h-2 w-2 border-b border-r border-white/10 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="border-t border-white/[0.05] bg-slate-950">
        <div className="mx-auto flex h-[44px] max-w-[900px] items-center justify-between px-4">
          <div className="flex-1">
            <TelemetryBar />
          </div>
          <button
            onClick={() => openUrl("https://github.com/CodeMaverick-143/Recoil")}
            className="group ml-4 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg border border-white/5 bg-white/[0.02] text-slate-600 transition-all hover:border-white/10 hover:bg-white/[0.05] hover:text-white"
            title="Source Code"
          >
            <Github className="h-4 w-4 transition-transform group-hover:scale-110" />
          </button>
        </div>
      </div>

      <UpdatePrompt />
    </div>
  );
}
