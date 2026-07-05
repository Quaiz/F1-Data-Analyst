const F1_COORDINATES = {
    "Bahrain Grand Prix": [50.5106, 26.0325],
    "Saudi Arabian Grand Prix": [39.1042, 21.6319],
    "Australian Grand Prix": [144.9681, -37.8497],
    "Japanese Grand Prix": [136.5390, 34.8431],
    "Chinese Grand Prix": [121.2185, 31.3389],
    "Miami Grand Prix": [-80.2389, 25.9581],
    "Emilia Romagna Grand Prix": [11.7167, 44.3439],
    "Monaco Grand Prix": [7.4206, 43.7347],
    "Canadian Grand Prix": [-73.5228, 45.5000],
    "Spanish Grand Prix": [2.2611, 41.5700],
    "Austrian Grand Prix": [14.7647, 47.2197],
    "British Grand Prix": [-1.0169, 52.0786],
    "Hungarian Grand Prix": [19.2486, 47.5822],
    "Belgian Grand Prix": [5.9714, 50.4372],
    "Dutch Grand Prix": [4.5409, 52.3888],
    "Italian Grand Prix": [9.2811, 45.6156],
    "Azerbaijan Grand Prix": [49.8533, 40.3725],
    "Singapore Grand Prix": [103.8640, 1.2914],
    "United States Grand Prix": [-97.6411, 30.1328],
    "Mexico City Grand Prix": [-99.0907, 19.4042],
    "São Paulo Grand Prix": [-46.6997, -23.7036],
    "Las Vegas Grand Prix": [-115.165, 36.1147],
    "Qatar Grand Prix": [51.4542, 25.4900],
    "Abu Dhabi Grand Prix": [54.6031, 24.4672],
    "Pre-Season Testing": [50.5106, 26.0325],
    "French Grand Prix": [5.7917, 43.2506],
    "Russian Grand Prix": [39.9566, 43.4056],
    "Turkish Grand Prix": [29.4061, 40.9517],
    "Portuguese Grand Prix": [-8.6267, 37.2270]
};

function getCoords(gpName) {
    if (!gpName) return null;
    const n = String(gpName).toLowerCase();
    
    // Hardcoded robust matchers
    if (n.includes('bahrain') || n.includes('sakhir') || n.includes('testing')) return [50.5106, 26.0325];
    if (n.includes('saudi') || n.includes('jeddah')) return [39.1042, 21.6319];
    if (n.includes('australia') || n.includes('melbourne')) return [144.9681, -37.8497];
    if (n.includes('japan') || n.includes('suzuka')) return [136.5390, 34.8431];
    if (n.includes('china') || n.includes('shanghai')) return [121.2185, 31.3389];
    if (n.includes('miami')) return [-80.2389, 25.9581];
    if (n.includes('emilia') || n.includes('romagna') || n.includes('imola')) return [11.7167, 44.3439];
    if (n.includes('monaco')) return [7.4206, 43.7347];
    if (n.includes('canad') || n.includes('montreal')) return [-73.5228, 45.5000];
    if (n.includes('spani') || n.includes('spain') || n.includes('barcelona')) return [2.2611, 41.5700];
    if (n.includes('austri') || n.includes('spielberg')) return [14.7647, 47.2197];
    if (n.includes('british') || n.includes('great britain') || n.includes('silverstone')) return [-1.0169, 52.0786];
    if (n.includes('hungar') || n.includes('budapest')) return [19.2486, 47.5822];
    if (n.includes('belgi') || n.includes('spa')) return [5.9714, 50.4372];
    if (n.includes('dutch') || n.includes('zandvoort') || n.includes('netherland')) return [4.5409, 52.3888];
    if (n.includes('italy') || n.includes('italian') || n.includes('monza')) return [9.2811, 45.6156];
    if (n.includes('azerbaijan') || n.includes('baku')) return [49.8533, 40.3725];
    if (n.includes('singapore') || n.includes('marina bay')) return [103.8640, 1.2914];
    if (n.includes('united states') || n.includes('usa') || n.includes('austin')) return [-97.6411, 30.1328];
    if (n.includes('mexic')) return [-99.0907, 19.4042];
    if (n.includes('paulo') || n.includes('brazil')) return [-46.6997, -23.7036];
    if (n.includes('vegas')) return [-115.165, 36.1147];
    if (n.includes('qatar') || n.includes('lusail')) return [51.4542, 25.4900];
    if (n.includes('abu dhabi') || n.includes('yas marina')) return [54.6031, 24.4672];
    if (n.includes('french') || n.includes('france') || n.includes('ricard')) return [5.7917, 43.2506];
    if (n.includes('russia') || n.includes('sochi')) return [39.9566, 43.4056];
    if (n.includes('turk') || n.includes('istanbul')) return [29.4061, 40.9517];
    if (n.includes('portug') || n.includes('portimao')) return [-8.6267, 37.2270];

    // Fallback dict matching
    for (const key of Object.keys(F1_COORDINATES)) {
        if (n.includes(key.toLowerCase().replace(' grand prix', ''))) return F1_COORDINATES[key];
    }
    
    return null;
}

// Global Cache & State
let worldGeoData = null;
let activeTarget = null;

let projection;
let pathGenerator;
let pointProjection;
let gSelection;
let validEventsData = [];
let particlesAnimationTimer = null;
let svgRef = null;  // keep svg reference for zoom binding
let scanAnimationTimer = null;

// Zoom constants
const SCALE_MIN = 230;
const SCALE_MAX = 460;
const SCALE_DEFAULT = 230;
const SCALE_SELECTED = 360;
let currentScale = SCALE_DEFAULT;

// Helper: apply new scale to both projections and redraw
function applyScale(newScale) {
    currentScale = Math.max(SCALE_MIN, Math.min(SCALE_MAX, newScale));
    if (projection) projection.scale(currentScale);
    if (pointProjection) pointProjection.scale(currentScale);
    // Update zoom readout in status bar
    if (window.updateZoomReadout) window.updateZoomReadout(((currentScale - SCALE_MIN) / (SCALE_MAX - SCALE_MIN)) * 100 + 100);
    updatePaths();
}

export async function drawWorldMap(events) {
    const svgElement = document.getElementById("world-map-svg");
    if (!svgElement) return;

    // Remove any empty label or child contents
    const container = svgElement.parentElement;
    const emptySpan = container.querySelector(".track-empty");
    if (emptySpan) emptySpan.style.display = "none";

    // Setup SVG dimensions
    const svg = d3.select(svgElement);
    svgRef = svg;  // store for later zoom binding
    svg.selectAll("*").remove();
    
    // Stop old timers to prevent memory/performance leaks
    if (particlesAnimationTimer) {
        particlesAnimationTimer.stop();
        particlesAnimationTimer = null;
    }
    if (scanAnimationTimer) {
        scanAnimationTimer.stop();
        scanAnimationTimer = null;
    }

    // We update the viewbox to make it responsive
    svg.attr("viewBox", `0 0 1000 500`).attr("preserveAspectRatio", "xMidYMid meet");

    // Defs for glow effect
    const defs = svg.append("defs");
    const filter = defs.append("filter")
        .attr("id", "glow")
        .attr("x", "-100%")
        .attr("y", "-100%")
        .attr("width", "300%")
        .attr("height", "300%");
    
    // Intense neon blur for dots
    filter.append("feGaussianBlur")
        .attr("stdDeviation", "2.5")
        .attr("result", "blur");
    const feMerge = filter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "blur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    // Holographic Dot-Matrix Fill Pattern
    const pattern = defs.append("pattern")
        .attr("id", "dot-matrix")
        .attr("width", 4)
        .attr("height", 4)
        .attr("patternUnits", "userSpaceOnUse");
    pattern.append("circle")
        .attr("cx", 2)
        .attr("cy", 2)
        .attr("r", 0.6)
        .attr("fill", "rgba(57, 255, 20, 0.5)");

    // Globe Clip Path for internal elements (Scanline)
    const globeClip = defs.append("clipPath").attr("id", "globe-clip");
    globeClip.append("circle")
        .attr("cx", 1000 / 2)
        .attr("cy", 500 / 2)
        .attr("r", currentScale);

    // Load GeoJSON if not loaded
    if (!worldGeoData) {
        try {
            worldGeoData = await d3.json("world.geojson");
        } catch (e) {
            console.error("Map Data Error:", e);
            return; // Can't draw map without geojson
        }
    }

    // Map Projection: 3D Globe with clipping
    projection = d3.geoOrthographic()
        .scale(currentScale)
        .translate([1000 / 2, 500 / 2])
        .clipAngle(90)
        .precision(0.5);

    // Unclipped projection strictly for calculating points on the dark side without returning null
    pointProjection = d3.geoOrthographic()
        .scale(currentScale)
        .translate([1000 / 2, 500 / 2])
        .clipAngle(null)
        .precision(0.5);

    pathGenerator = d3.geoPath().projection(projection);

    const g = svg.append("g");
    gSelection = g;

    // Enable Mouse Wheel Zoom
    svg.on("wheel", function(event) {
        event.preventDefault();
        const delta = event.deltaY > 0 ? -18 : 18;  // scroll down = zoom out
        applyScale(currentScale + delta);
    });

    // Enable Interactive Rotation
    const drag = d3.drag().on("drag", event => {
        const rot = projection.rotate();
        // Adjust sensitivity via division - less sensitive when zoomed in
        const sensitivity = 75 / projection.scale();
        const newRot = [
            rot[0] + event.dx * sensitivity,
            rot[1] - event.dy * sensitivity,
            rot[2]
        ];
        projection.rotate(newRot);
        pointProjection.rotate(newRot);
        updatePaths();
    });
    svg.call(drag);

    g.append("path")
        .datum({type: "Sphere"})
        .attr("class", "globe-sphere")
        .style("fill", "var(--bg-main)")
        .style("stroke", "rgba(57, 255, 20, 0.5)")
        .style("stroke-width", "1px")
        .style("stroke-dasharray", "1, 4")
        .style("stroke-linecap", "round")
        .attr("d", pathGenerator);

    // 1b. Removed from here to ensure it's drawn last (on top)

    // 2. Draw Radar Graticules (Lat/Lon rings)
    const graticule = d3.geoGraticule();
    g.append("path")
        .datum(graticule())
        .attr("class", "graticule")
        .style("fill", "none")
        .style("stroke", "rgba(57, 255, 20, 0.15)")
        .style("stroke-width", "0.5px")
        .attr("d", pathGenerator);

    // 3. Draw Countries (Dot Matrix Coastlines / Landmasses)
    g.selectAll("path.country")
        .data(worldGeoData.features)
        .enter()
        .append("path")
        .attr("class", "country-path")
        .attr("d", pathGenerator)
        .style("fill", "url(#dot-matrix)")
        .style("stroke", "var(--accent)")
        .style("stroke-width", "1.2px")
        .style("stroke-dasharray", "1, 3")
        .style("stroke-linecap", "round")
        .style("opacity", "0.8");

    if (!events || events.length === 0) {
        // Create an idle "Matrix Core" network using all known F1 tracks
        events = Object.keys(F1_COORDINATES).map((gpName, idx) => ({
            gpName: gpName,
            round: idx + 1
        }));
    }

    const tooltip = d3.select("#tooltip");

    // Filter events that we have coordinates for
    validEventsData = events
        .map(ev => ({ ...ev, coords: getCoords(ev.gpName) }))
        .filter(ev => ev.coords);

    // 4. Draw Flight Paths (Great Circles)
    const sortedEvents = [...validEventsData].sort((a,b) => (a.round || 0) - (b.round || 0));
    const pathsData = [];
    for(let i=0; i<sortedEvents.length-1; i++){
        pathsData.push({
            type: "Feature",
            geometry: {
                type: "LineString",
                coordinates: [sortedEvents[i].coords, sortedEvents[i+1].coords]
            }
        });
    }

    g.selectAll(".tour-path")
        .data(pathsData)
        .enter()
        .append("path")
        .attr("class", "tour-path")
        .style("fill", "none")
        .style("stroke", "rgba(57, 255, 20, 0.4)")
        .style("stroke-width", 1.5)
        .style("stroke-dasharray", "4,4")
        .style("opacity", 0.5)
        .attr("d", pathGenerator);

    // 5. Draw Glowing Points for F1 Races as Circles (so we can render the ones on the dark side)
    g.selectAll(".race-point")
        .data(validEventsData)
        .enter()
        .append("circle")
        .attr("class", "race-point")
        .attr("cx", d => pointProjection(d.coords)[0])
        .attr("cy", d => pointProjection(d.coords)[1])
        .attr("r", d => d.gpName === activeTarget ? 5 : 2)
        .style("fill", d => d.gpName === activeTarget ? "var(--danger)" : "var(--text-main)")
        .style("opacity", d => {
            const rot = projection.rotate();
            const center = [-rot[0], -rot[1]];
            const isBack = d3.geoDistance(d.coords, center) > Math.PI/2;
            return isBack ? 0.1 : 1;
        })
        .style("filter", "url(#glow)")
        .style("cursor", "pointer")
        .on("mouseover", function(event, d) {
            d3.select(this).attr("r", 7).style("opacity", 1);
            
            tooltip.style("display", "block")
                .style("opacity", 1)
                .html(`<strong>${d.round ? d.round + '. ' : ''}${d.gpName}</strong>`)
                .style("left", (event.pageX + 10) + "px")
                .style("top", (event.pageY + 10) + "px");
        })
        .on("mousemove", function(event) {
            tooltip.style("left", (event.pageX + 10) + "px").style("top", (event.pageY + 10) + "px");
        })
        .on("mouseout", function(event, d) {
            const rot = projection.rotate();
            const center = [-rot[0], -rot[1]];
            const isBack = d3.geoDistance(d.coords, center) > Math.PI/2;
            
            d3.select(this)
                .attr("r", d.gpName === activeTarget ? 5 : (isBack ? 1.5 : 2))
                .style("opacity", isBack ? 0.1 : 1);
                
            tooltip.style("display", "none").style("opacity", 0);
        });

    // 6. Draw Moving Glowing Particles using manual Projection loop
    const particlesData = pathsData.map((d, i) => ({
        interpolator: d3.geoInterpolate(d.geometry.coordinates[0], d.geometry.coordinates[1]),
        distance: d3.geoDistance(d.geometry.coordinates[0], d.geometry.coordinates[1]),
        t: 0,
        delay: i * 500, // staggered start
        running: false,
        feature: { type: "Feature", geometry: { type: "Point", coordinates: d.geometry.coordinates[0] } }
    }));

    const particles = g.selectAll(".tour-particle")
        .data(particlesData)
        .enter()
        .append("circle")
        .attr("class", "tour-particle")
        .style("fill", "var(--accent)")
        .style("filter", "url(#glow)")
        .style("opacity", 0)
        .attr("r", 2);

    particlesAnimationTimer = d3.timer(elapsed => {
        let needsRedraw = false;
        particlesData.forEach(p => {
             if (elapsed > p.delay) {
                 if (!p.running) { p.running = true; p.startTime = elapsed; }
                 const tElapsed = elapsed - p.startTime;
                 p.t = (tElapsed / 2000) % 1;
                 p.feature.geometry.coordinates = p.interpolator(p.t);
                 needsRedraw = true;
             }
        });
        if (needsRedraw) {
            // Always sync pointProjection with current rotation before projecting
            const rot = projection.rotate();
            if (pointProjection) pointProjection.rotate(rot).scale(projection.scale());
            const center = [-rot[0], -rot[1]];
            
            particles
                .attr("cx", d => pointProjection ? pointProjection(d.feature.geometry.coordinates)[0] : 0)
                .attr("cy", d => pointProjection ? pointProjection(d.feature.geometry.coordinates)[1] : 0)
                .style("opacity", d => {
                    if (!d.running) return 0;
                    const isBack = d3.geoDistance(d.feature.geometry.coordinates, center) > Math.PI/2;
                    const baseOp = Math.sin(d.t * Math.PI);
                    return isBack ? baseOp * 0.08 : baseOp;
                })
                .attr("r", d => {
                    const isBack = d3.geoDistance(d.feature.geometry.coordinates, center) > Math.PI/2;
                    return isBack ? 1.5 : 3;
                });
        }
    });
    // 7. Callout group for selected race label (CoD MW2019 style)
    const callout = g.append("g")
        .attr("class", "selected-race-callout")
        .style("display", "none")
        .style("pointer-events", "none");

    // Vertical leader line from dot to box
    callout.append("line")
        .attr("class", "callout-line")
        .attr("stroke", "var(--danger)")
        .attr("stroke-width", 1)
        .attr("opacity", 0.8);

    // Background rect
    callout.append("rect")
        .attr("class", "callout-rect")
        .attr("fill", "rgba(0,0,0,0.85)")
        .attr("stroke", "var(--danger)")
        .attr("stroke-width", 1)
        .attr("rx", 0);

    // Top accent bar
    callout.append("rect")
        .attr("class", "callout-accent")
        .attr("fill", "var(--danger)")
        .attr("height", 2);

    // Label text
    callout.append("text")
        .attr("class", "callout-text")
        .style("font-family", "'Share Tech Mono', monospace")
        .style("font-size", "11px")
        .style("fill", "#fff")
        .style("letter-spacing", "1.5px")
        .style("text-anchor", "middle")
        .style("dominant-baseline", "middle");

    // 8. Draw Internal SVG Scanline LAST to ensure it sits on top of all layers
    const scanlineG = g.append("g").attr("clip-path", "url(#globe-clip)");
    scanlineG.append("rect")
        .attr("class", "svg-globe-scanline")
        .attr("x", 1000/2 - currentScale)
        .attr("y", 500/2)
        .attr("width", currentScale * 2)
        .attr("height", 1.8)
        .attr("fill", "rgba(57, 255, 20, 0.9)")
        .attr("filter", "url(#glow)")
        .style("pointer-events", "none");

    // Start Dynamic Scan Animation
    scanAnimationTimer = d3.timer((elapsed) => {
        const r = projection.scale();
        const centerY = 500 / 2;
        const duration = 4200; // 4.2 second cycle for a more tactical pace
        const t = (elapsed % duration) / duration;
        
        // Move from -r to +r relative to center
        const yPos = centerY - r + (r * 2 * t);
        
        // Use a power function for opacity to make it "pulse" more sharply in the middle
        const opacity = Math.pow(Math.sin(t * Math.PI), 0.8);
        
        d3.select(".svg-globe-scanline")
            .attr("y", yPos)
            .style("opacity", opacity * 0.7);
    });

    // 9. Update persistent label for selected race
    updateTargetLabel();
}

// Show a persistent floating callout anchored to the selected race dot (CoD MW2019 style)
function updateTargetLabel() {
    if (!gSelection || !pointProjection) return;

    const callout = gSelection.select(".selected-race-callout");
    if (callout.empty()) return;

    if (!activeTarget) { callout.style("display", "none"); return; }

    const targetEvent = validEventsData.find(ev => ev.gpName === activeTarget);
    if (!targetEvent) { callout.style("display", "none"); return; }

    const rot = projection.rotate();
    const center = [-rot[0], -rot[1]];
    const isBack = d3.geoDistance(targetEvent.coords, center) > Math.PI/2;
    if (isBack) { callout.style("display", "none"); return; }

    const pos = pointProjection(targetEvent.coords);
    const dotX = pos[0];
    const dotY = pos[1];

    // Callout box dimensions
    const label = (targetEvent.round ? targetEvent.round + '. ' : '') + targetEvent.gpName;
    const boxW = label.length * 7 + 20;  // approx char width
    const boxH = 24;
    const lineLen = 28; // leader line length above dot
    const boxX = dotX - boxW / 2;
    const boxY = dotY - lineLen - boxH;

    callout.style("display", null);

    // Leader line: from dot up to box bottom
    callout.select(".callout-line")
        .attr("x1", dotX).attr("y1", dotY - 6)
        .attr("x2", dotX).attr("y2", dotY - lineLen);

    // Background rect
    callout.select(".callout-rect")
        .attr("x", boxX).attr("y", boxY)
        .attr("width", boxW).attr("height", boxH);

    // Top accent bar (CoD-style orange/red strip at top of callout)
    callout.select(".callout-accent")
        .attr("x", boxX).attr("y", boxY)
        .attr("width", boxW);

    // Text centered in box
    callout.select(".callout-text")
        .attr("x", dotX)
        .attr("y", boxY + boxH / 2 + 1)
        .text(label);
}

// Core helper to redraw all SVG elements when projection rotates
function updatePaths() {
    if(!gSelection) return;
    
    // Update clip path radius and scanline dimensions to match zoom
    const r = projection.scale();
    d3.select("#globe-clip circle").attr("r", r);
    d3.select(".svg-globe-scanline")
        .attr("x", 1000/2 - r)
        .attr("width", r * 2);

    gSelection.selectAll(".globe-sphere").attr("d", pathGenerator);
    gSelection.selectAll(".graticule").attr("d", pathGenerator);
    gSelection.selectAll(".country-path").attr("d", pathGenerator);
    gSelection.selectAll(".tour-path").attr("d", pathGenerator);
    
    // Update raw circles dynamically
    const rot = projection.rotate();
    const center = [-rot[0], -rot[1]];
    
    // Safety sync
    if(typeof pointProjection !== 'undefined') pointProjection.rotate(rot);
    
    gSelection.selectAll(".race-point")
        .attr("cx", d => typeof pointProjection !== 'undefined' ? pointProjection(d.coords)[0] : 0)
        .attr("cy", d => typeof pointProjection !== 'undefined' ? pointProjection(d.coords)[1] : 0)
        .style("opacity", d => {
            const isBack = d3.geoDistance(d.coords, center) > Math.PI/2;
            return isBack ? 0.1 : 1;
        })
        .attr("r", d => {
            if (d.gpName === activeTarget) return 5;
            const isBack = d3.geoDistance(d.coords, center) > Math.PI/2;
            return isBack ? 1.5 : 2;
        });
    
    // Update persistent label for selected race
    updateTargetLabel();
}

// Function to highlight a specific target and rotate the globe
export function highlightRaceOnMap(gpName) {
    if (!gpName) return;
    activeTarget = gpName;
    const targetEvent = validEventsData.find(ev => ev.gpName === gpName);
    
    // Instantly update colors
    if(gSelection) {
        gSelection.selectAll(".race-point")
            .style("fill", d => d.gpName === activeTarget ? "var(--danger)" : "var(--text-main)");
    }

    if (targetEvent && projection) {
        const targetCoords = targetEvent.coords; // [lon, lat]
        const targetScale = SCALE_SELECTED; // Zoom in on selection
        const startScale = currentScale;
        
        // Spin + zoom the globe simultaneously
        d3.transition()
            .duration(1200)
            .ease(d3.easeCubicInOut)
            .tween("rotate-zoom", function() {
                const currentRot = projection.rotate();
                // Target rotation is [-lon, -lat, 0] to bring point to center
                const r = d3.interpolate(currentRot, [-targetCoords[0], -targetCoords[1], 0]);
                const s = d3.interpolateNumber(startScale, targetScale);
                return function(t) {
                    const newRot = r(t);
                    const newScale = s(t);
                    currentScale = newScale;
                    projection.rotate(newRot).scale(newScale);
                    if(pointProjection) pointProjection.rotate(newRot).scale(newScale);
                    updatePaths();
                };
            });
    } else {
        updatePaths();
    }
}
