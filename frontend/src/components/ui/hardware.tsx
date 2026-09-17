import { useState, useEffect, useRef, type MouseEvent } from "react";
import { Activity, Power } from "lucide-react";

interface RotaryProps {
  size?: number;        // outer ring diameter
  knobSize?: number;    // knob diameter
  positions?: string[]; // labels around the ring (default 4)
  onChange?: (index: number) => void;
}

/**
 * Interactive rotary selector.
 * Drag vertically (or use buttons) to cycle through positions.
 * Each snap triggers the haptic micro-shake animation.
 */
export function RotarySelector({ size = 200, knobSize = 110, positions = ["HW", "PCB", "FW", "3D"], onChange }: RotaryProps) {
  const [pos, setPos] = useState(0);
  const [snapKey, setSnapKey] = useState(0);
  const startY = useRef<number | null>(null);
  const total = positions.length;
  const angle = (pos * 360) / total;

  const snap = (next: number) => {
    const wrapped = ((next % total) + total) % total;
    setPos(wrapped);
    setSnapKey((k) => k + 1);
    onChange?.(wrapped);
  };

  const onMouseDown = (e: MouseEvent) => {
    startY.current = e.clientY;
  };
  useEffect(() => {
    const onMove = (e: globalThis.MouseEvent) => {
      if (startY.current == null) return;
      const dy = startY.current - e.clientY;
      if (Math.abs(dy) > 24) {
        snap(pos + (dy > 0 ? 1 : -1));
        startY.current = e.clientY;
      }
    };
    const onUp = () => (startY.current = null);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  });

  const LEDS = Array.from({ length: total });

  return (
    <div className="flex flex-col items-center gap-4">
      <div
        className="relative"
        style={{ width: size, height: size }}
      >
        {/* outer ring */}
        <div
          className="absolute inset-0 rounded-full"
          style={{
            background: "var(--bezel-deep)",
            boxShadow: "var(--neo-in-deep)",
            border: "1px solid rgba(0, 0, 0, 0.50)",
          }}
        />
        {/* sweeping ring */}
        <div
          className="absolute inset-1 rounded-full rotary-sweep"
          style={{
            background: "conic-gradient(from 0deg, transparent 0%, rgba(255, 255, 255, 0.20) 30%, transparent 60%, rgba(255, 255, 255, 0.10) 80%, transparent 100%)",
            opacity: 0.6,
          }}
        />
        {/* LED ring + labels */}
        {LEDS.map((_, i) => {
          const a = (i / total) * 2 * Math.PI - Math.PI / 2;
          const r = size / 2 - 18;
          const x = Math.cos(a) * r + size / 2;
          const y = Math.sin(a) * r + size / 2;
          const active = i === pos;
          return (
            <div key={i} className="absolute" style={{ left: x - 14, top: y - 14, width: 28, height: 28 }}>
              <div
                className="absolute inset-0 m-auto h-2.5 w-2.5 rounded-full"
                style={{
                  background: active ? "var(--text)" : "#1a1d23",
                  boxShadow: active
                    ? "0 0 8px rgba(255, 255, 255, 0.50), 0 0 20px rgba(255, 255, 255, 0.20)"
                    : "inset 1px 1px 2px rgba(0, 0, 0, 0.7)",
                  transform: active ? "scale(1.4)" : "scale(1)",
                  transition: "all 200ms ease-out",
                }}
              />
              <span
                className="tech-label absolute -bottom-4 left-1/2 -translate-x-1/2"
                style={{ color: active ? "var(--text)" : "var(--text)" }}
              >
                {positions[i]}
              </span>
            </div>
          );
        })}
        {/* the knob */}
        <div
          key={snapKey}
          className="knob-snap absolute left-1/2 top-1/2 flex items-center justify-center"
          style={{
            width: knobSize,
            height: knobSize,
            transform: `translate(-50%, -50%) rotate(${angle}deg)`,
            borderRadius: "50%",
            background: "linear-gradient(180deg, #4a5260 0%, #353c47 50%, #1f242c 100%)",
            boxShadow:
              "0 2px 0 rgba(255, 255, 255, 0.08) inset, 0 -2px 0 rgba(0, 0, 0, 0.40) inset, 0 6px 14px rgba(0, 0, 0, 0.50)",
            border: "1px solid rgba(0, 0, 0, 0.40)",
            cursor: "grab",
            userSelect: "none",
          }}
          onMouseDown={onMouseDown}
          title="Drag up / down to rotate"
        >
          {/* finger indent */}
          <div
            className="absolute left-1/2 top-3 h-7 w-12 -translate-x-1/2 rounded-2xl"
            style={{
              background: "linear-gradient(180deg, #15181d 0%, #2a3039 100%)",
              boxShadow: "inset 2px 2px 4px rgba(0, 0, 0, 0.7), inset -1px -1px 2px rgba(80, 90, 105, 0.20)",
            }}
          />
          {/* indicator line */}
          <div
            className="absolute left-1/2 top-2 h-3 w-0.5 -translate-x-1/2"
            style={{
              background: "var(--text)",
              boxShadow: "0 0 6px rgba(255, 255, 255, 0.80)",
              transform: "translate(-50%, 0)",
            }}
          />
        </div>
      </div>

      {/* position steppers */}
      <div className="flex items-center gap-2">
        <button onClick={() => snap(pos - 1)} className="btn-secondary rounded-2xl px-3 py-1 text-xs font-bold">◀</button>
        <div className="lcd px-4 py-1.5">
          <span className="tech-label tech-label-hi">POS {String(pos + 1).padStart(2, "0")} / {String(total).padStart(2, "0")}</span>
        </div>
        <button onClick={() => snap(pos + 1)} className="btn-secondary rounded-2xl px-3 py-1 text-xs font-bold">▶</button>
      </div>
    </div>
  );
}

/**
 * Live waveform display — 8 vertical bars animated as oscilloscope.
 */
export function Waveform({ bars = 16, className = "" }: { bars?: number; className?: string }) {
  return (
    <div className={"lcd flex h-20 items-end justify-around px-3 py-3 " + className}>
      {Array.from({ length: bars }).map((_, i) => (
        <div
          key={i}
          className="wave-bar w-1 rounded-t-sm"
          style={{
            background: "linear-gradient(180deg, var(--hi) 0%, rgba(255, 255, 255, 0.30) 100%)",
            boxShadow: "0 0 4px rgba(255, 255, 255, 0.40)",
            height: "60%",
          }}
        />
      ))}
    </div>
  );
}

/**
 * Power button with hard-press depress + breathing LED ring.
 */
export function PowerButton({ on, onClick }: { on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={"btn-primary relative h-14 w-32 rounded-xl " + (on ? "" : "")}
      style={{ paddingTop: 0, paddingBottom: 0 }}
    >
      <div className="flex items-center justify-center gap-2">
        <Power size={18} />
        <span className="font-extrabold tracking-wider">{on ? "ON" : "OFF"}</span>
      </div>
      <span
        className={"led absolute -top-1 -right-1 " + (on ? "led-on" : "")}
        style={{ position: "absolute" }}
      />
    </button>
  );
}

/**
 * Animated stat card — value counts up, label pulses.
 */
export function StatReadout({ label, value, suffix = "", unit = "" }: { label: string; value: number; suffix?: string; unit?: string }) {
  const [shown, setShown] = useState(0);
  useEffect(() => {
    let raf = 0;
    const start = performance.now();
    const dur = 800;
    const loop = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(value * eased);
      if (p < 1) raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [value]);
  return (
    <div className="card p-4 text-center">
      <p className="tech-label" style={{ color: "var(--text)" }}>{label}</p>
      <p
        className="mt-2 font-extrabold tabular-nums"
        style={{ color: "var(--text)", fontSize: "clamp(1.5rem, 2.5vw, 2rem)", fontFamily: "Outfit, sans-serif" }}
      >
        {shown.toFixed(value < 10 ? 2 : 0)}{suffix}
        <span className="ml-1 text-xs" style={{ color: "var(--text)" }}>{unit}</span>
      </p>
      <Activity size={12} className="mx-auto mt-1" style={{ color: "var(--text)" }} />
    </div>
  );
}