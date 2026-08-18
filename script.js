class GameGallery {
  constructor() {
    this.g = []; // Games list
    this.b = []; // Badges/Sources list
    this.d = new Set(["UNTESTED", ""]); // Disabled filters
    this.s = document.getElementById("searchInput");
    this.f = document.getElementById("badgeFilter");
    this.expandedGroups = new Set(); // Tracks open/expanded group IDs
    this.init();
  }

  async init() {
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
      
      const parse = (s, grp, gm) => s
        .replace(/group\.path/g, grp.path || "").replace(/group\.image/g, grp.image || "")
        .replace(/game\[(\d+)\]/g, (_, i) => gm[i] || "")
        .replace(/\((.*?)\|\|(.*?)\)/g, (_, a, b) => a.trim() || b.trim())
        .replace(/['"+\s]/g, "").replace(/[,;]$/, "");

      data.forEach(item => {
        if (item.games && !item.name) {
          item.games.forEach(gm => this.g.push({
            t: gm[0], u: parse(src.url, item, gm), i: parse(src.img, item, gm), type: src.name, isGroup: false
          }));
        }

        if (item.groups) {
          item.groups.forEach((grp, gIdx) => {
            const groupName = grp.name ? grp.name.trim() : `Group ${gIdx}`;
            const groupId = `${src.name}_grp_${gIdx}_${groupName}`;
            
            const groupGames = (grp.games || []).map(gm => ({
              t: gm[0],
              u: parse(src.url, grp, gm),
              i: parse(src.img, grp, gm),
              type: src.name,
              isSubGame: true
            }));

            this.g.push({
              id: groupId,
              t: groupName,
              i: grp.img || parse(src.img, grp, []),
              type: src.name,
              isGroup: true,
              games: groupGames
            });
          });
        }
      });
    }));

    // Deduplicate top-level items and sort: Golden games -> Groups -> Standard games -> Alphabetical
    const seen = new Set();
    this.g = this.g.filter(x => {
      const k = x.t?.toLowerCase().replace(/[^a-z0-9]/g, "");
      return k && !seen.has(k) && seen.add(k);
    }).sort((a, b) => {
      const aIsGolden = !a.isGroup && a.t.startsWith(' ');
      const bIsGolden = !b.isGroup && b.t.startsWith(' ');

      if (aIsGolden && !bIsGolden) return -1;
      if (!aIsGolden && bIsGolden) return 1;
      if (a.isGroup && !b.isGroup) return -1;
      if (!a.isGroup && b.isGroup) return 1;
      
      return a.t.localeCompare(b.t);
    });

    if (this.f) this.f.innerHTML = this.b.map(b => 
      `<span class="badge b-i" data-t="${b.name}">${b.name}</span>`
    ).join("");
    
    this.s?.addEventListener("input", () => this.r());
    
    this.f?.addEventListener("click", (e) => {
      const t = e.target.dataset.t;
      if (t) { this.d.has(t) ? this.d.delete(t) : this.d.add(t); this.u(); }
    });

    window.onresize = () => this.r();
    this.u();
  }

  u() {
    document.querySelectorAll(".b-i").forEach(el => 
      el.classList.toggle("disabled", this.d.has(el.dataset.t))
    );
    this.r();
  }

  r() {
    const q = this.s?.value.toLowerCase() || "";
    const filtered = [];
    
    this.g.forEach(item => {
      if (this.d.has(item.type)) return;

      if (item.isGroup) {
        const groupMatches = !q || item.t.toLowerCase().includes(q);
        const matchingSubGames = item.games.filter(sub => !q || sub.t.toLowerCase().includes(q));

        if (groupMatches || matchingSubGames.length > 0) {
          filtered.push({
            ...item,
            games: groupMatches ? item.games : matchingSubGames
          });
        }
      } else if (!q || item.t.toLowerCase().includes(q)) {
        filtered.push(item);
      }
    });
    
    const renderList = [];
    filtered.forEach(item => {
      renderList.push(item);
      const shouldExpand = (q && q.trim().length > 0) || this.expandedGroups.has(item.id);
      if (item.isGroup && shouldExpand) {
        item.games.forEach(subGame => renderList.push({ ...subGame, parentId: item.id }));
      }
    });

    const w = 180, gap = 15;
    const cols = Math.max(Math.floor((window.innerWidth - 20) / (w + gap)), 1);
    const rows = [];

    for (let i = 0; i < renderList.length; i += cols) {
      rows.push(`<div class="game-row" style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px;justify-content:center;margin-bottom:${gap}px">
        ${renderList.slice(i, i + cols).map(g => {
          if (g.isGroup) {
            const isExpanded = (q && q.trim().length > 0) || this.expandedGroups.has(g.id);
            return `
              <div class="game-card group-card ${isExpanded ? 'expanded' : ''}" data-group-id="${g.id}" style="width:${w}px; cursor:pointer;">
                <span style="${g.type == "DEFAULT" ? "display:none" : ""}" class="badge">${g.type}</span>
                <img src="${g.i}" loading="lazy" onerror="this.style.display='none'">
                <div class="title">📁 ${g.t} (${g.games.length})</div>
              </div>`;
          } else {
            return `
              <a href="${g.u}" class="game-card${g.t.startsWith(' ') ? ' official-game' : ''}${g.isSubGame ? ' sub-game-card' : ''}" style="width:${w}px" target="_blank">
                <span style="${g.type == "DEFAULT" ? "display:none" : ""}" class="badge">${g.type}</span>
                <img src="${g.i}" loading="lazy" onerror="this.style.display='none'">
                <div class="title">${g.t}</div>
              </a>`;
          }
        }).join("")}
      </div>`);
    }

    const scrollArea = document.getElementById("scrollArea");
    const currentScrollTop = scrollArea ? scrollArea.scrollTop : 0;

    if (this.c) this.c.destroy(true);
    this.c = new Clusterize({ rows, scrollId: "scrollArea", contentId: "contentArea", tag: "div" });

    if (scrollArea) scrollArea.scrollTop = currentScrollTop;
  }
}

// Global delegated event listener for container content clicks
document.getElementById("contentArea")?.addEventListener("click", (e) => {
  const groupCard = e.target.closest(".group-card");
  if (groupCard) {
    const groupId = groupCard.dataset.groupId;
    if (window.gameGalleryInstance) {
      if (window.gameGalleryInstance.expandedGroups.has(groupId)) {
        window.gameGalleryInstance.expandedGroups.delete(groupId);
      } else {
        window.gameGalleryInstance.expandedGroups.add(groupId);
      }
      window.gameGalleryInstance.r();
    }
    return;
  }

  const gameCard = e.target.closest(".game-card:not(.group-card)");
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

window.gameGalleryInstance = new GameGallery();

// Modal functionality
const newsBtn = document.getElementById("newsBtn");
const newsModal = document.getElementById("newsModal");
const closeModal = document.getElementById("closeModal");
const tabBtns = document.querySelectorAll(".tab-btn");
const updateBadge = document.getElementById("updateBadge");

async function loadInfo() {
  try {
    const res = await fetch("info.json");
    const info = await res.json();
    
    const savedVersion = localStorage.getItem("appVersion");
    if (savedVersion && savedVersion !== info.version) {
      updateBadge.style.display = "inline";
    }
    localStorage.setItem("appVersion", info.version);
    
    const changelogContent = document.getElementById("changelogContent");
    changelogContent.innerHTML = info.changelog.map(entry => `
      <div style="margin-bottom: 16px;">
        <strong style="color: var(--primary);">v${entry.version}</strong> <span style="color: var(--muted-text);">${entry.date}</span>
        <ul style="margin: 8px 0; padding-left: 20px;">
          ${entry.changes.map(change => `<li>${change}</li>`).join("")}
        </ul>
      </div>
    `).join("");
    
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
  newsModal.classList.add("active");
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