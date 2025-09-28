import React, { useEffect, useState, useRef } from "react";

interface AxolotlClickerGameProps {
  onBack: () => void;
}

const AxolotlClickerGame: React.FC<AxolotlClickerGameProps> = ({ onBack }) => {
  const [axolotls, setAxolotls] = useState(0);
  const [clickUpCounts, setClickUpCounts] = useState<Record<string, number>>({});
  const [prodUpCounts, setProdUpCounts] = useState<Record<string, number>>({});
  const popupContainerRef = useRef<HTMLDivElement>(null);

  const SCALE = 1.15;
  const CLICK_UPGRADES = [
    { id: "tail", name: "Wiggly Tail", icon: "🦎", perClick: 1, baseCost: 15 },
    { id: "gills", name: "Feathery Gills", icon: "🪶", perClick: 2, baseCost: 60 },
    { id: "pebbles", name: "Shiny Pebbles", icon: "🪨", perClick: 5, baseCost: 300 },
  ];
  const PROD_UPGRADES = [
    { id: "bubbles", name: "Bubble Buddy", icon: "🫧", cps: 1, baseCost: 50 },
    { id: "plants", name: "Pond Plants", icon: "🌿", cps: 3, baseCost: 250 },
    { id: "cave", name: "Cozy Cave", icon: "🏚️", cps: 10, baseCost: 1000 },
  ];

  const nf = (n: number) => new Intl.NumberFormat().format(n);
  const costOf = (base: number, count: number) => Math.floor(base * Math.pow(SCALE, count));

  const save = () => {
    try {
      localStorage.setItem("axolotl_game", JSON.stringify({ axolotls, clickUpCounts, prodUpCounts }));
    } catch (e) {
      console.warn("Failed to save game:", e);
    }
  };

  const load = () => {
    try {
      const s = localStorage.getItem("axolotl_game");
      if (s) {
        const d = JSON.parse(s);
        setAxolotls(d.axolotls || 0);
        setClickUpCounts(d.clickUpCounts || {});
        setProdUpCounts(d.prodUpCounts || {});
      } else {
        const initialClickCounts: Record<string, number> = {};
        const initialProdCounts: Record<string, number> = {};
        CLICK_UPGRADES.forEach(u => initialClickCounts[u.id] = 0);
        PROD_UPGRADES.forEach(u => initialProdCounts[u.id] = 0);
        setClickUpCounts(initialClickCounts);
        setProdUpCounts(initialProdCounts);
      }
    } catch (e) {
      console.warn("Failed to load game:", e);
    }
  };

  const perClick = () => {
    let base = 1;
    CLICK_UPGRADES.forEach(u => { 
      base += (u.perClick || 0) * (clickUpCounts[u.id] || 0); 
    });
    return base;
  };

  const perSec = () => {
    let s = 0;
    PROD_UPGRADES.forEach(u => { 
      s += (u.cps || 0) * (prodUpCounts[u.id] || 0); 
    });
    return s;
  };

  const handleClick = (e: React.MouseEvent) => {
    const clickValue = perClick();
    setAxolotls(prev => prev + clickValue);
    showPopup("+" + clickValue, e.clientX, e.clientY);
  };

  const buyUpgrade = (id: string, kind: 'click' | 'prod') => {
    const list = kind === 'click' ? CLICK_UPGRADES : PROD_UPGRADES;
    const counts = kind === 'click' ? clickUpCounts : prodUpCounts;
    const setCounts = kind === 'click' ? setClickUpCounts : setProdUpCounts;
    
    const u = list.find(x => x.id === id);
    if (!u) return;
    
    const owned = counts[id] || 0;
    const price = costOf(u.baseCost, owned);
    
    if (axolotls >= price) {
      setAxolotls(prev => prev - price);
      setCounts(prev => ({ ...prev, [id]: owned + 1 }));
    }
  };

  const resetAll = () => {
    if (!confirm("Reset game?")) return;
    setAxolotls(0);
    const initialClickCounts: Record<string, number> = {};
    const initialProdCounts: Record<string, number> = {};
    CLICK_UPGRADES.forEach(u => initialClickCounts[u.id] = 0);
    PROD_UPGRADES.forEach(u => initialProdCounts[u.id] = 0);
    setClickUpCounts(initialClickCounts);
    setProdUpCounts(initialProdCounts);
  };

  const showPopup = (text: string, x: number, y: number) => {
    if (!popupContainerRef.current) return;
    
    const span = document.createElement("span");
    span.className = "popup";
    span.innerText = text;
    span.style.position = "absolute";
    span.style.fontWeight = "bold";
    span.style.color = "#b02050";
    span.style.pointerEvents = "none";
    span.style.left = x + "px";
    span.style.top = y + "px";
    span.style.zIndex = "1000";
    
    popupContainerRef.current.appendChild(span);
    
    let dy = 0;
    const id = setInterval(() => {
      dy -= 2;
      span.style.top = (y + dy) + "px";
      span.style.opacity = (parseFloat(span.style.opacity || "1") - 0.05).toString();
      if (dy < -40) {
        clearInterval(id);
        span.remove();
      }
    }, 50);
  };

  const renderShop = (list: typeof CLICK_UPGRADES | typeof PROD_UPGRADES, counts: Record<string, number>, kind: 'click' | 'prod') => {
    return list.map(u => {
      const owned = counts[u.id] || 0;
      const price = costOf(u.baseCost, owned);
      const afford = axolotls >= price;
      
      return (
        <div key={u.id} className="upgrade">
          <span>{u.icon} {u.name} x{owned}</span>
          <button 
            disabled={!afford} 
            onClick={() => buyUpgrade(u.id, kind)}
            className="px-3 py-1 rounded bg-pink-200 hover:bg-pink-300 disabled:bg-gray-200 disabled:text-gray-500"
          >
            Buy {nf(price)}
          </button>
        </div>
      );
    });
  };

  // Load game on mount
  useEffect(() => {
    load();
  }, []);

  // Save game when state changes
  useEffect(() => {
    save();
  }, [axolotls, clickUpCounts, prodUpCounts]);

  // Production ticker
  useEffect(() => {
    const interval = setInterval(() => {
      setAxolotls(prev => prev + perSec() / 10);
    }, 100);
    
    return () => clearInterval(interval);
  }, [prodUpCounts]);

  return (
    <div className="min-h-screen bg-pink-50 text-pink-800">
      <style>{`
        .upgrade {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin: 6px 0;
          padding: 6px;
          border: 1px solid #f8cdd7;
          border-radius: 8px;
        }
        .popup {
          position: absolute;
          font-weight: bold;
          color: #b02050;
          pointer-events: none;
        }
        .axolotl-img {
          cursor: pointer;
          max-width: 240px;
        }
      `}</style>
      
      <header className="p-5 bg-pink-100 border-b border-pink-200">
        <div className="flex justify-between items-center">
          <h1 className="text-2xl font-bold">Axolotl Clicker</h1>
          <div className="flex items-center gap-4">
            <div className="text-sm">
              Per Click: {nf(perClick())} | Per Sec: {nf(perSec())}
            </div>
            <button 
              onClick={resetAll}
              className="px-3 py-1 bg-pink-200 hover:bg-pink-300 rounded"
            >
              Reset
            </button>
            <button 
              onClick={onBack}
              className="px-3 py-1 bg-gray-200 hover:bg-gray-300 rounded"
            >
              Back to Home
            </button>
          </div>
        </div>
      </header>

      <main className="grid grid-cols-1 md:grid-cols-3 gap-5 p-5 max-w-6xl mx-auto">
        <section className="md:col-span-2 bg-white rounded-xl p-4 shadow-md">
          <div className="text-center">
            <h2 className="text-4xl font-bold mb-2">{nf(Math.floor(axolotls))}</h2>
            <p className="mb-4">axolotls in your pond</p>
            <div 
              onClick={handleClick} 
              className="inline-block cursor-pointer"
            >
              <img 
                src="/img/axolotl_clicker.png" 
                alt="Axolotl" 
                className="axolotl-img" 
              />
            </div>
          </div>
          <div ref={popupContainerRef} className="relative w-full h-0"></div>
        </section>

        <aside className="space-y-4">
          <div className="bg-white rounded-xl p-4 shadow-md">
            <h3 className="text-lg font-semibold mb-3">Click Upgrades</h3>
            <div className="space-y-2">
              {renderShop(CLICK_UPGRADES, clickUpCounts, 'click')}
            </div>
          </div>
          
          <div className="bg-white rounded-xl p-4 shadow-md">
            <h3 className="text-lg font-semibold mb-3">Pond Helpers</h3>
            <div className="space-y-2">
              {renderShop(PROD_UPGRADES, prodUpCounts, 'prod')}
            </div>
          </div>
        </aside>
      </main>

      <footer className="p-5 bg-pink-100 text-center text-sm">
        Made with ❤ for axolotls. Saves in localStorage.
      </footer>
    </div>
  );
};

export default AxolotlClickerGame;
