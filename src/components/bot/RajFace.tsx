"use client";
import { cn } from "@/lib/utils";

type Status = "idle" | "listening" | "speaking" | "thinking";

const LABEL: Record<Status, string> = {
  idle: "Boliye, main sun raha hoon",
  listening: "Sun raha hoon…",
  thinking: "Soch raha hoon…",
  speaking: "Bol raha hoon…",
};

// Cute screen-robot face (Dinex). Expressions change with status.
export function RajFace({ status, name = "Dinex" }: { status: Status; name?: string }) {
  const glow =
    status === "listening" ? "bg-sky-300/50" : status === "speaking" ? "bg-emerald-300/50" : status === "thinking" ? "bg-amber-300/40" : "bg-orange-200/40";

  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        <div className={cn("absolute -inset-4 rounded-[2.5rem] blur-2xl transition-colors", glow)} />
        {/* robot head */}
        <div className="relative rounded-[2.2rem] bg-gradient-to-b from-white to-[#efe9e0] p-2.5 shadow-[0_20px_50px_-15px_rgba(0,0,0,0.4)]">
          {/* face screen */}
          <div className="flex h-36 w-48 items-center justify-center rounded-[1.7rem] bg-[#14161b]">
            <Face status={status} />
          </div>
        </div>
      </div>
      <div className="mt-4 text-center">
        <div className="text-2xl font-black tracking-tight text-[#2b2b2b]">{name}</div>
        <div className="text-sm text-[#8b8378]">{LABEL[status]}</div>
      </div>
    </div>
  );
}

function Face({ status }: { status: Status }) {
  return (
    <svg width="150" height="92" viewBox="0 0 150 92" className="overflow-visible">
      {/* eyes */}
      {status === "idle" ? (
        // happy curved eyes  ^   ^
        <>
          <path d="M28 44 q12 -20 24 0" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none" />
          <path d="M98 44 q12 -20 24 0" stroke="white" strokeWidth="7" strokeLinecap="round" fill="none" />
        </>
      ) : status === "thinking" ? (
        // looking-up squint
        <>
          <rect x="32" y="34" width="20" height="8" rx="4" fill="white" />
          <rect x="98" y="34" width="20" height="8" rx="4" fill="white" />
        </>
      ) : (
        // round alert eyes (listening / speaking) with subtle blink-ready shape
        <>
          <circle cx="42" cy="40" r="11" fill="white" className={status === "listening" ? "animate-pulse" : ""} />
          <circle cx="108" cy="40" r="11" fill="white" className={status === "listening" ? "animate-pulse" : ""} />
        </>
      )}

      {/* mouth */}
      {status === "speaking" ? (
        <ellipse cx="75" cy="70" rx="16" ry="9" fill="white" className="origin-center animate-raj-pulse" />
      ) : status === "thinking" ? (
        <>
          <circle cx="64" cy="70" r="3.2" fill="white" className="animate-pulse" />
          <circle cx="75" cy="70" r="3.2" fill="white" className="animate-pulse" />
          <circle cx="86" cy="70" r="3.2" fill="white" className="animate-pulse" />
        </>
      ) : status === "listening" ? (
        <circle cx="75" cy="70" r="5" fill="white" />
      ) : (
        // idle smile
        <path d="M55 66 q20 18 40 0" stroke="white" strokeWidth="6" strokeLinecap="round" fill="none" />
      )}
    </svg>
  );
}
