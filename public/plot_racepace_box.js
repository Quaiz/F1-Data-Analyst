// racepace_boxplot.js
// Race pace box plot (Plot 1)

import { resolveSvgSize, showTooltip, hideTooltip, renderDriverXAxisTicks, appendExportTitle, normalizeCompound } from './plot_helpers.js';

// Read shared config from global scope (config.js is loaded as a classic script).
const TYRE_COLORS = (typeof window !== 'undefined' && window.TYRE_COLORS) ? window.TYRE_COLORS : {};
const getTeamColorSafe = (team, fallback) => {
    try { return (typeof window !== 'undefined' && typeof window.getTeamColor === 'function') ? window.getTeamColor(team, fallback) : (fallback || '#999'); }
    catch (e) { return fallback || '#999'; }
};
const darkenColorIfBrightSafe = (hex) => {
    try { return (typeof window !== 'undefined' && typeof window.darkenColorIfBright === 'function') ? window.darkenColorIfBright(hex) : hex; }
    catch (e) { return hex; }
};

export function drawRacePaceBoxPlot(sessionData, drivers) {
    const svg = d3.select("#boxplot-svg");
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

    const allTimes = drivers.flatMap((d) => [
        d.boxplot.whiskerLow,
        d.boxplot.whiskerHigh,
    ]);

    const x = d3
        .scaleBand()
        .domain(drivers.map((d) => d.code))
        .range([0, width])
        .paddingInner(0.25)
        .paddingOuter(0.05);

    const y = d3
        .scaleLinear()
        .domain(d3.extent(allTimes))
        .nice()
        .range([height, 0]);

    const yAxis = d3.axisLeft(y).tickFormat(msToTimeString);
    const xAxis = d3.axisBottom(x).tickFormat(() => "");

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

    // Y label - centred vertically along the left axis and rotated vertically
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

    // Custom driver ticks: code (team color), mean, tyre strategy with colors + dashes
    renderDriverXAxisTicks(xAxisG, drivers, x);

    // Boxplots
    // Box width and groups: centre boxes within the band so they align with the
    // custom ticks (which are built around the band centre).
    const boxWidth = x.bandwidth() * 0.62;
    const groups = g
        .selectAll(".box-group")
        .data(drivers)
        .enter()
        .append("g")
        .attr("class", "box-group")
        .attr("transform", (d) => {
            // translate to left edge plus centering offset so box sits in band centre
            const left = x(d.code) || 0;
            const offset = (x.bandwidth() - boxWidth) / 2;
            return `translate(${left + offset},0)`;
        });

    groups.each(function (driver) {
        const bp = driver.boxplot;
        const cx = boxWidth / 2;

        const color = getTeamColorSafe(driver.team, driver._teamColor);
        const borderColor = darkenColorIfBrightSafe(color);

        const group = d3.select(this);

        // Whiskers
        group
            .append("line")
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("y1", y(bp.whiskerLow))
            .attr("y2", y(bp.q1))
            .attr("stroke", "#B0B6C3");

        group
            .append("line")
            .attr("x1", cx)
            .attr("x2", cx)
            .attr("y1", y(bp.q3))
            .attr("y2", y(bp.whiskerHigh))
            .attr("stroke", "#B0B6C3");

        // Caps
        group
            .append("line")
            .attr("x1", cx - boxWidth * 0.25)
            .attr("x2", cx + boxWidth * 0.25)
            .attr("y1", y(bp.whiskerLow))
            .attr("y2", y(bp.whiskerLow))
            .attr("stroke", "#B0B6C3");

        group
            .append("line")
            .attr("x1", cx - boxWidth * 0.25)
            .attr("x2", cx + boxWidth * 0.25)
            .attr("y1", y(bp.whiskerHigh))
            .attr("y2", y(bp.whiskerHigh))
            .attr("stroke", "#B0B6C3");

        // Box
        group
            .append("rect")
            .attr("x", cx - boxWidth / 2)
            .attr("y", y(bp.q3))
            .attr("width", boxWidth)
            .attr("height", y(bp.q1) - y(bp.q3))
            .attr("fill", color)
            .attr("fill-opacity", 0.5)
            .attr("stroke", borderColor)
            .attr("stroke-width", 2);

        // Median
        group
            .append("line")
            .attr("x1", cx - boxWidth / 2)
            .attr("x2", cx + boxWidth / 2)
            .attr("y1", y(bp.median))
            .attr("y2", y(bp.median))
            .attr("stroke", "#FFD84D")
            .attr("stroke-width", 2.5)
            .attr("stroke-dasharray", "6,3");

        // Mean — solid, thinner, cool-tinted
        group
            .append("line")
            .attr("x1", cx - boxWidth / 2)
            .attr("x2", cx + boxWidth / 2)
            .attr("y1", y(bp.mean))
            .attr("y2", y(bp.mean))
            .attr("stroke", "#E8F6FF")
            .attr("stroke-width", 1.8)
            .attr("stroke-linecap", "round")
            .attr("stroke-opacity", 0.95);

        // Outliers: intentionally not rendered here to avoid plotting
        // extreme lap times (handled separately in per-driver views).

        // Tooltip
        group
            .on("mousemove", (event) => {
                const html = `
                    <div><strong style="color:${getTeamColorSafe(driver.team, driver._teamColor)}">${driver.name}</strong> (${driver.code})</div>
                    <div>Mean: <b>${msToTimeString(bp.mean)}</b></div>
                    <div>Median: ${msToTimeString(bp.median)}</div>
                    <div>Strategy: ${driver.strategy
                        .map(
                            (c) =>
                                `<strong style="color:${TYRE_COLORS[c] || "#ccc"};font-weight:700">${c}</strong>`
                        )
                        .join("-")}</div>
                `;
                showTooltip(html, event.pageX, event.pageY);
            })
            .on("mouseleave", hideTooltip);

        // --- Tyre-colored lap dots (hoverable) ---
        // Show per-lap points so the user can hover any point to see lap/tyre/time.
        try {
            const laps = (driver.lapsFiltered && driver.lapsFiltered.length) ? driver.lapsFiltered : (driver.laps || []);
            const valid = laps.filter((l) => l && l.timeMs != null && l.lap != null && !l.deleted);
            if (!valid.length) return;

            // Limit points for performance (deterministic sampling).
            const MAX_POINTS = 260;
            const step = Math.max(1, Math.ceil(valid.length / MAX_POINTS));
            const sampled = valid.filter((_, i) => i % step === 0).map((l) => ({
                lap: l.lap,
                timeMs: l.timeMs,
                compound: normalizeCompound(l.compound),
                stint: l.stint,
                stintLap: l.stintLap,
            }));

            // Place points within the band (with small jitter) and align y to time.
            group
                .append('g')
                .attr('class', 'box-lap-dots')
                .selectAll('circle')
                .data(sampled)
                .enter()
                .append('circle')
                .attr('cx', () => {
                    const j = (Math.random() * 2 - 1) * (boxWidth * 0.22);
                    return cx + j;
                })
                .attr('cy', (d) => y(d.timeMs))
                .attr('r', 2.3)
                .attr('fill', (d) => TYRE_COLORS[d.compound] || '#fff')
                .attr('stroke', '#101010')
                .attr('stroke-width', 0.8)
                .attr('opacity', 0.95)
                .style('cursor', 'pointer')
                .on('mousemove', (event, d) => {
                    const html = `
                        <div><strong style="color:${getTeamColorSafe(driver.team, driver._teamColor)}">${driver.code}</strong> — ${driver.name || driver.fullName || ''}</div>
                        <div>Lap: <b>${d.lap}</b></div>
                        <div>Lap time: <b>${msToTimeString(d.timeMs)}</b></div>
                        <div>Tyre: <span style="color:${TYRE_COLORS[d.compound] || '#ccc'};font-weight:700">${d.compound || 'N/A'}</span>, Stint ${d.stint || '—'} lap ${d.stintLap || '—'}</div>
                    `;
                    showTooltip(html, event.pageX, event.pageY);
                })
                .on('mouseleave', hideTooltip);
        } catch (e) {}
    });

    // Add in-SVG centered title below the plot to include in exports
    try {
        const titleY = margin.top + height + 120;
        appendExportTitle(svg, sessionData, 'Race Pace Comparison', margin.left + width / 2, titleY);
    } catch(e) {}
}