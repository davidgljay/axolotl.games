import { useState, useEffect, useRef, useCallback } from 'react';

interface DiscoGameProps {
  onBack: () => void;
}

const ROWS = [
  { id: 'kick',    name: 'Kick',     color: '#ff4455', glow: 'rgba(255,68,85,0.7)' },
  { id: 'snare',   name: 'Snare',    color: '#ff8800', glow: 'rgba(255,136,0,0.7)' },
  { id: 'hihat',   name: 'Hi-Hat',   color: '#ffee00', glow: 'rgba(255,238,0,0.7)' },
  { id: 'openhat', name: 'Open Hat', color: '#44ff88', glow: 'rgba(68,255,136,0.7)' },
  { id: 'clap',    name: 'Clap',     color: '#44aaff', glow: 'rgba(68,170,255,0.7)' },
  { id: 'bass',    name: 'Bass',     color: '#cc44ff', glow: 'rgba(204,68,255,0.7)' },
];

const STEPS = 16;
type Grid = boolean[][];

interface Skin {
  id: string;
  name: string;
  price: number;
  image: string;
  filter: string;
  rainbow?: boolean;
}

const SKINS: Skin[] = [
  { id: 'classic',     name: 'Classic',       price: 0,   image: '/img/axolotl_painter_dancer.png',    filter: 'none' },
  { id: 'sapphire',    name: 'Sapphire',      price: 40,  image: '/img/axolotl_painter_dancer.png',    filter: 'hue-rotate(180deg)' },
  { id: 'emerald',     name: 'Emerald',       price: 60,  image: '/img/axolotl_painter_dancer.png',    filter: 'hue-rotate(120deg)' },
  { id: 'sunset',      name: 'Sunset',        price: 60,  image: '/img/axolotl_painter_dancer.png',    filter: 'hue-rotate(-40deg) saturate(1.5)' },
  { id: 'lavender',    name: 'Lavender',      price: 80,  image: '/img/axolotl_painter_dancer.png',    filter: 'hue-rotate(220deg)' },
  { id: 'artist',      name: 'The Artist',    price: 100, image: '/img/axolotl_painter_artist.png',    filter: 'none' },
  { id: 'nature',      name: 'Nature Lover',  price: 100, image: '/img/axolotl_painter_nature.png',    filter: 'none' },
  { id: 'golden',      name: 'Golden',        price: 150, image: '/img/axolotl_painter_dancer.png',    filter: 'sepia(0.6) saturate(3) hue-rotate(5deg)' },
  { id: 'birdwatcher', name: 'Birdwatcher',   price: 175, image: '/img/axolotl_painter_birdwatcher.png', filter: 'none' },
  { id: 'cosmic',      name: 'Cosmic',        price: 250, image: '/img/axolotl_painter_dancer.png',    filter: 'invert(0.85) hue-rotate(180deg) saturate(2)' },
  { id: 'rainbow',     name: 'Rainbow',       price: 350, image: '/img/axolotl_painter_dancer.png',    filter: 'none', rainbow: true },
];

function initGrid(): Grid {
  return ROWS.map(() => Array(STEPS).fill(false));
}

const DISCO_PRESET: Grid = [
  [true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false],
  [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
  [false, false, true,  false, false, false, true,  false, false, false, true,  false, false, false, true,  false],
  [false, false, false, false, false, false, false, false, false, false, false, false, false, false, false, false],
  [false, false, false, false, true,  false, false, false, false, false, false, false, true,  false, false, false],
  [true,  false, false, true,  false, false, true,  false, true,  false, false, true,  false, false, false, true ],
];

function scoreSong(grid: Grid): number {
  const totalBeats = grid.flat().filter(Boolean).length;
  if (totalBeats < 3) return 0;
  let score = 0;
  const activeInstruments = grid.filter(row => row.some(Boolean)).length;
  score += Math.min(activeInstruments, 4);
  if (grid[0][0]) score += 1;
  if (grid[0][8]) score += 1;
  if (grid[1][4]) score += 1;
  if (grid[1][12]) score += 1;
  const hihatBeats = grid[2].filter(Boolean).length;
  if (hihatBeats >= 4) score += 1;
  if (hihatBeats >= 8) score += 1;
  if (totalBeats >= 8) score += 1;
  return score;
}

function numDancers(score: number): number {
  if (score < 2) return 0;
  if (score < 4) return 1;
  if (score < 5) return 2;
  if (score < 6) return 3;
  if (score < 7) return 4;
  if (score < 9) return 5;
  return 6;
}

function getDanceMessage(score: number): string {
  if (score < 2) return 'Add more beats to get the axolotls dancing!';
  if (score < 4) return 'Getting groovy! Keep building the beat!';
  if (score < 6) return 'Nice groove! The axolotls are feeling it!';
  if (score < 8) return "That's a banger! Axolotls are going wild!";
  return 'DISCO FEVER! Maximum axolotl energy!';
}

function calcCoins(score: number, secondsPlayed: number): number {
  if (score < 1) return 0;
  const base = score * 10;
  const timeBonus = Math.floor(Math.min(secondsPlayed, 120) / 10) * score;
  return Math.min(base + timeBonus, 250);
}

function loadCoins(): number { return Number(localStorage.getItem('axd_coins') || '0'); }
function loadUnlocked(): string[] {
  try { return JSON.parse(localStorage.getItem('axd_unlocked') || '["classic"]'); }
  catch { return ['classic']; }
}
function loadActiveSkin(): string { return localStorage.getItem('axd_skin') || 'classic'; }

function createNoise(ctx: AudioContext, duration: number) {
  const bufferSize = Math.floor(ctx.sampleRate * duration);
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
  const source = ctx.createBufferSource();
  source.buffer = buffer;
  return source;
}

function playKick(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(150, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  gain.gain.setValueAtTime(1, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.5);
}

function playSnare(ctx: AudioContext) {
  const src = createNoise(ctx, 0.15);
  const filter = ctx.createBiquadFilter();
  filter.type = 'bandpass'; filter.frequency.value = 3000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.7, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.15);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + 0.15);
}

function playHihat(ctx: AudioContext, open = false) {
  const duration = open ? 0.3 : 0.06;
  const src = createNoise(ctx, duration);
  const filter = ctx.createBiquadFilter();
  filter.type = 'highpass'; filter.frequency.value = 7000;
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + duration);
  src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
  src.start(); src.stop(ctx.currentTime + duration);
}

function playClap(ctx: AudioContext) {
  for (let i = 0; i < 3; i++) {
    const delay = i * 0.012;
    const src = createNoise(ctx, 0.08);
    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass'; filter.frequency.value = 1200;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.5, ctx.currentTime + delay);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + delay + 0.08);
    src.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
    src.start(ctx.currentTime + delay); src.stop(ctx.currentTime + delay + 0.08);
  }
}

function playBass(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = 'sawtooth';
  osc.connect(gain); gain.connect(ctx.destination);
  osc.frequency.setValueAtTime(80, ctx.currentTime);
  gain.gain.setValueAtTime(0.4, ctx.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
  osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.3);
}

// Per-dancer hue offsets so the crowd looks colorful
const DANCER_HUE_OFFSETS = [0, 60, 150, 220, 280, 330];

export default function AxolotlDiscoGame({ onBack }: DiscoGameProps) {
  const [grid, setGrid] = useState<Grid>(initGrid);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentStep, setCurrentStep] = useState(-1);
  const [bpm, setBpm] = useState(120);
  const [tab, setTab] = useState<'play' | 'shop'>('play');

  const [coins, setCoins] = useState<number>(loadCoins);
  const [unlocked, setUnlocked] = useState<string[]>(loadUnlocked);
  const [activeSkinId, setActiveSkinId] = useState<string>(loadActiveSkin);
  const [reward, setReward] = useState<{ coins: number; score: number } | null>(null);

  const gridRef = useRef(grid);
  const scoreRef = useRef(0);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const stepRef = useRef(0);
  const playStartRef = useRef<number | null>(null);

  useEffect(() => { gridRef.current = grid; }, [grid]);

  const score = scoreSong(grid);
  useEffect(() => { scoreRef.current = score; }, [score]);

  const dancers = numDancers(score);
  const animDuration = (60000 / bpm) * 2;
  const activeSkin = SKINS.find(s => s.id === activeSkinId) ?? SKINS[0];

  const getCtx = useCallback(() => {
    if (!audioCtxRef.current) audioCtxRef.current = new AudioContext();
    if (audioCtxRef.current.state === 'suspended') audioCtxRef.current.resume();
    return audioCtxRef.current;
  }, []);

  const fireStep = useCallback((step: number) => {
    const g = gridRef.current;
    const ctx = getCtx();
    if (g[0][step]) playKick(ctx);
    if (g[1][step]) playSnare(ctx);
    if (g[2][step]) playHihat(ctx, false);
    if (g[3][step]) playHihat(ctx, true);
    if (g[4][step]) playClap(ctx);
    if (g[5][step]) playBass(ctx);
  }, [getCtx]);

  useEffect(() => {
    if (!isPlaying) {
      if (intervalRef.current) clearInterval(intervalRef.current);
      setCurrentStep(-1);
      stepRef.current = 0;
      return;
    }
    const stepMs = 60000 / (bpm * 4);
    stepRef.current = 0;
    intervalRef.current = setInterval(() => {
      const step = stepRef.current;
      setCurrentStep(step);
      fireStep(step);
      stepRef.current = (step + 1) % STEPS;
    }, stepMs);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isPlaying, bpm, fireStep]);

  const finishSession = useCallback((currentScore: number) => {
    if (playStartRef.current === null) return;
    const seconds = (Date.now() - playStartRef.current) / 1000;
    playStartRef.current = null;
    if (seconds < 3 || currentScore < 1) return;
    const earned = calcCoins(currentScore, seconds);
    if (earned <= 0) return;
    setCoins(prev => {
      const next = prev + earned;
      localStorage.setItem('axd_coins', String(next));
      return next;
    });
    setReward({ coins: earned, score: currentScore });
    setTimeout(() => setReward(null), 4000);
  }, []);

  const handlePlay = () => {
    if (isPlaying) {
      finishSession(scoreRef.current);
      setIsPlaying(false);
    } else {
      playStartRef.current = Date.now();
      setIsPlaying(true);
    }
  };

  const handleDone = () => {
    finishSession(scoreRef.current);
    setIsPlaying(false);
    setCurrentStep(-1);
    setTab('shop');
  };

  const clearGrid = () => {
    playStartRef.current = null;
    setIsPlaying(false);
    setCurrentStep(-1);
    setGrid(initGrid());
  };

  const toggleCell = (rowIdx: number, stepIdx: number) => {
    setGrid(prev => {
      const next = prev.map(row => [...row]);
      next[rowIdx][stepIdx] = !next[rowIdx][stepIdx];
      return next;
    });
  };

  const buySkin = (skin: Skin) => {
    if (unlocked.includes(skin.id) || coins < skin.price) return;
    const newCoins = coins - skin.price;
    const newUnlocked = [...unlocked, skin.id];
    setCoins(newCoins);
    setUnlocked(newUnlocked);
    setActiveSkinId(skin.id);
    localStorage.setItem('axd_coins', String(newCoins));
    localStorage.setItem('axd_unlocked', JSON.stringify(newUnlocked));
    localStorage.setItem('axd_skin', skin.id);
  };

  const equipSkin = (skinId: string) => {
    setActiveSkinId(skinId);
    localStorage.setItem('axd_skin', skinId);
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(180deg, #0d0620 0%, #1a0a2e 50%, #0d1a2e 100%)',
      color: 'white',
      fontFamily: 'Arial, sans-serif',
      padding: '1rem',
      boxSizing: 'border-box',
    }}>
      <style>{`
        @keyframes disco-bounce {
          0%, 100% { transform: translateY(0px) rotate(-6deg); }
          50%       { transform: translateY(-28px) rotate(6deg); }
        }
        @keyframes disco-ball-spin {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes cell-flash {
          0%   { filter: brightness(1.8); }
          100% { filter: brightness(1); }
        }
        @keyframes reward-popup {
          0%   { opacity: 0; transform: translateX(-50%) translateY(20px) scale(0.8); }
          15%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
          75%  { opacity: 1; transform: translateX(-50%) translateY(0px) scale(1); }
          100% { opacity: 0; transform: translateX(-50%) translateY(-20px) scale(0.9); }
        }
        @keyframes rainbow-hue {
          from { filter: hue-rotate(0deg); }
          to   { filter: hue-rotate(360deg); }
        }
        .dance-axolotl {
          animation: disco-bounce var(--dur) ease-in-out infinite;
          animation-delay: var(--delay);
        }
        .dance-axolotl.rainbow-skin {
          animation: disco-bounce var(--dur) ease-in-out infinite,
                     rainbow-hue 2s linear infinite;
          animation-delay: var(--delay), 0s;
        }
        .beat-cell:active { transform: scale(0.88) !important; }
        .beat-cell-lit { animation: cell-flash 0.12s ease-out forwards; }
        .skin-card { transition: transform 0.15s, box-shadow 0.15s; }
        .skin-card:hover { transform: translateY(-3px); }
        .tab-btn { transition: background 0.15s, color 0.15s; }
      `}</style>

      {/* Coin reward popup */}
      {reward && (
        <div style={{
          position: 'fixed', top: '90px', left: '50%',
          animation: 'reward-popup 4s ease forwards',
          background: 'linear-gradient(135deg, #1a0a2e, #2a1040)',
          border: '2px solid #ffee00',
          borderRadius: '16px', padding: '1.25rem 2rem',
          textAlign: 'center', zIndex: 999,
          boxShadow: '0 0 30px rgba(255,238,0,0.4)',
          minWidth: '220px',
        }}>
          <div style={{ fontSize: '2.5rem', marginBottom: '0.25rem' }}>🪙</div>
          <div style={{ fontSize: '1.8rem', fontWeight: 'bold', color: '#ffee00' }}>
            +{reward.coins} coins!
          </div>
          <div style={{ color: '#aaa', fontSize: '0.85rem', marginTop: '0.25rem' }}>
            Song score: {reward.score} / 11
          </div>
          <div style={{ color: '#cc44ff', fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Visit the Shop to spend them!
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '0.75rem' }}>
        <button
          onClick={onBack}
          style={{
            background: 'rgba(255,255,255,0.1)', border: '1px solid rgba(255,255,255,0.25)',
            color: 'white', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer', fontSize: '1rem',
          }}
        >
          ← Back
        </button>
        <h1 style={{
          margin: 0, fontSize: '1.8rem', textAlign: 'center',
          textShadow: '0 0 20px #cc44ff, 0 0 40px #ff44aa', letterSpacing: '2px',
        }}>
          Axolotl Disco
        </h1>
        <div style={{
          background: 'rgba(255,238,0,0.15)', border: '1px solid rgba(255,238,0,0.4)',
          borderRadius: '20px', padding: '0.4rem 1rem',
          fontWeight: 'bold', fontSize: '1rem', color: '#ffee00',
          display: 'flex', alignItems: 'center', gap: '0.4rem',
          textShadow: '0 0 8px rgba(255,238,0,0.5)',
        }}>
          🪙 {coins}
        </div>
      </div>

      {/* Disco ball */}
      <div style={{ textAlign: 'center', marginBottom: '0.5rem' }}>
        <svg width="60" height="78" viewBox="0 0 70 90"
          style={{ animation: 'disco-ball-spin 5s linear infinite', filter: 'drop-shadow(0 0 10px rgba(255,255,255,0.5))' }}>
          <line x1="35" y1="0" x2="35" y2="12" stroke="#aaa" strokeWidth="2" />
          <circle cx="35" cy="42" r="28" fill="#6b6b7a" />
          {[0,1,2,3,4,5,6,7].map(col =>
            [0,1,2,3,4,5].map(row => {
              const colors = ['#ff4455','#ff8800','#ffee00','#44ff88','#44aaff','#cc44ff'];
              const angle = (col / 8) * Math.PI * 2 + row * 0.2;
              const r = 22 - Math.abs(row - 2.5) * 3;
              const cx = 35 + Math.cos(angle) * r;
              const cy = 22 + row * 10 + Math.sin(angle) * 4;
              return (
                <rect key={`${col}-${row}`} x={cx-3} y={cy-3} width={6} height={6} rx={1}
                  fill={colors[(col+row) % colors.length]} opacity={0.85}
                  transform={`rotate(${col*45},${cx},${cy})`} />
              );
            })
          )}
        </svg>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
        {(['play', 'shop'] as const).map(t => (
          <button
            key={t}
            className="tab-btn"
            onClick={() => setTab(t)}
            style={{
              padding: '0.5rem 2rem', borderRadius: '20px', fontSize: '0.95rem',
              fontWeight: 'bold', cursor: 'pointer', border: 'none',
              background: tab === t ? '#cc44ff' : 'rgba(255,255,255,0.08)',
              color: tab === t ? 'white' : '#888',
              boxShadow: tab === t ? '0 0 14px rgba(204,68,255,0.5)' : 'none',
            }}
          >
            {t === 'play' ? '🎛 Play' : '🛍 Shop'}
          </button>
        ))}
      </div>

      {/* ── PLAY TAB ── */}
      {tab === 'play' && (
        <>
          {/* Status */}
          <div style={{
            textAlign: 'center', marginBottom: '0.75rem', fontSize: '0.95rem', minHeight: '1.4rem',
            color: score >= 8 ? '#ffee00' : score >= 5 ? '#44ff88' : score >= 2 ? '#44aaff' : '#555',
            transition: 'color 0.4s',
            fontWeight: score >= 8 ? 'bold' : 'normal',
            textShadow: score >= 8 ? '0 0 10px #ffee00' : 'none',
          }}>
            {isPlaying ? getDanceMessage(score) : 'Click cells to add beats, then press Play!'}
          </div>

          {/* Beat grid */}
          <div style={{ overflowX: 'auto', marginBottom: '1.25rem' }}>
            <div style={{ minWidth: '680px', maxWidth: '860px', margin: '0 auto' }}>
              {/* Beat numbers */}
              <div style={{ display: 'flex', marginBottom: '3px', paddingLeft: '76px', gap: '4px' }}>
                {Array.from({ length: STEPS }, (_, i) => (
                  <div key={i} style={{
                    flex: 1, textAlign: 'center', fontSize: '0.62rem',
                    color: i % 4 === 0 ? '#bbb' : '#444',
                    fontWeight: i % 4 === 0 ? 'bold' : 'normal',
                  }}>
                    {i % 4 === 0 ? i / 4 + 1 : '·'}
                  </div>
                ))}
              </div>

              {ROWS.map((row, rowIdx) => (
                <div key={row.id} style={{ display: 'flex', gap: '4px', alignItems: 'center', marginBottom: '4px' }}>
                  <div style={{
                    width: '72px', textAlign: 'right', paddingRight: '8px',
                    fontSize: '0.75rem', fontWeight: 'bold', color: row.color,
                    flexShrink: 0, textShadow: `0 0 8px ${row.glow}`,
                  }}>
                    {row.name}
                  </div>
                  {Array.from({ length: STEPS }, (_, stepIdx) => {
                    const active = grid[rowIdx][stepIdx];
                    const isCurrent = stepIdx === currentStep;
                    const isDownbeat = stepIdx % 4 === 0;
                    return (
                      <button
                        key={stepIdx}
                        className={`beat-cell${active && isCurrent ? ' beat-cell-lit' : ''}`}
                        onClick={() => toggleCell(rowIdx, stepIdx)}
                        style={{
                          flex: 1, height: '40px', border: 'none', borderRadius: '5px',
                          cursor: 'pointer',
                          transition: 'background 0.08s, box-shadow 0.08s',
                          background: active
                            ? row.color
                            : isCurrent
                              ? 'rgba(255,255,255,0.28)'
                              : isDownbeat
                                ? 'rgba(255,255,255,0.09)'
                                : 'rgba(255,255,255,0.04)',
                          boxShadow: active
                            ? `0 0 10px ${row.glow}, 0 0 22px ${row.glow}`
                            : isCurrent ? '0 0 8px rgba(255,255,255,0.4)' : 'none',
                          outline: isDownbeat && !active && !isCurrent
                            ? '1px solid rgba(255,255,255,0.11)' : 'none',
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          </div>

          {/* Controls */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            gap: '0.75rem', flexWrap: 'wrap', marginBottom: '1.25rem',
          }}>
            <button
              onClick={handlePlay}
              style={{
                background: isPlaying
                  ? 'linear-gradient(135deg, #cc0022, #ff4455)'
                  : 'linear-gradient(135deg, #00aa44, #44ff88)',
                border: 'none', color: isPlaying ? 'white' : '#001a0d',
                fontSize: '1.05rem', fontWeight: 'bold',
                padding: '0.65rem 1.75rem', borderRadius: '12px', cursor: 'pointer',
                boxShadow: isPlaying ? '0 0 18px rgba(255,68,85,0.5)' : '0 0 18px rgba(68,255,136,0.4)',
                minWidth: '100px',
              }}
            >
              {isPlaying ? '⏹ Stop' : '▶ Play'}
            </button>

            <button
              onClick={handleDone}
              style={{
                background: 'linear-gradient(135deg, #aa6600, #ffcc00)',
                border: 'none', color: '#1a0a00',
                fontSize: '1.05rem', fontWeight: 'bold',
                padding: '0.65rem 1.75rem', borderRadius: '12px', cursor: 'pointer',
                boxShadow: '0 0 16px rgba(255,200,0,0.4)',
              }}
            >
              ✓ Done
            </button>

            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <span style={{ fontSize: '0.8rem', color: '#888' }}>BPM</span>
              <input type="range" min={60} max={200} value={bpm}
                onChange={e => setBpm(Number(e.target.value))}
                style={{ accentColor: '#cc44ff', width: '100px', cursor: 'pointer' }} />
              <span style={{ fontWeight: 'bold', color: '#cc44ff', minWidth: '34px', fontSize: '0.95rem' }}>
                {bpm}
              </span>
            </div>

            <button
              onClick={() => setGrid(DISCO_PRESET.map(row => [...row]))}
              style={{
                background: 'rgba(204,68,255,0.15)', border: '1px solid rgba(204,68,255,0.4)',
                color: '#cc44ff', fontSize: '0.85rem',
                padding: '0.65rem 1rem', borderRadius: '12px', cursor: 'pointer',
              }}
            >
              Load Preset
            </button>

            <button
              onClick={clearGrid}
              style={{
                background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                color: '#777', fontSize: '0.85rem',
                padding: '0.65rem 1rem', borderRadius: '12px', cursor: 'pointer',
              }}
            >
              Clear
            </button>
          </div>

          {/* Dancers */}
          <div style={{
            display: 'flex', justifyContent: 'center', alignItems: 'flex-end',
            gap: '1.5rem', minHeight: '130px', flexWrap: 'wrap',
          }}>
            {dancers === 0 && isPlaying && (
              <div style={{ color: '#444', fontSize: '0.9rem', alignSelf: 'center' }}>
                Build a better beat to summon the dancers...
              </div>
            )}
            {Array.from({ length: dancers }, (_, i) => {
              const hue = DANCER_HUE_OFFSETS[i];
              const skinFilter = activeSkin.rainbow
                ? undefined
                : `${activeSkin.filter} hue-rotate(${hue}deg) drop-shadow(0 0 8px ${ROWS[i % ROWS.length].color})`;
              return (
                <div
                  key={i}
                  className="dance-axolotl"
                  style={{
                    '--dur': `${animDuration}ms`,
                    '--delay': `${(i / 6) * animDuration}ms`,
                  } as React.CSSProperties}
                >
                  <img
                    src={activeSkin.image}
                    alt="Dancing Axolotl"
                    className={activeSkin.rainbow ? 'rainbow-skin' : undefined}
                    style={{
                      height: '110px',
                      display: 'block',
                      transform: i % 2 === 1 ? 'scaleX(-1)' : undefined,
                      filter: skinFilter,
                    }}
                  />
                </div>
              );
            })}
          </div>

          {isPlaying && dancers < 6 && score >= 2 && (
            <div style={{ textAlign: 'center', marginTop: '0.6rem', color: '#444', fontSize: '0.78rem' }}>
              Tip: Kick on beats 1 & 3, snare on 2 & 4, and hi-hats for more dancers!
            </div>
          )}
          {!isPlaying && score > 0 && (
            <div style={{ textAlign: 'center', marginTop: '0.6rem', color: '#556', fontSize: '0.82rem' }}>
              Hit Done when you're happy with your beat to earn coins!
            </div>
          )}
        </>
      )}

      {/* ── SHOP TAB ── */}
      {tab === 'shop' && (
        <div style={{ maxWidth: '860px', margin: '0 auto' }}>
          <div style={{ textAlign: 'center', marginBottom: '1.25rem', color: '#aaa', fontSize: '0.9rem' }}>
            Play beats and press <strong style={{ color: '#ffcc00' }}>Done</strong> to earn coins.
            Spend them on new axolotl skins!
          </div>
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))',
            gap: '1rem',
          }}>
            {SKINS.map(skin => {
              const owned = unlocked.includes(skin.id);
              const equipped = activeSkinId === skin.id;
              const canAfford = coins >= skin.price;
              return (
                <div
                  key={skin.id}
                  className="skin-card"
                  style={{
                    background: equipped
                      ? 'linear-gradient(135deg, rgba(204,68,255,0.25), rgba(100,0,200,0.15))'
                      : 'rgba(255,255,255,0.04)',
                    border: `2px solid ${equipped ? '#cc44ff' : owned ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.07)'}`,
                    borderRadius: '14px', padding: '1rem 0.75rem',
                    textAlign: 'center',
                    opacity: !owned && !canAfford ? 0.55 : 1,
                    boxShadow: equipped ? '0 0 16px rgba(204,68,255,0.35)' : 'none',
                  }}
                >
                  <img
                    src={skin.image}
                    alt={skin.name}
                    className={skin.rainbow ? 'rainbow-skin' : undefined}
                    style={{
                      height: '80px',
                      display: 'block',
                      margin: '0 auto 0.6rem',
                      filter: skin.rainbow ? undefined : skin.filter,
                    }}
                  />
                  <div style={{ fontWeight: 'bold', fontSize: '0.82rem', marginBottom: '0.5rem', color: '#ddd' }}>
                    {skin.name}
                  </div>
                  {equipped && (
                    <div style={{
                      background: '#cc44ff', color: 'white', fontSize: '0.75rem',
                      borderRadius: '6px', padding: '0.3rem 0.6rem', fontWeight: 'bold',
                    }}>
                      Equipped
                    </div>
                  )}
                  {!equipped && owned && (
                    <button
                      onClick={() => equipSkin(skin.id)}
                      style={{
                        background: 'rgba(204,68,255,0.6)', border: 'none',
                        color: 'white', padding: '0.3rem 0.8rem',
                        borderRadius: '6px', cursor: 'pointer', fontSize: '0.78rem',
                      }}
                    >
                      Equip
                    </button>
                  )}
                  {!owned && (
                    <button
                      onClick={() => buySkin(skin)}
                      disabled={!canAfford}
                      style={{
                        background: canAfford ? 'linear-gradient(135deg,#cc8800,#ffee00)' : 'rgba(255,255,255,0.08)',
                        border: 'none',
                        color: canAfford ? '#1a0800' : '#555',
                        padding: '0.3rem 0.8rem',
                        borderRadius: '6px',
                        cursor: canAfford ? 'pointer' : 'not-allowed',
                        fontSize: '0.78rem',
                        fontWeight: 'bold',
                      }}
                    >
                      🪙 {skin.price}
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
