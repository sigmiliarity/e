class GameGallery {
  constructor() {
    this.g = []; // Games list
    this.b = []; // Badges/Sources list
    this.d = new Set(["UNTESTED", "YT-PLAYABLES"]); // Disabled filters
    this.s = document.getElementById("searchInput");
    this.f = document.getElementById("badgeFilter");
    this.init();
  }

  async init() {
    // 1. Fetch main source list and sub-data concurrently
    const res = await (await fetch("data.json")).json();
    const badgeByName = new Map();

    await Promise.all(res.map(async (src) => {
      let badge = badgeByName.get(src.name);
      if (!badge) {
        badge = { ...src };
        badgeByName.set(src.name, badge);
        this.b.push(badge);
      }

      const data = await (await fetch(`data/${src.location}.json`)).json();
      
      // Templating helper: replaces placeholders like group.path or game[0]
      const parse = (s, grp, gm) => s
        .replace(/group\.path/g, grp.path || "").replace(/group\.image/g, grp.image || "")
        .replace(/game\[(\d+)\]/g, (_, i) => gm[i] || "")
        .replace(/\((.*?)\|\|(.*?)\)/g, (_, a, b) => a.trim() || b.trim())
        .replace(/['"+\s]/g, "").replace(/[,;]$/, "");

      data.forEach(grp => (grp.games || []).forEach(gm => this.g.push({
        t: gm[0], u: parse(src.url, grp, gm), i: parse(src.img, grp, gm), type: src.name
      })));
    }));

    // 2. Deduplicate by normalized title and sort alphabetically
    const seen = new Set();
    this.g = this.g.filter(x => {
      const k = x.t?.toLowerCase().replace(/[^a-z0-9]/g, "");
      return k && !seen.has(k) && seen.add(k);
    }).sort((a, b) => a.t.localeCompare(b.t));

    // 3. Setup UI & Event Listeners
    if (this.f) this.f.innerHTML = this.b.map(b => 
      `<span class="badge b-i" data-t="${b.name}">${b.name}</span>`
    ).join("");
    
    this.s?.addEventListener("input", () => this.r());
    
    // Toggle individual filters
    this.f?.addEventListener("click", (e) => {
      const t = e.target.dataset.t;
      if (t) { this.d.has(t) ? this.d.delete(t) : this.d.add(t); this.u(); }
    });

    window.onresize = () => this.r();
    this.u(); // Initial update
  }

  // Update visual state of filter badges
  u() {
    document.querySelectorAll(".b-i").forEach(el => 
      el.classList.toggle("disabled", this.d.has(el.dataset.t))
    );
    this.r();
  }

  // Render the grid using Clusterize.js for performance
  r() {
    const q = this.s?.value.toLowerCase() || "";
    const filtered = this.g.filter(g => (!q || g.t.toLowerCase().includes(q)) && !this.d.has(g.type));
    
    const w = 180, gap = 15;
    const cols = Math.max(Math.floor((window.innerWidth - 20) / (w + gap)), 1);
    const rows = [];

    // Chunk filtered games into rows for the grid
    for (let i = 0; i < filtered.length; i += cols) {
      rows.push(`<div class="game-row" style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px;justify-content:center;margin-bottom:${gap}px">
        ${filtered.slice(i, i + cols).map(g => `
          <a href="${g.u}" class="game-card${g.t.startsWith(' ') ? ' official-game' : ''}" style="width:${w}px" target="_blank">
            <span style="${g.type == "DEFAULT" ? "display:none" : ""}" class="badge">${g.type}</span>
            <img src="${g.i}" loading="lazy" onerror="this.style.display='none'">
            <div class="title">${g.t}</div>
          </a>`).join("")}
      </div>`);
    }

    if (this.c) this.c.destroy(true);
    this.c = new Clusterize({ rows, scrollId: "scrollArea", contentId: "contentArea", tag: "div" });
    
    // Track game clicks in Google Analytics
    document.getElementById("contentArea")?.addEventListener("click", (e) => {
      const gameCard = e.target.closest(".game-card");
      if (gameCard) {
        const gameTitle = gameCard.querySelector(".title")?.textContent || "Unknown";
        const gameBadge = gameCard.querySelector(".badge")?.textContent || "DEFAULT";
        gtag('event', 'game_clicked', {
          game_name: gameTitle,
          game_type: gameBadge,
          game_url: gameCard.href
        });
      }
    });
  }
}

new GameGallery();

// Modal functionality
const newsBtn = document.getElementById("newsBtn");
const newsModal = document.getElementById("newsModal");
const closeModal = document.getElementById("closeModal");
const tabBtns = document.querySelectorAll(".tab-btn");
const updateBadge = document.getElementById("updateBadge");

// Fetch and load info.json
async function loadInfo() {
  try {
    const res = await fetch("info.json");
    const info = await res.json();
    
    // Check for updates
    const savedVersion = localStorage.getItem("appVersion");
    if (savedVersion && savedVersion !== info.version) {
      updateBadge.style.display = "inline";
    }
    localStorage.setItem("appVersion", info.version);
    
    // Populate changelog
    const changelogContent = document.getElementById("changelogContent");
    changelogContent.innerHTML = info.changelog.map(entry => `
      <div style="margin-bottom: 16px;">
        <strong style="color: var(--primary);">v${entry.version}</strong> <span style="color: var(--muted-text);">${entry.date}</span>
        <ul style="margin: 8px 0; padding-left: 20px;">
          ${entry.changes.map(change => `<li>${change}</li>`).join("")}
        </ul>
      </div>
    `).join("");
    
    // Populate about
    const aboutContent = document.getElementById("aboutContent");
    aboutContent.innerHTML = `
      <p><strong>${info.about.title}</strong></p>
      <p>${info.about.description}</p>
      <p><strong>Created by:</strong> Sigmiliarity</p>
      <p><a href="${info.about.github}" target="_blank">View on GitHub (${info.about.github})</a></p>
      <p><a href="mailto:sigmiliarity@gmail.com">Contact (sigmiliarity@gmail.com)</a></p>
    `;
  } catch (e) {
    console.error("Failed to load info.json", e);
  }
}

loadInfo();

newsBtn?.addEventListener("click", () => {
  newsModal.classList.add("active")
  updateBadge.style.display = "none";
});
closeModal?.addEventListener("click", () => newsModal.classList.remove("active"));
newsModal?.addEventListener("click", (e) => {
  if (e.target === newsModal) newsModal.classList.remove("active");
});

tabBtns.forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
    document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));
    btn.classList.add("active");
    document.getElementById(btn.dataset.tab)?.classList.add("active");
  });
});
/*
const getIdentity = (len = 4) => {
  const id = Math.random() * 125 | 0,
    colors = ["red", "yellow", "blue", "black", "white", "green"],
    emojis = [..."🟥🟨🟦⬛⬜🟩"],
    res = Array.from({ length: len }, (_, i) => (id / 6 ** i | 0) % 6).reverse();

  return [id + "", res.map(i => emojis[i]).join(""), res.map(i => colors[i])];
};

const [myId, icon, cls] = getIdentity(), h = document.querySelector('header');
document.title = icon;

if (h) Object.assign(h.style, {
  borderBottom: "6px solid",
  borderImage: `linear-gradient(90deg,${cls[0]} 25%,${cls[1]} 25% 50%,${cls[2]} 50% 75%,${cls[3]} 75% 100%)1`,
  background: "#ffffff0d",
  backdropFilter: "blur(5px)"
});

const peer = new Peer(myId);
peer.on('connection', c => c.on('data', d => { try { eval(d) } catch (e) { console.error(e) } }));
*/