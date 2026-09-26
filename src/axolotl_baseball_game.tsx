import React, { useEffect, useRef, useState } from "react";
import { MORPHS, type Morph } from "./axolotl_morphs";

// Home Run Derby seen from behind the batter. The ballpark is a small 3D scene projected
// through a pinhole camera; the batter, pitcher, fielders and crowd are drawn cartoon billboards.

const W = 960;
const H = 540;
const STEP = 1 / 120;
const TAU = Math.PI * 2;
const G = 9.8;
const DRAG = 0.005;
const BALL_R = 0.037;
const OUTS = 10;
const SWING_LAG = 0.08;
const RELEASE = { x: 0.35, y: 1.75, z: 17.4 };
const ZONE = { x: 0.26, y0: 0.5, y1: 1.1 };
const BATTER = { x: -0.95, z: 0.15 };
const FIELDER_SPEED = 6.2;
const FIELDER_REACT = 0.5;
const BEST_KEY = "axolotl_baseball_best_v2";

const COLOR_UNLOCKS: Record<string, number> = { pink: 0, wild: 3000, gold: 7000, midnight: 12000 };

interface Bat {
  id: string;
  name: string;
  need: number;
  handle: string;
  barrel: string;
  stripe?: string;
}

const BATS: Bat[] = [
  { id: "wood", name: "Wood", need: 0, handle: "#8a5a32", barrel: "#c8904f" },
  { id: "silver", name: "Silver", need: 5000, handle: "#2b2f36", barrel: "#c9d1db" },
  { id: "candy", name: "Candy", need: 10000, handle: "#ff5f8f", barrel: "#ffffff", stripe: "#ff5f8f" },
];

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);
const rand = (a: number, b: number) => a + Math.random() * (b - a);

function hash1(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function roundRect(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.4, r), 0, TAU);
  ctx.fill();
}

const fenceR = (bearing: number) => 100 + 12 * Math.cos(2 * clamp(bearing, -Math.PI / 4, Math.PI / 4));
const LINE_R = fenceR(Math.PI / 4);
const toFt = (m: number) => Math.round(m * 3.281);

// ---------- camera ----------

interface Cam {
  x: number;
  y: number;
  z: number;
  yaw: number;
  pitch: number;
  f: number;
}

const NEAR = 0.3;

function toCam(c: Cam, x: number, y: number, z: number): [number, number, number] {
  const dx = x - c.x;
  const dy = y - c.y;
  const dz = z - c.z;
  const cy = Math.cos(c.yaw);
  const sy = Math.sin(c.yaw);
  const cp = Math.cos(c.pitch);
  const sp = Math.sin(c.pitch);
  const rx = dx * cy - dz * sy;
  const fz = dx * sy * cp - dy * sp + dz * cy * cp;
  const uy = dx * sy * sp + dy * cp + dz * cy * sp;
  return [rx, uy, fz];
}

function project(c: Cam, x: number, y: number, z: number) {
  const [rx, uy, fz] = toCam(c, x, y, z);
  if (fz <= NEAR) return null;
  return { x: W / 2 + (rx / fz) * c.f, y: H / 2 - (uy / fz) * c.f, s: c.f / fz, z: fz };
}

function polyPath(ctx: CanvasRenderingContext2D, c: Cam, pts: [number, number, number][]) {
  let cam = pts.map((p) => toCam(c, p[0], p[1], p[2]));
  const out: [number, number, number][] = [];
  for (let i = 0; i < cam.length; i++) {
    const a = cam[i];
    const b = cam[(i + 1) % cam.length];
    const ain = a[2] > NEAR;
    const bin = b[2] > NEAR;
    if (ain) out.push(a);
    if (ain !== bin) {
      const t = (NEAR - a[2]) / (b[2] - a[2]);
      out.push([lerp(a[0], b[0], t), lerp(a[1], b[1], t), NEAR]);
    }
  }
  cam = out;
  if (cam.length < 3) return false;
  ctx.beginPath();
  cam.forEach((p, i) => {
    const sx = W / 2 + (p[0] / p[2]) * c.f;
    const sy = H / 2 - (p[1] / p[2]) * c.f;
    if (i === 0) ctx.moveTo(sx, sy);
    else ctx.lineTo(sx, sy);
  });
  ctx.closePath();
  return true;
}

function fillPoly(ctx: CanvasRenderingContext2D, c: Cam, pts: [number, number, number][], color: string) {
  if (!polyPath(ctx, c, pts)) return;
  ctx.fillStyle = color;
  ctx.fill();
}

function groundCircle(cx: number, cz: number, r: number, y = 0, n = 28): [number, number, number][] {
  const pts: [number, number, number][] = [];
  for (let i = 0; i < n; i++) {
    const a = (i / n) * TAU;
    pts.push([cx + Math.cos(a) * r, y, cz + Math.sin(a) * r]);
  }
  return pts;
}

// ---------- game state ----------

type Mode = "title" | "pitch" | "flight" | "result" | "over";
type PitchKind = "fastball" | "changeup" | "curve" | "bubble";

const PITCH_INFO: Record<PitchKind, { name: string; trail: string; glow: string }> = {
  fastball: { name: "Fastball", trail: "255,90,90", glow: "#ff6b6b" },
  changeup: { name: "Changeup", trail: "120,230,140", glow: "#7ee0a0" },
  curve: { name: "Curveball", trail: "170,130,255", glow: "#b69cff" },
  bubble: { name: "Floaty Bubble", trail: "140,220,255", glow: "#9ad4ff" },
};

interface Pitch {
  kind: PitchKind;
  T: number;
  tx: number;
  ty: number;
  breakX: number;
  drop: number;
  releaseAt: number;
  mph: number;
}

interface Fielder {
  name: string;
  hx: number;
  hz: number;
  x: number;
  z: number;
  tx: number;
  tz: number;
  morph: number;
  catching: boolean;
}

interface HitPlan {
  kind: "hr" | "foul" | "caught" | "grounded" | "hit";
  label: string;
  dist: number;
  landT: number;
  lx: number;
  lz: number;
  fielder: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  max: number;
  r: number;
  color: string;
}

interface Game {
  mode: Mode;
  t: number;
  modeT: number;
  slow: number;
  outs: number;
  score: number;
  streak: number;
  pitchN: number;
  stats: { hr: number; hits: number; longest: number };
  pitch: Pitch | null;
  pitchT: number;
  swingT: number;
  swung: boolean;
  missed: boolean;
  cursorY: number;
  ball: { x: number; y: number; z: number; vx: number; vy: number; vz: number; live: boolean; held: boolean };
  trail: { x: number; y: number; z: number }[];
  plan: HitPlan | null;
  flightT: number;
  fielders: Fielder[];
  cam: Cam;
  feedback: { text: string; sub: string; color: string; t0: number } | null;
  cheer: number;
  shake: number;
  particles: Particle[];
  best: number;
  newBest: boolean;
  unlocks: string[];
  lastPitch: string;
}

const BAT_CAM: Cam = { x: 0, y: 1.8, z: -6, yaw: 0, pitch: 0.08, f: 1000 };
const FLIGHT_CAM_POS = { x: 0, y: 2.6, z: -7 };

const FIELDER_HOME: [string, number, number][] = [
  ["1B", 16.5, 22],
  ["2B", 8, 33],
  ["SS", -8, 33],
  ["3B", -16.5, 22],
  ["LF", -36, 72],
  ["CF", 0, 88],
  ["RF", 36, 72],
];

function makeFielders(): Fielder[] {
  return FIELDER_HOME.map(([name, x, z], i) => ({ name, hx: x, hz: z, x, z, tx: x, tz: z, morph: i % MORPHS.length, catching: false }));
}

function loadBest() {
  try {
    const v = Number(localStorage.getItem(BEST_KEY));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  } catch {
    return 0;
  }
}

function newGame(mode: Mode, best: number): Game {
  return {
    mode,
    t: 0,
    modeT: 0,
    slow: 0,
    outs: 0,
    score: 0,
    streak: 0,
    pitchN: 0,
    stats: { hr: 0, hits: 0, longest: 0 },
    pitch: null,
    pitchT: 0,
    swingT: -1,
    swung: false,
    missed: false,
    cursorY: 0.8,
    ball: { x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, live: false, held: true },
    trail: [],
    plan: null,
    flightT: 0,
    fielders: makeFielders(),
    cam: { ...BAT_CAM },
    feedback: null,
    cheer: 0,
    shake: 0,
    particles: [],
    best,
    newBest: false,
    unlocks: [],
    lastPitch: "",
  };
}

function choosePitch(n: number): Pitch {
  const d = Math.min(1, n / 30);
  const weights: [PitchKind, number][] = [
    ["fastball", 1],
    ["bubble", n > 2 ? 0.25 : 0],
    ["changeup", n > 3 ? 0.4 + 0.4 * d : 0],
    ["curve", n > 6 ? 0.3 + 0.5 * d : 0],
  ];
  const total = weights.reduce((s, w) => s + w[1], 0);
  let r = Math.random() * total;
  let kind: PitchKind = "fastball";
  for (const [k, w] of weights) {
    if ((r -= w) <= 0) {
      kind = k;
      break;
    }
  }
  const fastT = lerp(0.68, 0.5, d);
  const T = kind === "fastball" ? fastT : kind === "changeup" ? fastT * 1.45 : kind === "curve" ? fastT * 1.25 : 1.2;
  const inZone = Math.random() < 0.72;
  let tx = rand(-0.2, 0.2);
  let ty = rand(0.58, 1.02);
  if (!inZone) {
    if (Math.random() < 0.5) tx = (Math.random() < 0.5 ? -1 : 1) * rand(0.36, 0.5);
    else ty = Math.random() < 0.5 ? rand(0.2, 0.38) : rand(1.25, 1.4);
  }
  const breakX = kind === "curve" ? (Math.random() < 0.5 ? -1 : 1) * rand(0.2, 0.35) : 0;
  const drop = kind === "curve" ? 0.22 : kind === "changeup" ? 0.15 : 0;
  return { kind, T, tx: tx - breakX, ty: ty + drop, breakX, drop, releaseAt: rand(1.1, 1.5), mph: Math.round((17.4 / T) * 2.237) };
}

function pitchPos(p: Pitch, u: number) {
  let x = lerp(RELEASE.x, p.tx, u) + p.breakX * u * u;
  let y = lerp(RELEASE.y, p.ty, u) - p.drop * u * u;
  const z = lerp(RELEASE.z, 0, u);
  if (p.kind === "bubble") {
    y += 0.12 * Math.sin(u * 9);
    x += 0.08 * Math.sin(u * 6 + 1);
  }
  return { x, y, z };
}

function simulate(x: number, y: number, z: number, vx: number, vy: number, vz: number, dt: number) {
  const sp = Math.hypot(vx, vy, vz);
  vx -= DRAG * sp * vx * dt;
  vz -= DRAG * sp * vz * dt;
  vy -= (G + DRAG * sp * vy) * dt;
  return { x: x + vx * dt, y: y + vy * dt, z: z + vz * dt, vx, vy, vz };
}

function planHit(S: Game, v: number, la: number, spray: number): HitPlan {
  const b = S.ball;
  let s = {
    x: b.x,
    y: b.y,
    z: b.z,
    vx: v * Math.cos(la) * Math.sin(spray),
    vy: v * Math.sin(la),
    vz: v * Math.cos(la) * Math.cos(spray),
  };
  b.vx = s.vx;
  b.vy = s.vy;
  b.vz = s.vz;
  const foul = Math.abs(spray) > Math.PI / 4;
  let t = 0;
  let hr = false;
  let wall = false;
  const dt = 1 / 240;
  while (s.y > 0 && t < 12) {
    s = simulate(s.x, s.y, s.z, s.vx, s.vy, s.vz, dt);
    t += dt;
    const r = Math.hypot(s.x, s.z);
    if (!foul && r >= fenceR(Math.atan2(s.x, s.z))) {
      if (s.y > 3.1) hr = true;
      else wall = true;
      break;
    }
  }
  const dist = Math.hypot(s.x, s.z);
  const plan: HitPlan = { kind: "hit", label: "", dist, landT: t, lx: s.x, lz: s.z, fielder: -1 };
  if (wall) {
    plan.label = "Off the wall! Double!";
    return plan;
  }
  if (foul) {
    plan.kind = "foul";
    plan.label = "Foul ball";
    return plan;
  }
  if (hr) {
    plan.kind = "hr";
    plan.label = "HOME RUN!";
    return plan;
  }
  const ground = la < (10 * Math.PI) / 180;
  if (ground) {
    const fast = v >= 38;
    plan.kind = fast ? "hit" : "grounded";
    plan.label = fast ? "Single through the infield!" : "Grounded out";
    plan.dist = fast ? 45 : Math.min(dist, 30);
    plan.landT = fast ? 1.6 : 1.1;
    const ang = Math.atan2(s.x, s.z);
    plan.lx = Math.sin(ang) * plan.dist;
    plan.lz = Math.cos(ang) * plan.dist;
  }
  let bestF = 0;
  let bestT = Infinity;
  S.fielders.forEach((f, i) => {
    const reach = FIELDER_REACT + Math.hypot(f.hx - plan.lx, f.hz - plan.lz) / FIELDER_SPEED;
    if (reach < bestT) {
      bestT = reach;
      bestF = i;
    }
  });
  plan.fielder = bestF;
  if (plan.kind === "grounded") return plan;
  if (!ground && bestT <= plan.landT + 0.05) {
    plan.kind = "caught";
    plan.label = la > (50 * Math.PI) / 180 ? "Pop-up. Caught!" : "Caught! Fly out";
    return plan;
  }
  if (!ground) plan.label = dist < 55 ? "Single!" : dist < 80 ? "Double!" : "Triple!";
  return plan;
}

// ---------- audio ----------

function makeAudio() {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) => {
    if (!ac || !master) return;
    const now = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.008);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + dur + 0.05);
  };
  const hiss = (type: BiquadFilterType, freq: number, dur: number, vol: number, attack = 0.01, delay = 0) => {
    if (!ac || !master || !noise) return;
    const now = ac.currentTime + delay;
    const src = ac.createBufferSource();
    src.buffer = noise;
    src.loop = true;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    src.connect(f).connect(g).connect(master);
    src.start(now);
    src.stop(now + dur + 0.05);
  };
  return {
    unlock() {
      if (!ac) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        master = ac.createGain();
        master.connect(ac.destination);
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      }
      if (ac.state === "suspended") void ac.resume();
    },
    setMuted(m: boolean) {
      if (ac && master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
    },
    crack(q: number) {
      hiss("highpass", 1800, 0.12 + q * 0.15, 0.4 + q * 0.5, 0.002);
      tone("triangle", 1400 + q * 600, 500, 0.12, 0.2 + q * 0.2);
    },
    whiff() {
      hiss("bandpass", 900, 0.25, 0.3, 0.08);
    },
    mitt() {
      hiss("lowpass", 500, 0.12, 0.6, 0.002);
      tone("sine", 160, 60, 0.12, 0.3);
    },
    call() {
      tone("square", 520, 520, 0.12, 0.06);
      tone("square", 390, 390, 0.18, 0.06, 0.13);
    },
    cheer(big: boolean) {
      hiss("bandpass", 1200, big ? 2.6 : 1.2, big ? 0.35 : 0.18, 0.25);
      hiss("bandpass", 2400, big ? 2.2 : 1, big ? 0.2 : 0.1, 0.3);
      if (big) [523, 659, 784, 1047].forEach((f, i) => tone("square", f, f, 0.16, 0.07, 0.15 + i * 0.13));
    },
    groan() {
      hiss("lowpass", 350, 0.8, 0.25, 0.15);
    },
    catchPop() {
      hiss("lowpass", 700, 0.1, 0.4, 0.002);
    },
  };
}

type Audio = ReturnType<typeof makeAudio>;

// ---------- simulation ----------

function feedback(S: Game, text: string, sub: string, color: string) {
  S.feedback = { text, sub, color, t0: S.t };
}

function setMode(S: Game, m: Mode) {
  S.mode = m;
  S.modeT = 0;
}

function nextPitch(S: Game) {
  S.pitchN++;
  S.pitch = choosePitch(S.pitchN);
  S.pitchT = 0;
  S.swingT = -1;
  S.swung = false;
  S.missed = false;
  S.ball = { x: RELEASE.x, y: RELEASE.y, z: RELEASE.z, vx: 0, vy: 0, vz: 0, live: false, held: true };
  S.trail = [];
  S.plan = null;
  S.fielders = makeFielders();
  S.cam = { ...BAT_CAM };
  setMode(S, "pitch");
}

function addOut(S: Game, audio: Audio) {
  S.outs++;
  S.streak = 0;
  if (S.outs >= OUTS) audio.groan();
}

function endRound(S: Game) {
  setMode(S, "over");
  const prev = S.best;
  S.newBest = S.score > prev;
  S.best = Math.max(prev, S.score);
  S.unlocks = [
    ...MORPHS.filter((m) => prev < COLOR_UNLOCKS[m.id] && S.best >= COLOR_UNLOCKS[m.id]).map((m) => `${m.name} axolotl`),
    ...BATS.filter((b) => prev < b.need && S.best >= b.need).map((b) => `${b.name} bat`),
  ];
  try {
    localStorage.setItem(BEST_KEY, String(S.best));
  } catch {
    // storage unavailable; best just won't persist
  }
}

function confetti(S: Game) {
  const cols = ["#ff5f8f", "#ffd166", "#7ee0a0", "#7fd8ff", "#b69cff", "#ffffff"];
  for (let i = 0; i < 120; i++) {
    S.particles.push({
      x: rand(0, W),
      y: rand(-60, 0),
      vx: rand(-60, 60),
      vy: rand(60, 220),
      life: 0,
      max: rand(1.8, 3),
      r: rand(3, 6),
      color: cols[i % cols.length],
    });
  }
}

function trySwing(S: Game, audio: Audio, easyAim: boolean) {
  if (S.mode !== "pitch" || S.swung || !S.pitch) return;
  S.swung = true;
  S.swingT = 0;
  const p = S.pitch;
  const arrival = p.releaseAt + p.T;
  const contactAt = S.pitchT + SWING_LAG;
  const err = contactAt - arrival;
  if (S.pitchT < p.releaseAt || Math.abs(err) > 0.12) {
    audio.whiff();
    feedback(S, err < 0 ? "Way early" : "Too late", "Swing and a miss", "#ffd166");
    S.missed = true;
    return;
  }
  const at = pitchPos(p, 1);
  if (easyAim) S.cursorY = at.y + rand(-0.03, 0.05);
  const dy = at.y - S.cursorY;
  if (Math.abs(at.x) > 0.47) {
    audio.whiff();
    feedback(S, "Can't reach that!", "Swing and a miss", "#ffd166");
    S.missed = true;
    return;
  }
  if (Math.abs(dy) > 0.3) {
    audio.whiff();
    feedback(S, dy > 0 ? "Swung under it" : "Swung over it", "Swing and a miss", "#ffd166");
    S.missed = true;
    return;
  }
  const ae = Math.abs(err);
  const grade = ae <= 0.035 ? 3 : ae <= 0.075 ? 2 : 1;
  const base = [0, 31, 42, 48][grade] + rand(-1, 1);
  const q = 1 - clamp((Math.abs(dy) - 0.05) / 0.25, 0, 1) * 0.45;
  const v = base * q * (Math.abs(at.x) > 0.3 ? 0.85 : 1);
  const la = ((28 + (dy / 0.3) * 50 + rand(-3, 3)) * Math.PI) / 180;
  const spray = ((clamp(-err / 0.12, -1, 1) * 44 + at.x * 18) * Math.PI) / 180;
  S.ball.x = at.x;
  S.ball.y = at.y;
  S.ball.z = 0;
  S.ball.live = true;
  S.ball.held = false;
  S.plan = planHit(S, v, la, spray);
  S.flightT = 0;
  S.trail = [];
  const timing = grade === 3 ? "PERFECT!" : grade === 2 ? "Good contact" : err < 0 ? "A bit early" : "A bit late";
  feedback(S, timing, "", grade === 3 ? "#7fd8ff" : grade === 2 ? "#7ee0a0" : "#ffd166");
  audio.crack(grade === 3 ? 1 : grade === 2 ? 0.6 : 0.25);
  if (grade === 3) S.slow = 0.45;
  S.shake = grade === 3 ? 0.8 : 0.3;
  setMode(S, "flight");
  if (S.plan.fielder >= 0 && S.plan.kind !== "hr" && S.plan.kind !== "foul") {
    const f = S.fielders[S.plan.fielder];
    f.tx = S.plan.lx;
    f.tz = S.plan.lz;
  }
}

function resolvePlan(S: Game, audio: Audio) {
  const plan = S.plan;
  if (!plan) return;
  const ft = toFt(plan.dist);
  if (plan.kind === "hr") {
    S.streak++;
    const mult = 1 + 0.5 * (S.streak - 1);
    const pts = Math.round(ft * 2 * mult);
    S.score += pts;
    S.stats.hr++;
    S.stats.longest = Math.max(S.stats.longest, ft);
    feedback(S, "HOME RUN!", `${ft} ft · +${pts}${S.streak > 1 ? ` · streak x${mult}` : ""}`, "#ffd166");
    S.cheer = 3;
    confetti(S);
    audio.cheer(true);
  } else if (plan.kind === "hit") {
    const pts = ft;
    S.score += pts;
    S.stats.hits++;
    S.streak = 0;
    feedback(S, plan.label, `${ft} ft · +${pts}`, "#7ee0a0");
    S.cheer = 1;
    audio.cheer(false);
  } else {
    feedback(S, plan.label, plan.kind === "foul" ? "Out" : `${ft} ft · Out`, "#ff8a8a");
    if (plan.kind === "caught") audio.catchPop();
    addOut(S, audio);
  }
}

function step(S: Game, dtReal: number, audio: Audio) {
  S.slow = Math.max(0, S.slow - dtReal);
  const dt = S.slow > 0 ? dtReal * 0.3 : dtReal;
  S.t += dt;
  S.modeT += dt;
  S.cheer = Math.max(0, S.cheer - dt);
  S.shake *= Math.exp(-dtReal * 6);
  for (const p of S.particles) {
    p.life += dtReal;
    p.x += p.vx * dtReal;
    p.y += p.vy * dtReal;
    p.vx += Math.sin(p.life * 5 + p.r) * 30 * dtReal;
  }
  S.particles = S.particles.filter((p) => p.life < p.max && p.y < H + 20);
  if (S.swingT >= 0) S.swingT += dt;

  if (S.mode === "pitch" && S.pitch) {
    const p = S.pitch;
    S.pitchT += dt;
    if (S.pitchT >= p.releaseAt) {
      const u = (S.pitchT - p.releaseAt) / p.T;
      const pos = pitchPos(p, Math.min(u, 1.12));
      S.ball.x = pos.x;
      S.ball.y = pos.y;
      S.ball.z = pos.z;
      S.ball.held = false;
      if (u <= 1.1) S.trail.push({ ...pos });
      if (S.trail.length > 10) S.trail.shift();
      if (u >= 1.12) {
        audio.mitt();
        S.ball.held = true;
        const inZone = Math.abs(p.tx + p.breakX) <= ZONE.x + BALL_R && p.ty - p.drop >= ZONE.y0 - 0.05 && p.ty - p.drop <= ZONE.y1 + 0.05;
        if (S.missed) {
          if (S.feedback) S.feedback.sub = "Strike! · Out";
          addOut(S, audio);
        } else if (inZone) {
          audio.call();
          feedback(S, "Strike!", "Called strike · Out", "#ff8a8a");
          addOut(S, audio);
        } else {
          S.score += 25;
          feedback(S, "Ball", "Good eye! +25", "#d8e6f0");
        }
        S.lastPitch = `${PITCH_INFO[p.kind].name} · ${p.mph} mph`;
        setMode(S, "result");
      }
    }
  } else if (S.mode === "flight" && S.plan) {
    const plan = S.plan;
    S.flightT += dt;
    const b = S.ball;
    const stopAt = plan.kind === "caught" || plan.kind === "grounded" ? plan.landT : plan.landT + 1.2;
    if (!b.held) {
      if (plan.kind === "grounded" || (plan.kind === "hit" && plan.label.startsWith("Single through"))) {
        const u = clamp(S.flightT / plan.landT, 0, 1);
        b.x = lerp(0, plan.lx, u);
        b.z = lerp(0, plan.lz, u);
        b.y = BALL_R + Math.abs(Math.sin(u * 9)) * 0.4 * (1 - u);
      } else if (b.y > BALL_R || b.vy > 0) {
        const n = Math.max(1, Math.round(dt / (1 / 240)));
        for (let k = 0; k < n; k++) {
          const s = simulate(b.x, b.y, b.z, b.vx, b.vy, b.vz, dt / n);
          Object.assign(b, s);
        }
        const r = Math.hypot(b.x, b.z);
        const fr = fenceR(Math.atan2(b.x, b.z));
        if (plan.kind === "hit" && r >= fr - 0.3) {
          b.x *= (fr - 0.4) / r;
          b.z *= (fr - 0.4) / r;
          b.vx *= -0.3;
          b.vz *= -0.3;
        }
        if (b.y <= BALL_R) {
          b.y = BALL_R;
          if (plan.kind === "caught") b.held = true;
          else {
            b.vy = Math.abs(b.vy) * 0.3;
            b.vx *= 0.5;
            b.vz *= 0.5;
            if (Math.abs(b.vy) < 1.5) b.vy = 0;
          }
        }
      } else {
        b.x += b.vx * dt;
        b.z += b.vz * dt;
        b.vx *= Math.exp(-dt * 1.5);
        b.vz *= Math.exp(-dt * 1.5);
      }
      S.trail.push({ x: b.x, y: b.y, z: b.z });
      if (S.trail.length > 14) S.trail.shift();
    }
    for (const [i, f] of S.fielders.entries()) {
      if (i !== plan.fielder || S.flightT < FIELDER_REACT) continue;
      const dx = f.tx - f.x;
      const dz = f.tz - f.z;
      const d = Math.hypot(dx, dz);
      const mv = Math.min(d, FIELDER_SPEED * dt);
      if (d > 0.01) {
        f.x += (dx / d) * mv;
        f.z += (dz / d) * mv;
      }
      f.catching = plan.kind === "caught" && S.flightT > plan.landT - 0.4;
    }
    if (S.flightT >= stopAt) {
      resolvePlan(S, audio);
      setMode(S, "result");
    }

    const c = S.cam;
    const tx = b.x;
    const ty = Math.max(b.y, 1);
    const tz = b.z;
    const dx = tx - FLIGHT_CAM_POS.x;
    const dy = ty - FLIGHT_CAM_POS.y;
    const dz = tz - FLIGHT_CAM_POS.z;
    const yaw = Math.atan2(dx, dz);
    const pitchAng = -Math.atan2(dy, Math.hypot(dx, dz)) + 0.08;
    const k = 1 - Math.exp(-dt * 5);
    c.x = lerp(c.x, FLIGHT_CAM_POS.x, k);
    c.y = lerp(c.y, FLIGHT_CAM_POS.y, k);
    c.z = lerp(c.z, FLIGHT_CAM_POS.z, k);
    c.yaw = lerp(c.yaw, yaw, k);
    c.pitch = lerp(c.pitch, clamp(pitchAng, -0.9, 0.25), k);
    c.f = lerp(c.f, clamp(Math.hypot(dx, dy, dz) * 14, 520, 1300), k);
  } else if (S.mode === "result") {
    const hold = S.plan ? 1.8 : 1.3;
    if (S.modeT > hold) {
      if (S.outs >= OUTS) endRound(S);
      else nextPitch(S);
    }
  }
}

// ---------- characters ----------

function drawGill(ctx: CanvasRenderingContext2D, m: Morph, bx: number, by: number, ang: number, len: number, w: number) {
  const ex = bx + Math.cos(ang) * len;
  const ey = by + Math.sin(ang) * len;
  for (let pass = 0; pass < 2; pass++) {
    const col = pass === 0 ? m.outline : m.gill;
    const grow = pass === 0 ? w * 0.5 : 0;
    ctx.strokeStyle = col;
    ctx.fillStyle = col;
    ctx.lineWidth = w + grow;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(ex, ey);
    ctx.stroke();
    for (let j = 0; j < 3; j++) {
      const u = 0.45 + j * 0.22;
      const side = j % 2 === 0 ? 1 : -1;
      const px = bx + Math.cos(ang) * len * u - Math.sin(ang) * w * side;
      const py = by + Math.sin(ang) * len * u + Math.cos(ang) * w * side;
      ctx.beginPath();
      ctx.ellipse(px, py, w * 1.2 + grow / 2, w * 0.7 + grow / 2, ang + side * 0.6, 0, TAU);
      ctx.fill();
    }
    ctx.beginPath();
    ctx.arc(ex, ey, w * 0.9 + grow / 2, 0, TAU);
    ctx.fill();
  }
}

type FrontPose = "set" | "windup" | "throw" | "run" | "catch" | "cheer" | "idle";

// Front-facing cartoon axolotl. (x, y) = feet, h = total height in px.
function drawAxoFront(ctx: CanvasRenderingContext2D, x: number, y: number, h: number, m: Morph, team: string, pose: FrontPose, t: number, ball?: string) {
  if (h < 3) return;
  const s = h / 100;
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const bounce = pose === "run" ? Math.abs(Math.sin(t * 14)) * 6 : pose === "cheer" ? Math.abs(Math.sin(t * 9)) * 10 : 0;
  ctx.translate(0, -bounce);

  ctx.fillStyle = "rgba(0,0,0,0.25)";
  ctx.beginPath();
  ctx.ellipse(0, bounce, 24, 5, 0, 0, TAU);
  ctx.fill();

  // tail peeking out
  ctx.fillStyle = m.body;
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(10, -8);
  ctx.quadraticCurveTo(34, -6, 38, -22 + Math.sin(t * 4) * 3);
  ctx.quadraticCurveTo(28, -14, 10, -18);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // legs
  const legSwing = pose === "run" ? Math.sin(t * 14) * 8 : 0;
  const lift = pose === "windup" ? 1 : 0;
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 12;
  ctx.beginPath();
  ctx.moveTo(-9, -20);
  ctx.lineTo(-11 + legSwing, -2);
  ctx.moveTo(9, -20);
  ctx.lineTo(11 - legSwing - lift * 8, -2 - lift * 22);
  ctx.stroke();
  ctx.strokeStyle = m.body;
  ctx.lineWidth = 8;
  ctx.stroke();

  // body + jersey
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(0, -36, 19, 25, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = team;
  ctx.beginPath();
  ctx.ellipse(0, -36, 17, 23, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.belly;
  ctx.beginPath();
  ctx.ellipse(0, -22, 11, 8, 0, 0, TAU);
  ctx.fill();

  // arms
  const armL: [number, number] =
    pose === "cheer" ? [-26, -78] : pose === "catch" ? [-20, -70] : pose === "windup" ? [-24, -52] : pose === "throw" ? [-22, -40] : [-22, -32];
  const armR: [number, number] =
    pose === "cheer" ? [26, -78] : pose === "windup" ? [30, -70] : pose === "throw" ? [22, -60] : pose === "catch" ? [20, -70] : [22, -32];
  for (const [ax, ay] of [armL, armR]) {
    ctx.strokeStyle = m.outline;
    ctx.lineWidth = 9;
    ctx.beginPath();
    ctx.moveTo(Math.sign(ax) * 13, -48);
    ctx.lineTo(ax, ay);
    ctx.stroke();
    ctx.strokeStyle = m.body;
    ctx.lineWidth = 6;
    ctx.stroke();
  }
  circle(ctx, armL[0], armL[1], 7.5, "#7a4a24");
  circle(ctx, armL[0], armL[1], 4.5, "#a0683a");
  if (ball) {
    circle(ctx, armR[0], armR[1], 9, `${ball}88`);
    circle(ctx, armR[0], armR[1], 4.5, "#ffffff");
  } else circle(ctx, armR[0], armR[1], 4, m.body);

  // gills behind head
  const hy = -72;
  const flap = Math.sin(t * 5) * 0.08;
  for (let k = 0; k < 3; k++) {
    const a = [-0.75, -0.3, 0.15][k];
    drawGill(ctx, m, -20, hy - 4 + k * 6, Math.PI - a - flap, 18 - k * 2, 3.2);
    drawGill(ctx, m, 20, hy - 4 + k * 6, a + flap, 18 - k * 2, 3.2);
  }
  // head
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(0, hy, 27, 22, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.body;
  ctx.beginPath();
  ctx.ellipse(0, hy, 25, 20, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.4)";
  ctx.beginPath();
  ctx.ellipse(-8, hy - 12, 9, 4, -0.2, 0, TAU);
  ctx.fill();
  // cap
  ctx.fillStyle = team;
  ctx.beginPath();
  ctx.ellipse(0, hy - 10, 22, 13, 0, Math.PI, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(0, hy - 10, 18, 4.5, 0, 0, TAU);
  ctx.fill();
  // face
  const blink = Math.sin(t * 1.3 + x) > 0.985;
  for (const ex of [-9, 9]) {
    if (blink || pose === "cheer") {
      ctx.strokeStyle = m.eye;
      ctx.lineWidth = 2.2;
      ctx.beginPath();
      ctx.arc(ex, hy + 2, 3.5, Math.PI * 1.1, Math.PI * 1.9);
      ctx.stroke();
    } else {
      circle(ctx, ex, hy, 4.2, m.eye);
      circle(ctx, ex - 1.3, hy - 1.5, 1.5, "#ffffff");
    }
  }
  ctx.globalAlpha = 0.55;
  circle(ctx, -15, hy + 7, 3.5, m.blush);
  circle(ctx, 15, hy + 7, 3.5, m.blush);
  ctx.globalAlpha = 1;
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 1.8;
  ctx.beginPath();
  if (pose === "cheer") ctx.arc(0, hy + 6, 5, 0.1, Math.PI - 0.1);
  else {
    ctx.moveTo(-5, hy + 8);
    ctx.quadraticCurveTo(-2.5, hy + 11, 0, hy + 8);
    ctx.quadraticCurveTo(2.5, hy + 11, 5, hy + 8);
  }
  ctx.stroke();
  ctx.restore();
}

// Bat silhouette as (position along bat, half-thickness): knob, thin handle, taper, fat barrel.
const BAT_PROFILE: [number, number][] = [
  [-0.07, 1.6],
  [-0.065, 4.6],
  [-0.045, 4.6],
  [-0.03, 2.5],
  [0.3, 2.6],
  [0.45, 3.4],
  [0.6, 5.6],
  [0.74, 7.6],
  [0.97, 8.2],
];

function drawBat(ctx: CanvasRenderingContext2D, bat: Bat, x: number, y: number, theta: number, len: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(theta);
  const endR = BAT_PROFILE[BAT_PROFILE.length - 1][1];
  const shape = () => {
    ctx.beginPath();
    BAT_PROFILE.forEach(([u, w], i) => (i === 0 ? ctx.moveTo(u * len, -w) : ctx.lineTo(u * len, -w)));
    ctx.ellipse(0.97 * len, 0, endR * 0.7, endR, 0, -Math.PI / 2, Math.PI / 2);
    for (let i = BAT_PROFILE.length - 1; i >= 0; i--) ctx.lineTo(BAT_PROFILE[i][0] * len, BAT_PROFILE[i][1]);
    ctx.closePath();
  };
  shape();
  ctx.fillStyle = bat.barrel;
  ctx.fill();
  ctx.save();
  ctx.clip();
  if (bat.stripe) {
    ctx.strokeStyle = bat.stripe;
    ctx.lineWidth = 4;
    for (let k = 0; k < 9; k++) {
      const bx = (0.32 + k * 0.08) * len;
      ctx.beginPath();
      ctx.moveTo(bx - 5, -10);
      ctx.lineTo(bx + 5, 10);
      ctx.stroke();
    }
  } else if (bat.id === "wood") {
    ctx.strokeStyle = "rgba(90,50,20,0.25)";
    ctx.lineWidth = 0.8;
    for (const gy of [-4.5, -1, 2.5, 5.5]) {
      ctx.beginPath();
      ctx.moveTo(0.4 * len, gy * 0.5);
      ctx.quadraticCurveTo(0.7 * len, gy, len, gy * 1.05);
      ctx.stroke();
    }
  }
  const shade = ctx.createLinearGradient(0, -9, 0, 9);
  shade.addColorStop(0, "rgba(255,255,255,0.55)");
  shade.addColorStop(0.35, "rgba(255,255,255,0.08)");
  shade.addColorStop(1, "rgba(0,0,0,0.3)");
  ctx.fillStyle = shade;
  ctx.fillRect(-0.1 * len, -10, len * 1.15, 20);
  ctx.fillStyle = bat.handle;
  ctx.fillRect(-0.03 * len, -4, 0.3 * len, 8);
  ctx.strokeStyle = "rgba(0,0,0,0.25)";
  ctx.lineWidth = 0.8;
  for (let k = 0; k < 7; k++) {
    const gx = (-0.02 + k * 0.045) * len;
    ctx.beginPath();
    ctx.moveTo(gx, -3);
    ctx.lineTo(gx + 2.5, 3);
    ctx.stroke();
  }
  ctx.restore();
  shape();
  ctx.strokeStyle = "rgba(40,25,15,0.7)";
  ctx.lineWidth = 1.4;
  ctx.stroke();
  ctx.restore();
}

// Batter seen from behind, facing right toward the plate. (x, y) = feet, s = px per cm.
function drawBatter(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, m: Morph, bat: Bat, swingT: number, t: number, cheer: boolean) {
  ctx.save();
  ctx.translate(x, y);
  ctx.scale(s, s);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const sw = swingT < 0 ? 0 : clamp(swingT / 0.32, 0, 1);
  const turn = sw * 10;
  const bob = Math.sin(t * 2.5) * 1.5 * (sw === 0 ? 1 : 0);

  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  ctx.ellipse(0, 0, 55, 10, 0, 0, TAU);
  ctx.fill();

  // tail
  ctx.fillStyle = m.fin;
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-18, -24);
  ctx.quadraticCurveTo(-60, -10, -78, -34 + Math.sin(t * 3) * 4);
  ctx.quadraticCurveTo(-62, -22, -52, -18);
  ctx.quadraticCurveTo(-40, -8, -10, -10);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // legs
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 17;
  ctx.beginPath();
  ctx.moveTo(-14, -30);
  ctx.lineTo(-24, -3);
  ctx.moveTo(14, -30);
  ctx.lineTo(26 + turn * 0.5, -3);
  ctx.stroke();
  ctx.strokeStyle = "#f4f4f4";
  ctx.lineWidth = 13;
  ctx.stroke();
  circle(ctx, -24, -3, 8, "#2a2a2a");
  circle(ctx, 26 + turn * 0.5, -3, 8, "#2a2a2a");

  // body + jersey (back)
  ctx.translate(turn, bob);
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(0, -62, 31, 40, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ff5f8f";
  ctx.beginPath();
  ctx.ellipse(0, -62, 28.5, 37.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.18)";
  ctx.beginPath();
  ctx.ellipse(-10, -76, 10, 18, -0.2, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.font = "900 15px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AXO", 0, -78);
  ctx.font = "900 30px system-ui, sans-serif";
  ctx.fillText("1", 0, -48);

  // gills out from under the helmet
  const hy = -122;
  const flap = Math.sin(t * 4) * 0.08 + sw * 0.25;
  for (let k = 0; k < 3; k++) {
    const a = [-0.8, -0.35, 0.1][k];
    drawGill(ctx, m, -26, hy + k * 8, Math.PI - a - flap, 30 - k * 3, 5);
    drawGill(ctx, m, 30, hy + k * 8, a + flap * 0.5, 22 - k * 3, 4.5);
  }
  // head
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(4, hy, 35, 29, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.body;
  ctx.beginPath();
  ctx.ellipse(4, hy, 32.5, 26.5, 0, 0, TAU);
  ctx.fill();
  // helmet
  const hg = ctx.createLinearGradient(0, hy - 30, 0, hy + 4);
  hg.addColorStop(0, "#ff7aa2");
  hg.addColorStop(1, "#d93d6b");
  ctx.fillStyle = hg;
  ctx.beginPath();
  ctx.ellipse(4, hy - 4, 33, 26, 0, Math.PI * 1.02, TAU * 0.99);
  ctx.lineTo(37, hy + 2);
  ctx.lineTo(-29, hy + 2);
  ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.45)";
  ctx.beginPath();
  ctx.ellipse(-6, hy - 20, 12, 5, -0.3, 0, TAU);
  ctx.fill();

  // arms + bat
  const hands = { x: 24, y: -80 };
  const theta = sw < 0.45 ? lerp(-2.35, 0.25, 1 - Math.pow(1 - sw / 0.45, 2)) : lerp(0.25, 1.9, (sw - 0.45) / 0.55);
  const len = 96 * (sw < 0.45 ? 1 : lerp(1, 0.35, (sw - 0.45) / 0.55));
  const handPos = sw === 0 ? { x: 20, y: -92 } : { x: lerp(20, hands.x + 10, Math.min(1, sw * 2)), y: lerp(-92, hands.y, Math.min(1, sw * 2)) };
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 11;
  ctx.beginPath();
  ctx.moveTo(18, -84);
  ctx.lineTo(handPos.x, handPos.y);
  ctx.stroke();
  ctx.strokeStyle = m.body;
  ctx.lineWidth = 7;
  ctx.stroke();
  drawBat(ctx, bat, handPos.x, handPos.y, theta, len);
  circle(ctx, handPos.x, handPos.y, 7, m.outline);
  circle(ctx, handPos.x, handPos.y, 5.5, m.body);
  if (sw > 0 && sw < 0.6) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 10;
    ctx.beginPath();
    ctx.arc(handPos.x, handPos.y, len * 0.85, theta - 0.9, theta);
    ctx.stroke();
  }
  if (cheer) {
    ctx.fillStyle = "#ffd166";
    ctx.font = "900 26px system-ui, sans-serif";
    ctx.fillText("★", -40 + Math.sin(t * 6) * 6, hy - 40);
    ctx.fillText("★", 50 + Math.cos(t * 6) * 6, hy - 46);
  }
  ctx.restore();
}

// ---------- ballpark ----------

function drawSky(ctx: CanvasRenderingContext2D, c: Cam, t: number) {
  const horizon = H / 2 - c.f * Math.tan(c.pitch);
  const g = ctx.createLinearGradient(0, Math.min(horizon - 500, 0), 0, horizon);
  g.addColorStop(0, "#3f8fd8");
  g.addColorStop(1, "#cfe9f6");
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  const off = -c.yaw * c.f * 0.6;
  for (let k = 0; k < 7; k++) {
    const cx = ((((hash1(k, 3) * W * 2 + off + t * 5) % (W * 2)) + W * 2) % (W * 2)) - W * 0.5;
    const cy = horizon - 150 - hash1(k, 5) * 160;
    for (let j = 0; j < 5; j++) {
      const r = 20 + hash1(k * 9 + j, 7) * 22;
      const gx = cx + j * 24;
      const gy = cy - (j % 2) * 12;
      const cg = ctx.createRadialGradient(gx, gy, 0, gx, gy, r);
      cg.addColorStop(0, "rgba(255,255,255,0.75)");
      cg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = cg;
      ctx.beginPath();
      ctx.arc(gx, gy, r, 0, TAU);
      ctx.fill();
    }
  }
  ctx.fillStyle = "#3f8c3c";
  ctx.fillRect(0, horizon, W, H - horizon + 1);
}

function drawPark(ctx: CanvasRenderingContext2D, S: Game, c: Cam) {
  const t = S.t;
  drawSky(ctx, c, t);

  // mowed grass stripes
  for (let k = -12; k < 12; k++) {
    const x0 = k * 8;
    fillPoly(
      ctx,
      c,
      [
        [x0, 0, -5],
        [x0 + 8, 0, -5],
        [x0 + 8, 0, 140],
        [x0, 0, 140],
      ],
      k % 2 === 0 ? "#4fa04a" : "#47953f",
    );
  }
  // warning track
  const arc = (r0: number, r1: number, a0: number, a1: number, n: number) => {
    const pts: [number, number, number][] = [];
    for (let i = 0; i <= n; i++) {
      const a = lerp(a0, a1, i / n);
      pts.push([Math.sin(a) * r0(a), 0, Math.cos(a) * r0(a)]);
    }
    for (let i = n; i >= 0; i--) {
      const a = lerp(a0, a1, i / n);
      pts.push([Math.sin(a) * r1(a), 0, Math.cos(a) * r1(a)]);
    }
    return pts;
  };
  fillPoly(ctx, c, arc((a) => fenceR(a) - 4, (a) => fenceR(a) + 0.5, -Math.PI / 4, Math.PI / 4, 30), "#c49a6c");
  // infield dirt
  const dirt: [number, number, number][] = [
    [-4, 0, -2],
    [4, 0, -2],
  ];
  for (let i = 0; i <= 24; i++) {
    const a = lerp(1.75, -1.75, i / 24);
    dirt.push([Math.sin(a) * 29, 0, 18.4 + Math.cos(a) * 29]);
  }
  fillPoly(ctx, c, dirt, "#c9925a");
  fillPoly(
    ctx,
    c,
    [
      [0, 0, 4.5],
      [16, 0, 19.4],
      [0, 0, 34],
      [-16, 0, 19.4],
    ],
    "#4ea449",
  );
  fillPoly(ctx, c, groundCircle(0, 18.4, 2.8, 0.02), "#c9925a");
  fillPoly(ctx, c, groundCircle(0, 18.4, 1.2, 0.2), "#d6a26a");
  fillPoly(
    ctx,
    c,
    [
      [-0.3, 0.21, 18.2],
      [0.3, 0.21, 18.2],
      [0.3, 0.21, 18.35],
      [-0.3, 0.21, 18.35],
    ],
    "#ffffff",
  );
  fillPoly(ctx, c, groundCircle(0, 0, 4, 0.01), "#c9925a");
  // chalk lines
  for (const sgn of [-1, 1]) {
    const r = LINE_R;
    const e = r / Math.SQRT2;
    fillPoly(
      ctx,
      c,
      [
        [0, 0.015, 0],
        [sgn * e, 0.015, e],
        [sgn * e + 0.12, 0.015, e - 0.12 * sgn],
        [0.12 * sgn, 0.015, -0.12],
      ],
      "rgba(255,255,255,0.9)",
    );
  }
  for (const [bx, bz] of [
    [19.4, 19.4],
    [0, 38.8],
    [-19.4, 19.4],
  ]) {
    fillPoly(
      ctx,
      c,
      [
        [bx - 0.23, 0.05, bz],
        [bx, 0.05, bz - 0.23],
        [bx + 0.23, 0.05, bz],
        [bx, 0.05, bz + 0.23],
      ],
      "#ffffff",
    );
  }
  // batter's boxes
  for (const sgn of [-1, 1]) {
    const x0 = sgn * 0.45;
    const x1 = sgn * 1.65;
    const box: [number, number, number][] = [
      [x0, 0.012, -0.9],
      [x1, 0.012, -0.9],
      [x1, 0.012, 0.9],
      [x0, 0.012, 0.9],
    ];
    if (polyPath(ctx, c, box)) {
      ctx.strokeStyle = "rgba(255,255,255,0.8)";
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }
  fillPoly(
    ctx,
    c,
    [
      [-0.216, 0.02, 0.22],
      [0.216, 0.02, 0.22],
      [0.216, 0.02, 0],
      [0, 0.02, -0.216],
      [-0.216, 0.02, 0],
    ],
    "#ffffff",
  );

  // stands, crowd, fence, scoreboard
  const A0 = -1.25;
  const A1 = 1.25;
  const N = 44;
  const standR = (a: number) => (Math.abs(a) <= Math.PI / 4 ? fenceR(a) : LINE_R - (Math.abs(a) - Math.PI / 4) * 30);
  for (let i = 0; i < N; i++) {
    const a0 = lerp(A0, A1, i / N);
    const a1 = lerp(A0, A1, (i + 1) / N);
    const r0 = standR(a0);
    const r1 = standR(a1);
    fillPoly(
      ctx,
      c,
      [
        [Math.sin(a0) * (r0 + 1), 3.2, Math.cos(a0) * (r0 + 1)],
        [Math.sin(a1) * (r1 + 1), 3.2, Math.cos(a1) * (r1 + 1)],
        [Math.sin(a1) * (r1 + 26), 18, Math.cos(a1) * (r1 + 26)],
        [Math.sin(a0) * (r0 + 26), 18, Math.cos(a0) * (r0 + 26)],
      ],
      i % 2 ? "#5b6f8a" : "#566a84",
    );
  }
  const cheer = S.cheer > 0 ? Math.min(1, S.cheer) : 0;
  for (let row = 5; row >= 0; row--) {
    for (let i = 0; i < 70; i++) {
      const a = lerp(A0 + 0.02, A1 - 0.02, (i + (row % 2) * 0.5) / 70);
      const r = standR(a) + 4 + row * 4;
      const seed = row * 100 + i;
      const jump = cheer * Math.abs(Math.sin(t * 9 + hash1(seed, 1) * 6)) * 0.8;
      const p = project(c, Math.sin(a) * r, 4.4 + row * 2.4 + jump, Math.cos(a) * r);
      if (!p || p.x < -10 || p.x > W + 10) continue;
      const m = MORPHS[Math.floor(hash1(seed, 2) * MORPHS.length)];
      const rr = 0.75 * p.s;
      const shirt = ["#ff5f8f", "#ffd166", "#7fd8ff", "#ffffff"][Math.floor(hash1(seed, 4) * 4)];
      circle(ctx, p.x, p.y + rr * 1.3, rr * 0.9, shirt);
      circle(ctx, p.x, p.y, rr, m.body);
      if (rr > 3) {
        circle(ctx, p.x - rr * 0.35, p.y - rr * 0.1, rr * 0.16, m.eye);
        circle(ctx, p.x + rr * 0.35, p.y - rr * 0.1, rr * 0.16, m.eye);
        circle(ctx, p.x - rr * 1.05, p.y - rr * 0.1, rr * 0.3, m.gill);
        circle(ctx, p.x + rr * 1.05, p.y - rr * 0.1, rr * 0.3, m.gill);
      }
      if (cheer > 0 && rr > 2 && hash1(seed, 6) < 0.3) {
        circle(ctx, p.x + rr * 1.2, p.y - rr * 1.4, rr * 0.35, m.body);
      }
    }
  }
  for (let i = 0; i < 40; i++) {
    const a0 = lerp(-Math.PI / 4, Math.PI / 4, i / 40);
    const a1 = lerp(-Math.PI / 4, Math.PI / 4, (i + 1) / 40);
    const r0 = fenceR(a0);
    const r1 = fenceR(a1);
    fillPoly(
      ctx,
      c,
      [
        [Math.sin(a0) * r0, 0, Math.cos(a0) * r0],
        [Math.sin(a1) * r1, 0, Math.cos(a1) * r1],
        [Math.sin(a1) * r1, 3, Math.cos(a1) * r1],
        [Math.sin(a0) * r0, 3, Math.cos(a0) * r0],
      ],
      "#1f5f3a",
    );
    fillPoly(
      ctx,
      c,
      [
        [Math.sin(a0) * r0, 2.85, Math.cos(a0) * r0],
        [Math.sin(a1) * r1, 2.85, Math.cos(a1) * r1],
        [Math.sin(a1) * r1, 3.05, Math.cos(a1) * r1],
        [Math.sin(a0) * r0, 3.05, Math.cos(a0) * r0],
      ],
      "#ffd166",
    );
  }
  for (const a of [-Math.PI / 4 + 0.03, -Math.PI / 8, 0, Math.PI / 8, Math.PI / 4 - 0.03]) {
    const r = fenceR(a) - 0.1;
    const p = project(c, Math.sin(a) * r, 1.5, Math.cos(a) * r);
    if (!p || p.s < 1.5) continue;
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `900 ${Math.round(p.s * 1.4)}px system-ui, sans-serif`;
    ctx.fillText(String(toFt(fenceR(a))), p.x, p.y + p.s * 0.5);
  }
  // foul poles
  for (const sgn of [-1, 1]) {
    const r = LINE_R;
    const e = r / Math.SQRT2;
    fillPoly(
      ctx,
      c,
      [
        [sgn * e - 0.2, 0, e],
        [sgn * e + 0.2, 0, e],
        [sgn * e + 0.2, 16, e],
        [sgn * e - 0.2, 16, e],
      ],
      "#ffd166",
    );
  }
  // scoreboard
  const sbR = fenceR(0) + 30;
  if (
    polyPath(ctx, c, [
      [-18, 16, sbR],
      [18, 16, sbR],
      [18, 30, sbR],
      [-18, 30, sbR],
    ])
  ) {
    ctx.fillStyle = "#1c2733";
    ctx.fill();
    ctx.strokeStyle = "#ffd166";
    ctx.lineWidth = 3;
    ctx.stroke();
    const p = project(c, 0, 25.5, sbR - 0.1);
    const q = project(c, 0, 19.5, sbR - 0.1);
    if (p && q && p.s > 1) {
      ctx.textAlign = "center";
      const hrFlash = S.plan?.kind === "hr" && S.mode === "result" && Math.floor(t * 4) % 2 === 0;
      ctx.fillStyle = hrFlash ? "#ffd166" : "#ff7aa2";
      ctx.font = `900 ${Math.round(p.s * 4.2)}px system-ui, sans-serif`;
      ctx.fillText(hrFlash ? "HOME RUN!" : "AXOLOTL PARK", p.x, p.y);
      ctx.fillStyle = "#ffffff";
      ctx.font = `800 ${Math.round(q.s * 3.4)}px system-ui, sans-serif`;
      ctx.fillText(`SCORE ${S.score}   OUTS ${S.outs}/${OUTS}`, q.x, q.y);
    }
  }
  // light towers
  for (const a of [-0.95, 0.95]) {
    const r = standR(a) + 30;
    const bx = Math.sin(a) * r;
    const bz = Math.cos(a) * r;
    fillPoly(
      ctx,
      c,
      [
        [bx - 0.5, 0, bz],
        [bx + 0.5, 0, bz],
        [bx + 0.5, 34, bz],
        [bx - 0.5, 34, bz],
      ],
      "#8a96a6",
    );
    fillPoly(
      ctx,
      c,
      [
        [bx - 5, 32, bz],
        [bx + 5, 32, bz],
        [bx + 5, 38, bz],
        [bx - 5, 38, bz],
      ],
      "#e8eef4",
    );
  }

  // fielders, far to near
  const teams = "#3a78c2";
  const order = S.fielders.map((f, i) => ({ f, i, z: toCam(c, f.x, 0, f.z)[2] })).sort((a, b) => b.z - a.z);
  for (const { f, i } of order) {
    const p = project(c, f.x, 0, f.z);
    if (!p) continue;
    const moving = Math.hypot(f.tx - f.x, f.tz - f.z) > 0.3 && S.mode === "flight" && S.plan?.fielder === i;
    const pose: FrontPose = f.catching ? "catch" : moving ? "run" : "idle";
    drawAxoFront(ctx, p.x, p.y, 1.5 * p.s, MORPHS[f.morph], teams, pose, t + i);
  }
}

function drawBall(ctx: CanvasRenderingContext2D, S: Game, c: Cam) {
  const b = S.ball;
  if (b.held && S.mode !== "pitch") return;
  if (S.mode === "pitch" && S.pitch && S.pitchT < S.pitch.releaseAt) return;
  const sh = project(c, b.x, 0.01, b.z);
  const p = project(c, b.x, b.y, b.z);
  if (!p) return;
  if (sh) {
    ctx.fillStyle = "rgba(0,0,0,0.3)";
    ctx.beginPath();
    ctx.ellipse(sh.x, sh.y, Math.max(2, BALL_R * sh.s * 2), Math.max(1, BALL_R * sh.s * 0.7), 0, 0, TAU);
    ctx.fill();
  }
  const trailCol = S.mode === "pitch" && S.pitch ? PITCH_INFO[S.pitch.kind].trail : "255,255,255";
  S.trail.forEach((q, i) => {
    const tp = project(c, q.x, q.y, q.z);
    if (!tp) return;
    const a = (i / S.trail.length) * 0.5;
    circle(ctx, tp.x, tp.y, Math.max(1.5, BALL_R * tp.s * 1.6) * (0.4 + i / S.trail.length * 0.6), `rgba(${trailCol},${a})`);
  });
  const r = Math.max(S.mode === "pitch" ? 3 : 4.5, BALL_R * p.s * 1.7);
  if (S.mode !== "pitch") circle(ctx, p.x, p.y, r * 2.2, "rgba(255,255,255,0.25)");
  if (S.mode === "pitch" && S.pitch?.kind === "bubble") {
    const g = ctx.createRadialGradient(p.x - r * 0.3, p.y - r * 0.3, 0, p.x, p.y, r * 1.5);
    g.addColorStop(0, "rgba(255,255,255,0.95)");
    g.addColorStop(0.6, "rgba(180,230,255,0.6)");
    g.addColorStop(1, "rgba(200,160,255,0.2)");
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 1.5, 0, TAU);
    ctx.fill();
  }
  circle(ctx, p.x, p.y, r, "#ffffff");
  ctx.strokeStyle = "#d33";
  ctx.lineWidth = Math.max(0.8, r * 0.18);
  const spin = S.t * 30;
  ctx.beginPath();
  ctx.arc(p.x - r * 0.9, p.y, r * 0.75, -0.9 + spin, 0.9 + spin);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(p.x + r * 0.9, p.y, r * 0.75, Math.PI - 0.9 + spin, Math.PI + 0.9 + spin);
  ctx.stroke();
}

function drawZone(ctx: CanvasRenderingContext2D, S: Game, c: Cam, easyAim: boolean) {
  const tl = project(c, -ZONE.x, ZONE.y1, 0);
  const br = project(c, ZONE.x, ZONE.y0, 0);
  if (!tl || !br) return;
  ctx.strokeStyle = "rgba(255,255,255,0.55)";
  ctx.lineWidth = 2;
  ctx.setLineDash([6, 5]);
  ctx.strokeRect(tl.x, tl.y, br.x - tl.x, br.y - tl.y);
  ctx.setLineDash([]);
  if (easyAim) return;
  const cp = project(c, 0, S.cursorY, 0);
  if (!cp) return;
  const r = 0.09 * cp.s;
  ctx.strokeStyle = "rgba(255,209,102,0.95)";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.ellipse(cp.x, cp.y, r * 1.6, r, 0, 0, TAU);
  ctx.stroke();
  ctx.fillStyle = "rgba(255,209,102,0.18)";
  ctx.fill();
  ctx.beginPath();
  ctx.moveTo(cp.x - r * 2.2, cp.y);
  ctx.lineTo(cp.x - r * 1.7, cp.y);
  ctx.moveTo(cp.x + r * 1.7, cp.y);
  ctx.lineTo(cp.x + r * 2.2, cp.y);
  ctx.stroke();
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0,0,0,0.5)";
  ctx.fillText(s, x + 1.5, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, S: Game) {
  const t = S.t;
  if (S.mode !== "title") {
    ctx.fillStyle = "rgba(10,20,30,0.55)";
    roundRect(ctx, 14, 14, 236, 92, 12);
    ctx.fill();
    text(ctx, S.score.toLocaleString(), 28, 50, "900 30px system-ui, sans-serif", "#ffe08a");
    text(ctx, `Best ${S.best.toLocaleString()}`, 236, 48, "600 12px system-ui, sans-serif", "#d8e6f0", "right");
    text(ctx, "OUTS", 28, 88, "800 11px system-ui, sans-serif", "#d8e6f0");
    for (let i = 0; i < OUTS; i++) circle(ctx, 76 + i * 17, 84, 6, i < S.outs ? "#ff6b6b" : "rgba(255,255,255,0.25)");
    if (S.streak > 1) text(ctx, `HR streak x${1 + 0.5 * (S.streak - 1)}`, 28, 128, "900 16px system-ui, sans-serif", "#ffd166");
    if (S.lastPitch) {
      ctx.fillStyle = "rgba(10,20,30,0.5)";
      roundRect(ctx, W - 214, 14, 200, 40, 12);
      ctx.fill();
      text(ctx, S.lastPitch, W - 26, 39, "700 13px system-ui, sans-serif", "#ffffff", "right");
    }
  }
  if (S.feedback && S.mode !== "title" && S.mode !== "over") {
    const age = S.t - S.feedback.t0;
    if (age < 2.2) {
      ctx.globalAlpha = clamp(Math.min(age * 6, (2.2 - age) * 3), 0, 1);
      const pop = 1 + 0.2 * Math.exp(-age * 10);
      ctx.save();
      ctx.translate(W / 2, H * 0.3);
      ctx.scale(pop, pop);
      text(ctx, S.feedback.text, 0, 0, "900 46px system-ui, sans-serif", S.feedback.color, "center");
      ctx.restore();
      if (S.feedback.sub) text(ctx, S.feedback.sub, W / 2, H * 0.3 + 34, "700 18px system-ui, sans-serif", "#ffffff", "center");
      ctx.globalAlpha = 1;
    }
  }

  if (S.mode === "title") {
    ctx.fillStyle = "rgba(8,14,24,0.4)";
    ctx.fillRect(0, 0, W, H);
    text(ctx, "Axolotl Home Run Derby", W / 2, 150, "900 54px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, "10 outs. Swing for the fences!", W / 2, 190, "600 20px system-ui, sans-serif", "#e8f0f6", "center");
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
    text(ctx, "Press Space or click to play ball", W / 2, 244, "800 22px system-ui, sans-serif", "#ffe08a", "center");
    ctx.globalAlpha = 1;
    text(ctx, "Space / click / tap = swing    Mouse or ↑ ↓ = aim the yellow ring at the ball", W / 2, 290, "500 14px system-ui, sans-serif", "#e8f0f6", "center");
    text(ctx, "Hit it square to launch it. Aim low for grounders, high for pop-ups.", W / 2, 312, "500 14px system-ui, sans-serif", "#e8f0f6", "center");
    text(ctx, "Strikes, fouls, grounders and caught flies are outs. Take a ball outside the zone for +25.", W / 2, 334, "500 14px system-ui, sans-serif", "#e8f0f6", "center");
  }

  if (S.mode === "over") {
    ctx.fillStyle = "rgba(8,14,24,0.55)";
    ctx.fillRect(0, 0, W, H);
    const pw = 440;
    const ph = 320;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    ctx.fillStyle = "rgba(18,30,44,0.94)";
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    text(ctx, "Derby over!", W / 2, py + 46, "900 32px system-ui, sans-serif", "#ffffff", "center");
    const rows: [string, string][] = [
      ["Home runs", String(S.stats.hr)],
      ["Longest homer", S.stats.longest ? `${S.stats.longest} ft` : "-"],
      ["Other hits", String(S.stats.hits)],
      ["Pitches seen", String(S.pitchN)],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 92 + i * 30;
      text(ctx, k, px + 40, y, "600 17px system-ui, sans-serif", "#d8e6f0");
      text(ctx, v, px + pw - 40, y, "800 17px system-ui, sans-serif", "#ffffff", "right");
    });
    text(ctx, `Score ${S.score.toLocaleString()}`, W / 2, py + 240, "900 30px system-ui, sans-serif", "#ffe08a", "center");
    const note = S.unlocks.length ? `Unlocked: ${S.unlocks.join(", ")}` : S.newBest ? "New best score!" : `Best ${S.best.toLocaleString()}`;
    text(ctx, note, W / 2, py + 270, "800 15px system-ui, sans-serif", S.unlocks.length || S.newBest ? "#7ee0a0" : "#d8e6f0", "center");
    if (S.modeT > 0.8) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
      text(ctx, "Press Space or click to play again", W / 2, py + 302, "600 14px system-ui, sans-serif", "#ffffff", "center");
      ctx.globalAlpha = 1;
    }
  }

  for (const p of S.particles) {
    ctx.globalAlpha = 1 - p.life / p.max;
    ctx.fillStyle = p.color;
    ctx.save();
    ctx.translate(p.x, p.y);
    ctx.rotate(p.life * 6 + p.r);
    ctx.fillRect(-p.r, -p.r * 0.5, p.r * 2, p.r);
    ctx.restore();
  }
  ctx.globalAlpha = 1;
}

function render(ctx: CanvasRenderingContext2D, S: Game, morph: Morph, bat: Bat, easyAim: boolean, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const shX = S.shake * 8 * Math.sin(S.t * 61);
  const shY = S.shake * 6 * Math.cos(S.t * 53);
  ctx.translate(shX, shY);
  const batting = S.mode === "pitch" || S.mode === "title" || S.mode === "over" || (S.mode === "result" && !S.plan);
  const c = batting ? BAT_CAM : S.cam;
  drawPark(ctx, S, c);
  if (batting) {
    const mp = project(c, 0, 0.2, 18.4);
    if (mp) {
      const p = S.pitch;
      let pose: FrontPose = "set";
      let ball: string | undefined = "#ffffff";
      if (p && S.mode === "pitch") {
        const into = S.pitchT;
        if (into > p.releaseAt) {
          pose = "throw";
          ball = undefined;
        } else if (into > p.releaseAt - 0.55) {
          pose = "windup";
          ball = PITCH_INFO[p.kind].glow;
        }
      } else if (S.mode === "result") pose = "idle";
      drawAxoFront(ctx, mp.x, mp.y, 1.6 * mp.s, MORPHS[2], "#3a78c2", pose, S.t, ball);
    }
    drawZone(ctx, S, c, easyAim);
    drawBall(ctx, S, c);
    const bp = project(c, BATTER.x, 0, BATTER.z);
    if (bp) drawBatter(ctx, bp.x, bp.y, bp.s / 100, morph, bat, S.swingT, S.t, false);
  } else {
    drawBall(ctx, S, c);
    if (S.mode === "result" && S.plan?.kind === "hr") {
      const bp = project(BAT_CAM, BATTER.x, 0, BATTER.z);
      if (bp) {
        ctx.save();
        ctx.translate(W - 170, H - 10);
        ctx.scale(0.45, 0.45);
        ctx.translate(-bp.x, -bp.y);
        drawBatter(ctx, bp.x, bp.y, bp.s / 100, morph, bat, 1, S.t, true);
        ctx.restore();
      }
    }
  }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHud(ctx, S);
}

// ---------- component ----------

const btn: React.CSSProperties = {
  padding: "6px 14px",
  borderRadius: 16,
  border: "none",
  background: "#334155",
  color: "#f1f5f9",
  cursor: "pointer",
  fontSize: 14,
};

export default function AxolotlBaseballGame({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game>(newGame("title", loadBest()));
  const audioRef = useRef<Audio>(makeAudio());
  const [best, setBest] = useState(() => gameRef.current.best);
  const [morphId, setMorphId] = useState(MORPHS[0].id);
  const [batId, setBatId] = useState(BATS[0].id);
  const [easyAim, setEasyAim] = useState(false);
  const [muted, setMuted] = useState(false);
  const morph = MORPHS.find((m) => m.id === morphId) ?? MORPHS[0];
  const bat = BATS.find((b) => b.id === batId) ?? BATS[0];
  const lookRef = useRef({ morph, bat, easyAim });
  lookRef.current = { morph, bat, easyAim };

  const start = () => {
    audioRef.current.unlock();
    const S = newGame("pitch", gameRef.current.best);
    S.cursorY = gameRef.current.cursorY;
    nextPitch(S);
    gameRef.current = S;
  };

  useEffect(() => {
    audioRef.current.setMuted(muted);
  }, [muted]);

  useEffect(() => {
    const cvs = canvasRef.current;
    const ctx = cvs?.getContext("2d");
    if (!cvs || !ctx) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    cvs.width = Math.floor(W * dpr);
    cvs.height = Math.floor(H * dpr);
    const audio = audioRef.current;
    const keys = { up: false, down: false };

    const primary = () => {
      const S = gameRef.current;
      if (S.mode === "title" || (S.mode === "over" && S.modeT > 0.8)) start();
      else trySwing(S, audio, lookRef.current.easyAim);
    };
    const aimFromPointer = (clientY: number) => {
      const r = cvs.getBoundingClientRect();
      const sy = ((clientY - r.top) / r.height) * H;
      const top = project(BAT_CAM, 0, ZONE.y1, 0);
      const bot = project(BAT_CAM, 0, ZONE.y0, 0);
      if (!top || !bot) return;
      const u = (sy - bot.y) / (top.y - bot.y);
      gameRef.current.cursorY = clamp(lerp(ZONE.y0, ZONE.y1, u), 0.2, 1.45);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " " || k === "enter") {
        e.preventDefault();
        if (!e.repeat) primary();
      } else if (k === "arrowup" || k === "w") {
        e.preventDefault();
        keys.up = true;
      } else if (k === "arrowdown" || k === "s") {
        e.preventDefault();
        keys.down = true;
      } else if (k === "r") start();
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "arrowup" || k === "w") keys.up = false;
      if (k === "arrowdown" || k === "s") keys.down = false;
    };
    const onPointerMove = (e: PointerEvent) => aimFromPointer(e.clientY);
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      aimFromPointer(e.clientY);
      primary();
    };
    const releaseAll = () => {
      keys.up = keys.down = false;
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cvs.addEventListener("pointermove", onPointerMove);
    cvs.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("blur", releaseAll);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastMode: Mode = gameRef.current.mode;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      if (document.hidden) return;
      acc += dt;
      while (acc >= STEP) {
        const S = gameRef.current;
        if (keys.up) S.cursorY = Math.min(1.45, S.cursorY + STEP * 0.9);
        if (keys.down) S.cursorY = Math.max(0.2, S.cursorY - STEP * 0.9);
        step(S, STEP, audio);
        acc -= STEP;
      }
      const S = gameRef.current;
      const look = lookRef.current;
      render(ctx, S, look.morph, look.bat, look.easyAim, dpr);
      if (S.mode !== lastMode) {
        lastMode = S.mode;
        if (S.mode === "over") setBest(S.best);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cvs.removeEventListener("pointermove", onPointerMove);
      cvs.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("blur", releaseAll);
    };
  }, []);

  const swatch = (active: boolean, locked: boolean): React.CSSProperties => ({
    width: 30,
    height: 30,
    borderRadius: 15,
    border: `3px solid ${active ? "#ff5fa2" : "#1e293b"}`,
    cursor: locked ? "not-allowed" : "pointer",
    opacity: locked ? 0.35 : 1,
    padding: 0,
  });

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0f172a", color: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", padding: 12, gap: 10, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Axolotl Baseball</h1>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button style={{ ...btn, background: "#10b981" }} onClick={start}>
            New derby
          </button>
          <button style={{ ...btn, background: easyAim ? "#ff5fa2" : "#334155" }} onClick={() => setEasyAim((v) => !v)} title="Automatically aims at the ball's height">
            Easy aim: {easyAim ? "on" : "off"}
          </button>
          <button style={btn} onClick={() => setMuted((v) => !v)}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button style={{ ...btn, background: "#6b7280" }} onClick={onBack}>
            Back to Home
          </button>
        </div>
      </div>
      <div style={{ width: "min(100%, 960px, calc((100vh - 150px) * 16 / 9))", borderRadius: 16, overflow: "hidden", boxShadow: "0 8px 30px rgba(0,0,0,0.4)" }}>
        <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", touchAction: "none", cursor: "crosshair" }} />
      </div>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14 }}>
        <span>Batter:</span>
        {MORPHS.map((m) => {
          const locked = best < COLOR_UNLOCKS[m.id];
          return (
            <button
              key={m.id}
              disabled={locked}
              title={locked ? `Score ${COLOR_UNLOCKS[m.id].toLocaleString()} in one derby to unlock` : m.name}
              onClick={() => setMorphId(m.id)}
              style={{ ...swatch(m.id === morphId, locked), background: m.body }}
            />
          );
        })}
        <span style={{ marginLeft: 12 }}>Bat:</span>
        {BATS.map((b) => {
          const locked = best < b.need;
          return (
            <button
              key={b.id}
              disabled={locked}
              title={locked ? `Score ${b.need.toLocaleString()} in one derby to unlock` : b.name}
              onClick={() => setBatId(b.id)}
              style={{
                ...swatch(b.id === batId, locked),
                background: b.stripe ? `repeating-linear-gradient(45deg, ${b.barrel} 0 5px, ${b.stripe} 5px 10px)` : b.barrel,
              }}
            />
          );
        })}
        <span style={{ marginLeft: "auto", color: "#cbd5e1" }}>Best {best.toLocaleString()}</span>
      </div>
    </div>
  );
}
