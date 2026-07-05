// ==================== GLOBAL STATE ====================
import { drawRacePaceBoxPlot } from './plot_racepace_box.js';
import { drawLapTimeLinePlot, setSmoothWindow, getSmoothWindow } from './plot_laptime_line.js';
import { drawRacePaceViolinPlot } from './plot_racepace_violin.js';
import { drawPositionLinePlot } from './plot_position_line.js';
import { drawAvgSectorsPlot } from './plot_avg_sectors.js';
import { normalizeCompound } from './plot_helpers.js';
import { getScRegions, lapInRegions } from './sc_windows_helper.js';
import { drawWorldMap, highlightRaceOnMap } from './plot_world_map.js?v=24';
import { drawTelemetryPlot } from './plot_telemetry.js';

let sessionData = null;   
let allDrivers = [];      
let activeDrivers = new Set();  
let focusedDriver = null;       
let currentTelemetryData = null;

// ---------- Shared lap normalisation ----------
function normalizeLapRecord(r) {    
    return {
        driver: r.Driver || r.driver || r.DriverCode || r.code,
        driverNumber: r.DriverNumber || r.driverNumber || r.number,
        lap: r.LapNumber != null ? Number(r.LapNumber) : (r.lap || null),
        timeMs: r.LapTime != null ? Math.round(Number(r.LapTime) * 1000) : (r.LapTimeMs || null),
        s1Ms: r.Sector1Time != null ? Math.round(Number(r.Sector1Time) * 1000) : (r.Sector1Ms || null),
        s2Ms: r.Sector2Time != null ? Math.round(Number(r.Sector2Time) * 1000) : (r.Sector2Ms || null),
        s3Ms: r.Sector3Time != null ? Math.round(Number(r.Sector3Time) * 1000) : (r.Sector3Ms || null),
        compound: normalizeCompound(r.Compound || r.compound),
        isPitLap: Boolean(r.PitInTime || r.PitOutTime || r.PitOut || r.IsPitLap || r.isPitLap || false),
        isScLap: (function() {
            const ts = String(r.TrackStatus || r.trackStatus || '');
            return ts.includes('4') || ts.includes('6');
        })(),
        position: r.Position != null ? Number(r.Position) : (r.position != null ? Number(r.position) : null),
        stint: r.Stint != null ? Number(r.Stint) : (r.stint != null ? Number(r.stint) : null),
        deleted: Boolean(r.Deleted || r.deleted || false),
        isAccurate: r.IsAccurate != null ? Boolean(r.IsAccurate) : (r.isAccurate != null ? Boolean(r.isAccurate) : null),
        isPersonalBest: Boolean(r.IsPersonalBest || r.isPersonalBest || false),
        freshTyre: r.FreshTyre != null ? Boolean(r.FreshTyre) : (r.freshTyre != null ? Boolean(r.freshTyre) : null),
        pitInTime: r.PitInTime != null ? r.PitInTime : (r.pitInTime != null ? r.pitInTime : null),
        pitOutTime: r.PitOutTime != null ? r.PitOutTime : (r.pitOutTime != null ? r.pitOutTime : null),
        LapStartTime: r.LapStartTime != null ? r.LapStartTime : (r.lapStartTime || null),
        Time: r.Time != null ? r.Time : null,
        TrackStatus: r.TrackStatus != null ? String(r.TrackStatus) : (r.trackStatus != null ? String(r.trackStatus) : ''),
        LapNumber: r.LapNumber != null ? r.LapNumber : (r.lap || null),
    };
}

let enableStintMerge = true;
let stintMergeThreshold = 2;

let currentYear = null;
let currentRace = "";
let currentSession = "";

const API_BASE = "/api";
const tooltip = d3.select("#tooltip");

function computeDriversFromLaps(laps, driversMap, dataObj) {
    const scRegions = getScRegions(dataObj || sessionData, laps);
    const grouped = d3.group((laps || []).filter((l) => !l.deleted), (d) => d.driver);
    const driversArr = Array.from(driversMap.values()).map((d) => {
        const raw = (grouped.get(d.code) || []).slice().sort((a, b) => (a.lap || 0) - (b.lap || 0));

        let lastCompound = null;
        let stintCounter = 0;
        let stintLap = 0;
        raw.forEach((lap) => {
            const cmp = lap.compound || null;
            if (lap.stint != null) {
                if (lap.stint !== stintCounter) {
                    stintCounter = lap.stint;
                    stintLap = 1;
                } else {
                    stintLap += 1;
                }
            } else {
                if (cmp !== lastCompound) {
                    stintCounter += 1;
                    stintLap = 1;
                } else {
                    stintLap += 1;
                }
            }
            lap.stint = stintCounter;
            lap.stintLap = stintLap;
            lastCompound = cmp;
        });

        if (enableStintMerge) {
            const threshold = Math.max(1, Math.round(stintMergeThreshold || 2));
            const stintMap = new Map();
            raw.forEach((lap) => {
                const s = lap.stint || 0;
                const cmpNorm = normalizeCompound(lap.compound) || null;
                if (!stintMap.has(s)) stintMap.set(s, { stint: s, compound: cmpNorm, laps: [] });
                stintMap.get(s).laps.push(lap);
            });

            const stintInfos = Array.from(stintMap.values()).sort((a, b) => a.stint - b.stint);
            const toMerge = new Map();
            const runs = [];
            let curRun = null;
            for (let i = 0; i < stintInfos.length; i++) {
                const s = stintInfos[i];
                if (!s.compound) {
                    if (curRun) { runs.push(curRun); curRun = null; }
                    runs.push([s]);
                    continue;
                }
                if (!curRun) curRun = [s];
                else if (s.compound === curRun[curRun.length - 1].compound) curRun.push(s);
                else { runs.push(curRun); curRun = [s]; }
            }
            if (curRun) runs.push(curRun);

            for (const run of runs) {
                if (run.length <= 1) continue;
                const anyShort = run.some((r) => r.laps.length <= threshold);
                if (anyShort) {
                    const target = run[0].stint;
                    for (const r of run) {
                        if (r.stint !== target) toMerge.set(r.stint, target);
                    }
                }
            }

            if (toMerge.size) {
                raw.forEach((lap) => { if (toMerge.has(lap.stint)) lap.stint = toMerge.get(lap.stint); });
                let scounter = null, slap = 0, lastStint = null;
                raw.forEach((lap) => {
                    if (lap.stint !== lastStint) { scounter = lap.stint; slap = 1; lastStint = lap.stint; } 
                    else { slap += 1; }
                    lap.stint = scounter;
                    lap.stintLap = slap;
                });
            }
        }

        const candidate = raw.filter((ll) => !ll.isPitLap && !ll.isScLap && ll.timeMs != null && !lapInRegions(ll.lap, scRegions));
        const candTimes = candidate.map((l) => l.timeMs).filter((t) => t != null).sort((a, b) => a - b);
        const candMedian = candTimes.length ? d3.quantile(candTimes, 0.5) : null;
        const anomalyThreshold = candMedian != null ? Math.max(15000, candMedian * 0.2) : 15000;

        raw.forEach((l) => {
            let isCandidate = l && l.timeMs != null && !l.isPitLap && !l.isScLap && !lapInRegions(l.lap, scRegions);
            if (!isCandidate) l.isAnomalousLongLap = false;
            else l.isAnomalousLongLap = candMedian != null && l.timeMs > (candMedian + anomalyThreshold);
        });

        const lapsFiltered = candidate.filter((l) => !l.isAnomalousLongLap);
        const times = lapsFiltered.map((l) => l.timeMs).filter((t) => t != null).sort((a, b) => a - b);

        const meanAll = times.length ? d3.mean(times) : null;
        const median = times.length ? d3.quantile(times, 0.5) : null;
        const q1 = times.length ? d3.quantile(times, 0.25) : null;
        const q3 = times.length ? d3.quantile(times, 0.75) : null;
        const iqr = q1 != null && q3 != null ? q3 - q1 : null;
        const whiskerLow = iqr != null ? Math.max(d3.min(times), q1 - 1.5 * iqr) : d3.min(times);
        const whiskerHigh = iqr != null ? Math.min(d3.max(times), q3 + 1.5 * iqr) : d3.max(times);
        const outliers = times.filter((t) => t < (whiskerLow || -Infinity) || t > (whiskerHigh || Infinity));
        const centralTimes = times.filter((t) => t >= (whiskerLow || -Infinity) && t <= (whiskerHigh || Infinity));
        const mean = centralTimes.length ? d3.mean(centralTimes) : meanAll;

        const stintOrder = [];
        const stintToCompound = new Map();
        raw.forEach((lap) => {
            const s = lap.stint;
            if (!stintToCompound.has(s)) {
                stintOrder.push(s);
                stintToCompound.set(s, lap.compound || null);
            }
        });
        const strat = stintOrder.map((s) => normalizeCompound(stintToCompound.get(s))).filter(Boolean);
        const boxplot = { mean, median, q1, q3, whiskerLow, whiskerHigh, outliers };

        return { ...d, laps: raw, lapsFiltered, meanLapMs: mean, boxplot, strategy: strat };
    });

    driversArr.sort((a, b) => (a.meanLapMs || 0) - (b.meanLapMs || 0));
    return driversArr;
}

// ==================== INIT ====================

function initAll() {
    initControls();
    initSmoothControl();
    initHeartbeat();
    drawWorldMap([]); // Initialize empty globe 3D on load
    initTelemetryControls();
    initResizeObserver();
    console.log("Tactical HUD: Ready.");
}

function initTelemetryControls() {
    const btn = document.getElementById('pull-telemetry-btn');
    if (!btn) return;
    btn.addEventListener('click', async () => {
        const d1 = document.getElementById('tel-driver1').value;
        const d2 = document.getElementById('tel-driver2').value;
        if (!d1) return alert('Select Driver 1');
        
        btn.disabled = true;
        document.getElementById('telemetry-loading').style.display = 'block';
        
        try {
            const gpName = encodeURIComponent(currentRace);
            const res = await fetch(`${API_BASE}/telemetry-compare?year=${currentYear}&gpName=${gpName}&session=${currentSession}&driver1=${d1}&driver2=${d2}`);
            const data = await res.json();
            if (data.error) throw new Error(data.error);
            currentTelemetryData = data;
            drawTelemetryPlot(data);
        } catch (e) {
            alert('TELEMETRY ERROR: ' + e.message);
        } finally {
            btn.disabled = false;
            document.getElementById('telemetry-loading').style.display = 'none';
        }
    });
}

function initResizeObserver() {
    const col = document.querySelector('.plots-column');
    if (!col) return;
    let resizeTimer;
    const ro = new ResizeObserver(() => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(() => {
            if (sessionData) updateAllPlots();
        }, 150);
    });
    ro.observe(col);
}

if (document.readyState === 'loading') {
    document.addEventListener("DOMContentLoaded", initAll);
} else {
    initAll();
}

function initSmoothControl() {
    const container = document.getElementById('smooth-toggle');
    if (!container) return;
    const currentWindow = getSmoothWindow();
    container.querySelectorAll('.seg-btn').forEach((btn) => {
        const btnWindow = parseInt(btn.dataset.smooth, 10) || 1;
        btn.classList.toggle('active', btnWindow === currentWindow);
        btn.addEventListener('click', () => {
            setSmoothWindow(btnWindow);
            container.querySelectorAll('.seg-btn').forEach((b) => b.classList.remove('active'));
            btn.classList.add('active');
            updateAllPlots();
        });
    });
}

// ==================== CONTROLS / UI ====================

const SESSION_LABELS = { FP1: "Practice 1", FP2: "Practice 2", FP3: "Practice 3", Q: "Qualifying", R: "Race", SQ: "Sprint Qualifying", S: "Sprint" };

function initControls() {
    const yearSelect = document.getElementById("year-select");
    const raceSelect = document.getElementById("race-select");
    const sessionPillGroup = document.getElementById("session-pill-group");
    const loadBtn = document.getElementById("load-data-btn");

    yearSelect.addEventListener("change", async () => {
        currentYear = Number(yearSelect.value);
        currentRace = "";
        currentSession = "";

        raceSelect.innerHTML = '<option value="" disabled selected>Đang tải data...</option>';
        raceSelect.disabled = true;

        try {
            const res = await fetch(`${API_BASE}/season-events?year=${currentYear}`);
            const data = await res.json();
            
            // LOG LỖI MẠNH TAY VÀO MẶT
            if (data.error) {
                alert("PYTHON ERROR: " + data.error + "\n(Reason: FastF1 failed to connect or no data for this year.)");
                throw new Error(data.error);
            }

            const events = data.events || [];
            if (events.length === 0) {
                alert("No events found (empty response).");
                return;
            }

            // Gắn data vào dropdown Race
            raceSelect.innerHTML = '<option value="" disabled selected>Select race</option>';
            events.forEach((ev) => {
                const opt = document.createElement("option");
                opt.value = ev.gpName;
                opt.textContent = ev.round ? `${ev.round}. ${ev.gpName}` : ev.gpName;
                raceSelect.appendChild(opt);
            });
            
            // MỞ KHÓA NÚT RACE NÈ BRO!
            raceSelect.disabled = false;
            
            // Vẽ Bản đồ thế giới
            try {
                await drawWorldMap(events);
            } catch(e) {
                console.error("Failed to draw world map", e);
            }
            
        } catch (err) {
            alert("FRONTEND ERROR: " + err.message);
            raceSelect.innerHTML = '<option value="" disabled selected>System error</option>';
        }
    });

    raceSelect.addEventListener("change", async () => {
        currentRace = raceSelect.value;
        currentSession = "";
        
        // Highlight active target on the radar Map
        try {
            highlightRaceOnMap(currentRace);
        } catch(e) {}
        
        // Reset nút Load Data
        loadBtn.disabled = true;
        loadBtn.style.opacity = 0.5;
        loadBtn.style.cursor = "not-allowed";

        try {
            const gpEnc = encodeURIComponent(currentRace);
            const res = await fetch(`${API_BASE}/event-sessions?year=${currentYear}&gpName=${gpEnc}`);
            const data = await res.json();
            
            if (data.error) {
                alert("SESSION ERROR: " + data.error);
                return;
            }
            
            renderSessionPills(data.sessions || []);
        } catch (err) {
            alert("FRONTEND ERROR (select race): " + err.message);
        }
    });

    loadBtn.addEventListener("click", () => {
        loadBtn.disabled = true;
        // Show F1 car animation next to button & activate map scan HUD
        const carLoading = document.querySelector('.f1-car-loading');
        const mapWrap = document.querySelector('.world-map-wrap');
        
        if (carLoading) carLoading.classList.add('show');
        if (mapWrap) mapWrap.classList.add('is-scanning');

        fetchSessionData().finally(() => {
            loadBtn.disabled = false;
            if (carLoading) carLoading.classList.remove('show');
            if (mapWrap) mapWrap.classList.remove('is-scanning');
        });
    });
}

function initHeartbeat() {
    const canvas = document.getElementById('heartbeat-canvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    let points = [];
    const maxPoints = 80; // More points for a smoother/longer zigzag
    
    // Fill initial flatline
    for (let i = 0; i < maxPoints; i++) points.push(height / 2);

    function animate() {
        ctx.clearRect(0, 0, width, height);
        
        // Draw baseline grid (military style)
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(57,255,20,0.1)';
        ctx.lineWidth = 0.5;
        for(let i=0; i<width; i+=20) { ctx.moveTo(i,0); ctx.lineTo(i,height); }
        for(let j=0; j<height; j+=20) { ctx.moveTo(0,j); ctx.lineTo(width,j); }
        ctx.stroke();

        ctx.beginPath();
        ctx.strokeStyle = '#39ff14';
        ctx.lineWidth = 1.8;
        ctx.lineJoin = 'round';
        
        // Push a new point
        let lastV = points[points.length - 1];
        let newV = height / 2;
        
        // Improved heartbeat "lub-dub" physics
        const rand = Math.random();
        if (rand > 0.96) {
            newV = 10; // Major spike
        } else if (rand > 0.92) {
            newV = height - 10; // Rapid drop
        } else {
            // Smooth return to baseline
            newV = lastV + (height/2 - lastV) * 0.15 + (Math.random() - 0.5) * 1.5;
        }
        
        points.push(newV);
        if (points.length > maxPoints) points.shift();
        
        for (let i = 0; i < points.length; i++) {
            const x = (i / (maxPoints - 1)) * width;
            const y = points[i];
            if (i === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
        }
        
        ctx.shadowBlur = 8;
        ctx.shadowColor = '#39ff14';
        ctx.stroke();
        
        requestAnimationFrame(animate);
    }
    animate();
}

function renderSessionPills(sessions) {
    const group = document.getElementById("session-pill-group");
    const loadBtn = document.getElementById("load-data-btn");
    group.innerHTML = "";
    currentSession = "";

    sessions.forEach((s) => {
        const pill = document.createElement("button");
        pill.className = "pill pill-session";
        pill.textContent = s.name;
        pill.dataset.sessionCode = s.code;
        
        pill.addEventListener("click", () => {
            group.querySelectorAll(".pill-session").forEach((p) => p.classList.remove("pill-active"));
            pill.classList.add("pill-active");
            currentSession = s.code;
            
            // Sáng nút Load Data lên
            loadBtn.disabled = false;
            loadBtn.style.opacity = 1;
            loadBtn.style.cursor = "pointer";
        });
        group.appendChild(pill);
    });
}

function updateLoadedLabel(text) {
    const label = document.getElementById("loaded-session-label");
    if (label) label.textContent = text || "";
}

// ==================== DATA LOADING ====================

async function fetchSessionData() {
    try {
        const gpName = encodeURIComponent(currentRace);
        const url = `${API_BASE}/session-data?year=${currentYear}&gpName=${gpName}&session=${currentSession}`;
        
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.error) {
            alert("PYTHON ERROR (load data): " + data.error);
            updateLoadedLabel("Load failed.");
            return;
        }

        const apiLaps = (data.laps || []).map(normalizeLapRecord);

        const driversMap = new Map();
        if (data.drivers && Array.isArray(data.drivers) && data.drivers.length) {
            data.drivers.forEach((d) => {
                const gridVal = d.grid != null ? d.grid : null;
                driversMap.set(d.code, { 
                    code: d.code, 
                    name: d.name, 
                    fullName: d.name, 
                    team: d.team, 
                    _teamColor: d.TeamColor,
                    position: d.position, 
                    grid: gridVal 
                });
            });
        }
        
        if (!driversMap.size) {
            const codes = Array.from(new Set(apiLaps.map((l) => l.driver).filter(Boolean)));
            codes.forEach((c) => driversMap.set(c, { code: c, name: c, fullName: c, team: null }));
        }

        sessionData = { meta: data.meta || {}, laps: apiLaps, drivers: Array.from(driversMap.values()) };
        allDrivers = computeDriversFromLaps(apiLaps, driversMap, sessionData);
        
        activeDrivers.clear();
        focusedDriver = null;
        
        // Populate Telemetry Drivers
        const sel1 = document.getElementById('tel-driver1');
        const sel2 = document.getElementById('tel-driver2');
        if (sel1 && sel2) {
            const html = '<option value="">DRV</option>' + allDrivers.map(d => `<option value="${d.code}">${d.code}</option>`).join('');
            sel1.innerHTML = html;
            sel2.innerHTML = html;
            currentTelemetryData = null;
            drawTelemetryPlot(null); // Clear telemetry plot
        }

        renderDriverPills();
        updateAllPlots();
        updateLoadedLabel(` Loaded ${currentYear} ${currentRace} · ${SESSION_LABELS[currentSession] || currentSession}.`);
        
    } catch (err) {
        alert("NETWORK/FRONTEND ERROR: " + err.message);
        updateLoadedLabel("Disconnected.");
    }
}

// ==================== DRIVER PILLS ====================

function renderDriverPills() {
    const container = d3.select("#driver-pills");
    container.selectAll("*").remove();
    if (!allDrivers.length) return;

    const displayedDrivers = allDrivers.filter((d) => driverIncludedInPills(d));

    const pills = container.selectAll(".driver-pill")
        .data(displayedDrivers, (d) => d.code)
        .enter()
        .append("button")
        .attr("class", "driver-pill")
        .each(function (d) {
            const el = d3.select(this);
            const teamColor = getTeamColor(d.team, d._teamColor) || '#777';
            const accentColor = getTeamAccentColor(d.team);
            const teamText = accentColor || getBadgeTextColor(d.team, d._teamColor) || '#000';
            const borderCol = accentColor || teamColor;
            
            el.style("--team-color", teamColor)
              .style("--team-text-color", teamText)
              .style("--pill-text-color", accentColor || null)
              .style("--pill-border-color", accentColor || null)
              .style("border-color", borderCol);

            const explicitlySelected = activeDrivers.size > 0 && activeDrivers.has(d.code);
            if (explicitlySelected) el.classed('selected', true).classed('unselected', false);
            else el.classed('selected', false).classed('unselected', true);
        })
        .on("click", (event, d) => {
            if (activeDrivers.has(d.code)) activeDrivers.delete(d.code);
            else activeDrivers.add(d.code);
            
            if (activeDrivers.size === 0) focusedDriver = null;
            else if (!activeDrivers.has(focusedDriver)) focusedDriver = null;
            
            renderDriverPills();
            updateAllPlots();
        });

    pills.append("span").attr("class", "pill-code").text((d) => d.code);
}

function driverIncludedInPills(d) {
    if (!d) return false;
    if (currentSession === 'Q' || currentSession === 'SQ' || (currentSession && currentSession.startsWith('FP'))) return true;
    if (d.meanLapMs == null) return false;
    const maxLap = sessionData && sessionData.laps ? d3.max(sessionData.laps, (l) => l.lap || 0) : 0;
    const minRequired = Math.ceil((maxLap || 0) * 0.25);
    const lapCount = (d.lapsFiltered || []).length;
    if ((maxLap || 0) === 0) return lapCount > 0;
    return lapCount >= Math.max(1, minRequired);
}

function visibleDrivers() {
    const shown = allDrivers.filter((d) => driverIncludedInPills(d));
    if (activeDrivers.size === 0) return shown;
    return shown.filter((d) => activeDrivers.has(d.code));
}

function driversForBoxAndViolin(drivers) {
    if (!drivers || drivers.length === 0) return drivers;
    return drivers
        .map((d) => ({ driver: d, mean: d.meanLapMs != null ? d.meanLapMs : Infinity, lapCount: (d.lapsFiltered || []).length || 0 }))
        .sort((a, b) => {
            if (a.mean !== b.mean) return a.mean - b.mean;
            return b.lapCount - a.lapCount;
        })
        .map((x) => x.driver);
}

// ==================== TOOLTIP HELPERS ====================

function showTooltip(html, x, y) {
    tooltip.style("display", "block").style("opacity", 1).html(html).style("left", x + 14 + "px").style("top", y + 14 + "px");
}
function hideTooltip() { tooltip.style("display", "none").style("opacity", 0); }
window.showTooltip = showTooltip;
window.hideTooltip = hideTooltip;

// ==================== PLOT ORCHESTRATION ====================

function updateAllPlots() {
    const drivers = visibleDrivers();
    const driversBoxViolin = driversForBoxAndViolin(drivers);

    try { drawRacePaceBoxPlot(sessionData, driversBoxViolin); } catch (err) { console.error('boxplot', err); }
    try { drawLapTimeLinePlot(sessionData, drivers); } catch (err) { console.error('laptime', err); }
    try { drawRacePaceViolinPlot(sessionData, driversBoxViolin); } catch (err) { console.error('violin', err); }
    try { drawPositionLinePlot(sessionData, drivers); } catch (err) { console.error('position', err); }
    try { drawAvgSectorsPlot(sessionData, drivers); } catch (err) { console.error('avg-sectors', err); }
    try { if (currentTelemetryData) drawTelemetryPlot(currentTelemetryData); } catch (err) { console.error('telemetry', err); }

    try { if (window.updateCircuitPreview) window.updateCircuitPreview(); } 
    catch (e) {}
}

document.addEventListener('globalSvgSizeChanged', function () {
    setTimeout(() => {
        try { updateAllPlots(); } catch (e) {}
    }, 80);
});

function setFocusedDriver(code) {
    focusedDriver = (focusedDriver === code) ? null : code;
    updateAllPlots();
}
window.setFocusedDriver = setFocusedDriver;