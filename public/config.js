// ==================== GLOBAL CONFIG (multi-year) ====================

const CURRENT_YEAR = new Date().getFullYear();

// Race lists and sprint calendars are now fetched dynamically from the
// FastF1 backend via /api/season-events and /api/event-sessions.
// No hardcoded race or sprint lists are needed.


// -------------------- Team colors (canonical names) --------------------

const TEAM_COLORS = {
    "Red Bull Racing": "#2A00FF",
    "McLaren": "#FF7E00",
    "Mercedes": "#00C8A5",
    "Ferrari": "#FF2800",
    "Aston Martin": "#006F3C",
    "Alpine": "#FF58E5",
    "Williams": "#3D7CFF",
    "Racing Bulls": "#F8FAFF",
    "AlphaTauri": "#C8102E",
    "Kick Sauber": "#00A86B",
    "Haas": "#8A807C",

    // New 2026 teams
    "Audi": "#E00034",
    "Cadillac": "#7C828A",
};

// Aliases map historical/spelled variants to canonical keys in TEAM_COLORS
const TEAM_ALIASES = {
    // Red Bull (main team)
    "Oracle Red Bull Racing": "Red Bull Racing",
    "Red Bull Racing-Honda RBPT": "Red Bull Racing",

    // Racing Bulls / RB / VCARB
    "RB": "Racing Bulls",
    "Visa Cash App RB F1 Team": "Racing Bulls",
    "VCARB 01": "Racing Bulls",
    "RB-Honda RBPT": "Racing Bulls",

    // AlphaTauri historical variants
    "AlphaTauri-Honda RBPT": "AlphaTauri",
    "Scuderia AlphaTauri": "AlphaTauri",
    "AlphaTauri": "AlphaTauri",

    // Sauber / Alfa Romeo -> Kick Sauber
    "Alfa Romeo F1 Team Stake": "Kick Sauber",
    "Alfa Romeo": "Kick Sauber",
    "Sauber": "Kick Sauber",
    "Kick Sauber-Ferrari": "Kick Sauber",
    "Stake F1 Team": "Kick Sauber",
    "Stake F1 Team Kick Sauber": "Kick Sauber",

    // Audi (Sauber becomes Audi factory team in 2026+; keep aliases flexible)
    "Audi F1 Team": "Audi",
    "Audi": "Audi",

    // Cadillac
    "Cadillac F1 Team": "Cadillac",
    "Cadillac Formula 1 Team": "Cadillac",
    "Cadillac": "Cadillac",

    // Haas naming variants
    "Haas F1 Team": "Haas",
};

// -------------------- Team accent colors (pill border + text overrides) --------------------

const TEAM_ACCENT_COLORS = {
    "Racing Bulls": "#6692FF",
};

function getTeamAccentColor(team) {
    if (!team) return null;
    if (TEAM_ACCENT_COLORS[team]) return TEAM_ACCENT_COLORS[team];
    const alias = TEAM_ALIASES[team];
    if (alias && TEAM_ACCENT_COLORS[alias]) return TEAM_ACCENT_COLORS[alias];
    return null;
}

// -------------------- Tyre colors --------------------
const TYRE_COLORS = {
    S: "#C42124",
    M: "#FFED34",
    H: "#FFF",
    I: "#75BC38",
    W: "#4D86EB",
};

const SECTOR_LABEL_COLORS = {
    S1: "#FC0001",
    S2: "#00B2E3",
    S3: "#FFD400",
    DRS: "#15C000",
    Speed: "#F0F",
};

const SECTOR_FLAG_COLORS = {
    purple: "#8022FE",
    green: "#00BD7C",
    yellow: "#FFB900",
    none: "#2c3e50",
};

// Expose selected config to ES modules via window.* (modules can't reliably access
// top-level `const` bindings from classic scripts across browsers).
try {
    window.TYRE_COLORS = TYRE_COLORS;
    window.SECTOR_LABEL_COLORS = SECTOR_LABEL_COLORS;
    window.SECTOR_FLAG_COLORS = SECTOR_FLAG_COLORS;
    window.getTeamAccentColor = getTeamAccentColor;
    window.getTeamColor = getTeamColor;
    window.getBadgeTextColor = getBadgeTextColor;
    window.lightenColor = lightenColor;
} catch (e) {}

// -------------------- Helpers --------------------

function getTeamColor(team, fallback = "#999999") {
    if (!team) return fallback;

    // If `team` is actually a hex color, normalize and return it.
    if (typeof team === "string") {
        const t = team.trim();
        const m6 = t.match(/^#?([0-9a-fA-F]{6})$/);
        const m3 = t.match(/^#?([0-9a-fA-F]{3})$/);
        if (m6) return `#${m6[1].toUpperCase()}`;
        if (m3) {
            const a = m3[1];
            const expanded = a[0] + a[0] + a[1] + a[1] + a[2] + a[2];
            return `#${expanded.toUpperCase()}`;
        }
    }

    // Exact match first
    if (TEAM_COLORS[team]) return TEAM_COLORS[team];

    // Alias mapping (exact)
    if (TEAM_ALIASES[team] && TEAM_COLORS[TEAM_ALIASES[team]]) {
        return TEAM_COLORS[TEAM_ALIASES[team]];
    }

    // Case-insensitive alias/exact match
    const lower = String(team).toLowerCase();
    for (const k of Object.keys(TEAM_ALIASES)) {
        if (k.toLowerCase() === lower && TEAM_COLORS[TEAM_ALIASES[k]]) {
            return TEAM_COLORS[TEAM_ALIASES[k]];
        }
    }

    // Fuzzy match against canonical keys (contains)
    for (const key of Object.keys(TEAM_COLORS)) {
        if (key.toLowerCase().includes(lower) || lower.includes(key.toLowerCase())) {
            return TEAM_COLORS[key];
        }
    }

    return fallback;
}

function getContrastingTextColor(hex) {
    if (!hex || typeof hex !== "string" || hex[0] !== "#") return "#ffffff";
    let h = hex;
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    const r = parseInt(h.slice(1, 3), 16);
    const g = parseInt(h.slice(3, 5), 16);
    const b = parseInt(h.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.6 ? "#000000" : "#ffffff";
}

function getBadgeTextColor(team, fallbackColor = null) {
    const teamColor = getTeamColor(team, fallbackColor);
    if (!team) return "#ffffff";
    return getContrastingTextColor(teamColor);
}

function lightenColor(hex, amount = 0.35) {
    if (!hex || hex[0] !== "#") return hex || "#cccccc";
    let h = hex;
    if (h.length === 4) h = "#" + h[1] + h[1] + h[2] + h[2] + h[3] + h[3];
    const num = parseInt(h.slice(1), 16);
    let r = (num >> 16) & 0xff;
    let g = (num >> 8) & 0xff;
    let b = num & 0xff;
    r = Math.min(255, Math.floor(r + (255 - r) * amount));
    g = Math.min(255, Math.floor(g + (255 - g) * amount));
    b = Math.min(255, Math.floor(b + (255 - b) * amount));
    return (
        "#" +
        r.toString(16).padStart(2, "0") +
        g.toString(16).padStart(2, "0") +
        b.toString(16).padStart(2, "0")
    );
}

function darkenColorIfBright(hex, threshold = 0.6, amount = 0.25) {
    if (!hex || hex[0] !== '#') return hex || '#999999';
    let h = hex;
    if (h.length === 4) h = '#' + h[1]+h[1] + h[2]+h[2] + h[3]+h[3];
    const r = parseInt(h.slice(1,3),16);
    const g = parseInt(h.slice(3,5),16);
    const b = parseInt(h.slice(5,7),16);
    const luminance = (0.299*r + 0.587*g + 0.114*b) / 255;
    if (luminance <= threshold) return hex;
    const dr = Math.max(0, Math.floor(r * (1 - amount)));
    const dg = Math.max(0, Math.floor(g * (1 - amount)));
    const db = Math.max(0, Math.floor(b * (1 - amount)));
    return '#' + dr.toString(16).padStart(2,'0') + dg.toString(16).padStart(2,'0') + db.toString(16).padStart(2,'0');
}

function msToTimeString(ms) {
    if (ms == null || isNaN(ms)) return "N/A";
    const totalMs = Math.floor(ms);
    const totalSec = Math.floor(totalMs / 1000);
    const minutes = Math.floor(totalSec / 60);
    const seconds = totalSec % 60;
    const millis = totalMs % 1000;
    const mm = String(minutes).padStart(1, "0");
    const ss = String(seconds).padStart(2, "0");
    const iii = String(millis).padStart(3, "0");
    return `${mm}:${ss}:${iii}`;
}

// -------------------- Circuit info (year-aware for Spain split in 2026) --------------------

// Base mapping (used for 2025 and earlier), keyed by GP name.
const CIRCUIT_INFO_BASE = {
    "Australian Grand Prix": {
        circuit: "Albert Park Circuit",
        location: "Melbourne",
        country: "Australia",
        sea_level: 7,
        track_length: 5.278,
        race_length: 306.1,
        elevation_change: 24,
    },
    "Bahrain Grand Prix": {
        circuit: "Bahrain International Circuit",
        location: "Sakhir",
        country: "Bahrain",
        sea_level: 10,
        track_length: 5.412,
        race_length: 308.2,
        elevation_change: 17,
    },
    "Saudi Arabian Grand Prix": {
        circuit: "Jeddah Corniche Circuit",
        location: "Jeddah",
        country: "Saudi Arabia",
        sea_level: 0,
        track_length: 6.174,
        race_length: 308.45,
        elevation_change: 5,
    },
    "Chinese Grand Prix": {
        circuit: "Shanghai International Circuit",
        location: "Shanghai",
        country: "China",
        sea_level: 4,
        track_length: 5.451,
        race_length: 305.3,
        elevation_change: 6,
    },
    "Japanese Grand Prix": {
        circuit: "Suzuka International Racing Course",
        location: "Suzuka",
        country: "Japan",
        sea_level: 50,
        track_length: 5.807,
        race_length: 307.5,
        elevation_change: 40,
    },
    "Miami Grand Prix": {
        circuit: "Miami International Autodrome",
        location: "Miami",
        country: "United States",
        sea_level: 2,
        track_length: 5.412,
        race_length: 308.4,
        elevation_change: 11,
    },
    "Emilia Romagna Grand Prix": {
        circuit: "Autodromo Enzo e Dino Ferrari (Imola)",
        location: "Imola",
        country: "Italy",
        sea_level: 50,
        track_length: 4.909,
        race_length: 309.0,
        elevation_change: 30,
    },
    "Monaco Grand Prix": {
        circuit: "Circuit de Monaco",
        location: "Monte Carlo",
        country: "Monaco",
        sea_level: 10,
        track_length: 3.337,
        race_length: 260.3,
        elevation_change: 42,
    },
    "Canadian Grand Prix": {
        circuit: "Circuit Gilles Villeneuve",
        location: "Montreal",
        country: "Canada",
        sea_level: 16,
        track_length: 4.361,
        race_length: 305.3,
        elevation_change: 6,
    },

    // 2025 and earlier: "Spanish Grand Prix" is Barcelona
    "Spanish Grand Prix": {
        circuit: "Circuit de Barcelona-Catalunya",
        location: "Barcelona",
        country: "Spain",
        sea_level: 109,
        track_length: 4.657,
        race_length: 307.1,
        elevation_change: 30,
    },

    "Austrian Grand Prix": {
        circuit: "Red Bull Ring",
        location: "Spielberg",
        country: "Austria",
        sea_level: 700,
        track_length: 4.318,
        race_length: 306.5,
        elevation_change: 65,
    },
    "British Grand Prix": {
        circuit: "Silverstone Circuit",
        location: "Silverstone",
        country: "United Kingdom",
        sea_level: 150,
        track_length: 5.891,
        race_length: 306.2,
        elevation_change: 12,
    },
    "Hungarian Grand Prix": {
        circuit: "Hungaroring",
        location: "Budapest",
        country: "Hungary",
        sea_level: 235,
        track_length: 4.381,
        race_length: 306.63,
        elevation_change: 34,
    },
    "Belgian Grand Prix": {
        circuit: "Circuit de Spa-Francorchamps",
        location: "Stavelot, Spa",
        country: "Belgium",
        sea_level: 470,
        track_length: 7.004,
        race_length: 306.45,
        elevation_change: 102,
    },
    "Dutch Grand Prix": {
        circuit: "Circuit Zandvoort",
        location: "Zandvoort",
        country: "Netherlands",
        sea_level: 3,
        track_length: 4.259,
        race_length: 306.6,
        elevation_change: 8,
    },
    "Italian Grand Prix": {
        circuit: "Autodromo Nazionale Monza",
        location: "Monza",
        country: "Italy",
        sea_level: 162,
        track_length: 5.793,
        race_length: 306.72,
        elevation_change: 13,
    },
    "Azerbaijan Grand Prix": {
        circuit: "Baku City Circuit",
        location: "Baku",
        country: "Azerbaijan",
        sea_level: -28,
        track_length: 6.003,
        race_length: 306.1,
        elevation_change: 26,
    },
    "Singapore Grand Prix": {
        circuit: "Marina Bay Street Circuit",
        location: "Marina Bay",
        country: "Singapore",
        sea_level: 5,
        track_length: 4.94,
        race_length: 308.7,
        elevation_change: 5,
    },
    "United States Grand Prix": {
        circuit: "Circuit of the Americas",
        location: "Austin",
        country: "United States",
        sea_level: 190,
        track_length: 5.513,
        race_length: 308.4,
        elevation_change: 41,
    },
    "Mexico City Grand Prix": {
        circuit: "Autódromo Hermanos Rodríguez",
        location: "Mexico City",
        country: "Mexico",
        sea_level: 2240,
        track_length: 4.304,
        race_length: 305.3,
        elevation_change: 18,
    },
    "São Paulo Grand Prix": {
        circuit: "Autódromo José Carlos Pace (Interlagos)",
        location: "São Paulo",
        country: "Brazil",
        sea_level: 760,
        track_length: 4.309,
        race_length: 305.9,
        elevation_change: 43,
    },
    "Las Vegas Grand Prix": {
        circuit: "Las Vegas Strip Circuit",
        location: "Las Vegas",
        country: "United States",
        sea_level: 610,
        track_length: 6.201,
        race_length: 305.8,
        elevation_change: 9,
    },
    "Qatar Grand Prix": {
        circuit: "Lusail International Circuit",
        location: "Lusail",
        country: "Qatar",
        sea_level: 6,
        track_length: 5.419,
        race_length: 308.6,
        elevation_change: 10,
    },
    "Abu Dhabi Grand Prix": {
        circuit: "Yas Marina Circuit",
        location: "Abu Dhabi",
        country: "United Arab Emirates",
        sea_level: 5,
        track_length: 5.281,
        race_length: 306.2,
        elevation_change: 10,
    },
};

// Per-year overrides (only put deltas here)
const CIRCUIT_INFO_BY_YEAR = {
    2026: {
        // Barcelona’s race is renamed in 2026
        "Barcelona-Catalunya Grand Prix": {
            circuit: "Circuit de Barcelona-Catalunya",
            location: "Barcelona",
            country: "Spain",
            sea_level: 109,
            track_length: 4.657,
            race_length: 307.1,
            elevation_change: 30,
        },

        // In 2026 "Spanish Grand Prix" is Madrid
        "Spanish Grand Prix": {
            circuit: "Madring (subject to FIA homologation)",
            location: "Madrid",
            country: "Spain",
            track_length: 5.416,
            // Fill in later when finalized if you want exact km
            race_length: null,
            sea_level: null,
            elevation_change: null,
        },
    },
};

function getCircuitInfo(gpName, year = CURRENT_YEAR) {
    const overrides = CIRCUIT_INFO_BY_YEAR[year] || {};
    return overrides[gpName] || CIRCUIT_INFO_BASE[gpName] || null;
}

// (Optional) Backwards-compatible alias if your code expects CIRCUIT_INFO[gpName]
const CIRCUIT_INFO = new Proxy(
    {},
    {
        get: (_target, prop) => getCircuitInfo(String(prop), CURRENT_YEAR),
    }
);