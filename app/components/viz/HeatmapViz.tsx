import { useEffect, useRef } from "react";

const HOTSPOTS = [
  { city: "SF", x: 15, y: 38, heat: 1.0 },
  { city: "NYC", x: 22, y: 33, heat: 0.7 },
  { city: "LON", x: 48, y: 28, heat: 0.6 },
  { city: "BER", x: 50, y: 30, heat: 0.4 },
  { city: "BLR", x: 68, y: 52, heat: 0.85 },
  { city: "TKY", x: 82, y: 38, heat: 0.7 },
  { city: "SH", x: 78, y: 42, heat: 0.9 },
  { city: "SP", x: 28, y: 68, heat: 0.3 },
  { city: "SYD", x: 85, y: 68, heat: 0.35 },
  { city: "DXB", x: 60, y: 46, heat: 0.45 },
  { city: "SEA", x: 13, y: 32, heat: 0.5 },
  { city: "AUS", x: 17, y: 42, heat: 0.4 },
];

// Your city — cold
const YOUR_CITY = { city: "YOU", x: 65, y: 48, heat: 0 };

export function HeatmapViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame: number;

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      const rect = canvas!.getBoundingClientRect();
      canvas!.width = rect.width * dpr;
      canvas!.height = rect.height * dpr;
      ctx!.scale(dpr, dpr);
    }
    resize();
    window.addEventListener("resize", resize);

    function draw() {
      const w = canvas!.getBoundingClientRect().width;
      const h = canvas!.getBoundingClientRect().height;
      timeRef.current++;

      ctx!.clearRect(0, 0, w, h);

      // Heatmap blobs
      for (const spot of HOTSPOTS) {
        const sx = (spot.x / 100) * w;
        const sy = (spot.y / 100) * h;
        const flicker = Math.sin(timeRef.current * 0.03 + spot.x) * 0.1;
        const intensity = spot.heat + flicker;
        const radius = 20 + intensity * 50;

        const grad = ctx!.createRadialGradient(sx, sy, 0, sx, sy, radius);

        if (intensity > 0.7) {
          // Hot — orange to transparent
          grad.addColorStop(0, `rgba(255, 200, 50, ${intensity * 0.5})`);
          grad.addColorStop(0.3, `rgba(249, 115, 22, ${intensity * 0.35})`);
          grad.addColorStop(1, "rgba(249, 115, 22, 0)");
        } else if (intensity > 0.4) {
          // Warm
          grad.addColorStop(0, `rgba(249, 115, 22, ${intensity * 0.35})`);
          grad.addColorStop(1, "rgba(249, 115, 22, 0)");
        } else {
          // Cool
          grad.addColorStop(0, `rgba(59, 130, 246, ${intensity * 0.3})`);
          grad.addColorStop(1, "rgba(59, 130, 246, 0)");
        }

        ctx!.beginPath();
        ctx!.arc(sx, sy, radius, 0, Math.PI * 2);
        ctx!.fillStyle = grad;
        ctx!.fill();

        // City label
        ctx!.fillStyle = `rgba(255, 255, 255, ${0.2 + intensity * 0.3})`;
        ctx!.font = `${10 + intensity * 3}px Inter, system-ui`;
        ctx!.textAlign = "center";
        ctx!.fillText(spot.city, sx, sy + radius + 14);
      }

      // Your city — cold, pulsing
      const yx = (YOUR_CITY.x / 100) * w;
      const yy = (YOUR_CITY.y / 100) * h;
      const pulse = Math.sin(timeRef.current * 0.06) * 0.5 + 0.5;

      // Cold blue dot
      ctx!.beginPath();
      ctx!.arc(yx, yy, 4 + pulse * 2, 0, Math.PI * 2);
      ctx!.fillStyle = `rgba(100, 150, 255, ${0.3 + pulse * 0.2})`;
      ctx!.fill();

      // Dashed ring
      ctx!.beginPath();
      ctx!.arc(yx, yy, 18 + pulse * 5, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(100, 150, 255, ${0.15 + pulse * 0.1})`;
      ctx!.lineWidth = 1;
      ctx!.setLineDash([4, 4]);
      ctx!.stroke();
      ctx!.setLineDash([]);

      // "❄ cold" label
      ctx!.fillStyle = `rgba(150, 180, 255, ${0.4 + pulse * 0.2})`;
      ctx!.font = "11px Inter, system-ui";
      ctx!.textAlign = "center";
      ctx!.fillText("your city: cold", yx, yy + 32);

      ctx!.textAlign = "start"; // reset

      frame = requestAnimationFrame(draw);
    }

    draw();
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return <canvas ref={canvasRef} className="w-full h-full" style={{ display: "block" }} />;
}
