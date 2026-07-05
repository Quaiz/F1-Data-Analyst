// ==================== Shared Plot Helpers ====================
// Consolidates utility functions duplicated across multiple plot modules.
// All plot files should import from here instead of re-defining these.

// -------------------- Compound Normalization --------------------

/**
 * Normalize tyre compound strings to single-letter codes (S/M/H/I/W).
 * @param {string} c - compound string
 * @returns {string|null}
 */
export function normalizeCompound(c) {
    if (!c) return null;
    const up = String(c).toUpperCase();
    if (up.includes('SOFT')) return 'S';
    if (up.includes('MEDIUM')) return 'M';
    if (up.includes('HARD')) return 'H';
    if (up.includes('INTER')) return 'I';
    if (up.includes('WET')) return 'W';
    if (['S', 'M', 'H', 'I', 'W'].includes(up)) return up;
    return up;
}

// -------------------- SVG Size Resolution --------------------

/**
 * Resolve the rendered SVG dimensions so plots never overflow their container.
 * Sets width, height, and viewBox attributes on the SVG element.
 * @param {d3.Selection} svgEl - d3 selection of the SVG element
 * @param {number} defaultW - fallback width
 * @param {number} defaultH - fallback height
 * @returns {{ w: number, h: number }}
 */
export function resolveSvgSize(svgEl, defaultW = 1200, defaultH = 600) {
    const node = svgEl.node();
    let bbox = null;
    try { bbox = node.getBoundingClientRect(); } catch (e) { bbox = null; }
    const clientW = node && node.clientWidth ? node.clientWidth : (bbox ? bbox.width : 0);
    const clientH = node && node.clientHeight ? node.clientHeight : (bbox ? bbox.height : 0);
    const attrW = parseInt(svgEl.attr('width')) || 0;
    const attrH = parseInt(svgEl.attr('height')) || 0;
    const w = clientW > 0 ? clientW : (attrW > 0 ? attrW : defaultW);
    const h = clientH > 0 ? clientH : (attrH > 0 ? attrH : defaultH);
    svgEl.attr('width', Math.round(w)).attr('height', Math.round(h)).attr('viewBox', `0 0 ${Math.round(w)} ${Math.round(h)}`);
    return { w: Math.round(w), h: Math.round(h) };
}

// -------------------- Tooltip Helpers --------------------

const sharedTooltip = d3.select("#tooltip");

export function showTooltip(html, x, y) {
    sharedTooltip
        .style("opacity", 1)
        .html(html)
        .style("left", x + 12 + "px")
        .style("top", y + 12 + "px");
}

export function hideTooltip() {
    sharedTooltip.style("opacity", 0);
}

// -------------------- Export Title --------------------

/**
 * Append an in-SVG centered title below the plot for export purposes,
 * and set the `data-export-name` attribute for filename generation.
 * @param {d3.Selection} svg - d3 selection of the SVG element
 * @param {object} sessionData - session data with meta info
 * @param {string} plotLabel - e.g. "Race Pace Comparison", "Lap Time Distribution"
 * @param {number} titleX - horizontal center for the title
 * @param {number} titleY - vertical position for the title
 */
export function appendExportTitle(svg, sessionData, plotLabel, titleX, titleY) {
    const eventName = (sessionData && sessionData.meta && sessionData.meta.eventName) ? sessionData.meta.eventName : '';
    const year = (sessionData && sessionData.meta && sessionData.meta.year) ? sessionData.meta.year : '';
    const sess = (sessionData && sessionData.meta && sessionData.meta.sessionName) ? sessionData.meta.sessionName : '';
    const titleText = `${eventName} ${year} ${sess} - ${plotLabel}`.trim();
    svg.append('text')
        .attr('class', 'svg-plot-title')
        .attr('x', titleX)
        .attr('y', titleY)
        .attr('text-anchor', 'middle')
        .text(titleText);

    function sanitize(s) { return String(s || '').replace(/[^0-9A-Za-z]/g, ''); }
    const fileBase = `${sanitize(eventName)}${sanitize(year)}_${sanitize(sess)}_${sanitize(plotLabel.replace(/\s+/g, ''))}`;
    svg.attr('data-export-name', fileBase);
}

// -------------------- Team Primary/Secondary --------------------

/**
 * Mark per-team primary/secondary drivers so teammates share a colour
 * but use different line styles. Primary driver is the one with the
 * better finishing position, falling back to lower mean lap time.
 * Mutates driver objects in place (sets `isFirstDriver`).
 * @param {Array} drivers
 */
export function markTeamPrimary(drivers) {
    const byTeam = d3.group(drivers, (d) => d.team || d.code);
    byTeam.forEach((list) => {
        if (!list || !list.length) return;
        list.forEach((d) => (d.isFirstDriver = false));
        if (list.length === 1) {
            list[0].isFirstDriver = true;
            return;
        }
        list.sort((a, b) => {
            const pa = a.position != null ? a.position : (a.meanLapMs != null ? a.meanLapMs / 1000 + 1000 : Infinity);
            const pb = b.position != null ? b.position : (b.meanLapMs != null ? b.meanLapMs / 1000 + 1000 : Infinity);
            return pa - pb;
        });
        list[0].isFirstDriver = true;
    });
}

// -------------------- Cumulative Best Computation --------------------

/**
 * Compute cumulative (provisional) best lap time and sector times up to each lap.
 * @param {Array} allLaps - flat array of lap objects with timeMs, s1Ms, s2Ms, s3Ms, lap
 * @returns {{ cumulativeBest, cumulativeS1Best, cumulativeS2Best, cumulativeS3Best, lapNumbers, lapsByNumber, sessionBestLap }}
 */
export function computeCumulativeBests(allLaps) {
    const lapsByNumber = d3.group(allLaps.filter((d) => d.timeMs != null), (d) => d.lap);
    const lapNumbers = Array.from(lapsByNumber.keys()).sort((a, b) => a - b);

    const perLapMin = new Map();
    lapNumbers.forEach((ln) => {
        const arr = lapsByNumber.get(ln) || [];
        const m = d3.min(arr, (d) => d.timeMs);
        perLapMin.set(ln, m == null ? Infinity : m);
    });

    const cumulativeBest = new Map();
    let runningMin = Infinity;
    lapNumbers.forEach((ln) => {
        const v = perLapMin.get(ln);
        if (v < runningMin) runningMin = v;
        cumulativeBest.set(ln, runningMin === Infinity ? null : runningMin);
    });

    const cumulativeS1Best = new Map();
    const cumulativeS2Best = new Map();
    const cumulativeS3Best = new Map();
    let runningS1 = Infinity, runningS2 = Infinity, runningS3 = Infinity;
    lapNumbers.forEach((ln) => {
        const arr = lapsByNumber.get(ln) || [];
        const s1min = d3.min(arr, (d) => d.s1Ms != null ? d.s1Ms : (d.Sector1Time != null ? d.Sector1Time * 1000 : null));
        const s2min = d3.min(arr, (d) => d.s2Ms != null ? d.s2Ms : (d.Sector2Time != null ? d.Sector2Time * 1000 : null));
        const s3min = d3.min(arr, (d) => d.s3Ms != null ? d.s3Ms : (d.Sector3Time != null ? d.Sector3Time * 1000 : null));
        if (s1min != null && s1min < runningS1) runningS1 = s1min;
        if (s2min != null && s2min < runningS2) runningS2 = s2min;
        if (s3min != null && s3min < runningS3) runningS3 = s3min;
        cumulativeS1Best.set(ln, runningS1 === Infinity ? null : runningS1);
        cumulativeS2Best.set(ln, runningS2 === Infinity ? null : runningS2);
        cumulativeS3Best.set(ln, runningS3 === Infinity ? null : runningS3);
    });

    const sessionBestLap = d3.min(allLaps, (d) => d.timeMs);

    return { cumulativeBest, cumulativeS1Best, cumulativeS2Best, cumulativeS3Best, lapNumbers, lapsByNumber, sessionBestLap };
}

// -------------------- Sector Flag Annotation --------------------

/**
 * Normalize sector ms fields on a lap copy (handles different source field names).
 * Mutates the copy in place.
 * @param {object} copy - lap object copy
 */
export function normalizeSectorMs(copy) {
    if (copy.s1Ms == null) {
        if (copy.Sector1Time != null) copy.s1Ms = copy.Sector1Time * 1000;
        else if (copy.s1Time != null) copy.s1Ms = copy.s1Time * 1000;
    }
    if (copy.s2Ms == null) {
        if (copy.Sector2Time != null) copy.s2Ms = copy.Sector2Time * 1000;
        else if (copy.s2Time != null) copy.s2Ms = copy.s2Time * 1000;
    }
    if (copy.s3Ms == null) {
        if (copy.Sector3Time != null) copy.s3Ms = copy.Sector3Time * 1000;
        else if (copy.s3Time != null) copy.s3Ms = copy.s3Time * 1000;
    }
}

/**
 * Annotate sector flags (purple/green) on a lap copy using cumulative bests
 * and per-driver personal bests. Mutates in place and returns updated personal bests.
 * @param {object} copy - lap object copy
 * @param {object} bests - { cumulativeS1Best, cumulativeS2Best, cumulativeS3Best }
 * @param {object} personalBests - { s1: number|null, s2: number|null, s3: number|null }
 * @returns {object} updated personalBests
 */
export function annotateSectorFlags(copy, bests, personalBests) {
    const { cumulativeS1Best, cumulativeS2Best, cumulativeS3Best } = bests;
    const cumS1 = cumulativeS1Best.get(copy.lap);
    const cumS2 = cumulativeS2Best.get(copy.lap);
    const cumS3 = cumulativeS3Best.get(copy.lap);

    if (copy.s1Ms != null) {
        if (cumS1 != null && copy.s1Ms === cumS1) copy.s1Flag = 'purple';
        else if (personalBests.s1 == null || copy.s1Ms < personalBests.s1) copy.s1Flag = 'green';
        if (personalBests.s1 == null || copy.s1Ms < personalBests.s1) personalBests.s1 = copy.s1Ms;
    }
    if (copy.s2Ms != null) {
        if (cumS2 != null && copy.s2Ms === cumS2) copy.s2Flag = 'purple';
        else if (personalBests.s2 == null || copy.s2Ms < personalBests.s2) copy.s2Flag = 'green';
        if (personalBests.s2 == null || copy.s2Ms < personalBests.s2) personalBests.s2 = copy.s2Ms;
    }
    if (copy.s3Ms != null) {
        if (cumS3 != null && copy.s3Ms === cumS3) copy.s3Flag = 'purple';
        else if (personalBests.s3 == null || copy.s3Ms < personalBests.s3) copy.s3Flag = 'green';
        if (personalBests.s3 == null || copy.s3Ms < personalBests.s3) personalBests.s3 = copy.s3Ms;
    }

    return personalBests;
}

// -------------------- X-Axis Driver Badge Rendering --------------------

/**
 * Render the custom driver ticks on the x-axis: badge, mean time, interval, and strategy.
 * Used by box plot and violin plot.
 * @param {d3.Selection} xAxisG - the x-axis group element
 * @param {Array} drivers - array of driver objects (sorted)
 * @param {d3.ScaleBand} xScale - x band scale
 */
export function renderDriverXAxisTicks(xAxisG, drivers, xScale) {
    xAxisG.select(".domain").remove();
    xAxisG.selectAll("text").remove();

    drivers.forEach((driver, idx) => {
        const code = driver.code;
        const xCenter = xScale(code) + xScale.bandwidth() / 2;

        const tickG = xAxisG.append("g").attr("transform", `translate(${xCenter}, 20)`);

        const teamColor = getTeamColor(driver.team, driver._teamColor);
        const accentColor = getTeamAccentColor(driver.team);
        const textColor = accentColor || getBadgeTextColor(driver.team, driver._teamColor);
        const pillBorder = accentColor || lightenColor(teamColor, 0.3);

        // Badge
        const badgeWidth = 52;
        const badgeHeight = 26;

        tickG.append("rect")
            .attr("x", -badgeWidth / 2)
            .attr("y", -badgeHeight / 2)
            .attr("width", badgeWidth)
            .attr("height", badgeHeight)
            .attr("rx", 13)
            .attr("ry", 13)
            .attr("fill", teamColor)
            .attr("stroke", pillBorder)
            .attr("stroke-width", 1.5);

        tickG.append("text")
            .attr("text-anchor", "middle")
            .style("fill", textColor)
            .attr("dy", "0.35em")
            .style("font-weight", 700)
            .style("font-size", "15px")
            .text(code);

        // Mean time
        const meanVal = driver.boxplot ? driver.boxplot.mean : driver.meanLapMs;
        const meanStr = msToTimeString(meanVal);
        const labelStartY = 28;
        const lineSpacing = 18;

        tickG.append("text")
            .attr("y", labelStartY)
            .attr("text-anchor", "middle")
            .attr("fill", "#ffffff")
            .style("font-weight", 700)
            .style("font-size", "14px")
            .text(`${meanStr}`);

        // Interval relative to the first (best) driver
        const baselineMean = drivers[0] ? (drivers[0].boxplot ? drivers[0].boxplot.mean : drivers[0].meanLapMs) : meanVal;
        const deltaMs = (meanVal || 0) - (baselineMean || 0);
        const deltaSec = deltaMs / 1000;
        const deltaText = (deltaMs >= 0 ? "+" : "-") + Math.abs(deltaSec).toFixed(2) + "s";

        tickG.append("text")
            .attr("y", labelStartY + lineSpacing)
            .attr("text-anchor", "middle")
            .attr("fill", "#ddd")
            .style("font-weight", 600)
            .style("font-size", "12px")
            .text(deltaText);

        // Strategy
        const stratLetters = driver.strategy || [];
        const stratG = tickG.append("g").attr("transform", `translate(0, ${labelStartY + lineSpacing * 2})`);

        const letterWidth = 13;
        const totalWidth = (stratLetters.length - 1) * letterWidth;
        const startX = -totalWidth / 2;

        stratLetters.forEach((c, i) => {
            const xPos = startX + i * letterWidth;
            stratG.append("text")
                .attr("x", xPos)
                .attr("y", 0)
                .attr("text-anchor", "middle")
                .style("fill", TYRE_COLORS[c] || "#aaa")
                .style("font-weight", 700)
                .style("font-size", "12px")
                .text(c);

            if (i < stratLetters.length - 1) {
                stratG.append("text")
                    .attr("x", xPos + letterWidth / 2)
                    .attr("y", 0)
                    .attr("text-anchor", "middle")
                    .style("fill", "#cccccc")
                    .style("font-size", "12px")
                    .text("-");
            }
        });
    });
}
