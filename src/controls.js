export function wireControls(state, handlers = {}) {
  const iter = document.getElementById("iter");
  const iterLabel = document.getElementById("iterLabel");
  const colorMode = document.getElementById("colorMode");
  const returnLimit = document.getElementById("returnLimit");
  const returnLimitControl = document.getElementById("returnLimitControl");
  const wholeWordColor = document.getElementById("wholeWordColor");
  const wholeWordControl = document.getElementById("wholeWordControl");
  const backSelection = document.getElementById("backSelection");

  function changed() {
    handlers.onChange?.();
  }

  function syncDepth() {
    state.iters = Number.parseInt(iter.value, 10);
    iterLabel.textContent = String(state.iters);
    changed();
  }

  function syncColorMode() {
    state.colorMode = Number.parseInt(colorMode.value, 10);
    changed();
  }

  function syncReturnSettings() {
    const parsed = Number.parseInt(returnLimit.value, 10);
    state.returnLimit = Math.max(1, Math.min(16384, Number.isFinite(parsed) ? parsed : 2000));
    returnLimit.value = String(state.returnLimit);
    state.colorWholeWord = wholeWordColor.checked;
    changed();
  }

  iter.addEventListener("input", syncDepth);
  colorMode.addEventListener("change", syncColorMode);
  returnLimit.addEventListener("change", syncReturnSettings);
  wholeWordColor.addEventListener("change", syncReturnSettings);

  document.getElementById("resetView").addEventListener("click", () => handlers.onResetView?.());
  backSelection.addEventListener("click", () => handlers.onBack?.());

  syncDepth();
  syncColorMode();
  syncReturnSettings();

  return {
    setReturnMode(enabled, canGoBack) {
      iter.disabled = enabled;
      colorMode.disabled = enabled;
      returnLimitControl.hidden = !enabled;
      wholeWordControl.hidden = !enabled;
      backSelection.disabled = !canGoBack;
    },
    setCanGoBack(enabled) {
      backSelection.disabled = !enabled;
    },
  };
}
