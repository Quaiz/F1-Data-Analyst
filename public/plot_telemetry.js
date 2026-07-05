import { resolveSvgSize, showTooltip, hideTooltip } from './plot_helpers.js';

export function drawTelemetryPlot(telemetryData) {
    const svg = d3.select("#telemetry-svg");
    if (svg.empty()) return;

    // Use responsive dimensions based on container
    const dims = resolveSvgSize(svg, 1600, 600);
    const width = dims.w;
    const height = dims.h;
    
    svg.selectAll("*").remove();
    
    if (!telemetryData || !telemetryData.driver1 || !telemetryData.telemetry1 || !telemetryData.telemetry1.length) {
        svg.append("text").attr("x", width/2).attr("y", height/2)
           .attr("fill", "#666").attr("text-anchor", "middle")
           .style("font-family", "Share Tech Mono").text("AWAITING TELEMETRY DATA...");
        return;
    }

    const margin = { top: 30, right: 30, bottom: 40, left: 60 };
    const w = width - margin.left - margin.right;
    const h = height - margin.top - margin.bottom;

    // Split height into 4 panels: Speed (30%), Throttle (25%), Brake (20%), Gear (25%)
    const p1H = h * 0.35;
    const p2H = h * 0.25;
    const p3H = h * 0.15;
    const p4H = h * 0.25;
    
    const d1 = telemetryData.telemetry1;
    const d2 = telemetryData.telemetry2 || [];
    
    // Combine to find max distance
    const maxDist = d3.max([
        ...d1.map(d => d.dist),
        ...d2.map(d => d.dist)
    ]);
    
    const x = d3.scaleLinear().domain([0, maxDist]).range([0, w]);
    
    // Shared X Axis at the bottom
    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    // Grid Lines (Vertical)
    g.append("g").attr("class", "grid")
        .call(d3.axisBottom(x).ticks(10).tickSize(h).tickFormat(""))
        .selectAll("line").attr("stroke", "rgba(57,255,20,0.1)");
        
    g.append("g").attr("class", "axis")
        .attr("transform", `translate(0, ${h})`)
        .call(d3.axisBottom(x).ticks(10).tickFormat(d => d + "m"))
        .selectAll("text").attr("fill", "var(--text-main)").style("font-family", "Share Tech Mono");

    // Colors
    // If we have window.getTeamColor we can use it, else default
    let c1 = "#39ff14"; 
    let c2 = "#ff3c3c";
    
    // Helper to draw a panel
    const drawPanel = (panelY, panelH, metric, title, yDomain, ticks, tickFormat, areaFill = false) => {
        const y = d3.scaleLinear().domain(yDomain).range([panelH, 0]);
        const panel = g.append("g").attr("transform", `translate(0, ${panelY})`);
        
        // Y Axis
        panel.append("g").attr("class", "axis")
            .call(d3.axisLeft(y).ticks(ticks).tickFormat(tickFormat))
            .selectAll("text").attr("fill", "var(--text-muted)");
            
        panel.append("text").attr("x", 10).attr("y", 15)
            .attr("fill", "var(--text-muted)").style("font-size", "11px")
            .style("font-family", "Share Tech Mono").text(title);

        const line = d3.line().x(d => x(d.dist)).y(d => y(d[metric])).curve(d3.curveMonotoneX);
        const area = d3.area().x(d => x(d.dist)).y0(panelH).y1(d => y(d[metric])).curve(d3.curveMonotoneX);

        if (d2.length) {
            if (areaFill) panel.append("path").datum(d2).attr("fill", c2).attr("opacity", 0.1).attr("d", area);
            panel.append("path").datum(d2).attr("fill", "none").attr("stroke", c2).attr("stroke-width", 1.5).attr("d", line);
        }
        
        if (d1.length) {
            if (areaFill) panel.append("path").datum(d1).attr("fill", c1).attr("opacity", 0.1).attr("d", area);
            panel.append("path").datum(d1).attr("fill", "none").attr("stroke", c1).attr("stroke-width", 1.5).attr("d", line);
        }
    };

    // Speed Panel
    drawPanel(0, p1H, 'speed', 'SPEED (km/h)', [0, 350], 4, d => d, true);
    
    // Throttle Panel
    drawPanel(p1H + 10, p2H - 10, 'throttle', 'THROTTLE (%)', [0, 100], 3, d => d);
    
    // Brake Panel
    drawPanel(p1H + p2H + 10, p3H - 10, 'brake', 'BRAKE', [0, 1.2], 2, d => d === 1 ? 'ON' : 'OFF');
    
    // Gear Panel
    drawPanel(p1H + p2H + p3H + 10, p4H - 10, 'gear', 'GEAR', [0, 8], 8, d => d);

    // Legend
    const legend = svg.append("g").attr("transform", `translate(${margin.left + w - 150}, 10)`);
    legend.append("rect").attr("x", 0).attr("y", 0).attr("width", 12).attr("height", 12).attr("fill", c1);
    legend.append("text").attr("x", 20).attr("y", 10).attr("fill", c1).style("font-family", "Share Tech Mono").text(telemetryData.driver1);
    
    if (telemetryData.driver2) {
        legend.append("rect").attr("x", 0).attr("y", 20).attr("width", 12).attr("height", 12).attr("fill", c2);
        legend.append("text").attr("x", 20).attr("y", 30).attr("fill", c2).style("font-family", "Share Tech Mono").text(telemetryData.driver2);
    }
}
