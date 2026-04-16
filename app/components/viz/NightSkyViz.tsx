import { useEffect, useRef } from "react";

// World map outline as longitude/latitude → x/y percentage mapping
// Stars cluster in continent shapes for a "night sky shaped like Earth" effect
const LAND_ZONES = [
  // North America (dense)
  { x: [8, 26], y: [18, 42], weight: 3 },
  // South America
  { x: [20, 32], y: [50, 78], weight: 2 },
  // Europe
  { x: [44, 56], y: [16, 36], weight: 3 },
  // Africa
  { x: [44, 58], y: [36, 68], weight: 2 },
  // Asia (dense)
  { x: [58, 86], y: [14, 48], weight: 4 },
  // Southeast Asia
  { x: [72, 82], y: [45, 55], weight: 1 },
  // Australia
  { x: [78, 90], y: [58, 74], weight: 1 },
];

interface Star {
  x: number;
  y: number;
  size: number;
  baseBrightness: number;
  phase: number;
  speed: number;
  hue: number; // orange-warm spectrum
  name?: string;
  tokens?: string;
}

function createStar(named?: { name: string; tokens: string; x: number; y: number; size: number }): Star {
  if (named) {
    return {
      x: named.x, y: named.y, size: named.size,
      baseBrightness: 0.8 + Math.random() * 0.2,
      phase: Math.random() * Math.PI * 2,
      speed: 0.015 + Math.random() * 0.02,
      hue: 25 + Math.random() * 15,
      name: named.name, tokens: named.tokens,
    };
  }

  // Pick a weighted random zone
  const totalWeight = LAND_ZONES.reduce((s, z) => s + z.weight, 0);
  let r = Math.random() * totalWeight;
  let zone = LAND_ZONES[0];
  for (const z of LAND_ZONES) {
    r -= z.weight;
    if (r <= 0) { zone = z; break; }
  }

  return {
    x: zone.x[0] + Math.random() * (zone.x[1] - zone.x[0]),
    y: zone.y[0] + Math.random() * (zone.y[1] - zone.y[0]),
    size: 0.5 + Math.random() * 2.5,
    baseBrightness: 0.15 + Math.random() * 0.45,
    phase: Math.random() * Math.PI * 2,
    speed: 0.01 + Math.random() * 0.03,
    hue: 20 + Math.random() * 30,
  };
}

const NAMED_STARS = [
  { name: "Jake · SF", tokens: "12M", x: 14, y: 37, size: 5 },
  { name: "Priya · BLR", tokens: "8.2M", x: 68, y: 50, size: 4 },
  { name: "Wei · Shanghai", tokens: "15M", x: 78, y: 40, size: 6 },
  { name: "Yuki · Tokyo", tokens: "6.7M", x: 83, y: 36, size: 3.5 },
  { name: "Sam · London", tokens: "4.5M", x: 48, y: 27, size: 3 },
  { name: "Leo · NYC", tokens: "7.3M", x: 22, y: 32, size: 4 },
  { name: "Raj · Mumbai", tokens: "9.5M", x: 66, y: 47, size: 4.5 },
  { name: "Alex · LA", tokens: "8.9M", x: 11, y: 40, size: 4.2 },
];

export function NightSkyViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const starsRef = useRef<Star[]>([]);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    // Create stars
    const bgStars = Array.from({ length: 200 }, () => createStar());
    const namedStars = NAMED_STARS.map((s) => createStar(s));
    starsRef.current = [...bgStars, ...namedStars];

    let frame: number;
    let w = 0, h = 0;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      w = rect.width;
      h = rect.height;
      canvas!.width = w * dpr;
      canvas!.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener("resize", resize);

    // Fill initial background
    ctx!.fillStyle = "#030308";
    ctx!.fillRect(0, 0, w, h);

    function draw() {
      timeRef.current++;
      const t = timeRef.current;

      // Slow fade (creates trail/persistence)
      ctx!.fillStyle = "rgba(3, 3, 8, 0.08)";
      ctx!.fillRect(0, 0, w, h);

      // Occasionally add a new star (twinkle in)
      if (t % 60 === 0 && starsRef.current.length < 300) {
        const s = createStar();
        s.baseBrightness = 0;
        starsRef.current.push(s);
        // Fade in
        const fadeIn = setInterval(() => {
          s.baseBrightness = Math.min(s.baseBrightness + 0.01, 0.15 + Math.random() * 0.35);
          if (s.baseBrightness >= 0.15) clearInterval(fadeIn);
        }, 30);
      }

      for (const star of starsRef.current) {
        const sx = (star.x / 100) * w;
        const sy = (star.y / 100) * h;
        const twinkle = Math.sin(t * star.speed + star.phase);
        const b = star.baseBrightness * (0.6 + twinkle * 0.4);
        const s = star.size * (0.85 + twinkle * 0.25);

        if (b < 0.02) continue;

        // Named stars get big glow
        if (star.name) {
          // Outer glow
          ctx!.globalCompositeOperation = "lighter";
          const g1 = ctx!.createRadialGradient(sx, sy, 0, sx, sy, s * 10);
          g1.addColorStop(0, `hsla(${star.hue}, 90%, 70%, ${b * 0.12})`);
          g1.addColorStop(0.5, `hsla(${star.hue}, 80%, 50%, ${b * 0.04})`);
          g1.addColorStop(1, "transparent");
          ctx!.beginPath();
          ctx!.arc(sx, sy, s * 10, 0, Math.PI * 2);
          ctx!.fillStyle = g1;
          ctx!.fill();

          // Mid glow
          const g2 = ctx!.createRadialGradient(sx, sy, 0, sx, sy, s * 4);
          g2.addColorStop(0, `hsla(${star.hue}, 95%, 80%, ${b * 0.5})`);
          g2.addColorStop(1, "transparent");
          ctx!.beginPath();
          ctx!.arc(sx, sy, s * 4, 0, Math.PI * 2);
          ctx!.fillStyle = g2;
          ctx!.fill();

          ctx!.globalCompositeOperation = "source-over";

          // Core
          const g3 = ctx!.createRadialGradient(sx, sy, 0, sx, sy, s);
          g3.addColorStop(0, `hsla(40, 100%, 95%, ${b})`);
          g3.addColorStop(1, `hsla(${star.hue}, 90%, 60%, ${b * 0.4})`);
          ctx!.beginPath();
          ctx!.arc(sx, sy, s, 0, Math.PI * 2);
          ctx!.fillStyle = g3;
          ctx!.fill();

          // Name label
          ctx!.fillStyle = `rgba(255, 220, 180, ${b * 0.45})`;
          ctx!.font = "500 10px Inter, system-ui, sans-serif";
          ctx!.textAlign = "center";
          ctx!.fillText(star.name!, sx, sy + s * 10 + 14);
          ctx!.fillStyle = `hsla(${star.hue}, 80%, 60%, ${b * 0.35})`;
          ctx!.font = "9px Inter, system-ui, sans-serif";
          ctx!.fillText(star.tokens!, sx, sy + s * 10 + 26);
          ctx!.textAlign = "start";
        } else {
          // Background star — simple but with glow
          ctx!.globalCompositeOperation = "lighter";
          const g = ctx!.createRadialGradient(sx, sy, 0, sx, sy, s * 2.5);
          g.addColorStop(0, `hsla(${star.hue}, 70%, 80%, ${b * 0.5})`);
          g.addColorStop(1, "transparent");
          ctx!.beginPath();
          ctx!.arc(sx, sy, s * 2.5, 0, Math.PI * 2);
          ctx!.fillStyle = g;
          ctx!.fill();
          ctx!.globalCompositeOperation = "source-over";

          // Core dot
          ctx!.beginPath();
          ctx!.arc(sx, sy, s * 0.6, 0, Math.PI * 2);
          ctx!.fillStyle = `hsla(40, 60%, 90%, ${b * 0.8})`;
          ctx!.fill();
        }
      }

      // "Your" dim star — pulsing
      const yx = (65 / 100) * w;
      const yy = (48 / 100) * h;
      const yp = Math.sin(t * 0.04) * 0.5 + 0.5;

      ctx!.globalCompositeOperation = "lighter";
      const yg = ctx!.createRadialGradient(yx, yy, 0, yx, yy, 8);
      yg.addColorStop(0, `rgba(120, 160, 255, ${0.15 + yp * 0.15})`);
      yg.addColorStop(1, "transparent");
      ctx!.beginPath();
      ctx!.arc(yx, yy, 8, 0, Math.PI * 2);
      ctx!.fillStyle = yg;
      ctx!.fill();
      ctx!.globalCompositeOperation = "source-over";

      ctx!.beginPath();
      ctx!.arc(yx, yy, 1.5, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(140, 170, 255, ${0.4 + yp * 0.4})`;
      ctx!.fill();

      ctx!.fillStyle = `rgba(160, 190, 255, ${0.25 + yp * 0.15})`;
      ctx!.font = "10px Inter, system-ui, sans-serif";
      ctx!.textAlign = "center";
      ctx!.fillText("make it brighter", yx, yy + 22);
      ctx!.textAlign = "start";

      frame = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full"
      style={{ display: "block", background: "#030308" }}
    />
  );
}
