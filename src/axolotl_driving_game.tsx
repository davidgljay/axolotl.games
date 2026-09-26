import React, { useEffect, useRef, useState } from "react";
import { MORPHS, type Morph } from "./axolotl_morphs";

// Behind-the-car road racer using the classic segment-projection technique:
// the road is a list of short segments, each projected to screen space and drawn back-to-front.

const W = 960;
const H = 540;
const STEP = 1 / 120;
const TAU = Math.PI * 2;

const SEG = 200;
const ROAD_W = 2000;
const LANES = 3;
const RUMBLE = 3;
const CAM_H = 1000;
const CAM_DEPTH = 1 / Math.tan((50 * Math.PI) / 180);
const PLAYER_Z = CAM_H * CAM_DEPTH;
const DRAW = 240;
const FOG = 5;

const MAX_SPEED = SEG * 60;
const BOOST_SPEED = MAX_SPEED * 1.35;
const ACCEL = MAX_SPEED / 5;
const BRAKE = MAX_SPEED;
const DECEL = MAX_SPEED / 5;
const OFFROAD_DECEL = MAX_SPEED / 2;
const OFFROAD_LIMIT = MAX_SPEED / 4;
const CENTRIFUGAL = 0.3;
const M_PER_UNIT = 0.005;
const BIOME_M = 2500;
const LANE_X = [-2 / 3, 0, 2 / 3];
const PLAYER_W = 0.25;
const CAR_PX = 240;
const GRAV = 6000;
const JUMP_V = 2600;
const PX_PER_OFFSET = (CAM_DEPTH / PLAYER_Z) * ROAD_W * (W / 2);

const UNLOCKS: Record<string, number> = { pink: 0, wild: 1500, gold: 4000, midnight: 8000 };
const BEST_KEY = "axodriver_best_v2";

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function hash1(i: number, seed: number) {
  const x = Math.sin(i * 127.1 + seed * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

function noise1(x: number, seed: number) {
  const i = Math.floor(x);
  const f = x - i;
  const u = f * f * (3 - 2 * f);
  return hash1(i, seed) * (1 - u) + hash1(i + 1, seed) * u;
}

function fbm(x: number, seed: number, oct = 4) {
  let amp = 0.5;
  let sum = 0;
  let norm = 0;
  for (let o = 0; o < oct; o++) {
    sum += amp * noise1(x, seed + o * 17);
    norm += amp;
    x *= 2.03;
    amp *= 0.5;
  }
  return sum / norm;
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

// ---------- road shape ----------

const easeIn = (i: number) => clamp((i - 80) / 150, 0, 1);

function curveAt(i: number) {
  const n = clamp((fbm(i * 0.0035, 3) - 0.5) * 3.2, -1, 1);
  const a = Math.abs(n);
  return a < 0.22 ? 0 : Math.sign(n) * ((a - 0.22) / 0.78) * 6 * easeIn(i);
}

function hillAt(i: number) {
  return (fbm(i * 0.0022, 9) - 0.5) * 2 * 5000 * easeIn(i);
}

// ---------- landscapes ----------

type Scenery =
  | "tree"
  | "bush"
  | "flowers"
  | "billboard"
  | "cactus"
  | "rock"
  | "boulder"
  | "lavarock"
  | "deadtree"
  | "vent"
  | "pine"
  | "snowman"
  | "ice"
  | "sign";

interface Biome {
  name: string;
  sky: [string, string];
  sun: { x: number; y: number; glow: string };
  fog: string;
  grass: [string, string];
  rumble: [string, string];
  road: [string, string];
  lane: string;
  hills: [string, string];
  mesa?: boolean;
  snowcaps?: boolean;
  volcano?: boolean;
  scenery: Scenery[];
  density: number;
  ambient?: "snow" | "ash";
}

const BIOMES: Biome[] = [
  {
    name: "Lily Pad Meadow",
    sky: ["#4f9ee0", "#d4eef7"],
    sun: { x: 0.78, y: 0.16, glow: "255,246,214" },
    fog: "#d8edf3",
    grass: ["#7cc35a", "#70b650"],
    rumble: ["#ffffff", "#e0506a"],
    road: ["#6b6f77", "#65696f"],
    lane: "#f6f6f6",
    hills: ["#a8cbc4", "#6fa37e"],
    scenery: ["tree", "tree", "bush", "flowers", "tree"],
    density: 0.55,
  },
  {
    name: "Red Rock Canyon",
    sky: ["#3a82cc", "#f3dbb6"],
    sun: { x: 0.25, y: 0.14, glow: "255,238,200" },
    fog: "#efd9ba",
    grass: ["#d9a26a", "#cd955e"],
    rumble: ["#ffffff", "#b8472a"],
    road: ["#7a6a60", "#73645a"],
    lane: "#fff3d6",
    hills: ["#d8b39c", "#b8774f"],
    mesa: true,
    scenery: ["cactus", "cactus", "rock", "boulder", "cactus"],
    density: 0.38,
  },
  {
    name: "Volcano Pass",
    sky: ["#231a33", "#f08a4b"],
    sun: { x: 0.62, y: 0.36, glow: "255,160,90" },
    fog: "#b8605a",
    grass: ["#3b3236", "#332b2f"],
    rumble: ["#ffcf4d", "#1e1a1c"],
    road: ["#4a4549", "#444044"],
    lane: "#ffb347",
    hills: ["#5b3f57", "#2f2230"],
    volcano: true,
    scenery: ["lavarock", "deadtree", "vent", "lavarock"],
    density: 0.36,
    ambient: "ash",
  },
  {
    name: "Arctic Fjord",
    sky: ["#7297c0", "#eef3f7"],
    sun: { x: 0.3, y: 0.2, glow: "255,252,240" },
    fog: "#e6eef5",
    grass: ["#f4f8fb", "#e4edf4"],
    rumble: ["#ffffff", "#3a78c2"],
    road: ["#707a86", "#69737f"],
    lane: "#ffffff",
    hills: ["#d5e0ea", "#8fa6bb"],
    snowcaps: true,
    scenery: ["pine", "pine", "snowman", "ice", "pine"],
    density: 0.48,
    ambient: "snow",
  },
];

const biomeIndexAt = (i: number) => Math.floor(Math.max(0, i) / BIOME_M);
const biomeAt = (i: number) => BIOMES[biomeIndexAt(i) % BIOMES.length];

const SCENERY_W: Record<Scenery, number> = {
  tree: 1500,
  bush: 900,
  flowers: 600,
  billboard: 2400,
  cactus: 900,
  rock: 900,
  boulder: 1700,
  lavarock: 1100,
  deadtree: 1200,
  vent: 1000,
  pine: 1300,
  snowman: 800,
  ice: 1000,
  sign: 2200,
};

// ---------- entities ----------

type EntKind = "turtle" | "frog" | "cone" | "rock" | "oil" | "fuel" | "worm" | "boost" | "ramp";

const ENT_W: Record<EntKind, number> = {
  turtle: 0.3,
  frog: 0.28,
  cone: 0.1,
  rock: 0.26,
  oil: 0.32,
  fuel: 0.12,
  worm: 0.12,
  boost: 0.11,
  ramp: 0.36,
};

interface Ent {
  kind: EntKind;
  z: number;
  x: number;
  tx: number;
  speed: number;
  blink: number;
  blinkDir: number;
  laneT: number;
  hit: boolean;
  knock: number;
  passed: boolean;
  seed: number;
}

interface Floater {
  text: string;
  color: string;
  t0: number;
  x: number;
  y: number;
  size: number;
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

type Mode = "title" | "play" | "paused" | "over";

interface Best {
  score: number;
  distance: number;
}

interface Game {
  mode: Mode;
  t: number;
  modeT: number;
  pos: number;
  speed: number;
  x: number;
  steer: number;
  alt: number;
  vAlt: number;
  roll: number;
  rollV: number;
  keys: { left: boolean; right: boolean; up: boolean; down: boolean };
  fuel: number;
  hearts: number;
  invuln: number;
  spin: number;
  slip: number;
  boostT: number;
  bonus: number;
  combo: number;
  comboT: number;
  stats: { near: number; snacks: number; rolls: number; fuel: number };
  ents: Ent[];
  nextRow: number;
  nextFuel: number;
  skyX: number;
  shake: number;
  floaters: Floater[];
  particles: Particle[];
  banner: { text: string; t0: number } | null;
  lastBiome: number;
  overReason: string;
  best: Best;
  newBest: boolean;
  newUnlock: string | null;
}

function loadBest(): Best {
  try {
    const v = JSON.parse(localStorage.getItem(BEST_KEY) || "null");
    if (v && Number.isFinite(v.score) && Number.isFinite(v.distance)) return v;
  } catch {
    // corrupted or unavailable storage: start fresh
  }
  return { score: 0, distance: 0 };
}

function newGame(mode: Mode, best: Best): Game {
  return {
    mode,
    t: 0,
    modeT: 0,
    pos: 0,
    speed: 0,
    x: 0,
    steer: 0,
    alt: 0,
    vAlt: 0,
    roll: 0,
    rollV: 0,
    keys: { left: false, right: false, up: false, down: false },
    fuel: 1,
    hearts: 3,
    invuln: 0,
    spin: 0,
    slip: 0,
    boostT: 0,
    bonus: 0,
    combo: 1,
    comboT: 0,
    stats: { near: 0, snacks: 0, rolls: 0, fuel: 0 },
    ents: [],
    nextRow: 150 / M_PER_UNIT,
    nextFuel: 350,
    skyX: 0,
    shake: 0,
    floaters: [],
    particles: [],
    banner: { text: BIOMES[0].name, t0: 0 },
    lastBiome: 0,
    overReason: "",
    best,
    newBest: false,
    newUnlock: null,
  };
}

const meters = (S: Game) => S.pos * M_PER_UNIT;
const scoreOf = (S: Game) => Math.floor(meters(S)) + S.bonus;

// ---------- audio ----------

function makeAudio() {
  let ac: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let eng1: OscillatorNode | null = null;
  let eng2: OscillatorNode | null = null;
  let engFilter: BiquadFilterNode | null = null;
  let engGain: GainNode | null = null;

  const tone = (type: OscillatorType, f0: number, f1: number, dur: number, vol: number, delay = 0) => {
    if (!ac || !master) return;
    const now = ac.currentTime + delay;
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f0, now);
    o.frequency.exponentialRampToValueAtTime(f1, now + dur);
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    o.connect(g).connect(master);
    o.start(now);
    o.stop(now + dur + 0.05);
  };

  const hiss = (type: BiquadFilterType, freq: number, dur: number, vol: number) => {
    if (!ac || !master || !noise) return;
    const now = ac.currentTime;
    const src = ac.createBufferSource();
    src.buffer = noise;
    const f = ac.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ac.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(vol, now + 0.02);
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
        noise = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        eng1 = ac.createOscillator();
        eng2 = ac.createOscillator();
        eng1.type = "sawtooth";
        eng2.type = "square";
        engFilter = ac.createBiquadFilter();
        engFilter.type = "lowpass";
        engFilter.frequency.value = 400;
        engGain = ac.createGain();
        engGain.gain.value = 0;
        eng1.connect(engFilter);
        eng2.connect(engFilter);
        engFilter.connect(engGain).connect(master);
        eng1.start();
        eng2.start();
      }
      if (ac.state === "suspended") void ac.resume();
    },
    setMuted(m: boolean) {
      if (ac && master) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
    },
    engine(pct: number, on: boolean) {
      if (!ac || !eng1 || !eng2 || !engFilter || !engGain) return;
      const now = ac.currentTime;
      const f = 48 + pct * 120;
      eng1.frequency.setTargetAtTime(f, now, 0.08);
      eng2.frequency.setTargetAtTime(f * 0.5, now, 0.08);
      engFilter.frequency.setTargetAtTime(250 + pct * 900, now, 0.08);
      engGain.gain.setTargetAtTime(on ? 0.035 + pct * 0.03 : 0, now, 0.1);
    },
    fuel() {
      tone("sine", 520, 520, 0.12, 0.2);
      tone("sine", 660, 660, 0.12, 0.2, 0.08);
      tone("sine", 880, 880, 0.2, 0.2, 0.16);
    },
    worm() {
      tone("square", 880, 1320, 0.1, 0.08);
    },
    boost() {
      tone("sawtooth", 200, 900, 0.4, 0.12);
    },
    crash() {
      hiss("lowpass", 700, 0.5, 0.6);
      tone("sine", 110, 40, 0.4, 0.4);
    },
    cone() {
      tone("triangle", 600, 300, 0.12, 0.15);
    },
    near() {
      hiss("bandpass", 1600, 0.3, 0.3);
    },
    jump() {
      tone("sine", 300, 800, 0.3, 0.2);
    },
    land(good: boolean) {
      hiss("lowpass", 400, 0.25, 0.35);
      if (good) {
        tone("sine", 660, 660, 0.1, 0.15, 0.05);
        tone("sine", 990, 990, 0.18, 0.15, 0.13);
      }
    },
    chime() {
      tone("sine", 523, 523, 0.5, 0.12);
      tone("sine", 659, 659, 0.5, 0.1, 0.05);
      tone("sine", 784, 784, 0.6, 0.1, 0.1);
    },
  };
}

type Audio = ReturnType<typeof makeAudio>;

// ---------- simulation ----------

function float(S: Game, text: string, color: string, size = 28, y = H * 0.36) {
  S.floaters.push({ text, color, t0: S.t, x: W / 2, y, size });
}

function addCombo(S: Game, amt: number) {
  S.combo = Math.min(5, S.combo + amt);
  S.comboT = 0;
}

function sparks(S: Game, color: string, n: number) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * TAU;
    const v = 150 + Math.random() * 350;
    S.particles.push({
      x: W / 2 + (Math.random() - 0.5) * 120,
      y: H - 80 - S.alt * 0.27,
      vx: Math.cos(a) * v,
      vy: Math.sin(a) * v - 150,
      life: 0,
      max: 0.5 + Math.random() * 0.5,
      r: 2 + Math.random() * 3,
      color,
    });
  }
}

function endGame(S: Game, reason: string) {
  S.mode = "over";
  S.modeT = 0;
  S.overReason = reason;
  const dist = Math.floor(meters(S));
  const score = scoreOf(S);
  const prev = S.best;
  S.newBest = score > prev.score;
  S.best = { score: Math.max(prev.score, score), distance: Math.max(prev.distance, dist) };
  const unlocked = MORPHS.filter((m) => prev.distance < UNLOCKS[m.id] && S.best.distance >= UNLOCKS[m.id]).map((m) => m.name);
  S.newUnlock = unlocked.length ? unlocked.join(" & ") : null;
  try {
    localStorage.setItem(BEST_KEY, JSON.stringify(S.best));
  } catch {
    // storage unavailable; best just won't persist
  }
}

function crash(S: Game, audio: Audio) {
  S.hearts--;
  S.invuln = 1.8;
  S.spin = 0.9;
  S.speed *= 0.3;
  S.combo = 1;
  S.shake = 1;
  sparks(S, "#ffd166", 22);
  audio.crash();
  float(S, S.hearts > 0 ? "Bonk!" : "Wrecked!", "#ff6b6b", 40);
  if (S.hearts <= 0) endGame(S, "Out of hearts");
}

function spawnRow(S: Game, z: number) {
  const m = z * M_PER_UNIT;
  const d = clamp(m / 10000, 0, 1);
  const lanes = [0, 1, 2].sort(() => Math.random() - 0.5);
  const blockN = Math.random() < 0.2 + d * 0.45 ? 2 : 1;
  const mk = (kind: EntKind, lane: number, dz = 0): Ent => ({
    kind,
    z: z + dz,
    x: LANE_X[lane],
    tx: LANE_X[lane],
    speed: 0,
    blink: 0,
    blinkDir: 0,
    laneT: 3 + Math.random() * 5,
    hit: false,
    knock: 0,
    passed: false,
    seed: Math.random(),
  });
  for (let k = 0; k < blockN; k++) {
    const lane = lanes[k];
    const r = Math.random();
    if (r < 0.5) {
      const e = mk(Math.random() < 0.35 + d * 0.3 ? "frog" : "turtle", lane);
      e.speed = MAX_SPEED * (0.3 + Math.random() * 0.25);
      S.ents.push(e);
    } else if (r < 0.7 && m > 400) {
      S.ents.push(mk("rock", lane));
    } else if (r < 0.88) {
      const c = mk("cone", lane);
      c.x += (Math.random() - 0.5) * 0.15;
      S.ents.push(c);
      const c2 = mk("cone", lane, SEG * 2);
      c2.x -= (Math.random() - 0.5) * 0.15;
      S.ents.push(c2);
    } else {
      S.ents.push(mk("oil", lane));
    }
  }
  for (let k = blockN; k < 3; k++) {
    const lane = lanes[k];
    if (m >= S.nextFuel) {
      S.ents.push(mk("fuel", lane));
      S.nextFuel = m + 350 + m * 0.03 + Math.random() * 200;
      continue;
    }
    const r = Math.random();
    if (r < 0.3) {
      for (let w = 0; w < 3; w++) S.ents.push(mk("worm", lane, w * SEG * 3));
    } else if (r < 0.34) {
      S.ents.push(mk("boost", lane));
    } else if (r < 0.39 && m > 500) {
      S.ents.push(mk("ramp", lane));
    }
  }
}

function land(S: Game, audio: Audio) {
  S.alt = 0;
  S.vAlt = 0;
  const n = Math.round(S.roll / TAU);
  const dev = Math.abs(S.roll - n * TAU);
  const rolls = Math.abs(n);
  if (dev < 0.6 && rolls > 0) {
    const pts = Math.round(250 * rolls * S.combo);
    S.bonus += pts;
    S.stats.rolls += rolls;
    addCombo(S, 0.5 * rolls);
    float(S, `${["", "BARREL ROLL!", "DOUBLE ROLL!", "TRIPLE ROLL!"][Math.min(rolls, 3)]} +${pts}`, "#7fd8ff", 34);
    audio.land(true);
  } else {
    S.speed *= 0.6;
    S.combo = 1;
    float(S, "Wobbly landing", "#ffd166", 26);
    audio.land(false);
  }
  S.roll = 0;
  S.rollV = 0;
}

function collect(S: Game, e: Ent, audio: Audio) {
  e.hit = true;
  if (e.kind === "fuel") {
    S.fuel = Math.min(1, S.fuel + 0.35);
    S.stats.fuel++;
    float(S, "Fuel +35%", "#7ee0a0", 24, H * 0.6);
    audio.fuel();
  } else if (e.kind === "worm") {
    const pts = Math.round(40 * S.combo);
    S.bonus += pts;
    S.stats.snacks++;
    addCombo(S, 0.1);
    float(S, `+${pts}`, "#ffb8c8", 22, H * 0.6);
    audio.worm();
  } else {
    S.boostT = 2.5;
    float(S, "BOOST!", "#7fd8ff", 32, H * 0.6);
    audio.boost();
  }
}

function step(S: Game, dt: number, audio: Audio) {
  S.t += dt;
  S.modeT += dt;
  for (const p of S.particles) {
    p.life += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 600 * dt;
  }
  S.particles = S.particles.filter((p) => p.life < p.max);
  S.floaters = S.floaters.filter((f) => S.t - f.t0 < 1.6);
  S.shake *= Math.exp(-dt * 6);

  if (S.mode !== "play") {
    audio.engine(0, false);
    return;
  }

  const pct = S.speed / MAX_SPEED;
  const pz = S.pos + PLAYER_Z;
  const pIdx = Math.floor(pz / SEG);
  const curve = curveAt(pIdx);
  const airborne = S.alt > 0 || S.vAlt > 0;

  let steerIn = (S.keys.right ? 1 : 0) - (S.keys.left ? 1 : 0);
  if (S.spin > 0) steerIn = 0;
  const dx = dt * 2 * Math.min(pct, 1);
  if (!airborne) {
    S.x += dx * steerIn * (S.slip > 0 ? 0.35 : 1);
    S.x -= dx * pct * curve * CENTRIFUGAL;
    if (S.slip > 0) S.x += Math.sin(S.t * 9) * dt * 0.7 * pct;
  } else {
    S.x -= dx * pct * curve * CENTRIFUGAL * 0.5;
    S.rollV += steerIn * dt * 18;
  }
  S.steer += (steerIn - S.steer) * (1 - Math.exp(-dt * 8));

  const freeBoost = S.boostT > 0;
  const fuelBoost = S.keys.up && S.fuel > 0 && !freeBoost;
  const boosting = (freeBoost || fuelBoost) && S.spin <= 0;
  if (S.fuel <= 0 && !freeBoost) S.speed -= DECEL * dt;
  else if (S.keys.down) S.speed -= BRAKE * dt;
  else if (boosting) S.speed = Math.min(BOOST_SPEED, S.speed + ACCEL * 1.4 * dt);
  else if (S.speed > MAX_SPEED) S.speed = Math.max(MAX_SPEED, S.speed - DECEL * dt);
  else S.speed = Math.min(MAX_SPEED, S.speed + ACCEL * dt);
  const offroad = Math.abs(S.x) > 1 && !airborne;
  if (offroad && S.speed > OFFROAD_LIMIT) S.speed = Math.max(OFFROAD_LIMIT, S.speed - OFFROAD_DECEL * dt);
  S.speed = Math.max(0, S.speed);
  S.x = clamp(S.x, -2.2, 2.2);
  S.pos += S.speed * dt;
  S.skyX += curve * (S.speed * dt) / SEG * 2.2;

  const drain = 0.022 * (0.4 + 0.6 * Math.min(pct, 1)) + (fuelBoost ? 0.07 : 0) + (offroad ? 0.02 : 0);
  S.fuel = Math.max(0, S.fuel - drain * dt);

  if (offroad && Math.random() < dt * 30 * pct) {
    S.particles.push({
      x: W / 2 + (Math.random() - 0.5) * 200,
      y: H - 30,
      vx: (Math.random() - 0.5) * 200,
      vy: -100 - Math.random() * 150,
      life: 0,
      max: 0.6,
      r: 5 + Math.random() * 6,
      color: biomeAt(pIdx).grass[1],
    });
  }
  if (offroad) S.shake = Math.max(S.shake, 0.25);

  if (airborne) {
    S.vAlt -= GRAV * dt;
    S.alt += S.vAlt * dt;
    S.roll += S.rollV * dt;
    if (S.alt <= 0) land(S, audio);
  }

  S.invuln = Math.max(0, S.invuln - dt);
  S.spin = Math.max(0, S.spin - dt);
  S.slip = Math.max(0, S.slip - dt);
  S.boostT = Math.max(0, S.boostT - dt);
  S.comboT += dt;
  if (S.comboT > 6) S.combo = 1;

  const bi = biomeIndexAt(Math.floor(meters(S)));
  if (bi !== S.lastBiome) {
    S.lastBiome = bi;
    S.banner = { text: BIOMES[bi % BIOMES.length].name, t0: S.t };
    audio.chime();
  }

  const ahead = S.pos + DRAW * SEG;
  while (S.nextRow < ahead) {
    spawnRow(S, S.nextRow);
    const d = clamp(S.nextRow * M_PER_UNIT / 10000, 0, 1);
    S.nextRow += lerp(48, 24, d) * SEG * (0.75 + Math.random() * 0.5);
  }

  for (const e of S.ents) {
    const traffic = e.kind === "turtle" || e.kind === "frog";
    if (traffic) {
      e.z += e.speed * dt;
      e.laneT -= dt;
      if (e.laneT <= 0 && e.blink <= 0 && Math.abs(e.x - e.tx) < 0.01) {
        e.laneT = 4 + Math.random() * 5;
        const lane = LANE_X.indexOf(e.tx);
        const dir = lane === 0 ? 1 : lane === 2 ? -1 : Math.random() < 0.5 ? -1 : 1;
        const target = LANE_X[lane + dir];
        const clear = !S.ents.some((o) => o !== e && Math.abs(o.z - e.z) < 1400 && Math.abs(o.x - target) < 0.3);
        if (clear) {
          e.blink = 1.1;
          e.blinkDir = dir;
          e.tx = target;
        }
      }
      if (e.blink > 0) e.blink -= dt;
      if (e.blink < 0.5 && e.x !== e.tx) {
        const move = Math.min(Math.abs(e.tx - e.x), dt * 0.9);
        e.x += Math.sign(e.tx - e.x) * move;
      }
    }
    if (e.knock > 0) e.knock += dt;
    if (e.hit) continue;
    const dz = e.z - pz;
    if (Math.abs(dz) < SEG * 0.6 && Math.abs(e.x - S.x) < ((ENT_W[e.kind] + PLAYER_W) / 2) * 0.9) {
      if (e.kind === "fuel" || e.kind === "worm" || e.kind === "boost") {
        if (S.alt < 300) collect(S, e, audio);
      } else if (!airborne) {
        if (e.kind === "ramp") {
          e.hit = true;
          S.vAlt = JUMP_V;
          S.rollV = (TAU / ((2 * JUMP_V) / GRAV)) * (S.steer < -0.1 ? -1 : 1);
          float(S, "Wheee!", "#ffffff", 28);
          audio.jump();
        } else if (e.kind === "oil") {
          e.hit = true;
          S.slip = 1.3;
          float(S, "Slippery!", "#c9b8ff", 26);
        } else if (e.kind === "cone") {
          e.hit = true;
          e.knock = 0.001;
          S.speed *= 0.85;
          S.combo = 1;
          audio.cone();
        } else if (S.invuln <= 0) {
          e.hit = true;
          if (traffic) e.tx = e.x = clamp(e.x + Math.sign(e.x - S.x || 1) * 0.35, -0.9, 0.9);
          crash(S, audio);
        }
      }
    }
    if (traffic && !e.passed && !e.hit && dz < -60) {
      e.passed = true;
      if (Math.abs(e.x - S.x) < 0.5 && !airborne) {
        const pts = Math.round(60 * S.combo);
        S.bonus += pts;
        S.stats.near++;
        addCombo(S, 0.25);
        float(S, `Near miss! +${pts}`, "#ffd166", 24, H * 0.5);
        audio.near();
      }
    }
  }
  S.ents = S.ents.filter((e) => e.z > S.pos - SEG && !(e.hit && (e.kind === "fuel" || e.kind === "worm" || e.kind === "boost")));

  if (S.fuel <= 0 && S.boostT <= 0 && S.speed < 400 && S.mode === "play") endGame(S, "Out of fuel");

  audio.engine(Math.min(S.speed / BOOST_SPEED, 1), S.mode === "play");
}

// ---------- scenery & entity sprites ----------

function circle(ctx: CanvasRenderingContext2D, x: number, y: number, r: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.arc(x, y, Math.max(0.5, r), 0, TAU);
  ctx.fill();
}

function drawScenery(ctx: CanvasRenderingContext2D, kind: Scenery, x: number, y: number, w: number, t: number, seed: number, label: string) {
  switch (kind) {
    case "tree": {
      const h = w * 1.35;
      ctx.fillStyle = "#7a5230";
      ctx.fillRect(x - w * 0.06, y - h * 0.45, w * 0.12, h * 0.45);
      circle(ctx, x, y - h * 0.62, w * 0.34, "#3f8a34");
      circle(ctx, x - w * 0.22, y - h * 0.5, w * 0.26, "#4f9e3f");
      circle(ctx, x + w * 0.22, y - h * 0.52, w * 0.27, "#4a9a3c");
      circle(ctx, x + w * 0.02, y - h * 0.8, w * 0.25, "#5cb04a");
      circle(ctx, x - w * 0.08, y - h * 0.84, w * 0.1, "#79c860");
      break;
    }
    case "bush":
      circle(ctx, x - w * 0.22, y - w * 0.2, w * 0.25, "#3f8534");
      circle(ctx, x + w * 0.22, y - w * 0.2, w * 0.25, "#3a7d30");
      circle(ctx, x, y - w * 0.32, w * 0.3, "#4d9a3e");
      break;
    case "flowers": {
      ctx.strokeStyle = "#3f8534";
      ctx.lineWidth = Math.max(1, w * 0.03);
      const cols = ["#ff7fa0", "#ffd166", "#ffffff", "#c9a0ff"];
      for (let k = 0; k < 6; k++) {
        const fx = x + (k - 2.5) * w * 0.16;
        const fh = w * (0.3 + hash1(k, seed * 100) * 0.3);
        ctx.beginPath();
        ctx.moveTo(fx, y);
        ctx.lineTo(fx, y - fh);
        ctx.stroke();
        circle(ctx, fx, y - fh, w * 0.07, cols[k % 4]);
      }
      break;
    }
    case "billboard": {
      const bh = w * 0.45;
      ctx.fillStyle = "#555";
      ctx.fillRect(x - w * 0.32, y - w * 0.55, w * 0.04, w * 0.55);
      ctx.fillRect(x + w * 0.28, y - w * 0.55, w * 0.04, w * 0.55);
      ctx.fillStyle = "#ff69b4";
      roundRect(ctx, x - w / 2, y - w * 0.55 - bh, w, bh, w * 0.04);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, w * 0.015);
      ctx.stroke();
      if (w > 50) {
        ctx.fillStyle = "#ffffff";
        ctx.font = `900 ${Math.round(w * 0.1)}px system-ui, sans-serif`;
        ctx.textAlign = "center";
        ctx.fillText("AXOLOTL", x, y - w * 0.55 - bh * 0.55);
        ctx.fillText("GAMES", x, y - w * 0.55 - bh * 0.18);
      }
      break;
    }
    case "cactus": {
      ctx.strokeStyle = "#4c8a3f";
      ctx.lineCap = "round";
      ctx.lineWidth = w * 0.2;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - w * 1.1);
      ctx.moveTo(x, y - w * 0.45);
      ctx.lineTo(x - w * 0.3, y - w * 0.45);
      ctx.lineTo(x - w * 0.3, y - w * 0.75);
      ctx.moveTo(x, y - w * 0.6);
      ctx.lineTo(x + w * 0.3, y - w * 0.6);
      ctx.lineTo(x + w * 0.3, y - w * 0.9);
      ctx.stroke();
      ctx.strokeStyle = "#65a855";
      ctx.lineWidth = w * 0.05;
      ctx.beginPath();
      ctx.moveTo(x - w * 0.03, y - w * 0.05);
      ctx.lineTo(x - w * 0.03, y - w * 1.08);
      ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }
    case "rock":
    case "boulder":
    case "lavarock": {
      const hgt = kind === "boulder" ? w * 1.1 : w * 0.55;
      const base = kind === "lavarock" ? "#2e2729" : kind === "boulder" ? "#b8683e" : "#9a6b4a";
      ctx.fillStyle = base;
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w * 0.42, y - hgt * 0.7);
      ctx.lineTo(x - w * 0.15, y - hgt);
      ctx.lineTo(x + w * 0.25, y - hgt * 0.92);
      ctx.lineTo(x + w * 0.48, y - hgt * 0.5);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.14)";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.42, y - hgt * 0.7);
      ctx.lineTo(x - w * 0.15, y - hgt);
      ctx.lineTo(x - w * 0.05, y - hgt * 0.5);
      ctx.closePath();
      ctx.fill();
      if (kind === "boulder") {
        ctx.strokeStyle = "rgba(0,0,0,0.2)";
        ctx.lineWidth = Math.max(1, w * 0.02);
        for (let k = 1; k < 4; k++) {
          ctx.beginPath();
          ctx.moveTo(x - w * 0.45, y - hgt * k * 0.22);
          ctx.lineTo(x + w * 0.48, y - hgt * k * 0.22);
          ctx.stroke();
        }
      }
      if (kind === "lavarock") {
        ctx.strokeStyle = `rgba(255,120,40,${0.6 + 0.3 * Math.sin(t * 3 + seed * 10)})`;
        ctx.lineWidth = Math.max(1, w * 0.035);
        ctx.beginPath();
        ctx.moveTo(x - w * 0.2, y - hgt * 0.85);
        ctx.lineTo(x - w * 0.05, y - hgt * 0.5);
        ctx.lineTo(x - w * 0.15, y - hgt * 0.15);
        ctx.moveTo(x + w * 0.2, y - hgt * 0.8);
        ctx.lineTo(x + w * 0.1, y - hgt * 0.4);
        ctx.stroke();
      }
      break;
    }
    case "deadtree": {
      ctx.strokeStyle = "#2b2224";
      ctx.lineCap = "round";
      ctx.lineWidth = w * 0.08;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(x, y - w * 1.0);
      ctx.moveTo(x, y - w * 0.55);
      ctx.lineTo(x - w * 0.35, y - w * 0.9);
      ctx.moveTo(x, y - w * 0.7);
      ctx.lineTo(x + w * 0.3, y - w * 1.05);
      ctx.moveTo(x - w * 0.2, y - w * 0.75);
      ctx.lineTo(x - w * 0.3, y - w * 1.0);
      ctx.stroke();
      ctx.lineCap = "butt";
      break;
    }
    case "vent": {
      ctx.fillStyle = "#3a3033";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.quadraticCurveTo(x, y - w * 0.5, x + w / 2, y);
      ctx.fill();
      for (let k = 0; k < 5; k++) {
        const age = (t * 0.5 + k / 5 + seed) % 1;
        const r = w * (0.1 + age * 0.3);
        ctx.fillStyle = `rgba(230,220,225,${0.45 * (1 - age)})`;
        ctx.beginPath();
        ctx.arc(x + Math.sin(age * 5 + k) * w * 0.1, y - w * 0.25 - age * w * 1.1, r, 0, TAU);
        ctx.fill();
      }
      break;
    }
    case "pine": {
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(x - w * 0.05, y - w * 0.3, w * 0.1, w * 0.3);
      for (let k = 0; k < 3; k++) {
        const by = y - w * (0.25 + k * 0.38);
        const bw = w * (0.5 - k * 0.12);
        ctx.fillStyle = "#2f5d43";
        ctx.beginPath();
        ctx.moveTo(x - bw, by);
        ctx.lineTo(x, by - w * 0.55);
        ctx.lineTo(x + bw, by);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "#f4f8fb";
        ctx.beginPath();
        ctx.moveTo(x - bw * 0.45, by - w * 0.3);
        ctx.lineTo(x, by - w * 0.55);
        ctx.lineTo(x + bw * 0.45, by - w * 0.3);
        ctx.closePath();
        ctx.fill();
      }
      break;
    }
    case "snowman": {
      circle(ctx, x, y - w * 0.3, w * 0.32, "#ffffff");
      circle(ctx, x, y - w * 0.78, w * 0.24, "#ffffff");
      circle(ctx, x, y - w * 1.12, w * 0.17, "#ffffff");
      circle(ctx, x - w * 0.06, y - w * 1.15, w * 0.025, "#222");
      circle(ctx, x + w * 0.06, y - w * 1.15, w * 0.025, "#222");
      ctx.fillStyle = "#ff8c32";
      ctx.beginPath();
      ctx.moveTo(x, y - w * 1.1);
      ctx.lineTo(x + w * 0.16, y - w * 1.08);
      ctx.lineTo(x, y - w * 1.06);
      ctx.fill();
      ctx.fillStyle = "#2a2a2a";
      ctx.fillRect(x - w * 0.16, y - w * 1.3, w * 0.32, w * 0.04);
      ctx.fillRect(x - w * 0.1, y - w * 1.48, w * 0.2, w * 0.18);
      break;
    }
    case "ice": {
      ctx.fillStyle = "#bfe3f5";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w * 0.3, y - w * 0.7);
      ctx.lineTo(x - w * 0.05, y - w * 0.4);
      ctx.lineTo(x + w * 0.1, y - w * 0.95);
      ctx.lineTo(x + w * 0.35, y - w * 0.5);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(255,255,255,0.6)";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.1, y - w * 0.95);
      ctx.lineTo(x + w * 0.02, y - w * 0.3);
      ctx.lineTo(x - w * 0.05, y - w * 0.4);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "sign": {
      const bh = w * 0.32;
      ctx.fillStyle = "#6b4a2e";
      ctx.fillRect(x - w * 0.35, y - w * 0.5, w * 0.05, w * 0.5);
      ctx.fillRect(x + w * 0.3, y - w * 0.5, w * 0.05, w * 0.5);
      ctx.fillStyle = "#2f7d4f";
      roundRect(ctx, x - w / 2, y - w * 0.5 - bh, w, bh, w * 0.03);
      ctx.fill();
      ctx.strokeStyle = "#ffffff";
      ctx.lineWidth = Math.max(1, w * 0.012);
      ctx.stroke();
      if (w > 60) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.font = `600 ${Math.round(w * 0.055)}px system-ui, sans-serif`;
        ctx.fillText("Welcome to", x, y - w * 0.5 - bh * 0.62);
        ctx.font = `800 ${Math.round(w * 0.075)}px system-ui, sans-serif`;
        ctx.fillText(label, x, y - w * 0.5 - bh * 0.22);
      }
      break;
    }
  }
}

function wheels(ctx: CanvasRenderingContext2D, x: number, y: number, w: number) {
  ctx.fillStyle = "#1e1e22";
  roundRect(ctx, x - w * 0.48, y - w * 0.22, w * 0.18, w * 0.22, w * 0.04);
  ctx.fill();
  roundRect(ctx, x + w * 0.3, y - w * 0.22, w * 0.18, w * 0.22, w * 0.04);
  ctx.fill();
}

function blinkers(ctx: CanvasRenderingContext2D, e: Ent, x: number, y: number, w: number, t: number) {
  circle(ctx, x - w * 0.36, y, w * 0.045, "#c0282d");
  circle(ctx, x + w * 0.36, y, w * 0.045, "#c0282d");
  if (e.blink > 0 && Math.floor(t * 6) % 2 === 0) {
    const bx = x + e.blinkDir * w * 0.46;
    circle(ctx, bx, y, w * 0.09, "rgba(255,170,40,0.4)");
    circle(ctx, bx, y, w * 0.045, "#ffb020");
  }
}

function drawEnt(ctx: CanvasRenderingContext2D, e: Ent, x: number, y: number, w: number, t: number) {
  const bob = Math.sin(t * 4 + e.seed * 10) * w * 0.08;
  switch (e.kind) {
    case "turtle": {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.55, w * 0.06, 0, 0, TAU);
      ctx.fill();
      wheels(ctx, x, y, w);
      ctx.fillStyle = "#8a5a32";
      roundRect(ctx, x - w * 0.45, y - w * 0.42, w * 0.9, w * 0.26, w * 0.06);
      ctx.fill();
      ctx.fillStyle = "#4f8f42";
      ctx.beginPath();
      ctx.ellipse(x, y - w * 0.42, w * 0.4, w * 0.32, 0, Math.PI, TAU);
      ctx.fill();
      ctx.strokeStyle = "#35682c";
      ctx.lineWidth = Math.max(1, w * 0.025);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.14, y - w * 0.42);
      ctx.lineTo(x - w * 0.1, y - w * 0.62);
      ctx.lineTo(x + w * 0.1, y - w * 0.62);
      ctx.lineTo(x + w * 0.14, y - w * 0.42);
      ctx.moveTo(x - w * 0.1, y - w * 0.62);
      ctx.lineTo(x - w * 0.28, y - w * 0.6);
      ctx.moveTo(x + w * 0.1, y - w * 0.62);
      ctx.lineTo(x + w * 0.28, y - w * 0.6);
      ctx.stroke();
      circle(ctx, x, y - w * 0.36, w * 0.05, "#8fc46a");
      blinkers(ctx, e, x, y - w * 0.3, w, t);
      break;
    }
    case "frog": {
      ctx.fillStyle = "rgba(0,0,0,0.25)";
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.55, w * 0.06, 0, 0, TAU);
      ctx.fill();
      wheels(ctx, x, y, w);
      ctx.fillStyle = "#4cae4c";
      roundRect(ctx, x - w * 0.46, y - w * 0.5, w * 0.92, w * 0.36, w * 0.14);
      ctx.fill();
      circle(ctx, x - w * 0.22, y - w * 0.55, w * 0.16, "#4cae4c");
      circle(ctx, x + w * 0.22, y - w * 0.55, w * 0.16, "#4cae4c");
      circle(ctx, x - w * 0.25, y - w * 0.58, w * 0.05, "#7fd07a");
      circle(ctx, x + w * 0.19, y - w * 0.58, w * 0.05, "#7fd07a");
      circle(ctx, x - w * 0.12, y - w * 0.32, w * 0.04, "#2f7a2f");
      circle(ctx, x + w * 0.16, y - w * 0.4, w * 0.03, "#2f7a2f");
      blinkers(ctx, e, x, y - w * 0.28, w, t);
      break;
    }
    case "cone": {
      ctx.save();
      if (e.knock > 0) {
        ctx.globalAlpha = Math.max(0, 1 - e.knock * 1.5);
        ctx.translate(x + e.knock * w * 3 * (e.seed > 0.5 ? 1 : -1), y - e.knock * w * 6);
        ctx.rotate(e.knock * 8);
        ctx.translate(-x, -y);
      }
      ctx.fillStyle = "#333";
      ctx.fillRect(x - w * 0.5, y - w * 0.12, w, w * 0.12);
      ctx.fillStyle = "#ff7a1a";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.38, y - w * 0.12);
      ctx.lineTo(x, y - w * 1.25);
      ctx.lineTo(x + w * 0.38, y - w * 0.12);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x - w * 0.25, y - w * 0.5);
      ctx.lineTo(x - w * 0.14, y - w * 0.8);
      ctx.lineTo(x + w * 0.14, y - w * 0.8);
      ctx.lineTo(x + w * 0.25, y - w * 0.5);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
      break;
    }
    case "rock":
      drawScenery(ctx, "rock", x, y, w, t, e.seed, "");
      break;
    case "oil": {
      const g = ctx.createRadialGradient(x - w * 0.1, y - w * 0.04, 0, x, y - w * 0.03, w * 0.5);
      g.addColorStop(0, "#5a4a7a");
      g.addColorStop(0.4, "#1d1a24");
      g.addColorStop(1, "#111");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.ellipse(x, y - w * 0.03, w * 0.5, w * 0.08, 0, 0, TAU);
      ctx.fill();
      ctx.fillStyle = "rgba(160,220,255,0.35)";
      ctx.beginPath();
      ctx.ellipse(x + w * 0.12, y - w * 0.05, w * 0.12, w * 0.02, 0, 0, TAU);
      ctx.fill();
      break;
    }
    case "ramp": {
      const top = y - w * 0.35;
      ctx.fillStyle = "#2a2a2a";
      ctx.beginPath();
      ctx.moveTo(x - w / 2, y);
      ctx.lineTo(x - w * 0.42, top);
      ctx.lineTo(x + w * 0.42, top);
      ctx.lineTo(x + w / 2, y);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.clip();
      ctx.fillStyle = "#ffcc33";
      for (let k = -4; k < 6; k++) {
        ctx.beginPath();
        ctx.moveTo(x - w / 2 + k * w * 0.2, y);
        ctx.lineTo(x - w / 2 + k * w * 0.2 + w * 0.1, y);
        ctx.lineTo(x - w / 2 + k * w * 0.2 + w * 0.3, top);
        ctx.lineTo(x - w / 2 + k * w * 0.2 + w * 0.2, top);
        ctx.closePath();
        ctx.fill();
      }
      ctx.restore();
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.moveTo(x, top + w * 0.04);
      ctx.lineTo(x + w * 0.08, top + w * 0.14);
      ctx.lineTo(x - w * 0.08, top + w * 0.14);
      ctx.closePath();
      ctx.fill();
      break;
    }
    case "fuel": {
      const cy = y - w * 0.3 + bob;
      circle(ctx, x, cy - w * 0.5, w * 0.9, "rgba(126,224,160,0.25)");
      ctx.fillStyle = "#d9352b";
      roundRect(ctx, x - w * 0.45, cy - w * 1.1, w * 0.9, w * 1.1, w * 0.12);
      ctx.fill();
      ctx.fillStyle = "#b52a22";
      ctx.fillRect(x - w * 0.3, cy - w * 1.3, w * 0.3, w * 0.22);
      ctx.fillStyle = "#ffd166";
      ctx.fillRect(x + w * 0.12, cy - w * 1.25, w * 0.16, w * 0.18);
      ctx.strokeStyle = "rgba(255,255,255,0.6)";
      ctx.lineWidth = Math.max(1, w * 0.06);
      ctx.beginPath();
      ctx.moveTo(x - w * 0.3, cy - w * 0.25);
      ctx.lineTo(x + w * 0.3, cy - w * 0.85);
      ctx.moveTo(x - w * 0.3, cy - w * 0.85);
      ctx.lineTo(x + w * 0.3, cy - w * 0.25);
      ctx.stroke();
      break;
    }
    case "worm": {
      const cy = y - w * 0.4 + bob;
      for (let k = 0; k < 6; k++) {
        const wx = x + (k - 2.5) * w * 0.16;
        const wy = cy + Math.sin(t * 8 + k * 0.9) * w * 0.12;
        circle(ctx, wx, wy, w * 0.14, k === 5 ? "#ff8fae" : "#ff9fbb");
      }
      circle(ctx, x + w * 0.42, cy - w * 0.04, w * 0.03, "#222");
      break;
    }
    case "boost": {
      const cy = y - w * 0.4 + bob;
      circle(ctx, x, cy - w * 0.4, w * 0.9, "rgba(127,216,255,0.3)");
      ctx.fillStyle = "#2f7de0";
      roundRect(ctx, x - w * 0.35, cy - w * 1.0, w * 0.7, w * 1.0, w * 0.15);
      ctx.fill();
      ctx.fillStyle = "#9ad4ff";
      ctx.fillRect(x - w * 0.12, cy - w * 1.25, w * 0.24, w * 0.28);
      ctx.fillStyle = "#ffd166";
      ctx.beginPath();
      ctx.moveTo(x + w * 0.05, cy - w * 0.9);
      ctx.lineTo(x - w * 0.15, cy - w * 0.45);
      ctx.lineTo(x, cy - w * 0.45);
      ctx.lineTo(x - w * 0.05, cy - w * 0.1);
      ctx.lineTo(x + w * 0.15, cy - w * 0.55);
      ctx.lineTo(x, cy - w * 0.55);
      ctx.closePath();
      ctx.fill();
      break;
    }
  }
}

// ---------- the player's car (rear view) ----------

function drawGill(ctx: CanvasRenderingContext2D, m: Morph, bx: number, by: number, ang: number, len: number, pass: number) {
  const dx = Math.cos(ang);
  const dy = Math.sin(ang);
  const ex = bx + dx * len;
  const ey = by + dy * len;
  const grow = pass === 0 ? 3 : 0;
  const col = pass === 0 ? m.outline : m.gill;
  ctx.strokeStyle = col;
  ctx.fillStyle = col;
  ctx.lineWidth = 6 + grow;
  ctx.beginPath();
  ctx.moveTo(bx, by);
  ctx.lineTo(ex, ey);
  ctx.stroke();
  for (let j = 0; j < 3; j++) {
    const u = 0.4 + j * 0.25;
    const side = j % 2 === 0 ? 1 : -1;
    const px = bx + dx * len * u - dy * 6 * side;
    const py = by + dy * len * u + dx * 6 * side;
    ctx.beginPath();
    ctx.ellipse(px, py, 7 + grow / 2, 4 + grow / 2, ang + side * 0.6, 0, TAU);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.arc(ex, ey, 5 + grow / 2, 0, TAU);
  ctx.fill();
  if (pass === 1) circle(ctx, ex - 1.5, ey - 1.5, 2.2, m.gillTip);
}

interface CarLook {
  t: number;
  tilt: number;
  roll: number;
  brake: boolean;
  boost: boolean;
  speedPct: number;
  dizzy: boolean;
  cheer: boolean;
  flash: boolean;
}

function drawPlayer(ctx: CanvasRenderingContext2D, m: Morph, x: number, y: number, alt: number, look: CarLook) {
  const s = CAR_PX / 240;
  const lift = alt * (CAM_DEPTH / PLAYER_Z) * (H / 2);
  ctx.fillStyle = "rgba(0,0,0,0.3)";
  ctx.beginPath();
  const shrink = 1 / (1 + alt / 900);
  ctx.ellipse(x, y, 130 * s * shrink, 14 * s * shrink, 0, 0, TAU);
  ctx.fill();

  ctx.save();
  ctx.translate(x, y - lift - 60 * s);
  ctx.rotate(look.roll + look.tilt * 0.06);
  ctx.scale(s, s);
  ctx.translate(0, 60);
  if (look.flash) ctx.globalAlpha = 0.45;
  ctx.lineJoin = "round";
  ctx.lineCap = "round";

  // tyres
  ctx.fillStyle = "#1c1c20";
  roundRect(ctx, -118, -52, 40, 52, 10);
  ctx.fill();
  roundRect(ctx, 78, -52, 40, 52, 10);
  ctx.fill();
  ctx.strokeStyle = "#34343a";
  ctx.lineWidth = 3;
  for (let k = 0; k < 4; k++) {
    const ty = -44 + ((k * 12 + look.t * 400 * look.speedPct) % 48);
    ctx.beginPath();
    ctx.moveTo(-114, ty);
    ctx.lineTo(-82, ty);
    ctx.moveTo(82, ty);
    ctx.lineTo(114, ty);
    ctx.stroke();
  }

  // axolotl (behind the rear panel)
  const hy = -128 + Math.sin(look.t * 18) * 1.5 * look.speedPct;
  const flap = Math.sin(look.t * 16) * 0.14 * (0.3 + look.speedPct);
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 3; k++) {
      const base = [-0.55, -0.1, 0.3][k];
      const len = [34, 38, 30][k];
      const off = [-14, 0, 12][k];
      drawGill(ctx, m, -34, hy + off, Math.PI - base + flap * (k + 1) * 0.6, len, pass);
      drawGill(ctx, m, 34, hy + off, base - flap * (k + 1) * 0.6, len, pass);
    }
  }
  if (look.cheer) {
    ctx.strokeStyle = m.outline;
    ctx.lineWidth = 12;
    ctx.beginPath();
    ctx.moveTo(-30, hy + 20);
    ctx.lineTo(-58, hy - 38);
    ctx.moveTo(30, hy + 20);
    ctx.lineTo(58, hy - 38);
    ctx.stroke();
    ctx.strokeStyle = m.body;
    ctx.lineWidth = 8;
    ctx.stroke();
    circle(ctx, -58, hy - 40, 7, m.body);
    circle(ctx, 58, hy - 40, 7, m.body);
  }
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(0, hy, 48, 41, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.body;
  ctx.beginPath();
  ctx.ellipse(0, hy, 45, 38, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.shade;
  ctx.globalAlpha = look.flash ? 0.2 : 0.35;
  ctx.beginPath();
  ctx.ellipse(0, hy + 18, 40, 18, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = look.flash ? 0.25 : 0.5;
  ctx.fillStyle = "#ffffff";
  ctx.beginPath();
  ctx.ellipse(-12, hy - 22, 18, 8, -0.3, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = look.flash ? 0.45 : 1;
  for (const [sx, sy, r] of [
    [-14, -6, 3.5],
    [10, -14, 3],
    [18, 6, 2.5],
  ]) {
    circle(ctx, sx, hy + sy, r, m.spots);
  }

  // car body
  const body = ctx.createLinearGradient(0, -110, 0, -20);
  body.addColorStop(0, "#4fd8c8");
  body.addColorStop(1, "#1f9e90");
  ctx.fillStyle = body;
  ctx.strokeStyle = "#136b61";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(-112, -26);
  ctx.lineTo(-104, -88);
  ctx.quadraticCurveTo(-100, -104, -80, -106);
  ctx.lineTo(80, -106);
  ctx.quadraticCurveTo(100, -104, 104, -88);
  ctx.lineTo(112, -26);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.35)";
  roundRect(ctx, -86, -104, 172, 8, 4);
  ctx.fill();
  ctx.fillStyle = "#17857a";
  roundRect(ctx, -96, -74, 192, 34, 10);
  ctx.fill();
  // tail lights
  const lightCol = look.brake ? "#ff2a2a" : "#b3202a";
  if (look.brake) {
    circle(ctx, -74, -57, 26, "rgba(255,60,60,0.35)");
    circle(ctx, 74, -57, 26, "rgba(255,60,60,0.35)");
  }
  ctx.fillStyle = lightCol;
  roundRect(ctx, -92, -66, 36, 18, 6);
  ctx.fill();
  roundRect(ctx, 56, -66, 36, 18, 6);
  ctx.fill();
  ctx.fillStyle = "rgba(255,255,255,0.5)";
  roundRect(ctx, -88, -64, 12, 5, 2);
  ctx.fill();
  roundRect(ctx, 60, -64, 12, 5, 2);
  ctx.fill();
  // plate
  ctx.fillStyle = "#fdfdf5";
  roundRect(ctx, -28, -68, 56, 22, 4);
  ctx.fill();
  ctx.fillStyle = "#223";
  ctx.font = "900 14px system-ui, sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("AXO", 0, -52);
  // bumper
  ctx.fillStyle = "#2a2f36";
  roundRect(ctx, -114, -30, 228, 14, 7);
  ctx.fill();
  // exhaust + boost flame
  circle(ctx, -60, -18, 7, "#555");
  circle(ctx, -60, -18, 4, "#222");
  if (look.boost) {
    const fl = 16 + Math.random() * 10;
    circle(ctx, -60, -12, fl * 1.4, "rgba(127,200,255,0.35)");
    circle(ctx, -60, -12, fl, "rgba(255,170,60,0.75)");
    circle(ctx, -60, -14, fl * 0.5, "#fff6c8");
  }
  if (look.dizzy) {
    for (let k = 0; k < 3; k++) {
      const a = look.t * 6 + (k * TAU) / 3;
      const sx = Math.cos(a) * 44;
      const sy = hy - 52 + Math.sin(a) * 10;
      ctx.fillStyle = "#ffd166";
      ctx.font = "900 20px system-ui, sans-serif";
      ctx.fillText("★", sx, sy);
    }
  }
  ctx.restore();
}

// ---------- rendering ----------

const PX1 = new Float32Array(DRAW);
const PY1 = new Float32Array(DRAW);
const PW1 = new Float32Array(DRAW);
const PS1 = new Float32Array(DRAW);
const PX2 = new Float32Array(DRAW);
const PY2 = new Float32Array(DRAW);
const PW2 = new Float32Array(DRAW);
const PS2 = new Float32Array(DRAW);
const CLIP = new Float32Array(DRAW);

function hexToRgb(hex: string) {
  const n = parseInt(hex.slice(1), 16);
  return `${(n >> 16) & 255},${(n >> 8) & 255},${n & 255}`;
}

function paintSky(ctx: CanvasRenderingContext2D, S: Game, b: Biome, alpha: number, climb: number) {
  ctx.globalAlpha = alpha;
  const horizon = H / 2 + 24 + climb;
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, b.sky[0]);
  sky.addColorStop(1, b.sky[1]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);
  const sunX = b.sun.x * W - S.skyX * 0.05;
  const sunY = b.sun.y * H + climb * 0.3;
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 240);
  glow.addColorStop(0, `rgba(${b.sun.glow},0.9)`);
  glow.addColorStop(0.08, `rgba(${b.sun.glow},0.55)`);
  glow.addColorStop(1, `rgba(${b.sun.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  circle(ctx, sunX, sunY, 16, `rgb(${b.sun.glow})`);

  for (let c = 0; c < 6; c++) {
    const cx = ((((hash1(c, 5) * W * 2 - S.skyX * 0.25 + S.t * 6) % (W * 2)) + W * 2) % (W * 2)) - W * 0.5;
    const cy = 40 + hash1(c, 7) * 120 + climb * 0.2;
    for (let k = 0; k < 5; k++) {
      const r = 18 + hash1(c * 10 + k, 9) * 22;
      const g = ctx.createRadialGradient(cx + k * 22, cy - (k % 2) * 10, 0, cx + k * 22, cy - (k % 2) * 10, r);
      const col = b.volcano ? "120,90,110" : "255,255,255";
      g.addColorStop(0, `rgba(${col},0.65)`);
      g.addColorStop(1, `rgba(${col},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + k * 22, cy - (k % 2) * 10, r, 0, TAU);
      ctx.fill();
    }
  }

  const layers = [
    { color: b.hills[0], amp: 150, freq: 0.004, p: 0.4, seed: 3 },
    { color: b.hills[1], amp: 90, freq: 0.007, p: 1, seed: 8 },
  ];
  layers.forEach((L, li) => {
    const off = S.skyX * L.p;
    const hAt = (x: number) => {
      let n = fbm((x + off) * L.freq, L.seed);
      if (b.mesa) {
        const q = clamp((n - 0.42) / 0.1, 0, 1);
        n = 0.25 + q * q * (3 - 2 * q) * 0.7;
      }
      return L.amp * (0.3 + 0.75 * n);
    };
    const path = new Path2D();
    path.moveTo(-10, horizon + 2);
    for (let x = -10; x <= W + 10; x += 6) path.lineTo(x, horizon - hAt(x));
    path.lineTo(W + 10, horizon + 2);
    path.closePath();
    ctx.fillStyle = L.color;
    ctx.fill(path);
    if (b.snowcaps) {
      ctx.save();
      ctx.clip(path);
      ctx.fillStyle = "rgba(250,252,254,0.92)";
      ctx.beginPath();
      ctx.moveTo(-10, 0);
      for (let x = -10; x <= W + 10; x += 6) ctx.lineTo(x, horizon - L.amp * (0.65 + fbm((x + off) * 0.03, 4) * 0.25));
      ctx.lineTo(W + 10, 0);
      ctx.fill();
      ctx.restore();
    }
    if (b.volcano && li === 0) {
      const vx = ((((W * 0.7 - off) % (W * 1.6)) + W * 1.6) % (W * 1.6)) - W * 0.3;
      const peak = horizon - 200;
      ctx.fillStyle = L.color;
      ctx.beginPath();
      ctx.moveTo(vx - 230, horizon + 2);
      ctx.quadraticCurveTo(vx - 60, peak + 40, vx - 22, peak);
      ctx.lineTo(vx + 22, peak);
      ctx.quadraticCurveTo(vx + 60, peak + 40, vx + 230, horizon + 2);
      ctx.fill();
      const lg = ctx.createRadialGradient(vx, peak, 0, vx, peak, 70);
      lg.addColorStop(0, "rgba(255,150,60,0.85)");
      lg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(vx - 70, peak - 70, 140, 140);
      for (let k = 0; k < 12; k++) {
        const age = (S.t * 0.07 + k / 12) % 1;
        const px = vx + age * 120;
        const py = peak - age * 220;
        const pr = 12 + age * 55;
        const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, `rgba(70,55,65,${0.55 * (1 - age)})`);
        g.addColorStop(1, "rgba(70,55,65,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      }
    }
    const hz = ctx.createLinearGradient(0, horizon - L.amp, 0, horizon);
    hz.addColorStop(0, `rgba(${hexToRgb(b.fog)},0)`);
    hz.addColorStop(1, `rgba(${hexToRgb(b.fog)},${li === 0 ? 0.6 : 0.35})`);
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon - L.amp * 1.2, W, L.amp * 1.2);
  });
  ctx.fillStyle = b.fog;
  ctx.fillRect(0, horizon, W, H - horizon);
  ctx.globalAlpha = 1;
}

function poly(ctx: CanvasRenderingContext2D, x1: number, y1: number, x2: number, y2: number, x3: number, y3: number, x4: number, y4: number, color: string) {
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.lineTo(x3, y3);
  ctx.lineTo(x4, y4);
  ctx.closePath();
  ctx.fill();
}

function render(ctx: CanvasRenderingContext2D, S: Game, morph: Morph, dpr: number) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = S.t;
  const shX = S.shake * 8 * Math.sin(t * 57);
  const shY = S.shake * 6 * Math.cos(t * 49);
  ctx.translate(shX, shY);

  const baseIdx = Math.floor(S.pos / SEG);
  const basePct = (S.pos % SEG) / SEG;
  const pz = S.pos + PLAYER_Z;
  const pIdx = Math.floor(pz / SEG);
  const pPct = (pz % SEG) / SEG;
  const playerY = lerp(hillAt(pIdx), hillAt(pIdx + 1), pPct);
  const camY = playerY + CAM_H;
  const m = meters(S);

  // background with a cross-fade into each new landscape
  const bi = biomeIndexAt(Math.floor(m));
  const into = m - bi * BIOME_M;
  const fade = bi > 0 ? clamp(into / 150, 0, 1) : 1;
  const climb = clamp(-(playerY - hillAt(pIdx + 60)) * 0.004, -40, 40);
  if (fade < 1) paintSky(ctx, S, BIOMES[(bi - 1) % BIOMES.length], 1, climb);
  paintSky(ctx, S, BIOMES[bi % BIOMES.length], fade, climb);

  // project and draw road, near to far
  let x = 0;
  let dx = -(curveAt(baseIdx) * basePct);
  let maxy = H;
  const half = W / 2;
  for (let n = 0; n < DRAW; n++) {
    const i = baseIdx + n;
    const z1 = i * SEG - S.pos;
    const z2 = z1 + SEG;
    const cx1 = S.x * ROAD_W - x;
    const cx2 = S.x * ROAD_W - x - dx;
    const s1 = CAM_DEPTH / Math.max(z1, 1);
    const s2 = CAM_DEPTH / Math.max(z2, 1);
    PS1[n] = s1;
    PS2[n] = s2;
    PX1[n] = half + s1 * -cx1 * half;
    PY1[n] = H / 2 - s1 * (hillAt(i) - camY) * (H / 2);
    PW1[n] = s1 * ROAD_W * half;
    PX2[n] = half + s2 * -cx2 * half;
    PY2[n] = H / 2 - s2 * (hillAt(i + 1) - camY) * (H / 2);
    PW2[n] = s2 * ROAD_W * half;
    x += dx;
    dx += curveAt(i);
    CLIP[n] = maxy;
    if (z1 <= CAM_DEPTH || PY2[n] >= PY1[n] || PY2[n] >= maxy) continue;

    const b = biomeAt(i);
    const band = Math.floor(i / RUMBLE) % 2;
    const y1 = PY1[n] + 0.5;
    const y2 = PY2[n];
    const x1 = PX1[n];
    const x2 = PX2[n];
    const w1 = PW1[n];
    const w2 = PW2[n];
    ctx.fillStyle = b.grass[band];
    ctx.fillRect(0, y2, W, y1 - y2);
    const r1 = w1 / 6;
    const r2 = w2 / 6;
    poly(ctx, x1 - w1 - r1, y1, x1 - w1, y1, x2 - w2, y2, x2 - w2 - r2, y2, b.rumble[band]);
    poly(ctx, x1 + w1 + r1, y1, x1 + w1, y1, x2 + w2, y2, x2 + w2 + r2, y2, b.rumble[band]);
    poly(ctx, x1 - w1, y1, x1 + w1, y1, x2 + w2, y2, x2 - w2, y2, b.road[band]);
    const e1 = w1 / 40;
    const e2 = w2 / 40;
    poly(ctx, x1 - w1 + e1, y1, x1 - w1 + e1 * 2, y1, x2 - w2 + e2 * 2, y2, x2 - w2 + e2, y2, "rgba(255,255,255,0.8)");
    poly(ctx, x1 + w1 - e1, y1, x1 + w1 - e1 * 2, y1, x2 + w2 - e2 * 2, y2, x2 + w2 - e2, y2, "rgba(255,255,255,0.8)");
    if (band === 0) {
      const l1 = w1 / 32;
      const l2 = w2 / 32;
      const lw1 = (w1 * 2) / LANES;
      const lw2 = (w2 * 2) / LANES;
      for (let k = 1; k < LANES; k++) {
        const lx1 = x1 - w1 + lw1 * k;
        const lx2 = x2 - w2 + lw2 * k;
        poly(ctx, lx1 - l1 / 2, y1, lx1 + l1 / 2, y1, lx2 + l2 / 2, y2, lx2 - l2 / 2, y2, b.lane);
      }
    }
    const fog = 1 - Math.exp(-((n / DRAW) * (n / DRAW)) * FOG);
    if (fog > 0.01) {
      ctx.globalAlpha = fog;
      ctx.fillStyle = b.fog;
      ctx.fillRect(0, y2, W, PY1[n] - y2);
      ctx.globalAlpha = 1;
    }
    maxy = y2;
  }

  // sprites, far to near
  const buckets = new Map<number, Ent[]>();
  for (const e of S.ents) {
    const n = Math.floor(e.z / SEG) - baseIdx;
    if (n < 1 || n >= DRAW) continue;
    const list = buckets.get(n);
    if (list) list.push(e);
    else buckets.set(n, [e]);
  }
  const playerN = pIdx - baseIdx;
  const withClip = (clipY: number, bottom: number, fn: () => void) => {
    if (bottom <= clipY) {
      fn();
      return;
    }
    if (clipY <= 0) return;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-20, -20, W + 40, clipY + 20);
    ctx.clip();
    fn();
    ctx.restore();
  };
  for (let n = DRAW - 1; n >= 1; n--) {
    const i = baseIdx + n;
    const s1 = PS1[n];
    if (s1 <= 0 || i * SEG - S.pos <= CAM_DEPTH) continue;
    const b = biomeAt(i);
    const fogA = 1 - Math.exp(-((n / DRAW) * (n / DRAW)) * FOG);
    const alpha = 1 - fogA * 0.85;
    ctx.globalAlpha = alpha;
    const placeScenery = (side: number, kind: Scenery, off: number, seed: number, label: string) => {
      const w = s1 * SCENERY_W[kind] * half;
      if (w < 2) return;
      const sx = PX1[n] + s1 * off * side * ROAD_W * half;
      if (sx + w < 0 || sx - w > W) return;
      withClip(CLIP[n], PY1[n], () => drawScenery(ctx, kind, sx, PY1[n], w, t, seed, label));
    };
    if (i % BIOME_M === 12) {
      placeScenery(-1, "sign", 1.5, 0, b.name);
      placeScenery(1, "sign", 1.5, 0, b.name);
    } else if (i % 400 === 200) {
      placeScenery(hash1(i, 3) < 0.5 ? -1 : 1, "billboard", 1.6, 0, "");
    } else {
      for (const side of [-1, 1]) {
        if (hash1(i, side > 0 ? 71 : 73) < b.density * 0.5) {
          const kind = b.scenery[Math.floor(hash1(i, side > 0 ? 83 : 89) * b.scenery.length)];
          placeScenery(side, kind, 1.3 + hash1(i, side > 0 ? 79 : 97) * 2.6, hash1(i, 5), "");
        }
      }
    }
    const ents = buckets.get(n);
    if (ents) {
      for (const e of ents) {
        const pct = (e.z % SEG) / SEG;
        const sc = lerp(PS1[n], PS2[n], pct);
        const ex = lerp(PX1[n], PX2[n], pct) + sc * e.x * ROAD_W * half;
        const ey = lerp(PY1[n], PY2[n], pct);
        const w = sc * ENT_W[e.kind] * ROAD_W * half;
        if (w < 1 || (e.knock > 0.7 && e.kind === "cone")) continue;
        withClip(CLIP[n], ey, () => drawEnt(ctx, e, ex, ey, w, t));
      }
    }
    ctx.globalAlpha = 1;
    if (n === playerN) drawPlayerNow();
  }
  if (playerN < 1) drawPlayerNow();

  function drawPlayerNow() {
    const airborne = S.alt > 0;
    const look: CarLook = {
      t,
      tilt: S.steer,
      roll: S.roll + (S.spin > 0 ? Math.sin(S.spin * 18) * 0.3 * S.spin : 0) + (S.slip > 0 ? Math.sin(t * 20) * 0.08 : 0),
      brake: S.keys.down && S.mode === "play",
      boost: S.mode === "play" && (S.boostT > 0 || (S.keys.up && S.fuel > 0)),
      speedPct: S.speed / MAX_SPEED,
      dizzy: S.spin > 0 || (S.mode === "over" && S.hearts <= 0),
      cheer: airborne,
      flash: S.invuln > 0 && Math.floor(t * 12) % 2 === 0,
    };
    const bounce = S.mode === "play" && !airborne ? Math.sin(t * 30) * S.speed * 0.00012 * (Math.abs(S.x) > 1 ? 4 : 1) : 0;
    drawPlayer(ctx, morph, W / 2, H - 14 + bounce, S.alt, look);
  }

  // speed lines while boosting
  if (S.mode === "play" && (S.boostT > 0 || (S.keys.up && S.fuel > 0))) {
    ctx.strokeStyle = "rgba(255,255,255,0.35)";
    ctx.lineWidth = 2;
    for (let k = 0; k < 16; k++) {
      const a = hash1(k + Math.floor(t * 20), 3) * TAU;
      const r0 = 180 + hash1(k, 4) * 120;
      ctx.beginPath();
      ctx.moveTo(W / 2 + Math.cos(a) * r0, H / 2 + Math.sin(a) * r0 * 0.6);
      ctx.lineTo(W / 2 + Math.cos(a) * (r0 + 140), H / 2 + Math.sin(a) * (r0 + 140) * 0.6);
      ctx.stroke();
    }
  }

  const amb = BIOMES[bi % BIOMES.length].ambient;
  if (amb) {
    ctx.fillStyle = amb === "snow" ? "rgba(255,255,255,0.85)" : "rgba(60,50,55,0.6)";
    const rush = S.pos * 0.002;
    for (let k = 0; k < 90; k++) {
      const fx = (((hash1(k, 11) * W + Math.sin(t + k) * 12 - S.skyX * 0.5) % W) + W) % W;
      const fy = (hash1(k, 13) * H + t * (30 + hash1(k, 17) * 40) + rush * (0.5 + hash1(k, 19))) % H;
      circle(ctx, fx, fy, 1 + hash1(k, 23) * 2, ctx.fillStyle as string);
    }
  }

  for (const p of S.particles) {
    ctx.globalAlpha = 1 - p.life / p.max;
    circle(ctx, p.x, p.y, p.r, p.color);
  }
  ctx.globalAlpha = 1;

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  drawHud(ctx, S);
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(s, x + 1.5, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function heart(ctx: CanvasRenderingContext2D, x: number, y: number, s: number, full: boolean) {
  ctx.fillStyle = full ? "#ff5f7e" : "rgba(255,255,255,0.25)";
  ctx.beginPath();
  ctx.moveTo(x, y + s * 0.35);
  ctx.bezierCurveTo(x, y, x - s * 0.5, y, x - s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x - s * 0.5, y + s * 0.6, x, y + s * 0.8, x, y + s);
  ctx.bezierCurveTo(x, y + s * 0.8, x + s * 0.5, y + s * 0.6, x + s * 0.5, y + s * 0.3);
  ctx.bezierCurveTo(x + s * 0.5, y, x, y, x, y + s * 0.35);
  ctx.fill();
}

function panel(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number) {
  ctx.fillStyle = "rgba(10,20,30,0.45)";
  roundRect(ctx, x, y, w, h, 12);
  ctx.fill();
}

function drawHud(ctx: CanvasRenderingContext2D, S: Game) {
  const t = S.t;
  if (S.mode !== "title") {
    panel(ctx, 14, 14, 200, 70);
    for (let k = 0; k < 3; k++) heart(ctx, 38 + k * 30, 22, 22, k < S.hearts);
    const low = S.fuel < 0.2;
    ctx.fillStyle = "rgba(255,255,255,0.18)";
    roundRect(ctx, 26, 56, 176, 14, 7);
    ctx.fill();
    ctx.fillStyle = low && Math.floor(t * 4) % 2 === 0 ? "#ff6b6b" : S.fuel < 0.4 ? "#ffd166" : "#7ee0a0";
    roundRect(ctx, 26, 56, Math.max(8, 176 * S.fuel), 14, 7);
    ctx.fill();
    text(ctx, "FUEL", 120, 67, "800 11px system-ui, sans-serif", "#10202a", "center");

    const m = Math.floor(meters(S));
    text(ctx, `${m.toLocaleString()} m`, W / 2, 40, "800 26px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, BIOMES[biomeIndexAt(m) % BIOMES.length].name, W / 2, 60, "600 13px system-ui, sans-serif", "#e8f0f6", "center");

    panel(ctx, W - 204, 14, 190, 70);
    text(ctx, scoreOf(S).toLocaleString(), W - 26, 50, "900 30px system-ui, sans-serif", "#ffe08a", "right");
    text(ctx, `Best ${S.best.score.toLocaleString()}`, W - 26, 72, "600 12px system-ui, sans-serif", "#d8e6f0", "right");
    if (S.combo > 1) {
      text(ctx, `x${S.combo.toFixed(2).replace(/\.?0+$/, "")}`, W - 190, 50, "900 22px system-ui, sans-serif", "#7fd8ff", "left");
    }

    const kmh = Math.round(S.speed * M_PER_UNIT * 3.6);
    panel(ctx, W - 124, H - 70, 110, 56);
    text(ctx, String(kmh), W - 36, H - 30, "900 30px system-ui, sans-serif", "#ffffff", "right");
    text(ctx, "km/h", W - 36, H - 18, "600 11px system-ui, sans-serif", "#d8e6f0", "right");
  }

  for (const f of S.floaters) {
    const age = S.t - f.t0;
    ctx.globalAlpha = clamp(Math.min(age * 8, (1.6 - age) * 2.5), 0, 1);
    text(ctx, f.text, f.x, f.y - age * 30, `900 ${f.size}px system-ui, sans-serif`, f.color, "center");
  }
  ctx.globalAlpha = 1;

  if (S.banner && S.mode === "play" && S.t - S.banner.t0 < 3) {
    const age = S.t - S.banner.t0;
    ctx.globalAlpha = clamp(Math.min(age * 4, (3 - age) * 2), 0, 1);
    text(ctx, "Now entering", W / 2, 108, "600 16px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, S.banner.text, W / 2, 142, "900 36px system-ui, sans-serif", "#ffffff", "center");
    ctx.globalAlpha = 1;
  }

  if (S.mode === "title") {
    ctx.fillStyle = "rgba(8,14,24,0.35)";
    ctx.fillRect(0, 0, W, H);
    text(ctx, "Axolotl Driver", W / 2, 150, "900 64px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, "Dodge critter traffic, grab fuel, hit ramps for barrel rolls.", W / 2, 192, "600 18px system-ui, sans-serif", "#e8f0f6", "center");
    ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
    text(ctx, "Press Space or tap to start", W / 2, 250, "800 22px system-ui, sans-serif", "#ffe08a", "center");
    ctx.globalAlpha = 1;
    text(ctx, "← → steer    ↑ boost (burns fuel)    ↓ brake    Space pause", W / 2, 290, "500 14px system-ui, sans-serif", "#e8f0f6", "center");
    text(ctx, "Touch: left / right side to steer, middle to boost", W / 2, 312, "500 14px system-ui, sans-serif", "#e8f0f6", "center");
  }

  if (S.mode === "paused") {
    ctx.fillStyle = "rgba(8,14,24,0.45)";
    ctx.fillRect(0, 0, W, H);
    text(ctx, "Paused", W / 2, H / 2 - 10, "900 48px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, "Press Space to keep driving", W / 2, H / 2 + 26, "600 16px system-ui, sans-serif", "#e8f0f6", "center");
  }

  if (S.mode === "over") {
    ctx.fillStyle = "rgba(8,14,24,0.5)";
    ctx.fillRect(0, 0, W, H);
    const pw = 440;
    const ph = 330;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    ctx.fillStyle = "rgba(18,30,44,0.94)";
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    text(ctx, S.overReason, W / 2, py + 46, "900 30px system-ui, sans-serif", "#ff8a8a", "center");
    const rows: [string, string][] = [
      ["Distance", `${Math.floor(meters(S)).toLocaleString()} m`],
      ["Worm snacks", String(S.stats.snacks)],
      ["Near misses", String(S.stats.near)],
      ["Barrel rolls", String(S.stats.rolls)],
      ["Fuel cans", String(S.stats.fuel)],
    ];
    rows.forEach(([k, v], i) => {
      const y = py + 88 + i * 28;
      text(ctx, k, px + 40, y, "600 16px system-ui, sans-serif", "#d8e6f0");
      text(ctx, v, px + pw - 40, y, "800 16px system-ui, sans-serif", "#ffffff", "right");
    });
    text(ctx, `Score ${scoreOf(S).toLocaleString()}`, W / 2, py + 248, "900 28px system-ui, sans-serif", "#ffe08a", "center");
    const note = S.newUnlock ? `Unlocked: ${S.newUnlock} axolotl` + (S.newUnlock.includes("&") ? "s" : "") : S.newBest ? "New best score!" : `Best ${S.best.score.toLocaleString()}`;
    text(ctx, note, W / 2, py + 276, "800 15px system-ui, sans-serif", S.newUnlock || S.newBest ? "#7ee0a0" : "#d8e6f0", "center");
    if (S.modeT > 0.8) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
      text(ctx, "Press Space or tap to drive again", W / 2, py + 312, "600 14px system-ui, sans-serif", "#ffffff", "center");
      ctx.globalAlpha = 1;
    }
  }
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

export default function AxolotlDriver({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const gameRef = useRef<Game>(newGame("title", loadBest()));
  const audioRef = useRef<Audio>(makeAudio());
  const [mode, setMode] = useState<Mode>("title");
  const [best, setBest] = useState<Best>(() => gameRef.current.best);
  const [morphId, setMorphId] = useState(MORPHS[0].id);
  const [muted, setMuted] = useState(false);
  const morph = MORPHS.find((m) => m.id === morphId) ?? MORPHS[0];
  const morphRef = useRef<Morph>(morph);
  morphRef.current = morph;

  const start = () => {
    audioRef.current.unlock();
    const keys = gameRef.current.keys;
    gameRef.current = newGame("play", gameRef.current.best);
    gameRef.current.keys = keys;
  };
  const togglePause = () => {
    const S = gameRef.current;
    if (S.mode === "play") S.mode = "paused";
    else if (S.mode === "paused") S.mode = "play";
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

    const primary = () => {
      const S = gameRef.current;
      if (S.mode === "title" || (S.mode === "over" && S.modeT > 0.8)) start();
      else togglePause();
    };

    const keyMap: Record<string, keyof Game["keys"]> = {
      arrowleft: "left",
      a: "left",
      arrowright: "right",
      d: "right",
      arrowup: "up",
      w: "up",
      arrowdown: "down",
      s: "down",
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === " " || k === "escape" || k === "p") {
        e.preventDefault();
        if (!e.repeat) primary();
        return;
      }
      if (k === "r") {
        start();
        return;
      }
      const dir = keyMap[k];
      if (dir) {
        e.preventDefault();
        gameRef.current.keys[dir] = true;
      }
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyMap[e.key.toLowerCase()];
      if (dir) gameRef.current.keys[dir] = false;
    };

    const pointers = new Map<number, keyof Game["keys"]>();
    const syncPointerKeys = () => {
      const keys = gameRef.current.keys;
      const held = new Set(pointers.values());
      keys.left = held.has("left");
      keys.right = held.has("right");
      keys.up = held.has("up");
    };
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const S = gameRef.current;
      if (S.mode !== "play") {
        primary();
        return;
      }
      audio.unlock();
      const r = cvs.getBoundingClientRect();
      const fx = (e.clientX - r.left) / r.width;
      pointers.set(e.pointerId, fx < 1 / 3 ? "left" : fx > 2 / 3 ? "right" : "up");
      syncPointerKeys();
    };
    const onPointerUp = (e: PointerEvent) => {
      if (!pointers.delete(e.pointerId)) return;
      syncPointerKeys();
    };
    const releaseAll = () => {
      const keys = gameRef.current.keys;
      keys.left = keys.right = keys.up = keys.down = false;
      pointers.clear();
    };
    const onVisibility = () => {
      if (document.hidden && gameRef.current.mode === "play") gameRef.current.mode = "paused";
    };

    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    cvs.addEventListener("pointerdown", onPointerDown);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("blur", releaseAll);
    document.addEventListener("visibilitychange", onVisibility);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    let lastMode: Mode = gameRef.current.mode;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      acc += dt;
      while (acc >= STEP) {
        step(gameRef.current, STEP, audio);
        acc -= STEP;
      }
      const S = gameRef.current;
      render(ctx, S, morphRef.current, dpr);
      if (S.mode !== lastMode) {
        lastMode = S.mode;
        setMode(S.mode);
        setBest(S.best);
      }
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      cvs.removeEventListener("pointerdown", onPointerDown);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("blur", releaseAll);
      document.removeEventListener("visibilitychange", onVisibility);
      audio.engine(0, false);
    };
  }, []);

  return (
    <div style={{ minHeight: "100vh", width: "100%", background: "#0f172a", color: "#f1f5f9", display: "flex", flexDirection: "column", alignItems: "center", padding: 12, gap: 10, boxSizing: "border-box" }}>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexWrap: "wrap", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700 }}>Axolotl Driver</h1>
        <div style={{ display: "flex", gap: 8 }}>
          {mode === "play" || mode === "paused" ? (
            <button style={btn} onClick={togglePause}>
              {mode === "paused" ? "Resume" : "Pause"}
            </button>
          ) : (
            <button style={{ ...btn, background: "#10b981" }} onClick={start}>
              Start
            </button>
          )}
          <button style={btn} onClick={start}>
            Restart
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
        <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", touchAction: "none" }} />
      </div>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, fontSize: 14 }}>
        <span>Driver:</span>
        {MORPHS.map((m) => {
          const need = UNLOCKS[m.id];
          const locked = best.distance < need;
          return (
            <button
              key={m.id}
              disabled={locked}
              onClick={() => setMorphId(m.id)}
              title={locked ? `Drive ${need.toLocaleString()} m in one run to unlock` : m.name}
              style={{
                width: 30,
                height: 30,
                borderRadius: 15,
                background: m.body,
                border: `3px solid ${m.id === morphId ? "#ff5fa2" : m.outline}`,
                cursor: locked ? "not-allowed" : "pointer",
                opacity: locked ? 0.35 : 1,
                padding: 0,
              }}
            />
          );
        })}
        <span style={{ marginLeft: "auto", color: "#cbd5e1" }}>
          Best {best.score.toLocaleString()} pts · {best.distance.toLocaleString()} m
        </span>
      </div>
    </div>
  );
}
