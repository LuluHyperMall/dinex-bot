"use client";
import { cn } from "@/lib/utils";

type Status = "idle" | "listening" | "speaking" | "thinking";

export function RajFace({ status, name = "Raj" }: { status: Status; name?: string }) {
  return (
    <div className="flex flex-col items-center">
      <div className="relative">
        {/* outer ripple */}
        <div
          className={cn(
            "absolute inset-0 rounded-full",
            status === "listening" && "animate-ping bg-sky-500/20",
            status === "speaking" && "animate-ping bg-green-500/20"
          )}
        />
        <div
          className={cn(
            "relative h-44 w-44 rounded-full raj-orb flex items-center justify-center transition-all duration-300",
            status === "idle" && "animate-raj-pulse",
            status === "listening" && "listening scale-105",
            status === "speaking" && "speaking",
            status === "thinking" && "opacity-90"
          )}
        >
          {/* eyes + mouth */}
          <div className="flex flex-col items-center gap-3">
            <div className="flex gap-6">
              <span className={cn("block h-5 w-5 rounded-full bg-white/95", status === "thinking" && "animate-pulse")} />
              <span className={cn("block h-5 w-5 rounded-full bg-white/95", status === "thinking" && "animate-pulse")} />
            </div>
            <div
              className={cn(
                "h-2 rounded-full bg-white/90 transition-all",
                status === "speaking" ? "w-12 h-5 animate-pulse" : "w-10",
                status === "listening" && "w-6"
              )}
            />
          </div>
        </div>
      </div>
      <div className="mt-5 text-center">
        <div className="text-2xl font-bold tracking-tight">{name}</div>
        <div className="text-sm text-white/50">
          {status === "idle" && "Tap the mic & talk to me"}
          {status === "listening" && "Sun raha hoon… 🎙️"}
          {status === "thinking" && "Soch raha hoon…"}
          {status === "speaking" && "Bol raha hoon…"}
        </div>
      </div>
    </div>
  );
}
