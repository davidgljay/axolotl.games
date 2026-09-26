import React, { useEffect, useRef, useState } from "react";
import { MORPHS, type Morph } from "./axolotl_morphs";

const W = 960;
const H = 540;
const STEP = 1 / 120;
const GRAVITY = 9.8;
const AXO_LEN = 3.4;
const UNIT = AXO_LEN / 200;
const STAND_LIFT = 21 * UNIT;
const DIVES = 5;
const TAU = Math.PI * 2;

// ---------- math / noise ----------

const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const clamp = (v: number, a: number, b: number) => (v < a ? a : v > b ? b : v);

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

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

function interp(pts: [number, number][], s: number) {
  if (s <= pts[0][0]) return pts[0][1];
  for (let i = 1; i < pts.length; i++) {
    const [s1, v1] = pts[i];
    if (s <= s1) {
      const [s0, v0] = pts[i - 1];
      const u = (s - s0) / (s1 - s0);
      return v0 + (v1 - v0) * u * u * (3 - 2 * u);
    }
  }
  return pts[pts.length - 1][1];
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

// ---------- landscapes ----------

type Cap = "moss" | "scrub" | "ash" | "snow";
type Ambient = "waterfall" | "birds" | "volcano" | "snow";

interface Range {
  color: string;
  amp: number;
  freq: number;
  p: number;
  mesa?: boolean;
  snow?: boolean;
}

interface Spot {
  id: string;
  name: string;
  height: number;
  mult: number;
  seed: number;
  sky: [string, string, string];
  sun: { x: number; y: number; glow: string };
  cloud: string;
  ranges: Range[];
  haze: string;
  rock: { base: string; dark: string; light: string };
  cap: Cap;
  sea: { far: string; near: string };
  cut: { top: string; deep: string };
  glint: string;
  ambient: Ambient;
}

const SPOTS: Spot[] = [
  {
    id: "grotto",
    name: "Waterfall Grotto",
    height: 12,
    mult: 1,
    seed: 11,
    sky: ["#4f93d0", "#9fcbea", "#e4f1f3"],
    sun: { x: 0.8, y: 0.14, glow: "255,244,214" },
    cloud: "255,255,255",
    ranges: [
      { color: "#a3c0c4", amp: 130, freq: 0.0045, p: 0.03 },
      { color: "#6b9587", amp: 100, freq: 0.007, p: 0.07 },
      { color: "#3d664a", amp: 62, freq: 0.012, p: 0.13 },
    ],
    haze: "226,238,240",
    rock: { base: "#6d6b5e", dark: "#3d3c35", light: "#9c997f" },
    cap: "moss",
    sea: { far: "#a6cfcd", near: "#3f8f8e" },
    cut: { top: "38,120,122", deep: "6,42,48" },
    glint: "255,250,230",
    ambient: "waterfall",
  },
  {
    id: "canyon",
    name: "Red Rock Canyon",
    height: 22,
    mult: 1.5,
    seed: 23,
    sky: ["#3a82cc", "#8dbce3", "#f3dbb6"],
    sun: { x: 0.2, y: 0.13, glow: "255,238,200" },
    cloud: "255,250,244",
    ranges: [
      { color: "#d8b39c", amp: 120, freq: 0.003, p: 0.03, mesa: true },
      { color: "#b8774f", amp: 92, freq: 0.005, p: 0.07, mesa: true },
      { color: "#874629", amp: 58, freq: 0.009, p: 0.13, mesa: true },
    ],
    haze: "244,222,194",
    rock: { base: "#a3583a", dark: "#5c2c1a", light: "#d08b60" },
    cap: "scrub",
    sea: { far: "#a4c4b6", near: "#3f837a" },
    cut: { top: "44,116,108", deep: "10,44,42" },
    glint: "255,240,210",
    ambient: "birds",
  },
  {
    id: "volcano",
    name: "Volcano Lagoon",
    height: 32,
    mult: 2,
    seed: 37,
    sky: ["#1e1630", "#6a3656", "#f39a58"],
    sun: { x: 0.66, y: 0.4, glow: "255,160,90" },
    cloud: "140,96,112",
    ranges: [
      { color: "#5b3f57", amp: 120, freq: 0.004, p: 0.03 },
      { color: "#382636", amp: 96, freq: 0.006, p: 0.07 },
      { color: "#1d151b", amp: 58, freq: 0.011, p: 0.13 },
    ],
    haze: "236,132,92",
    rock: { base: "#3a3436", dark: "#19161a", light: "#655b5e" },
    cap: "ash",
    sea: { far: "#e39862", near: "#2b5f63" },
    cut: { top: "32,92,96", deep: "6,26,30" },
    glint: "255,190,120",
    ambient: "volcano",
  },
  {
    id: "fjord",
    name: "Arctic Fjord",
    height: 45,
    mult: 3,
    seed: 53,
    sky: ["#7297c0", "#b9d0e5", "#eff4f7"],
    sun: { x: 0.3, y: 0.2, glow: "255,252,240" },
    cloud: "255,255,255",
    ranges: [
      { color: "#d5e0ea", amp: 150, freq: 0.004, p: 0.03, snow: true },
      { color: "#a2b6c8", amp: 118, freq: 0.006, p: 0.07, snow: true },
      { color: "#687e94", amp: 72, freq: 0.01, p: 0.13, snow: true },
    ],
    haze: "232,240,246",
    rock: { base: "#59626d", dark: "#30363e", light: "#8795a5" },
    cap: "snow",
    sea: { far: "#b6cfde", near: "#255c73" },
    cut: { top: "30,86,112", deep: "5,26,40" },
    glint: "255,255,255",
    ambient: "snow",
  },
];

interface Scene {
  face: number[];
  faceTop: number;
  strata: { y: number; h: number; tone: number }[];
  cracks: { dx: number; y: number }[][];
  specks: { dx: number; y: number; light: boolean; s: number }[];
  tufts: { x: number; len: number; lean: number; tone: number; n: number }[];
  bushes: { x: number; r: number; tone: number }[];
  clouds: { x: number; y: number; puffs: { dx: number; dy: number; r: number }[] }[];
  flakes: { x: number; y: number; r: number; v: number }[];
  bergs: { f: number; x: number; w: number; h: number }[];
  patches: { dx: number; y: number; r: number }[];
}

const FACE_STEP = 0.35;
const FACE_BOTTOM = -14;

function buildScene(spot: Spot): Scene {
  const rnd = mulberry32(spot.seed * 9973);
  const face: number[] = [];
  for (let y = spot.height; y >= FACE_BOTTOM; y -= FACE_STEP) {
    const d = spot.height - y;
    face.push(-Math.min(1, d / 1.2) * (0.25 + fbm(y * 0.28, spot.seed) * 1.3) - d * 0.045);
  }
  const strata: Scene["strata"] = [];
  for (let y = FACE_BOTTOM; y < spot.height; ) {
    const h = 0.7 + rnd() * 1.8;
    strata.push({ y, h, tone: rnd() * 2 - 1 });
    y += h;
  }
  const cracks: Scene["cracks"] = [];
  for (let c = 0; c < Math.ceil(spot.height / 2.5); c++) {
    let y = FACE_BOTTOM + rnd() * (spot.height - FACE_BOTTOM - 1);
    let dx = -0.25 - rnd() * 2.2;
    const pts: { dx: number; y: number }[] = [{ dx, y }];
    const n = 3 + Math.floor(rnd() * 6);
    for (let k = 0; k < n; k++) {
      y -= 0.35 + rnd() * 0.6;
      dx = clamp(dx + (rnd() - 0.5) * 0.4, -3, -0.12);
      pts.push({ dx, y });
    }
    cracks.push(pts);
  }
  const specks: Scene["specks"] = [];
  for (let i = 0; i < 900; i++) {
    specks.push({
      dx: -rnd() * 10,
      y: FACE_BOTTOM + rnd() * (spot.height - FACE_BOTTOM),
      light: rnd() > 0.5,
      s: 1 + rnd() * 1.6,
    });
  }
  const tufts: Scene["tufts"] = [];
  const bushes: Scene["bushes"] = [];
  if (spot.cap === "moss" || spot.cap === "scrub") {
    const stepX = spot.cap === "moss" ? 0.13 : 0.45;
    for (let x = -30; x < -0.06; x += stepX * (0.6 + rnd() * 0.8)) {
      tufts.push({
        x,
        len: (spot.cap === "moss" ? 0.14 : 0.2) + rnd() * 0.22,
        lean: (rnd() - 0.5) * 0.2,
        tone: rnd(),
        n: 3 + Math.floor(rnd() * 3),
      });
    }
    for (let x = -30; x < -1.6; x += 1.2 + rnd() * 2.5) {
      bushes.push({ x, r: 0.3 + rnd() * 0.45, tone: rnd() });
    }
  }
  const clouds: Scene["clouds"] = [];
  for (let i = 0; i < 7; i++) {
    const puffs: { dx: number; dy: number; r: number }[] = [];
    const n = 4 + Math.floor(rnd() * 4);
    for (let k = 0; k < n; k++) {
      puffs.push({ dx: (k - n / 2) * 22 + rnd() * 10, dy: -rnd() * 14, r: 16 + rnd() * 20 });
    }
    clouds.push({ x: rnd() * (W * 2), y: 30 + rnd() * 140, puffs });
  }
  const flakes: Scene["flakes"] = [];
  for (let i = 0; i < 120; i++) flakes.push({ x: rnd() * W, y: rnd() * H, r: 0.8 + rnd() * 2, v: 0.4 + rnd() * 0.9 });
  const bergs: Scene["bergs"] = [];
  for (let i = 0; i < 4; i++) bergs.push({ f: 0.06 + rnd() * 0.35, x: 200 + rnd() * 900, w: 40 + rnd() * 80, h: 8 + rnd() * 16 });
  const patches: Scene["patches"] = [];
  if (spot.cap === "moss") {
    for (let i = 0; i < 40; i++) patches.push({ dx: -rnd() * 1.2, y: 0.8 + rnd() * (spot.height - 1.2), r: 0.12 + rnd() * 0.4 });
  }
  return { face, faceTop: spot.height, strata, cracks, specks, tufts, bushes, clouds, flakes, bergs, patches };
}

function faceXAt(scene: Scene, y: number) {
  const f = (scene.faceTop - y) / FACE_STEP;
  if (f <= 0) return scene.face[0];
  const i = Math.floor(f);
  if (i >= scene.face.length - 1) return scene.face[scene.face.length - 1];
  const u = f - i;
  return scene.face[i] * (1 - u) + scene.face[i + 1] * u;
}

// ---------- cartoon axolotl ----------

type Face = "normal" | "squint" | "happy" | "ouch";

interface Pose {
  t: number;
  curl: number;
  wig: number;
  stand: number;
  flow: number;
  flush: number;
  face: Face;
  blink: number;
}

const SN = 40;
const SPINE_LEN = 150;
const PIVOT = 0.8;
const HEAD_OFF = 16;
const HEAD_RX = 27;
const HEAD_RY = 23;
const HALF: [number, number][] = [[0, 1], [0.12, 2.6], [0.3, 5], [0.5, 6.6], [0.7, 7.2], [0.9, 7.6], [1, 8.2]];
const DFIN: [number, number][] = [[0, 2], [0.08, 8], [0.22, 11], [0.38, 8], [0.55, 3], [0.66, 0]];
const VFIN: [number, number][] = [[0, 2], [0.08, 7], [0.2, 8], [0.32, 4], [0.42, 0]];
const SPOT_DOTS = [
  [0.3, 0.5, 1.6],
  [0.42, 0.2, 1.2],
  [0.55, 0.55, 1.8],
  [0.66, 0.1, 1.3],
  [0.76, 0.5, 1.5],
  [0.88, 0.3, 1.1],
];

const spX = new Float32Array(SN);
const spY = new Float32Array(SN);
const spTX = new Float32Array(SN);
const spTY = new Float32Array(SN);

function buildSpine(p: Pose) {
  const i0 = Math.round(PIVOT * (SN - 1));
  const ds = SPINE_LEN / (SN - 1);
  for (let i = 0; i < SN; i++) {
    const s = i / (SN - 1);
    const phi = p.curl * (s - PIVOT) * 3.0 + p.wig * Math.sin(p.t * 7 - s * 9) * Math.pow(1 - s, 1.5);
    spTX[i] = Math.cos(phi);
    spTY[i] = Math.sin(phi);
  }
  spX[i0] = 0;
  spY[i0] = 0;
  for (let i = i0 + 1; i < SN; i++) {
    spX[i] = spX[i - 1] + ((spTX[i - 1] + spTX[i]) / 2) * ds;
    spY[i] = spY[i - 1] + ((spTY[i - 1] + spTY[i]) / 2) * ds;
  }
  for (let i = i0 - 1; i >= 0; i--) {
    spX[i] = spX[i + 1] - ((spTX[i] + spTX[i + 1]) / 2) * ds;
    spY[i] = spY[i + 1] - ((spTY[i] + spTY[i + 1]) / 2) * ds;
  }
}

function spineAt(s: number) {
  const f = clamp(s, 0, 1) * (SN - 1);
  const i = Math.min(SN - 2, Math.floor(f));
  const u = f - i;
  const x = spX[i] + (spX[i + 1] - spX[i]) * u;
  const y = spY[i] + (spY[i + 1] - spY[i]) * u;
  let tx = spTX[i] + (spTX[i + 1] - spTX[i]) * u;
  let ty = spTY[i] + (spTY[i + 1] - spTY[i]) * u;
  const l = Math.hypot(tx, ty) || 1;
  tx /= l;
  ty /= l;
  return { x, y, tx, ty, nx: ty, ny: -tx };
}

const topH = (s: number) => interp(HALF, s) * 0.95;
const botH = (s: number) => interp(HALF, s) * 1.05;

function bodyPath(ctx: CanvasRenderingContext2D) {
  ctx.beginPath();
  for (let i = 0; i < SN; i++) {
    const h = topH(i / (SN - 1));
    const x = spX[i] + spTY[i] * h;
    const y = spY[i] - spTX[i] * h;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  for (let i = SN - 1; i >= 0; i--) {
    const h = botH(i / (SN - 1));
    ctx.lineTo(spX[i] - spTY[i] * h, spY[i] + spTX[i] * h);
  }
  ctx.closePath();
}

function finPath(ctx: CanvasRenderingContext2D, t: number) {
  const tail = spineAt(0);
  ctx.beginPath();
  ctx.moveTo(tail.x - tail.tx * 9, tail.y - tail.ty * 9);
  for (let s = 0; s <= 0.66; s += 0.02) {
    const P = spineAt(s);
    const h = topH(s) + interp(DFIN, s) * (1 + 0.08 * Math.sin(t * 8 - s * 24));
    ctx.lineTo(P.x + P.nx * h, P.y + P.ny * h);
  }
  for (let s = 0.66; s >= 0.42; s -= 0.04) {
    const P = spineAt(s);
    ctx.lineTo(P.x, P.y);
  }
  for (let s = 0.42; s >= 0; s -= 0.02) {
    const P = spineAt(s);
    const h = botH(s) + interp(VFIN, s) * (1 + 0.08 * Math.sin(t * 8 - s * 24 + 1));
    ctx.lineTo(P.x - P.nx * h, P.y - P.ny * h);
  }
  ctx.closePath();
}

function drawLeg(ctx: CanvasRenderingContext2D, m: Morph, p: Pose, front: boolean, far: boolean) {
  const s = (front ? 0.88 : 0.46) + (far ? 0.02 : 0);
  const P = spineAt(s);
  const phi = Math.atan2(P.ty, P.tx);
  const bx = P.x - P.nx * botH(s) * 0.5;
  const by = P.y - P.ny * botH(s) * 0.5;
  const stand = front ? [1.75, 1.15] : [1.45, 2.3];
  const trail = front ? [2.6, 2.9] : [2.8, 3.0];
  const tuck = front ? [0.95, 1.6] : [0.8, 1.4];
  let a1 = lerp(trail[0], stand[0], p.stand);
  let a2 = lerp(trail[1], stand[1], p.stand);
  a1 = lerp(a1, tuck[0], p.curl);
  a2 = lerp(a2, tuck[1], p.curl);
  const flutter = 0.18 * Math.sin(p.t * 8 + (front ? 0 : 1.7)) * (1 - p.stand);
  a1 += flutter + (far ? 0.25 : 0);
  a2 += flutter * 0.6 + (far ? 0.15 : 0);
  const l1 = front ? 9 : 10;
  const l2 = front ? 7 : 8;
  const kx = bx + Math.cos(phi + a1) * l1;
  const ky = by + Math.sin(phi + a1) * l1;
  const fx = kx + Math.cos(phi + a2) * l2;
  const fy = ky + Math.sin(phi + a2) * l2;
  const fill = far ? m.shade : m.body;
  const toeDir = phi + a2;
  const drawShape = (color: string, grow: number) => {
    ctx.strokeStyle = color;
    ctx.fillStyle = color;
    ctx.lineWidth = 4.2 + grow;
    ctx.beginPath();
    ctx.moveTo(bx, by);
    ctx.lineTo(kx, ky);
    ctx.lineTo(fx, fy);
    ctx.stroke();
    for (let j = -1; j <= 1; j++) {
      const a = toeDir + j * 0.55;
      ctx.beginPath();
      ctx.arc(fx + Math.cos(a) * 3.2, fy + Math.sin(a) * 3.2, 1.7 + grow / 2, 0, TAU);
      ctx.fill();
    }
  };
  drawShape(m.outline, 2.6);
  drawShape(fill, 0);
}

function drawGills(ctx: CanvasRenderingContext2D, m: Morph, p: Pose, hx: number, hy: number, ha: number, far: boolean) {
  const c = Math.cos(ha);
  const s = Math.sin(ha);
  const tx = (lx: number, ly: number) => hx + lx * c - ly * s;
  const ty = (lx: number, ly: number) => hy + lx * s + ly * c;
  const elev = [1.15, 0.62, 0.1];
  const lens = [25, 28, 23];
  const baseY = [-12, -3, 7];
  for (let pass = 0; pass < 2; pass++) {
    for (let k = 0; k < 3; k++) {
      let e = elev[k] + 0.12 * Math.sin(p.t * 2.4 + k * 1.3) - p.flow * 0.3 * (1.2 - k * 0.4);
      if (far) e += 0.28;
      const len = lens[k] * (far ? 0.85 : 1);
      const bxl = -8 - (far ? 3 : 0);
      const byl = baseY[k] * (far ? 0.9 : 1);
      const dxl = -Math.cos(e);
      const dyl = -Math.sin(e);
      const exl = bxl + dxl * len;
      const eyl = byl + dyl * len;
      const cxl = bxl + dxl * len * 0.55 - len * 0.12;
      const cyl = byl + dyl * len * 0.55 + len * 0.08;
      const grow = pass === 0 ? 2.6 : 0;
      const col = pass === 0 ? m.outline : far ? m.shade : m.gill;
      ctx.strokeStyle = col;
      ctx.fillStyle = col;
      ctx.lineWidth = 4 + grow;
      ctx.beginPath();
      ctx.moveTo(tx(bxl, byl), ty(bxl, byl));
      ctx.quadraticCurveTo(tx(cxl, cyl), ty(cxl, cyl), tx(exl, eyl), ty(exl, eyl));
      ctx.stroke();
      for (let j = 0; j < 4; j++) {
        const u = 0.38 + j * 0.2;
        const qx = (1 - u) * (1 - u) * bxl + 2 * (1 - u) * u * cxl + u * u * exl;
        const qy = (1 - u) * (1 - u) * byl + 2 * (1 - u) * u * cyl + u * u * eyl;
        const side = j % 2 === 0 ? 1 : -1;
        const px = -dyl * side;
        const py = dxl * side;
        const wob = 0.25 * Math.sin(p.t * 3.2 + j + k * 2);
        const lx = qx + px * 3.6 + dxl * 1.5;
        const ly = qy + py * 3.6 + dyl * 1.5;
        const ang = Math.atan2(py + dyl * 0.9, px + dxl * 0.9) + ha + wob;
        ctx.beginPath();
        ctx.ellipse(tx(lx, ly), ty(lx, ly), 5 + grow / 2, 2.8 + grow / 2, ang, 0, TAU);
        ctx.fill();
      }
      ctx.beginPath();
      ctx.arc(tx(exl, eyl), ty(exl, eyl), 3.4 + grow / 2, 0, TAU);
      ctx.fill();
      if (pass === 1 && !far) {
        ctx.fillStyle = m.gillTip;
        ctx.beginPath();
        ctx.arc(tx(exl, eyl) - 0.8, ty(exl, eyl) - 0.8, 1.6, 0, TAU);
        ctx.fill();
      }
    }
  }
}

function drawEye(ctx: CanvasRenderingContext2D, m: Morph, p: Pose, x: number, y: number, r: number, mirror: boolean) {
  ctx.strokeStyle = m.eye;
  ctx.fillStyle = m.eye;
  ctx.lineWidth = 2.2;
  if (p.face === "squint") {
    const d = mirror ? -1 : 1;
    ctx.beginPath();
    ctx.moveTo(x - r * 0.7 * d, y - r * 0.6);
    ctx.lineTo(x + r * 0.5 * d, y);
    ctx.lineTo(x - r * 0.7 * d, y + r * 0.6);
    ctx.stroke();
    return;
  }
  if (p.face === "happy") {
    ctx.beginPath();
    ctx.arc(x, y + r * 0.35, r * 0.75, Math.PI * 1.1, Math.PI * 1.9);
    ctx.stroke();
    return;
  }
  if (p.face === "ouch") {
    const q = r * 0.6;
    ctx.beginPath();
    ctx.moveTo(x - q, y - q);
    ctx.lineTo(x + q, y + q);
    ctx.moveTo(x + q, y - q);
    ctx.lineTo(x - q, y + q);
    ctx.stroke();
    return;
  }
  const sy = p.blink > 0 ? 0.12 : 1;
  ctx.beginPath();
  ctx.ellipse(x, y, r * 0.92, r * sy, 0, 0, TAU);
  ctx.fill();
  if (sy === 1) {
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(x - r * 0.3, y - r * 0.38, r * 0.36, 0, TAU);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(x + r * 0.32, y + r * 0.32, r * 0.16, 0, TAU);
    ctx.fill();
  }
}

function drawHead(ctx: CanvasRenderingContext2D, m: Morph, p: Pose, hx: number, hy: number, ha: number) {
  ctx.save();
  ctx.translate(hx, hy);
  ctx.rotate(ha);
  ctx.fillStyle = m.outline;
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX + 1.6, HEAD_RY + 1.6, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.body;
  ctx.beginPath();
  ctx.ellipse(0, 0, HEAD_RX, HEAD_RY, 0, 0, TAU);
  ctx.fill();
  ctx.save();
  ctx.clip();
  ctx.fillStyle = m.belly;
  ctx.globalAlpha = 0.85;
  ctx.beginPath();
  ctx.ellipse(4, HEAD_RY * 0.75, HEAD_RX * 0.85, HEAD_RY * 0.5, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = m.shade;
  ctx.globalAlpha = 0.35;
  ctx.beginPath();
  ctx.ellipse(-HEAD_RX * 0.55, 0, HEAD_RX * 0.6, HEAD_RY * 1.2, 0, 0, TAU);
  ctx.fill();
  ctx.fillStyle = "#ffffff";
  ctx.globalAlpha = 0.45;
  ctx.beginPath();
  ctx.ellipse(-2, -HEAD_RY * 0.62, HEAD_RX * 0.5, HEAD_RY * 0.2, -0.1, 0, TAU);
  ctx.fill();
  if (p.flush > 0.02) {
    ctx.globalAlpha = p.flush * 0.45;
    ctx.fillStyle = "#ff3050";
    ctx.fillRect(-HEAD_RX, -HEAD_RY, HEAD_RX * 2, HEAD_RY * 2);
  }
  ctx.globalAlpha = 1;
  ctx.fillStyle = m.blush;
  ctx.globalAlpha = 0.55;
  ctx.beginPath();
  ctx.ellipse(5, 9, 5.5, 3.2, 0, 0, TAU);
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(24, 8, 3, 2.6, 0, 0, TAU);
  ctx.fill();
  ctx.globalAlpha = 1;
  drawEye(ctx, m, p, 21, -3, 4.6, true);
  ctx.restore();
  drawEye(ctx, m, p, 8, -2, 6.4, false);
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 1.8;
  ctx.lineCap = "round";
  ctx.beginPath();
  if (p.face === "ouch") {
    ctx.ellipse(17, 12, 3, 2.4, 0, 0, TAU);
  } else {
    ctx.moveTo(10, 10.5);
    ctx.quadraticCurveTo(13.5, 14, 17, 10.5);
    ctx.quadraticCurveTo(20.5, 14, 24, 10.5);
  }
  ctx.stroke();
  ctx.restore();
}

function drawAxolotl(ctx: CanvasRenderingContext2D, m: Morph, p: Pose) {
  buildSpine(p);
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const end = spineAt(1);
  const endA = Math.atan2(end.ty, end.tx);
  const ha = endA + p.curl * 0.35;
  const hx = end.x + Math.cos(endA) * HEAD_OFF;
  const hy = end.y + Math.sin(endA) * HEAD_OFF;

  drawGills(ctx, m, p, hx, hy, ha, true);
  drawLeg(ctx, m, p, true, true);
  drawLeg(ctx, m, p, false, true);

  finPath(ctx, p.t);
  ctx.fillStyle = m.fin;
  ctx.fill();
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 2.2;
  ctx.stroke();

  bodyPath(ctx);
  ctx.strokeStyle = m.outline;
  ctx.lineWidth = 3.2;
  ctx.stroke();
  ctx.fillStyle = m.body;
  ctx.fill();
  ctx.save();
  ctx.clip();
  const offLine = (v: number, s0: number, s1: number) => {
    ctx.beginPath();
    for (let s = s0; s <= s1 + 1e-6; s += 0.025) {
      const P = spineAt(s);
      const h = v > 0 ? v * topH(s) : v * botH(s);
      const x = P.x + P.nx * h;
      const y = P.y + P.ny * h;
      if (s === s0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
  };
  ctx.globalAlpha = 0.9;
  ctx.strokeStyle = m.belly;
  ctx.lineWidth = 6;
  offLine(-0.75, 0.2, 1);
  ctx.stroke();
  ctx.globalAlpha = 0.3;
  ctx.strokeStyle = m.shade;
  ctx.lineWidth = 5;
  offLine(1, 0, 1);
  ctx.stroke();
  ctx.globalAlpha = 0.55;
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = 1.8;
  offLine(0.45, 0.35, 0.95);
  ctx.stroke();
  ctx.globalAlpha = 1;
  ctx.fillStyle = m.spots;
  for (const [s, v, r] of SPOT_DOTS) {
    const P = spineAt(s);
    const h = v * topH(s);
    ctx.beginPath();
    ctx.arc(P.x + P.nx * h, P.y + P.ny * h, r, 0, TAU);
    ctx.fill();
  }
  if (p.flush > 0.02) {
    ctx.globalAlpha = p.flush * 0.4;
    ctx.fillStyle = "#ff3050";
    ctx.fillRect(-300, -300, 600, 600);
    ctx.globalAlpha = 1;
  }
  ctx.restore();

  drawLeg(ctx, m, p, false, false);
  drawLeg(ctx, m, p, true, false);
  drawGills(ctx, m, p, hx, hy, ha, false);
  drawHead(ctx, m, p, hx, hy, ha);
}

// ---------- audio ----------

function makeAudio() {
  let ac: AudioContext | null = null;
  let noise: AudioBuffer | null = null;
  let master: GainNode | null = null;
  let wind: GainNode | null = null;
  return {
    unlock() {
      if (!ac) {
        const AC = window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
        if (!AC) return;
        ac = new AC();
        noise = ac.createBuffer(1, ac.sampleRate * 2, ac.sampleRate);
        const d = noise.getChannelData(0);
        for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        master = ac.createGain();
        master.connect(ac.destination);
        const src = ac.createBufferSource();
        src.buffer = noise;
        src.loop = true;
        const bp = ac.createBiquadFilter();
        bp.type = "bandpass";
        bp.frequency.value = 700;
        bp.Q.value = 0.8;
        wind = ac.createGain();
        wind.gain.value = 0;
        src.connect(bp).connect(wind).connect(master);
        src.start();
      }
      if (ac.state === "suspended") void ac.resume();
    },
    setMuted(m: boolean) {
      if (master && ac) master.gain.setTargetAtTime(m ? 0 : 1, ac.currentTime, 0.05);
    },
    setWind(v: number) {
      if (wind && ac) wind.gain.setTargetAtTime(v, ac.currentTime, 0.06);
    },
    splash(power: number) {
      if (!ac || !noise || !master) return;
      const now = ac.currentTime;
      const src = ac.createBufferSource();
      src.buffer = noise;
      const f = ac.createBiquadFilter();
      f.type = "lowpass";
      f.frequency.setValueAtTime(900 + power * 3200, now);
      f.frequency.exponentialRampToValueAtTime(220, now + 0.3 + power * 0.9);
      const g = ac.createGain();
      g.gain.setValueAtTime(0.0001, now);
      g.gain.exponentialRampToValueAtTime(0.2 + power * 0.6, now + 0.015);
      g.gain.exponentialRampToValueAtTime(0.0001, now + 0.35 + power * 1.0);
      src.connect(f).connect(g).connect(master);
      src.start(now);
      src.stop(now + 1.6);
      if (power < 0.3) {
        const o = ac.createOscillator();
        const og = ac.createGain();
        o.type = "sine";
        o.frequency.setValueAtTime(760, now);
        o.frequency.exponentialRampToValueAtTime(190, now + 0.18);
        og.gain.setValueAtTime(0.0001, now);
        og.gain.exponentialRampToValueAtTime(0.2, now + 0.01);
        og.gain.exponentialRampToValueAtTime(0.0001, now + 0.22);
        o.connect(og).connect(master);
        o.start(now);
        o.stop(now + 0.25);
      }
    },
  };
}

type Audio = ReturnType<typeof makeAudio>;

// ---------- game state ----------

type Phase = "idle" | "air" | "under" | "results";

interface Particle {
  kind: "drop" | "mist" | "bubble" | "steam";
  x: number;
  y: number;
  vx: number;
  vy: number;
  r: number;
  life: number;
  max: number;
}

interface DiveResult {
  name: string;
  grade: string;
  pts: number;
}

interface GameState {
  phase: Phase;
  t: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  curl: number;
  rotAbs: number;
  frontAbs: number;
  backAbs: number;
  holdFront: boolean;
  holdBack: boolean;
  lastDir: number;
  camX: number;
  camY: number;
  zoom: number;
  shake: number;
  fade: number;
  fadeDir: number;
  dive: number;
  total: number;
  streak: number;
  results: DiveResult[];
  best: number;
  newBest: boolean;
  msg: { title: string; sub: string; pts: number; color: string; t0: number } | null;
  face: Face;
  underT: number;
  flush: number;
  resultsAt: number;
  nextBlink: number;
  particles: Particle[];
  ripples: { x: number; t0: number; amp: number }[];
}

const bestKey = (spot: Spot) => `axoflips_best_${spot.id}`;

function loadBest(spot: Spot) {
  try {
    const v = Number(localStorage.getItem(bestKey(spot)));
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  } catch {
    return 0;
  }
}

function camTarget(S: GameState) {
  let z = 44;
  let syDes = H * 0.5;
  let lead = 1.2;
  if (S.phase === "air") {
    z = lerp(50, 30, clamp((S.y - 4) / 24, 0, 1));
    syDes = H * 0.34;
    lead = 1.6;
  } else if (S.phase === "under") {
    z = 48;
    syDes = H * 0.42;
    lead = 0.8;
  }
  let camY = S.y - (H * 0.4 - syDes) / z;
  if (S.phase !== "idle" && S.phase !== "results") camY = Math.max(camY, -2.5);
  return { x: S.x + lead, y: camY, z };
}

function resetDive(S: GameState, spot: Spot) {
  S.phase = "idle";
  S.x = -0.9;
  S.y = spot.height + STAND_LIFT;
  S.vx = 0;
  S.vy = 0;
  S.angle = 0;
  S.omega = 0;
  S.curl = 0;
  S.rotAbs = 0;
  S.frontAbs = 0;
  S.backAbs = 0;
  S.underT = 0;
  S.flush = 0;
  S.face = "normal";
  S.particles = [];
  S.ripples = [];
  const tg = camTarget(S);
  S.camX = tg.x;
  S.camY = tg.y;
  S.zoom = tg.z;
}

function newState(spot: Spot): GameState {
  const S: GameState = {
    phase: "idle",
    t: 0,
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    angle: 0,
    omega: 0,
    curl: 0,
    rotAbs: 0,
    frontAbs: 0,
    backAbs: 0,
    holdFront: false,
    holdBack: false,
    lastDir: 1,
    camX: 0,
    camY: 0,
    zoom: 44,
    shake: 0,
    fade: 0,
    fadeDir: 0,
    dive: 0,
    total: 0,
    streak: 0,
    results: [],
    best: loadBest(spot),
    newBest: false,
    msg: null,
    face: "normal",
    underT: 0,
    flush: 0,
    resultsAt: 0,
    nextBlink: 2,
    particles: [],
    ripples: [],
  };
  resetDive(S, spot);
  return S;
}

function waveAt(S: GameState, x: number) {
  const t = S.t;
  let y = 0.07 * Math.sin(1.1 * x - 1.6 * t) + 0.045 * Math.sin(2.7 * x + 2.2 * t + 1.3) + 0.018 * Math.sin(5.3 * x - 3.1 * t);
  for (const r of S.ripples) {
    const tau = t - r.t0;
    const q = Math.abs(x - r.x) - 2.6 * tau;
    y += r.amp * Math.exp(-tau * 0.9) * Math.exp(-(q * q) / 1.2) * Math.cos(q * 5);
  }
  return y;
}

function quarterText(rotAbs: number) {
  const q = Math.round(rotAbs / (Math.PI / 2));
  const whole = Math.floor(q / 4);
  const frac = q % 4;
  return { q, whole, frac, text: (whole > 0 || frac === 0 ? String(whole) : "") + ["", "¼", "½", "¾"][frac] };
}

function flipName(S: GameState) {
  const { q, whole, frac, text } = quarterText(S.rotAbs);
  if (q === 0) return "No flip";
  const dir = S.frontAbs >= S.backAbs ? "Front" : "Back";
  if (frac === 0) {
    const names = ["", "", "Double ", "Triple ", "Quad ", "Quintuple "];
    if (whole === 1) return `${dir} Flip`;
    return whole < names.length ? `${names[whole]}${dir} Flip` : `${whole}x ${dir} Flip`;
  }
  return `${text} ${dir} Flips`;
}

function splash(S: GameState, power: number) {
  const n = Math.round(30 + power * 220);
  for (let i = 0; i < n; i++) {
    S.particles.push({
      kind: "drop",
      x: S.x + (Math.random() - 0.5) * (0.3 + power * 1.4),
      y: 0.05,
      vx: (Math.random() - 0.5) * (1 + power * 6) + S.vx * 0.15,
      vy: (0.3 + Math.random()) * (2.5 + power * 8),
      r: 0.025 + Math.random() * 0.05 * (0.5 + power),
      life: 0,
      max: 0.8 + Math.random() * 0.9,
    });
  }
  const mists = Math.round(2 + power * 14);
  for (let i = 0; i < mists; i++) {
    S.particles.push({
      kind: "mist",
      x: S.x + (Math.random() - 0.5) * power * 3,
      y: 0.2 + Math.random() * 0.4,
      vx: (Math.random() - 0.5) * 0.6,
      vy: 0.4 + Math.random() * 0.5,
      r: 0.3 + power * 0.8,
      life: 0,
      max: 1.1 + Math.random(),
    });
  }
  S.ripples.push({ x: S.x, t0: S.t, amp: 0.12 + power * 0.35 });
}

function enterWater(S: GameState, spot: Spot, audio: Audio) {
  const a = ((S.angle % Math.PI) + Math.PI) % Math.PI;
  const dev = Math.abs(a - Math.PI / 2);
  let g = dev < 0.27 ? 3 : dev < 0.52 ? 2 : dev < 0.88 ? 1 : 0;
  let note = "";
  const opened = S.curl < 0.5 && Math.abs(S.omega) < 5;
  if (g > 0 && !opened) {
    g--;
    note = "Didn't open up";
  }
  const headDown = Math.sin(S.angle) > 0;
  if (g === 3) note = headDown ? "Rip entry" : "Tail-first entry";
  S.streak = g >= 2 ? S.streak + 1 : g === 0 ? 0 : S.streak;
  const streakMult = g >= 2 ? 1 + 0.25 * Math.min(S.streak - 1, 4) : 1;
  const rotPts = Math.round((S.rotAbs / TAU) * 100);
  const pts = Math.round((rotPts + [0, 10, 25, 50][g]) * [0, 1, 1.5, 2][g] * spot.mult * streakMult);
  const name = flipName(S);
  const title = g === 0 ? (Math.cos(S.angle) > 0 ? "BELLY FLOP!" : "BACK SMACK!") : ["", "OK", "GREAT!", "PERFECT!"][g];
  const color = ["#ff6b6b", "#ffd166", "#7ee0a0", "#7fd8ff"][g];
  const subParts = [name, note];
  if (g >= 2 && S.streak > 1) subParts.push(`Streak x${streakMult.toFixed(2)}`);
  S.msg = { title, sub: subParts.filter(Boolean).join(" · "), pts, color, t0: S.t };
  S.results.push({ name, grade: title, pts });
  S.total += pts;
  S.dive++;
  const power = [1, 0.55, 0.32, 0.14][g];
  splash(S, power);
  audio.splash(power);
  S.phase = "under";
  S.underT = 0;
  S.face = g === 0 ? "ouch" : g >= 2 ? "happy" : "normal";
  if (g === 0) {
    S.shake = 1;
    S.flush = 1;
    S.vy *= 0.15;
    S.vx *= 0.4;
    S.omega = 0;
  }
}

function step(S: GameState, dt: number, spot: Spot, audio: Audio) {
  S.t += dt;

  if (S.fadeDir !== 0) {
    S.fade += S.fadeDir * dt * 3.2;
    if (S.fade >= 1) {
      S.fade = 1;
      S.fadeDir = -1;
      resetDive(S, spot);
      if (S.dive >= DIVES) {
        S.phase = "results";
        S.resultsAt = S.t;
        S.newBest = S.total > S.best;
        if (S.newBest) {
          S.best = S.total;
          try {
            localStorage.setItem(bestKey(spot), String(S.total));
          } catch {
            // storage unavailable; best just won't persist
          }
        }
      }
    } else if (S.fade <= 0) {
      S.fade = 0;
      S.fadeDir = 0;
    }
  }

  if (S.t > S.nextBlink) {
    S.nextBlink = S.t + 2 + Math.random() * 3;
  }

  const hold = S.holdFront || S.holdBack;
  if (S.phase === "air") {
    const dir = S.holdBack && (!S.holdFront || S.lastDir < 0) ? -1 : 1;
    S.curl += ((hold ? 1 : 0) - S.curl) * (1 - Math.exp(-dt * (hold ? 9 : 12)));
    const wMax = 5.5 + 7.5 * S.curl;
    const target = hold ? dir * wMax : Math.sign(S.omega) * Math.min(Math.abs(S.omega), 0.8);
    S.omega += (target - S.omega) * (1 - Math.exp(-dt * (hold ? 6 : 11)));
    const dA = S.omega * dt;
    S.angle += dA;
    S.rotAbs += Math.abs(dA);
    if (dA > 0) S.frontAbs += dA;
    else S.backAbs -= dA;
    S.vy -= GRAVITY * dt;
    S.x += S.vx * dt;
    S.y += S.vy * dt;
    S.face = hold ? "squint" : "normal";
    const sinA = Math.sin(S.angle);
    const headD = 73 * (1 - 0.2 * S.curl) * UNIT;
    const tailD = -128 * (1 - 0.45 * S.curl) * UNIT;
    const low = S.y - Math.max(headD * sinA, tailD * sinA) - 14 * UNIT * Math.abs(Math.cos(S.angle));
    if (low <= waveAt(S, S.x)) enterWater(S, spot, audio);
  } else if (S.phase === "under") {
    S.underT += dt;
    S.vx *= Math.exp(-dt * 2.2);
    S.vy = S.vy * Math.exp(-dt * 2.8) + 3.2 * dt;
    S.x += S.vx * dt;
    S.y = Math.min(S.y + S.vy * dt, -0.05);
    S.omega *= Math.exp(-dt * 5);
    S.angle += S.omega * dt;
    S.curl *= Math.exp(-dt * 6);
    if (S.underT > 0.5) {
      const d = ((-S.angle + Math.PI) % TAU + TAU) % TAU - Math.PI;
      S.angle += d * (1 - Math.exp(-dt * 2));
    }
    if (S.underT < 1.0 && Math.random() < dt * 40) {
      S.particles.push({
        kind: "bubble",
        x: S.x + (Math.random() - 0.5) * 0.8,
        y: S.y + (Math.random() - 0.5) * 0.6,
        vx: 0,
        vy: 0.5,
        r: 0.03 + Math.random() * 0.07,
        life: 0,
        max: 3,
      });
    }
    if (S.underT > 1.7 && S.fadeDir === 0 && S.fade === 0) S.fadeDir = 1;
  }

  if (spot.ambient === "volcano" && Math.random() < dt * 3) {
    S.particles.push({
      kind: "steam",
      x: S.camX + (Math.random() - 0.3) * 30,
      y: 0.1,
      vx: 0.3,
      vy: 0.5,
      r: 0.4 + Math.random() * 0.6,
      life: 0,
      max: 3 + Math.random() * 2,
    });
  }

  const tg = camTarget(S);
  const kc = 1 - Math.exp(-dt * (S.phase === "air" ? 7 : 4));
  S.camX += (tg.x - S.camX) * kc;
  S.camY += (tg.y - S.camY) * kc;
  S.zoom += (tg.z - S.zoom) * (1 - Math.exp(-dt * 2.5));
  S.shake *= Math.exp(-dt * 5);
  S.flush *= Math.exp(-dt * 0.8);

  for (const p of S.particles) {
    p.life += dt;
    if (p.kind === "drop") {
      p.vy -= GRAVITY * dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      if (p.y < 0 && p.vy < 0) p.life = p.max;
    } else if (p.kind === "mist") {
      p.r += dt * 0.8;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    } else if (p.kind === "bubble") {
      p.vy += (1.6 - p.vy) * dt * 2;
      p.x += Math.sin(p.life * 9 + p.r * 100) * dt * 0.4;
      p.y += p.vy * dt;
      if (p.y >= waveAt(S, p.x)) p.life = p.max;
    } else {
      p.r += dt * 0.35;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
    }
  }
  S.particles = S.particles.filter((p) => p.life < p.max);
  S.ripples = S.ripples.filter((r) => S.t - r.t0 < 5);

  const speed = Math.hypot(S.vx, S.vy);
  audio.setWind(S.phase === "air" ? clamp(Math.abs(S.omega) / 13, 0, 1) * 0.06 + clamp(speed / 30, 0, 1) * 0.05 : 0);
}

// ---------- rendering ----------

function draw(ctx: CanvasRenderingContext2D, S: GameState, spot: Spot, scene: Scene, morph: Morph, dpr: number, hud = true) {
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  const t = S.t;
  const Z = S.zoom;
  const shX = S.shake * 10 * Math.sin(t * 61);
  const shY = S.shake * 8 * Math.cos(t * 53);
  const sx = (wx: number) => W * 0.42 + (wx - S.camX) * Z + shX;
  const sy = (wy: number) => H * 0.4 - (wy - S.camY) * Z + shY;
  const waterY = sy(0);
  const horizon = Math.min(H * 0.46, waterY);
  const worldL = S.camX - (W * 0.42 + 20) / Z;
  const worldR = S.camX + (W * 0.58 + 20) / Z;

  // sky
  const sky = ctx.createLinearGradient(0, 0, 0, horizon);
  sky.addColorStop(0, spot.sky[0]);
  sky.addColorStop(0.55, spot.sky[1]);
  sky.addColorStop(1, spot.sky[2]);
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, W, H);

  const sunX = spot.sun.x * W;
  const sunY = Math.min(spot.sun.y * H, horizon - 20);
  const glow = ctx.createRadialGradient(sunX, sunY, 0, sunX, sunY, 260);
  glow.addColorStop(0, `rgba(${spot.sun.glow},0.9)`);
  glow.addColorStop(0.08, `rgba(${spot.sun.glow},0.55)`);
  glow.addColorStop(1, `rgba(${spot.sun.glow},0)`);
  ctx.fillStyle = glow;
  ctx.fillRect(0, 0, W, H);
  ctx.fillStyle = `rgba(${spot.sun.glow},1)`;
  ctx.beginPath();
  ctx.arc(sunX, sunY, 16, 0, TAU);
  ctx.fill();

  // clouds
  for (const c of scene.clouds) {
    const cx = ((c.x - S.camX * Z * 0.03 + t * 5) % (W * 2 + 400) + (W * 2 + 400)) % (W * 2 + 400) - 200;
    for (const p of c.puffs) {
      const g = ctx.createRadialGradient(cx + p.dx, c.y + p.dy, 0, cx + p.dx, c.y + p.dy, p.r);
      g.addColorStop(0, `rgba(${spot.cloud},0.7)`);
      g.addColorStop(1, `rgba(${spot.cloud},0)`);
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(cx + p.dx, c.y + p.dy, p.r, 0, TAU);
      ctx.fill();
    }
  }

  if (spot.ambient === "birds") {
    ctx.strokeStyle = "rgba(40,30,30,0.6)";
    ctx.lineWidth = 1.6;
    for (let k = 0; k < 3; k++) {
      const bx = ((t * 18 + k * 320) % (W + 200)) - 100;
      const by = 90 + k * 28 + Math.sin(t + k) * 10;
      const f = Math.sin(t * 6 + k) * 4;
      ctx.beginPath();
      ctx.moveTo(bx - 8, by - f);
      ctx.quadraticCurveTo(bx - 3, by - 3, bx, by);
      ctx.quadraticCurveTo(bx + 3, by - 3, bx + 8, by - f);
      ctx.stroke();
    }
  }

  // mountain ranges
  const sunSide = spot.sun.x > 0.5 ? 1 : -1;
  spot.ranges.forEach((r, i) => {
    const seed = spot.seed * 7 + i * 101;
    const off = S.camX * Z * r.p;
    const hAt = (x: number) => {
      const bx = (x + off) * r.freq;
      let n = fbm(bx, seed);
      if (r.mesa) {
        const m = clamp((n - 0.42) / 0.1, 0, 1);
        n = 0.25 + m * m * (3 - 2 * m) * 0.7 + fbm(bx * 6, seed + 3) * 0.08;
      }
      return r.amp * (0.3 + 0.75 * n);
    };
    const path = new Path2D();
    path.moveTo(-10, horizon + 1);
    const hs: number[] = [];
    for (let x = -10; x <= W + 10; x += 5) {
      const h = hAt(x);
      hs.push(h);
      path.lineTo(x, horizon - h);
    }
    path.lineTo(W + 10, horizon + 1);
    path.closePath();
    ctx.fillStyle = r.color;
    ctx.fill(path);
    ctx.save();
    ctx.clip(path);
    for (let k = 1; k < hs.length - 1; k++) {
      const x = -10 + k * 5;
      const slope = clamp((hs[k + 1] - hs[k - 1]) / 10, -1, 1) * sunSide;
      ctx.fillStyle = slope > 0 ? `rgba(0,0,0,${slope * 0.16})` : `rgba(255,255,255,${-slope * 0.1})`;
      ctx.fillRect(x - 2.5, horizon - hs[k], 5, hs[k]);
    }
    if (r.snow) {
      ctx.beginPath();
      ctx.moveTo(-10, -10);
      for (let x = -10; x <= W + 10; x += 6) {
        ctx.lineTo(x, horizon - r.amp * (0.62 + fbm((x + off) * 0.03, seed + 9) * 0.3));
      }
      ctx.lineTo(W + 10, -10);
      ctx.closePath();
      ctx.fillStyle = "rgba(248,251,253,0.9)";
      ctx.fill();
    }
    const hz = ctx.createLinearGradient(0, horizon - r.amp, 0, horizon);
    hz.addColorStop(0, `rgba(${spot.haze},0)`);
    hz.addColorStop(1, `rgba(${spot.haze},${0.55 - i * 0.15})`);
    ctx.fillStyle = hz;
    ctx.fillRect(0, horizon - r.amp * 1.2, W, r.amp * 1.2);
    ctx.restore();

    if (i === 1 && spot.ambient === "waterfall") {
      const x0 = W * 0.78 - off * 0.5;
      const top = horizon - hAt(x0) + 6;
      const wg = ctx.createLinearGradient(x0 - 11, 0, x0 + 11, 0);
      wg.addColorStop(0, "rgba(220,240,250,0.3)");
      wg.addColorStop(0.5, "rgba(245,252,255,0.9)");
      wg.addColorStop(1, "rgba(220,240,250,0.3)");
      ctx.fillStyle = wg;
      ctx.fillRect(x0 - 11, top, 22, horizon - top);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.2;
      const span = Math.max(1, horizon - top);
      for (let k = 0; k < 14; k++) {
        const yy = top + ((t * 120 + k * 37) % span);
        const xx = x0 - 9 + ((k * 7) % 18);
        ctx.beginPath();
        ctx.moveTo(xx, yy);
        ctx.lineTo(xx, Math.min(horizon, yy + 10));
        ctx.stroke();
      }
      const mg = ctx.createRadialGradient(x0, horizon, 0, x0, horizon, 40);
      mg.addColorStop(0, "rgba(255,255,255,0.7)");
      mg.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = mg;
      ctx.fillRect(x0 - 40, horizon - 40, 80, 50);
    }
    if (i === 1 && spot.ambient === "volcano") {
      const x0 = W * 0.74 - off;
      const peak = horizon - 185;
      ctx.fillStyle = r.color;
      ctx.beginPath();
      ctx.moveTo(x0 - 220, horizon + 1);
      ctx.quadraticCurveTo(x0 - 60, peak + 40, x0 - 22, peak);
      ctx.lineTo(x0 + 22, peak);
      ctx.quadraticCurveTo(x0 + 60, peak + 40, x0 + 220, horizon + 1);
      ctx.closePath();
      ctx.fill();
      const lg = ctx.createRadialGradient(x0, peak, 0, x0, peak, 70);
      lg.addColorStop(0, "rgba(255,150,60,0.85)");
      lg.addColorStop(1, "rgba(255,120,40,0)");
      ctx.fillStyle = lg;
      ctx.fillRect(x0 - 70, peak - 70, 140, 140);
      ctx.strokeStyle = `rgba(255,120,40,${0.55 + 0.25 * Math.sin(t * 2)})`;
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(x0 - 6, peak + 2);
      ctx.quadraticCurveTo(x0 - 20, peak + 60, x0 - 52, peak + 120);
      ctx.stroke();
      for (let k = 0; k < 16; k++) {
        const age = (t * 0.07 + k / 16) % 1;
        const px = x0 + age * 130 + Math.sin(age * 6 + k) * 12;
        const py = peak - age * 230;
        const pr = 12 + age * 60;
        const g = ctx.createRadialGradient(px, py, 0, px, py, pr);
        g.addColorStop(0, `rgba(70,55,65,${0.55 * (1 - age)})`);
        g.addColorStop(1, "rgba(70,55,65,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, TAU);
        ctx.fill();
      }
    }
  });

  // sea plane receding to horizon
  if (waterY > horizon + 1) {
    const sg = ctx.createLinearGradient(0, horizon, 0, waterY);
    sg.addColorStop(0, spot.sea.far);
    sg.addColorStop(1, spot.sea.near);
    ctx.fillStyle = sg;
    ctx.fillRect(0, horizon, W, waterY - horizon + 2);
    const rows = 36;
    for (let r = 0; r < rows; r++) {
      const f = r / rows;
      const y = horizon + (waterY - horizon) * Math.pow(f, 1.8);
      if (y > H) break;
      const scale = 0.2 + 0.8 * f;
      ctx.strokeStyle = `rgba(255,255,255,${0.1 + 0.12 * scale})`;
      ctx.lineWidth = 0.6 + scale;
      for (let k = 0; k < 6; k++) {
        const span = W + 120;
        const x = ((hash1(r * 7 + k, spot.seed) * span * 1.3 + t * 12 * scale + S.camX * Z * scale * 0.4) % span) - 60;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x + 10 + 30 * scale, y);
        ctx.stroke();
      }
      const gl = 0.5 + 0.5 * Math.sin(t * 3 + r * 1.7);
      ctx.strokeStyle = `rgba(${spot.glint},${0.55 * gl})`;
      const gx = sunX + (hash1(r, spot.seed + 5) - 0.5) * 60 * scale;
      ctx.beginPath();
      ctx.moveTo(gx - 8 * scale - 4, y);
      ctx.lineTo(gx + 8 * scale + 4, y);
      ctx.stroke();
    }
    if (spot.ambient === "snow") {
      for (const b of scene.bergs) {
        const y = horizon + (waterY - horizon) * b.f;
        if (y > H) continue;
        const sc = 0.4 + b.f * 2;
        const x = ((b.x - S.camX * Z * 0.05) % (W + 200)) - 100;
        ctx.fillStyle = "#f4f8fb";
        ctx.beginPath();
        ctx.moveTo(x - b.w * sc * 0.5, y);
        ctx.lineTo(x - b.w * sc * 0.25, y - b.h * sc);
        ctx.lineTo(x + b.w * sc * 0.05, y - b.h * sc * 1.3);
        ctx.lineTo(x + b.w * sc * 0.35, y - b.h * sc * 0.7);
        ctx.lineTo(x + b.w * sc * 0.5, y);
        ctx.closePath();
        ctx.fill();
        ctx.fillStyle = "rgba(120,160,190,0.35)";
        ctx.beginPath();
        ctx.moveTo(x + b.w * sc * 0.05, y - b.h * sc * 1.3);
        ctx.lineTo(x + b.w * sc * 0.35, y - b.h * sc * 0.7);
        ctx.lineTo(x + b.w * sc * 0.5, y);
        ctx.lineTo(x + b.w * sc * 0.1, y);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // cliff
  const cliff = new Path2D();
  cliff.moveTo(sx(-80), sy(spot.height));
  cliff.lineTo(sx(0), sy(spot.height));
  for (let k = 0; k < scene.face.length; k++) {
    cliff.lineTo(sx(scene.face[k]), sy(spot.height - k * FACE_STEP));
  }
  cliff.lineTo(sx(-80), sy(FACE_BOTTOM));
  cliff.closePath();
  const rg = ctx.createLinearGradient(sx(-12), 0, sx(0.2), 0);
  rg.addColorStop(0, spot.rock.dark);
  rg.addColorStop(0.7, spot.rock.base);
  rg.addColorStop(1, spot.rock.light);
  ctx.fillStyle = rg;
  ctx.fill(cliff);
  ctx.save();
  ctx.clip(cliff);
  const xs0 = Math.max(-30, worldL);
  for (const b of scene.strata) {
    if (sy(b.y) < -20 || sy(b.y + b.h) > H + 20) continue;
    ctx.beginPath();
    let first = true;
    for (let x = xs0; x <= 1; x += 1.5) {
      const yy = b.y + x * 0.02 + (fbm(x * 0.4, spot.seed + b.y) - 0.5) * 0.3;
      if (first) {
        ctx.moveTo(sx(x), sy(yy));
        first = false;
      } else ctx.lineTo(sx(x), sy(yy));
    }
    ctx.lineTo(sx(1), sy(b.y + b.h));
    ctx.lineTo(sx(xs0), sy(b.y + b.h));
    ctx.closePath();
    ctx.fillStyle = b.tone > 0 ? `rgba(255,240,220,${b.tone * 0.1})` : `rgba(0,0,0,${-b.tone * 0.14})`;
    ctx.fill();
    ctx.strokeStyle = "rgba(0,0,0,0.22)";
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }
  ctx.fillStyle = spot.rock.dark;
  for (const sp of scene.specks) {
    const px = sx(faceXAt(scene, sp.y) + sp.dx);
    const py = sy(sp.y);
    if (px < -4 || px > W + 4 || py < -4 || py > H + 4) continue;
    ctx.globalAlpha = sp.light ? 0.28 : 0.35;
    ctx.fillStyle = sp.light ? spot.rock.light : spot.rock.dark;
    ctx.fillRect(px, py, sp.s, sp.s);
  }
  ctx.globalAlpha = 1;
  for (const c of scene.cracks) {
    ctx.beginPath();
    c.forEach((q, k) => {
      const px = sx(faceXAt(scene, q.y) + q.dx);
      const py = sy(q.y);
      if (k === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 1.4;
    ctx.stroke();
    ctx.translate(1.2, 0);
    ctx.strokeStyle = `rgba(255,255,255,0.12)`;
    ctx.lineWidth = 1;
    ctx.stroke();
    ctx.translate(-1.2, 0);
  }
  for (const pa of scene.patches) {
    const px = sx(faceXAt(scene, pa.y) + pa.dx);
    const py = sy(pa.y);
    if (py < -30 || py > H + 30) continue;
    ctx.fillStyle = "rgba(78,120,52,0.55)";
    ctx.beginPath();
    ctx.ellipse(px, py, pa.r * Z, pa.r * Z * 0.6, 0.3, 0, TAU);
    ctx.fill();
  }
  const wet = ctx.createLinearGradient(0, sy(1), 0, sy(-1));
  wet.addColorStop(0, "rgba(0,0,0,0)");
  wet.addColorStop(1, "rgba(0,0,0,0.35)");
  ctx.fillStyle = wet;
  ctx.fillRect(0, sy(1), W, Math.max(0, sy(FACE_BOTTOM) - sy(1)));
  ctx.restore();
  ctx.beginPath();
  for (let k = 0; k < scene.face.length; k++) {
    const px = sx(scene.face[k]);
    const py = sy(spot.height - k * FACE_STEP);
    if (k === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.strokeStyle = `rgba(255,255,255,0.22)`;
  ctx.lineWidth = 1.5;
  ctx.stroke();

  // cliff top
  const topY = sy(spot.height);
  if (topY > -40 && topY < H + 40) {
    if (spot.cap === "moss" || spot.cap === "scrub") {
      const soil = spot.cap === "moss" ? "#3b2f22" : "#6b4a2e";
      ctx.fillStyle = soil;
      ctx.fillRect(sx(-80), topY - 1, sx(0) - sx(-80), 0.12 * Z + 1);
      for (const b of scene.bushes) {
        if (b.x < worldL - 2 || b.x > worldR) continue;
        const bx = sx(b.x);
        const r = b.r * Z;
        const base = spot.cap === "moss" ? [48, 92, 42] : [110, 108, 60];
        for (let k = 0; k < 4; k++) {
          const ox = (k - 1.5) * r * 0.55;
          const oy = -r * (0.6 + 0.35 * Math.sin(k * 2.1));
          const l = 0.8 + b.tone * 0.3 + k * 0.05;
          ctx.fillStyle = `rgb(${base[0] * l},${base[1] * l},${base[2] * l})`;
          ctx.beginPath();
          ctx.arc(bx + ox, topY + oy, r * 0.62, 0, TAU);
          ctx.fill();
        }
      }
      ctx.lineCap = "round";
      for (const tf of scene.tufts) {
        if (tf.x < worldL || tf.x > worldR) continue;
        const bx = sx(tf.x);
        for (let k = 0; k < tf.n; k++) {
          const sway = Math.sin(t * 1.6 + tf.x * 2 + k) * 0.04;
          const lean = tf.lean + (k - tf.n / 2) * 0.07 + sway;
          const len = tf.len * (0.7 + ((k * 37) % 10) / 20);
          const g = spot.cap === "moss" ? [60 + tf.tone * 50, 120 + tf.tone * 50, 40] : [150 + tf.tone * 40, 140 + tf.tone * 30, 70];
          ctx.strokeStyle = `rgb(${g[0]},${g[1]},${g[2]})`;
          ctx.lineWidth = 1.4;
          ctx.beginPath();
          ctx.moveTo(bx + k * 1.2, topY);
          ctx.quadraticCurveTo(bx + k * 1.2 + lean * Z * 0.4, topY - len * Z * 0.6, bx + k * 1.2 + lean * Z, topY - len * Z);
          ctx.stroke();
        }
      }
    } else if (spot.cap === "ash") {
      ctx.fillStyle = "#231d20";
      ctx.fillRect(sx(-80), topY - 2, sx(0) - sx(-80), 0.15 * Z + 2);
      ctx.strokeStyle = `rgba(255,110,40,${0.5 + 0.3 * Math.sin(t * 2.3)})`;
      ctx.lineWidth = 1.6;
      for (let k = 0; k < 12; k++) {
        const x = -1.5 - k * 2.3 - hash1(k, 3) * 1.2;
        if (x < worldL || x > worldR) continue;
        ctx.beginPath();
        ctx.moveTo(sx(x), topY + 2);
        ctx.lineTo(sx(x + 0.3), topY + 6);
        ctx.lineTo(sx(x + 0.15), topY + 11);
        ctx.stroke();
      }
    } else {
      const sg = ctx.createLinearGradient(0, topY - 0.3 * Z, 0, topY + 0.2 * Z);
      sg.addColorStop(0, "#ffffff");
      sg.addColorStop(1, "#cfe0ee");
      ctx.fillStyle = sg;
      ctx.beginPath();
      ctx.moveTo(sx(-80), topY + 0.2 * Z);
      for (let x = Math.max(-80, worldL - 1); x <= 0.15; x += 0.5) {
        ctx.lineTo(sx(x), topY - (0.12 + fbm(x * 0.8, 7) * 0.12) * Z);
      }
      ctx.lineTo(sx(0.15), topY + 0.2 * Z);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = "rgba(220,238,250,0.9)";
      for (let k = 0; k < 6; k++) {
        const x = -0.05 - k * 0.22;
        const len = (0.2 + hash1(k, 9) * 0.35) * Z;
        ctx.beginPath();
        ctx.moveTo(sx(x) - 3, topY + 0.15 * Z);
        ctx.lineTo(sx(x) + 3, topY + 0.15 * Z);
        ctx.lineTo(sx(x), topY + 0.15 * Z + len);
        ctx.closePath();
        ctx.fill();
      }
    }
  }

  // axolotl
  const ax = sx(S.x);
  const ay = sy(S.y);
  const k = (AXO_LEN * Z) / 200;
  const standW = S.phase === "idle" || S.phase === "results" ? 1 : 0;
  const speed = Math.hypot(S.vx, S.vy);
  const pose: Pose = {
    t,
    curl: S.curl,
    wig: S.phase === "under" ? 0.3 : S.phase === "air" ? 0.18 : 0.08,
    stand: standW,
    flow: S.phase === "air" ? clamp(speed / 20, 0, 1) : 0,
    flush: S.flush,
    face: S.face,
    blink: S.nextBlink - S.t < 0.14 ? 1 : 0,
  };
  if (standW) {
    ctx.fillStyle = "rgba(0,0,0,0.22)";
    ctx.beginPath();
    ctx.ellipse(ax, topY + 1, 60 * k, 5 * k, 0, 0, TAU);
    ctx.fill();
  }
  if (S.phase === "air" && Math.abs(S.omega) > 6) {
    for (let g = 2; g >= 1; g--) {
      ctx.save();
      ctx.globalAlpha = 0.12 * (3 - g);
      ctx.translate(ax, ay);
      ctx.rotate(S.angle - S.omega * 0.014 * g);
      ctx.scale(k, k);
      drawAxolotl(ctx, morph, pose);
      ctx.restore();
    }
  }
  ctx.save();
  ctx.translate(ax, ay);
  ctx.rotate(S.angle);
  ctx.scale(k, k);
  drawAxolotl(ctx, morph, pose);
  ctx.restore();

  // water cutaway
  const surf = new Path2D();
  const surfPts: number[] = [];
  for (let x = -10; x <= W + 10; x += 8) {
    const wx = S.camX + (x - W * 0.42 - shX) / Z;
    const y = sy(waveAt(S, wx));
    surfPts.push(x, y);
    if (x === -10) surf.moveTo(x, y);
    else surf.lineTo(x, y);
  }
  if (waterY - 30 < H) {
    const water = new Path2D(surf);
    water.lineTo(W + 10, H + 10);
    water.lineTo(-10, H + 10);
    water.closePath();
    const wg = ctx.createLinearGradient(0, waterY, 0, waterY + 8 * Z);
    wg.addColorStop(0, `rgba(${spot.cut.top},0.55)`);
    wg.addColorStop(1, `rgba(${spot.cut.deep},0.94)`);
    ctx.fillStyle = wg;
    ctx.fill(water);
    ctx.save();
    ctx.clip(water);
    for (let r = 0; r < 6; r++) {
      const x0 = ((r * 190 + t * 14) % (W + 300)) - 150;
      const rayG = ctx.createLinearGradient(0, waterY, 0, waterY + 6 * Z);
      rayG.addColorStop(0, "rgba(255,255,255,0.1)");
      rayG.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = rayG;
      ctx.beginPath();
      ctx.moveTo(x0, waterY);
      ctx.lineTo(x0 + 40, waterY);
      ctx.lineTo(x0 + 130, waterY + 6 * Z);
      ctx.lineTo(x0 + 60, waterY + 6 * Z);
      ctx.closePath();
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = "rgba(255,255,255,0.6)";
    ctx.lineWidth = 1.6;
    ctx.stroke(surf);
    ctx.save();
    ctx.translate(0, 3);
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 2.5;
    ctx.stroke(surf);
    ctx.restore();
  }

  // particles
  for (const p of S.particles) {
    const px = sx(p.x);
    const py = sy(p.y);
    if (px < -80 || px > W + 80 || py < -80 || py > H + 80) continue;
    const a = 1 - p.life / p.max;
    if (p.kind === "drop") {
      ctx.strokeStyle = `rgba(235,248,255,${0.85 * a})`;
      ctx.lineWidth = Math.max(1.2, p.r * Z * 2);
      ctx.lineCap = "round";
      ctx.beginPath();
      ctx.moveTo(px, py);
      ctx.lineTo(px - p.vx * Z * 0.02, py + p.vy * Z * 0.02);
      ctx.stroke();
    } else if (p.kind === "bubble") {
      ctx.strokeStyle = `rgba(230,250,255,${0.7 * Math.min(1, a * 3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      ctx.arc(px, py, Math.max(1.5, p.r * Z), 0, TAU);
      ctx.stroke();
    } else {
      const rr = p.r * Z;
      const g = ctx.createRadialGradient(px, py, 0, px, py, rr);
      const alpha = (p.kind === "mist" ? 0.35 : 0.16) * a;
      g.addColorStop(0, `rgba(255,255,255,${alpha})`);
      g.addColorStop(1, "rgba(255,255,255,0)");
      ctx.fillStyle = g;
      ctx.beginPath();
      ctx.arc(px, py, rr, 0, TAU);
      ctx.fill();
    }
  }
  for (const r of S.ripples) {
    const tau = t - r.t0;
    const rad = 2.6 * tau * Z;
    const a = Math.exp(-tau * 0.9) * 0.6;
    ctx.strokeStyle = `rgba(255,255,255,${a})`;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.ellipse(sx(r.x), waterY, rad, Math.max(1, rad * 0.08), 0, 0, TAU);
    ctx.stroke();
  }

  if (spot.ambient === "snow") {
    ctx.fillStyle = "rgba(255,255,255,0.85)";
    for (const f of scene.flakes) {
      const x = (((f.x + t * 10 * f.v + Math.sin(t + f.y) * 10 - S.camX * Z * 0.3 * f.v) % W) + W) % W;
      const y = (((f.y + t * 35 * f.v + S.camY * Z * 0.6 * f.v) % H) + H) % H;
      ctx.beginPath();
      ctx.arc(x, y, f.r, 0, TAU);
      ctx.fill();
    }
  }

  if (hud) drawHud(ctx, S, spot);

  if (S.fade > 0) {
    ctx.fillStyle = `rgba(8,14,24,${S.fade})`;
    ctx.fillRect(0, 0, W, H);
  }
}

function text(ctx: CanvasRenderingContext2D, s: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = "left") {
  ctx.font = font;
  ctx.textAlign = align;
  ctx.textBaseline = "alphabetic";
  ctx.fillStyle = "rgba(0,0,0,0.45)";
  ctx.fillText(s, x + 1.5, y + 2);
  ctx.fillStyle = color;
  ctx.fillText(s, x, y);
}

function drawHud(ctx: CanvasRenderingContext2D, S: GameState, spot: Spot) {
  const t = S.t;
  ctx.fillStyle = "rgba(10,20,30,0.42)";
  roundRect(ctx, 14, 14, 220, 76, 12);
  ctx.fill();
  text(ctx, spot.name, 28, 38, "700 16px system-ui, sans-serif", "#ffffff");
  text(ctx, `Dive ${Math.min(S.dive + 1, DIVES)} / ${DIVES}   ×${spot.mult} height`, 28, 59, "500 13px system-ui, sans-serif", "#d8e6f0");
  text(ctx, `Score ${S.total}`, 28, 80, "700 15px system-ui, sans-serif", "#ffe08a");
  text(ctx, `Best ${S.best}`, W - 20, 36, "700 16px system-ui, sans-serif", "#ffffff", "right");

  if (S.phase === "air" || S.phase === "idle") {
    const bx = W - 32;
    const top = 70;
    const bot = H - 60;
    ctx.fillStyle = "rgba(10,20,30,0.4)";
    roundRect(ctx, bx - 6, top - 6, 12, bot - top + 12, 6);
    ctx.fill();
    const frac = clamp(S.y / (spot.height + 1), 0, 1);
    const my = bot - frac * (bot - top);
    const g = ctx.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, "#7ee0a0");
    g.addColorStop(0.8, "#ffd166");
    g.addColorStop(1, "#ff6b6b");
    ctx.fillStyle = g;
    roundRect(ctx, bx - 3, my, 6, bot - my, 3);
    ctx.fill();
    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(bx, my, 6, 0, TAU);
    ctx.fill();
    text(ctx, `${Math.max(0, S.y).toFixed(0)}m`, bx - 12, my + 5, "700 13px system-ui, sans-serif", "#ffffff", "right");
  }

  if (S.phase === "air" && S.rotAbs > 0.3) {
    const q = quarterText(S.rotAbs);
    text(ctx, q.text, W / 2, 70, "800 44px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, "FLIPS", W / 2, 92, "700 13px system-ui, sans-serif", "#d8e6f0", "center");
  }

  if (S.phase === "idle" && S.fade === 0) {
    const a = 0.65 + 0.35 * Math.sin(t * 3);
    ctx.globalAlpha = a;
    text(ctx, "Hold to flip · Release to straighten · Hit the water head- or tail-first", W / 2, H - 46, "700 17px system-ui, sans-serif", "#ffffff", "center");
    ctx.globalAlpha = 1;
    text(ctx, "Space / click / tap = front flip     ← / A / right-click = back flip", W / 2, H - 22, "500 13px system-ui, sans-serif", "#e8f0f6", "center");
  }

  if (S.msg && S.t - S.msg.t0 < 2.4) {
    const age = S.t - S.msg.t0;
    const a = clamp(Math.min(age * 6, (2.4 - age) * 3), 0, 1);
    const pop = 1 + 0.25 * Math.exp(-age * 10);
    ctx.globalAlpha = a;
    ctx.save();
    ctx.translate(W / 2, H * 0.26);
    ctx.scale(pop, pop);
    text(ctx, S.msg.title, 0, 0, "900 52px system-ui, sans-serif", S.msg.color, "center");
    ctx.restore();
    text(ctx, S.msg.sub, W / 2, H * 0.26 + 34, "600 17px system-ui, sans-serif", "#ffffff", "center");
    text(ctx, `+${S.msg.pts}`, W / 2, H * 0.26 + 66, "800 26px system-ui, sans-serif", "#ffe08a", "center");
    ctx.globalAlpha = 1;
  }

  if (S.phase === "results") {
    ctx.fillStyle = "rgba(8,14,24,0.55)";
    ctx.fillRect(0, 0, W, H);
    const pw = 440;
    const ph = 320;
    const px = (W - pw) / 2;
    const py = (H - ph) / 2;
    ctx.fillStyle = "rgba(18,30,44,0.92)";
    roundRect(ctx, px, py, pw, ph, 18);
    ctx.fill();
    text(ctx, "Session complete!", W / 2, py + 44, "800 26px system-ui, sans-serif", "#ffffff", "center");
    S.results.forEach((r, i) => {
      const y = py + 84 + i * 30;
      text(ctx, `${i + 1}. ${r.name}`, px + 28, y, "600 15px system-ui, sans-serif", "#d8e6f0");
      text(ctx, r.grade, px + pw - 110, y, "700 14px system-ui, sans-serif", "#ffffff", "right");
      text(ctx, String(r.pts), px + pw - 28, y, "700 15px system-ui, sans-serif", "#ffe08a", "right");
    });
    text(ctx, `Total ${S.total}`, W / 2, py + ph - 62, "800 24px system-ui, sans-serif", "#ffe08a", "center");
    if (S.newBest) text(ctx, "New best!", W / 2, py + ph - 38, "800 15px system-ui, sans-serif", "#7ee0a0", "center");
    if (S.t - S.resultsAt > 0.8) {
      ctx.globalAlpha = 0.65 + 0.35 * Math.sin(t * 3);
      text(ctx, "Click or press Space to dive again", W / 2, py + ph - 14, "600 14px system-ui, sans-serif", "#ffffff", "center");
      ctx.globalAlpha = 1;
    }
  }
}

// ---------- component ----------

const THUMB_W = 150;
const THUMB_H = 84;

function SpotThumb({ spot, morph }: { spot: Spot; morph: Morph }) {
  const ref = useRef<HTMLCanvasElement | null>(null);
  useEffect(() => {
    const c = ref.current;
    const ctx = c?.getContext("2d");
    if (!c || !ctx) return;
    const dpr = Math.max(1, Math.min(2, window.devicePixelRatio || 1));
    c.width = THUMB_W * dpr;
    c.height = THUMB_H * dpr;
    const S = newState(spot);
    S.t = 1.3;
    S.zoom = 46;
    S.camX = -1.2;
    S.camY = spot.height + 1.6;
    draw(ctx, S, spot, buildScene(spot), morph, (THUMB_W / W) * dpr, false);
  }, [spot, morph]);
  return <canvas ref={ref} style={{ width: THUMB_W, height: THUMB_H, display: "block", borderRadius: 8 }} />;
}

export default function AxolotlFlips({ onBack }: { onBack: () => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [spotId, setSpotId] = useState(SPOTS[0].id);
  const [morphId, setMorphId] = useState(MORPHS[0].id);
  const [muted, setMuted] = useState(false);
  const spotRef = useRef<Spot>(SPOTS[0]);
  const morphRef = useRef<Morph>(MORPHS[0]);
  const stateRef = useRef<GameState>(newState(SPOTS[0]));
  const scenesRef = useRef(new Map<string, Scene>());
  const audioRef = useRef<Audio>(makeAudio());

  useEffect(() => {
    const spot = SPOTS.find((s) => s.id === spotId) ?? SPOTS[0];
    spotRef.current = spot;
    stateRef.current = newState(spot);
  }, [spotId]);

  useEffect(() => {
    morphRef.current = MORPHS.find((m) => m.id === morphId) ?? MORPHS[0];
  }, [morphId]);

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

    const press = (dir: number) => {
      const S = stateRef.current;
      audio.unlock();
      if (dir > 0) S.holdFront = true;
      else S.holdBack = true;
      S.lastDir = dir;
      if (S.phase === "idle" && S.fade === 0) {
        S.phase = "air";
        S.vx = 3.4;
        S.vy = 6.0;
      } else if (S.phase === "results" && S.t - S.resultsAt > 0.8) {
        stateRef.current = newState(spotRef.current);
      }
    };
    const release = (dir: number) => {
      const S = stateRef.current;
      if (dir > 0) S.holdFront = false;
      else S.holdBack = false;
    };
    const releaseAll = () => {
      stateRef.current.holdFront = false;
      stateRef.current.holdBack = false;
    };

    const pointerDirs = new Map<number, number>();
    const onPointerDown = (e: PointerEvent) => {
      e.preventDefault();
      const dir = e.button === 2 ? -1 : 1;
      pointerDirs.set(e.pointerId, dir);
      press(dir);
    };
    const onPointerUp = (e: PointerEvent) => {
      const dir = pointerDirs.get(e.pointerId);
      if (dir === undefined) return;
      pointerDirs.delete(e.pointerId);
      release(dir);
    };
    const onContext = (e: Event) => e.preventDefault();
    const keyDir = (k: string) => {
      if (k === " " || k === "arrowright" || k === "d" || k === "arrowup" || k === "w") return 1;
      if (k === "arrowleft" || k === "a") return -1;
      return 0;
    };
    const onKeyDown = (e: KeyboardEvent) => {
      const k = e.key.toLowerCase();
      if (k === "r") {
        stateRef.current = newState(spotRef.current);
        return;
      }
      const dir = keyDir(k);
      if (!dir) return;
      e.preventDefault();
      if (!e.repeat) press(dir);
    };
    const onKeyUp = (e: KeyboardEvent) => {
      const dir = keyDir(e.key.toLowerCase());
      if (dir) release(dir);
    };

    cvs.addEventListener("pointerdown", onPointerDown);
    cvs.addEventListener("contextmenu", onContext);
    window.addEventListener("pointerup", onPointerUp);
    window.addEventListener("pointercancel", onPointerUp);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keyup", onKeyUp);
    window.addEventListener("blur", releaseAll);

    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const frame = (now: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
      last = now;
      const spot = spotRef.current;
      let scene = scenesRef.current.get(spot.id);
      if (!scene) {
        scene = buildScene(spot);
        scenesRef.current.set(spot.id, scene);
      }
      acc += dt;
      while (acc >= STEP) {
        step(stateRef.current, STEP, spot, audio);
        acc -= STEP;
      }
      draw(ctx, stateRef.current, spot, scene, morphRef.current, dpr);
    };
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      cvs.removeEventListener("pointerdown", onPointerDown);
      cvs.removeEventListener("contextmenu", onContext);
      window.removeEventListener("pointerup", onPointerUp);
      window.removeEventListener("pointercancel", onPointerUp);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keyup", onKeyUp);
      window.removeEventListener("blur", releaseAll);
      audio.setWind(0);
    };
  }, []);

  const pill = (active: boolean) =>
    `px-3 py-1.5 rounded-2xl text-sm shadow ${active ? "bg-pink-500 text-white" : "bg-slate-700 hover:bg-slate-600 text-slate-100"}`;

  return (
    <div className="min-h-screen w-full bg-slate-900 text-slate-100 flex flex-col items-center p-4 gap-3">
      <div className="w-full max-w-[960px] flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">Axolotl Flips</h1>
        <div className="flex gap-2">
          <button onClick={() => setMuted((m) => !m)} className={pill(false)}>
            {muted ? "Sound off" : "Sound on"}
          </button>
          <button onClick={onBack} className="px-3 py-1.5 rounded-2xl bg-gray-500 hover:bg-gray-600 text-white shadow">
            Back to Home
          </button>
        </div>
      </div>
      <div style={{ width: "100%", maxWidth: 960, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8 }}>
        {SPOTS.map((s) => (
          <button
            key={s.id}
            onClick={() => setSpotId(s.id)}
            title={s.name}
            style={{
              padding: 4,
              borderRadius: 12,
              border: `3px solid ${s.id === spotId ? "#ff5fa2" : "transparent"}`,
              background: "#1e293b",
              color: "#f1f5f9",
              cursor: "pointer",
            }}
          >
            <SpotThumb spot={s} morph={MORPHS.find((m) => m.id === morphId) ?? MORPHS[0]} />
            <div style={{ fontSize: 12, fontWeight: 600, marginTop: 4 }}>
              {s.name} · {s.height}m
            </div>
          </button>
        ))}
        <span style={{ marginLeft: "auto", fontSize: 14 }}>Axolotl:</span>
        {MORPHS.map((m) => (
          <button
            key={m.id}
            onClick={() => setMorphId(m.id)}
            title={m.name}
            style={{
              width: 26,
              height: 26,
              borderRadius: 13,
              background: m.body,
              border: `3px solid ${m.id === morphId ? "#ff5fa2" : m.outline}`,
              cursor: "pointer",
            }}
          />
        ))}
      </div>
      <div className="w-full max-w-[960px] rounded-2xl overflow-hidden shadow-lg ring-1 ring-slate-700/60">
        <canvas ref={canvasRef} style={{ width: "100%", height: "auto", display: "block", touchAction: "none" }} />
      </div>
      <p className="text-sm text-slate-300 max-w-[960px]">
        Hold to tuck and spin, let go to stretch out. Enter the water pointing straight up or down for a clean entry. Flat
        landings are belly flops and score nothing. Higher cliffs give more air time and more points. Press R to restart.
      </p>
    </div>
  );
}
