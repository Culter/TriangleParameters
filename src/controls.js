export function wireControls(state) {
  const iter = document.getElementById("iter");
  const iterLabel = document.getElementById("iterLabel");
  const colorMode = document.getElementById("colorMode");

  function sync() {
    state.iters = parseInt(iter.value, 10);
    iterLabel.textContent = String(state.iters);
    state.colorMode = parseInt(colorMode.value, 10);
  }

  iter.addEventListener("input", sync);
  colorMode.addEventListener("change", sync);

  document.getElementById("resetView").addEventListener("click", () => {
    state.panX = 0.25;
    state.panY = 0.25;
    state.zoom = 1.0;
  });

  sync();
}