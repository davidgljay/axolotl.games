import React, { useState } from "react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
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

const DEFAULT_STATE = {
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

function AxolotlPreview({ state }) {
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

function ColorInput({ id, label, value, onChange }) {
  return (
    <div className="grid grid-cols-[1fr_auto] items-center gap-3">
      <div className="space-y-1">
        <Label htmlFor={id}>{label}</Label>
        <Input id={id} value={value} onChange={(e) => onChange(e.target.value)} />
      </div>
      <input aria-label={label} type="color" className="h-10 w-12 rounded-md border" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export default function AxolotlCharacterCreator() {
  const [state, setState] = useState(DEFAULT_STATE);
  const set = (key, val) => setState((s) => ({ ...s, [key]: val }));

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
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-white py-6 md:py-10">
      <div className="mx-auto max-w-6xl px-4">
        <div className="mb-6 flex items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Axolotl Character Creator</h1>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={handleReset}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset
            </Button>
            <Button variant="outline" onClick={handleRandom}>
              <Shuffle className="mr-2 h-4 w-4" />
              Random
            </Button>
            <Button onClick={handleDownload}>
              <Download className="mr-2 h-4 w-4" />
              Export JSON
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          <Card className="lg:col-span-3">
            <CardHeader>
              <CardTitle>Creator</CardTitle>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="class" className="w-full">
                <TabsList className="grid grid-cols-3">
                  <TabsTrigger value="class">Class</TabsTrigger>
                  <TabsTrigger value="appearance">Appearance</TabsTrigger>
                  <TabsTrigger value="bio">Identity</TabsTrigger>
                </TabsList>

                <TabsContent value="class" className="mt-4 space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="name">Name</Label>
                    <Input id="name" value={state.name} onChange={(e) => set("name", e.target.value)} />
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {CLASSES.map((c) => (
                      <Button key={c.id} variant={state.clazz === c.id ? "default" : "outline"} onClick={() => set("clazz", c.id)}>
                        {c.label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex items-center gap-3 pt-2">
                    <Checkbox id="princess" checked={state.isPrincess} onCheckedChange={(v) => set("isPrincess", Boolean(v))} />
                    <Label htmlFor="princess">This axolotl is a princess</Label>
                  </div>
                </TabsContent>

                <TabsContent value="appearance" className="mt-4 space-y-6">
                  <ColorInput id="bodyColor" label="Body Color" value={state.bodyColor} onChange={(v) => set("bodyColor", v)} />
                  <ColorInput id="bellyColor" label="Belly Color" value={state.bellyColor} onChange={(v) => set("bellyColor", v)} />
                  <ColorInput id="gillColor" label="Gill Color" value={state.gillColor} onChange={(v) => set("gillColor", v)} />
                  <div className="space-y-2">
                    <Label>Tail Style</Label>
                    <select value={state.tailStyle} onChange={(e) => set("tailStyle", e.target.value)}>
                      {TAIL_STYLES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <Label>Gill Style</Label>
                    <select value={state.gillStyle} onChange={(e) => set("gillStyle", e.target.value)}>
                      {GILL_STYLES.map((g) => (
                        <option key={g} value={g}>
                          {g}
                        </option>
                      ))}
                    </select>
                  </div>
                </TabsContent>

                <TabsContent value="bio" className="mt-4 space-y-4">
                  <Label htmlFor="notes">Backstory Notes</Label>
                  <Textarea id="notes" value={state.notes} onChange={(e) => set("notes", e.target.value)} />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>

          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle>
                Preview {state.isPrincess && <Crown className="inline ml-2 h-4 w-4" />}
              </CardTitle>
            </CardHeader>
            <CardContent className="h-[420px]">
              <AxolotlPreview state={state} />
              <div className="mt-2 text-xs text-muted-foreground">
                <strong>Class:</strong> {state.clazz} • <strong>Name:</strong> {state.name || "—"}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
