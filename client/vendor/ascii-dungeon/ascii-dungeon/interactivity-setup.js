const isMobile = (() => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
})();

const vertexShader = `
in vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}`;

const resetSvg = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4" /><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4" /></svg>`;

const eraseSvg = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M19 20h-10.5l-4.21 -4.3a1 1 0 0 1 0 -1.41l10 -10a1 1 0 0 1 1.41 0l5 5a1 1 0 0 1 0 1.41l-9.2 9.3" /><path d="M18 13.3l-6.3 -6.3" /></svg>`;

const clearSvg = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"  class="icon icon-tabler icons-tabler-outline icon-tabler-trash"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M4 7l16 0" /><path d="M10 11l0 6" /><path d="M14 11l0 6" /><path d="M5 7l1 12a2 2 0 0 0 2 2h8a2 2 0 0 0 2 -2l1 -12" /><path d="M9 7v-3a1 1 0 0 1 1 -1h4a1 1 0 0 1 1 1v3" /></svg>`;

const sunMoonSvg = `<svg  xmlns="http://www.w3.org/2000/svg"  width="16"  height="16"  viewBox="0 0 24 24"  fill="none"  stroke="currentColor"  stroke-width="1"  stroke-linecap="round"  stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><path d="M9.173 14.83a4 4 0 1 1 5.657 -5.657" /><path d="M11.294 12.707l.174 .247a7.5 7.5 0 0 0 8.845 2.492a9 9 0 0 1 -14.671 2.914" /><path d="M3 12h1" /><path d="M12 3v1" /><path d="M5.6 5.6l.7 .7" /><path d="M3 21l18 -18" /></svg>`;

const zoomInSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="10" cy="10" r="7" /><line x1="7" y1="10" x2="13" y2="10" /><line x1="10" y1="7" x2="10" y2="13" /><line x1="21" y1="21" x2="15" y2="15" /></svg>`;

const zoomOutSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><path stroke="none" d="M0 0h24v24H0z" fill="none"/><circle cx="10" cy="10" r="7" /><line x1="7" y1="10" x2="13" y2="10" /><line x1="21" y1="21" x2="15" y2="15" /></svg>`;

function hexToRgb(hex) {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})?$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
    a: result[4] ? parseInt(result[4], 16) : 255,
  } : null;
}

function rgbToHex(r, g, b, a) {
  if (a !== undefined) {
    return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1) +
      Math.round(a * 255).toString(16).padStart(2, '0');
  }
  return "#" + ((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1);
}

// This is the html plumbing / structure / controls for little canvases
function intializeCanvas({
                           id,
                           canvas,
                           onSetColor,
                           clear,
                           reset,
                           toggleSun,
                           setDungeonMap,
                           zoomIn,
                           zoomOut,
                         }) {
  const clearDom = clear ? `<button style="display: none" id="${id}-clear" class="iconButton">${clearSvg}</button>` : "";
  const resetDom = reset ? `<button style="display: none" id="${id}-reset" class="iconButton">${resetSvg}</button>` : "";
  const sunMoonDom = toggleSun ? `<button id="${id}-sun" class="iconButton">${sunMoonSvg}</button>` : "";
  const zoomInDom = zoomIn ? `<button id="${id}-zoom-in" class="iconButton">${zoomInSvg}</button>` : "";
  const zoomOutDom = zoomOut ? `<button id="${id}-zoom-out" class="iconButton">${zoomOutSvg}</button>` : "";

  const thisId = document.querySelector(`#${id}`);
  thisId.innerHTML = `
  <div style="display: flex; gap: 20px;">
    <div id="${id}-canvas-container"></div>

    <div style="display: flex; flex-direction: column; justify-content: space-between;">
              ${sunMoonDom}
      <div style="display: flex; flex-direction: column; gap: 2px">
      ${clearDom}
      ${resetDom}
      </div>
      <div style="display: flex; flex-direction: column; gap: 2px">
      ${zoomInDom}
      ${zoomOutDom}
      </div>
    </div>
</div>`;
  function setHex(hex) {
    const rgb = hexToRgb(hex);
    setColor(rgb.r, rgb.g, rgb.b, rgb.a);
    const stringifiedColor = `rgb(${rgb.r}, ${rgb.g}, ${rgb.b})`;
    thisId.querySelectorAll(".arrow").forEach((node) => {
      if (rgb.a === 0) {
        if (node.parentNode.style.backgroundColor === "var(--pre-background)") {
          node.className = "arrow";
        } else {
          node.className = "arrow hidden";
        }
      } else if (node.parentNode.style.backgroundColor === stringifiedColor) {
        node.className = "arrow";
      } else {
        node.className = "arrow hidden";
      }
    });
  }

  const container = document.querySelector(`#${id}-canvas-container`);
  container.appendChild(canvas);

  if (toggleSun) {
    document.querySelector(`#${id}-sun`).addEventListener("click", (e) => {
      toggleSun(e);
    });
  }

  if (zoomIn) {
    document.querySelector(`#${id}-zoom-in`).addEventListener("click", () => {
      zoomIn();
    });
  }

  if (zoomOut) {
    document.querySelector(`#${id}-zoom-out`).addEventListener("click", () => {
      zoomOut();
    });
  }

  // Add mouse controls for pan and zoom
  let isDragging = false;
  let lastMouseX = 0;
  let lastMouseY = 0;

  canvas.addEventListener('mousedown', (e) => {
    isDragging = true;
    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
    canvas.style.cursor = 'grabbing';
  });

  canvas.addEventListener('mousemove', (e) => {
    if (!isDragging) return;

    const deltaX = (e.clientX - lastMouseX) / 16; // Adjust sensitivity
    const deltaY = (e.clientY - lastMouseY) / 16; // Adjust sensitivity

    if (setDungeonMap && typeof setDungeonMap.panCamera === 'function') {
      setDungeonMap.panCamera(deltaX, deltaY);
    }

    lastMouseX = e.clientX;
    lastMouseY = e.clientY;
  });

  canvas.addEventListener('mouseup', () => {
    isDragging = false;
    canvas.style.cursor = 'default';
  });

  canvas.addEventListener('mouseleave', () => {
    if (isDragging) {
      isDragging = false;
      canvas.style.cursor = 'default';
    }
  });

  // Add wheel event for zooming
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();

    if (setDungeonMap && typeof setDungeonMap.zoomCamera === 'function') {
      // Get mouse position relative to canvas
      const rect = canvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / canvas.clientWidth;
      const y = (e.clientY - rect.top) / canvas.clientHeight;

      // Determine zoom direction and factor
      const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;

      setDungeonMap.zoomCamera(zoomFactor, x, y);
    }
  }, { passive: false });

  return {container, setHex, canvas, onSetColor, setDungeonMap};
}

function addSlider({
                     id,
                     name,
                     onUpdate,
                     options = {},
                     hidden = false,
                     showValue = true,
                     initialSpanValue = undefined,
                   }) {
  // If the target container doesn't exist (minimal UI), return a stub slider
  const root = document.querySelector(`#${id}`);
  if (!root) {
    return {
      value: options.value != null ? options.value : (options.min != null ? options.min : 0),
      max: options.max != null ? options.max : 0,
      min: options.min != null ? options.min : 0,
      setSpan: () => {},
      onUpdate,
    };
  }

  const div = document.createElement("div");
  div.style = `display: ${hidden ? "none" : "flex"}; align-items: center; gap: 8px`;
  root.appendChild(div);
  div.append(`${name}`);
  const input = document.createElement("input");
  input.id = `${id}-${name.replace(" ", "-").toLowerCase()}-slider`;
  input.className = "slider";
  input.type = "range";
  Object.entries(options).forEach(([key, value]) => {
    input.setAttribute(key, value);
  });
  if (options.value) {
    input.value = options.value;
  }
  const span = document.createElement("span");
  input.setSpan = (value) => span.innerText = `${value}`;

  input.addEventListener("input", () => {
    input.setSpan(`${onUpdate(input.value)}`);
  });
  span.innerText = `${input.value}`;
  div.appendChild(input);
  div.appendChild(span);

  input.onUpdate = onUpdate;
  if (initialSpanValue != null) {
    input.setSpan(initialSpanValue);
  }
  return input;
}
