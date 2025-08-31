// Display Tab: renders the Display settings for panel and overlay
// Variant 'panel' and 'overlay' differ only by input IDs and container naming.
// Minimal, commented, and human-readable per project conventions.

export function renderDisplayTab(opts) {
  const {
    container,
    makeSection,
    headerTitle = 'Display',
    headerDesc = 'Legibility and scale.',
    variant = 'panel',
  } = opts || {};

  // Section header with Reset on the right
  const sec = makeSection(headerTitle, headerDesc, 'afterTitle');
  try {
    const hdr = sec.firstChild; // title div
    if (hdr) {
      hdr.style.display = 'flex';
      hdr.style.alignItems = 'center';
      hdr.style.justifyContent = 'space-between';
      const resetBtn = document.createElement('button');
      resetBtn.textContent = 'Reset';
      resetBtn.style.background = 'transparent';
      resetBtn.style.border = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))';
      resetBtn.style.borderRadius = '10px';
      resetBtn.style.color = 'var(--ui-fg, #eee)';
      resetBtn.style.padding = '4px 10px';
      resetBtn.style.cursor = 'pointer';
      const onHover = () => { try { resetBtn.style.boxShadow = 'var(--ui-surface-glow-outer, 0 0 10px rgba(120,170,255,0.35))'; resetBtn.style.outline = '1px solid var(--ui-surface-border, rgba(120,170,255,0.70))'; } catch (_) {} };
      const onLeave = () => { try { resetBtn.style.boxShadow = 'none'; resetBtn.style.outline = 'none'; } catch (_) {} };
      resetBtn.addEventListener('mouseenter', onHover);
      resetBtn.addEventListener('mouseleave', onLeave);
      resetBtn.addEventListener('focus', onHover);
      resetBtn.addEventListener('blur', onLeave);

      // IDs differ per variant so inputs are unique between contexts
      const idSuffix = variant === 'overlay' ? '-ovl' : '';
      // We will fill these after we build the slider rows
      let fsRngRef = null;
      let fsValRef = null;

      resetBtn.onclick = () => {
        // Reset: font scale back to 1 (16px)
        try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: 1 }); } catch (_) {}
        try { localStorage.setItem('ui_font_scale', '1'); } catch (_) {}
        try { if (fsRngRef) fsRngRef.value = '100'; if (fsValRef) { fsValRef.textContent = '16px'; fsRngRef && (fsRngRef.title = '16px'); } } catch (_) {}
      };
      hdr.appendChild(resetBtn);

      // Append section first so subsequent rows follow neatly
      container.appendChild(sec);

      // Font Size slider (root rem scale) shown in pixels
      const fsRow = document.createElement('div');
      fsRow.style.display = 'flex'; fsRow.style.alignItems = 'center'; fsRow.style.gap = '8px'; fsRow.style.marginBottom = '8px';
      const fsLbl = document.createElement('label'); fsLbl.textContent = 'Font Size:'; fsLbl.style.minWidth = '140px';
      const fsRng = document.createElement('input'); fsRng.type = 'range'; fsRng.min = '80'; fsRng.max = '120'; fsRng.step = '1'; fsRng.style.flex = '1'; fsRng.id = `settings-ui-fontscale${idSuffix}`;
      const fsVal = document.createElement('span'); fsVal.style.width = '52px'; fsVal.style.textAlign = 'right'; fsVal.style.color = 'var(--ui-fg-muted, #ccc)'; fsVal.id = `settings-ui-fontscale${idSuffix}-val`;

      // Bind refs for Reset handler
      fsRngRef = fsRng; fsValRef = fsVal;

      try {
        let scale = parseFloat(localStorage.getItem('ui_font_scale'));
        if (!Number.isFinite(scale) || scale <= 0) scale = 1;
        const p = Math.max(80, Math.min(120, Math.round(scale * 100)));
        fsRng.value = String(p);
        const px = Math.round(16 * (p / 100));
        fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
      } catch (_) {}

      fsRng.oninput = () => {
        const p = Math.max(80, Math.min(120, Math.round(parseFloat(fsRng.value) || 100)));
        if (String(p) !== fsRng.value) fsRng.value = String(p);
        const scale = p / 100;
        const px = Math.round(16 * scale);
        fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
        try { console.debug(`[display] fontScale(${variant}/display) p=${p} scale=${scale} px=${px}`); } catch (_) {}
        try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {}
        try { localStorage.setItem('ui_font_scale', String(scale)); } catch (_) {}
      };

      fsRow.appendChild(fsLbl); fsRow.appendChild(fsRng); fsRow.appendChild(fsVal);
      container.appendChild(fsRow);
      return; // Done after building the slider
    }
  } catch (_) {}

  // Fallback (if header not found): still append section, then slider
  container.appendChild(sec);
  const fsRow = document.createElement('div');
  fsRow.style.display = 'flex'; fsRow.style.alignItems = 'center'; fsRow.style.gap = '8px'; fsRow.style.marginBottom = '8px';
  const fsLbl = document.createElement('label'); fsLbl.textContent = 'Font Size:'; fsLbl.style.minWidth = '140px';
  const idSuffix = variant === 'overlay' ? '-ovl' : '';
  const fsRng = document.createElement('input'); fsRng.type = 'range'; fsRng.min = '80'; fsRng.max = '120'; fsRng.step = '1'; fsRng.style.flex = '1'; fsRng.id = `settings-ui-fontscale${idSuffix}`;
  const fsVal = document.createElement('span'); fsVal.style.width = '52px'; fsVal.style.textAlign = 'right'; fsVal.style.color = 'var(--ui-fg-muted, #ccc)'; fsVal.id = `settings-ui-fontscale${idSuffix}-val`;
  try {
    let scale = parseFloat(localStorage.getItem('ui_font_scale'));
    if (!Number.isFinite(scale) || scale <= 0) scale = 1;
    const p = Math.max(80, Math.min(120, Math.round(scale * 100)));
    fsRng.value = String(p);
    const px = Math.round(16 * (p / 100));
    fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
  } catch (_) {}
  fsRng.oninput = () => {
    const p = Math.max(80, Math.min(120, Math.round(parseFloat(fsRng.value) || 100)));
    if (String(p) !== fsRng.value) fsRng.value = String(p);
    const scale = p / 100;
    const px = Math.round(16 * scale);
    fsVal.textContent = `${px}px`; fsRng.title = `${px}px`;
    try { console.debug(`[display] fontScale(${variant}/display) p=${p} scale=${scale} px=${px}`); } catch (_) {}
    try { window.UITheme && window.UITheme.applyDynamicTheme({ fontScale: scale }); } catch (_) {}
    try { localStorage.setItem('ui_font_scale', String(scale)); } catch (_) {}
  };
  fsRow.appendChild(fsLbl); fsRow.appendChild(fsRng); fsRow.appendChild(fsVal);
  container.appendChild(fsRow);
}
