import { orbitColor } from "./rational_points.js?v=20261112-5";

const MAX_VISIBLE_RATIONAL_SQUARES = 300_000;

export function initOverlay(canvas) {
  const ctx = canvas.getContext("2d");
  return { canvas, ctx, cycles: [] };
}

// Convert world point -> screen pixel consistent with shader mapping
export function worldToScreen(p, canvas, state) {
  const W = canvas.width, H = canvas.height;
  const aspect = W / H;

  // shader: aspectVec=(W/H,1); xy=(uv*2-1)*aspectVec; p=(xy/zoom)+pan
  // invert:
  // xy = (p - pan) * zoom
  // uv = (xy/aspectVec + 1)/2
  const xyx = (p[0] - state.panX) * state.zoom;
  const xyy = (p[1] - state.panY) * state.zoom;
  const u = (xyx / aspect + 1) * 0.5;
  const v = (xyy + 1) * 0.5;

  return [u * W, (1 - v) * H]; // flip v for canvas y-down
}

function visibleRationalGrid(canvas, state) {
  const q = state.denominator;
  const aspect = canvas.width / canvas.height;
  const minimumWorldX = state.panX - aspect / state.zoom;
  const maximumWorldX = state.panX + aspect / state.zoom;
  const minimumWorldY = state.panY - 1 / state.zoom;
  const maximumWorldY = state.panY + 1 / state.zoom;
  const minimumX = Math.max(1, Math.ceil(q * minimumWorldX - 0.5));
  const maximumX = Math.min(q - 2, Math.floor(q * maximumWorldX + 0.5));
  const minimumY = Math.max(1, Math.ceil(q * minimumWorldY - 0.5));
  const viewportMaximumY = Math.min(q - 2, Math.floor(q * maximumWorldY + 0.5));
  let count = 0;
  for (let x = minimumX; x <= maximumX; x++) {
    count += Math.max(0, Math.min(viewportMaximumY, q - x - 1) - minimumY + 1);
  }
  return { minimumX, maximumX, minimumY, viewportMaximumY, count };
}

function drawRationalGrid(overlay, state) {
  const { canvas, ctx } = overlay;
  const squareSizePixels = canvas.height * state.zoom / (2 * state.denominator);
  if (squareSizePixels < 1) {
    return {
      squareSizePixels,
      warning: `grid squares are ${squareSizePixels.toFixed(2)} px; zoom in to resolve them`,
    };
  }

  const visible = visibleRationalGrid(canvas, state);
  if (visible.count > MAX_VISIBLE_RATIONAL_SQUARES) {
    return {
      squareSizePixels,
      warning: `${visible.count.toLocaleString()} squares are visible; zoom in to render them`,
    };
  }

  const q = state.denominator;
  for (let x = visible.minimumX; x <= visible.maximumX; x++) {
    const maximumY = Math.min(visible.viewportMaximumY, q - x - 1);
    for (let y = visible.minimumY; y <= maximumY; y++) {
      const lowerLeft = worldToScreen([(x - 0.5) / q, (y - 0.5) / q], canvas, state);
      const upperRight = worldToScreen([(x + 0.5) / q, (y + 0.5) / q], canvas, state);
      ctx.fillStyle = orbitColor(state.rationalClassifier.classify(x, y));
      ctx.fillRect(
        lowerLeft[0],
        upperRight[1],
        upperRight[0] - lowerLeft[0] + 0.15,
        lowerLeft[1] - upperRight[1] + 0.15,
      );
    }
  }

  if (state.selectedPoint && state.selectedOrbitPoints.length > 1) {
    const selectedKey = `${state.selectedPoint.x},${state.selectedPoint.y}`;
    const outlined = new Set();
    ctx.save();
    ctx.strokeStyle = "rgba(255, 218, 112, 0.72)";
    ctx.lineWidth = Math.max(1, Math.min(3, squareSizePixels * 0.07));
    for (const point of state.selectedOrbitPoints) {
      const [x, y] = point;
      const key = `${x},${y}`;
      if (key === selectedKey || outlined.has(key)) continue;
      outlined.add(key);
      if (x < visible.minimumX || x > visible.maximumX ||
          y < visible.minimumY || y > visible.viewportMaximumY) continue;
      const lowerLeft = worldToScreen([(x - 0.5) / q, (y - 0.5) / q], canvas, state);
      const upperRight = worldToScreen([(x + 0.5) / q, (y + 0.5) / q], canvas, state);
      ctx.strokeRect(
        lowerLeft[0],
        upperRight[1],
        upperRight[0] - lowerLeft[0],
        lowerLeft[1] - upperRight[1],
      );
    }
    ctx.restore();
  }

  if (state.selectedPoint) {
    const { x, y } = state.selectedPoint;
    const lowerLeft = worldToScreen([(x - 0.5) / q, (y - 0.5) / q], canvas, state);
    const upperRight = worldToScreen([(x + 0.5) / q, (y + 0.5) / q], canvas, state);
    ctx.save();
    ctx.strokeStyle = "#ffd246";
    ctx.lineWidth = Math.max(2, Math.min(5, squareSizePixels * 0.12));
    ctx.strokeRect(
      lowerLeft[0],
      upperRight[1],
      upperRight[0] - lowerLeft[0],
      lowerLeft[1] - upperRight[1],
    );
    ctx.restore();
  }

  return { squareSizePixels, warning: null };
}

export function drawOverlay(overlay, state) {
  const { canvas, ctx } = overlay;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Triangle A(0,0), B(1,0), C(0,1) in world
  const A = worldToScreen([0, 0], canvas, state);
  const B = worldToScreen([1, 0], canvas, state);
  const C = worldToScreen([0, 1], canvas, state);
  if (state.appMode === "rationals") {
    ctx.fillStyle = "#252529";
    ctx.beginPath();
    ctx.moveTo(A[0], A[1]);
    ctx.lineTo(B[0], B[1]);
    ctx.lineTo(C[0], C[1]);
    ctx.closePath();
    ctx.fill();
  }

  const rationalResult = state.appMode === "rationals"
    ? drawRationalGrid(overlay, state)
    : { squareSizePixels: null, warning: null };

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.closePath();
  ctx.stroke();

  if (state.appMode === "cells" && state.selectedCell) {
    const polygon = state.selectedCell.polygon.map(vertex =>
      worldToScreen([vertex.x.toNumber(), vertex.y.toNumber()], canvas, state));
    ctx.save();
    ctx.lineWidth = 3;
    ctx.strokeStyle = "rgba(255, 210, 70, 0.98)";
    ctx.fillStyle = "rgba(255, 210, 70, 0.055)";
    ctx.beginPath();
    polygon.forEach((vertex, index) => {
      if (index === 0) ctx.moveTo(vertex[0], vertex[1]);
      else ctx.lineTo(vertex[0], vertex[1]);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    ctx.restore();
  }

  // Cycle points (once you load them)
  ctx.fillStyle = "rgba(255,255,0,0.9)";
  for (const cyc of overlay.cycles) {
    const P = worldToScreen([cyc.x, cyc.y], canvas, state);
    ctx.beginPath();
    ctx.arc(P[0], P[1], 4, 0, Math.PI * 2);
    ctx.fill();

    if (cyc.label) {
      ctx.fillStyle = "rgba(255,255,255,0.9)";
      ctx.font = "12px sans-serif";
      ctx.fillText(cyc.label, P[0] + 6, P[1] - 6);
      ctx.fillStyle = "rgba(255,255,0,0.9)";
    }
  }
  return rationalResult;
}

export function screenToWorld(canvas, clientX, clientY, state) {
  const rect = canvas.getBoundingClientRect();
  const dpr = window.devicePixelRatio || 1;
  const x = (clientX - rect.left) * dpr;
  const y = (clientY - rect.top) * dpr;

  const W = canvas.width, H = canvas.height;
  const aspect = W / H;

  const u = x / W;
  const v = 1 - (y / H);

  const xyx = (u * 2 - 1) * aspect;
  const xyy = (v * 2 - 1);

  const worldX = (xyx / state.zoom) + state.panX;
  const worldY = (xyy / state.zoom) + state.panY;

  return [worldX, worldY];
}

export function hitTestAtMouse(canvas, clientX, clientY, state) {
  const [worldX, worldY] = screenToWorld(canvas, clientX, clientY, state);
  return `world: (${worldX.toFixed(6)}, ${worldY.toFixed(6)})`;
}
