/**
 * Game Gallery Manager
 * Handles data fetching, badge filtering, and performant list rendering.
 */
class GameGallery {
  constructor() {
    this.config = {
      cardWidthWithGap: 184 + 24,
      dataUrl: "/data.json",
    };

    this.state = {
      games: [],
      badgeBackgrounds: [], // Array of { name, color, section }
      disabledBadges: new Set(),
      clusterize: null,
      searchInput: document.getElementById("searchInput"),
      badgeFilterContainer: document.getElementById("badgeFilter"),
    };

    this.init();
  }

  async init() {
    try {
      await this.loadAllData();
      this.setupEventListeners();
      this.applyInitialFilters();
      this.refreshUI();

      // Set initial navbar state
      this.updateNavbarActiveState();
    } catch (error) {
      console.error("Initialization failed:", error);
    }
  }

  /**
   * Data Loading & Processing
   */
  async loadAllData() {
    const response = await fetch(this.config.dataUrl);
    if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);

    const sources = await response.json();

    // Fetch all sources in parallel
    await Promise.all(sources.map((src) => this.fetchSource(src)));

    this.processGames();
    this.renderBadgeFilters();
  }

  async fetchSource({ location, handler, groups, name: sectionName }) {
    // Store badge styles
    groups.forEach(([name, color, section]) => {
      this.state.badgeBackgrounds.push({ name, color, section });
    });

    try {
      const response = await fetch(`data/${location}`, { cache: "no-store" });
      const groupsData = await response.json();

      // Dynamic transformer from JSON string
      const transformer = new Function("game", "group", "i", "j", handler);

      groupsData.forEach((group, i) => {
        group.games.forEach((game, j) => {
          const gameInfo = transformer(game, group, i, j);
          gameInfo.index = this.state.games.length;
          gameInfo.section = sectionName;
          this.state.games.push(gameInfo);
        });
      });
    } catch (error) {
      console.error(`Error loading source ${location}:`, error);
    }
  }

  processGames() {
    // Unique by title and Sort alphabetically
    const uniqueMap = new Map();
    this.state.games.forEach((g) => {
      const key = g.title.toLowerCase();
      if (!uniqueMap.has(key)) uniqueMap.set(key, g);
    });

    this.state.games = Array.from(uniqueMap.values()).sort((a, b) =>
      (a.title || "").localeCompare(b.title || ""),
    );
  }

  /**
   * UI Rendering
   */
  renderBadgeFilters() {
    const { badgeBackgrounds, badgeFilterContainer } = this.state;

    // Inject dynamic CSS for badges
    const style = document.createElement("style");
    style.textContent = badgeBackgrounds
      .map(
        (b) => `
      .badge-${b.name} { background-color: ${b.color}; }
      .game-card:has(.badge-${b.name}) { border-bottom: 3px solid ${b.color}; }
    `,
      )
      .join("");
    document.head.appendChild(style);

    // Group badges for the UI
    const sections = new Map();
    const standalone = [];

    badgeBackgrounds.forEach((b) => {
      if (b.section) {
        if (!sections.has(b.section)) sections.set(b.section, []);
        sections.get(b.section).push(b);
      } else {
        standalone.push(b);
      }
    });

    // Render Standalone
    standalone.forEach((b) => {
      badgeFilterContainer.appendChild(this.createBadgeElement(b));
    });

    // Render Sections/Stacks
    sections.forEach((badges, sectionName) => {
      if (badges.length === 1) {
        badgeFilterContainer.appendChild(this.createBadgeElement(badges[0]));
      } else {
        badgeFilterContainer.appendChild(
          this.createStackedBadge(sectionName, badges),
        );
      }
    });
  }

  createBadgeElement(badge) {
    const el = document.createElement("span");
    el.className = `badge badge-${badge.name} badgeFilterItem`;
    el.textContent = badge.name.toUpperCase().replace("_", " ");
    el.dataset.type = badge.name;
    return el;
  }

  createStackedBadge(sectionName, badges) {
    const container = document.createElement("div");
    container.className = "badge-stack-container";

    const itemsHtml = badges
      .map(
        (b, i) => `
      <span class="badge badge-${b.name} badgeFilterItem badge-stack-item"
            data-type="${b.name}"
            style="z-index: ${badges.length - i}">
        ${b.name.toUpperCase().replace("_", " ")}
      </span>
    `,
      )
      .join("");

    container.innerHTML = `
      <span class="badge badge-${badges[0].name} badgeFilterItem badge-stack-main" data-section="${sectionName}">
        ${sectionName.toUpperCase()}
      </span>
      <div class="badge-stack-hidden">${itemsHtml}</div>
    `;
    return container;
  }

  /**
   * Filtering Logic
   */
  getFilteredGames() {
    const query = this.state.searchInput.value.trim().toLowerCase();
    const { games, disabledBadges } = this.state;

    return games.filter((game) => {
      const matchesSearch = !query || game.title.toLowerCase().includes(query);
      const isNotDisabled = !disabledBadges.has(game.type);
      return matchesSearch && isNotDisabled;
    });
  }

  refreshUI() {
    const filtered = this.getFilteredGames();
    const cardsPerRow = Math.max(
      Math.floor(window.innerWidth / this.config.cardWidthWithGap),
      1,
    );

    const rows = [];
    for (let i = 0; i < filtered.length; i += cardsPerRow) {
      let rowHTML = '<div class="game-row">';
      for (let j = 0; j < cardsPerRow && i + j < filtered.length; j++) {
        const game = filtered[i + j];
        rowHTML += `
          <a href="${game.url}" class="game-card" target="_blank">
            <span class="badge badge-${game.type}">${game.type.toUpperCase().replace("_", " ")}</span>
            <img src="${game.img}" alt="${game.title}" loading="lazy">
            <div class="title">${game.title}</div>
          </a>`;
      }
      rowHTML += "</div>";
      rows.push(rowHTML);
    }

    if (this.state.clusterize) this.state.clusterize.destroy(true);

    this.state.clusterize = new Clusterize({
      rows,
      scrollId: "scrollArea",
      contentId: "contentArea",
      tag: "div",
      rows_in_block: 4,
      blocks_in_cluster: 2,
    });
  }

  /**
   * URL & State Synchronization
   */
  applyInitialFilters() {
    const params = new URLSearchParams(window.location.search);
    let filterParam = params.get("filter");

    if (!filterParam || filterParam.toLowerCase() === "all") {
      filterParam = "!RANDOM";
    }
    this.setFiltersFromString(filterParam);
    this.syncFilterUI();
  }

  /**
   * Resolves a term (like "PORTS" or "BADGAMES") to actual badge names
   */
  getBadgesForTerm(term) {
    const badges = [];
    const lowerTerm = term.toLowerCase();

    this.state.badgeBackgrounds.forEach((b) => {
      // Match by badge name or by section name
      if (
        b.name.toLowerCase() === lowerTerm ||
        (b.section && b.section.toLowerCase() === lowerTerm)
      ) {
        badges.push(b.name);
      }
    });
    return badges;
  }

  setFiltersFromString(filterStr) {
    const terms = filterStr.split(",").map((s) => s.trim());
    const allBadgeNames = this.state.badgeBackgrounds.map((b) => b.name);

    const positiveTerms = terms.filter((t) => !t.startsWith("!"));
    const negativeTerms = terms
      .filter((t) => t.startsWith("!"))
      .map((t) => t.slice(1));

    let enabledSet = new Set();

    if (positiveTerms.length > 0) {
      // Inclusive Mode: Start empty, add only matches
      positiveTerms.forEach((term) => {
        this.getBadgesForTerm(term).forEach((badge) => enabledSet.add(badge));
      });
    } else {
      // Exclusive Mode: Start with everything
      allBadgeNames.forEach((badge) => enabledSet.add(badge));
    }

    // Always subtract negatives
    negativeTerms.forEach((term) => {
      this.getBadgesForTerm(term).forEach((badge) => enabledSet.delete(badge));
    });

    // Finalize state
    this.state.disabledBadges = new Set(
      allBadgeNames.filter((name) => !enabledSet.has(name)),
    );
  }

  updateURL() {
    const allNames = this.state.badgeBackgrounds.map((b) => b.name);
    const enabled = allNames.filter((n) => !this.state.disabledBadges.has(n));

    const url = new URL(window.location);
    if (enabled.length === allNames.length) {
      url.searchParams.set("filter", "ALL");
    } else if (enabled.length === 0) {
      url.searchParams.delete("filter");
    } else {
      // Current implementation saves the state as an inclusive list for portability
      url.searchParams.set("filter", enabled.join(","));
    }

    window.history.replaceState({}, "", url);
    this.updateNavbarActiveState();
  }

  syncFilterUI() {
    document.querySelectorAll(".badgeFilterItem").forEach((el) => {
      const type = el.dataset.type;
      if (type) {
        el.classList.toggle("disabled", this.state.disabledBadges.has(type));
      }
    });

    document.querySelectorAll(".badge-stack-main").forEach((main) => {
      const section = main.dataset.section;
      const sectionBadges = this.state.badgeBackgrounds.filter(
        (b) => b.section === section,
      );
      const allDisabled = sectionBadges.every((b) =>
        this.state.disabledBadges.has(b.name),
      );
      main.classList.toggle("disabled", allDisabled);
    });
  }

  /**
   * Event Listeners
   */
  setupEventListeners() {
    this.state.searchInput.addEventListener("input", () => this.refreshUI());

    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.refreshUI(), 200);
    });

    this.state.badgeFilterContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".badgeFilterItem");
      if (!item) return;

      if (item.classList.contains("badge-stack-main")) {
        this.toggleSection(item.dataset.section);
      } else {
        this.toggleBadge(item.dataset.type);
      }

      this.syncFilterUI();
      this.updateURL();
      this.refreshUI();
    });
  }

  /**
   * Event Listeners
   */
  setupEventListeners() {
    // Search
    this.state.searchInput.addEventListener("input", () => this.refreshUI());

    // Resize (Debounced)
    let resizeTimer;
    window.addEventListener("resize", () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => this.refreshUI(), 200);
    });

    // Badge Clicks (Delegation)
    this.state.badgeFilterContainer.addEventListener("click", (e) => {
      const item = e.target.closest(".badgeFilterItem");
      if (!item) return;

      if (item.classList.contains("badge-stack-main")) {
        this.toggleSection(item.dataset.section);
      } else {
        this.toggleBadge(item.dataset.type);
      }

      this.syncFilterUI();
      this.updateURL();
      this.refreshUI();
    });

    // "All" Button
    document.getElementById("badgeFilterAll")?.addEventListener("click", () => {
      const anyEnabled =
        this.state.disabledBadges.size < this.state.badgeBackgrounds.length;
      if (anyEnabled) {
        this.state.badgeBackgrounds.forEach((b) => {
          this.state.disabledBadges.add(b.name);
        });
      } else {
        this.state.disabledBadges.clear();
        this.state.disabledBadges.add("RANDOM");
        this.state.disabledBadges.add("RANDOM_1");
        this.state.disabledBadges.add("RANDOM_2");
      }
      this.syncFilterUI();
      this.updateURL();
      this.refreshUI();
    });

    // Keyboard / focus
    window.addEventListener("keydown", (e) => {
      if (e.key === "/" && document.activeElement !== this.state.searchInput) {
        e.preventDefault();
        this.state.searchInput.focus();
      }
    });

    // Navigation Links
    document.querySelectorAll('nav a[href*="games.html"]').forEach((link) => {
      link.addEventListener("click", (e) => {
        e.preventDefault();
        const url = new URL(link.href);
        window.history.pushState({}, "", url);
        this.applyInitialFilters();
        this.refreshUI();
      });
    });
  }

  toggleBadge(type) {
    if (this.state.disabledBadges.has(type)) {
      this.state.disabledBadges.delete(type);
    } else {
      this.state.disabledBadges.add(type);
    }
  }

  toggleSection(sectionName) {
    const sectionBadges = this.state.badgeBackgrounds.filter(
      (b) => b.section === sectionName,
    );
    const isCurrentlyDisabled = sectionBadges.every((b) =>
      this.state.disabledBadges.has(b.name),
    );

    sectionBadges.forEach((b) => {
      if (isCurrentlyDisabled) this.state.disabledBadges.delete(b.name);
      else this.state.disabledBadges.add(b.name);
    });
  }

  updateNavbarActiveState() {
    const currentPath = window.location.pathname + window.location.search;
    document.querySelectorAll("nav a").forEach((link) => {
      link.classList.toggle(
        "active",
        link.getAttribute("href") === currentPath,
      );
    });
  }
}

// Global Theme Helper
function setTheme(theme) {
  theme
    ? document.documentElement.setAttribute("data-theme", theme)
    : document.documentElement.removeAttribute("data-theme");
}

// Start the app
document.addEventListener("DOMContentLoaded", () => {
  window.app = new GameGallery();
});
