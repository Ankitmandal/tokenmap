import { useEffect, useRef, useState } from "react";

// Demo tiles shown when no real data exists
const DEMO_TILES = [
  { name: "Jake", project: "AI code editor", tokens: "12M", lat: 37.78, lng: -122.4, size: 22 },
  { name: "Priya", project: "chatbot platform", tokens: "8.2M", lat: 12.97, lng: 77.59, size: 17 },
  { name: "Wei", project: "trading signals", tokens: "15M", lat: 31.23, lng: 121.47, size: 26 },
  { name: "Yuki", project: "voice agents", tokens: "6.7M", lat: 35.68, lng: 139.69, size: 14 },
  { name: "Sam", project: "search engine", tokens: "4.5M", lat: 51.5, lng: -0.12, size: 12 },
  { name: "Emil", project: "doc parser", tokens: "3.1M", lat: 52.52, lng: 13.4, size: 10 },
  { name: "Ana", project: "content gen", tokens: "2.8M", lat: -23.55, lng: -46.63, size: 9 },
  { name: "Omar", project: "image pipeline", tokens: "5.1M", lat: 25.2, lng: 55.27, size: 13 },
  { name: "Leo", project: "code review bot", tokens: "7.3M", lat: 40.77, lng: -73.97, size: 15 },
  { name: "Raj", project: "RAG pipeline", tokens: "9.5M", lat: 19.07, lng: 72.87, size: 19 },
  { name: "Chen", project: "agent framework", tokens: "11M", lat: 39.9, lng: 116.4, size: 21 },
  { name: "Alex", project: "copilot clone", tokens: "8.9M", lat: 34.05, lng: -118.24, size: 18 },
  { name: "Sara", project: "AI tutor", tokens: "3.8M", lat: 47.6, lng: -122.33, size: 10 },
  { name: "Kim", project: "summarizer", tokens: "6.2M", lat: 37.56, lng: 126.97, size: 14 },
  { name: "Nina", project: "email AI", tokens: "2.4M", lat: 59.33, lng: 18.06, size: 8 },
  { name: "Tom", project: "meeting notes", tokens: "5.5M", lat: -22.9, lng: -43.17, size: 13 },
];

interface TileData {
  name: string;
  city?: string;
  project?: string;
  tokens: string;
  lat: number;
  lng: number;
  size: number;
  verified?: boolean;
  provider?: string;
}

export function RealMapViz() {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current || mapRef.current) return;

    let cancelled = false;

    (async () => {
      try {
        const [mod, tilesRes] = await Promise.all([
          import("leaflet"),
          fetch("/api/tiles").then(r => r.json()).catch(() => null),
        ]);

        const L = mod.default ?? mod;
        setReady(false);

        if (cancelled || !containerRef.current) return;

        let tiles: TileData[] = [...DEMO_TILES];

        if (tilesRes?.tiles?.length > 0) {
          const realTiles: TileData[] = tilesRes.tiles.map((t: any) => ({
            name: t.name,
            city: t.city,
            tokens: t.tokensFormatted,
            lat: t.lat,
            lng: t.lng,
            size: t.size,
            verified: t.verified,
            provider: t.provider,
          }));
          tiles = [...realTiles, ...DEMO_TILES];
        }

        // Fix default icon paths
        delete (L.Icon.Default.prototype as any)._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: "",
          iconUrl: "",
          shadowUrl: "",
        });

        const map = L.map(containerRef.current, {
          center: [20, 20],
          zoom: 2,
          minZoom: 2,
          maxZoom: 12,
          zoomControl: false,
          attributionControl: false,
          scrollWheelZoom: true,
          doubleClickZoom: true,
          dragging: true,
          maxBounds: [[-85, -300], [85, 300]],
          maxBoundsViscosity: 0.8,
        });

        // Expose map instance for external zoom controls
        (window as any).__tokenmap = map;

        L.tileLayer("https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png", {
          subdomains: "abcd",
        }).addTo(map);

        mapRef.current = map;

        // Add tiles with staggered animation
        tiles.forEach((tile, index) => {
          setTimeout(() => {
            if (cancelled) return;
            addTileMarker(L, map, tile);
          }, index * 80); // stagger each dot by 80ms
        });

        // Inject styles
        const css = document.createElement("style");
        css.textContent = `
          @keyframes youPing {
            0% { transform: translate(-50%,-50%) scale(0.8); opacity: 0.6; }
            100% { transform: translate(-50%,-50%) scale(3.5); opacity: 0; }
          }
          @keyframes youDash {
            0% { stroke-dashoffset: 0; }
            100% { stroke-dashoffset: -20; }
          }
          @keyframes youFadeIn {
            0% { opacity: 0; transform: translateY(4px); }
            100% { opacity: 1; transform: translateY(0); }
          }
          @keyframes markerPop {
            0% { transform: scale(0); opacity: 0; }
            60% { transform: scale(1.3); opacity: 1; }
            100% { transform: scale(1); opacity: 1; }
          }
          @keyframes pulseGlow {
            0%, 100% { box-shadow: 0 0 8px rgba(249,115,22,0.6), 0 0 20px rgba(249,115,22,0.2); }
            50% { box-shadow: 0 0 14px rgba(249,115,22,0.8), 0 0 35px rgba(249,115,22,0.3); }
          }
          @keyframes ripple {
            0% { transform: scale(0.8); opacity: 0.6; }
            100% { transform: scale(3); opacity: 0; }
          }
          .custom-popup .leaflet-popup-content-wrapper { background:none!important;box-shadow:none!important;padding:0!important;border-radius:0!important; }
          .custom-popup .leaflet-popup-tip { display:none!important; }
          .custom-popup .leaflet-popup-content { margin:0!important; }
          .leaflet-container { background:#0a0a1e!important; }
          .leaflet-control-zoom { display: none!important; }
        `;
        document.head.appendChild(css);

        setReady(true);

        // Cinematic sequence: drift → fly to user's location
        let userInteracted = false;

        // 1. Slow drift for 3 seconds
        const driftInterval = setInterval(() => {
          if (!userInteracted) map.panBy([0.15, 0], { animate: false });
        }, 50);

        // Stop drift on any user interaction
        map.on("mousedown touchstart zoomstart", () => {
          userInteracted = true;
          clearInterval(driftInterval);
        });

        // 2. After 3s, stop drift and fly to user's location
        setTimeout(() => {
          clearInterval(driftInterval);
          if (userInteracted) return;

          // Try geolocation
          if (navigator.geolocation) {
            navigator.geolocation.getCurrentPosition(
              (pos) => {
                if (userInteracted) return;
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;

                // Fly to user
                map.flyTo([lat, lng], 5, { duration: 2.5, easeLinearity: 0.25 });

                // Add "you" marker after fly completes
                setTimeout(() => {
                  addYouMarker(L, map, lat, lng);
                }, 2800);
              },
              () => {
                if (!userInteracted) {
                  map.flyTo([30, 0], 3, { duration: 2, easeLinearity: 0.25 });
                }
              },
              { timeout: 3000 }
            );
          }
        }, 3000);

      } catch (err: any) {
        console.error("Leaflet error:", err);
        setReady(true);
        if (containerRef.current) {
          containerRef.current.innerHTML = `<div style="color:red;padding:20px;font-size:12px">Error: ${err?.message || err}</div>`;
        }
      }
    })();

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div ref={containerRef} style={{ width: "100%", height: "100%", minHeight: "500px" }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: "#0a0a1e" }}>
          <span className="text-white/20 text-sm animate-pulse">Loading map...</span>
        </div>
      )}
    </div>
  );
}

function addTileMarker(L: any, map: any, tile: TileData) {
  const s = tile.size;
  const isReal = !!tile.city;
  const isVerified = tile.verified;
  const isLarge = s >= 18;

  // Ripple ring for large dots
  const ripple = isLarge
    ? `<div style="position:absolute;top:50%;left:50%;width:${s}px;height:${s}px;transform:translate(-50%,-50%);border-radius:50%;border:1px solid rgba(249,115,22,0.3);animation:ripple 3s ease-out infinite"></div>`
    : '';

  const showLabel = s >= 14;
  const label = showLabel
    ? `<div style="position:absolute;left:${s + 4}px;top:50%;transform:translateY(-50%);white-space:nowrap;font-family:Inter,system-ui;pointer-events:none;background:rgba(0,0,0,0.6);padding:1px 6px;border-radius:4px;backdrop-filter:blur(4px)">
        <span style="font-size:10px;font-weight:600;color:rgba(255,255,255,0.8)">${tile.name}</span>
        <span style="font-size:9px;color:rgba(249,115,22,0.7);margin-left:3px">${tile.tokens}</span>
      </div>`
    : '';

  const totalW = showLabel ? s + 100 : s;

  const icon = L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:${s}px;height:${s}px;animation:markerPop 0.5s cubic-bezier(0.34,1.56,0.64,1) forwards">
        <div style="position:absolute;inset:-${s * 0.8}px;border-radius:50%;background:radial-gradient(circle,rgba(249,115,22,0.2) 0%,transparent 70%)"></div>
        ${ripple}
        <div style="width:${s}px;height:${s}px;border-radius:50%;background:rgba(249,115,22,${isReal ? '0.95' : '0.8'});animation:pulseGlow 3s ease-in-out infinite;cursor:pointer;transition:transform 0.2s" onmouseenter="this.style.transform='scale(1.4)'" onmouseleave="this.style.transform='scale(1)'"></div>
        ${label}
      </div>
    `,
    iconSize: [totalW, s],
    iconAnchor: [s / 2, s / 2],
  });

  const verifiedBadge = isVerified
    ? `<div style="color:rgba(74,222,128,0.7);font-size:10px;margin-top:4px">✓ verified</div>`
    : `<div style="color:rgba(255,255,255,0.2);font-size:10px;margin-top:4px">${isReal ? '◇ unverified' : '✓ verified'}</div>`;

  const providerBadge = tile.provider
    ? `<div style="display:inline-block;padding:1px 6px;border-radius:4px;background:rgba(249,115,22,0.15);color:rgba(249,115,22,0.7);font-size:9px;margin-top:3px">${tile.provider}</div>`
    : '';

  L.marker([tile.lat, tile.lng], { icon })
    .bindPopup(
      `<div style="background:#000;border:1px solid rgba(249,115,22,0.3);border-radius:8px;padding:10px 14px;color:#fff;font-family:Inter,system-ui;min-width:120px">
        <div style="font-weight:700;font-size:13px">${tile.name}</div>
        <div style="color:#f97316;font-size:12px;margin-top:2px">${tile.tokens} tokens</div>
        ${tile.city ? `<div style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:2px">${tile.city}</div>` : ''}
        ${tile.project ? `<div style="color:rgba(255,255,255,0.35);font-size:11px;margin-top:2px">${tile.project}</div>` : ''}
        ${providerBadge}
        ${verifiedBadge}
      </div>`,
      {
        className: "custom-popup",
        closeButton: false,
        offset: [0, -5],
      }
    )
    .addTo(map);
}

function addYouMarker(L: any, map: any, lat: number, lng: number) {
  const icon = L.divIcon({
    className: "",
    html: `
      <div style="position:relative;width:56px;height:56px;animation:youFadeIn 0.6s ease-out forwards">
        <!-- Ping ripple -->
        <div style="position:absolute;top:50%;left:50%;width:20px;height:20px;border-radius:50%;background:rgba(249,115,22,0.25);animation:youPing 2.5s ease-out infinite"></div>
        <div style="position:absolute;top:50%;left:50%;width:20px;height:20px;border-radius:50%;background:rgba(249,115,22,0.2);animation:youPing 2.5s ease-out infinite 0.8s"></div>
        <!-- Dashed circle -->
        <svg width="56" height="56" viewBox="0 0 56 56" style="position:absolute;inset:0">
          <circle cx="28" cy="28" r="22" fill="none" stroke="rgba(249,115,22,0.5)" stroke-width="1.5" stroke-dasharray="5 3" style="animation:youDash 8s linear infinite"/>
        </svg>
        <!-- Center dot -->
        <div style="position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);width:10px;height:10px;border-radius:50%;border:2px solid rgba(249,115,22,0.8);background:rgba(249,115,22,0.15)"></div>
        <!-- Label -->
        <div style="position:absolute;left:62px;top:50%;transform:translateY(-50%);white-space:nowrap;font-family:Inter,system-ui;animation:youFadeIn 0.8s ease-out forwards 0.3s;opacity:0">
          <div style="background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);border:1px solid rgba(249,115,22,0.25);border-radius:8px;padding:6px 10px">
            <div style="font-size:11px;font-weight:600;color:rgba(255,255,255,0.85)">This spot's yours.</div>
            <div style="font-size:10px;color:rgba(249,115,22,0.7);margin-top:2px">Take it.</div>
          </div>
        </div>
      </div>
    `,
    iconSize: [180, 56],
    iconAnchor: [28, 28],
  });

  L.marker([lat, lng], { icon, zIndexOffset: 1000 }).addTo(map);
}
