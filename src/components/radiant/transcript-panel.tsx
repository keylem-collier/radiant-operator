import type { TranscriptTurn } from "@/lib/radiant/types";

type TranscriptPanelProps = {
  turns: TranscriptTurn[];
};

export function TranscriptPanel({ turns }: TranscriptPanelProps) {
  if (turns.length === 0) {
    return (
      <p className="text-sm text-zinc-500">
        Start talking or type a message to begin.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      {turns.map((turn) => (
        <div
          key={turn.id}
          className={`rounded-lg px-3 py-2 text-sm leading-relaxed ${
            turn.speaker === "user"
              ? "bg-zinc-800 text-zinc-100"
              : "bg-violet-950/60 text-violet-100"
          }`}
        >
          <span className="mb-1 block text-xs font-semibold uppercase tracking-wide opacity-60">
            {turn.speaker === "user" ? "You" : "Advisor"}
          </span>
          {turn.text}
        </div>
      ))}
    </div>
  );
}
