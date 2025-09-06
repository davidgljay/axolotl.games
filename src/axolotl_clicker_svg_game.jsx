<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Axolotl Clicker</title>
  <style>
    body { font-family: sans-serif; margin: 0; background: #fff0f5; color: #5a2a38; }
    header, footer { padding: 10px 20px; background: #ffe4ec; border-bottom: 1px solid #f7c9d7; }
    header h1 { margin: 0; font-size: 24px; }
    main { display: grid; grid-template-columns: 2fr 1fr; gap: 20px; padding: 20px; max-width: 1000px; margin: auto; }
    section, aside { background: white; border-radius: 12px; padding: 16px; box-shadow: 0 2px 6px rgba(0,0,0,0.1); }
    button { cursor: pointer; border: none; border-radius: 8px; padding: 6px 12px; font-weight: bold; }
    button:disabled { background: #eee; color: #aaa; cursor: not-allowed; }
    .upgrade { display: flex; align-items: center; justify-content: space-between; margin: 6px 0; padding: 6px; border: 1px solid #f8cdd7; border-radius: 8px; }
    .popup { position: absolute; font-weight: bold; color: #b02050; pointer-events: none; }
    .axolotl-img { cursor: pointer; max-width: 240px; }
  </style>
</head>
<body>
  <header>
    <h1>Axolotl Clicker</h1>
    <div id="stats"></div>
    <button onclick="resetAll()">Reset</button>
  </header>

  <main>
    <section>
      <div style="text-align:center;">
        <h2 id="axolotl-count">0</h2>
        <p>axolotls in your pond</p>
        <div onclick="handleClick(event)" style="display:inline-block;">
          <!-- Replaced SVG with local image -->
          <img src="axolotl_click.png" alt="Axolotl" class="axolotl-img" />
        </div>
      </div>
      <div id="popups-container" style="position:relative;width:100%;height:0;"></div>
    </section>

    <aside>
      <h3>Click Upgrades</h3>
      <div id="click-upgrades"></div>
      <h3>Pond Helpers</h3>
      <div id="prod-upgrades"></div>
    </aside>
  </main>

  <footer>
    Made with ❤ for axolotls. Saves in localStorage.
  </footer>

  <script>
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

    let axolotls = 0;
    let clickUpCounts = {};
    let prodUpCounts = {};

    function nf(n) { return new Intl.NumberFormat().format(n); }
    function costOf(base, count) { return Math.floor(base * Math.pow(SCALE, count)); }

    function save() {
      localStorage.setItem("axolotl_game", JSON.stringify({ axolotls, clickUpCounts, prodUpCounts }));
    }
    function load() {
      let s = localStorage.getItem("axolotl_game");
      if(s) {
        let d = JSON.parse(s);
        axolotls = d.axolotls || 0;
        clickUpCounts = d.clickUpCounts || {};
        prodUpCounts = d.prodUpCounts || {};
      } else {
        CLICK_UPGRADES.forEach(u=>clickUpCounts[u.id]=0);
        PROD_UPGRADES.forEach(u=>prodUpCounts[u.id]=0);
      }
    }

    function perClick() {
      let base = 1;
      CLICK_UPGRADES.forEach(u=>{ base += (u.perClick||0)*(clickUpCounts[u.id]||0) });
      return base;
    }
    function perSec() {
      let s=0;
      PROD_UPGRADES.forEach(u=>{ s += (u.cps||0)*(prodUpCounts[u.id]||0) });
      return s;
    }

    function updateUI() {
      document.getElementById("axolotl-count").innerText = nf(Math.floor(axolotls));
      document.getElementById("stats").innerText = `Per Click: ${nf(perClick())} | Per Sec: ${nf(perSec())}`;
      renderShop("click-upgrades", CLICK_UPGRADES, clickUpCounts, "click");
      renderShop("prod-upgrades", PROD_UPGRADES, prodUpCounts, "prod");
      save();
    }

    function renderShop(containerId, list, counts, kind) {
      let container = document.getElementById(containerId);
      container.innerHTML = "";
      list.forEach(u=>{
        let owned = counts[u.id]||0;
        let price = costOf(u.baseCost, owned);
        let afford = axolotls >= price;
        let div = document.createElement("div");
        div.className = "upgrade";
        div.innerHTML = `<span>${u.icon} ${u.name} x${owned}</span>
          <button ${afford?"":"disabled"} onclick="buyUpgrade('${u.id}','${kind}')">Buy ${nf(price)}</button>`;
        container.appendChild(div);
      });
    }

    function handleClick(e) {
      axolotls += perClick();
      showPopup("+"+perClick(), e.clientX, e.clientY);
      updateUI();
    }

    function buyUpgrade(id, kind) {
      let list = kind=="click"?CLICK_UPGRADES:PROD_UPGRADES;
      let counts = kind=="click"?clickUpCounts:prodUpCounts;
      let u = list.find(x=>x.id==id);
      let owned = counts[id]||0;
      let price = costOf(u.baseCost, owned);
      if(axolotls >= price) {
        axolotls -= price;
        counts[id] = owned+1;
        updateUI();
      }
    }

    function tick() {
      axolotls += perSec()/10;
      updateUI();
    }

    function resetAll() {
      if(!confirm("Reset game?")) return;
      axolotls = 0; clickUpCounts={}; prodUpCounts={};
      CLICK_UPGRADES.forEach(u=>clickUpCounts[u.id]=0);
      PROD_UPGRADES.forEach(u=>prodUpCounts[u.id]=0);
      updateUI();
    }

    function showPopup(text, x, y) {
      let span = document.createElement("span");
      span.className = "popup";
      span.innerText = text;
      span.style.left = x+"px";
      span.style.top = y+"px";
      document.body.appendChild(span);
      let dy = 0;
      let id = setInterval(()=>{
        dy-=2; span.style.top = (y+dy)+"px"; span.style.opacity = (parseInt(span.style.opacity||"1")-0.05);
        if(dy<-40) { clearInterval(id); span.remove(); }
      }, 50);
    }

    load();
    updateUI();
    setInterval(tick, 100);
  </script>
</body>
</html>
