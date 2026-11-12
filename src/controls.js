export function wireControls(state, handlers = {}) {
  const appMode = document.getElementById("appMode");
  const iter = document.getElementById("iter");
  const iterLabel = document.getElementById("iterLabel");
  const colorMode = document.getElementById("colorMode");
  const returnLimit = document.getElementById("returnLimit");
  const returnLimitControl = document.getElementById("returnLimitControl");
  const wholeWordColor = document.getElementById("wholeWordColor");
  const wholeWordControl = document.getElementById("wholeWordControl");
  const backSelection = document.getElementById("backSelection");
  const denominatorControl = document.getElementById("denominatorControl");
  const denominatorRange = document.getElementById("denominatorRange");
  const denominatorNumber = document.getElementById("denominatorNumber");
  const rationalLegend = document.getElementById("rationalLegend");
  const cellControls = [...document.querySelectorAll("[data-cell-control]")];
  let returnMode = false;
  let backAvailable = false;

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

  function refreshModeControls() {
    const rationalMode = state.appMode === "rationals";
    for (const control of cellControls) control.hidden = rationalMode;
    denominatorControl.hidden = !rationalMode;
    rationalLegend.hidden = !rationalMode;
    returnLimitControl.hidden = rationalMode || !returnMode;
    wholeWordControl.hidden = rationalMode || !returnMode;
    backSelection.disabled = rationalMode || !backAvailable;
  }

  function syncAppMode() {
    state.appMode = appMode.value;
    refreshModeControls();
    handlers.onModeChange?.();
    changed();
  }

  function setDenominator(value) {
    const parsed = Number.parseInt(value, 10);
    const q = Math.max(3, Math.min(0x7fffffff, Number.isFinite(parsed) ? parsed : 21));
    state.denominator = q;
    denominatorNumber.value = String(q);
    denominatorRange.value = String(Math.min(200, q));
    handlers.onDenominatorChange?.(q);
    changed();
  }

  iter.addEventListener("input", syncDepth);
  colorMode.addEventListener("change", syncColorMode);
  returnLimit.addEventListener("change", syncReturnSettings);
  wholeWordColor.addEventListener("change", syncReturnSettings);
  appMode.addEventListener("change", syncAppMode);
  denominatorRange.addEventListener("input", () => setDenominator(denominatorRange.value));
  denominatorNumber.addEventListener("change", () => setDenominator(denominatorNumber.value));

  document.getElementById("resetView").addEventListener("click", () => handlers.onResetView?.());
  backSelection.addEventListener("click", () => handlers.onBack?.());

  syncDepth();
  syncColorMode();
  syncReturnSettings();
  setDenominator(denominatorNumber.value);
  state.appMode = appMode.value;
  refreshModeControls();

  return {
    setReturnMode(enabled, canNavigateBack) {
      returnMode = enabled;
      backAvailable = canNavigateBack;
      iter.disabled = enabled;
      colorMode.disabled = enabled;
      refreshModeControls();
    },
    setCanGoBack(enabled) {
      backAvailable = enabled;
      refreshModeControls();
    },
    refreshModeControls,
  };
}
