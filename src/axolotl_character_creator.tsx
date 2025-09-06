import React, { useState } from "react";
import { motion } from "framer-motion";
import { RotateCcw, Shuffle, Download, Crown } from "lucide-react";

const CLASSES = [
  { id: "teacher", label: "📚 Teacher" },
  { id: "astronaught", label: "👩‍🚀 Astronaut" },
  { id: "firefighter", label: "🔥 Firefighter" },
  { id: "doctor", label: "🩺 Doctor" },
  { id: "hacker", label: "💻 Hacker" },
  { id: "witch", label: "🧙 Witch" }
];

const TAIL_STYLES = ["short", "flowy", "spiky", "frilled"];
const GILL_STYLES = ["petite", "bushy", "ribbon", "royal"];

interface AxolotlState {
  name: string;
  clazz: string;
  isPrincess: boolean;
  bodyColor: string;
  bellyColor: string;
  gillColor: string;
  tailStyle: string;
  gillStyle: string;
  notes: string;
}

const DEFAULT_STATE: AxolotlState = {
  name: "Mima",
  clazz: "witch",
  isPrincess: false,
  bodyColor: "#f7b2d9",
  bellyColor: "#ffe4f2",
  gillColor: "#ff6b8a",
  tailStyle: "flowy",
  gillStyle: "ribbon",
  notes: ""
};

function AxolotlPreview({ state }: { state: AxolotlState }) {
  return (
    <div className="w-full h-full flex items-center justify-center p-4">
      <motion.div className="relative" initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.35 }}>
        <svg width={480} height={320} viewBox="0 0 512 512" className="drop-shadow-xl">
          <ellipse cx="260" cy="330" rx="90" ry="74" fill={state.bodyColor} />
          <ellipse cx="260" cy="360" rx="70" ry="38" fill={state.bellyColor} />
          <ellipse cx="220" cy="250" rx="90" ry="72" fill={state.bodyColor} />
          <circle cx="190" cy="252" r="8" fill="#111" />
          <circle cx="248" cy="252" r="8" fill="#111" />
          <path d="M198 270 C210 282, 228 282, 240 270" fill="none" stroke="#111" strokeWidth="5" strokeLinecap="round" />

          {state.gillStyle === "petite" && (
            <g fill={state.gillColor}>
              <circle cx="140" cy="210" r="10" />
              <circle cx="300" cy="210" r="10" />
              <circle cx="140" cy="230" r="10" />
              <circle cx="300" cy="230" r="10" />
              <circle cx="140" cy="250" r="10" />
              <circle cx="300" cy="250" r="10" />
            </g>
          )}
          {state.gillStyle === "bushy" && (
            <g fill={state.gillColor}>
              <ellipse cx="132" cy="210" rx="18" ry="12" />
              <ellipse cx="308" cy="210" rx="18" ry="12" />
              <ellipse cx="132" cy="230" rx="18" ry="12" />
              <ellipse cx="308" cy="230" rx="18" ry="12" />
              <ellipse cx="132" cy="250" rx="18" ry="12" />
              <ellipse cx="308" cy="250" rx="18" ry="12" />
            </g>
          )}
          {state.gillStyle === "ribbon" && (
            <g>
              <path d="M132 206 Q116 196 106 206 Q116 216 132 206" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 206 Q324 196 334 206 Q324 216 308 206" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M132 226 Q116 216 106 226 Q116 236 132 226" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 226 Q324 216 334 226 Q324 236 308 226" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M132 246 Q116 236 106 246 Q116 256 132 246" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 246 Q324 236 334 246 Q324 256 308 246" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
            </g>
          )}
          {state.gillStyle === "royal" && (
            <g>
              <path d="M132 206 Q108 186 104 198 Q118 216 132 206" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 206 Q332 186 336 198 Q322 216 308 206" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M132 226 Q108 206 104 218 Q118 236 132 226" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 226 Q332 206 336 218 Q322 236 308 226" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M132 246 Q108 226 104 238 Q118 256 132 246" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
              <path d="M308 246 Q332 226 336 238 Q322 256 308 246" fill="none" stroke={state.gillColor} strokeWidth="6" strokeLinecap="round" />
            </g>
          )}

          {state.tailStyle === "short" && <ellipse cx="360" cy="330" rx="40" ry="22" fill={state.bodyColor} />}
          {state.tailStyle === "flowy" && <path d="M320 300 C380 260, 440 280, 460 330 C440 380, 380 400, 320 360 Z" fill={state.bodyColor} />}
          {state.tailStyle === "spiky" && (
            <g fill={state.bodyColor}>
              <polygon points="320,310 350,290 342,320" />
              <polygon points="342,320 390,310 368,340" />
              <polygon points="368,340 428,340 388,362" />
            </g>
          )}
          {state.tailStyle === "frilled" && <path d="M320 290 Q400 260 470 290 Q400 320 320 310 Q400 340 470 360 Q400 380 320 350" fill={state.bodyColor} />}

          {state.clazz === "witch" && <polygon points="160,200 280,200 220,120" fill="#2b2b2b" stroke="#111" strokeWidth="4" />}
          {state.clazz === "astronaught" && <circle cx="220" cy="240" r="80" fill="none" stroke="#aaa" strokeWidth="12" />}
          {state.clazz === "firefighter" && <rect x="160" y="180" width="120" height="40" fill="red" stroke="#111" strokeWidth="4" rx="6" />}
          {state.clazz === "doctor" && <circle cx="220" cy="180" r="16" fill="white" stroke="#111" strokeWidth="4" />}
          {state.clazz === "hacker" && <rect x="160" y="220" width="120" height="40" fill="black" stroke="#0f0" strokeWidth="2" rx="4" />}
          {state.clazz === "teacher" && (
            <g>
              <rect x="200" y="280" width="120" height="40" fill="#86efac" stroke="#14532d" strokeWidth="3" />
              <line x1="200" y1="295" x2="320" y2="295" stroke="#14532d" strokeWidth="3" />
              <line x1="200" y1="305" x2="320" y2="305" stroke="#14532d" strokeWidth="3" />
            </g>
          )}

          {state.isPrincess && (
            <g transform="translate(180,160)">
              <polygon points="0,20 20,0 40,20 60,0 80,20" fill="#ffd166" stroke="#111" strokeWidth="2" />
              <rect x="0" y="20" width="80" height="6" fill="#f4a261" />
            </g>
          )}
        </svg>
      </motion.div>
    </div>
  );
}

function ColorInput({ id, label, value, onChange }: { id: string; label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: '0.75rem' }}>
      <div className="character-creator-form-group" style={{ margin: 0 }}>
        <label htmlFor={id} className="character-creator-label">{label}</label>
        <input 
          id={id} 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="character-creator-input"
        />
      </div>
      <input aria-label={label} type="color" style={{ height: '2.5rem', width: '3rem', borderRadius: '0.375rem', border: '1px solid #d1d5db' }} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

interface AxolotlCharacterCreatorProps {
  onBack: () => void;
}

export default function AxolotlCharacterCreator({ onBack }: AxolotlCharacterCreatorProps) {
  const [state, setState] = useState<AxolotlState>(DEFAULT_STATE);
  const [activeTab, setActiveTab] = useState('class');
  const set = (key: keyof AxolotlState, val: any) => setState((s) => ({ ...s, [key]: val }));

  const handleDownload = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${state.name || "axolotl"}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleReset = () => setState(DEFAULT_STATE);
  const handleRandom = () => setState({ ...DEFAULT_STATE, clazz: CLASSES[Math.floor(Math.random() * CLASSES.length)].id });

  return (
    <div>
      <style>{`
        .character-creator-container {
          min-height: 100vh;
          width: 100%;
          background: linear-gradient(to bottom, #f8fafc, #ffffff);
          padding: 1.5rem 0;
        }
        .character-creator-content {
          margin: 0 auto;
          max-width: 72rem;
          padding: 0 1rem;
        }
        .character-creator-header {
          margin-bottom: 1.5rem;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 1rem;
        }
        .character-creator-title {
          font-size: 1.875rem;
          font-weight: 700;
          letter-spacing: -0.025em;
        }
        .character-creator-buttons {
          display: flex;
          gap: 0.5rem;
        }
        .character-creator-button {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background: white;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 0.5rem;
          transition: background-color 0.2s;
        }
        .character-creator-button:hover {
          background-color: #f9fafb;
        }
        .character-creator-button.primary {
          background-color: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .character-creator-button.primary:hover {
          background-color: #1d4ed8;
        }
        .character-creator-grid {
          display: grid;
          grid-template-columns: 1fr;
          gap: 1.5rem;
        }
        @media (min-width: 1024px) {
          .character-creator-grid {
            grid-template-columns: 1fr 1fr;
          }
        }
        .character-creator-card {
          background-color: white;
          border-radius: 0.5rem;
          box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
          padding: 1.5rem;
        }
        .character-creator-card-title {
          font-size: 1.25rem;
          font-weight: 600;
          margin-bottom: 1rem;
        }
        .character-creator-tabs {
          display: flex;
          gap: 0.5rem;
          margin-bottom: 1rem;
        }
        .character-creator-tab {
          padding: 0.5rem 1rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          background: white;
          cursor: pointer;
          transition: background-color 0.2s;
        }
        .character-creator-tab:hover {
          background-color: #f9fafb;
        }
        .character-creator-tab.active {
          background-color: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .character-creator-form-group {
          margin-bottom: 1rem;
        }
        .character-creator-label {
          display: block;
          font-size: 0.875rem;
          font-weight: 500;
          color: #374151;
          margin-bottom: 0.25rem;
        }
        .character-creator-input {
          width: 100%;
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: 0.375rem;
          font-size: 0.875rem;
        }
        .character-creator-input:focus {
          outline: none;
          border-color: #3b82f6;
          box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.1);
        }
        .character-creator-class-buttons {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }
        .character-creator-class-button {
          padding: 0.5rem 1rem;
          border-radius: 0.375rem;
          cursor: pointer;
          border: 1px solid #d1d5db;
          background: white;
        }
        .character-creator-class-button.active {
          background-color: #2563eb;
          color: white;
          border-color: #2563eb;
        }
        .character-creator-checkbox-group {
          display: flex;
          align-items: center;
          gap: 0.75rem;
          padding-top: 0.5rem;
        }
        .character-creator-preview {
          height: 420px;
        }
        .character-creator-preview-info {
          margin-top: 0.5rem;
          font-size: 0.75rem;
          color: #6b7280;
        }
      `}</style>
      
      <div className="character-creator-container">
        <div className="character-creator-content">
          <div className="character-creator-header">
            <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <button 
                onClick={onBack}
                className="character-creator-button"
              >
                ← Back to Home
              </button>
              <h1 className="character-creator-title">Axolotl Character Creator</h1>
            </div>
            <div className="character-creator-buttons">
              <button 
                className="character-creator-button"
                onClick={handleReset}
              >
                <RotateCcw style={{ height: '1rem', width: '1rem' }} />
                Reset
              </button>
              <button 
                className="character-creator-button"
                onClick={handleRandom}
              >
                <Shuffle style={{ height: '1rem', width: '1rem' }} />
                Random
              </button>
              <button 
                className="character-creator-button primary"
                onClick={handleDownload}
              >
                <Download style={{ height: '1rem', width: '1rem' }} />
                Export JSON
              </button>
            </div>
          </div>

          <div className="character-creator-grid">
            <div className="character-creator-card">
              <h2 className="character-creator-card-title">Creator</h2>
              
              <div style={{ width: '100%' }}>
                <div className="character-creator-tabs">
                  <button 
                    className={`character-creator-tab ${activeTab === 'class' ? 'active' : ''}`}
                    onClick={() => setActiveTab('class')}
                  >
                    Class
                  </button>
                  <button 
                    className={`character-creator-tab ${activeTab === 'appearance' ? 'active' : ''}`}
                    onClick={() => setActiveTab('appearance')}
                  >
                    Appearance
                  </button>
                  <button 
                    className={`character-creator-tab ${activeTab === 'bio' ? 'active' : ''}`}
                    onClick={() => setActiveTab('bio')}
                  >
                    Identity
                  </button>
                </div>

                {activeTab === 'class' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="character-creator-form-group">
                      <label htmlFor="name" className="character-creator-label">Name</label>
                      <input 
                        id="name" 
                        value={state.name} 
                        onChange={(e) => set("name", e.target.value)}
                        className="character-creator-input"
                      />
                    </div>

                    <div className="character-creator-class-buttons">
                      {CLASSES.map((c) => (
                        <button 
                          key={c.id} 
                          className={`character-creator-class-button ${
                            state.clazz === c.id ? 'active' : ''
                          }`}
                          onClick={() => set("clazz", c.id)}
                        >
                          {c.label}
                        </button>
                      ))}
                    </div>

                    <div className="character-creator-checkbox-group">
                      <input 
                        id="princess" 
                        type="checkbox" 
                        checked={state.isPrincess} 
                        onChange={(e) => set("isPrincess", e.target.checked)}
                        style={{ height: '1rem', width: '1rem' }}
                      />
                      <label htmlFor="princess" className="character-creator-label" style={{ margin: 0 }}>This axolotl is a princess</label>
                    </div>
                  </div>
                )}

                {activeTab === 'appearance' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
                    <ColorInput id="bodyColor" label="Body Color" value={state.bodyColor} onChange={(v) => set("bodyColor", v)} />
                    <ColorInput id="bellyColor" label="Belly Color" value={state.bellyColor} onChange={(v) => set("bellyColor", v)} />
                    <ColorInput id="gillColor" label="Gill Color" value={state.gillColor} onChange={(v) => set("gillColor", v)} />
                    <div className="character-creator-form-group">
                      <label className="character-creator-label">Tail Style</label>
                      <select 
                        value={state.tailStyle} 
                        onChange={(e) => set("tailStyle", e.target.value)}
                        className="character-creator-input"
                      >
                        {TAIL_STYLES.map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="character-creator-form-group">
                      <label className="character-creator-label">Gill Style</label>
                      <select 
                        value={state.gillStyle} 
                        onChange={(e) => set("gillStyle", e.target.value)}
                        className="character-creator-input"
                      >
                        {GILL_STYLES.map((g) => (
                          <option key={g} value={g}>
                            {g}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                )}

                {activeTab === 'bio' && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div className="character-creator-form-group">
                      <label htmlFor="notes" className="character-creator-label">Backstory Notes</label>
                      <textarea 
                        id="notes" 
                        value={state.notes} 
                        onChange={(e) => set("notes", e.target.value)}
                        className="character-creator-input"
                        style={{ height: '8rem', resize: 'vertical' }}
                      />
                    </div>
                  </div>
                )}
            </div>
          </div>

            <div className="character-creator-card">
              <h2 className="character-creator-card-title" style={{ display: 'flex', alignItems: 'center' }}>
                Preview {state.isPrincess && <Crown style={{ marginLeft: '0.5rem', height: '1rem', width: '1rem' }} />}
              </h2>
              <div className="character-creator-preview">
                <AxolotlPreview state={state} />
                <div className="character-creator-preview-info">
                  <strong>Class:</strong> {state.clazz} • <strong>Name:</strong> {state.name || "—"}
                </div>
              </div>
            </div>
        </div>
      </div>
    </div>
    </div>
  );
}
