class GameGallery {
  constructor() {
    this.g = [];
    this.b = [];
    this.d = new Set(["OLD"]);
    this.s = document.getElementById("searchInput");
    this.f = document.getElementById("badgeFilter");
    this.init();
  }

  async init() {
    const res = await fetch("data.json"),
      sources = await res.json();
    await Promise.all(
      sources.map(async (src) => {
        this.b.push(src);
        const data = await (await fetch(`data/${src.location}.json`)).json();
        const parse = (s, grp, gm) => {
          let r = s
            .replace(/group\.path/g, grp.path || "")
            .replace(/group\.image/g, grp.image || "")
            .replace(/game\[(\d+)\]/g, (_, i) => gm[i] || "");
          r = r.replace(
            /\((.*?)\|\|(.*?)\)/g,
            (_, a, b) => a.trim() || b.trim(),
          );
          return r.replace(/['"+\s]/g, "").replace(/[,;]$/, "");
        };
        data.forEach((grp) =>
          (grp.games || []).forEach((gm) =>
            this.g.push({
              t: gm[0],
              u: parse(src.url, grp, gm),
              i: parse(src.img, grp, gm),
              type: src.name,
            }),
          ),
        );
      }),
    );

    // dedupe by normalized title (lowercase, remove spaces & non-alphanumerics)
    const seen = new Set();
    this.g = this.g.filter((item) => {
      const k = (item.t || "")
        .toLowerCase()
        .replace(/\s+/g, "")
        .replace(/[^a-z0-9]/g, "");
      if (!k || seen.has(k)) return false;
      seen.add(k);
      return true;
    });

    this.g.sort((a, b) => a.t.localeCompare(b.t));
    this.colors = Object.fromEntries(this.b.map((b) => [b.name, b.color]));

    if (this.f)
      this.f.innerHTML = this.b
        .map(
          (b) =>
            `<span class="badge b-i" data-t="${b.name}" style="background:${b.color}">${b.name}</span>`,
        )
        .join("");
    if (this.s) this.s.oninput = () => this.r();
    if (this.f)
      this.f.onclick = (e) => {
        const t = e.target.dataset.t;
        if (t) {
          this.d.has(t) ? this.d.delete(t) : this.d.add(t);
          this.u();
        }
      };

    const all = document.getElementById("badgeFilterAll");
    if (all)
      all.onclick = () => {
        const others = this.b.filter((b) => b.name !== "OLD"),
          anyOn = others.some((b) => !this.d.has(b.name));
        others.forEach((b) =>
          anyOn ? this.d.add(b.name) : this.d.delete(b.name),
        );
        this.u();
      };

    this.u();
    window.onresize = () => this.r();
  }

  u() {
    document
      .querySelectorAll(".b-i")
      .forEach((el) =>
        el.classList.toggle("disabled", this.d.has(el.dataset.t)),
      );
    this.r();
  }

  r() {
    const q = this.s?.value.toLowerCase() || "",
      f = this.g.filter(
        (g) => (!q || g.t.toLowerCase().includes(q)) && !this.d.has(g.type),
      );
    const w = 200,
      gap = 20;
    const cols = Math.max(Math.floor((window.innerWidth - 40) / (w + gap)), 1);
    const rows = [];
    for (let i = 0; i < f.length; i += cols) {
      rows.push(
        `<div class="game-row" style="display:grid;grid-template-columns:repeat(${cols},${w}px);gap:${gap}px;justify-content:center;margin-bottom:${gap}px">${f
          .slice(i, i + cols)
          .map(
            (g) => `
        <a href="${g.u}" class="game-card" style="width:${w}px" target="_blank">
          <span class="badge" style="background:${this.colors[g.type]}">${g.type}</span>
          <img src="${g.i}" loading="lazy" onerror="this.style.display='none'">
          <div class="title">${g.t}</div>
        </a>`,
          )
          .join("")}</div>`,
      );
    }
    if (this.c) this.c.destroy(true);
    this.c = new Clusterize({
      rows,
      scrollId: "scrollArea",
      contentId: "contentArea",
      tag: "div",
    });
  }
}
new GameGallery();

async function checkMessage() {
  try {
    const response = await fetch("/api/sigmiliarity/e/TEST");

    if (!response.ok) {
      throw new Error("Network response was not ok");
    }

    const data = await response.text();

    if (data.trim() === "working") {
      console.log("working");
      document.getElementById("message").style.display = "none";
    } else {
      console.error("error");
    }
  } catch (err) {
    console.error("error", err);
  }
}

checkMessage();
