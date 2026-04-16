import { NightSkyViz } from "../components/viz/NightSkyViz";
import { RealMapViz } from "../components/viz/RealMapViz";
import { useState } from "react";

export function meta() {
  return [{ title: "TokenMap — Viz Variants" }];
}

// Only 2 good variants now — real map + night sky
const VARIANTS = [
  {
    id: "A",
    label: "Dark Map (MapLibre)",
    desc: "Real dark world map. Glowing dots at cities, sized by usage. Hover for tile cards. Pulsing empty dot at your location.",
    cta: "Your spot is empty.",
    button: "Claim it",
    component: RealMapViz,
  },
  {
    id: "B",
    label: "Night Sky",
    desc: "Earth shaped as a night sky. Each dev is a star. Brighter = more tokens. Named stars glow as novas. Yours is dim.",
    cta: "",
    button: "Light up",
    component: NightSkyViz,
  },
];

export default function Variants() {
  const [active, setActive] = useState(0);
  const V = VARIANTS[active];
  const Comp = V.component;

  return (
    <div className="min-h-screen flex flex-col">
      {/* Tab selector */}
      <nav className="px-4 py-4 border-b border-white/5">
        <div className="max-w-6xl mx-auto flex items-center gap-2">
          {VARIANTS.map((v, i) => (
            <button
              key={v.id}
              onClick={() => setActive(i)}
              className={`px-5 py-2 rounded-lg text-[13px] font-medium whitespace-nowrap transition ${
                i === active
                  ? "bg-orange-500 text-white"
                  : "bg-white/5 text-white/40 hover:text-white hover:bg-white/10"
              }`}
            >
              {v.id}: {v.label}
            </button>
          ))}
        </div>
      </nav>

      {/* Description */}
      <div className="px-4 py-2.5 border-b border-white/[0.03]">
        <div className="max-w-6xl mx-auto">
          <p className="text-white/25 text-[12px]">{V.desc}</p>
        </div>
      </div>

      {/* Viz */}
      <div className="flex-1 relative" style={{ minHeight: "70vh" }}>
        <Comp key={V.id} />

        {/* CTA overlay */}
        <div className="absolute bottom-8 left-0 right-0 text-center pointer-events-none">
          {V.cta && (
            <p className="text-white/40 text-[15px] mb-3">{V.cta}</p>
          )}
          <button className="pointer-events-auto px-6 py-3 rounded-lg bg-orange-500 hover:bg-orange-600 text-white font-medium text-[15px] transition shadow-lg shadow-orange-500/20">
            {V.button}
          </button>
        </div>
      </div>

      {/* Footer */}
      <footer className="px-4 py-3 border-t border-white/5">
        <div className="max-w-6xl mx-auto text-center text-white/12 text-[11px]">
          Pick your favorite.
        </div>
      </footer>
    </div>
  );
}
