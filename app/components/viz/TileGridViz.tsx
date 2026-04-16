import { useEffect, useRef } from "react";

const TILES = [
  { name: "Jake", project: "AI code editor", tokens: "12M", x: 15, y: 38, size: 48 },
  { name: "Priya", project: "chatbot SaaS", tokens: "8.2M", x: 68, y: 52, size: 40 },
  { name: "Emil", project: "doc parser", tokens: "3.1M", x: 50, y: 30, size: 28 },
  { name: "Yuki", project: "voice agent", tokens: "6.7M", x: 82, y: 38, size: 35 },
  { name: "Sam", project: "search engine", tokens: "4.5M", x: 48, y: 28, size: 30 },
  { name: "Wei", project: "trading bot", tokens: "15M", x: 78, y: 42, size: 52 },
  { name: "Omar", project: "content gen", tokens: "5.1M", x: 60, y: 46, size: 32 },
];

const EMPTY = { x: 65, y: 50 };

export function TileGridViz() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const timeRef = useRef(0);
  const mouseRef = useRef({ x: 0, y: 0 });

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

      // Grid
      for (let i = 0; i < 20; i++) {
        ctx!.beginPath();
        ctx!.moveTo(0, (i / 20) * h);
        ctx!.lineTo(w, (i / 20) * h);
        ctx!.strokeStyle = "rgba(255,255,255,0.02)";
        ctx!.lineWidth = 1;
        ctx!.stroke();
        ctx!.beginPath();
        ctx!.moveTo((i / 20) * w, 0);
        ctx!.lineTo((i / 20) * w, h);
        ctx!.stroke();
      }

      // Tile cards
      let hovered: typeof TILES[0] | null = null;
      for (const tile of TILES) {
        const tx = (tile.x / 100) * w;
        const ty = (tile.y / 100) * h;
        const s = tile.size * 0.55;
        const half = s / 2;

        const mx = mouseRef.current.x;
        const my = mouseRef.current.y;
        const isHovered = mx > tx - half && mx < tx + half && my > ty - half && my < ty + half;
        const lift = isHovered ? -3 : 0;

        if (isHovered) hovered = tile;

        // Card shadow
        ctx!.fillStyle = "rgba(249, 115, 22, 0.05)";
        ctx!.beginPath();
        ctx!.roundRect(tx - half + 2, ty - half + 2 + lift, s, s, 4);
        ctx!.fill();

        // Card
        ctx!.fillStyle = isHovered ? "rgba(249, 115, 22, 0.15)" : "rgba(255,255,255,0.04)";
        ctx!.strokeStyle = isHovered ? "rgba(249, 115, 22, 0.4)" : "rgba(255,255,255,0.08)";
        ctx!.lineWidth = 1;
        ctx!.beginPath();
        ctx!.roundRect(tx - half, ty - half + lift, s, s, 4);
        ctx!.fill();
        ctx!.stroke();

        // Name
        ctx!.fillStyle = isHovered ? "#fff" : "rgba(255,255,255,0.5)";
        ctx!.font = `bold ${Math.max(8, s * 0.22)}px Inter, system-ui`;
        ctx!.textAlign = "center";
        ctx!.fillText(tile.name, tx, ty - 2 + lift);

        // Tokens
        ctx!.fillStyle = isHovered ? "rgba(249,115,22,0.9)" : "rgba(249,115,22,0.5)";
        ctx!.font = `${Math.max(7, s * 0.18)}px Inter, system-ui`;
        ctx!.fillText(tile.tokens, tx, ty + s * 0.18 + lift);
      }

      // Empty "+" spot
      const ex = (EMPTY.x / 100) * w;
      const ey = (EMPTY.y / 100) * h;
      const pulse = Math.sin(timeRef.current * 0.05) * 0.5 + 0.5;
      const es = 28;

      ctx!.strokeStyle = `rgba(249, 115, 22, ${0.2 + pulse * 0.2})`;
      ctx!.lineWidth = 1.5;
      ctx!.setLineDash([4, 4]);
      ctx!.beginPath();
      ctx!.roundRect(ex - es / 2, ey - es / 2, es, es, 4);
      ctx!.stroke();
      ctx!.setLineDash([]);

      // Plus sign
      ctx!.strokeStyle = `rgba(249, 115, 22, ${0.3 + pulse * 0.3})`;
      ctx!.lineWidth = 2;
      ctx!.beginPath();
      ctx!.moveTo(ex - 5, ey);
      ctx!.lineTo(ex + 5, ey);
      ctx!.moveTo(ex, ey - 5);
      ctx!.lineTo(ex, ey + 5);
      ctx!.stroke();

      ctx!.textAlign = "start";

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
