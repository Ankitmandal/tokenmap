import { useEffect, useRef, useState } from "react";

interface Dot {
  id: number;
  x: number;
  y: number;
  size: number;
  delay: number;
  color: string;
}

const COLORS = [
  "rgba(249, 115, 22, 0.8)", // orange
  "rgba(34, 197, 94, 0.7)", // green
  "rgba(59, 130, 246, 0.7)", // blue
  "rgba(168, 85, 247, 0.7)", // purple
  "rgba(236, 72, 153, 0.6)", // pink
];

// Rough world map continent coordinates (as % of container)
const LAND_ZONES = [
  // North America
  { x: [8, 28], y: [15, 45] },
  // South America
  { x: [18, 32], y: [50, 85] },
  // Europe
  { x: [42, 55], y: [15, 40] },
  // Africa
  { x: [42, 58], y: [40, 75] },
  // Asia
  { x: [55, 85], y: [12, 50] },
  // Australia
  { x: [75, 88], y: [60, 78] },
];

function randomInZone(): { x: number; y: number } {
  const zone = LAND_ZONES[Math.floor(Math.random() * LAND_ZONES.length)];
  return {
    x: zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]),
    y: zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]),
  };
}

export function AnimatedMap() {
  const [dots, setDots] = useState<Dot[]>([]);
  const counterRef = useRef(0);

  useEffect(() => {
    // Generate initial dots
    const initial: Dot[] = Array.from({ length: 40 }, (_, i) => {
      const pos = randomInZone();
      return {
        id: i,
        x: pos.x,
        y: pos.y,
        size: 3 + Math.random() * 8,
        delay: Math.random() * 2,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
    });
    setDots(initial);
    counterRef.current = 40;

    // Add new dots periodically
    const interval = setInterval(() => {
      const pos = randomInZone();
      const newDot: Dot = {
        id: counterRef.current++,
        x: pos.x,
        y: pos.y,
        size: 3 + Math.random() * 12,
        delay: 0,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      };
      setDots((prev) => [...prev.slice(-60), newDot]);
    }, 800);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative w-full h-full overflow-hidden rounded-2xl border border-white/10 bg-gray-900/50">
      {/* Grid lines */}
      <div className="absolute inset-0 opacity-[0.04]">
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={`h-${i}`}
            className="absolute w-full h-px bg-white"
            style={{ top: `${(i + 1) * 5}%` }}
          />
        ))}
        {Array.from({ length: 20 }, (_, i) => (
          <div
            key={`v-${i}`}
            className="absolute h-full w-px bg-white"
            style={{ left: `${(i + 1) * 5}%` }}
          />
        ))}
      </div>

      {/* Dots */}
      {dots.map((dot) => (
        <div
          key={dot.id}
          className="absolute rounded-full map-dot"
          style={{
            left: `${dot.x}%`,
            top: `${dot.y}%`,
            width: dot.size,
            height: dot.size,
            backgroundColor: dot.color,
            animationDelay: `${dot.delay}s`,
            boxShadow: `0 0 ${dot.size * 2}px ${dot.color}`,
          }}
        />
      ))}

      {/* Overlay label */}
      <div className="absolute bottom-4 left-4 text-xs text-white/30 font-mono">
        LIVE MAP PREVIEW
      </div>
    </div>
  );
}
