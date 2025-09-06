import React, { useEffect, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Slider } from "@/components/ui/slider";

// =============================================
// Axolotl Rancher — React Mini-Game (spritesheet-ready)
// =============================================
// This file fully replaces the previous version and fixes a build error
// caused by an incomplete tileToFrame() function and missing component code.
// It also adds: robust spritesheet loader (logs + preview),
// pixel-perfect Sprite rendering, and tiny runtime self-tests.

// ------------------ Utilities -----------------
const rand = (min, max) => Math.random() * (max - min) + min;
const choice = (arr) => arr[Math.floor(Math.random() * arr.length)];
const clamp = (n, a, b) => Math.max(a, Math.min(b, n));

// ------------------ Constants -----------------
const GRID_W = 14; // columns
const GRID_H = 9;  // rows
const TILE_SIZE = 56; // px per tile
const BOARD_W = GRID_W * TILE_SIZE;
const BOARD_H = GRID_H * TILE_SIZE;

const COLORS = [
  { key: "pink", name: "Leucistic Pink", hex: "#ff9ecb", rarity: 1.0, base: 60 },
  { key: "wild", name: "Wild Brown", hex: "#8a6f4d", rarity: 0.9, base: 70 },
  { key: "gold", name: "Golden", hex: "#ffd166", rarity: 0.6, base: 100 },
  { key: "blue", name: "Blue", hex: "#76a9fa", rarity: 0.3, base: 150 },
];

const TILE_TYPES = {
  water: { key: "water", name: "Water", price: 0 },
  plant: { key: "plant", name: "Plant", price: 10 },
  rock: { key: "rock", name: "Rock", price: 15 },
  cave: { key: "cave", name: "Hidey Cave", price: 25 },
  filter: { key: "filter", name: "Filter", price: 20 },
};

const TOOLBAR = [TILE_TYPES.plant, TILE_TYPES.rock, TILE_TYPES.cave, TILE_TYPES.filter];

// ------------- Spritesheet Loader -------------
function useSpriteSheet() {
  const [spriteUrl, setSpriteUrl] = useState(null);
  const [img, setImg] = useState(null);
  const [status, setStatus] = useState("idle"); // idle | loading | loaded | error
  const [error, setError] = useState(null);
  const [settings, setSettings] = useState({
    cell: 64,         // cell size in the sheet
    paddingX: 32,     // left margin before first cell
    paddingY: 32,     // top margin before first row
    gapX: 24,         // horizontal gap between cells
    gapY: 32,         // vertical gap between rows
    cols: 4,          // sprites per row
  });

  useEffect(() => {
    if (!spriteUrl) return;
    setStatus("loading");
    setError(null);
    const image = new Image();
    image.onload = () => {
      console.log("SPRITESHEET LOADED", image.width, image.height, spriteUrl);
      setImg(image);
      setStatus("loaded");
    };
    image.onerror = (e) => {
      console.error("SPRITESHEET ERROR", e, spriteUrl);
      setStatus("error");
      setError("Failed to load image. Is it a valid PNG/WebP?");
    };
    image.src = spriteUrl;
    return () => {
      // revoke old blob URLs to avoid leaks
      if (spriteUrl.startsWith("blob:")) {
        try { URL.revokeObjectURL(spriteUrl); } catch {}
      }
    };
  }, [spriteUrl]);

  const rect = (row, col) => {
    const { cell, paddingX, paddingY, gapX, gapY } = settings;
    return {
      x: Math.round(paddingX + col * (cell + gapX)),
      y: Math.round(paddingY + row * (cell + gapY)),
      w: settings.cell,
      h: settings.cell,
    };
  };

  // default frame mapping for a 3x4 sheet layout
  const frames = {
    // Row 0: customers
    customer_0: rect(0, 0),
    customer_1: rect(0, 1),
    customer_2: rect(0, 2),
    customer_3: rect(0, 3),
    // Row 1: axolotl colors
    axo_pink: rect(1, 0),
    axo_gold: rect(1, 1),
    axo_wild: rect(1, 2),
    axo_blue: rect(1, 3),
    // Row 2: tiles
    tile_plant: rect(2, 0),
    tile_rock: rect(2, 1),
    tile_water: rect(2, 2),
    tile_cave: rect(2, 3),
  };

  return { spriteUrl, setSpriteUrl, img, status, error, frames, settings, setSettings };
}

// ------------- Sprite Primitive (div background) -------------
const Sprite = ({ sheet, frameKey, w, h, flipX = false, style }) => {
  const f = sheet?.frames?.[frameKey];
  if (!sheet?.img || !f) return null;
  const bgPos = `-${f.x}px -${f.y}px`;
  return (
    <div
      className="absolute"
      style={{
        width: w ?? f.w,
        height: h ?? f.h,
        backgroundImage: `url(${sheet.spriteUrl})`,
        backgroundPosition: bgPos,
        backgroundRepeat: "no-repeat",
        backgroundSize: `${sheet.img.width}px ${sheet.img.height}px`, // pixel-perfect slicing
        imageRendering: "pixelated",
        transform: `scale(${flipX ? -1 : 1}, 1)`,
        transformOrigin: "center",
        ...style,
      }}
    />
  );
};

// ------------- Fallback SVG/Emoji -------------
const AxolotlSVG = ({ color, x, y, dirX }) => {
  const c = COLORS.find((c) => c.key === color) || COLORS[0];
  const scaleX = dirX < 0 ? -1 : 1;
  return (
    <svg width={36} height={24} viewBox="0 0 36 24" style={{ transform: `translate(${x}px, ${y}px) scale(${scaleX},1)` }} className="absolute">
      <ellipse cx="12" cy="12" rx="12" ry="9" fill={c.hex} stroke="#00000020" />
      <path d="M18 12 Q 30 3 34 12 Q 30 21 18 12 Z" fill={c.hex} opacity="0.85" />
      <circle cx="8" cy="10" r="1.4" fill="#333" />
      <g stroke={c.hex} strokeWidth="2" strokeLinecap="round">
        <line x1="4" y1="6" x2="0" y2="2" />
        <line x1="4" y1="18" x2="0" y2="22" />
      </g>
    </svg>
  );
};

const CustomerEmoji = ({ x, y }) => (
  <div className="absolute text-xs" style={{ transform: `translate(${x}px, ${y}px)` }}>
    <div className="w-8 h-8 rounded-full bg-white/90 shadow flex items-center justify-center border">
      <span className="text-lg">🧑‍🌾</span>
    </div>
  </div>
);

// ------------- Main Game Component -------------
export default function AxolotlRancher() {
  // economy
  const [money, setMoney] = useState(150);
  const [day, setDay] = useState(1);
  const [speed, setSpeed] = useState(1); // game speed multiplier

  // board
  const [tiles, setTiles] = useState(() => Array.from({ length: GRID_H }, () => Array.from({ length: GRID_W }, () => "water")));
  const [selectedTool, setSelectedTool] = useState(null);

  // actors
  const [axos, setAxos] = useState(() => initialAxos());
  const [customers, setCustomers] = useState(() => []);
  const [selectedAxoId, setSelectedAxoId] = useState(null);

  // spritesheet
  const spriteSheet = useSpriteSheet();

  const loopRef = useRef(null);
  const lastTs = useRef(0);

  // spawn a customer now and then
  useEffect(() => {
    const spawn = () => {
      const desired = choice(COLORS).key;
      const patience = rand(18, 32); // seconds before they leave
      const budget = Math.round(rand(80, 240));
      setCustomers((prev) => [
        ...prev,
        {
          id: Math.random().toString(36).slice(2),
          x: BOARD_W + rand(20, 100),
          y: BOARD_H - 64 - rand(0, 80),
          vx: -rand(10, 30),
          desired,
          budget,
          patience,
          skin: Math.floor(Math.random() * 4),
        },
      ]);
    };
    spawn();
    const t = setInterval(spawn, 22000 / speed);
    return () => clearInterval(t);
  }, [speed]);

  // day progression
  useEffect(() => {
    const t = setInterval(() => setDay((d) => d + 1), 60000 / speed); // new day each minute
    return () => clearInterval(t);
  }, [speed]);

  // main loop
  useEffect(() => {
    const step = (ts) => {
      const dt = Math.min(0.05, (ts - lastTs.current) / 1000) * speed;
      lastTs.current = ts;

      setAxos((prev) => prev.map((a) => {
        let vx = clamp(a.vx + rand(-8, 8) * dt, -28, 28);
        let vy = clamp(a.vy + rand(-8, 8) * dt, -24, 24);
        let x = a.x + vx * dt;
        let y = a.y + vy * dt;
        if (x < 4) { x = 4; vx = Math.abs(vx); }
        if (x > BOARD_W - 36) { x = BOARD_W - 36; vx = -Math.abs(vx); }
        if (y < 4) { y = 4; vy = Math.abs(vy); }
        if (y > BOARD_H - 24) { y = BOARD_H - 24; vy = -Math.abs(vy); }
        return { ...a, x, y, vx, vy };
      }));

      setCustomers((prev) => prev.map((c) => ({ ...c, x: c.x + c.vx * dt, patience: c.patience - dt })).filter((c) => c.x > -120 && c.patience > 0));

      loopRef.current = requestAnimationFrame(step);
    };
    loopRef.current = requestAnimationFrame(step);
    return () => cancelAnimationFrame(loopRef.current);
  }, [speed]);

  // habitat score (0..1)
  const habitatScore = useMemo(() => {
    const counts = { plant: 0, rock: 0, cave: 0, filter: 0 };
    tiles.forEach((row) => row.forEach((t) => { if (counts[t] !== undefined) counts[t]++; }));
    const total = GRID_W * GRID_H;
    const p = counts.plant / total; const r = counts.rock / total; const c = counts.cave / total; const f = counts.filter / total;
    let score = 0.35 * (1 - Math.exp(-3 * p)) + 0.25 * (1 - Math.exp(-3 * r)) + 0.25 * (1 - Math.exp(-4 * c)) + 0.15 * (1 - Math.exp(-2 * f));
    return clamp(score, 0, 1.0);
  }, [tiles]);

  // per-axolotl derived values
  const axoWithDerived = useMemo(() => {
    return axos.map((a) => {
      const cx = Math.floor((a.x + 18) / TILE_SIZE);
      const cy = Math.floor((a.y + 12) / TILE_SIZE);
      const nearby = neighborhood(tiles, cx, cy, 1);
      const counts = countTiles(nearby);
      const localScore = 0.4 * sat(counts.plant, 0, 3) + 0.25 * sat(counts.rock, 0, 2) + 0.25 * sat(counts.cave, 0, 1) + 0.1 * sat(counts.filter, 0, 2);
      const happy = clamp(0.8 + 0.6 * localScore + 0.4 * habitatScore, 0.6, 1.8);
      const colorMeta = COLORS.find((c) => c.key === a.color) || COLORS[0];
      const baseValue = colorMeta.base;
      const value = Math.round(baseValue * happy);
      return { ...a, happy, value };
    });
  }, [axos, tiles, habitatScore]);

  const selectedAxo = useMemo(() => axoWithDerived.find((a) => a.id === selectedAxoId) || null, [axoWithDerived, selectedAxoId]);

  // ------------- Actions -------------
  const placeTile = (gx, gy) => {
    if (!selectedTool) return;
    const t = selectedTool.key;
    if (tiles[gy][gx] === t) return;
    const price = TILE_TYPES[t].price;
    if (money < price) return;
    setMoney((m) => m - price);
    setTiles((prev) => prev.map((row, y) => row.map((cell, x) => (x === gx && y === gy ? t : cell))));
  };

  const addEgg = () => {
    const cost = 50;
    if (money < cost) return;
    setMoney((m) => m - cost);
    setAxos((prev) => [...prev, mkAxo({ x: rand(60, BOARD_W - 80), y: rand(30, BOARD_H - 60) })]);
  };

  const sellToCustomer = (custId, axoId) => {
    const cust = customers.find((c) => c.id === custId);
    const axo = axoWithDerived.find((a) => a.id === axoId);
    if (!cust || !axo) return;
    const match = cust.desired === axo.color;
    const price = Math.min(Math.round(axo.value * (match ? 1.3 : 1.0)), cust.budget);
    setMoney((m) => m + price);
    setAxos((prev) => prev.filter((a) => a.id !== axoId));
    setCustomers((prev) => prev.filter((c) => c.id !== custId));
    setSelectedAxoId(null);
  };

  // ------------- Dev Self-Tests -------------
  useEffect(() => {
    try {
      const assertions = [];
      const assert = (cond, msg) => assertions.push({ ok: !!cond, msg });
      assert(tileToFrame("plant") === "tile_plant", "tileToFrame maps plant → tile_plant");
      assert(tileToFrame("rock") === "tile_rock", "tileToFrame maps rock → tile_rock");
      assert(["axo_pink","axo_gold","axo_wild","axo_blue"].includes(colorToAxoFrame("pink")), "colorToAxoFrame returns a valid frame");
      assert(typeof spriteSheet.frames.customer_0.x === "number", "frames provide numeric rects");
      const allOk = assertions.every(a => a.ok);
      if (!allOk) {
        console.warn("DEV TESTS FAILED:", assertions.filter(a=>!a.ok));
      } else {
        console.log("DEV TESTS PASSED", assertions);
      }
    } catch (e) {
      console.warn("DEV TESTS EXCEPTION", e);
    }
  }, [spriteSheet.settings]);

  // ------------- Render -------------
  return (
    <div className="p-4 w-full max-w-[1200px] mx-auto">
      <header className="mb-3 flex items-center gap-3">
        <h1 className="text-2xl font-bold">Axolotl Rancher</h1>
        <div className="text-xs opacity-70">Day {day}</div>
        <div className="ml-auto flex items-center gap-2">
          <span className="text-sm">Speed</span>
          <div className="w-32">
            <Slider min={0.5} max={3} step={0.5} defaultValue={[1]} onValueChange={(v) => setSpeed(v[0])} />
          </div>
          <div className="px-3 py-1 rounded-full bg-emerald-600 text-white text-sm shadow">${money}</div>
        </div>
      </header>

      <div className="grid grid-cols-12 gap-3">
        {/* Left Panel: Spritesheet + Build */}
        <div className="col-span-3 space-y-3">
          {/* Spritesheet controls */}
          <Card>
            <CardContent className="p-3 space-y-3">
              <div className="font-semibold">Spritesheet</div>
              <div className="text-xs opacity-80">
                Load a PNG/WebP spritesheet. Layout expected: row 0 customers, row 1 axolotls (pink, gold, wild, blue), row 2 tiles (plant, rock, water, cave).
              </div>
              <div className="flex items-center gap-2 text-xs">
                <input
                  type="file"
                  accept="image/png,image/webp"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (!f) return;
                    const url = URL.createObjectURL(f);
                    spriteSheet.setSpriteUrl(url);
                  }}
                />
                {spriteSheet.status === "loading" && <span className="opacity-70">Loading…</span>}
                {spriteSheet.status === "error" && <span className="text-red-600">{spriteSheet.error}</span>}
                {spriteSheet.status === "loaded" && spriteSheet.img && (
                  <span className="opacity-70">Loaded: {spriteSheet.img.width}×{spriteSheet.img.height}px</span>
                )}
              </div>

              {/* numeric settings */}
              <div className="grid grid-cols-2 gap-2 text-xs">
                <label className="flex items-center justify-between gap-2">Cell <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.cell} onChange={(e)=>spriteSheet.setSettings(s=>({...s,cell:parseInt(e.target.value||"0",10)}))} /></label>
                <label className="flex items-center justify-between gap-2">Cols <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.cols} onChange={(e)=>spriteSheet.setSettings(s=>({...s,cols:parseInt(e.target.value||"0",10)}))} /></label>
                <label className="flex items-center justify-between gap-2">Pad X <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.paddingX} onChange={(e)=>spriteSheet.setSettings(s=>({...s,paddingX:parseInt(e.target.value||"0",10)}))} /></label>
                <label className="flex items-center justify-between gap-2">Pad Y <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.paddingY} onChange={(e)=>spriteSheet.setSettings(s=>({...s,paddingY:parseInt(e.target.value||"0",10)}))} /></label>
                <label className="flex items-center justify-between gap-2">Gap X <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.gapX} onChange={(e)=>spriteSheet.setSettings(s=>({...s,gapX:parseInt(e.target.value||"0",10)}))} /></label>
                <label className="flex items-center justify-between gap-2">Gap Y <input className="w-16 border rounded px-1 py-0.5" type="number" value={spriteSheet.settings.gapY} onChange={(e)=>spriteSheet.setSettings(s=>({...s,gapY:parseInt(e.target.value||"0",10)}))} /></label>
              </div>

              {/* preview thumbnail */}
              {spriteSheet.spriteUrl && (
                <div className="col-span-2">
                  <div className="border rounded-xl overflow-hidden w-full max-w-[260px]">
                    <div
                      className="w-full h-[160px] bg-white"
                      style={{
                        backgroundImage: `url(${spriteSheet.spriteUrl})`,
                        backgroundSize: `${spriteSheet.img?.width ?? 392}px ${spriteSheet.img?.height ?? 320}px`,
                        backgroundRepeat: "no-repeat",
                        imageRendering: "pixelated",
                        backgroundPosition: "left top",
                      }}
                      title="Spritesheet preview"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Build Habitat */}
          <Card>
            <CardContent className="p-3">
              <div className="font-semibold mb-2">Build Habitat</div>
              <div className="grid grid-cols-2 gap-2">
                {TOOLBAR.map((tool) => (
                  <button key={tool.key} onClick={() => setSelectedTool(tool)} className={`p-2 rounded-xl border shadow-sm hover:shadow w-full text-left ${selectedTool?.key === tool.key ? "ring-2 ring-emerald-500" : ""}`}>
                    <div className="flex items-center gap-2">
                      {spriteSheet.img ? (
                        <div className="relative" style={{ width: 24, height: 24 }}>
                          <Sprite sheet={spriteSheet} frameKey={tileToFrame(tool.key)} w={24} h={24} />
                        </div>
                      ) : (
                        <span>{tool.key === "plant" ? "🌿" : tool.key === "rock" ? "🪨" : tool.key === "cave" ? "🏚️" : "🫧"}</span>
                      )}
                      <div className="text-base">{tool.name}</div>
                    </div>
                    <div className="text-xs opacity-70">${tool.price}</div>
                  </button>
                ))}
              </div>
              <div className="mt-3">
                <Button onClick={addEgg} className="w-full">Buy Axolotl Egg — $50</Button>
              </div>
            </CardContent>
          </Card>

          {/* Habitat Score */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold">Habitat Score</div>
              <div className="w-full h-3 bg-emerald-100 rounded-full overflow-hidden">
                <div className="h-full bg-emerald-500" style={{ width: `${Math.round(habitatScore * 100)}%` }} />
              </div>
              <div className="text-xs text-emerald-700">{Math.round(habitatScore * 100)}%</div>
              <p className="text-xs opacity-80">Tips: Plants and rocks make axolotls feel safe. Caves are cozy. Filters improve water quality.</p>
            </CardContent>
          </Card>

          {/* Selected Axolotl */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold">Selected Axolotl</div>
              {selectedAxo ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded-full border" style={{ background: COLORS.find(c=>c.key===selectedAxo.color)?.hex }} />
                    <div className="text-sm">{COLORS.find(c=>c.key===selectedAxo.color)?.name}</div>
                  </div>
                  <div className="text-sm">Value Estimate: ${selectedAxo.value}</div>
                  <div className="text-xs opacity-70">Happiness ×{selectedAxo.happy.toFixed(2)}</div>
                </div>
              ) : (
                <div className="text-xs opacity-70">Click an axolotl in the tank to view details.</div>
              )}
            </CardContent>
          </Card>

          {/* How to Play */}
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold mb-1">How to Play</div>
              <ul className="list-disc pl-5 text-xs space-y-1">
                <li>Load the <strong>spritesheet</strong> (PNG/WebP). Adjust cell & padding if needed.</li>
                <li>Use <strong>Build Habitat</strong> to add plants, rocks, caves, and filters.</li>
                <li>Buy <strong>Eggs</strong> to hatch more axolotls. Rare colors are worth more.</li>
                <li>Click an axolotl to select it, then sell to a matching customer.</li>
                <li>Better habitats make axolotls <em>happier</em> → higher value.</li>
              </ul>
            </CardContent>
          </Card>
        </div>

        {/* Middle: Tank */}
        <div className="col-span-6">
          <div className="relative rounded-2xl shadow-inner overflow-hidden border bg-gradient-to-b from-cyan-100 to-cyan-200" style={{ width: BOARD_W, height: BOARD_H }}>
            {/* grid */}
            {tiles.map((row, y) => (
              <div key={y} className="flex" style={{ height: TILE_SIZE }}>
                {row.map((t, x) => (
                  <div key={x} onClick={() => placeTile(x, y)} className="relative border border-white/30 hover:border-emerald-400/50 cursor-pointer" style={{ width: TILE_SIZE, height: TILE_SIZE }} title={`${t}`}>
                    {t !== "water" && (
                      spriteSheet.img ? (
                        <div className="absolute inset-1 rounded-xl bg-white/20 backdrop-blur-[1px] border shadow-sm flex items-center justify-center">
                          <div className="relative" style={{ width: 28, height: 28 }}>
                            <Sprite sheet={spriteSheet} frameKey={tileToFrame(t)} w={28} h={28} />
                          </div>
                        </div>
                      ) : (
                        <div className="absolute inset-1 rounded-xl bg-white/50 backdrop-blur-[1px] border shadow-sm flex items-center justify-center text-xs">
                          {t === "plant" && <span>🌿</span>}
                          {t === "rock" && <span>🪨</span>}
                          {t === "cave" && <span>🏚️</span>}
                          {t === "filter" && <span>🫧</span>}
                        </div>
                      )
                    )}
                  </div>
                ))}
              </div>
            ))}

            {/* axolotls */}
            <AnimatePresence>
              {axoWithDerived.map((a) => (
                <motion.div key={a.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute" style={{ left: 0, top: 0 }} onClick={() => setSelectedAxoId(a.id)}>
                  {spriteSheet.img ? (
                    <Sprite sheet={spriteSheet} frameKey={colorToAxoFrame(a.color)} w={36} h={36} flipX={a.vx < 0} style={{ left: a.x, top: a.y - 6 }} />
                  ) : (
                    <AxolotlSVG color={a.color} x={a.x} y={a.y} dirX={a.vx} />
                  )}
                  {a.happy > 1.2 && <div className="absolute -top-2 left-6 text-pink-500 text-xs">❤</div>}
                </motion.div>
              ))}
            </AnimatePresence>

            {/* customers */}
            {customers.map((c) => (
              spriteSheet.img ? (
                <Sprite key={c.id} sheet={spriteSheet} frameKey={`customer_${c.skin}`} w={40} h={40} style={{ left: c.x, top: c.y }} />
              ) : (
                <CustomerEmoji key={c.id} x={c.x} y={c.y} />
              )
            ))}
          </div>
        </div>

        {/* Right: Customers panel */}
        <div className="col-span-3 space-y-3">
          <Card>
            <CardContent className="p-3 space-y-2">
              <div className="font-semibold">Customers in the Shop</div>
              {customers.length === 0 && <div className="text-xs opacity-70">No customers right now. Keep your axolotls happy!</div>}
              <div className="space-y-2 max-h-[420px] overflow-auto pr-1">
                {customers.map((c) => (
                  <div key={c.id} className="p-2 rounded-xl border bg-white/80 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div className="text-sm font-medium">Budget ${c.budget}</div>
                      <div className="text-[10px] opacity-70">wants {COLORS.find(x=>x.key===c.desired)?.name}</div>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1">
                      {axoWithDerived.length === 0 && <div className="text-xs opacity-60">You have no axolotls yet.</div>}
                      {axoWithDerived.map((a) => {
                        const match = a.color === c.desired;
                        const price = Math.min(Math.round(a.value * (match ? 1.3 : 1.0)), c.budget);
                        return (
                          <button key={a.id} onClick={() => sellToCustomer(c.id, a.id)} className={`text-left p-2 rounded-lg border hover:shadow flex items-center justify-between ${match ? "bg-amber-50 border-amber-300" : "bg-white"}`} title={match ? "Color match! +30%" : "No bonus"}>
                            <div className="flex items-center gap-2">
                              <div className="relative" style={{ width: 20, height: 20 }}>
                                {spriteSheet.img ? (
                                  <Sprite sheet={spriteSheet} frameKey={colorToAxoFrame(a.color)} w={20} h={20} />
                                ) : (
                                  <div className="w-3 h-3 rounded-full border" style={{ background: COLORS.find(x=>x.key===a.color)?.hex }} />
                                )}
                              </div>
                              <div className="text-xs">{COLORS.find(x=>x.key===a.color)?.name}</div>
                            </div>
                            <div className="text-xs font-semibold">Sell ${price}</div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-3 space-y-1">
              <div className="font-semibold">Legend</div>
              <div className="text-xs opacity-80">Rare colors are worth more:</div>
              <ul className="text-xs space-y-1">
                {COLORS.map((c) => (
                  <li key={c.key} className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full border" style={{ background: c.hex }} />
                    <span>{c.name}</span>
                    <span className="ml-auto opacity-70">Base ${c.base}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

// ------------------ Helpers -------------------
function mkAxo({ x, y }) {
  const color = pickColorByRarity();
  return { id: Math.random().toString(36).slice(2), color, x, y, vx: rand(-20, 20), vy: rand(-18, 18) };
}

function initialAxos() {
  return [ mkAxo({ x: rand(60, BOARD_W - 80), y: rand(30, BOARD_H - 60) }), mkAxo({ x: rand(60, BOARD_W - 80), y: rand(30, BOARD_H - 60) }) ];
}

function pickColorByRarity() {
  const weights = COLORS.map((c) => c.rarity);
  const sum = weights.reduce((a, b) => a + b, 0);
  let r = Math.random() * sum;
  for (let i = 0; i < COLORS.length; i++) { if ((r -= weights[i]) <= 0) return COLORS[i].key; }
  return COLORS[0].key;
}

function neighborhood(grid, cx, cy, r) {
  const tiles = [];
  for (let y = cy - r; y <= cy + r; y++) {
    for (let x = cx - r; x <= cx + r; x++) {
      if (y >= 0 && y < GRID_H && x >= 0 && x < GRID_W) tiles.push(grid[y][x]);
    }
  }
  return tiles;
}
function countTiles(arr) {
  const c = { plant: 0, rock: 0, cave: 0, filter: 0 };
  arr.forEach((t) => t in c && c[t]++);
  return c;
}
function sat(n, min, max) { return clamp((n - min) / (max - min + 0.0001), 0, 1); }

// mapping helpers (fixed)
function colorToAxoFrame(color) {
  switch (color) {
    case "pink": return "axo_pink";
    case "gold": return "axo_gold";
    case "wild": return "axo_wild";
    case "blue": return "axo_blue";
    default: return "axo_pink";
  }
}

function tileToFrame(tileKey) {
  switch (tileKey) {
    case "plant": return "tile_plant";
    case "rock": return "tile_rock";
    case "cave": return "tile_cave";
    case "filter": return "tile_water"; // reuse water as filter icon
    default: return "tile_water";
  }
}
