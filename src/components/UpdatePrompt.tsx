import { useState, useEffect } from "react";
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { Download, RefreshCw, X, AlertTriangle, CheckCircle } from "lucide-react";
import clsx from "clsx";

export function UpdatePrompt() {
  const [update, setUpdate] = useState<any>(null);
  const [status, setStatus] = useState<"idle" | "checking" | "downloading" | "downloaded" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkForUpdate() {
      try {
        setStatus("checking");
        const availableUpdate = await check();
        if (availableUpdate) {
          setUpdate(availableUpdate);
        }
        setStatus("idle");
      } catch (e) {
        console.error("Update check failed:", e);
        setStatus("error");
        setError("Failed to check for updates");
      }
    }

    // Initial check
    checkForUpdate();
    
    // Check every 30 minutes
    const interval = setInterval(checkForUpdate, 30 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const handleUpdate = async () => {
    if (!update) return;
    try {
      setStatus("downloading");
      await update.downloadAndInstall();
      setStatus("downloaded");
      
      // Delay slightly so the user sees the success state
      setTimeout(async () => {
        await relaunch();
      }, 1500);
    } catch (e) {
      console.error("Update failed:", e);
      setStatus("error");
      setError("Download or installation failed");
    }
  };

  if (!update) return null;

  return (
    <div className="fixed bottom-14 left-1/2 z-50 w-full max-w-md -translate-x-1/2 transform px-4">
      <div className="relative overflow-hidden rounded-lg border border-red-500/30 bg-slate-900/90 p-4 shadow-2xl backdrop-blur-xl transition-all animate-in fade-in slide-in-from-bottom-4">
        {/* Progress Background */}
        {status === "downloading" && (
          <div className="absolute bottom-0 left-0 h-1 w-full bg-slate-800">
            <div className="h-full bg-red-600 transition-all duration-1000 animate-pulse w-2/3" />
          </div>
        )}

        <div className="flex items-start gap-4">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-red-500/10 ring-1 ring-red-500/20">
            {status === "error" ? (
              <AlertTriangle className="h-5 w-5 text-red-500" />
            ) : status === "downloaded" ? (
              <CheckCircle className="h-5 w-5 text-green-500" />
            ) : (
              <RefreshCw className={clsx("h-5 w-5 text-red-500", status === "downloading" && "animate-spin")} />
            )}
          </div>

          <div className="flex-1">
            <h4 className="text-sm font-bold text-white uppercase tracking-wider">
              {status === "downloading" ? "Downloading Update..." : 
               status === "downloaded" ? "Update Ready" : 
               status === "error" ? "Update Failed" : "New Tactical Patch Available"}
            </h4>
            <p className="mt-1 text-xs text-slate-400">
              {status === "downloaded" ? "Installation complete. Relaunching..." :
               status === "error" ? error : `Version ${update.version} has been detected. Integration recommended.`}
            </p>

            <div className="mt-3 flex items-center gap-2">
              {status === "idle" && (
                <>
                  <button
                    onClick={handleUpdate}
                    className="flex items-center gap-2 rounded bg-red-600 px-3 py-1.5 text-[10px] font-black uppercase text-white shadow-lg transition-all hover:bg-red-700 hover:scale-105 active:scale-95"
                  >
                    <Download className="h-3 w-3" />
                    Apply Patch
                  </button>
                  <button
                    onClick={() => setUpdate(null)}
                    className="flex items-center gap-2 rounded border border-white/10 px-3 py-1.5 text-[10px] font-bold uppercase text-slate-400 transition-all hover:bg-white/5 hover:text-slate-300"
                  >
                    Ignore
                  </button>
                </>
              )}
            </div>
          </div>

          <button 
            onClick={() => setUpdate(null)}
            className="text-slate-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Tactical Decorative Elements */}
        <div className="absolute right-0 top-0 opacity-10">
          <RefreshCw className="h-16 w-16 -mr-4 -mt-4 text-white rotate-12" />
        </div>
      </div>
    </div>
  );
}
