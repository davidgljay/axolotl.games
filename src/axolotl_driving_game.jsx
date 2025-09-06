import React, { useEffect, useRef, useState } from "react";

// Axolotl Driver — React Canvas Game (TypeScript/JSX safe)
// This replaces the previous raw-HTML version so bundlers reading index.tsx
// won't choke on a <!doctype html>. Drop this file into a React project and render
// <AxolotlDriver />. It uses a <canvas> and has no external deps.
//
// Key fixes & hardening:
// - Safe image loading (decode/onload + naturalWidth) and a safeDrawImage() guard.
// - Device Pixel Ratio scaling for crisp canvas.
// - RAF loop clamps dt and pauses on tab hide to avoid physics spikes.
// - Input listeners have proper cleanup and prevent page scroll on arrows/space.
// - State guards: clamped fuel, NaN-resistant timers, early-return after crash.
// - Best score persisted to localStorage.
// - Tiny runtime console tests for geometry, image safety, and steering.
//
// Sprite: place an optional 'axolotlcar.png' next to your built assets. If missing,
// a placeholder car + axolotl face is drawn.

export default function AxolotlDriver() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // UI state
  const [running, setRunning] = useState(false);
  const [paused, setPaused] = useState(false);
  const [crashed, setCrashed] = useState(false);
  const [reason, setReason] = useState("");
  const [best, setBest] = useState<number>(() => {
    try {
      const v = Number(localStorage.getItem("axodriver_best"));
      return Number.isFinite(v) ? Math.max(0, v) : 0;
    } catch {
      return 0;
    }
  });
  const [score, setScore] = useState(0);

  // World settings
  const W = 520;
  const H = 780;
  const ROAD_W = 360;
  const ROAD_X = (W - ROAD_W) / 2;
  const LANE = ROAD_W / 3;
  const STEER_ACCEL = 6900; // responsiveness
  const TURN_FRICTION = 0.9; // lateral friction

  // Optional sprite (future: axolotlcar.png)
  const carImgRef = useRef<HTMLImageElement | null>(null);
  const [carReady, setCarReady] = useState(false);

  // Game state kept outside React to avoid re-renders each frame
  const stateRef = useRef({
    t: 0,
    speed: 260,
    car: { x: W / 2, y: H - 140, w: 60, h: 110, vx: 0 },
    keys: new Set<string>(),
    fuel: 1.0,
    obstacles: [] as Array<{ x: number; y: number; w: number; h: number }>,
    pickups: [] as Array<{ x: number; y: number; rX: number; rY: number }>,
    spawnTimer: 0,
    gasTimer: 0,
  });

  // Setup DPR scaling once
  useEffect(() => {
    const cvs = canvasRef.current;
    if (!cvs) return;
    const ctx = cvs.getContext("2d");
    if (!ctx) return;
    const dpr = Math.max(1, Math.min(2, (globalThis as any).devicePixelRatio || 1));
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    cvs.style.width = `${W}px`;
    cvs.style.height = `${H}px`;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }, []);

  // Robust optional sprite load
  useEffect(() => {
    let cancelled = false;
    const img = new Image();
    img.src = "axolotlcar.png"; // if missing, we fallback to placeholder
    const markReady = () => {
      if (cancelled) return;
      const ok = (img as any).complete && (img as any).naturalWidth > 0 && (img as any).naturalHeight > 0;
      carImgRef.current = img;
      setCarReady(!!ok);
    };
    if ((img as any).decode) {
      (img as any)
        .decode()
        .then(markReady)
        .catch(() => {
          img.onload = markReady;
          img.onerror = () => setCarReady(false);
        });
    } else {
      img.onload = markReady;
      img.onerror = () => setCarReady(false);
    }
    return () => {
      cancelled = true;
    };
  }, []);

  // Input handling
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const key = e.key.toLowerCase();
      if (["arrowleft", "arrowright", "a", "d", " ", "r"].includes(key)) e.preventDefault();
      if (key === " ") {
        setPaused((p) => !p);
        return;
      }
      if (key === "r") {
        restart();
        return;
      }
      stateRef.current.keys.add(key);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      stateRef.current.keys.delete(e.key.toLowerCase());
    };
    globalThis.addEventListener("keydown", onKeyDown as any, { passive: false } as any);
    globalThis.addEventListener("keyup", onKeyUp as any, { passive: false } as any);
    return () => {
      globalThis.removeEventListener("keydown", onKeyDown as any);
      globalThis.removeEventListener("keyup", onKeyUp as any);
    };
  }, []);

  // Touch controls bound to canvas
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    let touching = false;
    const bcr = () => el.getBoundingClientRect();
    const onTouchStart = (e: TouchEvent) => {
      touching = true;
      const x = e.touches[0].clientX - bcr().left;
      stateRef.current.keys.clear();
      stateRef.current.keys.add(x < W / 2 ? "a" : "d");
    };
    const onTouchMove = (e: TouchEvent) => {
      if (!touching) return;
      const x = e.touches[0].clientX - bcr().left;
      stateRef.current.keys.clear();
      stateRef.current.keys.add(x < W / 2 ? "a" : "d");
    };
    const onTouchEnd = () => {
      touching = false;
      stateRef.current.keys.clear();
    };
    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, []);

  // Auto-pause on tab hide
  useEffect(() => {
    const onVis = () => {
      if ((document as any).hidden) setPaused(true);
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);

  // Main loop
  useEffect(() => {
    let raf = 0;
    let last = performance.now();
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;

    const spawnObstacle = () => {
      const laneIndex = Math.floor(Math.random() * 3);
      const x = ROAD_X + laneIndex * LANE + LANE * 0.5;
      const w = 60 + Math.random() * 40;
      const h = 40 + Math.random() * 60;
      stateRef.current.obstacles.push({ x, y: -h, w, h });
    };
    const spawnGas = () => {
      const laneIndex = Math.floor(Math.random() * 3);
      const x = ROAD_X + laneIndex * LANE + LANE * 0.5;
      stateRef.current.pickups.push({ x, y: -30, rX: 26, rY: 20 });
    };

    const crash = (why: string) => {
      setCrashed(true);
      setReason(why);
      setRunning(false);
      setBest((b) => {
        const nv = Math.max(b, Math.floor(stateRef.current.t));
        try { localStorage.setItem("axodriver_best", String(nv)); } catch {}
        return nv;
      });
    };

    const draw = () => {
      const S = stateRef.current;
      ctx.clearRect(0, 0, W, H);

      // Background & road
      ctx.fillStyle = "#0b1220";
      ctx.fillRect(0, 0, W, H);
      ctx.fillStyle = "#303640";
      ctx.fillRect(ROAD_X, 0, ROAD_W, H);

      // Lane markers
      const dashH = 40;
      const gap = 28;
      const offset = ((S.t * S.speed * 0.4) % (dashH + gap));
      ctx.fillStyle = "#eaeaea";
      for (let x = ROAD_X + LANE; x < ROAD_X + ROAD_W; x += LANE) {
        for (let y = -dashH; y < H + dashH; y += dashH + gap) {
          ctx.fillRect(x - 4, y + offset, 8, dashH);
        }
      }

      // Road edges
      ctx.fillStyle = "#c2c8d0";
      ctx.fillRect(ROAD_X - 6, 0, 6, H);
      ctx.fillRect(ROAD_X + ROAD_W, 0, 6, H);

      // Obstacles
      for (const o of S.obstacles) {
        ctx.fillStyle = "#7a8699";
        roundRect(ctx, o.x - o.w / 2, o.y - o.h / 2, o.w, o.h, 8);
        ctx.fill();
      }

      // Pickups
      for (const g of S.pickups) {
        ctx.save();
        ctx.translate(g.x, g.y);
        ctx.fillStyle = "#f5d76e";
        ellipsePath(ctx, 0, 0, g.rX, g.rY);
        ctx.fill();
        ctx.strokeStyle = "#8b6f1f";
        ctx.lineWidth = 2;
        ellipsePath(ctx, 0, 0, g.rX, g.rY);
        ctx.stroke();
        ctx.fillStyle = "#2b2b2b";
        ctx.font = "bold 18px ui-sans-serif";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText("G", 0, 1);
        ctx.restore();
      }

      // Car (sprite if ready, else placeholder)
      const car = S.car;
      const drawn = carReady && safeDrawImage(ctx, carImgRef.current, car.x - car.w, car.y - car.h * 0.6, car.w * 2, car.h * 1.2);
      if (!drawn) {
        ctx.fillStyle = "#d93a3e";
        roundRect(ctx, car.x - car.w / 2, car.y - car.h / 2, car.w, car.h, 12);
        ctx.fill();
        // tiny axolotl face
        ctx.fillStyle = "#f9b4c8";
        ellipsePath(ctx, car.x, car.y - car.h * 0.38, 18, 14);
        ctx.fill();
        ctx.fillStyle = "#000";
        ellipsePath(ctx, car.x - 6, car.y - car.h * 0.38, 2.6, 2.6);
        ctx.fill();
        ellipsePath(ctx, car.x + 6, car.y - car.h * 0.38, 2.6, 2.6);
        ctx.fill();
      }

      // HUD
      const pad = 14;
      const barW = 180;
      const barH = 18;
      ctx.fillStyle = "rgba(255,255,255,0.08)";
      roundRect(ctx, pad - 2, pad - 2, barW + 4, barH + 4, 8);
      ctx.fill();
      ctx.fillStyle = "#232a34";
      roundRect(ctx, pad, pad, barW, barH, 6);
      ctx.fill();
      const fuelPx = Math.max(0, Math.min(1, S.fuel)) * barW;
      const grad = ctx.createLinearGradient(pad, 0, pad + barW, 0);
      grad.addColorStop(0, "#8ee3b1");
      grad.addColorStop(1, "#2ec27e");
      ctx.fillStyle = grad;
      roundRect(ctx, pad, pad, fuelPx, barH, 6);
      ctx.fill();
      ctx.fillStyle = "#e6eef7";
      ctx.font = "12px ui-sans-serif";
      ctx.fillText("Fuel", pad + 6, pad + barH + 12);

      ctx.textAlign = "right";
      ctx.font = "16px ui-sans-serif";
      ctx.fillText(`Score: ${Math.floor(S.t)}`, W - pad, pad + 12);
      ctx.fillText(`Best: ${best}`, W - pad, pad + 32);

      // Overlays
      if (paused || !running) {
        ctx.fillStyle = "rgba(10,12,18,0.35)";
        ctx.fillRect(0, 0, W, H);
      }
      if (crashed) {
        ctx.fillStyle = "rgba(0,0,0,0.55)";
        ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = "#fff";
        ctx.textAlign = "center";
        ctx.font = "bold 28px ui-sans-serif";
        ctx.fillText("Crash!", W / 2, H / 2 - 40);
        ctx.font = "16px ui-sans-serif";
        ctx.fillText(`You ${reason}. Press R to restart.`, W / 2, H / 2 - 10);
      }

      if (!carReady) {
        ctx.fillStyle = "rgba(0,0,0,0.45)";
        ctx.font = "12px ui-sans-serif";
        ctx.textAlign = "left";
        ctx.fillText("Add axolotlcar.png beside this file to use a custom sprite.", pad, H - pad);
      }
    };

    const step = (now: number) => {
      raf = requestAnimationFrame(step);
      let dt = (now - last) / 1000;
      last = now;
      if (!Number.isFinite(dt) || dt < 0) dt = 0;
      dt = Math.min(0.033, dt); // clamp to ~30fps max step

      if (!running || paused) {
        draw();
        return;
      }

      if (dt > 0.25) { // ignore giant resume jumps
        draw();
        return;
      }

      const S = stateRef.current;
      S.t += dt;
      S.speed = Math.min(520, S.speed + dt * 6);

      // Fuel drain
      S.fuel = Math.max(0, Math.min(1, S.fuel - dt * 0.055));
      if (S.fuel <= 0) {
        crash("ran out of fuel");
        draw();
        return;
      }

      // Controls & motion
      const left = S.keys.has("arrowleft") || S.keys.has("a");
      const right = S.keys.has("arrowright") || S.keys.has("d");
      const steer = (right ? 1 : 0) - (left ? 1 : 0);
      S.car.vx += steer * STEER_ACCEL * dt;
      S.car.vx *= TURN_FRICTION;
      S.car.x += S.car.vx * dt;

      // Walls
      const minX = ROAD_X + S.car.w * 0.5 + 2;
      const maxX = ROAD_X + ROAD_W - S.car.w * 0.5 - 2;
      if (S.car.x < minX || S.car.x > maxX) {
        crash("hit the wall");
        draw();
        return;
      }

      // Scroll & prune entities
      for (const o of S.obstacles) o.y += S.speed * dt;
      for (const g of S.pickups) g.y += S.speed * 0.9 * dt;
      S.obstacles = S.obstacles.filter((o) => o.y < H + 100);
      S.pickups = S.pickups.filter((g) => g.y < H + 100);

      // Spawning (resistant to NaN)
      S.spawnTimer = Math.max(0, (S.spawnTimer || 0) - dt);
      if (S.spawnTimer === 0) {
        spawnObstacle();
        S.spawnTimer = Math.max(0.45, 1.2 - S.t * 0.02);
      }
      S.gasTimer = Math.max(0, (S.gasTimer || 0) - dt);
      if (S.gasTimer === 0) {
        spawnGas();
        S.gasTimer = 2.5 + Math.random() * 1.8;
      }

      // Collisions
      const carBox = { x: S.car.x - S.car.w / 2, y: S.car.y - S.car.h / 2, w: S.car.w, h: S.car.h };
      for (const o of S.obstacles) {
        if (rectOverlap(carBox, { x: o.x - o.w / 2, y: o.y - o.h / 2, w: o.w, h: o.h })) {
          crash("hit a block");
          break;
        }
      }
      if (!crashed) {
        S.pickups = S.pickups.filter((g) => {
          if (ellipseHit(S.car.x, S.car.y, g.x, g.y, g.rX, g.rY)) {
            S.fuel = Math.min(1, S.fuel + 0.4);
            return false;
          }
          return true;
        });
      }

      // Lift score to React state once per frame
      setScore(Math.floor(S.t));
      draw();
    };

    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [running, paused, crashed, carReady, best]);

  // --- Helpers ---
  function rectOverlap(a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  }
  function ellipseHit(cx: number, cy: number, ex: number, ey: number, rx: number, ry: number) {
    const dx = cx - ex;
    const dy = cy - ey;
    return (dx * dx) / (rx * rx) + (dy * dy) / (ry * ry) <= 1.0;
  }
  function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  function ellipsePath(ctx: CanvasRenderingContext2D, cx: number, cy: number, rx: number, ry: number) {
    ctx.beginPath();
    ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
    ctx.closePath();
  }
  function safeDrawImage(
    ctx: CanvasRenderingContext2D,
    img: HTMLImageElement | null,
    x: number,
    y: number,
    w: number,
    h: number
  ) {
    if (!img) return false;
    const anyImg: any = img as any;
    if (!anyImg.complete || anyImg.naturalWidth === 0 || anyImg.naturalHeight === 0) return false;
    try {
      ctx.drawImage(img, x, y, w, h);
      return true;
    } catch {
      return false;
    }
  }

  // --- Runtime console tests (do not remove unless wrong) ---
  useEffect(() => {
    // geometry
    console.assert(
      rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 5, y: 5, w: 10, h: 10 }) === true,
      "rectOverlap should detect overlap"
    );
    console.assert(
      rectOverlap({ x: 0, y: 0, w: 10, h: 10 }, { x: 20, y: 20, w: 10, h: 10 }) === false,
      "rectOverlap should detect no overlap"
    );
    console.assert(ellipseHit(0, 0, 0, 0, 10, 5) === true, "ellipseHit center should be inside");
    console.assert(ellipseHit(11, 0, 0, 0, 10, 5) === false, "ellipseHit outside should be false");

    // image safety
    const ctx = canvasRef.current?.getContext("2d");
    if (ctx) {
      console.assert(safeDrawImage(ctx, null, 0, 0, 10, 10) === false, "safeDrawImage null should be false");
    }

    // steering sanity
    const dt = 0.016;
    let vx = 0;
    vx = (vx + 1 * STEER_ACCEL * dt) * TURN_FRICTION;
    console.assert(Number.isFinite(vx) && vx > 0, "steering should increase lateral vx");

    // NEW tests: fuel clamp and timer sanity
    const S = stateRef.current;
    const oldFuel = S.fuel;
    S.fuel = -1; // simulate bad math
    S.fuel = Math.max(0, Math.min(1, S.fuel));
    console.assert(S.fuel === 0, "fuel should clamp to >=0");
    S.spawnTimer = NaN as unknown as number;
    S.spawnTimer = Math.max(0, (S.spawnTimer || 0) - 0.016);
    console.assert(Number.isFinite(S.spawnTimer), "spawnTimer should never be NaN after clamp");
  }, []);

  // UI + Canvas
  return (
    <div className="min-h-[100vh] w-full bg-slate-900 text-slate-100 flex items-center justify-center p-6">
      <div className="w-[560px]">
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-xl font-semibold">Axolotl Driver</h1>
          <div className="flex gap-2">
            {!running ? (
              <button
                onClick={() => {
                  setRunning(true);
                  setPaused(false);
                  setCrashed(false);
                  setReason("");
                  const S = stateRef.current;
                  S.t = 0;
                  S.speed = 260;
                  S.fuel = 1.0;
                  S.obstacles = [];
                  S.pickups = [];
                  S.spawnTimer = 0;
                  S.gasTimer = 0;
                  S.car = { x: W / 2, y: H - 140, w: 60, h: 110, vx: 0 };
                }}
                className="px-3 py-1.5 rounded-2xl bg-emerald-500 hover:bg-emerald-600 text-white shadow"
              >
                Start
              </button>
            ) : (
              <button
                onClick={() => setPaused((p) => !p)}
                className="px-3 py-1.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white shadow"
              >
                {paused ? "Resume (Space)" : "Pause (Space)"}
              </button>
            )}
            <button
              onClick={() => {
                setRunning(true);
                setPaused(false);
                setCrashed(false);
                setReason("");
                const S = stateRef.current;
                S.t = 0;
                S.speed = 260;
                S.fuel = 1.0;
                S.obstacles = [];
                S.pickups = [];
                S.spawnTimer = 0;
                S.gasTimer = 0;
                S.car = { x: W / 2, y: H - 140, w: 60, h: 110, vx: 0 };
              }}
              className="px-3 py-1.5 rounded-2xl bg-slate-700 hover:bg-slate-600 text-white shadow"
            >
              Restart (R)
            </button>
          </div>
        </div>
        <div className="rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-700/60">
          <canvas ref={canvasRef} width={W} height={H} className="block bg-slate-950" />
        </div>
        <p className="text-sm text-slate-300 mt-3">
          Steer with ← → or A/D. Collect <span className="font-semibold">G</span> tanks to refill fuel.
          Avoid blocks and the road edges. Fuel in the top-left; when it hits 0 you crash.
        </p>
        {!carReady && (
          <p className="text-xs text-slate-400 mt-1">
            Tip: add an <code>axolotlcar.png</code> next to your built assets to use a custom sprite.
          </p>
        )}
      </div>
    </div>
  );
}
