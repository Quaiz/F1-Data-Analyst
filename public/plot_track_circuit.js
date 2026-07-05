// Canvas init + circuit drawing helper (improved smooth rendering)
function initCanvas(canvas) {
	const dpr = window.devicePixelRatio || 1;
	const rect = canvas.getBoundingClientRect();
	canvas.width = Math.round(rect.width * dpr);
	canvas.height = Math.round(rect.height * dpr);
	canvas.style.width = rect.width + 'px';
	canvas.style.height = rect.height + 'px';
	const ctx = canvas.getContext('2d');
	if (!ctx) return null;
	ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
	return { ctx, w: rect.width, h: rect.height };
}

function clearCanvasBg(ctx, w, h) {
	ctx.clearRect(0, 0, w, h);
	ctx.fillStyle = 'rgba(16,18,24,0.95)';
	ctx.fillRect(0, 0, w, h);
	ctx.strokeStyle = 'rgba(255,255,255,0.02)';
	ctx.lineWidth = 1;
	ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
}

function rotatePoint(p, angle) {
	const c = Math.cos(angle), s = Math.sin(angle);
	return [p[0] * c + p[1] * s, -p[0] * s + p[1] * c];
}

function computeBounds(pts) {
	let minx = Infinity, miny = Infinity, maxx = -Infinity, maxy = -Infinity;
	for (const p of pts) {
		if (p[0] < minx) minx = p[0];
		if (p[1] < miny) miny = p[1];
		if (p[0] > maxx) maxx = p[0];
		if (p[1] > maxy) maxy = p[1];
	}
	return { minx, miny, maxx, maxy };
}

// Helper: format a meters value with thousands separators and unit suffix (e.g. "5,343 m")
function formatMeters(val) {
	if (val == null || val === '' || isNaN(Number(val))) return '—';
	const n = Math.round(Number(val));
	return `${n.toLocaleString()}m`;
}

// Helper: classify corner by speed (km/h)
function classifyCorner(_, speedKph) {
	const s = Number(speedKph) || 0;
	const slowColor =
		typeof SECTOR_LABEL_COLORS !== 'undefined' && SECTOR_LABEL_COLORS.S1
			? SECTOR_LABEL_COLORS.S1
			: '#FC0001';
	const mediumColor =
		typeof SECTOR_LABEL_COLORS !== 'undefined' && SECTOR_LABEL_COLORS.S3
			? SECTOR_LABEL_COLORS.S3
			: '#FFD400';
	const fastColor =
		typeof SECTOR_LABEL_COLORS !== 'undefined' && SECTOR_LABEL_COLORS.DRS
			? SECTOR_LABEL_COLORS.DRS
			: '#00BD7C';

	if (s < 120) return { cls: 'Slow', color: slowColor };
	if (s >= 120 && s <= 180) return { cls: 'Medium', color: mediumColor };
	return { cls: 'Fast', color: fastColor };
}

function offsetPolyline(screenPts, offset) {
	const n = [];
	for (let i = 0; i < screenPts.length; i++) {
		const p0 = screenPts[Math.max(0, i - 1)];
		const p1 = screenPts[Math.min(screenPts.length - 1, i + 1)];
		const tx = p1[0] - p0[0];
		const ty = p1[1] - p0[1];
		const nx = -ty;
		const ny = tx;
		const len = Math.hypot(nx, ny) || 1;
		n.push([nx / len, ny / len]);
	}
	const out = screenPts.map((p, i) => [
		p[0] + n[i][0] * offset,
		p[1] + n[i][1] * offset
	]);
	return out;
}

function catmullRomChain(pts, segments = 10) {
	if (!pts || pts.length < 2) return pts.slice();
	const out = [];
	for (let i = 0; i < pts.length - 1; i++) {
		const p0 = pts[Math.max(0, i - 1)];
		const p1 = pts[i];
		const p2 = pts[i + 1];
		const p3 = pts[Math.min(pts.length - 1, i + 2)];
		for (let j = 0; j < segments; j++) {
			const t = j / segments;
			const t2 = t * t;
			const t3 = t2 * t;
			const x =
				0.5 *
				((2 * p1[0]) +
					(-p0[0] + p2[0]) * t +
					(2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 +
					(-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3);
			const y =
				0.5 *
				((2 * p1[1]) +
					(-p0[1] + p2[1]) * t +
					(2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 +
					(-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3);
			out.push([x, y]);
		}
	}
	out.push(pts[pts.length - 1]);
	return out;
}

function drawPathSmooth(ctx, pts, color, width = 9) {
	if (!pts || pts.length < 2) return;
	const smooth = catmullRomChain(pts, 8);
	ctx.save();
	ctx.lineCap = 'round';
	ctx.lineJoin = 'round';
	ctx.strokeStyle = color;
	ctx.lineWidth = width;
	ctx.beginPath();
	ctx.moveTo(smooth[0][0], smooth[0][1]);
	for (let i = 1; i < smooth.length; i++) ctx.lineTo(smooth[i][0], smooth[i][1]);
	ctx.stroke();
	ctx.restore();
}

function idxForDistance(trackPoints, target) {
	let best = 0;
	let bestd = Infinity;
	for (let i = 0; i < trackPoints.length; i++) {
		const d = trackPoints[i].dist || 0;
		const dd = Math.abs(d - target);
		if (dd < bestd) {
			bestd = dd;
			best = i;
		}
	}
	return best;
}

// Main draw routine: accepts circuit JSON (as produced by server)
async function renderCircuitToCanvas(circuit) {
	const canvas = document.getElementById('track-canvas');
	if (!canvas) return;
	const init = initCanvas(canvas);
	if (!init) return;
	const { ctx, w, h } = init;
	clearCanvasBg(ctx, w, h);

	if (!circuit || !circuit.track_points || circuit.track_points.length < 2) {
		const el = document.querySelector('.track-empty');
		if (el) el.style.display = 'block';
		return;
	}
	const el = document.querySelector('.track-empty');
	if (el) el.style.display = 'none';

	// Update panel title to show selected event + year
	try {
		const sel = currentSelection();
		const titleEl = document.getElementById('track-panel-title');
		if (titleEl)
			titleEl.textContent = sel.gp
				? `${sel.gp} ${sel.year || ''}`.trim()
				: 'Circuit Track';
	} catch (e) { }

	const ptsRaw = circuit.track_points.map((p) => [p.x, p.y]);
	// Rotation formula: angle = -(ci.rotation * Math.PI / 180.0)
	const angle =
		circuit.rotation != null ? -(circuit.rotation * Math.PI / 180.0) : 0.0;
	const correctedAngle = angle + Math.PI;
	let ptsRot = ptsRaw.map((p) => rotatePoint(p, correctedAngle));
	// Flip horizontally (mirror X) to correct coordinate orientation
	ptsRot = ptsRot.map((p) => [-p[0], p[1]]);

	const bounds = computeBounds(ptsRot);
	const pad = 20;
	const trackW = bounds.maxx - bounds.minx || 1;
	const trackH = bounds.maxy - bounds.miny || 1;
	const scale = Math.min((w - pad * 2) / trackW, (h - pad * 2) / trackH);

	const trackWpx = trackW * scale;
	const trackHpx = trackH * scale;
	const tx = (w - trackWpx) / 2 - bounds.minx * scale;
	const ty = (h - trackHpx) / 2 - bounds.miny * scale;
	const screenPts = ptsRot.map((p) => [p[0] * scale + tx, p[1] * scale + ty]);

	// Save view & interaction state for interactivity handlers
	window._trackViewState = window._trackViewState || {};
	window._trackViewState.circuit = circuit;
	window._trackViewState.screenPts = screenPts;
	window._trackViewState.scale = scale;
	window._trackViewState.tx = tx;
	window._trackViewState.ty = ty;
	window._trackViewState.bounds = bounds;
	window._trackViewState.w = w;
	window._trackViewState.h = h;

	// placeholders; actual sector/DRS ranges are attached later
	window._trackViewState.sectorIdxRanges = [];
	window._trackViewState.drsSegments = [];
	window._trackViewState.drsZoneIds = [];

	// corners mapped to nearest track index + screen position
	window._trackViewState.corners = (circuit.corners || []).map((corner) => {
		const cx = corner['X'] || corner['x'] || 0;
		const cy = corner['Y'] || corner['y'] || 0;
		const crow = rotatePoint([cx, cy], correctedAngle);
		crow[0] = -crow[0];
		let best = 0,
			bestd = Infinity;
		for (let i = 0; i < ptsRot.length; i++) {
			const dx = ptsRot[i][0] - crow[0];
			const dy = ptsRot[i][1] - crow[1];
			const dd = dx * dx + dy * dy;
			if (dd < bestd) {
				bestd = dd;
				best = i;
			}
		}
		return { corner, idx: best, screen: screenPts[best] };
	});

	// speed trap (max speed) index
	try {
		let maxIdx = 0,
			maxV = -Infinity;
		for (let i = 0; i < circuit.track_points.length; i++) {
			const s = circuit.track_points[i].speed || 0;
			if (s > maxV) {
				maxV = s;
				maxIdx = i;
			}
		}
		window._trackViewState.speedTrap = {
			idx: maxIdx,
			speed: maxV,
			screen: screenPts[maxIdx]
		};
	} catch (e) {
		window._trackViewState.speedTrap = null;
	}

	// interaction state (hover/select)
	window._trackInteractionState =
		window._trackInteractionState || {
			hoveredSector: null,
			hoveredTurn: null,
			hoveredDRS: null,
			selectedSector: null,
			selectedTurn: null,
			selectedDRS: null,
			locked: false
		};

	// black glow base
	drawPathSmooth(ctx, screenPts, 'black', 12);

	// sector colored segments (3 sectors by distance)
	const lapLen =
		circuit.lap_length_m ||
		(circuit.track_points[circuit.track_points.length - 1].dist || 0);
	const sectorBounds = [0, lapLen / 3, (2 * lapLen) / 3, lapLen];
	let sectorColors = ['#ff6b6b', '#4d7cff', '#ffd85c'];
	try {
		if (typeof SECTOR_LABEL_COLORS !== 'undefined' && SECTOR_LABEL_COLORS) {
			sectorColors = [
				SECTOR_LABEL_COLORS.S1 || sectorColors[0],
				SECTOR_LABEL_COLORS.S2 || sectorColors[1],
				SECTOR_LABEL_COLORS.S3 || sectorColors[2]
			];
		}
	} catch (e) { }
	const interaction =
		window._trackInteractionState || {
			hoveredSector: null,
			selectedSector: null,
			selectedDRS: null,
			locked: false
		};

	for (let si = 0; si < 3; si++) {
		const d0 = sectorBounds[si],
			d1 = sectorBounds[si + 1];
		const i0 = idxForDistance(circuit.track_points, d0);
		const i1 = idxForDistance(circuit.track_points, d1);
		const a = Math.min(i0, i1);
		const b = Math.max(i0, i1);
		const seg = screenPts.slice(a, b + 1);

		let alpha = 1.0;
		let width = 6;
		if (interaction.selectedSector !== null) {
			if (interaction.selectedSector === si) {
				alpha = 1.0;
				width = 8;
			} else {
				alpha = 0.22;
				width = 5;
			}
		} else if (interaction.selectedDRS !== null) {
			alpha = 0.32;
			width = 5;
		} else if (interaction.hoveredSector === si) {
			alpha = 1.0;
			width = 9;
		}
		const color = hexToRGBA(sectorColors[si], alpha);
		drawPathSmooth(ctx, seg, color, width);
	}

	// Draw direction arrow at the beginning of Sector 1
	try {
		let anchorIdx = 0;
		for (let i = 0; i < circuit.track_points.length; i++) {
			if ((circuit.track_points[i].dist || 0) >= sectorBounds[0]) {
				anchorIdx = i;
				break;
			}
		}
		anchorIdx = Math.min(anchorIdx, screenPts.length - 1);

		let dir = [1, 0];
		if (anchorIdx > 0 && anchorIdx < screenPts.length - 1) {
			const pprev = screenPts[anchorIdx - 1];
			const pnext = screenPts[anchorIdx + 1];
			let vx = pnext[0] - pprev[0];
			let vy = pnext[1] - pprev[1];
			const vl = Math.hypot(vx, vy) || 1;
			vx /= vl;
			vy /= vl;
			dir = [vx, vy];
		} else if (screenPts.length >= 2) {
			const p0 = screenPts[anchorIdx];
			const p1 = screenPts[Math.min(screenPts.length - 1, anchorIdx + 1)];
			let vx = p1[0] - p0[0];
			let vy = p1[1] - p0[1];
			const vl = Math.hypot(vx, vy) || 1;
			vx /= vl;
			vy /= vl;
			dir = [vx, vy];
		}
		const anchor = screenPts[Math.min(anchorIdx, screenPts.length - 1)];
		let perp = [-dir[1], dir[0]];

		try {
			ctx.save();
			const flagW = Math.max(26, 32 * (scale / 1));
			const flagH = Math.max(10, 12 * (scale / 1));
			const fc = [anchor[0], anchor[1]];
			const centerScreen = [
				((bounds.minx + bounds.maxx) / 2) * scale + tx,
				((bounds.miny + bounds.maxy) / 2) * scale + ty
			];
			const candA = [anchor[0] + perp[0], anchor[1] + perp[1]];
			const candB = [anchor[0] - perp[0], anchor[1] - perp[1]];
			const distA = Math.hypot(candA[0] - centerScreen[0], candA[1] - centerScreen[1]);
			const distB = Math.hypot(candB[0] - centerScreen[0], candB[1] - centerScreen[1]);
			if (distB > distA) perp = [-perp[0], -perp[1]];
			ctx.translate(fc[0], fc[1]);
			const ang = Math.atan2(dir[1], dir[0]) + Math.PI / 2;
			ctx.rotate(ang);
			ctx.fillStyle = '#FFFFFF';
			ctx.fillRect(-flagW / 2, -flagH / 2, flagW, flagH);
			const cols = 4,
				rows = 2;
			const cw = flagW / cols,
				ch = flagH / rows;
			for (let r = 0; r < rows; r++)
				for (let c = 0; c < cols; c++) {
					if ((r + c) % 2 === 0) {
						ctx.fillStyle = '#000000';
						ctx.fillRect(-flagW / 2 + c * cw, -flagH / 2 + r * ch, cw, ch);
					}
				}
			ctx.lineWidth = Math.max(1, 1 * (scale / 1));
			ctx.strokeStyle = '#000000';
			ctx.strokeRect(-flagW / 2, -flagH / 2, flagW, flagH);
			ctx.restore();

			try {
				const arrowColor = '#000000';
				const arrowLen = Math.max(12, 14 * (scale / 1));
				const arrowGap = Math.max(18, 24 * (scale / 1));
				const inward = [-perp[0], -perp[1]];
				let arrowBase = [
					anchor[0] + inward[0] * (flagH / 2 + arrowGap),
					anchor[1] + inward[1] * (flagH / 2 + arrowGap)
				];
				const arrowBack = Math.max(0, arrowLen * 0.35);
				arrowBase = [
					arrowBase[0] - dir[0] * arrowBack,
					arrowBase[1] - dir[1] * arrowBack
				];
				const normal = [-dir[1], dir[0]];
				const tip = [
					arrowBase[0] + dir[0] * arrowLen,
					arrowBase[1] + dir[1] * arrowLen
				];
				const left = [
					arrowBase[0] - normal[0] * (arrowLen * 0.35),
					arrowBase[1] - normal[1] * (arrowLen * 0.35)
				];
				const right = [
					arrowBase[0] + normal[0] * (arrowLen * 0.35),
					arrowBase[1] + normal[1] * (arrowLen * 0.35)
				];
				ctx.beginPath();
				ctx.fillStyle = arrowColor;
				ctx.strokeStyle = '#FFFFFF';
				ctx.lineWidth = Math.max(1, 1 * (scale / 1));
				ctx.moveTo(tip[0], tip[1]);
				ctx.lineTo(left[0], left[1]);
				ctx.lineTo(right[0], right[1]);
				ctx.closePath();
				ctx.fill();
				ctx.stroke();
			} catch (e) { }

			try {
				const poleLen = Math.max(6, 8 * (scale / 1));
				const poleWidth = Math.max(1.5, 1.5 * (scale / 1));
				const poleStart = [
					anchor[0] + perp[0] * (flagH / 2),
					anchor[1] + perp[1] * (flagH / 2)
				];
				const poleEnd = [
					poleStart[0] + perp[0] * poleLen,
					poleStart[1] + perp[1] * poleLen
				];
				ctx.beginPath();
				ctx.strokeStyle = '#000000';
				ctx.lineWidth = poleWidth;
				ctx.moveTo(poleStart[0], poleStart[1]);
				ctx.lineTo(poleEnd[0], poleEnd[1]);
				ctx.stroke();
			} catch (e) { }
		} catch (e) { }
	} catch (e) { }

	// --- DRS segments: now with logical zone IDs so wrap-around zones stay as a single "DRS Zone X"
	const drsVals = circuit.track_points.map((p) => Number(p.drs || 0));
	const maxDrs = drsVals.length ? Math.max(...drsVals) : 0;
	const useHighThreshold = maxDrs >= 10;
	const active = drsVals.map((v) => (useHighThreshold ? v >= 10 : v > 0));

	const drsSegments = [];
	let segStart = null;
	for (let i = 0; i < active.length; i++) {
		if (active[i] && segStart === null) segStart = i;
		if ((!active[i] || i === active.length - 1) && segStart !== null) {
			const s = segStart;
			const e = active[i] ? i : i - 1;
			if (e > s) drsSegments.push([s, e]);
			segStart = null;
		}
	}

	// Logical DRS zone IDs: allows first and last segments to belong to same zone
	let drsZoneIds = drsSegments.map((_, i) => i + 1);

	// If first segment starts at 0 and last segment ends at last index,
	// they represent one continuous DRS zone crossing start/finish.
	if (drsSegments.length >= 2) {
		const first = drsSegments[0];
		const last = drsSegments[drsSegments.length - 1];
		if (first[0] === 0 && last[1] === active.length - 1) {
			drsZoneIds[drsSegments.length - 1] = drsZoneIds[0];
		}
	}

	for (let di = 0; di < drsSegments.length; di++) {
		const zoneId = drsZoneIds[di];
		const segIdx = drsSegments[di];
		const s = segIdx[0],
			e = segIdx[1];
		const segPts = screenPts.slice(s, e + 1);
		const offsetPx = Math.max(6, Math.round(12 * (scale / 1)));
		const segOff = offsetPolyline(segPts, offsetPx);
		if (segOff && segOff.length) {
			const isSelected = interaction.selectedDRS === zoneId;
			const isHovered = interaction.hoveredDRS === zoneId;
			let baseWidth = Math.max(4, 6 * (scale / 1));
			let alpha = 1.0;
			if (interaction.selectedSector !== null) {
				alpha = 0.22;
			} else if (interaction.selectedDRS !== null) {
				alpha = !isSelected ? 0.32 : 1.0;
			}
			let drawColor = '#32CD32';
			if (isHovered) baseWidth = Math.max(baseWidth, baseWidth * 1.8);
			const colorRGBA = hexToRGBA(drawColor, alpha);

			if (isHovered || isSelected) {
				drawPathSmooth(
					ctx,
					segOff,
					hexToRGBA('#32CD32', Math.min(0.18 + alpha * 0.4, 0.6)),
					Math.max(baseWidth * 1.6, baseWidth + 4)
				);
			}
			drawPathSmooth(ctx, segOff, colorRGBA, baseWidth);
		}
	}

	// Attach computed DRS segments + logical zone IDs
	try {
		window._trackViewState.drsSegments = drsSegments;
		window._trackViewState.drsZoneIds = drsZoneIds;
	} catch (e) { }

	// Compute sector index ranges
	try {
		const sectorIdxRanges = [];
		for (let si = 0; si < 3; si++) {
			const d0 = sectorBounds[si],
				d1 = sectorBounds[si + 1];
			const i0 = idxForDistance(circuit.track_points, d0);
			const i1 = idxForDistance(circuit.track_points, d1);
			const a = Math.min(i0, i1);
			const b = Math.max(i0, i1);
			const distStart = circuit.track_points[a]
				? circuit.track_points[a].dist || 0
				: 0;
			const distEnd = circuit.track_points[b]
				? circuit.track_points[b].dist || 0
				: 0;
			sectorIdxRanges.push({
				si,
				a,
				b,
				distStart,
				distEnd,
				length_m: Math.abs(distEnd - distStart)
			});
		}
		window._trackViewState.sectorIdxRanges = sectorIdxRanges;
	} catch (e) { }

	// corner bubbles
	try {
		const corners = circuit.corners || [];
		for (const corner of corners) {
			const cx = corner['X'] || corner['x'] || 0;
			const cy = corner['Y'] || corner['y'] || 0;
			const crow = rotatePoint([cx, cy], correctedAngle);
			crow[0] = -crow[0];
			let best = 0;
			let bestd = Infinity;
			for (let i = 0; i < ptsRot.length; i++) {
				const dx = ptsRot[i][0] - crow[0];
				const dy = ptsRot[i][1] - crow[1];
				const dd = dx * dx + dy * dy;
				if (dd < bestd) {
					bestd = dd;
					best = i;
				}
			}
			const base = screenPts[best];
			const prev = ptsRot[Math.max(0, best - 1)];
			const next = ptsRot[Math.min(ptsRot.length - 1, best + 1)];
			const tang = [next[0] - prev[0], next[1] - prev[1]];
			let nx = -tang[1],
				ny = tang[0];
			const nlen = Math.hypot(nx, ny) || 1;
			nx /= nlen;
			ny /= nlen;
			const offsetDist = Math.max(10, 14 * (scale / 1));
			let sideKey =
				corner.Number !== undefined ? corner.Number : best;
			const side = sideKey % 2 === 0 ? 1 : -1;
			const center = [
				base[0] + nx * offsetDist * side,
				base[1] + ny * offsetDist * side
			];
			ctx.beginPath();
			ctx.fillStyle = 'white';
			ctx.arc(center[0], center[1], Math.max(7, 9 * (scale / 1)), 0, Math.PI * 2);
			ctx.fill();
			ctx.lineWidth = 1;
			ctx.strokeStyle = 'rgba(0,0,0,0.6)';
			ctx.stroke();

			let num =
				corner.Number ||
				corner.number ||
				corner.Num ||
				corner['Number'] ||
				'';
			ctx.fillStyle = 'black';
			ctx.font = `bold ${Math.max(
				9,
				Math.round(9 * (scale / 1))
			)}px sans-serif`;
			ctx.textAlign = 'center';
			ctx.textBaseline = 'middle';
			ctx.fillText(String(num || ''), center[0], center[1]);

			try {
				const interaction = window._trackInteractionState || {};
				const displayNum = String(num || '');
				if (
					(interaction.hoveredTurn &&
						String(interaction.hoveredTurn) === displayNum &&
						!interaction.locked) ||
					(interaction.selectedTurn &&
						String(interaction.selectedTurn) === displayNum &&
						interaction.locked)
				) {
					ctx.beginPath();
					ctx.arc(
						center[0],
						center[1],
						Math.max(10, 12 * (scale / 1)),
						0,
						Math.PI * 2
					);
					ctx.lineWidth = 2.2;
					ctx.strokeStyle = '#00FFFF';
					ctx.stroke();
				}
			} catch (e) { }
		}
	} catch (e) {
		console.warn('Corner drawing failed', e);
	}

	// speed trap marker (max speed)
	try {
		let maxIdx = 0,
			maxV = -Infinity;
		for (let i = 0; i < circuit.track_points.length; i++) {
			const s = circuit.track_points[i].speed || 0;
			if (s > maxV) {
				maxV = s;
				maxIdx = i;
			}
		}
		const st = screenPts[maxIdx];
		ctx.beginPath();
		ctx.arc(st[0], st[1], Math.max(6, 7 * (scale / 1)), 0, Math.PI * 2);
		ctx.fillStyle = '#FF4BFF';
		ctx.fill();
		ctx.lineWidth = 1.2;
		ctx.strokeStyle = 'white';
		ctx.stroke();

		try {
			const ist = window._trackInteractionState || {};
			if (ist.hoverPos) {
				const dx = ist.hoverPos[0] - st[0];
				const dy = ist.hoverPos[1] - st[1];
				if (dx * dx + dy * dy < Math.max(12, 12 * scale) ** 2) {
					ctx.beginPath();
					ctx.arc(
						st[0],
						st[1],
						Math.max(10, 12 * (scale / 1)),
						0,
						Math.PI * 2
					);
					ctx.lineWidth = 2;
					ctx.strokeStyle = '#FF8BFF';
					ctx.stroke();
				}
			}
		} catch (e) { }
	} catch (e) { }

	// Populate the right-hand info panel (no text on canvas)
	try {
		const elName = document.getElementById('info-circuit-name');
		const elLocation = document.getElementById('info-location');
		const elLength = document.getElementById('info-length');
		const elCorners = document.getElementById('info-corners');
		const elElevation = document.getElementById('info-elevation');
		const elSeaLevel = document.getElementById('info-sea-level');
		const elRace = document.getElementById('info-race');
		const elRotation = document.getElementById('info-rotation');

		let displayName = circuit.circuit_name || '';
		let locationDisplay = circuit.location || null;
		try {
			if (typeof CIRCUIT_INFO !== 'undefined') {
				const key = circuit._gpName || circuit.circuit_name || null;
				if (key && CIRCUIT_INFO[key]) {
					const info = CIRCUIT_INFO[key];
					if (info.circuit) displayName = info.circuit;
					const loc = info.location || null;
					const country = info.country || null;
					if (loc && country) locationDisplay = `${loc}, ${country}`;
					else if (loc) locationDisplay = loc;
					else if (country) locationDisplay = country;
				}
			}
		} catch (e) {
			console.warn('CIRCUIT_INFO lookup failed', e);
		}

		if (elName) elName.textContent = displayName || circuit.circuit_name || '';
		const elCountry = document.getElementById('info-country');
		let locOnly = null,
			countryOnly = null;
		try {
			if (typeof CIRCUIT_INFO !== 'undefined') {
				const key = circuit._gpName || circuit.circuit_name || null;
				if (key && CIRCUIT_INFO[key]) {
					const info = CIRCUIT_INFO[key];
					locOnly = info.location || null;
					countryOnly = info.country || null;
				}
			}
		} catch (e) {
			console.warn('CIRCUIT_INFO read failed', e);
		}
		if (!locOnly && circuit.location) {
			const parts = String(circuit.location).split(',');
			if (parts.length >= 2) {
				countryOnly = parts[parts.length - 1].trim();
				locOnly = parts.slice(0, parts.length - 1).join(',').trim();
			} else {
				locOnly = parts[0].trim();
			}
		}

		if (elLocation) elLocation.textContent = locOnly || '—';
		if (elCountry) elCountry.textContent = countryOnly || '—';
		// Prefer human-provided CIRCUIT_INFO values (track_length in km) when available,
		// otherwise fall back to the crawled centerline `lap_length_m`.
		const _ci_key = circuit._gpName || circuit.circuit_name || null;
		const _ci_obj =
			_ci_key && typeof CIRCUIT_INFO !== 'undefined' && CIRCUIT_INFO[_ci_key]
				? CIRCUIT_INFO[_ci_key]
				: null;
		let _track_km = null;
		if (_ci_obj && _ci_obj.track_length !== undefined && _ci_obj.track_length !== null) {
			_track_km = Number(_ci_obj.track_length);
		} else if (circuit.lap_length_m) {
			_track_km = Number(circuit.lap_length_m) / 1000.0;
		}
		if (elLength)
			elLength.textContent = _track_km ? `${_track_km.toFixed(3)}km` : '—';
		if (elCorners)
			elCorners.textContent =
				circuit.n_corners ||
				(circuit.corners ? circuit.corners.length : '—');

		// Elevation change: prefer CIRCUIT_INFO.elevation_change (meters) when present
		let _elev_m = null;
		if (_ci_obj && _ci_obj.elevation_change !== undefined && _ci_obj.elevation_change !== null) {
			_elev_m = Number(_ci_obj.elevation_change);
		} else if (circuit.elevation_change_m) {
			_elev_m = Number(circuit.elevation_change_m);
		}
		if (elElevation)
			elElevation.textContent = _elev_m ? `~${Math.round(_elev_m)}m` : '—';

		try {
			let seaLevelVal = null;
			const key = circuit._gpName || circuit.circuit_name || null;
			if (
				key &&
				typeof CIRCUIT_INFO !== 'undefined' &&
				CIRCUIT_INFO[key] &&
				CIRCUIT_INFO[key].sea_level !== undefined &&
				CIRCUIT_INFO[key].sea_level !== null
			) {
				seaLevelVal = CIRCUIT_INFO[key].sea_level;
			} else if (
				circuit.sea_level_m !== undefined &&
				circuit.sea_level_m !== null
			) {
				seaLevelVal = circuit.sea_level_m;
			} else if (
				circuit.sea_level !== undefined &&
				circuit.sea_level !== null
			) {
				seaLevelVal = circuit.sea_level;
			} else if (
				circuit.altitude_m !== undefined &&
				circuit.altitude_m !== null
			) {
				seaLevelVal = circuit.altitude_m;
			}
			if (elSeaLevel) {
				elSeaLevel.textContent =
					seaLevelVal !== null && !isNaN(Number(seaLevelVal))
						? formatMeters(seaLevelVal)
						: '—';
			}
		} catch (e) {
			if (elSeaLevel) elSeaLevel.textContent = '—';
		}

		if (elRace) {
			elRace.textContent = circuit.race_laps
				? `${circuit.race_laps} laps`
				: '—';
		}
		const elRaceLen = document.getElementById('info-race-length');
		if (elRaceLen) {
			// Prefer CIRCUIT_INFO.race_length (total km) when available.
			let total_km = null;
			if (_ci_obj && _ci_obj.race_length !== undefined && _ci_obj.race_length !== null) {
				total_km = Number(_ci_obj.race_length);
			} else if (circuit.race_laps && _track_km) {
				total_km = Number(circuit.race_laps) * Number(_track_km);
			} else if (_track_km) {
				total_km = Number(_track_km);
			}

			if (total_km !== null && !isNaN(total_km)) {
				// const total_mi = total_km * 0.621371;
				// Use one decimal place for presentation
				elRaceLen.innerHTML = `${total_km.toFixed(1)}km<br/><span style="font-weight:400"></span>`;
			} else {
				elRaceLen.textContent = '—';
			}
		}
	} catch (e) {
		console.warn('Failed to populate info panel', e);
	}

	try {
		if (!window._trackInteractionSetup) setupTrackInteractions(canvas);
	} catch (e) { }
}

// --- Interaction helpers: tooltip, hit-testing, event handlers
function hexToRGBA(hex, a) {
	if (!hex) return `rgba(255,255,255,${a})`;
	const h = hex.replace('#', '');
	const bigint = parseInt(
		h.length === 3 ? h.split('').map((c) => c + c).join('') : h,
		16
	);
	const r = (bigint >> 16) & 255;
	const g = (bigint >> 8) & 255;
	const b = bigint & 255;
	return `rgba(${r},${g},${b},${a})`;
}

function ensureTooltip() {
	let tt = document.getElementById('track-tooltip');
	if (tt) return tt;
	tt = document.createElement('div');
	tt.id = 'track-tooltip';
	tt.style.position = 'fixed';
	tt.style.pointerEvents = 'none';
	tt.style.background = 'rgba(20,20,26,0.98)';
	tt.style.color = 'white';
	tt.style.padding = '8px 10px';
	tt.style.borderRadius = '6px';
	tt.style.fontSize = '12px';
	tt.style.boxShadow = '0 6px 18px rgba(0,0,0,0.6)';
	tt.style.zIndex = 9999;
	tt.style.display = 'none';
	document.body.appendChild(tt);
	return tt;
}

function findNearestIndex(screenPts, x, y) {
	let best = 0,
		bestd = Infinity;
	for (let i = 0; i < screenPts.length; i++) {
		const dx = screenPts[i][0] - x;
		const dy = screenPts[i][1] - y;
		const d = dx * dx + dy * dy;
		if (d < bestd) {
			bestd = d;
			best = i;
		}
	}
	return { idx: best, dist2: bestd };
}

function setupTrackInteractions(canvas) {
	const tt = ensureTooltip();
	window._trackInteractionSetup = true;
	const state = window._trackInteractionState;
	const rect = () => canvas.getBoundingClientRect();

	function updateTooltipContent(info) {
		const t = ensureTooltip();
		t.innerHTML = info;
		t.style.display = 'block';
	}

	function hideTooltip() {
		const t = document.getElementById('track-tooltip');
		if (t) t.style.display = 'none';
	}

	function redraw() {
		try {
			renderCircuitToCanvas(window._trackViewState.circuit);
		} catch (e) { }
	}

	canvas.addEventListener('mousemove', function (ev) {
		const bb = rect();
		const mx = ev.clientX - bb.left;
		const my = ev.clientY - bb.top;
		const view = window._trackViewState;
		if (!view) return;
		const hit = findNearestIndex(view.screenPts, mx, my);
		const idx = hit.idx;

		// detect sector under cursor
		let hoverSector = null;
		for (const s of view.sectorIdxRanges || []) {
			if (idx >= s.a && idx <= s.b) {
				hoverSector = s.si;
				break;
			}
		}

		// detect DRS zone using logical zoneId
		let hoverDRS = null;
		for (let i = 0; i < (view.drsSegments || []).length; i++) {
			const s = view.drsSegments[i];
			if (idx >= s[0] && idx <= s[1]) {
				const zoneIds = view.drsZoneIds || [];
				hoverDRS = zoneIds[i] || i + 1;
				break;
			}
		}

		// detect corner
		let hoverTurn = null;
		let hoverTurnObj = null;
		for (const c of view.corners || []) {
			const dx = c.screen[0] - mx;
			const dy = c.screen[1] - my;
			if (dx * dx + dy * dy < Math.max(12, 12 * view.scale) ** 2) {
				hoverTurnObj = c;
				hoverTurn =
					c.corner.Number ||
					c.corner.number ||
					c.corner.Num ||
					c.corner['Number'] ||
					'?';
				break;
			}
		}

		// speed trap
		let hoverSpeed = false;
		if (view.speedTrap) {
			const dx = view.speedTrap.screen[0] - mx;
			const dy = view.speedTrap.screen[1] - my;
			if (dx * dx + dy * dy < Math.max(10, 10 * view.scale) ** 2) {
				hoverSpeed = true;
			}
		}

		if (!state.locked) {
			state.hoveredSector = hoverSector;
			state.hoveredDRS = hoverDRS;
			state.hoveredTurn = hoverTurn;
			state.hoverPos = [mx, my];

			if (hoverTurnObj) {
				try {
					const tp = view.circuit.track_points || [];
					const idxCorner = hoverTurnObj.idx || 0;
					const pcurr = tp[idxCorner] || {};
					const localSpeed = Number(pcurr.speed || 0);
					const cls = classifyCorner(null, localSpeed);
					const classColor = cls.color;

					let sectorIndex = 0;
					for (const s of view.sectorIdxRanges || []) {
						if (idxCorner >= s.a && idxCorner <= s.b) {
							sectorIndex = s.si;
							break;
						}
					}
					const sectorKey = 'S' + (sectorIndex + 1);
					const turnColor =
						typeof SECTOR_LABEL_COLORS !== 'undefined' &&
							SECTOR_LABEL_COLORS[sectorKey]
							? SECTOR_LABEL_COLORS[sectorKey]
							: '#FFFFFF';

					const label = `<strong style="color:${turnColor}">Turn ${hoverTurn}</strong>`;
					const body =
						`<div style="margin-top:6px;color:${classColor};font-weight:600">${cls.cls}-speed corner</div>` +
						`<div style="margin-top:4px"><strong>Typical speed:</strong> ~${localSpeed.toFixed(
							2
						)}km/h</div>`;
					updateTooltipContent(label + '<br/>' + body);
				} catch (e) {
					updateTooltipContent(`<strong>Turn ${hoverTurn}</strong>`);
				}
			} else if (hoverSpeed) {
				const s = view.speedTrap.speed || '—';
				const col =
					typeof SECTOR_LABEL_COLORS !== 'undefined' &&
						SECTOR_LABEL_COLORS.Speed
						? SECTOR_LABEL_COLORS.Speed
						: '#FF4BFF';
				updateTooltipContent(
					`<strong style="color:${col}">Speed Trap</strong><br/><strong>Top speed:</strong> ~${s}km/h`
				);
			} else if (hoverDRS) {
				// find representative segment for this logical zoneId
				const zoneIds = view.drsZoneIds || [];
				let segIndex = 0;
				for (let i = 0; i < (view.drsSegments || []).length; i++) {
					if ((zoneIds[i] || i + 1) === hoverDRS) {
						segIndex = i;
						break;
					}
				}
				const seg = view.drsSegments[segIndex];
				const d0 = view.circuit.track_points[seg[0]].dist || 0;
				const d1 = view.circuit.track_points[seg[1]].dist || 0;
				const col =
					typeof SECTOR_LABEL_COLORS !== 'undefined' &&
						SECTOR_LABEL_COLORS.DRS
						? SECTOR_LABEL_COLORS.DRS
						: '#00BD7C';
				updateTooltipContent(
					`<strong style="color:${col}">DRS Zone ${hoverDRS}</strong>` +
					`<br/><strong>DRS length:</strong> ${(
						Math.abs(d1 - d0) / 1000
					).toFixed(3)}km`
				);
			} else if (hoverSector !== null) {
				const s = view.sectorIdxRanges[hoverSector];
				const turns = (view.corners || []).filter(
					(c) => c.idx >= s.a && c.idx <= s.b
				).length;
				const lapLen =
					(view.circuit && (view.circuit.lap_length_m || (view.circuit.track_points && view.circuit.track_points.length ? (view.circuit.track_points[view.circuit.track_points.length - 1].dist || 0) : 0))) ||
					0;
				const startKm = (s.distStart || 0) / 1000;
				const endKm = (s.distEnd || 0) / 1000;
				const pct = lapLen ? (Math.abs(s.length_m || 0) / lapLen) * 100 : null;
				const colKey = 'S' + (hoverSector + 1);
				const fallbackColors = ['#ff6b6b', '#4d7cff', '#ffd85c'];
				const col =
					typeof SECTOR_LABEL_COLORS !== 'undefined' &&
						SECTOR_LABEL_COLORS[colKey]
						? SECTOR_LABEL_COLORS[colKey]
						: fallbackColors[hoverSector] || '#ffffff';
				updateTooltipContent(
					`<strong style="color:${col}">Sector ${hoverSector + 1}</strong>` +
					`<br/><strong>Sector length:</strong> ${(s.length_m / 1000).toFixed(
						3
					)}km` +
					(pct != null ? ` <span style="color:#bbb">(${pct.toFixed(0)}% lap)</span>` : '') +
					`<br/><strong>Range:</strong> ${startKm.toFixed(3)}–${endKm.toFixed(3)}km` +
					`<br/><strong>Number of turns:</strong> ${turns}`
				);
			} else {
				hideTooltip();
			}

			if (state.hoverPos) {
				const ttEl = document.getElementById('track-tooltip');
				if (ttEl && ttEl.style.display !== 'none') {
					ttEl.style.left = ev.clientX + 14 + 'px';
					ttEl.style.top = ev.clientY + 10 + 'px';
				}
			}

			redraw();
		}
	});

	canvas.addEventListener('mouseleave', function () {
		if (!state.locked) {
			state.hoveredSector = null;
			state.hoveredTurn = null;
			state.hoveredDRS = null;
			hideTooltip();
			redraw();
		}
	});

	canvas.addEventListener('click', function (ev) {
		const bb = rect();
		const mx = ev.clientX - bb.left;
		const my = ev.clientY - bb.top;
		const view = window._trackViewState;
		if (!view) return;
		const hit = findNearestIndex(view.screenPts, mx, my);
		const idx = hit.idx;

		// corner click
		let clickedTurn = null;
		for (const c of view.corners || []) {
			const dx = c.screen[0] - mx;
			const dy = c.screen[1] - my;
			if (dx * dx + dy * dy < Math.max(12, 12 * view.scale) ** 2) {
				clickedTurn =
					c.corner.Number ||
					c.corner.number ||
					c.corner.Num ||
					c.corner['Number'] ||
					'?';
				break;
			}
		}
		if (clickedTurn) {
			if (state.selectedTurn === clickedTurn && state.locked) {
				state.selectedTurn = null;
				state.locked = false;
			} else {
				state.selectedTurn = clickedTurn;
				state.locked = true;
				state.selectedSector = null;
				state.selectedDRS = null;
			}
			redraw();
			return;
		}

		// DRS click (logical zone)
		let clickedDRS = null;
		for (let i = 0; i < (view.drsSegments || []).length; i++) {
			const s = view.drsSegments[i];
			if (idx >= s[0] && idx <= s[1]) {
				const zoneIds = view.drsZoneIds || [];
				clickedDRS = zoneIds[i] || i + 1;
				break;
			}
		}
		if (clickedDRS) {
			if (state.selectedDRS === clickedDRS && state.locked) {
				state.selectedDRS = null;
				state.locked = false;
			} else {
				state.selectedDRS = clickedDRS;
				state.locked = true;
				state.selectedSector = null;
				state.selectedTurn = null;
			}
			redraw();
			return;
		}

		// sector click
		let clickedSector = null;
		for (const s of view.sectorIdxRanges || []) {
			if (idx >= s.a && idx <= s.b) {
				clickedSector = s;
				break;
			}
		}
		if (clickedSector) {
			if (state.selectedSector === clickedSector.si && state.locked) {
				state.selectedSector = null;
				state.locked = false;
			} else {
				state.selectedSector = clickedSector.si;
				state.locked = true;
				state.selectedTurn = null;
				state.selectedDRS = null;
			}
			redraw();
			return;
		}

		// clear selection
		state.selectedSector = null;
		state.selectedTurn = null;
		state.selectedDRS = null;
		state.locked = false;
		redraw();
	});
}

// Helper: determine currently selected year/gp/session from DOM
function currentSelection() {
	let year = null;
	const ys = document.querySelector('#year-select');
	if (ys && ys.value) year = Number(ys.value) || null;
	if (year == null) year = typeof CURRENT_YEAR !== 'undefined' ? CURRENT_YEAR : new Date().getFullYear();

	let gp = null;
	const rs = document.querySelector('#race-select');
	if (rs && rs.value) gp = rs.value;

	let session = 'R';
	const sp = document.querySelector('#session-pill-group .pill-active');
	if (sp && sp.dataset.sessionCode) session = sp.dataset.sessionCode;
	return { year, gp, session };
}

// Fetch circuit via session-data API (payload.circuit) and render
async function fetchAndRenderCircuit() {
	const sel = currentSelection();
	if (!sel.gp) return;
	const gp = sel.gp;
	const year =
		sel.year ||
		(typeof CURRENT_YEAR !== 'undefined'
			? CURRENT_YEAR
			: new Date().getFullYear());
	const url = `/api/session-data?year=${encodeURIComponent(
		year
	)}&gpName=${encodeURIComponent(gp)}&session=R`;
	try {
		const r = await fetch(url);
		if (!r.ok) return;
		const data = await r.json();
		const circuit = data && data.circuit ? data.circuit : null;
		if (circuit) circuit._gpName = gp || null;
		await renderCircuitToCanvas(circuit);
	} catch (e) {
		console.warn('Failed to fetch/render circuit', e);
	}
}

// Public API for other modules
window.updateCircuitPreview = fetchAndRenderCircuit;

document.addEventListener('DOMContentLoaded', function () {
	setTimeout(fetchAndRenderCircuit, 500);
});

window.TrackPreview = {
	setEmptyText: function (txt) {
		const el = document.querySelector('.track-empty');
		if (el) el.textContent = txt || '';
	}
};