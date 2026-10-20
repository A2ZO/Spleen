import { cn } from "@/lib/cn";

/** Little turntable: the tonearm drops onto the record and it spins while `playing`. */
export function Turntable({ playing, className }: { playing: boolean; className?: string }) {
  return (
    <svg aria-hidden="true" viewBox="0 0 64 48" className={className}>
      <rect x="1" y="2" width="62" height="44" rx="3" className="fill-wood-dark" />
      <rect x="1" y="2" width="62" height="44" rx="3" fill="none" className="stroke-wood" />
      <circle cx="26" cy="24" r="19" className="fill-surface-raised" />
      <g
        className={cn(playing && "animate-record")}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
      >
        <circle cx="26" cy="24" r="17" className="fill-vinyl" />
        <circle
          cx="26"
          cy="24"
          r="13"
          fill="none"
          strokeWidth="0.5"
          className="stroke-vinyl-groove"
        />
        <circle
          cx="26"
          cy="24"
          r="9.5"
          fill="none"
          strokeWidth="0.5"
          className="stroke-vinyl-groove"
        />
        <circle cx="26" cy="24" r="5" className="fill-accent" />
        <rect x="25.4" y="19.5" width="1.2" height="3" className="fill-accent-fg" opacity="0.7" />
      </g>
      <circle cx="54" cy="9" r="3.2" className="fill-star" />
      <g
        className="transition-transform duration-700 ease-spleen"
        style={{
          transformOrigin: "54px 9px",
          transform: playing ? "rotate(0deg)" : "rotate(-32deg)",
        }}
      >
        <path
          d="M54 9 L52 30 L44 36"
          fill="none"
          strokeWidth="1.6"
          strokeLinecap="round"
          className="stroke-star"
        />
        <rect
          x="40.5"
          y="34"
          width="5"
          height="3.4"
          rx="0.6"
          transform="rotate(-35 43 35.7)"
          className="fill-star"
        />
      </g>
    </svg>
  );
}
