const CATEGORIES = [
    { key: "featured", title: "Featured" },
    { key: "default", title: "Games" },
    { key: "archive", title: "Untested/Archive" }
];

const COLLATOR = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });
const CACHE_NAME = "jxl-catalog-cache-v1";

async function getCachedAsset(url) {
    const cache = await caches.open(CACHE_NAME);
    let response = await cache.match(url);
    if (!response) {
        try {
            response = await fetch(url);
            if (response.ok) {
                await cache.put(url, response.clone());
            }
        } catch {
            return url;
        }
    }
    const blob = await response.blob();
    return URL.createObjectURL(blob);
}

async function loadCatalog() {
    const entries = await Promise.all(
        CATEGORIES.map(async ({ key, title }) => {
            try {
                const response = await fetch(`/data/${key}.json`);
                if (!response.ok) return [key, title, []];
                
                const data = await response.json();
                const seen = new Set();

                const processed = data
                    .filter(([rawTitle]) => {
                        const k = rawTitle?.toLowerCase().replace(/[^a-z0-9]/g, "");
                        if (!k || seen.has(k)) return false;
                        seen.add(k);
                        return true;
                    })
                    .sort((a, b) => COLLATOR.compare(a[0], b[0]));

                return [key, title, processed];
            } catch {
                return [key, title, []];
            }
        })
    );
    return entries;
}

function loadUI(catalog) {
    const container = document.getElementById("container");
    const template = document.getElementById("game-template");

    async function render(filteredCatalog) {
        container.replaceChildren();

        for (const [key, title, games] of filteredCatalog) {
            if (games.length === 0) continue;

            const section = document.createElement("section");
            section.className = `catalog-section section-${key}`;

            const heading = document.createElement("h2");
            heading.className = "section-heading";
            heading.textContent = title;
            section.appendChild(heading);

            const grid = document.createElement("div");
            grid.className = "section-grid";

            const fragment = document.createDocumentFragment();

            for (const [gameTitle, url, image] of games) {
                const card = template.content.cloneNode(true);
                const link = card.querySelector(".game-card");
                link.href = url;
                link.title = gameTitle;

                const img = card.querySelector(".game-card-image");
                img.alt = gameTitle;
                img.loading = "lazy";
                img.decoding = "async";

                getCachedAsset(image).then(objectUrl => {
                    img.src = objectUrl;
                });

                card.querySelector(".game-card-title").textContent = gameTitle;
                fragment.append(card);
            }

            grid.append(fragment);
            section.append(grid);
            container.append(section);
        }
    }

    render(catalog);

    return {
        filter(searchTerm) {
            if (!searchTerm) {
                render(catalog);
                return;
            }

            const filtered = catalog.map(([key, title, games]) => [
                key,
                title,
                games.filter(([gameTitle]) => gameTitle.toLowerCase().includes(searchTerm))
            ]);

            render(filtered);
        }
    };
}

function setupSearch(ui) {
    const searchInput = document.getElementById("search");

    searchInput.addEventListener("input", () => {
        ui.filter(searchInput.value.trim().toLowerCase());
    });

    window.addEventListener("keydown", (e) => {
        if (e.key === "/" && !["INPUT", "TEXTAREA"].includes(document.activeElement.tagName)) {
            e.preventDefault();
            searchInput.focus();
        }
        if (e.key === "Escape") {
            searchInput.value = "";
            ui.filter("");
            searchInput.blur();
        }
    });
}

const catalog = await loadCatalog();
const ui = loadUI(catalog);
setupSearch(ui);