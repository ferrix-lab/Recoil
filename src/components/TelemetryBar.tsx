import { invoke } from "@tauri-apps/api/core";
import { useQuery } from "@tanstack/react-query";
import { Cpu, MemoryStick } from "lucide-react";
import clsx from "clsx";

interface GlobalStats {
    cpu_usage: number;
    memory_total: number;
    memory_used: number;
}

export function TelemetryBar() {
    const { data: stats } = useQuery<GlobalStats>({
        queryKey: ["global_stats"],
        queryFn: async () => await invoke("get_global_stats"),
        refetchInterval: 2000,
    });

    const cpuUsage = stats?.cpu_usage || 0;
    const memUsed = stats?.memory_used || 0;
    const memTotal = stats?.memory_total || 1; // avoid division by zero
    const memPercent = (memUsed / memTotal) * 100;

    // Format bytes to GB
    const formatGB = (bytes: number) => (bytes / 1024 / 1024 / 1024).toFixed(1);

    return (
        <div className="flex w-full h-full items-center justify-between px-2">
            <div className="flex items-center gap-4 sm:gap-6">
                {/* CPU Monitor */}
                <div className="flex items-center gap-2">
                    <Cpu className={clsx("h-3 w-3 flex-shrink-0", {
                        "text-green-500": cpuUsage < 50,
                        "text-yellow-500": cpuUsage >= 50 && cpuUsage < 80,
                        "text-red-500": cpuUsage >= 80,
                    })} />
                    <div className="flex flex-col">
                        <span className="hidden text-[9px] uppercase text-slate-500 xs:inline">CPU Load</span>
                        <span className={clsx("font-mono text-[11px] font-bold leading-none md:text-xs", {
                            "text-green-400": cpuUsage < 50,
                            "text-yellow-400": cpuUsage >= 50 && cpuUsage < 80,
                            "text-red-400": cpuUsage >= 80,
                        })}>
                            {cpuUsage.toFixed(1)}%
                        </span>
                    </div>
                </div>

                {/* Memory Monitor */}
                <div className="flex items-center gap-2">
                    <MemoryStick className="h-3 w-3 flex-shrink-0 text-cyan-500" />
                    <div className="flex w-24 flex-col gap-1 sm:w-32">
                        <div className="flex justify-between text-[9px] leading-none text-slate-500 md:text-[10px]">
                            <span className="hidden xs:inline">RAM</span>
                            <span>{formatGB(memUsed)}<span className="hidden sm:inline"> / {formatGB(memTotal)}</span> GB</span>
                        </div>
                        <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-800">
                            <div
                                className="h-full bg-cyan-500 transition-all duration-500"
                                style={{ width: `${memPercent}%` }}
                            />
                        </div>
                    </div>
                </div>
            </div>

            <div className="hidden items-center gap-2 text-[10px] text-slate-600 font-mono sm:flex">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-800 animate-pulse"></span>
                THERMAL_link_ACTIVE
            </div>
        </div>
    );
}
