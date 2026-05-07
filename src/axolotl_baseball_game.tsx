import React, { useState, useEffect, useRef, useCallback } from "react";

interface AxolotlBaseballGameProps {
  onBack: () => void;
}

type GameState = "waiting" | "pitching" | "swinging" | "ball-in-flight" | "result";

interface BaseRunner {
  base: number; // 0 = home, 1 = first, 2 = second, 3 = third
  progress: number; // 0-1 progress to next base
  isRunning: boolean;
}

export default function AxolotlBaseballGame({ onBack }: AxolotlBaseballGameProps) {
  const [gameState, setGameState] = useState<GameState>("waiting");
  const [score, setScore] = useState(0);
  const [bestScore, setBestScore] = useState(0);
  const [hitDistance, setHitDistance] = useState(0);
  const [pitchStartTime, setPitchStartTime] = useState(0);
  const [pitchDuration, setPitchDuration] = useState(0);
  const [swingTime, setSwingTime] = useState(0);
  const [ballPosition, setBallPosition] = useState({ x: 0, y: 0 });
  const [ballTrajectory, setBallTrajectory] = useState<Array<{ x: number; y: number }>>([]);
  const [timingIndicator, setTimingIndicator] = useState(0); // 0-1, where 0.5 is perfect
  const [baseRunners, setBaseRunners] = useState<BaseRunner[]>([]);
  const [isHomeRun, setIsHomeRun] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const animationFrameRef = useRef<number | null>(null);
  const pitchStartRef = useRef<number>(0);
  const ballFlightStartRef = useRef<number>(0);
  const runnerAnimationStartRef = useRef<number>(0);

  // Load best score from localStorage
  useEffect(() => {
    try {
      const saved = localStorage.getItem("axolotl_baseball_best");
      if (saved) {
        setBestScore(parseInt(saved, 10));
      }
    } catch (e) {
      console.warn("Failed to load best score:", e);
    }
  }, []);

  // Save best score
  useEffect(() => {
    if (score > bestScore) {
      setBestScore(score);
      try {
        localStorage.setItem("axolotl_baseball_best", score.toString());
      } catch (e) {
        console.warn("Failed to save best score:", e);
      }
    }
  }, [score, bestScore]);

  // Start a new pitch
  const startPitch = useCallback(() => {
    const duration = 1000 + Math.random() * 2000; // 1-3 seconds
    setPitchDuration(duration);
    setPitchStartTime(Date.now());
    pitchStartRef.current = Date.now();
    setGameState("pitching");
    setBallPosition({ x: 400, y: 200 }); // Pitcher position (center of field)
    setBallTrajectory([]);
    setTimingIndicator(0);
    setIsHomeRun(false);
    setBaseRunners([]);
    runnerAnimationStartRef.current = 0;
  }, []);

  // Handle swing
  const handleSwing = useCallback(() => {
    if (gameState !== "pitching") return;

    const now = Date.now();
    const elapsed = now - pitchStartRef.current;
    const progress = elapsed / pitchDuration;
    setSwingTime(progress);
    setGameState("swinging");

    // Calculate timing precision - more sensitive (0.5 is perfect timing)
    // Perfect zone is now much smaller (only yellow stripe)
    const timingPrecision = Math.abs(0.5 - progress);
    // Make it 3x more sensitive - perfect zone is now ~6.7% instead of 20%
    const timingScore = Math.max(0, 1 - timingPrecision * 6); // 1.0 = perfect, 0.0 = miss
    
    // Home run only if hitting the yellow stripe (very close to 0.5)
    const isPerfectTiming = timingPrecision < 0.033; // ~3.3% tolerance for home run
    const homeRun = isPerfectTiming && timingScore > 0.8;

    // Calculate distance based on timing
    const maxDistance = 500;
    const distance = Math.floor(timingScore * maxDistance);
    setHitDistance(distance);
    setIsHomeRun(homeRun);
    
    if (homeRun) {
      setScore(prev => prev + distance);
    } else if (distance > 0) {
      setScore(prev => prev + distance);
    }

    // Animate ball trajectory
    const trajectory: Array<{ x: number; y: number }> = [];
    const startX = 400; // Batter position
    const startY = 400;
    const angle = Math.PI / 4; // 45 degrees
    const velocity = timingScore * 15;
    const gravity = 0.5;

    for (let t = 0; t < 100; t += 0.1) {
      const x = startX + velocity * Math.cos(angle) * t * 10;
      const y = startY - (velocity * Math.sin(angle) * t * 10 - 0.5 * gravity * t * t * 100);
      if (y > 50 && x < 800) {
        trajectory.push({ x, y });
      } else {
        break;
      }
    }

    setBallTrajectory(trajectory);
    ballFlightStartRef.current = Date.now();
    
    // Handle base running
    if (distance > 0) {
      if (homeRun) {
        // All runners run home
        const runners: BaseRunner[] = [];
        // Add runners on bases (for demo, add some runners)
        for (let i = 1; i <= 3; i++) {
          runners.push({ base: i, progress: 0, isRunning: true });
        }
        // Batter also runs
        runners.push({ base: 0, progress: 0, isRunning: true });
        setBaseRunners(runners);
        runnerAnimationStartRef.current = Date.now();
      } else {
        // Batter runs to first base
        setBaseRunners([{ base: 0, progress: 0, isRunning: true }]);
        runnerAnimationStartRef.current = Date.now();
      }
    }
    
    setGameState("ball-in-flight");

    // Reset after showing result
    setTimeout(() => {
      setGameState("result");
      setTimeout(() => {
        setGameState("waiting");
        setBallTrajectory([]);
        setHitDistance(0);
        setBaseRunners([]);
        runnerAnimationStartRef.current = 0;
      }, 3000);
    }, 2000);
  }, [gameState, pitchDuration]);

  // Keyboard handler
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        handleSwing();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [handleSwing]);

  // Animation loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const W = 800;
    const H = 600;
    canvas.width = W;
    canvas.height = H;

    const draw = () => {
      ctx.clearRect(0, 0, W, H);

      // Background - baseball field
      const gradient = ctx.createLinearGradient(0, 0, 0, H);
      gradient.addColorStop(0, "#87CEEB"); // Sky blue
      gradient.addColorStop(0.7, "#90EE90"); // Light green
      gradient.addColorStop(1, "#228B22"); // Forest green
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 0, W, H);

      // Draw bases
      const homePlate = { x: W / 2, y: H - 50 };
      const firstBase = { x: 50, y: H / 2 };
      const secondBase = { x: W / 2, y: 50 };
      const thirdBase = { x: W - 50, y: H / 2 };

      // Draw field lines (simple diamond)
      ctx.strokeStyle = "#FFFFFF";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(homePlate.x, homePlate.y);
      ctx.lineTo(firstBase.x, firstBase.y);
      ctx.lineTo(secondBase.x, secondBase.y);
      ctx.lineTo(thirdBase.x, thirdBase.y);
      ctx.closePath();
      ctx.stroke();

      // Draw bases as squares
      const baseSize = 20;
      ctx.fillStyle = "#FFFFFF";
      ctx.fillRect(firstBase.x - baseSize / 2, firstBase.y - baseSize / 2, baseSize, baseSize);
      ctx.fillRect(secondBase.x - baseSize / 2, secondBase.y - baseSize / 2, baseSize, baseSize);
      ctx.fillRect(thirdBase.x - baseSize / 2, thirdBase.y - baseSize / 2, baseSize, baseSize);
      
      // Home plate (pentagon shape)
      ctx.beginPath();
      ctx.moveTo(homePlate.x, homePlate.y);
      ctx.lineTo(homePlate.x - 10, homePlate.y - 8);
      ctx.lineTo(homePlate.x - 8, homePlate.y - 15);
      ctx.lineTo(homePlate.x + 8, homePlate.y - 15);
      ctx.lineTo(homePlate.x + 10, homePlate.y - 8);
      ctx.closePath();
      ctx.fill();

      // Helper function to draw axolotl sprite
      const drawAxolotl = (x: number, y: number, color: string = "#FFB6C1", size: number = 1, rotation: number = 0) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);
        ctx.scale(size, size);
        
        // Body
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.ellipse(0, 0, 30, 20, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyes
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(-8, -5, 3, 0, Math.PI * 2);
        ctx.arc(8, -5, 3, 0, Math.PI * 2);
        ctx.fill();
        
        // Gills
        ctx.strokeStyle = "#FF69B4";
        ctx.lineWidth = 2;
        for (let i = -1; i <= 1; i++) {
          ctx.beginPath();
          ctx.arc(-15 + i * 5, 5, 4, 0, Math.PI * 2);
          ctx.stroke();
        }
        
        ctx.restore();
      };

      // Draw pitcher (center of field)
      const pitcherX = W / 2;
      const pitcherY = H / 3;
      drawAxolotl(pitcherX, pitcherY, "#FFB6C1");

      // Draw fielders
      drawAxolotl(150, 100, "#FFA0B4", 0.8); // Left fielder
      drawAxolotl(650, 100, "#FFA0B4", 0.8); // Right fielder
      drawAxolotl(400, 80, "#FFA0B4", 0.8); // Center fielder
      drawAxolotl(200, 250, "#FFA0B4", 0.75); // Shortstop
      drawAxolotl(600, 250, "#FFA0B4", 0.75); // Third baseman
      drawAxolotl(100, 300, "#FFA0B4", 0.75); // First baseman
      drawAxolotl(700, 300, "#FFA0B4", 0.75); // Second baseman

      // Draw batter (right side) - only if not running
      const batterX = 400;
      const batterY = 400;
      const batterRunning = baseRunners.some(r => r.base === 0 && r.isRunning);
      
      if (!batterRunning) {
        ctx.save();
        ctx.translate(batterX, batterY);
        if (gameState === "swinging") {
          ctx.rotate(-0.3); // Swing animation
        }
        drawAxolotl(0, 0, "#FFB6C1", 1, 0);
        // Bat
        ctx.strokeStyle = "#8B4513";
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(25, -10);
        ctx.lineTo(45, -25);
        ctx.stroke();
        ctx.restore();
      }

      // Draw base runners
      const timeSinceRun = Date.now() - runnerAnimationStartRef.current;
      const runDuration = isHomeRun ? 2000 : 1500; // Home run takes longer
      
      baseRunners.forEach((runner, index) => {
        let currentX = 0;
        let currentY = 0;
        let targetX = 0;
        let targetY = 0;
        
        if (runner.isRunning && runnerAnimationStartRef.current > 0) {
          const progress = Math.min(1, timeSinceRun / runDuration);
          
          if (isHomeRun) {
            // All runners go home
            if (runner.base === 1) {
              // From first to home
              currentX = firstBase.x + (homePlate.x - firstBase.x) * progress;
              currentY = firstBase.y + (homePlate.y - firstBase.y) * progress;
              targetX = homePlate.x;
              targetY = homePlate.y;
            } else if (runner.base === 2) {
              // From second to third to home
              if (progress < 0.5) {
                const p = progress * 2;
                currentX = secondBase.x + (thirdBase.x - secondBase.x) * p;
                currentY = secondBase.y + (thirdBase.y - secondBase.y) * p;
                targetX = thirdBase.x;
                targetY = thirdBase.y;
              } else {
                const p = (progress - 0.5) * 2;
                currentX = thirdBase.x + (homePlate.x - thirdBase.x) * p;
                currentY = thirdBase.y + (homePlate.y - thirdBase.y) * p;
                targetX = homePlate.x;
                targetY = homePlate.y;
              }
            } else if (runner.base === 3) {
              // From third to home
              currentX = thirdBase.x + (homePlate.x - thirdBase.x) * progress;
              currentY = thirdBase.y + (homePlate.y - thirdBase.y) * progress;
              targetX = homePlate.x;
              targetY = homePlate.y;
            } else {
              // Batter running home
              currentX = batterX + (homePlate.x - batterX) * progress;
              currentY = batterY + (homePlate.y - batterY) * progress;
              targetX = homePlate.x;
              targetY = homePlate.y;
            }
          } else {
            // Batter runs to first base
            if (runner.base === 0) {
              currentX = batterX + (firstBase.x - batterX) * progress;
              currentY = batterY + (firstBase.y - batterY) * progress;
              targetX = firstBase.x;
              targetY = firstBase.y;
            }
          }
          
          // Draw running axolotl with proper angle
          const dx = targetX - currentX;
          const dy = targetY - currentY;
          const angle = Math.atan2(dy, dx);
          drawAxolotl(currentX, currentY, "#FFB6C1", 0.9, angle);
        } else if (!runner.isRunning) {
          // Draw axolotl at base
          if (runner.base === 1) {
            drawAxolotl(firstBase.x, firstBase.y, "#FFB6C1", 0.85);
          } else if (runner.base === 2) {
            drawAxolotl(secondBase.x, secondBase.y, "#FFB6C1", 0.85);
          } else if (runner.base === 3) {
            drawAxolotl(thirdBase.x, thirdBase.y, "#FFB6C1", 0.85);
          }
        }
      });

      // Draw ball
      if (gameState === "pitching" || gameState === "swinging" || gameState === "ball-in-flight") {
        let ballX = ballPosition.x;
        let ballY = ballPosition.y;

        if (gameState === "pitching") {
          const progress = (Date.now() - pitchStartTime) / pitchDuration;
          ballX = pitcherX + (batterX - pitcherX) * progress;
          ballY = pitcherY + (batterY - pitcherY) * progress;
          setBallPosition({ x: ballX, y: ballY });
          setTimingIndicator(progress);
        } else if (gameState === "ball-in-flight" && ballTrajectory.length > 0) {
          const timeSinceFlight = Date.now() - ballFlightStartRef.current;
          const currentIndex = Math.min(
            Math.floor(timeSinceFlight / 20),
            ballTrajectory.length - 1
          );
          if (currentIndex >= 0 && currentIndex < ballTrajectory.length) {
            const pos = ballTrajectory[currentIndex];
            ballX = pos.x;
            ballY = pos.y;
          }
        }

        // Draw baseball
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(ballX, ballY, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = "#C0C0C0";
        ctx.lineWidth = 1;
        ctx.stroke();
        // Stitches
        ctx.strokeStyle = "#8B4513";
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(ballX - 4, ballY);
        ctx.lineTo(ballX + 4, ballY);
        ctx.moveTo(ballX, ballY - 4);
        ctx.lineTo(ballX, ballY + 4);
        ctx.stroke();
      }

      // Draw timing indicator
      if (gameState === "pitching") {
        const indicatorX = W / 2;
        const indicatorY = H - 100;
        const indicatorWidth = 300;
        const indicatorHeight = 30;

        // Background
        ctx.fillStyle = "rgba(0, 0, 0, 0.5)";
        ctx.fillRect(
          indicatorX - indicatorWidth / 2,
          indicatorY - indicatorHeight / 2,
          indicatorWidth,
          indicatorHeight
        );

        // Perfect timing zone (green) - much smaller now
        const perfectZoneWidth = indicatorWidth * 0.067; // ~6.7% instead of 20%
        const perfectZoneX = indicatorX - perfectZoneWidth / 2;
        ctx.fillStyle = "rgba(0, 255, 0, 0.5)";
        ctx.fillRect(
          perfectZoneX,
          indicatorY - indicatorHeight / 2,
          perfectZoneWidth,
          indicatorHeight
        );

        // Current timing position
        const currentX = indicatorX - indicatorWidth / 2 + timingIndicator * indicatorWidth;
        ctx.fillStyle = "#FFFFFF";
        ctx.beginPath();
        ctx.arc(currentX, indicatorY, 8, 0, Math.PI * 2);
        ctx.fill();

        // Center line (yellow stripe - home run zone)
        ctx.strokeStyle = "#FFFF00";
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(indicatorX, indicatorY - indicatorHeight / 2);
        ctx.lineTo(indicatorX, indicatorY + indicatorHeight / 2);
        ctx.stroke();
      }

      // Draw trajectory
      if (gameState === "ball-in-flight" && ballTrajectory.length > 0) {
        ctx.strokeStyle = "rgba(255, 255, 255, 0.5)";
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 0; i < ballTrajectory.length; i++) {
          const pos = ballTrajectory[i];
          if (i === 0) {
            ctx.moveTo(pos.x, pos.y);
          } else {
            ctx.lineTo(pos.x, pos.y);
          }
        }
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw result text
      if (gameState === "result" || gameState === "ball-in-flight") {
        ctx.fillStyle = "#FFFFFF";
        ctx.font = "bold 32px Arial";
        ctx.textAlign = "center";
        ctx.fillText(`Distance: ${hitDistance} ft`, W / 2, 100);
        if (hitDistance === 0) {
          ctx.fillText("Miss!", W / 2, 140);
        } else if (isHomeRun) {
          ctx.fillStyle = "#FFD700";
          ctx.fillText("HOME RUN! ⚾", W / 2, 140);
        } else if (hitDistance > 300) {
          ctx.fillText("Great Hit!", W / 2, 140);
        } else if (hitDistance > 200) {
          ctx.fillText("Good Hit!", W / 2, 140);
        } else {
          ctx.fillText("Nice Try!", W / 2, 140);
        }
      }
    };

    const animate = () => {
      draw();
      animationFrameRef.current = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      if (animationFrameRef.current) {
        cancelAnimationFrame(animationFrameRef.current);
      }
    };
  }, [
    gameState,
    ballPosition,
    ballTrajectory,
    timingIndicator,
    pitchStartTime,
    pitchDuration,
    hitDistance,
    baseRunners,
    isHomeRun,
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-400 to-green-600 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Title with SVG */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <svg width="200" height="60" className="flex-shrink-0">
              <defs>
                <linearGradient id="titleGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                  <stop offset="0%" stopColor="#FFB6C1" />
                  <stop offset="50%" stopColor="#FF69B4" />
                  <stop offset="100%" stopColor="#FF1493" />
                </linearGradient>
              </defs>
              <text
                x="10"
                y="40"
                fontSize="36"
                fontWeight="bold"
                fill="url(#titleGradient)"
                fontFamily="Arial, sans-serif"
              >
                ⚾ Axolotl Baseball
              </text>
            </svg>
          </div>
          <button
            onClick={onBack}
            className="px-4 py-2 bg-white/20 hover:bg-white/30 backdrop-blur-sm text-white rounded-xl shadow-lg font-semibold transition-all hover:scale-105 border-2 border-white/30"
          >
            ← Back to Home
          </button>
        </div>

        {/* Score Display */}
        <div className="mb-4 bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex justify-between items-center">
            <div>
              <div className="text-2xl font-bold text-gray-800">Score: {score}</div>
              <div className="text-lg text-gray-600">Best: {bestScore}</div>
            </div>
            <div className="text-sm text-gray-600">
              {gameState === "waiting" && "Click 'Start Pitch' or press Space to begin"}
              {gameState === "pitching" && "Press Space or Click to swing!"}
              {gameState === "swinging" && "Swinging..."}
              {gameState === "ball-in-flight" && "Ball in flight!"}
              {gameState === "result" && "Waiting for next pitch..."}
            </div>
          </div>
        </div>

        {/* Game Canvas */}
        <div className="bg-white/10 backdrop-blur-sm rounded-xl p-4 shadow-lg mb-4">
          <canvas
            ref={canvasRef}
            onClick={handleSwing}
            className="w-full rounded-lg border-2 border-white/30 cursor-pointer"
            style={{ maxWidth: "800px", height: "600px", display: "block", margin: "0 auto" }}
          />
        </div>

        {/* Controls */}
        <div className="bg-white/90 backdrop-blur-sm rounded-xl p-4 shadow-lg">
          <div className="flex gap-4 justify-center">
            {gameState === "waiting" && (
              <button
                onClick={startPitch}
                className="px-6 py-3 bg-green-500 hover:bg-green-600 text-white rounded-xl shadow-lg font-semibold transition-all hover:scale-105"
              >
                Start Pitch
              </button>
            )}
            {(gameState === "result" || gameState === "ball-in-flight") && (
              <button
                onClick={() => {
                  setGameState("waiting");
                  setBallTrajectory([]);
                  setHitDistance(0);
                  setBaseRunners([]);
                  runnerAnimationStartRef.current = 0;
                }}
                className="px-6 py-3 bg-blue-500 hover:bg-blue-600 text-white rounded-xl shadow-lg font-semibold transition-all hover:scale-105"
              >
                Next Pitch
              </button>
            )}
          </div>
          <div className="mt-4 text-center text-sm text-gray-700">
            <p>Press <kbd className="px-2 py-1 bg-gray-200 rounded">Space</kbd> or click the canvas to swing</p>
            <p className="mt-2">Hit the <span className="font-bold text-yellow-500">yellow stripe</span> for a HOME RUN!</p>
            <p className="mt-1 text-xs text-gray-600">Timing is now more challenging - precision matters!</p>
          </div>
        </div>
      </div>
    </div>
  );
}

