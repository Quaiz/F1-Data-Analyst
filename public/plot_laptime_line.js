
let selectedDriverCodes = new Set();

// Smoothing levels: 1 = off, 11 = light, 21 = medium, 31 = high (Savitzky-Golay)
let smoothWindow = 1;
const SAVITZKY_GOLAY_POLYORDER = 2;
const VALID_SMOOTH_WINDOWS = new Set([1, 11, 21, 31]);

export function setSmoothWindow(w) {
    const next = Number(w);
    smoothWindow = VALID_SMOOTH_WINDOWS.has(next) ? next : 1;
}

export function getSmoothWindow() {
    return smoothWindow;
}

import { resolveSvgSize, showTooltip as lineShowTooltip, hideTooltip as lineHideTooltip, markTeamPrimary, computeCumulativeBests, normalizeSectorMs, annotateSectorFlags, appendExportTitle } from './plot_helpers.js';
import { getScRegions, lapInRegions, renderScRegions } from './sc_windows_helper.js';

// Local S1/S2/S3 label colors (for labels, flag colors come from SECTOR_FLAG_COLORS)
const SECTOR_LABEL_COLORS = {
    S1: "#a91c0cff",   // red
    S2: "#1050e8ff",   // blue
    S3: "#ffd86b"    // yellow
};

const SECTOR_FLAG_COLORS = {
    purple: "#a020f0",
    green: "#2ecc71",
    yellow: "#f1c40f",
    none: "#2c3e50"
};

// Determine performance colour for a lap based on sector flags and fastest markers.
function getPerformanceFlagColor(d) {
    if (!d) return SECTOR_FLAG_COLORS.none;
    // Purple = provisional fastest up to that lap (across drivers)
    if (d.isProvisionalFastest || d.isPurpleLap) return SECTOR_FLAG_COLORS.purple;
    // Green = personal best (driver improvement / personal-best marker)
    if (d.isPersonalBest || d.isImprovement) return SECTOR_FLAG_COLORS.green;
    const flags = [d.s1Flag, d.s2Flag, d.s3Flag].filter(Boolean);
    if (flags.includes("purple")) return SECTOR_FLAG_COLORS.purple;
    if (flags.includes("green")) return SECTOR_FLAG_COLORS.green;
    return SECTOR_FLAG_COLORS.yellow;
}

// Build tooltip HTML for a single driver lap (used on direct point hover)
function buildLapTooltipHTML(driver, d) {
        const lapStr = d.timeMs != null ? msToTimeString(d.timeMs) : "N/A";
            const isFastest = Boolean(d.isProvisionalFastest || d.isPurpleLap || d.isSessionBestLap);
            const isImprovement = Boolean(d.isImprovement);
            const isPB = Boolean(d.isPersonalBest);
            const isProv = Boolean(d.isProvisionalFastest);

            // Prefer sector flags (purple/green/yellow) to indicate performance.
            const perfColor = getPerformanceFlagColor(d) || SECTOR_FLAG_COLORS.yellow;
            let lapLabel = "N/A";
            if (d.timeMs != null) {
                // Fastest lap should always be highlighted as purple and annotated.
                if (isFastest || perfColor === SECTOR_FLAG_COLORS.purple) {
                    lapLabel = `<span style="color:${SECTOR_FLAG_COLORS.purple};font-weight:700">${lapStr}</span>`;
                } else if (perfColor === SECTOR_FLAG_COLORS.green || isImprovement || isProv || isPB) {
                    lapLabel = `<span style="color:${SECTOR_FLAG_COLORS.green};font-weight:700">${lapStr}</span>`; // green for improvement/sector green
                } else {
                    lapLabel = `<span style="color:${SECTOR_FLAG_COLORS.yellow};font-weight:700">${lapStr}</span>`; // yellow default
                }
            }

    const sectorBox = (label, ms, flagKey, secKey) => {
        // default to yellow when no explicit flag is present
        const flagColor = SECTOR_FLAG_COLORS[flagKey || "yellow"] || SECTOR_FLAG_COLORS.yellow;
        const labelColor = SECTOR_LABEL_COLORS[secKey] || "#ffffff";
        const txt = ms != null ? msToTimeString(ms) : "N/A";
        return `
            <div style="display:flex;align-items:center;margin-top:2px;">
              <span style="min-width:20px;color:${labelColor};font-weight:700">${label}:</span>
              <span style="
                  display:inline-block;
                  margin-left:4px;
                  padding:1px 4px;
                  border-radius:4px;
                  background:${flagColor};
                  color:#000;
                  font-size:11px;
              ">${txt}</span>
            </div>`;
    };

    const headerName = driver.fullName || driver.name || driver.code;
    return `
        <div><strong style="color:${getTeamColor(driver.team)}">${headerName} - ${driver.team}</strong></div>
        <div>Lap ${d.lap}: ${lapLabel}</div>
        <div>Tyre: <span style="color:${TYRE_COLORS[d.compound] || "#ccc"};font-weight:700">${d.compound}</span>, Stint ${d.stint} lap ${d.stintLap}</div>
        ${sectorBox("S1", d.s1Ms, d.s1Flag, "S1")}
        ${sectorBox("S2", d.s2Ms, d.s2Flag, "S2")}
        ${sectorBox("S3", d.s3Ms, d.s3Flag, "S3")}
    `;
}

// Show single-point tooltip and position the single hover circle
function showPointTooltip(event, hoverCircle, driver, d, x, y) {
    const html = buildLapTooltipHTML(driver, d);
    lineShowTooltip(html, event.pageX, event.pageY);

    hoverCircle
        .attr("cx", x(d.lap))
        .attr("cy", y(d.timeMs))
        .attr("opacity", 1)
        .attr("fill", TYRE_COLORS[d.compound] || getTeamColor(driver.team))
        .attr("r", 6.5)
        .raise();
}

// Build consolidated tooltip HTML for multiple drivers at the same lap
function buildMultiLapTooltipHTML(lapVal, entries) {
    // entries: [{driver, d}]
    // If we've deterministically selected a single fastest this lap
    // (`isFastestThisLap`), prefer that purple mark and ignore other
    // provisional/sector purple flags for the consolidated tooltip so
    // only one driver appears purple. Otherwise fall back to sector flags.
    const hasExplicitFastest = entries.some((e) => Boolean(e.d.isFastestThisLap));

    const rows = entries
        .sort((a, b) => (a.d.timeMs || Infinity) - (b.d.timeMs || Infinity))
        .map((e) => {
            const d = e.d;
            const driver = e.driver;
                // Determine fastest highlighting. If we have an explicit
                // single fastest selected, only that entry gets purple.
                const isFastest = Boolean(d.isFastestThisLap || (!hasExplicitFastest && (d.isProvisionalFastest || d.isPurpleLap || d.isSessionBestLap)));
            const isPB = Boolean(d.isPersonalBest);
            const isProv = Boolean(d.isProvisionalFastest);
            let time = 'N/A';
            if (d.timeMs != null) {
                const s = msToTimeString(d.timeMs);
                const perfColor = getPerformanceFlagColor(d) || SECTOR_FLAG_COLORS.yellow;
                if (isFastest) {
                    time = `<span style="color:${SECTOR_FLAG_COLORS.purple};font-weight:700">${s}</span>`;
                } else if (perfColor === SECTOR_FLAG_COLORS.green || isProv || isPB) {
                    time = `<span style="color:${SECTOR_FLAG_COLORS.green};font-weight:700">${s}</span>`;
                } else {
                    time = `<span style="color:${SECTOR_FLAG_COLORS.yellow};font-weight:700">${s}</span>`;
                }
            }
            return `
                <div style="margin-top:6px;">
                  <span style="display:inline-block;width:70px;color:${getTeamColor(driver.team)};font-weight:700">${driver.code}</span>
                  <span style="display:inline-block;width:130px">${driver.name}</span>
                                    <span style="display:inline-block;width:80px">${time}</span>
                                    <span style="display:inline-block;color:${TYRE_COLORS[d.compound] || '#ccc'};font-weight:700">${d.compound || ''}</span>
                </div>`;
        })
        .join('');

    return `<div><strong>Lap ${lapVal}</strong></div>${rows}`;
}

function getSavitzkyGolayWindowLength(desiredWindow, dataLength, polyorder = SAVITZKY_GOLAY_POLYORDER) {
    if (!Number.isFinite(dataLength) || dataLength <= polyorder) return 0;
    let window = Math.min(desiredWindow, dataLength);
    if (window % 2 === 0) window -= 1;

    let minWindow = polyorder + 1;
    if (minWindow % 2 === 0) minWindow += 1;
    return window >= minWindow ? window : 0;
}

function solveLinearSystem(matrix, vector) {
    const n = vector.length;
    const aug = matrix.map((row, i) => row.slice().concat(vector[i]));

    for (let col = 0; col < n; col++) {
        let pivotRow = col;
        for (let row = col + 1; row < n; row++) {
            if (Math.abs(aug[row][col]) > Math.abs(aug[pivotRow][col])) pivotRow = row;
        }
        if (Math.abs(aug[pivotRow][col]) < 1e-12) return null;
        if (pivotRow !== col) [aug[col], aug[pivotRow]] = [aug[pivotRow], aug[col]];

        const pivot = aug[col][col];
        for (let j = col; j <= n; j++) aug[col][j] /= pivot;

        for (let row = 0; row < n; row++) {
            if (row === col) continue;
            const factor = aug[row][col];
            if (factor === 0) continue;
            for (let j = col; j <= n; j++) aug[row][j] -= factor * aug[col][j];
        }
    }

    return aug.map((row) => row[n]);
}

function fitQuadraticAtLap(data, centerIndex, windowLength) {
    const half = Math.floor(windowLength / 2);
    const start = Math.max(0, Math.min(centerIndex - half, data.length - windowLength));
    const end = start + windowLength;
    const centerLap = data[centerIndex].lap;

    let sumX = 0;
    let sumX2 = 0;
    let sumX3 = 0;
    let sumX4 = 0;
    let sumY = 0;
    let sumXY = 0;
    let sumX2Y = 0;

    for (let idx = start; idx < end; idx++) {
        const x = data[idx].lap - centerLap;
        const y = data[idx].timeMs / 1000;
        const x2 = x * x;

        sumX += x;
        sumX2 += x2;
        sumX3 += x2 * x;
        sumX4 += x2 * x2;
        sumY += y;
        sumXY += x * y;
        sumX2Y += x2 * y;
    }

    const coeffs = solveLinearSystem(
        [
            [windowLength, sumX, sumX2],
            [sumX, sumX2, sumX3],
            [sumX2, sumX3, sumX4],
        ],
        [sumY, sumXY, sumX2Y]
    );

    if (!coeffs || !Number.isFinite(coeffs[0])) return data[centerIndex].timeMs;
    return coeffs[0] * 1000;
}

// Savitzky-Golay smoothing over each driver's filtered laps.
// window = 1 returns the input unchanged; other supported levels use a
// quadratic local fit in seconds and preserve the original array length.
function applySmoothing(data, window) {
    if (!data || data.length < 2 || window <= 1) return data;

    const validData = data.filter((d) => d && d.timeMs != null && d.lap != null);
    if (validData.length !== data.length) return data;

    const adjustedWindow = getSavitzkyGolayWindowLength(window, data.length);
    if (!adjustedWindow) return data;

    return data.map((d, i) => Object.assign({}, d, { timeMs: fitQuadraticAtLap(data, i, adjustedWindow) }));
}

export function drawLapTimeLinePlot(sessionData, drivers) {
    const svg = d3.select("#laptime-svg");
    if (svg.empty()) return;

    const margin = { top: 70, right: 40, bottom: 60, left: 80 };
    const dims = resolveSvgSize(svg, 1600, 500);
    const width = dims.w - margin.left - margin.right;
    const height = dims.h - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    if (!drivers || !drivers.length) return;

    markTeamPrimary(drivers);

    // Compute SC/VSC regions using the shared helper, passing raw laps so
    // the helper can fall back to medians if no authoritative windows exist.
    const rawAllLapsForRegions = drivers.flatMap((d) => (d.laps || []));
    const scRegions = getScRegions(sessionData, rawAllLapsForRegions);

    // Compute per-driver baseline lap time (median) excluding SC/VSC laps and
    // excluding potential pit laps (stintLap 1/2 of subsequent stints). This
    // baseline is used to detect whether a stint-start lap is significantly
    // longer than normal and should be excluded from the lap-time line.
    const driverBaselineMs = {};
    const driverMadMs = {};
    drivers.forEach((driver, di) => {
        const key = driver.code || driver.name || String(di);
        const lapsForBaseline = ((driver.laps || [])).filter((l) => l && l.timeMs != null && !lapInRegions(l.lap, scRegions) && !(l.stint != null && l.stint > 1 && (l.stintLap === 1 || l.stintLap === 2 || l.stintLap === '1' || l.stintLap === '2')));
        if (lapsForBaseline.length) {
            const arr = lapsForBaseline.map((x) => x.timeMs).sort((a, b) => a - b);
            const median = d3.median(arr);
            driverBaselineMs[key] = median;
            // median absolute deviation
            const absDevs = arr.map((v) => Math.abs(v - median)).sort((a, b) => a - b);
            driverMadMs[key] = absDevs.length ? d3.median(absDevs) : null;
        } else {
            driverBaselineMs[key] = null;
            driverMadMs[key] = null;
        }
    });

    function isPitStopLap(l, driver) {
        if (!l) return false;
        if (l.isPitLap || l.IsPitLap || l.isPit || l.IsPit) return true;
        if (l.pitIn || l.pitOut || l.pitInTime != null || l.pitOutTime != null || l.pitLaneIn || l.pitLaneOut) return true;

        // For stint starts (stint > 1) consider lap 1 or lap 2 of the new stint
        // as pit-affected only if the lap time is significantly larger than
        // the driver's typical lap time (baseline). This avoids removing a
        // genuine fast lap that's simply the first of a stint.
        if (l.stint != null && l.stint > 1 && (l.stintLap === 1 || l.stintLap === 2 || l.stintLap === '1' || l.stintLap === '2')) {
            const key = (driver && (driver.code || driver.name)) || null;
            const baseline = key ? driverBaselineMs[key] : null;
            if (l.timeMs == null) return true;
            // if we don't have a baseline, be conservative and still treat lap 1 as pit
            if (baseline == null) {
                // treat lap1 as pit, but not lap2
                return (l.stintLap === 1 || l.stintLap === '1');
            }
            // heuristics: consider it a pit lap when it's > baseline + 4s OR 25% slower
            if (l.timeMs > baseline + 4000 || l.timeMs > baseline * 1.25) return true;
        }
        return false;
    }

    function isOutlierLap(l, driver) {
        if (!l || l.timeMs == null) return false;
        const key = driver && (driver.code || driver.name) ? (driver.code || driver.name) : null;
        const baseline = key ? driverBaselineMs[key] : null;
        const mad = key ? driverMadMs[key] : null;
        if (baseline == null) {
            // no baseline: be conservative and do not treat as outlier here
            return false;
        }
        // If MAD is available, use MAD-based threshold (3*MAD) otherwise fallback
        const madThreshold = (mad != null) ? (3 * mad) : 4000;
        // Outlier if the lap is significantly larger than baseline by MAD or absolute 4s
        if (l.timeMs - baseline > Math.max(4000, madThreshold)) return true;
        // also consider relative spike (e.g., >25%)
        if (l.timeMs > baseline * 1.25) return true;
        return false;
    }

    function isExcludedLap(l, driver) {
        if (!l) return true;
        if (l.timeMs == null) return true;
        if (isPitStopLap(l, driver)) return true;
        if (lapInRegions(l.lap, scRegions)) return true;
        if (isOutlierLap(l, driver)) return true;
        return false;
    }

    // Use valid (non-excluded) laps for plotting and axis domains
    const allLaps = drivers.flatMap((d) => (((d.lapsFiltered && d.lapsFiltered.length) ? d.lapsFiltered : d.laps) || []).filter((l) => l && l.timeMs != null && !isExcludedLap(l, d)));
    if (!allLaps.length) return;

    // Precompute provisional (cumulative) fastest times up to each lap number.
    const { cumulativeBest, cumulativeS1Best, cumulativeS2Best, cumulativeS3Best, lapNumbers, sessionBestLap } = computeCumulativeBests(allLaps);

    // Scales
    const x = d3
        .scaleLinear()
        .domain([d3.min(allLaps, (d) => d.lap), d3.max(allLaps, (d) => d.lap)])
        .range([0, width]);

    // Compute y-axis domain from smoothed, visible lap times so the range
    // adapts to the data actually displayed (respecting smoothing + filtering).
    const visibleTimesMs = [];
    drivers.forEach((driver) => {
        const raw = (((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps) || []).filter((l) => l && l.timeMs != null && !isExcludedLap(l, driver));
        const smoothed = smoothWindow > 1 ? applySmoothing(raw, smoothWindow) : raw;
        smoothed.forEach((l) => { if (l.timeMs != null) visibleTimesMs.push(l.timeMs); });
    });
    const yExtent = d3.extent(visibleTimesMs);
    // Round to nearest 0.5 s boundary for clean axis limits
    const yMin = Math.floor((yExtent[0] || 0) / 500) * 500;
    const yMax = Math.ceil((yExtent[1] || 0) / 500) * 500;

    const y = d3
        .scaleLinear()
        .domain([yMin, yMax])
        .range([height, 0]);

    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d"));
    const yAxis = d3.axisLeft(y).tickFormat(msToTimeString);

    // Grid
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#333")
        .attr("stroke-opacity", 0.6);

    // SC/VSC regions rendering removed

    // Axes
    g.append("g")
        .attr("class", "axis axis-x")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis)
        .selectAll("text")
        .attr("fill", "#eee");

    g.append("g")
        .attr("class", "axis axis-y")
        .call(yAxis)
        .selectAll("text")
        .attr("fill", "#eee");

    // Axis labels
    g.append("text")
        .attr("transform", `translate(${-margin.left + 10},${height / 2}) rotate(-90)`) 
        .attr("fill", "#eee")
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "500")
        .text("Lap time (s)");

    g.append("text")
        .attr("x", width / 2)
        .attr("y", height + 40)
        .attr("fill", "#eee")
        .attr("text-anchor", "middle")
        .attr("font-size", "13px")
        .attr("font-weight", "500")
        .text("Lap number");

    // Legend (visible drivers)
    const legendDrivers = drivers;
    const nLegend = legendDrivers.length;
    const legendRows = nLegend <= 10 ? 1 : 2;
    const perRow = Math.ceil(nLegend / legendRows);
    const legendItemWidth = Math.min(140, width / perRow);

    // place legend above the plot and ensure a larger gap so SC/VSC shading
    // cannot overlap it visually. Move legend closer to the top of the svg.
    const legendG = svg
        .append("g")
        .attr("transform", `translate(${margin.left},14)`);

    // center legend within inner width
    const totalLegendWidth = perRow * legendItemWidth;
    const startX = Math.max(0, (width - totalLegendWidth) / 2);

    legendDrivers.forEach((driver, idx) => {
        const row = Math.floor(idx / perRow);
        const col = idx % perRow;

        const x0 = startX + col * legendItemWidth;
        const y0 = row * 18;

        const lg = legendG.append("g").attr("transform", `translate(${x0},${y0})`);

        const color = getTeamColor(driver.team);
        const bright = lightenColor(color, 0.25);
        const isFirst = !!driver.isFirstDriver;
        const dash = isFirst ? null : "5,3";

        // Legend visual state: dim when a non-empty selection exists and this driver is not selected
        const legendActive = selectedDriverCodes.size === 0 || selectedDriverCodes.has(driver.code);
        lg.append("line")
            .attr("x1", 0)
            .attr("x2", 18)
            .attr("y1", 5)
            .attr("y2", 5)
            .attr("stroke", bright)
            .attr("stroke-width", isFirst ? 3 : 2)
            .attr("stroke-dasharray", dash)
            .attr("opacity", legendActive ? 0.95 : 0.22);

        lg.append("text")
            .attr("x", 22)
            .attr("y", 8)
            .attr("fill", legendActive ? "#ddd" : "#777")
            .style("font-size", "11px")
            .style("font-weight", legendActive ? 700 : 400)
            .text(driver.code);

        lg.style("cursor", "pointer").on("click", () => {
            // Toggle selection for this plot's multi-highlight set
            if (selectedDriverCodes.has(driver.code)) selectedDriverCodes.delete(driver.code);
            else selectedDriverCodes.add(driver.code);
            // If the set becomes empty, behaviour falls back to 'no selection'
            drawLapTimeLinePlot(sessionData, drivers);
        });
    });

    // Line generator - smooth curve for race pace lines
    const lineGen = d3
        .line()
        .x((d) => x(d.lap))
        .y((d) => y(d.timeMs))
        .curve(d3.curveCatmullRom.alpha(0.5));

    const linesG = g.append("g").attr("class", "lap-lines");
    const pointsG = g.append("g").attr("class", "lap-points");

    // Hover highlight circle (hidden until used)
    const hoverCircle = pointsG
        .append("circle")
        .attr("class", "hover-circle")
        .attr("r", 6.5)
        .attr("opacity", 0)
        .attr("stroke", "#101010")
        .attr("stroke-width", 1.2)
        .style("pointer-events", "none");

    // Group for multiple-driver hover points (when showing one lap for all drivers)
    const hoverPointsG = pointsG.append("g").attr("class", "hover-points");

    const pointRadius = 3; // reduced diameter approx 6px (from 4.5 radius)
    const pointThreshold = 12; // px: max distance to consider pointer 'on' a point

    // Draw lines + points
    drivers.forEach((driver) => {
        const color = getTeamColor(driver.team);
        const bright = lightenColor(color, 0.25);
        const isFirst = !!driver.isFirstDriver;
        const dash = isFirst ? null : "5,3";

        // Ensure laps have correct stint and stintLap values (stint starts at 1 and increments when compound changes).
        // Also compute a per-lap personal-best flag (`isPersonalBest`) for tooltip colouring.
        const rawLaps = (((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps) || []).filter((l) => l && l.timeMs != null && !isExcludedLap(l, driver));
        let stintCounter = 1;
        let stintLapCounter = 0;
        let lastCompound = null;
        let bestSoFar = null; // best lap time (ms) seen so far for this driver
        // Track per-driver per-sector personal bests while iterating
        let personalBests = { s1: null, s2: null, s3: null };
        const sectorBests = { cumulativeS1Best, cumulativeS2Best, cumulativeS3Best };

        const laps = rawLaps.map((lap, idx) => {
            if (idx === 0 || lap.compound !== lastCompound) {
                if (idx !== 0) stintCounter += 1;
                stintLapCounter = 1;
                lastCompound = lap.compound;
            } else {
                stintLapCounter += 1;
            }
            // copy lap object to avoid mutating original
            const copy = Object.assign({}, lap, { stint: stintCounter, stintLap: stintLapCounter });

            // compute personal-best: true if this lap is faster (lower ms) than any
            // previous lap for this driver. First lap counts as personal best.
            if (copy.timeMs != null) {
                if (bestSoFar === null || copy.timeMs < bestSoFar) {
                    copy.isPersonalBest = true;
                    bestSoFar = copy.timeMs;
                } else {
                    copy.isPersonalBest = false;
                }
            } else {
                copy.isPersonalBest = false;
            }

            // provisional fastest across all drivers up to this lap number
            if (copy.timeMs != null && cumulativeBest.has(copy.lap)) {
                copy.isProvisionalFastest = copy.timeMs === cumulativeBest.get(copy.lap);
            } else {
                copy.isProvisionalFastest = false;
            }

            normalizeSectorMs(copy);

            // Session-best lap flag
            copy.isSessionBestLap = copy.timeMs != null && copy.timeMs === sessionBestLap;

            // Sector flags: purple/green using shared helper
            personalBests = annotateSectorFlags(copy, sectorBests, personalBests);

            return copy;
        });

        // store processed laps so overlay handlers can access sector flags and markers
        driver._processedLaps = laps;

        // Apply smoothing once to the real laps; both lines and dots use these
        // values so they stay perfectly aligned.
        const displayLaps = smoothWindow > 1 ? applySmoothing(laps, smoothWindow) : laps;

        // Store the active display dataset so hover/leaderboard handlers use
        // the same smoothed (or raw) values that the dots and lines show.
        driver._displayLaps = displayLaps;

        // Build a filled sequence from lap 1..endLap for smooth plotting.
        // If driver appears to have retired (their last known lap < global max),
        // stop the line at their last known lap. For missing laps we only
        // interpolate when both previous and next known laps exist — this
        // prevents long flat "plateaus" caused by copying a single neighbour.
        const globalMaxLap = d3.max(lapNumbers);
        const knownByLap = new Map(displayLaps.map((lp) => [lp.lap, lp]));
        const knownLapsArr = Array.from(knownByLap.keys()).sort((a, b) => a - b);
        const lastKnownLap = knownLapsArr.length ? d3.max(knownLapsArr) : 0;
        const endLap = lastKnownLap && lastKnownLap < globalMaxLap ? lastKnownLap : globalMaxLap;

        const filled = [];
        for (let ln = 1; ln <= endLap; ln++) {
            if (knownByLap.has(ln)) {
                const obj = Object.assign({}, knownByLap.get(ln));
                obj.isInterpolated = false;
                filled.push(obj);
                continue;
            }

            // find previous and next known laps (within 1..endLap)
            let prev = null;
            for (let k = ln - 1; k >= 1; k--) {
                if (knownByLap.has(k)) {
                    prev = knownByLap.get(k);
                    break;
                }
            }
            let next = null;
            for (let k = ln + 1; k <= endLap; k++) {
                if (knownByLap.has(k)) {
                    next = knownByLap.get(k);
                    break;
                }
            }

            let interpTime = null;
            // Only interpolate if both neighbours exist (prevents constant-fill plateaus)
            if (prev && next && prev.timeMs != null && next.timeMs != null) {
                const t = (ln - prev.lap) / (next.lap - prev.lap || 1);
                interpTime = prev.timeMs + t * (next.timeMs - prev.timeMs);
                filled.push({ lap: ln, timeMs: interpTime, isInterpolated: true });
            } else {
                // leave an explicit gap so the line generator will break the path
                filled.push({ lap: ln, timeMs: null, isInterpolated: true });
            }
        }

        // Active when nothing selected (show all) or when this driver is in the selected set
        const active = selectedDriverCodes.size === 0 || selectedDriverCodes.has(driver.code);

        // Split filled into contiguous segments where timeMs != null so we draw
        // multiple path segments instead of a single path that contains gaps.
        const segments = [];
        let seg = [];
        filled.forEach((f) => {
            if (f.timeMs != null) {
                seg.push(f);
            } else {
                if (seg.length) {
                    segments.push(seg);
                    seg = [];
                }
            }
        });
        if (seg.length) segments.push(seg);

        // Draw each contiguous segment as its own path (no per-segment smoothing
        // needed — displayLaps already carries smoothed values via knownByLap).
        segments.forEach((segment) => {
            // compute path 'd' once so we can create both visible and hit-target paths
            const pathD = lineGen(segment);

            // visible path
            linesG
                .append("path")
                .attr("data-driver", driver.code)
                .attr("fill", "none")
                .attr("stroke", bright)
                .attr("stroke-width", active ? (isFirst ? 2.5 : 1.8) : 1.2)
                .attr("stroke-dasharray", dash)
                .attr("opacity", active ? 0.95 : 0.2)
                .attr("d", pathD)
                .style("cursor", "pointer")
                .style("pointer-events", "none")
                .attr("stroke-linecap", "round");

            // invisible wide stroke used for easier clicking (captures events)
            linesG
                .append("path")
                .attr("data-driver", driver.code)
                .attr("fill", "none")
                .attr("stroke", "transparent")
                .attr("stroke-width", Math.max(12, (isFirst ? 16 : 12)))
                .attr("d", pathD)
                .style("pointer-events", "stroke")
                .style("cursor", "pointer")
                .attr("opacity", 0)
                .on("click", () => {
                        if (selectedDriverCodes.has(driver.code)) selectedDriverCodes.delete(driver.code);
                        else selectedDriverCodes.add(driver.code);
                        drawLapTimeLinePlot(sessionData, drivers);
                    });
        });

        // Dots use the same displayLaps (already smoothed when active)
        const dotData = displayLaps.filter((p) => !p.isInterpolated);

        const pts = pointsG
            .selectAll(`.pt-${driver.code}`)
            .data(dotData)
            .enter()
            .append("circle")
            .attr("class", `lap-point pt-${driver.code}`)
            .attr("data-driver", driver.code)
            .attr("cx", (d) => x(d.lap))
            .attr("cy", (d) => y(d.timeMs))
            .attr("r", pointRadius)
            .attr("fill", (d) => TYRE_COLORS[d.compound] || color)
            .attr("stroke", "#101010")
            .attr("stroke-width", 0.8)
            .attr("opacity", active ? 1.0 : 0.2)
            .style("pointer-events", "all")
            .style("cursor", "pointer")
            .on("click", () => {
                if (selectedDriverCodes.has(driver.code)) selectedDriverCodes.delete(driver.code);
                else selectedDriverCodes.add(driver.code);
                drawLapTimeLinePlot(sessionData, drivers);
            });

        
    });

    // If drivers are selected, raise their elements to the top so they are fully visible.
    if (selectedDriverCodes.size > 0) {
        try {
            selectedDriverCodes.forEach((code) => {
                g.selectAll(`path[data-driver="${code}"]`).raise();
                g.selectAll(`circle[data-driver="${code}"]`).raise();
            });
        } catch (e) {
            // non-fatal: some browsers/environments may not support raise on empty selections
        }
    }

    // Vertical guideline
    const guide = g
        .append("line")
        .attr("class", "lap-guide")
        .attr("y1", 0)
        .attr("y2", height)
        .attr("stroke", "#888")
        .attr("stroke-dasharray", "3,3")
        .attr("opacity", 0);

    // Overlay rect left for visual layout but do not let it capture pointer events
    const overlay = g.append("rect")
        .attr("class", "mouse-overlay")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", width)
        .attr("height", height)
        .attr("fill", "transparent")
        .style("pointer-events", "none");

    // Attach mousemove / leave handlers to the SVG so the overlay does not block clicks.
    svg.on("mousemove", (event) => {
        const [mx, my] = d3.pointer(event, g.node());
        if (mx < 0 || mx > width) {
            guide.attr("opacity", 0);
            lineHideTooltip();
            hoverCircle.attr("opacity", 0);
            hoverPointsG.selectAll("circle").remove();
            return;
        }
        guide.attr("x1", mx).attr("x2", mx).attr("opacity", 0.7);

        // find nearest point (across drivers) to pointer
        const lapVal = Math.round(x.invert(mx));
        let nearest = null;
        let minDist = Infinity;
        drivers.forEach((driver) => {
            const lapsArr = (((driver._displayLaps && driver._displayLaps.length) ? driver._displayLaps : ((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps)) || []).filter((l) => l && l.timeMs != null && !isExcludedLap(l, driver));
            if (!lapsArr.length) return;
            const bi = d3.bisector((d) => d.lap).left(lapsArr, lapVal);
            [bi - 1, bi].forEach((idx) => {
                if (idx >= 0 && idx < lapsArr.length) {
                    const cand = lapsArr[idx];
                    const px = x(cand.lap);
                    const py = y(cand.timeMs);
                    const dist = Math.hypot(px - mx, py - my);
                    if (dist < minDist) {
                        minDist = dist;
                        nearest = { driver, d: cand };
                    }
                }
            });
        });

        // threshold: if pointer is close enough to an individual point, show single-driver tooltip
        if (nearest && minDist < pointThreshold) {
            showPointTooltip(event, hoverCircle, nearest.driver, nearest.d, x, y);
            // remove any multi-driver hover circles
            hoverPointsG.selectAll("circle").remove();
        } else {
            // Not close to a single point: show multi-driver summary for the nearest lap index
            const entries = [];
            drivers.forEach((driver) => {
                const lapsArr = (((driver._displayLaps && driver._displayLaps.length) ? driver._displayLaps : ((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps)) || []).filter((l) => l && l.timeMs != null && !isExcludedLap(l, driver));
                if (!lapsArr.length) return;
                const found = lapsArr.find((ll) => ll.lap === lapVal);
                if (found) entries.push({ driver, d: Object.assign({}, found) });
            });

            // annotate per-entry whether this lap is an improvement vs previous lap for that driver
            entries.forEach((e) => {
                const prev = ((((e.driver._displayLaps && e.driver._displayLaps.length) ? e.driver._displayLaps : ((e.driver.lapsFiltered && e.driver.lapsFiltered.length) ? e.driver.lapsFiltered : e.driver.laps)) || []).find((ll) => ll.lap === (lapVal - 1)));
                if (prev && prev.timeMs != null && e.d.timeMs != null) {
                    e.d.isImprovement = e.d.timeMs < prev.timeMs;
                } else {
                    e.d.isImprovement = false;
                }
            });

            // detect fastest lap among these entries for this lap (purple)
            // choose a single deterministic winner to avoid multiple purples
            const times = entries.map((e) => (e.d.timeMs == null ? Infinity : e.d.timeMs));
            const minTime = times.length ? d3.min(times) : null;
            if (minTime != null) {
                const candidates = entries.filter((e) => e.d.timeMs === minTime);
                if (candidates.length === 1) {
                    entries.forEach((e) => (e.d.isFastestThisLap = e === candidates[0]));
                } else if (candidates.length > 1) {
                    // tie-break: prefer lower finishing position, then lower meanLapMs, then driver code
                    candidates.sort((a, b) => {
                        const pa = a.driver.position != null ? a.driver.position : Infinity;
                        const pb = b.driver.position != null ? b.driver.position : Infinity;
                        if (pa !== pb) return pa - pb;
                        const ma = a.driver.meanLapMs != null ? a.driver.meanLapMs : Infinity;
                        const mb = b.driver.meanLapMs != null ? b.driver.meanLapMs : Infinity;
                        if (ma !== mb) return ma - mb;
                        if ((a.driver.code || "") < (b.driver.code || "")) return -1;
                        if ((a.driver.code || "") > (b.driver.code || "")) return 1;
                        return 0;
                    });
                    const winner = candidates[0];
                    entries.forEach((e) => (e.d.isFastestThisLap = e === winner));
                }
            } else {
                entries.forEach((e) => (e.d.isFastestThisLap = false));
            }

            if (entries.length) {
                // show consolidated tooltip and per-driver small circles
                hoverCircle.attr("opacity", 0);
                const html = buildMultiLapTooltipHTML(lapVal, entries);
                lineShowTooltip(html, event.pageX, event.pageY);

                const sel = hoverPointsG.selectAll("circle").data(entries, (e) => e.driver.code);
                sel.join(
                    (enter) =>
                        enter
                            .append("circle")
                            .attr("r", 5)
                            .attr("stroke", "#101010")
                            .attr("stroke-width", 0.9)
                            .attr("opacity", 0),
                    (update) => update,
                    (exit) => exit.remove()
                )
                    .attr("cx", (e) => x(e.d.lap))
                    .attr("cy", (e) => y(e.d.timeMs))
                    .attr("opacity", 1)
                    .attr("fill", (e) => {
                        // Prefer explicit fastest/session purple, then sector flags, then improvements
                        if (e.d.isFastestThisLap) return SECTOR_FLAG_COLORS.purple;
                        const perf = getPerformanceFlagColor(e.d);
                        if (perf) return perf;
                        if (e.d.isImprovement) return SECTOR_FLAG_COLORS.green;
                        return SECTOR_FLAG_COLORS.yellow;
                    })
                    .raise();
            } else {
                lineHideTooltip();
                hoverCircle.attr("opacity", 0);
                hoverPointsG.selectAll("circle").remove();
            }
        }
    });

    svg.on("mouseleave", () => {
        guide.attr("opacity", 0);
        lineHideTooltip();
        hoverCircle.attr("opacity", 0);
        hoverPointsG.selectAll("circle").remove();
    });

    // Add in-SVG centered title below the plot to include in exports
    try {
        const titleY = margin.top + height + 60;
        appendExportTitle(svg, sessionData, 'Lap Time Progression', margin.left + width / 2, titleY);
    } catch (e) {}

}