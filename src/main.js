import { createGL, createProgram, loadText, resizeCanvasToDisplaySize } from "./webgl.js";
import { wireControls } from "./controls.js";
import { initOverlay, drawOverlay, hitTestAtMouse } from "./overlay.js";

const state = {
  iters: 50,
  colorMode: 0,
  panX: 0.25,
  panY: 0.25,
  zoom: 1.0,
  dragging: false,
  lastX: 0,
  lastY: 0,
};

wireControls(state);

const glCanvas = document.getElementById("gl");
const overlayCanvas = document.getElementById("overlay");
const hoverEl = document.getElementById("hover");

const gl = createGL(glCanvas);

// Load shaders
const [vertSrc, fragSrc] = await Promise.all([
  loadText("./shaders/fullscreen.vert"),
  loadText("./shaders/map.frag"),
]);

const program = createProgram(gl, vertSrc, fragSrc);

// Uniform locations
gl.useProgram(program);
const u_resolution = gl.getUniformLocation(program, "u_resolution");
const u_iters      = gl.getUniformLocation(program, "u_iters");
const u_colorMode  = gl.getUniformLocation(program, "u_colorMode");
const u_pan        = gl.getUniformLocation(program, "u_pan");
const u_zoom       = gl.getUniformLocation(program, "u_zoom");
const u_time       = gl.getUniformLocation(program, "u_time");

// Overlay init (cycles, labels later)
const overlay = initOverlay(overlayCanvas);

// Resize + overlay layering
function layout() {
  const rect = glCanvas.getBoundingClientRect();
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.left = glCanvas.offsetLeft + "px";
  overlayCanvas.style.top = glCanvas.offsetTop + "px";
  overlayCanvas.style.pointerEvents = "none"; // overlay draws, input goes to glCanvas

  overlayCanvas.width = glCanvas.width;
  overlayCanvas.height = glCanvas.height;
}

// Pan/zoom interactions
glCanvas.addEventListener("mousedown", (e) => {
  state.dragging = true;
  state.lastX = e.clientX;
  state.lastY = e.clientY;
});

window.addEventListener("mouseup", () => {
  state.dragging = false;
});

window.addEventListener("mousemove", (e) => {
  if (state.dragging) {
    const dx = e.clientX - state.lastX;
    const dy = e.clientY - state.lastY;
    state.lastX = e.clientX;
    state.lastY = e.clientY;

    // Convert pixel drag to world drag
    const dpr = window.devicePixelRatio || 1;
    const w = glCanvas.width;
    const h = glCanvas.height;
    const aspect = w / h;

    // match shader mapping: xy = (uv*2-1)*aspect; p = (xy/zoom)+pan
    const ndx = (2 * dx * dpr) / w;
    const ndy = (2 * dy * dpr) / h;

    state.panX -= (ndx * aspect) / state.zoom;
    state.panY += (ndy) / state.zoom;
  }

  // Hover: sample CPU-side at cursor (placeholder)
  const info = hitTestAtMouse(glCanvas, e.clientX, e.clientY, state);
  hoverEl.textContent = info;
});

glCanvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const zoomFactor = Math.exp(-e.deltaY * 0.001);
  state.zoom *= zoomFactor;
}, { passive: false });

// Export PNG button (hi-res render)
document.getElementById("exportPng").addEventListener("click", async () => {
  await exportHighResPNG({ gl, program, uniforms: { u_resolution, u_iters, u_colorMode, u_pan, u_zoom, u_time }, state });
});

// Render loop
function frame(tMs) {
  const changed = resizeCanvasToDisplaySize(glCanvas);
  if (changed) layout();

  gl.viewport(0, 0, glCanvas.width, glCanvas.height);
  gl.useProgram(program);

  gl.uniform2f(u_resolution, glCanvas.width, glCanvas.height);
  gl.uniform1i(u_iters, state.iters);
  gl.uniform1i(u_colorMode, state.colorMode);
  gl.uniform2f(u_pan, state.panX, state.panY);
  gl.uniform1f(u_zoom, state.zoom);
  gl.uniform1f(u_time, tMs * 0.001);

  gl.drawArrays(gl.TRIANGLES, 0, 3);

  drawOverlay(overlay, state); // triangle edges, cycles, labels, etc.

  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

// --- High-res export ---
async function exportHighResPNG({ gl, program, uniforms, state }) {
  // Pick a high-res size; you can add UI for this later
  const W = 3840, H = 2160;

  // Create an offscreen framebuffer + texture
  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const fbo = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);

  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    alert("Framebuffer not complete; cannot export.");
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    return;
  }

  gl.viewport(0, 0, W, H);
  gl.useProgram(program);

  gl.uniform2f(uniforms.u_resolution, W, H);
  gl.uniform1i(uniforms.u_iters, state.iters);
  gl.uniform1i(uniforms.u_colorMode, state.colorMode);
  gl.uniform2f(uniforms.u_pan, state.panX, state.panY);
  gl.uniform1f(uniforms.u_zoom, state.zoom);
  gl.uniform1f(uniforms.u_time, 0);

  gl.drawArrays(gl.TRIANGLES, 0, 3);

  // Read pixels
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  // Convert to PNG via a temporary 2D canvas (flip Y)
  const c = document.createElement("canvas");
  c.width = W; c.height = H;
  const ctx = c.getContext("2d");
  const img = ctx.createImageData(W, H);

  for (let y = 0; y < H; y++) {
    const srcRow = (H - 1 - y) * W * 4;
    const dstRow = y * W * 4;
    img.data.set(pixels.subarray(srcRow, srcRow + W * 4), dstRow);
  }
  ctx.putImageData(img, 0, 0);

  const a = document.createElement("a");
  a.download = `triangle-map_${W}x${H}_N${state.iters}.png`;
  a.href = c.toDataURL("image/png");
  a.click();

  // Cleanup
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(fbo);
  gl.deleteTexture(tex);
}