# Vendor ASCII Dungeon Renderer — Quickstart

This is a concise starter for wiring the vendor ASCII dungeon canvas into your UI. It covers map input, color maps, camera, and built‑in controls.

- Core: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi.js`
- Helpers/UI plumbing: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi-helpers.js`, `interactivity-setup.js`
- Font atlas: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-texture.js`


## Minimal setup
```html
<div id="asciiDisplay" style="width: 640px; height: 400px"></div>
```

```js
// Instantiate and mount
// Access DungeonRenderer from the vendor bundle (global or your module system)
const parent = document.getElementById('asciiDisplay');
const renderer = new DungeonRenderer({
  width: parent.clientWidth,
  height: parent.clientHeight,
  dpr: window.devicePixelRatio || 1,
});

renderer.initialize();             // sets up WebGL, canvas, render targets
parent.appendChild(renderer.container); // mount the built canvas container
renderer.load();                    // loads font; triggers first draw when ready

// Provide a map (multiline ASCII). If omitted, an internal example is shown after load().
renderer.setDungeonMap([
  '############',
  '#..@.......#',
  '#..###..^..#',
  '#......+...#',
  '############',
].join('\n'));
```


## Dungeon map input
- Pass a multiline string. Each line = row. Shorter rows are padded internally.
- Edge padding is added to avoid artifacts. Missing cells render as space `' '`.

```js
renderer.setDungeonMap(`
########
#..@...#
#..#...#
#......#
########
`.trim());
```


## Color maps (tint RGB in 0..1)
Precedence: position > character > default (white `[1,1,1]`). Provide JSON strings.

```js
// Character color map: char -> [r,g,b]
renderer.surface.setCharacterColorMap(JSON.stringify({
  '#': [0.7, 0.7, 0.7],
  '.': [0.5, 0.5, 0.5],
  '@': [1.0, 1.0, 0.0],
}));

// Position color map: "x,y" -> [r,g,b]
renderer.surface.setPositionColorMap(JSON.stringify({
  '3,1': [1.0, 0.2, 0.2],
  '5,2': [0.2, 1.0, 0.2],
}));
```


## Camera controls
- Pan in tile units (supports sub‑tile): `renderer.panCamera(dx, dy)`
- Zoom about optional center: `renderer.zoomCamera(factor, cx?, cy?)` (e.g., `1.1` to zoom in)
- Reset: `renderer.resetCamera()`

```js
zoomInBtn.onclick = () => renderer.zoomCamera(1.1);
zoomOutBtn.onclick = () => renderer.zoomCamera(1/1.1);
resetBtn.onclick = () => renderer.resetCamera();
```


## Built‑in interactions
- Mouse drag to pan, wheel to zoom.
- Buttons wired by the helper container: zoom in/out, reset, clear, (optionally) sun toggle.


## Key rendering params (for UI)
- `asciiTexture` — font atlas.
- `asciiViewTexture` — map texture (RGBA: rgb=color, a=charCode).
- `gridSize` — visible cell grid (auto from canvas and zoom).
- `tileSize` — `[8,8]` glyph size in atlas.
- `atlasSize` — font atlas grid size.
- `viewportSize` — canvas size in pixels.
- `mapSize` — uploaded map texture size (with padding).
- `cameraPosition`, `subTileOffset` — pan/scroll.


## Q&A

- Q: Without any position color map, is the dungeon transparent and shows the canvas underneath?
  A: Non‑glyph pixels are written as RGBA(0,0,0,0), but the canvas is opaque (`alpha:false`) and blending is disabled, so you see black by default. It isn’t composited with the page; effectively it’s a black background unless you change the clear/render color or draw an underlay. Default glyph tint is white if no color maps are provided.

- Q: If I want the entire floor to be dark gray by default, is that a position color map first, then terrain maps?
  A: Set a character color map for the floor glyph (e.g., `'.'`) to dark gray for the default, then optionally override specific tiles via a position color map (position > character > default). Order of calls doesn’t matter; precedence is applied when rendering. Note this tints glyphs only—tiles aren’t flood‑filled; for solid tiles use a background layer or solid glyphs.

- Q: Does the API support grid lines or anything resembling a dungeon grid?
  A: Not built‑in. You can overlay a CSS/SVG/canvas grid aligned to tile size, render a second pass with lines, or use grid‑like glyphs. The stock renderer focuses on glyph rendering, not drawing cell borders.

- Q: When fully zoomed out I see a white rectangle on a black background — what’s filling black?
  A: The WebGL canvas is created with `alpha: false`, and clears/default RT contents appear as opaque black. The dungeon shader outputs transparency for non‑glyph pixels, so you’re seeing the canvas/clear color behind the glyphs. You can change the canvas/container CSS background or set `gl.clearColor` to your preferred color to avoid pure black.

- Q: Does the zoom go farther out than the ASCII dungeon’s extents?
  A: Yes, the camera can zoom/pan beyond the map; out‑of‑bounds samples return transparent per `dungeonShader` bounds checks. That area then shows the canvas/clear color (black by default). This is expected and lets you frame the map with margins.

- Q: How do I fill the entire canvas with a deep gray (not black)?
  A: Easiest: set a CSS background on the renderer’s container or canvas (e.g., `#222`). Alternatively, set the WebGL clear color once (tiny code change) or draw a simple underlay quad. Filling every cell with a solid block glyph and tinting gray also works but is wasteful and scales with zoom.

- Q: How hard is it to add a grid (1–8 px line, RGBA) drawn after lighting?
  A: Small, contained change: add a final screen‑space overlay pass after the current composite. The fragment shader computes cell size in pixels (from `viewportSize` and `gridSize`) and draws lines when within `gridThicknessPx` of cell borders; enable blending for this pass only. Expose two uniforms: `gridThicknessPx` (1–8) and `gridColor` (vec4 RGBA); performance impact is negligible.

- Q: What render order works best (floor → grid → terrain → entities)?
  A: Recommended: draw floor underlay first (solid clear color, underlay quad, or background glyphs), then grid as a post‑lighting overlay pass, then terrain glyphs, and entities last for readability. Keep blending enabled only for overlay passes (grid, soft effects) to preserve core glyph shading. This ordering avoids occluding glyphs and keeps the grid visible without shrinking characters.

- Q: Will ray‑marching / radiance‑cascade “glow” fill in my grid lines?
  A: If the grid is drawn as the final overlay pass (recommended), glow won’t bleed over it—the grid stays crisp on top. If you want glow to affect the grid, draw the grid before the composite or use blending (e.g., low‑alpha or additive) so the glow shows through. Choose underlay vs overlay based on whether you want the grid to be influenced by lighting.

## Next steps (Display tab)
- Expose UI to edit map text, paste JSON color maps, and bind buttons/sliders to camera methods.
- Optional: toggle nearest/linear filtering and lighting sliders (advanced RC pass).

Tiny dungeon joke: Tried to zoom into the treasure room, but it was a bit pixelated. Must be cursed with nearest‑neighbor.
