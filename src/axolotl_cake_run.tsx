import React, { useEffect, useRef, useState, useCallback } from 'react';

// TypeScript interfaces for game entities
interface Platform {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
}

interface Entity {
  type: 'cake' | 'pepper' | 'cone';
  parent: Platform | null;
  ox: number;
  oy: number;
  w: number;
  h: number;
}

interface Player {
  x: number;
  y: number;
  vy: number;
  w: number;
  h: number;
  img: HTMLImageElement;
  animTime: number;
}

interface GameImages {
  cake: HTMLImageElement;
  pepper: HTMLImageElement;
  cone: HTMLImageElement;
}

interface AxolotlCakeRunProps {
  onBack: () => void;
}

const AxolotlCakeRun: React.FC<AxolotlCakeRunProps> = ({ onBack }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [score, setScore] = useState(0);
  const [best, setBest] = useState(0);
  const gameRef = useRef<{
    platforms: Platform[];
    entities: Entity[];
    player: Player;
    images: GameImages;
    spawnCursor: number;
    lastTime: number;
    animationId: number | null;
  } | null>(null);

  // Game constants
  const W = 960;
  const H = 540;
  const gravity = 2200;
  const groundY = H - 90;
  const scrollSpeed = 260;
  const jumpImpulse = 760;

  // Helper functions
  const aabb = (a: { x: number; y: number; w: number; h: number }, b: { x: number; y: number; w: number; h: number }) => {
    return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
  };

  const worldX = (e: Entity) => e.parent ? e.parent.x + e.ox : e.x;
  const worldY = (e: Entity) => e.parent ? e.parent.y + e.oy : e.y;

  // Drawing functions
  const drawGround = useCallback((ctx: CanvasRenderingContext2D) => {
    ctx.fillStyle = '#8b1a1a';
    ctx.fillRect(0, groundY + 18, W, H - (groundY + 18));
    const spikeH = 40, spikeW = 22;
    for (let x = 0; x < W + spikeW; x += spikeW) {
      ctx.fillStyle = '#d00';
      ctx.beginPath();
      ctx.moveTo(x, groundY + 18);
      ctx.lineTo(x + spikeW / 2, groundY + 18 - spikeH);
      ctx.lineTo(x + spikeW, groundY + 18);
      ctx.closePath();
      ctx.fill();
      ctx.fillStyle = '#f55';
      ctx.beginPath();
      ctx.moveTo(x + spikeW / 2, groundY + 18 - spikeH + 6);
      ctx.lineTo(x + spikeW * 0.75, groundY + 18 - spikeH / 2);
      ctx.lineTo(x + spikeW / 2, groundY + 18 - spikeH + 6);
      ctx.closePath();
      ctx.fill();
    }
  }, [groundY, W, H]);

  const drawPlayer = useCallback((ctx: CanvasRenderingContext2D, player: Player, dt: number) => {
    player.animTime += dt;
    const bob = Math.sin(player.animTime * 10) * 4;
    const px = player.x - player.w / 2, py = player.y - player.h / 2 + bob;
    if (player.img.complete && player.img.naturalWidth) {
      ctx.drawImage(player.img, px, py, player.w, player.h);
    } else {
      ctx.fillStyle = '#f8b4c0';
      ctx.beginPath();
      ctx.ellipse(player.x, player.y, player.w / 2, player.h / 2, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }, []);

  const drawPlatform = useCallback((ctx: CanvasRenderingContext2D, p: Platform) => {
    ctx.fillStyle = '#3a5f2f';
    ctx.fillRect(p.x, p.y, p.w, p.h);
    ctx.fillStyle = '#6fb657';
    ctx.fillRect(p.x, p.y - 8, p.w, 8);
  }, []);

  const drawEntity = useCallback((ctx: CanvasRenderingContext2D, e: Entity, images: GameImages) => {
    const x = worldX(e), y = worldY(e);
    const img = images[e.type];
    if (img && img.complete && img.naturalWidth) {
      ctx.drawImage(img, x - e.w / 2, y - e.h / 2, e.w, e.h);
    } else {
      ctx.fillStyle = e.type === 'cake' ? '#c98' : e.type === 'pepper' ? '#e11' : '#f6c90e';
      ctx.fillRect(x - e.w / 2, y - e.h / 2, e.w, e.h);
    }
  }, []);

  // Game logic functions
  const makePlatform = useCallback((x: number, platforms: Platform[], entities: Entity[]) => {
    const w = 160 + Math.random() * 220;
    const y = H - (150 + Math.random() * 140);
    const h = 16;
    const plat: Platform = { x, y, w, h, vx: -scrollSpeed };
    platforms.push(plat);

    const cols = 1 + Math.floor(Math.random() * 3);
    for (let c = 0; c < cols; c++) {
      const offset = 20 + Math.random() * (w - 40);
      const stack = 1 + (Math.random() < 0.35 ? Math.floor(Math.random() * 2) + 1 : 0);
      for (let s = 0; s < stack; s++) {
        const typeRoll = Math.random();
        let type: 'cake' | 'pepper' | 'cone' = 'cake';
        if (typeRoll < 0.18) type = 'pepper';
        if (typeRoll > 0.96) type = 'cone';
        entities.push({ type, parent: plat, ox: offset, oy: -26 - s * 30, w: 40, h: 40 });
      }
    }
    return plat;
  }, [H, scrollSpeed]);

  const resetGame = useCallback((reason: string = 'unknown') => {
    if (!gameRef.current) return;
    
    // Only log in development mode
    if (import.meta.env.DEV) {
      console.log('Game reset triggered:', reason, {
        playerY: gameRef.current.player.y,
        playerVy: gameRef.current.player.vy,
        platformsCount: gameRef.current.platforms.length
      });
    }
    
    const { platforms, entities, player, spawnCursor } = gameRef.current;
    setScore(0);
    entities.length = 0;
    platforms.length = 0;
    player.x = 150;
    player.vy = 0;

    let x = 120;
    const rows = 4 + Math.floor(Math.random() * 2);
    let firstPlat: Platform | null = null, lastPlat: Platform | null = null;
    for (let i = 0; i < rows; i++) {
      const p = makePlatform(x, platforms, entities);
      if (!firstPlat) firstPlat = p;
      lastPlat = p;
      // Reduce gap between platforms to prevent impossible jumps
      x += 120 + Math.random() * 120; // Reduced from 160 + Math.random() * 200
    }
    if (firstPlat) {
      player.y = firstPlat.y - player.h / 2 - 2;
    }
    if (lastPlat) {
      gameRef.current.spawnCursor = lastPlat.x + lastPlat.w + 140;
    }
  }, [makePlatform]);

  const jump = useCallback(() => {
    if (gameRef.current) {
      gameRef.current.player.vy = -jumpImpulse;
    }
  }, [jumpImpulse]);

  // Game loop
  const gameLoop = useCallback((now: number) => {
    if (!gameRef.current || !canvasRef.current) {
      console.log('Game loop stopped: missing gameRef or canvas');
      return;
    }

    const { platforms, entities, player, images, spawnCursor } = gameRef.current;
    const ctx = canvasRef.current.getContext('2d');
    if (!ctx) {
      console.log('Game loop stopped: missing canvas context');
      return;
    }

    const dt = (now - gameRef.current.lastTime) / 1000;
    gameRef.current.lastTime = now;

    // Physics
    player.vy += gravity * dt;
    player.y += player.vy * dt;

    // Move platforms left & cull
    for (let i = platforms.length - 1; i >= 0; i--) {
      const p = platforms[i];
      p.x += p.vx * dt;
      if (p.x + p.w < -120) platforms.splice(i, 1);
    }

    // Advance spawn cursor
    gameRef.current.spawnCursor -= scrollSpeed * dt;
    while (gameRef.current.spawnCursor < W + 300) {
      const p = makePlatform(W + 300, platforms, entities);
      // Ensure consistent spacing for continuous platforms
      gameRef.current.spawnCursor = p.x + p.w + (100 + Math.random() * 100);
    }

    // Platform collision - check BEFORE death condition
    const feet = { x: player.x - 18, y: player.y + player.h / 2 - 4, w: 36, h: 8 };
    let onPlatform = false;
    for (const p of platforms) {
      const topBox = { x: p.x, y: p.y - 8, w: p.w, h: 12 };
      // Check collision regardless of velocity direction, but only land when falling
      if (aabb(feet, topBox)) {
        if (player.vy > 0) {
          // Landing on platform
          player.y = p.y - player.h / 2;
          player.vy = 0;
        }
        onPlatform = true;
        break;
      }
    }

    // Touching ground = death (only if not on a platform)
    // Add small safety margin to prevent edge case deaths
    if (!onPlatform && player.y > groundY - player.h / 2 + 5) {
      if (import.meta.env.DEV) {
        console.log('Player died:', { 
          playerY: player.y, 
          groundY: groundY, 
          onPlatform, 
          platformsCount: platforms.length,
          playerVy: player.vy 
        });
      }
      resetGame('player_death');
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
      return;
    }

    // Entity collisions
    for (let i = entities.length - 1; i >= 0; i--) {
      const e = entities[i];
      if (e.parent && e.parent.x + e.parent.w < -120) {
        entities.splice(i, 1);
        continue;
      }
      const ex = worldX(e), ey = worldY(e);
      const eBox = { x: ex - e.w / 2, y: ey - e.h / 2, w: e.w, h: e.h };
      const hitbox = { x: player.x - 28, y: player.y - 28, w: 56, h: 56 };
      if (aabb(hitbox, eBox)) {
        if (e.type === 'pepper') {
          setScore(prev => Math.max(0, prev - 50));
        } else if (e.type === 'cone') {
          setScore(prev => prev + 100);
        } else if (e.type === 'cake') {
          setScore(prev => prev + 10);
        }
        entities.splice(i, 1);
      }
    }

    // Draw
    ctx.clearRect(0, 0, W, H);
    drawGround(ctx);
    for (const p of platforms) drawPlatform(ctx, p);
    for (const e of entities) drawEntity(ctx, e, images);
    drawPlayer(ctx, player, dt);

    // Score trickle & best
    setScore(prev => {
      const newScore = prev + dt * 2;
      const floorScore = Math.floor(newScore);
      const currentBest = parseInt(localStorage.getItem('ax_best') || '0', 10);
      if (floorScore > currentBest) {
        setBest(floorScore);
        localStorage.setItem('ax_best', floorScore.toString());
      }
      return newScore;
    });

    gameRef.current.animationId = requestAnimationFrame(gameLoop);
  }, [gravity, groundY, scrollSpeed, makePlatform, resetGame, drawGround, drawPlatform, drawEntity, drawPlayer]);

  // Initialize game
  useEffect(() => {
    console.log('AxolotlCakeRun component mounted');
    
    // Prevent re-initialization if game is already running
    if (gameRef.current?.animationId) {
      console.log('Game already running, skipping re-initialization');
      return;
    }
    
    const canvas = canvasRef.current;
    if (!canvas) {
      console.log('Canvas not found during initialization');
      return;
    }

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Initialize images
    const playerImg = new Image();
    playerImg.src = '/img/axolotl.png';

    const images: GameImages = {
      cake: new Image(),
      pepper: new Image(),
      cone: new Image()
    };
    images.cake.src = '/img/cake.png';
    images.pepper.src = '/img/pepper.png';
    images.cone.src = '/img/cone.png';

    // Initialize player
    const player: Player = {
      x: 150,
      y: H * 0.4,
      vy: 0,
      w: 96,
      h: 96,
      img: playerImg,
      animTime: 0
    };

    // Initialize game state
    gameRef.current = {
      platforms: [],
      entities: [],
      player,
      images,
      spawnCursor: W + 300,
      lastTime: performance.now(),
      animationId: null
    };

    // Load best score
    const savedBest = localStorage.getItem('ax_best');
    if (savedBest) {
      setBest(parseInt(savedBest, 10));
    }

    // Start game
    resetGame('game_start');
    if (!gameRef.current.animationId) {
      gameRef.current.animationId = requestAnimationFrame(gameLoop);
    }

    // Event listeners
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        jump();
      }
    };

    const handleMouseDown = () => jump();
    const handleTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      jump();
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleMouseDown);
    window.addEventListener('touchstart', handleTouchStart, { passive: false });

    return () => {
      console.log('AxolotlCakeRun component cleanup');
      // Only cleanup if we're actually unmounting (not just re-rendering)
      if (gameRef.current?.animationId) {
        console.log('Cancelling animation frame:', gameRef.current.animationId);
        cancelAnimationFrame(gameRef.current.animationId);
        gameRef.current.animationId = null;
      }
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleMouseDown);
      window.removeEventListener('touchstart', handleTouchStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // Only run once on mount

  return (
    <div>
      <style>{`
        html, body { 
          height: 100%; 
          margin: 0; 
          font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif; 
          background: #0ea5e9; 
        }
        .wrap { 
          display: grid; 
          place-items: center; 
          height: 100vh; 
        }
        canvas { 
          background: linear-gradient(#8dd8ff, #aee6ff 70%, #7cc96b 70%); 
          box-shadow: 0 10px 30px rgba(0,0,0,.15); 
          border-radius: 16px; 
          image-rendering: crisp-edges; 
        }
        .hud { 
          position: fixed; 
          inset: 66px auto auto 16px; 
          background: rgba(255,255,255,.85); 
          padding: 10px 14px; 
          border-radius: 12px; 
          box-shadow: 0 6px 20px rgba(0,0,0,.12); 
        }
        .hud b { 
          font-weight: 800; 
        }
        .hint { 
          position: fixed; 
          right: 16px; 
          top: 16px; 
          background: rgba(0,0,0,.6); 
          color: #fff; 
          padding: 10px 12px; 
          border-radius: 10px; 
          font-size: 13px; 
        }
        .back-button {
          position: fixed;
          top: 16px;
          left: 16px;
          background: rgba(255,255,255,.85);
          border: none;
          padding: 10px 14px;
          border-radius: 12px;
          cursor: pointer;
          font-size: 14px;
          font-weight: 600;
          box-shadow: 0 6px 20px rgba(0,0,0,.12);
          z-index: 10;
        }
        .back-button:hover {
          background: rgba(255,255,255,.95);
        }
      `}</style>
      <button className="back-button" onClick={onBack}>
        ← Back to Home
      </button>
      <div className="wrap">
        <canvas ref={canvasRef} width={W} height={H} />
      </div>
      <div className="hud">
        Score: <b>{Math.floor(score)}</b> &nbsp;|&nbsp; Best: <b>{best}</b>
      </div>
      <div className="hint">
        Jump between platforms • Touching the red spike ground = instant death • Avoid 🌶️ • Grab 🍰 and rare golden 🍦 (10×)
      </div>
    </div>
  );
};

export default AxolotlCakeRun;
