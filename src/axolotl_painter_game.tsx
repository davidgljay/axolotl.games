import React, { useState, useRef, useEffect } from "react";

type AxolotlType = "artist" | "nature" | "birdwatcher" | "dancer" | "normal";

interface AxolotlOption {
  id: AxolotlType;
  label: string;
  image: string;
}

const AXOLOTL_TYPES: AxolotlOption[] = [
  { id: "artist", label: "Artist", image: "/img/axolotl_painter_artist.png" },
  { id: "nature", label: "Nature Lover", image: "/img/axolotl_painter_nature.png" },
  { id: "birdwatcher", label: "Birdwatcher", image: "/img/axolotl_painter_birdwatcher.png" },
  { id: "dancer", label: "Dancer", image: "/img/axolotl_painter_dancer.png" },
  { id: "normal", label: "Normal Kid", image: "/img/axolotl_painter_normal.png" },
];

interface AxolotlPainterGameProps {
  onBack: () => void;
}

export default function AxolotlPainterGame({ onBack }: AxolotlPainterGameProps) {
  const [selectedAxolotl, setSelectedAxolotl] = useState<AxolotlType | null>(null);
  const [selectedColor, setSelectedColor] = useState<string>("#000000"); // Default to black
  const [brushSize, setBrushSize] = useState<number>(10);
  const [isDrawing, setIsDrawing] = useState<boolean>(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (selectedAxolotl && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        // Set canvas size (smaller, more reasonable size)
        canvas.width = 640;
        canvas.height = 480;
        // Fill with white background
        ctx.fillStyle = "#FFFFFF";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
      }
    }
  }, [selectedAxolotl]);

  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };

    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;
    
    let clientX: number, clientY: number;
    if ('touches' in e) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }
    
    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY,
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    e.preventDefault();
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    e.preventDefault();

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCoordinates(e);

    ctx.lineTo(x, y);
    ctx.strokeStyle = selectedColor;
    ctx.lineWidth = brushSize;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.fillStyle = "#FFFFFF";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  };

  const savePainting = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.toBlob((blob) => {
      if (blob) {
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `axolotl_painting_${Date.now()}.png`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  };

  // Character Selection Screen
  if (!selectedAxolotl) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-600 via-pink-500 to-orange-400 p-6 relative overflow-hidden">
        {/* Animated background elements */}
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute top-20 left-10 w-32 h-32 bg-white/10 rounded-full blur-2xl animate-pulse"></div>
          <div className="absolute bottom-20 right-10 w-40 h-40 bg-yellow-300/20 rounded-full blur-3xl animate-pulse delay-1000"></div>
          <div className="absolute top-1/2 left-1/2 w-48 h-48 bg-pink-300/15 rounded-full blur-3xl animate-pulse delay-2000"></div>
        </div>
        
        <div className="max-w-6xl mx-auto relative z-10">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-5xl font-bold text-white drop-shadow-lg mb-2">
                🎨 Axolotl Painter
              </h1>
              <p className="text-white/90 text-lg">Choose your artistic identity</p>
            </div>
            <button
              onClick={onBack}
              className="px-6 py-3 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl shadow-lg font-semibold transition-all hover:scale-105 border-2 border-white/30"
            >
              ← Back to Home
            </button>
          </div>
          
          <div className="bg-white/95 backdrop-blur-md rounded-2xl shadow-2xl p-6 border-2 border-white/50">
            <h2 className="text-2xl font-bold text-center mb-6 bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
              Choose Your Axolotl Character
            </h2>
            <div className="grid grid-cols-5 gap-3">
              {AXOLOTL_TYPES.map((type, index) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedAxolotl(type.id)}
                  className="group bg-gradient-to-br from-white to-gray-50 rounded-xl p-3 hover:shadow-xl transition-all duration-300 hover:scale-105 border-2 border-transparent hover:border-purple-400 hover:from-purple-50 hover:to-pink-50"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <div className="aspect-square mb-2 bg-gradient-to-br from-purple-100 to-pink-100 rounded-lg flex items-center justify-center overflow-hidden shadow-inner group-hover:shadow-md transition-all">
                    <img
                      src={type.image}
                      alt={type.label}
                      className="w-full h-full object-contain group-hover:scale-110 transition-transform duration-300"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.style.display = "none";
                        const placeholder = document.createElement("div");
                        placeholder.className = "w-full h-full flex items-center justify-center text-4xl";
                        placeholder.textContent = "🦎";
                        target.parentElement?.appendChild(placeholder);
                      }}
                    />
                  </div>
                  <p className="text-center font-semibold text-gray-800 text-sm group-hover:text-purple-600 transition-colors">
                    {type.label}
                  </p>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-pink-50 to-purple-50 p-6">
      <div className="max-w-7xl mx-auto">
        <div className="mb-4 flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <img
              src={AXOLOTL_TYPES.find((t) => t.id === selectedAxolotl)?.image || ""}
              alt="Selected Axolotl"
              className="object-contain rounded bg-white p-1"
              style={{ width: "200px", height: "200px", flexShrink: 0 }}
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.style.display = "none";
              }}
            />
            <h1 className="text-xl font-bold text-purple-800">
              {AXOLOTL_TYPES.find((t) => t.id === selectedAxolotl)?.label}'s Studio
            </h1>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setSelectedAxolotl(null)}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg shadow"
            >
              Change Character
            </button>
            <button
              onClick={onBack}
              className="px-4 py-2 bg-gray-500 hover:bg-gray-600 text-white rounded-lg shadow"
            >
              Back to Home
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Painting Canvas */}
          <div className="lg:col-span-3 bg-white rounded-xl shadow-lg p-6">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-2xl font-semibold text-gray-800">Your Canvas</h2>
              <div className="flex gap-2">
                <button
                  onClick={clearCanvas}
                  className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg shadow"
                >
                  Clear
                </button>
                <button
                  onClick={savePainting}
                  className="px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg shadow"
                >
                  Save Painting
                </button>
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg p-4 overflow-auto flex justify-center">
              <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="bg-white rounded border-2 border-gray-300"
                style={{
                  maxWidth: "100%",
                  height: "auto",
                  display: "block",
                  cursor: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='32' height='32' viewBox='0 0 24 24'%3E%3Cpath d='M20.71 4.63l-1.34-1.34c-.39-.39-1.02-.39-1.41 0L9 12.25 11.75 15l8.96-8.96c.39-.39.39-1.02 0-1.41zM7 14a3 3 0 0 0-3 3c0 1.31-1.16 2-2 2 .92 1.22 2.49 2 4 2a4 4 0 0 0 4-4 3 3 0 0 0-3-3z' fill='%23000' stroke='%23fff' stroke-width='0.5'/%3E%3C/svg%3E") 2 28, auto`,
                }}
                onMouseDown={startDrawing}
                onMouseMove={draw}
                onMouseUp={stopDrawing}
                onMouseLeave={stopDrawing}
                onTouchStart={startDrawing}
                onTouchMove={draw}
                onTouchEnd={stopDrawing}
              />
            </div>
            <div className="mt-4 text-sm text-gray-600">
              <p>Click and drag (or touch and drag) to paint on the canvas.</p>
            </div>
          </div>

          {/* Controls Sidebar */}
          <div className="space-y-6">
            {/* Color Picker */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Color Picker</h3>
              <div className="flex flex-col items-center gap-4">
                <input
                  type="color"
                  value={selectedColor}
                  onChange={(e) => setSelectedColor(e.target.value)}
                  className="w-full h-32 rounded-lg border-2 border-gray-300 cursor-pointer"
                  style={{ minHeight: "200px" }}
                />
                <div className="w-full">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Color Value
                  </label>
                  <input
                    type="text"
                    value={selectedColor}
                    onChange={(e) => {
                      if (/^#[0-9A-F]{6}$/i.test(e.target.value)) {
                        setSelectedColor(e.target.value);
                      }
                    }}
                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-center font-mono text-sm"
                    placeholder="#000000"
                  />
                </div>
              </div>
            </div>

            {/* Brush Size */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Brush Size</h3>
              <input
                type="range"
                min="1"
                max="50"
                value={brushSize}
                onChange={(e) => setBrushSize(Number(e.target.value))}
                className="w-full"
              />
              <div className="mt-2 flex items-center justify-center">
                <div
                  className="rounded-full border-2 border-gray-400"
                  style={{
                    width: `${brushSize}px`,
                    height: `${brushSize}px`,
                    backgroundColor: selectedColor,
                  }}
                />
                <span className="ml-3 text-sm text-gray-700">{brushSize}px</span>
              </div>
            </div>

            {/* Current Color Display */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-xl font-semibold mb-4 text-gray-800">Current Color</h3>
              <div className="flex flex-col items-center">
                <div
                  className="w-24 h-24 rounded-lg border-4 border-gray-400 shadow-lg"
                  style={{ backgroundColor: selectedColor }}
                />
                <p className="mt-3 text-sm text-gray-700 font-semibold font-mono">
                  {selectedColor.toUpperCase()}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
