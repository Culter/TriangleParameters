// Keep this version synchronized with index.html and cells.js when deploying coupled asset changes.
import { createGL, createProgram, loadText, resizeCanvasToDisplaySize } from "./webgl.js?v=20261109-1";
import { wireControls } from "./controls.js?v=20261109-1";
import { initOverlay, drawOverlay, screenToWorld } from "./overlay.js?v=20261109-1";
import { cellDetailsText, cellFromWord, lineToFloat } from "./cells.js?v=20261109-1";
import { firstReturn, inOpenSimplex, itinerary, pointInHalfplanes } from "./dynamics.js?v=20261109-1";

const MAX_DOMAIN_LINES = 128;

const state = {
  iters: 10,
  colorMode: 3,
  returnLimit: 2000,
  colorWholeWord: false,
  panX: 0.25,
  panY: 0.25,
  zoom: 1.0,
  dragging: false,
  dragMoved: false,
  lastX: 0,
  lastY: 0,
  selectedCell: null,
  selectedHalfplanes: [],
  selectedWordGpuLength: 0,
  history: [],
  viewAnimation: null,
};

const glCanvas = document.getElementById("gl");
const overlayCanvas = document.getElementById("overlay");
const hoverEl = document.getElementById("hover");
const modeEl = document.getElementById("mode");
const detailsPanel = document.getElementById("detailsPanel");
const detailsEl = document.getElementById("cellDetails");

const gl = createGL(glCanvas);
const [vertSrc, fragSrc] = await Promise.all([
  loadText("./shaders/fullscreen.vert?v=20261109-1"),
  loadText("./shaders/map.frag?v=20261109-1"),
]);
const program = createProgram(gl, vertSrc, fragSrc);

const uniforms = Object.fromEntries([
  "u_resolution",
  "u_iters",
  "u_colorMode",
  "u_pan",
  "u_zoom",
  "u_time",
  "u_returnMode",
  "u_returnLimit",
  "u_domainLineCount",
  "u_colorWholeWord",
  "u_selectedWordLength",
  "u_selectedWord",
].map(name => [name, gl.getUniformLocation(program, name)]));
uniforms.u_domainLines = gl.getUniformLocation(program, "u_domainLines[0]");

const selectedWordTexture = gl.createTexture();
gl.activeTexture(gl.TEXTURE0);
gl.bindTexture(gl.TEXTURE_2D, selectedWordTexture);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
gl.pixelStorei(gl.UNPACK_ALIGNMENT, 1);

const overlay = initOverlay(overlayCanvas);
let framePending = false;

function uploadSelectedWord(word) {
  const maximum = gl.getParameter(gl.MAX_TEXTURE_SIZE);
  const length = Math.min(word.length, maximum, 16384);
  const data = new Uint8Array(Math.max(1, length));
  for (let index = 0; index < length; index++) data[index] = word[index] === "S" ? 1 : 0;
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, selectedWordTexture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.R8UI,
    data.length,
    1,
    0,
    gl.RED_INTEGER,
    gl.UNSIGNED_BYTE,
    data,
  );
  state.selectedWordGpuLength = length;
}

function updateSelectedGeometry() {
  if (!state.selectedCell) {
    state.selectedHalfplanes = [];
    uploadSelectedWord("");
    return;
  }
  if (state.selectedCell.halfplanes.length > MAX_DOMAIN_LINES) {
    throw new Error(`Selected cell has more than ${MAX_DOMAIN_LINES} sides`);
  }
  state.selectedHalfplanes = state.selectedCell.halfplanes.map(lineToFloat);
  uploadSelectedWord(state.selectedCell.word);
}

function layout() {
  overlayCanvas.style.position = "absolute";
  overlayCanvas.style.left = glCanvas.offsetLeft + "px";
  overlayCanvas.style.top = glCanvas.offsetTop + "px";
  overlayCanvas.style.pointerEvents = "none";
  overlayCanvas.width = glCanvas.width;
  overlayCanvas.height = glCanvas.height;
}

function domainUniformData() {
  const data = new Float32Array(MAX_DOMAIN_LINES * 3);
  state.selectedHalfplanes.forEach((line, index) => data.set(line, index * 3));
  return data;
}

function renderScene(width, height, timeSeconds) {
  gl.viewport(0, 0, width, height);
  gl.useProgram(program);
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, selectedWordTexture);
  gl.uniform1i(uniforms.u_selectedWord, 0);
  gl.uniform2f(uniforms.u_resolution, width, height);
  gl.uniform1i(uniforms.u_iters, state.iters);
  gl.uniform1i(uniforms.u_colorMode, state.colorMode);
  gl.uniform2f(uniforms.u_pan, state.panX, state.panY);
  gl.uniform1f(uniforms.u_zoom, state.zoom);
  gl.uniform1f(uniforms.u_time, timeSeconds);
  gl.uniform1i(uniforms.u_returnMode, state.selectedCell ? 1 : 0);
  gl.uniform1i(uniforms.u_returnLimit, state.returnLimit);
  gl.uniform1i(uniforms.u_domainLineCount, state.selectedHalfplanes.length);
  gl.uniform3fv(uniforms.u_domainLines, domainUniformData());
  gl.uniform1i(uniforms.u_colorWholeWord, state.colorWholeWord ? 1 : 0);
  gl.uniform1i(uniforms.u_selectedWordLength, state.selectedWordGpuLength);
  gl.drawArrays(gl.TRIANGLES, 0, 3);
}

function updateViewAnimation(timeMs) {
  const animation = state.viewAnimation;
  if (!animation) return false;
  const progress = Math.min(1, (timeMs - animation.startedAt) / animation.duration);
  const eased = 1 - ((1 - progress) ** 3);
  state.panX = animation.from.panX + eased * (animation.to.panX - animation.from.panX);
  state.panY = animation.from.panY + eased * (animation.to.panY - animation.from.panY);
  const fromLogZoom = Math.log(animation.from.zoom);
  state.zoom = Math.exp(fromLogZoom + eased * (Math.log(animation.to.zoom) - fromLogZoom));
  if (progress >= 1) state.viewAnimation = null;
  return progress < 1;
}

function frame(timeMs) {
  framePending = false;
  const changed = resizeCanvasToDisplaySize(glCanvas);
  if (changed) layout();
  const animating = updateViewAnimation(timeMs);
  renderScene(glCanvas.width, glCanvas.height, timeMs * 0.001);
  drawOverlay(overlay, state);
  if (animating) requestRender();
}

function requestRender() {
  if (framePending) return;
  framePending = true;
  requestAnimationFrame(frame);
}

function animateView(target, duration = 650) {
  state.viewAnimation = {
    startedAt: performance.now(),
    duration,
    from: { panX: state.panX, panY: state.panY, zoom: state.zoom },
    to: target,
  };
  requestRender();
}

function viewForCell(cell) {
  const xs = cell.polygon.map(vertex => vertex.x.toNumber());
  const ys = cell.polygon.map(vertex => vertex.y.toNumber());
  const minimumX = Math.min(...xs), maximumX = Math.max(...xs);
  const minimumY = Math.min(...ys), maximumY = Math.max(...ys);
  const width = Math.max(maximumX - minimumX, 1e-12);
  const height = Math.max(maximumY - minimumY, 1e-12);
  const aspect = (glCanvas.width || glCanvas.clientWidth) /
    Math.max(1, glCanvas.height || glCanvas.clientHeight);
  return {
    panX: (minimumX + maximumX) / 2,
    panY: (minimumY + maximumY) / 2,
    zoom: 1.55 * Math.min(aspect / width, 1 / height),
  };
}

function currentSnapshot() {
  return {
    selectedCell: state.selectedCell,
    panX: state.panX,
    panY: state.panY,
    zoom: state.zoom,
  };
}

function refreshSelectionUi() {
  const selected = state.selectedCell;
  detailsPanel.hidden = !selected;
  detailsEl.textContent = selected ? cellDetailsText(selected) : "";
  modeEl.textContent = selected
    ? `mode: first return to ${(selected.word || "ε")}`
    : "mode: fixed-depth cells";
  controls.setReturnMode(Boolean(selected), state.history.length > 0);
}

function selectCell(cell, pushHistory = true) {
  if (pushHistory) state.history.push(currentSnapshot());
  state.selectedCell = cell;
  updateSelectedGeometry();
  refreshSelectionUi();
  animateView(viewForCell(cell));
}

function restoreSnapshot(snapshot) {
  state.selectedCell = snapshot.selectedCell;
  updateSelectedGeometry();
  refreshSelectionUi();
  animateView({ panX: snapshot.panX, panY: snapshot.panY, zoom: snapshot.zoom });
}

function resetView() {
  animateView(state.selectedCell
    ? viewForCell(state.selectedCell)
    : { panX: 0.25, panY: 0.25, zoom: 1.0 });
}

function goBack() {
  if (state.history.length === 0) return;
  restoreSnapshot(state.history.pop());
}

const controls = wireControls(state, {
  onChange: requestRender,
  onResetView: resetView,
  onBack: goBack,
});
updateSelectedGeometry();
refreshSelectionUi();
const requestedCell = new URLSearchParams(window.location.search).get("cell");
if (requestedCell !== null && /^[RS]*$/.test(requestedCell)) {
  try {
    selectCell(cellFromWord(requestedCell), false);
  } catch (error) {
    console.warn(`Ignoring invalid cell from URL: ${requestedCell}`, error);
  }
}

function hoverText(point) {
  const coordinates = `world: (${point[0].toFixed(7)}, ${point[1].toFixed(7)})`;
  if (!state.selectedCell) {
    const result = itinerary(point, state.iters);
    return result ? `${coordinates}   cell: ${result.word || "ε"}` : `${coordinates}   outside simplex`;
  }
  if (!pointInHalfplanes(point, state.selectedHalfplanes)) {
    return `${coordinates}   outside selected cell`;
  }
  const result = firstReturn(point, state.selectedHalfplanes, state.returnLimit);
  return result?.word
    ? `${coordinates}   return: ${result.word}   cell: ${result.word}${state.selectedCell.word}`
    : `${coordinates}   no return within ${state.returnLimit} steps`;
}

function setHoverText(text) {
  hoverEl.textContent = text;
  hoverEl.title = text;
}

function selectAt(point) {
  if (!state.selectedCell) {
    const result = itinerary(point, state.iters);
    if (!result) return;
    selectCell(cellFromWord(result.word));
    return;
  }
  if (!pointInHalfplanes(point, state.selectedHalfplanes)) return;
  const result = firstReturn(point, state.selectedHalfplanes, state.returnLimit);
  if (!result?.word) {
    setHoverText(`No return found within ${state.returnLimit} steps.`);
    return;
  }
  selectCell(cellFromWord(result.word + state.selectedCell.word));
}

glCanvas.addEventListener("mousedown", event => {
  if (event.button !== 0) return;
  state.dragging = true;
  state.dragMoved = false;
  state.lastX = event.clientX;
  state.lastY = event.clientY;
});

glCanvas.addEventListener("mousemove", event => {
  if (state.dragging) {
    const dx = event.clientX - state.lastX;
    const dy = event.clientY - state.lastY;
    state.lastX = event.clientX;
    state.lastY = event.clientY;
    state.dragMoved ||= Math.abs(dx) + Math.abs(dy) > 1;
    const dpr = window.devicePixelRatio || 1;
    const aspect = glCanvas.width / glCanvas.height;
    state.panX -= ((2 * dx * dpr) / glCanvas.width) * aspect / state.zoom;
    state.panY += ((2 * dy * dpr) / glCanvas.height) / state.zoom;
    state.viewAnimation = null;
    requestRender();
  }
  setHoverText(hoverText(screenToWorld(glCanvas, event.clientX, event.clientY, state)));
});

window.addEventListener("mouseup", () => {
  state.dragging = false;
});

glCanvas.addEventListener("click", event => {
  if (state.dragMoved) return;
  try {
    selectAt(screenToWorld(glCanvas, event.clientX, event.clientY, state));
  } catch (error) {
    console.error(error);
    setHoverText(`Selection failed: ${error.message}`);
  }
});

glCanvas.addEventListener("wheel", event => {
  event.preventDefault();
  state.viewAnimation = null;
  state.zoom *= Math.exp(-event.deltaY * 0.001);
  requestRender();
}, { passive: false });

new ResizeObserver(requestRender).observe(glCanvas);

document.getElementById("exportPng").addEventListener("click", async () => {
  await exportHighResPNG();
});

async function exportHighResPNG() {
  const W = 3840, H = 2160;
  const texture = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, W, H, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);

  const framebuffer = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);
  if (gl.checkFramebufferStatus(gl.FRAMEBUFFER) !== gl.FRAMEBUFFER_COMPLETE) {
    gl.bindFramebuffer(gl.FRAMEBUFFER, null);
    gl.deleteFramebuffer(framebuffer);
    gl.deleteTexture(texture);
    throw new Error("Framebuffer not complete; cannot export");
  }

  renderScene(W, H, 0);
  const pixels = new Uint8Array(W * H * 4);
  gl.readPixels(0, 0, W, H, gl.RGBA, gl.UNSIGNED_BYTE, pixels);

  const canvas = document.createElement("canvas");
  canvas.width = W;
  canvas.height = H;
  const context = canvas.getContext("2d");
  const image = context.createImageData(W, H);
  for (let y = 0; y < H; y++) {
    const sourceRow = (H - 1 - y) * W * 4;
    image.data.set(pixels.subarray(sourceRow, sourceRow + W * 4), y * W * 4);
  }
  context.putImageData(image, 0, 0);

  const link = document.createElement("a");
  const suffix = state.selectedCell ? `_return_${state.selectedCell.word || "epsilon"}` : `_N${state.iters}`;
  link.download = `triangle-map_${W}x${H}${suffix}.png`;
  link.href = canvas.toDataURL("image/png");
  link.click();

  gl.bindFramebuffer(gl.FRAMEBUFFER, null);
  gl.deleteFramebuffer(framebuffer);
  gl.deleteTexture(texture);
  requestRender();
}

requestRender();
document.documentElement.dataset.appReady = "true";
