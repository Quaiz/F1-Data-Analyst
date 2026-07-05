// position_lineplot.js
// Lap-by-lap position plot (Plot 4)

// Multi-select set for Plot 4: clicking lines/dots/labels toggles drivers
// in this Set. When non-empty, drivers not in the Set are visually blurred.
let selectedPositionDriverCodes = new Set();

import { resolveSvgSize, showTooltip as posShowTooltip, hideTooltip as posHideTooltip, markTeamPrimary, normalizeCompound } from './plot_helpers.js';
import { getScRegions, renderScRegions } from './sc_windows_helper.js';

// Pull shared config from global scope (config.js is loaded as a classic script, not a module).
// In some browsers, top-level `const` from classic scripts is not accessible inside modules.
const TYRE_COLORS = (typeof window !== 'undefined' && window.TYRE_COLORS) ? window.TYRE_COLORS : {};
const getTeamColorSafe = (team, fallback) => {
    try { return (typeof window !== 'undefined' && typeof window.getTeamColor === 'function') ? window.getTeamColor(team, fallback) : (fallback || '#999'); }
    catch (e) { return fallback || '#999'; }
};
const lightenColorSafe = (hex, amount) => {
    try { return (typeof window !== 'undefined' && typeof window.lightenColor === 'function') ? window.lightenColor(hex, amount) : hex; }
    catch (e) { return hex; }
};

export function drawPositionLinePlot(sessionData, drivers) {
    const svg = d3.select("#position-svg");
    if (svg.empty()) return;

    svg.selectAll("*").remove();

    if (!drivers || !drivers.length) return;

    markTeamPrimary(drivers);

    // ── Compute data requirements before layout ──
    const allLaps = drivers.flatMap((d) => d.laps || []);
    if (!allLaps.length) return;

    const lapNumbers = Array.from(new Set(allLaps.map((d) => d.lap))).sort((a, b) => a - b);
    // include lap 0 (starting/grid position) at the beginning
    if (!lapNumbers.includes(0)) lapNumbers.unshift(0);
    const maxLap = d3.max(lapNumbers);

    // Determine SC/VSC regions to shade (use authoritative sessionData windows when available)
    const regions = getScRegions(sessionData, allLaps);

    // Determine position domain (1 .. maxPosition)
    const raceYear = (sessionData && sessionData.meta && sessionData.meta.year) ? Number(sessionData.meta.year) : null;
    const gridSize = (raceYear != null && raceYear < 2026) ? 20 : 22;
    const allPositions = drivers.map((d) => d.position).filter((p) => p != null);
    const maxPosition = allPositions.length ? d3.max(allPositions) : gridSize;
    const numPositions = Math.max(maxPosition, gridSize);

    // ── Adaptive layout: derive canvas size from data ──
    const ROW_H = 26;   // px between adjacent position rows
    const yPad  = 14;   // vertical breathing room above P1 / below last position
    const xPad  = 14;   // horizontal inset so start/end labels stay inside the plot

    const margin = { top: 48, right: 100, bottom: 80, left: 90 };

    // SVG width: honour existing container width, fall back to 1600
    const svgNode = svg.node();
    const parentRect = svgNode.parentElement ? svgNode.parentElement.getBoundingClientRect() : null;
    const svgW = Math.round(
        (parentRect && parentRect.width > 0) ? parentRect.width
        : (parseInt(svg.attr('width')) || 1600)
    );

    // Plot-area height adapts to position count
    const height = 2 * yPad + (numPositions - 1) * ROW_H;
    const svgH   = margin.top + height + margin.bottom;
    const width  = svgW - margin.left - margin.right;

    // Apply computed dimensions; mark as 'fixed' so global sizing system skips this SVG
    svg.attr('width', svgW).attr('height', svgH)
       .attr('viewBox', `0 0 ${svgW} ${svgH}`)
       .classed('fixed', true);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    // background click area (placed first so it doesn't block interactive elements)
    g.append("rect").attr("class", "bg-click")
        .attr("x", 0).attr("y", 0)
        .attr("width", width).attr("height", height)
        .attr("fill", "transparent")
        .on("click", () => {
            selectedPositionDriverCodes.clear();
            drawPositionLinePlot(sessionData, drivers);
        });

    // ── Scales with inner padding ──
    const x = d3.scaleLinear().domain(d3.extent(lapNumbers)).range([xPad, width - xPad]);
    const y = d3.scaleLinear().domain([1, numPositions]).range([yPad, height - yPad]);

    // ── Grid lines, SC regions, X axis ──
    const xAxis = d3.axisBottom(x).tickFormat(d3.format("d")).ticks(Math.min(12, lapNumbers.length));

    const posTicks = d3.range(1, numPositions + 1);
    const gridG = g.append("g").attr("class", "grid");
    gridG.selectAll("line.pos-grid").data(posTicks).enter().append("line")
        .attr("class", "pos-grid")
        .attr("x1", 0)
        .attr("x2", width)
        .attr("y1", (d) => y(d))
        .attr("y2", (d) => y(d))
        .attr("stroke", "#333")
        .attr("stroke-opacity", 0.5)
        .attr("stroke-dasharray", "2,4");

    // SC/VSC regions rendering removed

    // Axes: draw X axis only (Y axis removed to reduce clutter; positions shown inline on labels)
    g.append("g").attr("class", "axis axis-x").attr("transform", `translate(0,${height})`).call(xAxis).selectAll("text").attr("fill", "#ddd");
    g.append("text").attr("x", width / 2).attr("y", height + 36).attr("fill", "#ddd").attr("text-anchor", "middle").attr("font-size", "12px").text("Lap number");

    // Line generator for positions (straight segments)
    const lineGen = d3.line().defined((d) => d.position != null).x((d) => x(d.lap)).y((d) => y(d.position)).curve(d3.curveLinear);

    const linesG = g.append("g").attr("class", "position-lines");
    const pointsG = g.append("g").attr("class", "position-points");
    // Collect per-driver completed lapPoints for overlay/tooltips
    const driversLapPointsArr = [];

    // draw each driver
    drivers.forEach((driver) => {
        const color = getTeamColorSafe(driver.team, driver._teamColor);
        const bright = lightenColorSafe(color, 0.25);
        const isFirst = !!driver.isFirstDriver;
        const dash = isFirst ? null : "5,3";

        const laps = (driver.laps || []).map((l) => ({ lap: l.lap, position: l.position != null ? l.position : null, compound: l.compound, stint: l.stint, stintLap: l.stintLap }));
        // note: the backend doesn't attach position per lap, so we need to compute
        // positions by reconstructing from sessionData.laps. If lap objects already
        // include `position` then use them; otherwise, infer from sessionData (driver ordering per lap)
        const hasPositions = laps.some((l) => l.position != null);
        let lapPoints = laps;
        if (!hasPositions && sessionData && sessionData.laps) {
            // tolerate varied JSON schemas (different key casing/names)
            const getDriverCode = (rec) => (rec.Driver || rec.driver || rec.DriverCode || rec.Abbreviation || rec.Abbrev || rec.code || '').toString();
            const getLapNum = (rec) => (rec.lap != null ? rec.lap : (rec.LapNumber != null ? rec.LapNumber : (rec.Lap != null ? rec.Lap : null)));
            const getPos = (rec) => (rec.position != null ? rec.position : (rec.Position != null ? rec.Position : null));
            const getCompound = (rec) => (rec.compound != null ? rec.compound : (rec.Compound != null ? rec.Compound : null));
            const getStint = (rec) => (rec.stint != null ? rec.stint : (rec.Stint != null ? rec.Stint : null));
            const getStintLap = (rec) => (rec.stintLap != null ? rec.stintLap : (rec.StintLap != null ? rec.StintLap : null));

            lapPoints = sessionData.laps
                .filter((s) => {
                    try { return getDriverCode(s).toUpperCase() === (driver.code || '').toString().toUpperCase(); } catch (e) { return false; }
                })
                .map((d) => ({
                    lap: Number(getLapNum(d)),
                    position: (getPos(d) != null ? Number(getPos(d)) : null),
                    compound: getCompound(d),
                    stint: getStint(d),
                    stintLap: getStintLap(d),
                }));
        }

        // Determine starting/grid position. Priority:
        // 1) `GridPosition`/`Grid` from sessionData.results or sessionData.drivers (if available and not -1)
        // 2) lap-1 `Position` from sessionData.laps (fallback)
        let startPos = null;
        if (sessionData) {
            // Try results-like records first
            const resultCandidates = sessionData.results || sessionData.drivers || [];
            const matchDriverCode = (s) => {
                try {
                    const candidates = [s.Abbreviation, s.Abbrev, s.Abbr, s.Driver, s.DriverCode, s.code, s.DriverId];
                    const up = (driver.code || '').toString().toUpperCase();
                    return candidates.some((c) => (c || '').toString().toUpperCase() === up);
                } catch (e) { return false; }
            };
            for (const r of (resultCandidates || [])) {
                if (!r) continue;
                try {
                    if (matchDriverCode(r)) {
                        const gp = (r.GridPosition != null ? r.GridPosition : (r.Grid != null ? r.Grid : (r.grid != null ? r.grid : null)));
                        if (gp != null && gp !== -1) { startPos = Number(gp); break; }
                    }
                } catch (e) { continue; }
            }

            // Fallback: lap 1 position from sessionData.laps
            if (startPos == null && sessionData.laps) {
                const getDriverCode = (rec) => (rec.Driver || rec.driver || rec.DriverCode || rec.Abbreviation || rec.Abbrev || rec.code || '').toString();
                const getLapNum = (rec) => (rec.lap != null ? rec.lap : (rec.LapNumber != null ? rec.LapNumber : (rec.Lap != null ? rec.Lap : null)));
                const getPos = (rec) => (rec.position != null ? rec.position : (rec.Position != null ? rec.Position : null));

                const firstLapRecord = sessionData.laps.find((s) => {
                    try {
                        return getDriverCode(s).toUpperCase() === (driver.code || '').toString().toUpperCase()
                            && Number(getLapNum(s)) === 1
                            && (getPos(s) != null);
                    } catch (e) {
                        return false;
                    }
                });
                if (firstLapRecord) startPos = Number(getPos(firstLapRecord));
            }
        }
        const firstLapData = (lapPoints && lapPoints.length) ? lapPoints.slice().sort((a, b) => a.lap - b.lap)[0] : (driver.laps && driver.laps.length ? driver.laps.slice().sort((a,b)=>a.lap-b.lap)[0] : null);
        const startCompound = firstLapData && firstLapData.compound ? firstLapData.compound : null;
        const startStint = firstLapData && firstLapData.stint != null ? firstLapData.stint : (firstLapData ? 1 : null);
        if (startPos != null && !lapPoints.some((lp) => lp.lap === 0)) {
            lapPoints.unshift({ lap: 0, position: startPos, compound: startCompound, stint: startStint, stintLap: 1 });
        }

        // Build complete lapPoints for every lap (do not drop laps during SC/VSC).
        // Fill missing laps by forward-fill or fallbacks (first known position, final driver position, or 99).
        const lapMap = new Map(lapPoints.map((p) => [p.lap, p]));
        const completeLapPoints = lapNumbers.map((ln) => {
            const existing = lapMap.get(ln);
            return existing ? { ...existing } : { lap: ln, position: null, compound: null, stint: null, stintLap: null };
        });

        // forward-fill positions between known laps; but don't extend beyond last actual lap
        // Do NOT back-fill earlier laps from the first known later position. Only
        // forward-fill when we've already observed a known position (lastPos != null).
        let lastPos = null;
        // determine last actual lap for this driver (from original lapMap keys)
        const originalLaps = Array.from(lapMap.keys());
        const lastActualLap = originalLaps.length ? Math.max(...originalLaps) : null;
        for (let i = 0; i < completeLapPoints.length; i++) {
            const ln = completeLapPoints[i].lap;
            if (completeLapPoints[i].position == null) {
                // only forward-fill when we have a previous known position and
                // only up to lastActualLap (if known). After that, keep null so line stops.
                if (lastPos != null && (lastActualLap == null || ln <= lastActualLap)) {
                    completeLapPoints[i].position = lastPos;
                } else {
                    completeLapPoints[i].position = null;
                }
            } else {
                lastPos = completeLapPoints[i].position;
            }
        }
        lapPoints = completeLapPoints;

        if (!lapPoints.length) return;

        // store for overlay hover logic
        driversLapPointsArr.push({ driver, lapPoints });

        // Active when nothing selected (show all) or when this driver is in the selected set
        const active = selectedPositionDriverCodes.size === 0 || selectedPositionDriverCodes.has(driver.code);

        // compute sorted data and the path `d` once so we can add a separate
        // invisible wide stroke for hit-testing (makes clicking the line easy)
        const sortedLapPoints = lapPoints.sort((a, b) => a.lap - b.lap);
        const pathD = lineGen(sortedLapPoints);

        // visible path (non-interactive; interactions handled by the hidden stroke)
        linesG
            .append("path")
            .attr("data-driver", driver.code)
            .attr("fill", "none")
            .attr("stroke", bright)
            .attr("stroke-width", active ? (isFirst ? 2.8 : 2.0) : 1.0)
            .attr("stroke-dasharray", dash)
            .attr("opacity", active ? 0.95 : 0.18)
            .attr("stroke-linejoin", "round")
            .attr("stroke-linecap", "round")
            .attr("d", pathD)
            .style("pointer-events", "stroke")
            .style("cursor", "pointer")
            .on("click", () => {
                if (selectedPositionDriverCodes.has(driver.code)) selectedPositionDriverCodes.delete(driver.code);
                else selectedPositionDriverCodes.add(driver.code);
                drawPositionLinePlot(sessionData, drivers);
            });

        // Invisible wide stroke for click / hover capture
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
                if (selectedPositionDriverCodes.has(driver.code)) selectedPositionDriverCodes.delete(driver.code);
                else selectedPositionDriverCodes.add(driver.code);
                drawPositionLinePlot(sessionData, drivers);
            });

        // Draw small dots for every lap to match the "tyre-colored points" style.
        // These dots are lightweight and provide hover context (lap/tyre/position).
        try {
            const perLapDots = lapPoints
                .filter((d) => d && d.position != null && d.lap != null && d.lap > 0)
                .map((d) => ({ ...d, compound: normalizeCompound(d.compound) || d.compound || null }));

            pointsG
                .selectAll(`.posdot-${driver.code}`)
                .data(perLapDots)
                .enter()
                .append("circle")
                .attr("class", `posdot-${driver.code}`)
                .attr("cx", (d) => x(d.lap))
                .attr("cy", (d) => y(d.position))
                .attr("r", 2.0)
                .attr("fill", (d) => TYRE_COLORS[d.compound] || bright)
                .attr("opacity", active ? 0.9 : 0.12)
                .style("pointer-events", "all")
                .style("cursor", "pointer");
        } catch (e) {}

        // big dots for tyre changes (stintLap === 1) — draw outer coloured circle and inner white core
        // Identify stint-start tyre-change points. We want to avoid collapsing
        // genuine long same-tyre stints while still suppressing tiny telemetry
        // split stints. Build contiguous runs of same-compound stints and
        // collapse a run only if any stint in the run is short (<= threshold).
        const threshold = 2; // keep in sync with `stintMergeThreshold` default in main.js
        const rawTyreChanges = lapPoints.filter((d) => d.stintLap === 1 && d.position != null).sort((a, b) => a.lap - b.lap);

        // Build stint -> laps mapping from the lapPoints so we can measure stint lengths
        const stintMap = new Map();
        lapPoints.forEach((p) => {
            const s = p.stint;
            if (s == null) return;
            if (!stintMap.has(s)) stintMap.set(s, { stint: s, compound: normalizeCompound(p.compound) || null, laps: [] });
            stintMap.get(s).laps.push(p);
        });

        // Build ordered stintInfos for runs
        const stintInfos = Array.from(stintMap.values()).sort((a, b) => a.stint - b.stint);
        const runs = [];
        let cur = null;
        for (const s of stintInfos) {
            if (!s.compound) {
                if (cur) { runs.push(cur); cur = null; }
                runs.push([s]);
                continue;
            }
            if (!cur) cur = [s];
            else if (s.compound === cur[cur.length - 1].compound) cur.push(s);
            else { runs.push(cur); cur = [s]; }
        }
        if (cur) runs.push(cur);

        // Decide which stint-starts to include as markers: for a run, if any
        // stint is short (<= threshold) collapse the run (only first marker).
        // If all stints in the run are long (> threshold), show a marker for
        // every stint in that run.
        const includedStints = new Set();
        for (const run of runs) {
            if (run.length <= 1) {
                includedStints.add(run[0].stint);
                continue;
            }
            const anyShort = run.some((r) => (r.laps && r.laps.length) ? r.laps.length <= threshold : true);
            if (anyShort) {
                includedStints.add(run[0].stint);
            } else {
                run.forEach((r) => includedStints.add(r.stint));
            }
        }

        // If we inserted a synthetic lap 0 for the starting stint, prefer the
        // lap 0 marker and suppress any other markers for the same stint
        // (e.g., a lap 1 marker). This ensures the compound dot appears only
        // at the starting position.
        const lap0Entry = lapPoints.find((p) => p.lap === 0 && p.stintLap === 1 && p.stint != null);
        const lap0Stint = lap0Entry ? lap0Entry.stint : null;
        const tyreChanges = rawTyreChanges.filter((tc) => {
            if (!includedStints.has(tc.stint)) return false;
            if (lap0Stint != null && tc.stint === lap0Stint && tc.lap > 0) return false;
            return true;
        });
        const changeG = pointsG.selectAll(`.stint-${driver.code}`).data(tyreChanges).enter().append("g").attr("class", (d) => `stint-${driver.code}`);
        changeG
            .append("circle")
            .attr("cx", (d) => x(d.lap))
            .attr("cy", (d) => y(d.position))
            .attr("r", 6)
            .attr("fill", (d) => TYRE_COLORS[d.compound] || color)
            .attr("stroke", "#101010")
            .attr("stroke-width", 1.4)
            .attr("opacity", active ? 1 : 0.22);
        changeG
            .append("circle")
            .attr("cx", (d) => x(d.lap))
            .attr("cy", (d) => y(d.position))
            .attr("r", 3)
            .attr("fill", "#ffffff")
            .attr("opacity", active ? 0.95 : 0.2)
            .attr("pointer-events", "none");

        // tyre-change markers are clickable and hoverable to focus driver and show details
        changeG
            .on("click", (event, d) => {
                if (selectedPositionDriverCodes.has(driver.code)) selectedPositionDriverCodes.delete(driver.code);
                else selectedPositionDriverCodes.add(driver.code);
                drawPositionLinePlot(sessionData, drivers);
            })
            .style("cursor", "pointer");

        // driver labels at begin and end of each line
        const sorted = lapPoints.slice().sort((a, b) => a.lap - b.lap);
        const first = sorted.find((p) => p.position != null) || sorted[0];
        const last = [...sorted].reverse().find((p) => p.position != null) || sorted[sorted.length - 1];

        // driver code labels at the start and end of the line (abbreviation)
        g.append("text")
            .attr("x", x(first.lap) - 8)
            .attr("y", y(first.position))
            .attr("text-anchor", "end")
            .attr("dy", "0.35em")
            .attr("fill", getTeamColorSafe(driver.team, driver._teamColor))
            .attr("data-driver", driver.code)
            .style("font-weight", 700)
            .style("font-size", "11px")
            .attr("opacity", active ? 1 : 0.3)
            .style("cursor", "pointer")
            .text(driver.code + (first.position != null ? ` (P${first.position})` : ""))
            .on('click', () => {
                if (selectedPositionDriverCodes.has(driver.code)) selectedPositionDriverCodes.delete(driver.code);
                else selectedPositionDriverCodes.add(driver.code);
                drawPositionLinePlot(sessionData, drivers);
            });

        g.append("text")
            .attr("x", x(last.lap) + 8)
            .attr("y", y(last.position))
            .attr("text-anchor", "start")
            .attr("dy", "0.35em")
            .attr("fill", getTeamColorSafe(driver.team, driver._teamColor))
            .attr("data-driver", driver.code)
            .style("font-weight", 700)
            .style("font-size", "11px")
            .attr("opacity", active ? 1 : 0.3)
            .style("cursor", "pointer")
            .text(driver.code + (last.position != null ? ` (P${last.position})` : ""))
            .on('click', () => {
                if (selectedPositionDriverCodes.has(driver.code)) selectedPositionDriverCodes.delete(driver.code);
                else selectedPositionDriverCodes.add(driver.code);
                drawPositionLinePlot(sessionData, drivers);
            });
    });

    // Mouse overlay to show hover info for any lap/position
    const overlay = g.append('rect')
        .attr('class', 'pos-mouse-overlay')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', width)
        .attr('height', height)
        .attr('fill', 'transparent')
        .style('pointer-events', 'all');

    overlay.on('mousemove', (event) => {
        const [mx, my] = d3.pointer(event);
        if (mx < 0 || mx > width || my < 0 || my > height) {
            posHideTooltip();
            return;
        }

        const lapVal = Math.round(x.invert(mx));

        // gather entries for this lap across drivers
        const entries = [];
        driversLapPointsArr.forEach((pd) => {
            const found = pd.lapPoints.find((p) => p.lap === lapVal);
            if (found && found.position != null) {
                entries.push({ driver: pd.driver, d: found });
            }
        });

        // if nothing to show, hide tooltip
        if (!entries.length) {
            posHideTooltip();
            return;
        }

        // find nearest driver point to pointer (distance in px)
        let nearest = null;
        let minDist = Infinity;
        entries.forEach((e) => {
            const px = x(e.d.lap);
            const py = y(e.d.position);
            const dist = Math.hypot(px - mx, py - my);
            if (dist < minDist) {
                minDist = dist;
                nearest = e;
            }
        });

        const pointThreshold = 12; // px
        if (nearest && minDist < pointThreshold) {
            // show single-driver tooltip
            const d = nearest.d;
            const drv = nearest.driver;
            let stratTextSingle = 'N/A';
            if (drv.strategy && drv.strategy.length) {
                stratTextSingle = drv.strategy
                    .map((c) => `<strong style="color:${TYRE_COLORS[c] || '#ccc'};font-weight:700">${c}</strong>`)
                    .join('<span style="color:#cccccc">-</span>');
            }
            const html = `<div style="font-weight:700;color:${getTeamColorSafe(drv.team, drv._teamColor)}">${drv.code} · ${drv.fullName || drv.name}</div>` +
                `<div>Lap: <strong>${d.lap}</strong></div>` +
                `<div>Position: <strong>${d.position != null ? 'P' + d.position : 'N/A'}</strong></div>` +
                `<div>Tyre: <span style="color:${TYRE_COLORS[d.compound] || '#ccc'}"><strong>${d.compound || 'N/A'}</strong></span></div>` +
                `<div>Stint: <strong>${d.stint != null ? d.stint : 'N/A'}</strong>, Stint lap: <strong>${d.stintLap != null ? d.stintLap : 'N/A'}</strong></div>` +
                `<div>Strategy: ${stratTextSingle}</div>`;
            posShowTooltip(html, event.pageX, event.pageY);
        } else {
            // show multi-driver summary for this lap
            const rows = entries
                .sort((a, b) => (a.d.position || Infinity) - (b.d.position || Infinity))
                .map((e) => {
                    const d = e.d;
                    const drv = e.driver;
                    return `<div style="margin-top:6px;"><span style="display:inline-block;width:70px;color:${getTeamColorSafe(drv.team, drv._teamColor)};font-weight:700">${drv.code}</span>` +
                        `<span style="display:inline-block;width:120px">${drv.fullName || drv.name}</span>` +
                        `<span style="display:inline-block;width:70px">${d.position != null ? 'P' + d.position : 'N/A'}</span>` +
                        `<span style="display:inline-block;width:60px;color:${TYRE_COLORS[d.compound] || '#ccc'}"><strong>${d.compound || ''}</strong></span>` +
                        `<span style="display:inline-block;width:80px">Stint ${d.stint || 'N/A'} (${d.stintLap || 'N/A'})</span></div>`;
                })
                .join('');
            const html = `<div><strong>Lap ${lapVal}</strong></div>${rows}`;
            posShowTooltip(html, event.pageX, event.pageY);
        }
    }).on('mouseleave', () => posHideTooltip());

    // If drivers are selected, raise their elements to the top so they are fully visible.
    if (selectedPositionDriverCodes.size > 0) {
        try {
            selectedPositionDriverCodes.forEach((code) => {
                g.selectAll(`path[data-driver="${code}"]`).raise();
                g.selectAll(`.stint-${code}`).raise();
                g.selectAll(`text[data-driver="${code}"]`).raise();
            });
        } catch (e) {
            // non-fatal
        }
    }

    // (background click handled by the top `bg-click` rect placed before other elements)
    // Add in-SVG centered title below the plot to include in exports
    try {
        const eventName = (sessionData && sessionData.meta && sessionData.meta.eventName) ? sessionData.meta.eventName : '';
        const year = (sessionData && sessionData.meta && sessionData.meta.year) ? sessionData.meta.year : '';
        const sess = (sessionData && sessionData.meta && sessionData.meta.sessionName) ? sessionData.meta.sessionName : '';
        const titleText = `${eventName} ${year} ${sess} - Race Position Timeline`.trim();
        const titleY = svgH - 12;
        svg.append('text')
            .attr('class', 'svg-plot-title')
            .attr('x', margin.left + width / 2)
            .attr('y', titleY)
            .attr('text-anchor', 'middle')
            .text(titleText);
    } catch (e) {}
}
