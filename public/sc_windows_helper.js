// Shared SC/VSC helper for plots
// Exports: getScRegions(sessionData, allLaps), lapInRegions(lapNum, regions), renderScRegions(g, xScale, height, regions)

export function getScRegions(sessionData, allLaps) {
    // Return array of { type: 'SC'|'VSC', start: <lap>, end: <lap> }
    // Derived entirely from per-lap TrackStatus — the raw FastF1 source of truth.
    // We intentionally do NOT use sessionData.scWindows / heuristicWindows because
    // the computed time-window → lap-range mapping produced overly broad ranges.
    if (!allLaps || !allLaps.length) return [];

    // Collect laps that indicate SC ('4') or VSC ('6') in their TrackStatus
    const lapMap = new Map(); // lapNum -> type
    for (const lp of allLaps) {
        if (!lp) continue;
        const lapNum = lp.lap != null ? Number(lp.lap) : (lp.LapNumber != null ? Number(lp.LapNumber) : null);
        if (lapNum == null) continue;
        const ts = String(lp.TrackStatus || lp.trackStatus || '');
        if (!ts) continue;
        if (ts.includes('4')) {
            lapMap.set(lapNum, 'SC');
        } else if (ts.includes('6')) {
            // only set VSC if there's no SC recorded for that lap
            if (!lapMap.has(lapNum)) lapMap.set(lapNum, 'VSC');
        }
    }
    if (!lapMap.size) return [];

    const laps = Array.from(new Set(Array.from(lapMap.keys()))).sort((a, b) => a - b);
    const regions = [];
    for (const ln of laps) {
        const t = lapMap.get(ln) || 'SC';
        const last = regions[regions.length - 1];
        if (last && last.type === t && ln === last.end + 1) {
            last.end = ln;
        } else {
            regions.push({ type: t, start: ln, end: ln });
        }
    }
    return regions;
}

export function lapInRegions(lapNum, regions) {
    if (lapNum == null || !regions || !regions.length) return false;
    for (const r of regions) {
        if (r.start == null || r.end == null) continue;
        if (lapNum >= r.start && lapNum <= r.end) return true;
    }
    return false;
}

export function renderScRegions(g, xScale, height, regions) {
    if (!regions || !regions.length) return;
    const regionG = g.append('g').attr('class', 'special-regions');
    const range = xScale.range();
    const xMin = Math.min(range[0], range[1]);
    const xMax = Math.max(range[0], range[1]);
    regions.forEach((r) => {
        // clamp so the shaded region does not draw left of the plotting area
        const x0raw = xScale(r.start - 0.5);
        const x1raw = xScale(r.end + 0.5);
        const x0 = Math.max(xMin, Math.min(x0raw, xMax));
        const x1 = Math.max(xMin, Math.min(x1raw, xMax));
        regionG
            .append('rect')
            .attr('x', x0)
            .attr('y', 0)
            .attr('width', Math.max(1, x1 - x0))
            .attr('height', height)
            .attr('fill', 'rgba(210, 180, 90, 0.18)')
            .attr('stroke', 'rgba(210, 180, 90, 0.12)')
            .attr('stroke-width', 1);
        // label: ensure label is placed within the clipped region
        const labelX = Math.max(x0 + 8, Math.min((x0 + x1) / 2, x1 - 8));
        // Normalize label: show 'VSC' for virtual safety car, 'SC' for safety car
        let labelText = '';
        try {
            const t = String(r.type || '').toLowerCase();
            if (t.includes('vsc') || t.includes('virtual') || t.indexOf('v') === 0) labelText = 'VSC';
            else if (t.includes('safety') || t === 'sc' || t.indexOf('s') === 0) labelText = 'SC';
            else labelText = (String(r.type || '') || '').toUpperCase();
        } catch (e) {
            labelText = String(r.type || '').toUpperCase();
        }
        regionG
            .append('text')
            .attr('x', labelX)
            .attr('y', -8)
            .attr('text-anchor', 'middle')
            .style('fill', '#FFD84D')
            .style('font-weight', '700')
            .style('font-size', '13px')
            .text(labelText);
    });
}
