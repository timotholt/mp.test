// ASCII Font Catalog
// Human-readable registry of bitmap font atlases for the dungeon renderer/preview.
// Add entries here to support internet-hosted fonts or local data URLs.
//
// Each font entry shape:
// {
//   id: 'unique-id',
//   name: 'Nice Display Name',
//   // Source of the atlas image: either a direct URL (CORS-enabled) or an inlined dataUrl
//   url: 'https://example.com/path/to/atlas.png', // optional
//   dataUrl: 'data:image/png;base64,...',          // optional
//   // Glyph layout metadata
//   tile: { w: 8, h: 8 },        // width/height in pixels per glyph
//   atlas: { cols: 16, rows: 16 }, // optional; if not provided, we infer from glyphCount
//   startCode: 32,               // first character code in the atlas (usually 32 for space)
//   glyphCount: 95               // number of glyphs available (e.g., 95 printable ASCII)
// }
//
// NOTE: Provide at least one of (url | dataUrl). If both exist, dataUrl takes precedence.

// Include the vendor atlas as a convenient default (parsed from the vendor JS as raw text)
import asciiTextureSource from '../../../vendor/ascii-dungeon/ascii-dungeon/ascii-texture.js?raw';

function extractVendorDataUrl() {
  try {
    const m = (asciiTextureSource || '').match(/const\s+asciiBase64\s*=\s*`([^`]+)`/s);
    return m && m[1] ? m[1] : null;
  } catch (_) { return null; }
}

const defaultFonts = [
  {
    id: 'vendor-8x8',
    name: 'Vendor 8x8 (Default)',
    dataUrl: extractVendorDataUrl(),
    tile: { w: 8, h: 8 },
    atlas: { cols: 16, rows: 16 },
    startCode: 0,
    glyphCount: 255,
  },
  // EXAMPLE: Internet font (8x16) — replace with your URL
  // {
  //   id: 'dos-8x16',
  //   name: 'DOS 8x16 (URL)',
  //   url: 'https://your.cdn/fonts/dos-8x16.png',
  //   tile: { w: 8, h: 16 },
  //   atlas: { cols: 16, rows: 16 },
  //   startCode: 32,
  //   glyphCount: 224,
  // },
];

const catalog = new Map(defaultFonts.map(f => [f.id, f]));

export function listFonts() {
  return Array.from(catalog.values()).map(f => ({ id: f.id, name: f.name }));
}

export function getFont(id) {
  return catalog.get(id) || null;
}

export function registerFont(meta) {
  // Minimal validation; prefer human-friendly errors to throwing
  if (!meta || !meta.id || !meta.name || !meta.tile || !meta.tile.w || !meta.tile.h) {
    console.warn('[fontCatalog] Invalid font metadata; required: id, name, tile.{w,h}');
    return false;
  }
  catalog.set(meta.id, meta);
  return true;
}

export function resolveImageSrc(font) {
  if (!font) return null;
  if (font.dataUrl && typeof font.dataUrl === 'string') return font.dataUrl;
  if (font.url && typeof font.url === 'string') return font.url;
  return null;
}

export function computeGlyphCount(font) {
  if (!font) return 0;
  if (Number.isFinite(font.glyphCount)) return font.glyphCount;
  if (font.atlas && font.atlas.cols && font.atlas.rows) return font.atlas.cols * font.atlas.rows;
  // Fallback to printable ASCII length
  const start = Number.isFinite(font.startCode) ? font.startCode : 32;
  const end = 126; // printable ASCII end
  return Math.max(0, end - start + 1);
}
