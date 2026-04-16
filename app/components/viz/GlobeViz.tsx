import { useEffect, useRef } from "react";

const CITIES = [
  { name: "Jake", city: "SF", tokens: "12M", lat: 37.7, lng: -122.4, size: 18 },
  { name: "Priya", city: "BLR", tokens: "8.2M", lat: 12.9, lng: 77.5, size: 14 },
  { name: "Emil", city: "BER", tokens: "3.1M", lat: 52.5, lng: 13.4, size: 10 },
  { name: "Yuki", city: "TKY", tokens: "6.7M", lat: 35.6, lng: 139.7, size: 12 },
  { name: "Sam", city: "LON", tokens: "4.5M", lat: 51.5, lng: -0.1, size: 11 },
  { name: "Ana", city: "SP", tokens: "2.8M", lat: -23.5, lng: -46.6, size: 9 },
  { name: "Wei", city: "SH", tokens: "15M", lat: 31.2, lng: 121.4, size: 20 },
  { name: "Omar", city: "DXB", tokens: "5.1M", lat: 25.2, lng: 55.2, size: 11 },
];

function latLngToXY(lat: number, lng: number, w: number, h: number, rotation: number) {
  const adjLng = ((lng + rotation + 540) % 360) - 180;
  const x = ((adjLng + 180) / 360) * w;
  const y = ((90 - lat) / 180) * h;
  return { x, y, visible: adjLng > -90 && adjLng < 90 };
}

export function GlobeViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rotationRef = useRef(0);
  const hoverRef = useRef<typeof CITIES[0] | null>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
  const pulsesRef = useRef<{ x: number; y: number; age: number; maxAge: number }[]>([]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame: number;
    let pulseTimer = 0;

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
      const cx = w / 2;
      const cy = h / 2;
      const r = Math.min(w, h) * 0.42;

      ctx!.clearRect(0, 0, w, h);

      // Globe circle
      const grad = ctx!.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, "rgba(30, 30, 50, 0.8)");
      grad.addColorStop(1, "rgba(10, 10, 20, 0.3)");
      ctx!.beginPath();
      ctx!.arc(cx, cy, r, 0, Math.PI * 2);
      ctx!.fillStyle = grad;
      ctx!.fill();
      ctx!.strokeStyle = "rgba(255,255,255,0.06)";
      ctx!.lineWidth = 1;
      ctx!.stroke();

      // Grid lines on globe
      for (let lat = -60; lat <= 60; lat += 30) {
        const y = cy - (lat / 90) * r;
        const xSpread = Math.sqrt(r * r - (y - cy) * (y - cy));
        ctx!.beginPath();
        ctx!.moveTo(cx - xSpread, y);
        ctx!.lineTo(cx + xSpread, y);
        ctx!.strokeStyle = "rgba(255,255,255,0.03)";
        ctx!.stroke();
      }

      rotationRef.current += 0.15;

      // Pulses
      pulseTimer++;
      if (pulseTimer % 90 === 0) {
        const city = CITIES[Math.floor(Math.random() * CITIES.length)];
        const pos = latLngToXY(city.lat, city.lng, w, h, rotationRef.current);
        if (pos.visible) {
          const dx = pos.x - cx;
          const dy = pos.y - cy;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < r) {
            pulsesRef.current.push({ x: pos.x, y: pos.y, age: 0, maxAge: 60 });
          }
        }
      }

      pulsesRef.current = pulsesRef.current.filter((p) => {
        p.age++;
        const progress = p.age / p.maxAge;
        const pulseR = 5 + progress * 30;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, pulseR, 0, Math.PI * 2);
        ctx!.strokeStyle = `rgba(249, 115, 22, ${0.6 * (1 - progress)})`;
        ctx!.lineWidth = 2 * (1 - progress);
        ctx!.stroke();
        return p.age < p.maxAge;
      });

      // City dots
      let hoveredCity: typeof CITIES[0] | null = null;
      for (const city of CITIES) {
        const pos = latLngToXY(city.lat, city.lng, w, h, rotationRef.current);
        if (!pos.visible) continue;

        const dx = pos.x - cx;
        const dy = pos.y - cy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > r - 5) continue;

        const fade = 1 - dist / r;
        const dotSize = city.size * 0.4 * fade;

        // Glow
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, dotSize * 2, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(249, 115, 22, ${0.15 * fade})`;
        ctx!.fill();

        // Dot
        ctx!.beginPath();
        ctx!.arc(pos.x, pos.y, dotSize, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(249, 115, 22, ${0.8 * fade})`;
        ctx!.fill();

        // Check hover
        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        if (Math.sqrt((mx - pos.x) ** 2 + (my - pos.y) ** 2) < dotSize + 10) {
          hoveredCity = city;
        }
      }

      hoverRef.current = hoveredCity;

      // Hover card
      if (hoveredCity) {
        const pos = latLngToXY(hoveredCity.lat, hoveredCity.lng, w, h, rotationRef.current);
        const cardX = pos.x + 15;
        const cardY = pos.y - 35;
        const cardW = 120;
        const cardH = 52;

        ctx!.fillStyle = "rgba(0,0,0,0.85)";
        ctx!.strokeStyle = "rgba(249,115,22,0.3)";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.roundRect(cardX, cardY, cardW, cardH, 6);
        ctx!.fill();
        ctx!.stroke();

        ctx!.fillStyle = "#fff";
        ctx!.font = "bold 12px Inter, system-ui";
        ctx!.fillText(`${hoveredCity.name} · ${hoveredCity.city}`, cardX + 8, cardY + 18);
        ctx!.fillStyle = "rgba(249,115,22,0.9)";
        ctx!.font = "11px Inter, system-ui";
        ctx!.fillText(`${hoveredCity.tokens} tokens`, cardX + 8, cardY + 34);
        ctx!.fillStyle = "rgba(255,255,255,0.3)";
        ctx!.fillText("✓ Verified", cardX + 8, cardY + 46);
      }

      frame = requestAnimationFrame(draw);
    }

    function onMouseMove(e: MouseEvent) {
      const rect = canvas!.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    }

    canvas.addEventListener("mousemove", onMouseMove);
    draw();

    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("resize", resize);
      canvas.removeEventListener("mousemove", onMouseMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="w-full h-full cursor-crosshair"
      style={{ display: "block" }}
    />
  );
}
