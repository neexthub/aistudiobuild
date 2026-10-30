import { useEffect, useState } from "react";
import { checkStatus } from "@/lib/ai";

export function StatusDot() {
  const [s, setS] = useState<"checking" | "on" | "off">("checking");
  useEffect(() => {
    let live = true;
    const run = () => checkStatus().then((r) => live && setS(r.ok ? "on" : "off"));
    run();
    const t = setInterval(run, 30000);
    return () => { live = false; clearInterval(t); };
  }, []);
  const color = s === "on" ? "bg-success" : s === "off" ? "bg-destructive" : "bg-warning";
  const label = s === "on" ? "AI সার্ভার চালু" : s === "off" ? "AI সার্ভার বন্ধ" : "যাচাই হচ্ছে…";
  return (
    <span className="inline-flex items-center gap-2 rounded-full glass px-3 py-1 text-xs text-muted-foreground">
      <span className="relative flex h-2 w-2">
        {s !== "off" && <span className={`absolute inline-flex h-full w-full animate-ping rounded-full opacity-60 ${color}`} />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${color}`} />
      </span>
      {label}
    </span>
  );
}

export function Logo() {
  return (
    <span className="font-display text-lg font-bold tracking-tight">
      Next<span className="text-primary">Build</span>
    </span>
  );
}
