// racepace_violinplot.js
// Lap time distribution (Plot 3) – long, thin, smooth violin with tyre-colored dots

import { resolveSvgSize, showTooltip, hideTooltip, renderDriverXAxisTicks, appendExportTitle, computeCumulativeBests, normalizeSectorMs, annotateSectorFlags } from './plot_helpers.js';
import { getScRegions, lapInRegions } from './sc_windows_helper.js';

const VIOLIN_SECTOR_LABEL_COLORS = {
    S1: "#ff6b6b",
    S2: "#4dabff",
    S3: "#ffd86b",
};

function kernelDensityEstimator(kernel, xVals, data) {
    return xVals.map((x) => [x, d3.mean(data, (d) => kernel(x - d))]);
}

function epanechnikovKernel(bandwidth) {
    return (u) => {
        u = u / bandwidth;
        // Epanechnikov kernel: K(u) = 3/4 * (1 - u^2) for |u| <= 1, else 0.
        // Include 1/bandwidth normalization so kernel values integrate correctly
        // when averaged in `kernelDensityEstimator`.
        if (Math.abs(u) > 1) return 0;
        return (0.75 * (1 - u * u)) / bandwidth;
    };
}

function isOutlierLap(l) {
    if (!l) return false;
    return Boolean(
        l.isPitLap || l.IsPitLap || l.isPit || l.IsPit ||
        l.isScLap || l.IsScLap || l.IsSCWindow || l.isScWindow || false
    );
}

function isStatisticalOutlier(l, driver) {
    if (!l || !driver || !driver.boxplot || !Array.isArray(driver.boxplot.outliers)) return false;
    const outs = driver.boxplot.outliers || [];
    if (!outs.length || l.timeMs == null) return false;
    // consider very close matches (within 1ms) as the same value
    return outs.some((o) => o != null && Math.abs(o - l.timeMs) <= 1);
}


export function drawRacePaceViolinPlot(sessionData, drivers) {
    const svg = d3.select("#violin-svg");
    if (svg.empty()) return;

    const margin = { top: 32, right: 30, bottom: 170, left: 80 };
    const dims = resolveSvgSize(svg, 1600, 500);
    const width = dims.w - margin.left - margin.right;
    const height = dims.h - margin.top - margin.bottom;

    svg.selectAll("*").remove();

    const g = svg
        .append("g")
        .attr("transform", `translate(${margin.left},${margin.top})`);

    if (!drivers || !drivers.length) return;

    // Determine lap mapping structures (used for cumulative best and flags).
    const allLaps = drivers.flatMap((d) => ((d.laps && d.laps.length) ? d.laps : []));
    const scRegions = getScRegions(sessionData, allLaps);

    const allTimes = drivers.flatMap((d) =>
        (((d.lapsFiltered && d.lapsFiltered.length) ? d.lapsFiltered : d.laps) || [])
            .filter((l) =>
                l && l.timeMs != null && !isOutlierLap(l) &&
                !l.isScLap && !l.IsScLap && !l.IsSCWindow && !l.isScWindow &&
                !lapInRegions(l.lap, scRegions) &&
                !isStatisticalOutlier(l, d)
            )
            .map((l) => l.timeMs)
    );
    if (!allTimes.length) return;

    // Precompute provisional (cumulative) best lap times and sector times up to each lap
    const { cumulativeBest, cumulativeS1Best, cumulativeS2Best, cumulativeS3Best } = computeCumulativeBests(allLaps);

    const x = d3
        .scaleBand()
        .domain(drivers.map((d) => d.code))
        .range([0, width])
        .paddingInner(0.2)
        .paddingOuter(0.05);

    const y = d3
        .scaleLinear()
        .domain(d3.extent(allTimes))
        .nice()
        .range([height, 0]);

    const xAxis = d3.axisBottom(x).tickFormat(() => "");
    const yAxis = d3.axisLeft(y).tickFormat(msToTimeString);

    // Grid
    g.append("g")
        .attr("class", "grid")
        .call(d3.axisLeft(y).tickSize(-width).tickFormat(""))
        .selectAll("line")
        .attr("stroke", "#333")
        .attr("stroke-opacity", 0.6);

    // Y axis
    g.append("g")
        .attr("class", "axis axis-y")
        .call(yAxis)
        .selectAll("text")
        .attr("fill", "#eee");

    // Y label - centered and rotated like box plot
    g.append("text")
        .attr("transform", `translate(${ -margin.left + 20 }, ${height / 2}) rotate(-90)`) 
        .attr("fill", "#eee")
        .attr("font-size", "13px")
        .attr("font-weight", "500")
        .attr("text-anchor", "middle")
        .text("Lap time (s)");

    const xAxisG = g
        .append("g")
        .attr("class", "axis axis-x")
        .attr("transform", `translate(0,${height})`)
        .call(xAxis);

    xAxisG.select(".domain").remove();

    // Custom driver ticks: use the same badge + mean + strategy layout as box plot
    renderDriverXAxisTicks(xAxisG, drivers, x);

    const maxHalfWidth = x.bandwidth() * 0.35; // long, thin
    const bandwidth = (d3.deviation(allTimes) || 1000) * 0.6;

    const yValues = d3.range(
        y.domain()[0],
        y.domain()[1],
        (y.domain()[1] - y.domain()[0]) / 120
    );
    const kernel = epanechnikovKernel(bandwidth);

    const violins = g
        .selectAll(".violin")
        .data(drivers)
        .enter()
        .append("g")
        .attr("class", "violin")
        .attr(
            "transform",
            (d) => `translate(${x(d.code) + x.bandwidth() / 2},0)`
        );

    // Draw violin shapes and cache KDE + vScale per driver so dots can be constrained inside the shape
    violins.each(function (driver) {
        const times = (((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps) || [])
            .filter((l) =>
                l && l.timeMs != null && !isOutlierLap(l) &&
                !l.isScLap && !l.IsScLap && !l.IsSCWindow && !l.isScWindow &&
                !lapInRegions(l.lap, scRegions) && !isStatisticalOutlier(l, driver)
            )
            .map((l) => l.timeMs);
        if (!times.length) return;

        const kde = kernelDensityEstimator(kernel, yValues, times);

        // Compute min/max and add a small padding so tails don't cut abruptly.
        const minT = d3.min(times);
        const maxT = d3.max(times);
        const range = Math.max(1, maxT - minT);
        const pad = Math.max(range * 0.06, 150); // 6% of range or at least 150ms
        const lower = Math.max(y.domain()[0], minT - pad);
        const upper = Math.min(y.domain()[1], maxT + pad);

        // Keep KDE points inside the padded bounds, and apply a linear taper
        // so density smoothly falls toward zero near the padded edges. This
        // produces a gradual tail instead of a sharp cutoff.
        let trimmedKde = kde
            .filter((p) => p[0] >= lower && p[0] <= upper)
            .map((p) => {
                const yVal = p[0];
                let dens = p[1];
                if (yVal < minT) {
                    const denom = (minT - lower) || 1;
                    const t = (yVal - lower) / denom; // 0..1
                    dens = dens * t;
                } else if (yVal > maxT) {
                    const denom = (upper - maxT) || 1;
                    const t = (upper - yVal) / denom; // 0..1
                    dens = dens * t;
                }
                return [yVal, Math.max(0, dens)];
            });

        if (!trimmedKde.length) trimmedKde = kde.filter((p) => p[0] >= minT && p[0] <= maxT) || kde;

        const maxDensity = d3.max(trimmedKde, (d) => d[1]) || 1;

        const vScale = d3
            .scaleLinear()
            .domain([0, maxDensity])
            .range([0, maxHalfWidth]);

        // attach trimmed KDE and vScale for later use (dot placement)
        driver._kde = trimmedKde;
        driver._vScale = vScale;

        const area = d3
            .area()
            .x0((d) => -vScale(d[1]))
            .x1((d) => vScale(d[1]))
            .y((d) => y(d[0]))
            .curve(d3.curveCatmullRom);

        const color = getTeamColor(driver.team, driver._teamColor);
        const bright = lightenColor(color, 0.25);

        d3.select(this)
            .append("path")
            .datum(trimmedKde)
            .attr("d", area)
            .attr("fill", color)
            .attr("fill-opacity", 0.40)
            .attr("stroke", color)
            .attr("stroke-width", 1.6);
    });

    // Dots inside the violin: constrain x jitter using the computed KDE/vScale
    function getDensityAt(kde, time) {
        // kde is array of [y, density]; find nearest y
        const bis = d3.bisector((d) => d[0]).left;
        const i = bis(kde, time);
        if (i <= 0) return kde[0][1];
        if (i >= kde.length) return kde[kde.length - 1][1];
        const a = kde[i - 1];
        const b = kde[i];
        // linear interpolate
        const t = (time - a[0]) / (b[0] - a[0] || 1);
        return a[1] + t * (b[1] - a[1]);
    }

    violins.each(function (driver) {
        const base = d3.select(this);
        // normalize laps and annotate sector/lap flags consistent with provisional & personal-best rules
        let personalBests = { s1: null, s2: null, s3: null };
        const bests = { cumulativeS1Best, cumulativeS2Best, cumulativeS3Best };
        const laps = (((driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : driver.laps) || [])
            .filter((l) =>
                l && l.timeMs != null && !isOutlierLap(l) &&
                !l.isScLap && !l.IsScLap && !l.IsSCWindow && !l.isScWindow &&
                !lapInRegions(l.lap, scRegions) && !isStatisticalOutlier(l, driver)
            )
            .map((lap) => {
                const copy = Object.assign({}, lap);
                normalizeSectorMs(copy);

                // provisional fastest up to this lap
                copy.isProvisionalFastest = copy.timeMs != null && cumulativeBest.get(copy.lap) != null && copy.timeMs === cumulativeBest.get(copy.lap);

                // per-sector flags using cumulative provisional bests and per-driver personal bests
                personalBests = annotateSectorFlags(copy, bests, personalBests);

                return copy;
            });
        if (!laps.length) return;

        const kde = driver._kde || [];
        const vScale = driver._vScale || d3.scaleLinear().range([0, maxHalfWidth]);

        base
            .selectAll(".violin-dot")
            .data(laps)
            .enter()
            .append("circle")
            .attr("class", "violin-dot")
            .attr("cx", (d) => {
                const dens = getDensityAt(kde, d.timeMs) || 0;
                const half = vScale(dens) || 0;
                // random uniform within [-half*0.9, half*0.9]
                return (Math.random() * 2 - 1) * half * 0.9;
            })
            .attr("cy", (d) => y(d.timeMs))
            .attr("r", 2.5)
            .attr("fill", (d) => {
                // stronger, more vivid fills for medium/hard compounds specifically
                const c = (d && d.compound) ? String(d.compound).trim() : "";
                if (c === 'M' || /medium/i.test(c)) return '#FFD400'; // vivid yellow
                if (c === 'H' || /hard/i.test(c)) return '#FFFFFF'; // bright white
                if (c === 'S' || /soft/i.test(c)) return TYRE_COLORS['S'] || '#C42124';
                return TYRE_COLORS[c] || '#FFFFFF';
            })
            .attr("stroke", "#111")
            .attr("stroke-width", 1)
            .on("mousemove", (event, d) => {
                const lapStr = msToTimeString(d.timeMs);
                const lapIsPurple = Boolean(d.isProvisionalFastest || d.isPurpleLap);
                const lapIsGreen = Boolean(d.isPersonalBest || d.isImprovement);
                let lapLabel = `<b>${lapStr}</b>`;
                if (lapIsPurple) {
                    lapLabel = `<span style="color:${SECTOR_FLAG_COLORS.purple};font-weight:700">${lapStr}</span>`;
                } else if (lapIsGreen) {
                    lapLabel = `<span style="color:${SECTOR_FLAG_COLORS.green};font-weight:700">${lapStr}</span>`;
                }

                const sectorBox = (label, ms, flagKey, secKey) => {
                    // default to yellow when no explicit sector flag exists
                    const flagColor =
                        SECTOR_FLAG_COLORS[flagKey || "yellow"] ||
                        SECTOR_FLAG_COLORS.yellow;
                    const labelColor =
                        VIOLIN_SECTOR_LABEL_COLORS[secKey] || "#ffffff";
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
                const header = driver.fullName ? `${headerName}` : `${driver.code} — ${headerName}`;
                const html = `
                    <div><strong style="color:${getTeamColor(driver.team, driver._teamColor)}">${header}</strong> — ${driver.team}</div>
                    <div>Lap ${d.lap}: ${lapLabel}</div>
                    <div>Tyre: <span style="color:${TYRE_COLORS[d.compound] || "#ccc"}"><strong>${d.compound}</strong></span>, Stint ${d.stint} lap ${d.stintLap}</div>
                    ${sectorBox("S1", d.s1Ms, d.s1Flag, "S1")}
                    ${sectorBox("S2", d.s2Ms, d.s2Flag, "S2")}
                    ${sectorBox("S3", d.s3Ms, d.s3Flag, "S3")}
                `;
                showTooltip(html, event.pageX, event.pageY);
            })
            .on("mouseleave", hideTooltip);
    });

    // Add in-SVG centered title below the plot to include in exports
    try {
        const titleY = margin.top + height + 120;
        appendExportTitle(svg, sessionData, 'Lap Time Distribution', margin.left + width / 2, titleY);
    } catch(e) {}
}