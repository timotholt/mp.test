# GI Vendor Parity & Enhancements TODO

This document tracks the work to achieve visual parity with the original vendor GI demo and then reintroduce our enhancements safely.

## Top Priority

- [ ] Fix camera drag scaling to vendor behavior
  - File: `client/core/renderer.js`
  - Change: use `1/zoom` instead of `1/Math.sqrt(zoom)` when calling `rc.panCamera(...)`.
  - Accept: With vendor defaults and Bilinear ON / Nearest OFF, vertical drag does not materially change the GI look.

- [ ] Adjust Advanced sliders to vendor ranges and mapping
  - File: `client/modals/settings/tabs/displayTab.js`
  - Base Ray Count options → `{4, 16, 64}` (map to both `rc.rcUniforms.baseRayCount` and internal `rc.baseRayCount`).
  - Interval Length → range `1.0..512.0` (step `0.1`).
  - Interval Overlap → range `-1.0..2.0` (step `0.01`).
  - Pixels Between Probes → exponent slider `0..4`, display `2^exp`.
  - Accept: Slider sweeps create noticeable, vendor-like changes.

- [ ] Introduce Vendor Parity Mode
  - File: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi.js`
  - In parity mode:
    - Set `threshold=0.0`, `curve=1.0`, `lightDecay=0.0`.
    - Use `dungeonPassTextureHigh` as `sceneTexture` for RC.
    - Simplify `overlayPass()` to direct RC output (no fog/haze, no ENTITIES second pass).
  - Accept: Still image closely matches the original vendor visual.

## Verification & Tooling

- [ ] Add parity toggle and one-frame uniform snapshot logging
  - Files: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi.js`, `client/core/renderer.js`
  - Hidden toggle (no UI). Log `rcUniforms`, `overlayUniforms`, and render target sizes when enabled.

- [ ] Acceptance test pass
  - Defaults: Bilinear ON, Nearest OFF, Falloff 2.0, Base Probes 1, Interval 1.0, Base Rays 4, Overlap 0.1.
  - Tests:
    - Vertical drag stability.
    - Slider response parity (Interval and Base Rays sweep).

## Deep Dives (if needed)

- [ ] If drag still shifts visuals unexpectedly
  - Files: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi-helpers.js`, `client/core/renderer.js`
  - Re-check `subTileOffset` handling (keep disabled like vendor initially).
  - Confirm probe-grid reinit when spacing changes.
  - Consider quantizing probe origins as a last resort.

## Reintroduce Enhancements (post-parity)

- [ ] Restore overlay fog/haze screen composition and Debug wiring
  - File: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi.js`
  - Ensure only overlay affects the on-screen composite; RC sceneTexture remains vendor-like in parity mode.

- [ ] Optional: emission-surface sceneTexture for GI (FLOOR+ENTITIES)
  - File: `client/vendor/ascii-dungeon/ascii-dungeon/ascii-gi.js`
  - Behind a toggle. Document visual differences when enabled.

## Documentation & Helpers

- [ ] Dev Notes
  - File: `docs/gi-notes.md` (or `README.md` section)
  - Parity Mode, slider mappings, toggles, verification steps, and expected deviations when toggles are ON.

- [ ] Print-settings helper
  - File: `client/core/renderer.js`
  - Small function to log current GI settings to aid bug reports and regression checks.
