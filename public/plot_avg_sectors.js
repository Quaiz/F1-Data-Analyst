import { resolveSvgSize, showTooltip, hideTooltip } from './plot_helpers.js';

// drawAvgSectorsPlot: computes average sector times per driver and draws three side-by-side
// horizontal bar groups (S1, S2, S3) showing gap to the best sector time.
export function drawAvgSectorsPlot(sessionData, drivers) {
    const svg = d3.select('#avg-sectors-svg');
    svg.selectAll('*').remove();
    if (!sessionData || !sessionData.laps || !drivers || drivers.length === 0) return;

    const getTeamColorSafe = (team, fallback) => {
        try { return (typeof window !== 'undefined' && typeof window.getTeamColor === 'function') ? window.getTeamColor(team, fallback) : (fallback || '#999'); }
        catch (e) { return fallback || '#999'; }
    };

    // reduce left margin so panels use available canvas space
    const margin = { top: 36, right: 20, bottom: 30, left: 20 };
    const dims = resolveSvgSize(svg, 1600, 500);
    const totalW = dims.w;
    const totalH = dims.h;
    const innerW = totalW - margin.left - margin.right;
    const innerH = totalH - margin.top - margin.bottom;

    // Compute sector means per driver
    const driversData = drivers.map((d) => {
        const laps = (d.lapsFiltered && d.lapsFiltered.length) ? d.lapsFiltered : (d.laps || []);
        const s1 = d3.mean(laps.map((l) => l.s1Ms).filter((x) => x != null));
        const s2 = d3.mean(laps.map((l) => l.s2Ms).filter((x) => x != null));
        const s3 = d3.mean(laps.map((l) => l.s3Ms).filter((x) => x != null));
        return { code: d.code, s1, s2, s3, team: d.team, _teamColor: d._teamColor };
    }).filter(d => d.s1 != null || d.s2 != null || d.s3 != null);

    if (!driversData.length) return;

    // sector colors: S1=red, S2=blue, S3=yellow (title highlight)
    const panels = [{ key: 's1', label: 'S1', color: '#FC0001' }, { key: 's2', label: 'S2', color: '#00B2E3' }, { key: 's3', label: 'S3', color: '#FFD400' } ];
    // tighten padding between panels so they sit closer together
    const panelPadding = 12;
    const panelW = (innerW - panelPadding * (panels.length - 1)) / panels.length;
    const labelColWidth = 90; // slightly smaller reserved label column so labels sit closer to bars
    const leftAxisWidth = 64; // internal left column inside each panel for driver codes

    // no overall centered title (per request)

    // per-panel drawing
    panels.forEach((p, idx) => {
        const panelX = margin.left + idx * (panelW + panelPadding);
        const panelY = margin.top;
        const g = svg.append('g').attr('transform', `translate(${panelX},${panelY})`);
        // (no overall centered title per request)
        const data = driversData.filter(d => d[p.key] != null).slice().sort((a,b)=> a[p.key] - b[p.key]);
        const best = d3.min(data, d=> d[p.key]);
        const gaps = data.map(d=> (d[p.key] - best)/1000.0 );
        const maxGap = d3.max(gaps) || 0.1;

        // reduce vertical padding to pack bars; reserve 30px for axis labels
        const plotHeight = Math.max(120, innerH - 30);
        const y = d3.scaleBand().domain(data.map(d=> d.code)).range([0, plotHeight]).padding(0.12);
        // calculate plot area inside each panel: leave leftAxisWidth for labels, right label column for times
        const plotW = Math.max(80, panelW - leftAxisWidth - labelColWidth);
        // Use a small baseline in pixels for the best driver so it is visible
        // and make all gaps map precisely on the x-axis from that endpoint.
        const baselinePx = Math.min(50, Math.max(40, plotW * 0.06)); // target ~50px but adapt to small panels
        // axisScale domain will be set after ticks/tickMax are determined so ticks cover the data

        // left axis drawn inside the panel so labels are visible
        const leftAxis = d3.axisLeft(y).tickSize(0).tickPadding(5);
        const axg = g.append('g').attr('transform', `translate(${leftAxisWidth},0)`).call(leftAxis);
        // color driver codes by team color and make them slightly larger for readability
        const codeTeamMap = {};
        const codeTeamColorMap = {};
        data.forEach(dd => { codeTeamMap[dd.code] = dd.team; codeTeamColorMap[dd.code] = dd._teamColor || null; });
        axg.selectAll('text').style('font-family','sans-serif').style('font-size','12px').style('font-weight','700').style('fill', function(d){
            try {
                const team = codeTeamMap[d];
                const fallback = codeTeamColorMap[d] || null;
                return getTeamColorSafe(team, fallback) || '#fff';
            } catch(e) { return '#fff'; }
        });

        // create a plot group translated by leftAxisWidth where bars and axes live
        const plot = g.append('g').attr('transform', `translate(${leftAxisWidth},0)`);

        // bottom axis positioned under the plot area (use plotHeight so axis sits tight to bars)
        // choose a sparse tick set (3..5 ticks) so the axis is very spare
        let desiredTicks = 4; // start with 4 for balanced sparseness
        let tickStep = d3.tickStep(0, maxGap, desiredTicks);
        if (!tickStep || tickStep <= 0) tickStep = maxGap / (desiredTicks - 1 || 1);
        // ensure ticks cover the actual data max (safety check)
        const maxDisplayedGap = maxGap; // gap already in seconds
        let tickMax = Math.ceil(maxDisplayedGap / tickStep) * tickStep;
        let tickValues = d3.range(0, tickMax + 1e-9, tickStep);
        if (tickValues.length === 0 || (tickValues[tickValues.length - 1] + 1e-9) < maxDisplayedGap) {
            tickMax = Math.ceil(maxDisplayedGap / tickStep) * tickStep;
            tickValues = d3.range(0, tickMax + 1e-9, tickStep);
        }
        // Ensure we have a very sparse axis: force tick count between 3 and 5
        // If too many ticks, progressively reduce desiredTicks; if too few, increase it.
        let attempts = 0;
        while ((tickValues.length > 5 || tickValues.length < 3) && attempts < 6) {
            attempts++;
            if (tickValues.length > 5) desiredTicks = Math.max(3, desiredTicks - 1);
            else if (tickValues.length < 3) desiredTicks = Math.min(5, desiredTicks + 1);
            tickStep = d3.tickStep(0, maxGap, desiredTicks);
            if (!tickStep || tickStep <= 0) tickStep = maxGap / (desiredTicks - 1 || 1);
            tickMax = Math.ceil(maxDisplayedGap / tickStep) * tickStep;
            tickValues = d3.range(0, tickMax + 1e-9, tickStep);
        }
        // use a linear pixel axis for ticks so tick marks are evenly spaced visually
        // Map 0 -> baselinePx and tickMax -> plotW so the axis origin sits at the end of the baseline bar
        const axisScale = d3.scaleLinear().domain([0, tickMax]).range([baselinePx, plotW]);
        plot.append('g').attr('transform', `translate(0,${plotHeight})`).call(d3.axisBottom(axisScale).tickValues(tickValues).tickFormat(d => d.toFixed(3)+'s')).selectAll('text').style('fill','#eee').style('font-size','12px').style('font-weight','500');
        // add a bit more vertical spacing so the x-axis label doesn't sit on top of bars
        // x-axis label styled same as other plots: muted, normal weight, 12px
        plot.append('text').attr('x', plotW/2).attr('y', plotHeight + 32).text('Gap (s)').style('fill','#eee').style('font-size','12px').style('font-weight','500').attr('text-anchor','middle');

        // gridlines (subtle) inside plot area using the same even ticks (anchor with axisScale so spacing is even)
        plot.append('g').attr('class','grid').selectAll('line').data(tickValues).enter().append('line')
            .attr('x1', d=> axisScale(d)).attr('x2', d=> axisScale(d)).attr('y1', 0).attr('y2', plotHeight).attr('stroke', '#333').attr('opacity', 0.45);

        // panel title centered above the plot area (colored per sector)
        // larger panel title for readability
        g.append('text').attr('x', leftAxisWidth + plotW/2).attr('y', -18).text(`Average time - Sector ${idx+1}`).attr('text-anchor','middle').attr('fill', p.color).attr('font-size','15px').attr('font-weight','700');
        // (removed small S1/S2/S3 corner label per request)
        const bandH = y.bandwidth();
        const rows = plot.selectAll('.row').data(data).enter().append('g').attr('transform', d=>`translate(0,${y(d.code)})`);

        // use shared tooltip instead of creating custom one

        // compute gaps (seconds) relative to the fastest driver (best)
        // delta will be the absolute gap to the best (not relative to previous row)
        const computed = data.map((d) => {
            const gap = (d[p.key] - best)/1000.0;
            return { code: d.code, gap, delta: gap, absTime: d[p.key], team: d.team };
        });

        // draw full bar from the left panel start (x=0) to the axisScale(gap) position
        const rectH = Math.max(14, bandH * 0.72);
        rows.data(computed).append('rect').attr('x', 5).attr('y', (bandH - rectH)/2).attr('height', rectH).attr('width', d=> Math.max(4, axisScale(d.gap) - 2)).attr('fill', (d)=> {
            try { return getTeamColorSafe(d.team, d._teamColor) || '#777777'; } catch(e) { return '#777777'; }
        }).attr('opacity',0.95).attr('rx', 3).attr('ry', 3);
        // numeric label placed consistently to the right of the bar end and vertically centered
        rows.data(computed).append('text').attr('x', (d)=> {
            return axisScale(d.gap) + 6;
        }).attr('y', (bandH - rectH)/2 + rectH/2 + 4).text((d,i)=> {
            if (i === 0) return `${(d.absTime/1000.0).toFixed(3)}s`;
            return `+${(d.delta).toFixed(3)}s`;
        }).style('fill','#fff').style('font-size','12px').style('font-weight', (d,i)=> i === 0 ? '600' : '500').attr('pointer-events','none').attr('text-anchor','start');

        // Draw a dashed vertical marker indicating the axis origin (endpoint of the first driver's baseline)
        // This marker sits at axisScale(0) == baselinePx
        plot.append('line')
            .attr('x1', axisScale(0))
            .attr('x2', axisScale(0))
            .attr('y1', 0)
            .attr('y2', plotHeight)
            .attr('stroke', '#ffffff')
            .attr('stroke-width', 1)
            .attr('opacity', 0.28)
            .attr('stroke-dasharray', '4 4');

        rows.on('mouseenter', function(event, d) {
            try {
                const driverObj = (drivers || []).find(dr => dr.code === d.code) || null;
                const lapsArr = ((driverObj && driverObj.lapsFiltered && driverObj.lapsFiltered.length) ? driverObj.lapsFiltered : (driverObj ? (driverObj.laps || []) : []) ) || [];
                const msKey = `${p.key}Ms`;
                const vals = lapsArr.filter(l => l && l[msKey] != null).map(l => ({ms: Number(l[msKey]), lap: (l.lap != null ? l.lap : (l.LapNumber != null ? l.LapNumber : (l.lapNumber || null)))}));
                let fastest = null, slowest = null, avg = null;
                if (vals.length) {
                    fastest = vals.reduce((a,b)=> a.ms <= b.ms ? a : b);
                    slowest = vals.reduce((a,b)=> a.ms >= b.ms ? a : b);
                    avg = d3.mean(vals, v => v.ms);
                }
                const name = driverObj && (driverObj.name || driverObj.code) ? (driverObj.name || driverObj.code) : d.code;
                // colorize driver name by team, and color the label words for fastest/slowest/average
                let teamColor = '#fff';
                try { teamColor = getTeamColorSafe(driverObj.team, driverObj._teamColor) || '#fff'; } catch(e) { teamColor = '#fff'; }
                const fastestVal = fastest ? ((fastest.ms/1000).toFixed(3) + 's') + (fastest.lap != null ? (' (Lap ' + fastest.lap + ')') : '') : 'N/A';
                const slowestVal = slowest ? ((slowest.ms/1000).toFixed(3) + 's') + (slowest.lap != null ? (' (Lap ' + slowest.lap + ')') : '') : 'N/A';
                const avgVal = avg != null ? ((avg/1000).toFixed(3) + 's') : 'N/A';
                const html = `<div style="font-weight:700;margin-bottom:6px;color:${teamColor}">${name}</div>` +
                    `<div><span style="color:#9b59b6;font-weight:700">Fastest:</span> ${fastestVal}</div>` +
                    `<div><span style="color:#f1c40f;font-weight:700">Slowest:</span> ${slowestVal}</div>` +
                    `<div><span style="color:#2ecc71;font-weight:700">Average:</span> ${avgVal}</div>`;
                showTooltip(html, event.pageX, event.pageY);
            } catch(err) {
                hideTooltip();
            }
        }).on('mousemove', function(event){
            // tooltip positioning is handled by showTooltip function
        }).on('mouseleave', function(){
            hideTooltip();
        });

    });

    // Add an overall centered SVG title below the panels so it appears under
    // the x-axis / tick labels and is included in SVG exports.
    try {
        // Per request, reserve 50px space below the x-axis for the title
        const totalW = +svg.attr('width');
        const eventName = (sessionData && sessionData.meta && sessionData.meta.eventName) ? sessionData.meta.eventName : '';
        const year = (sessionData && sessionData.meta && sessionData.meta.year) ? sessionData.meta.year : '';
        const sess = (sessionData && sessionData.meta && sessionData.meta.sessionName) ? sessionData.meta.sessionName : '';
        const titleText = `${eventName} ${year} ${sess} - Average Sector Performance`.trim();
        const titleY = margin.top + innerH + 30;
        svg.append('text')
            .attr('class', 'svg-plot-title')
            .attr('x', totalW / 2)
            .attr('y', titleY)
            .attr('text-anchor', 'middle')
            .text(titleText);

        function sanitize(s){ return String(s || '').replace(/[^0-9A-Za-z]/g,''); }
        const fileBase = `${sanitize(eventName)}${sanitize(year)}_${sanitize(sess)}_${sanitize('AvgSectors')}`;
        svg.attr('data-export-name', fileBase);
    } catch(e) {}

}
