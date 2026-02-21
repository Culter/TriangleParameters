export function initOverlay(canvas) {
  const ctx = canvas.getContext("2d");
  return { canvas, ctx, cycles: [] };
}

// Convert world point -> screen pixel consistent with shader mapping
function worldToScreen(p, canvas, state) {
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

export function drawOverlay(overlay, state) {
  const { canvas, ctx } = overlay;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Triangle A(0,0), B(1,0), C(0,1) in world
  const A = worldToScreen([0, 0], canvas, state);
  const B = worldToScreen([1, 0], canvas, state);
  const C = worldToScreen([0, 1], canvas, state);

  ctx.lineWidth = 2;
  ctx.strokeStyle = "rgba(255,255,255,0.85)";
  ctx.beginPath();
  ctx.moveTo(A[0], A[1]);
  ctx.lineTo(B[0], B[1]);
  ctx.lineTo(C[0], C[1]);
  ctx.closePath();
  ctx.stroke();

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
}

// Hover hook: for now, just report world coords under cursor.
// Later: you can run the SAME map on CPU for that single point to show code, distances, etc.
export function hitTestAtMouse(canvas, clientX, clientY, state) {
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

  return `world: (${worldX.toFixed(6)}, ${worldY.toFixed(6)})`;
}