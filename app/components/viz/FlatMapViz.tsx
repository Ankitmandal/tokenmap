import { useEffect, useRef } from "react";

const TILES = [
  { name: "Jake", city: "SF", tokens: "12M", x: 15, y: 38, size: 18, color: "249,115,22" },
  { name: "Priya", city: "BLR", tokens: "8.2M", x: 68, y: 52, size: 14, color: "34,197,94" },
  { name: "Emil", city: "BER", tokens: "3.1M", x: 50, y: 30, size: 10, color: "59,130,246" },
  { name: "Yuki", city: "TKY", tokens: "6.7M", x: 82, y: 38, size: 12, color: "168,85,247" },
  { name: "Sam", city: "LON", tokens: "4.5M", x: 48, y: 28, size: 11, color: "249,115,22" },
  { name: "Ana", city: "SP", tokens: "2.8M", x: 28, y: 68, size: 9, color: "236,72,153" },
  { name: "Wei", city: "SH", tokens: "15M", x: 78, y: 42, size: 20, color: "249,115,22" },
  { name: "Omar", city: "DXB", tokens: "5.1M", x: 60, y: 46, size: 11, color: "34,197,94" },
];

// Empty spot for visitor (roughly India by default)
const EMPTY_SPOT = { x: 65, y: 48 };

export function FlatMapViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });
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

    // Simplified continent outlines as paths (percentage based)
    const continents = [
      // North America
      [
        [8, 20], [12, 15], [18, 14], [25, 18], [28, 25],
        [25, 30], [22, 35], [18, 40], [12, 38], [8, 30],
      ],
      // South America
      [[22, 52], [28, 48], [32, 55], [30, 65], [27, 72], [22, 70], [20, 60]],
      // Europe
      [[44, 18], [48, 16], [54, 18], [56, 25], [52, 30], [46, 28], [44, 22]],
      // Africa
      [[46, 35], [52, 32], [58, 38], [56, 52], [52, 62], [46, 58], [44, 45]],
      // Asia
      [[58, 15], [70, 12], [82, 18], [88, 28], [85, 40], [75, 45], [65, 42], [58, 30]],
      // Australia
      [[78, 60], [88, 58], [90, 65], [85, 72], [78, 68]],
    ];

    function draw() {
      const w = canvas!.getBoundingClientRect().width;
      const h = canvas!.getBoundingClientRect().height;
      timeRef.current++;

      ctx!.clearRect(0, 0, w, h);

      // Draw continents
      for (const cont of continents) {
        ctx!.beginPath();
        ctx!.moveTo((cont[0][0] / 100) * w, (cont[0][1] / 100) * h);
        for (let i = 1; i < cont.length; i++) {
          ctx!.lineTo((cont[i][0] / 100) * w, (cont[i][1] / 100) * h);
        }
        ctx!.closePath();
        ctx!.fillStyle = "rgba(255,255,255,0.02)";
        ctx!.fill();
        ctx!.strokeStyle = "rgba(255,255,255,0.05)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
      }

      // Tiles
      let hovered: typeof TILES[0] | null = null;
      for (const tile of TILES) {
        const tx = (tile.x / 100) * w;
        const ty = (tile.y / 100) * h;
        const s = tile.size * 0.5;

        // Glow
        const glowGrad = ctx!.createRadialGradient(tx, ty, 0, tx, ty, s * 3);
        glowGrad.addColorStop(0, `rgba(${tile.color}, 0.2)`);
        glowGrad.addColorStop(1, `rgba(${tile.color}, 0)`);
        ctx!.beginPath();
        ctx!.arc(tx, ty, s * 3, 0, Math.PI * 2);
        ctx!.fillStyle = glowGrad;
        ctx!.fill();

        // Dot
        ctx!.beginPath();
        ctx!.arc(tx, ty, s, 0, Math.PI * 2);
        ctx!.fillStyle = `rgba(${tile.color}, 0.85)`;
        ctx!.fill();

        // Hover check
        const dx = mouseRef.current.x - tx;
        const dy = mouseRef.current.y - ty;
        if (Math.sqrt(dx * dx + dy * dy) < s + 12) {
          hovered = tile;
        }
      }

      // Empty pulsing spot
      const ex = (EMPTY_SPOT.x / 100) * w;
      const ey = (EMPTY_SPOT.y / 100) * h;
      const pulse = Math.sin(timeRef.current * 0.05) * 0.5 + 0.5;
      const pulseR = 6 + pulse * 4;

      ctx!.beginPath();
      ctx!.arc(ex, ey, pulseR + 8, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(249, 115, 22, ${0.15 + pulse * 0.15})`;
      ctx!.lineWidth = 1;
      ctx!.setLineDash([3, 3]);
      ctx!.stroke();
      ctx!.setLineDash([]);

      ctx!.beginPath();
      ctx!.arc(ex, ey, pulseR, 0, Math.PI * 2);
      ctx!.strokeStyle = `rgba(249, 115, 22, ${0.3 + pulse * 0.3})`;
      ctx!.lineWidth = 1.5;
      ctx!.stroke();

      // "This one's yours" label
      ctx!.fillStyle = `rgba(249, 115, 22, ${0.4 + pulse * 0.2})`;
      ctx!.font = "11px Inter, system-ui";
      ctx!.fillText("← yours", ex + pulseR + 14, ey + 4);

      // Hover card
      if (hovered) {
        const tx = (hovered.x / 100) * w;
        const ty = (hovered.y / 100) * h;
        const cardX = tx + 18;
        const cardY = ty - 40;

        ctx!.fillStyle = "rgba(0,0,0,0.9)";
        ctx!.strokeStyle = `rgba(${hovered.color}, 0.4)`;
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.roundRect(cardX, cardY, 130, 52, 6);
        ctx!.fill();
        ctx!.stroke();

        ctx!.fillStyle = "#fff";
        ctx!.font = "bold 12px Inter, system-ui";
        ctx!.fillText(`${hovered.name} · ${hovered.city}`, cardX + 8, cardY + 18);
        ctx!.fillStyle = `rgba(${hovered.color}, 0.9)`;
        ctx!.font = "11px Inter, system-ui";
        ctx!.fillText(`${hovered.tokens} tokens`, cardX + 8, cardY + 34);
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

  return <canvas ref={canvasRef} className="w-full h-full cursor-crosshair" style={{ display: "block" }} />;
}
