Spec: Knob-based Color Controls (Hue, Saturation, Brightness)
This spec introduces knob controls for color tuning in the Settings Theme panel using the existing reusable control in 
client/core/ui/knob.js
. It adds code and color-model support in 
client/core/ui/theme/themeManager.js
 while preserving full backward compatibility with current sliders and persisted values.

Goals
Replace the Theme tab’s color sliders with three knobs:
Hue (color)
Saturation
Brightness
Keep theme look-and-feel stable by default.
Reuse the existing knob component without global CSS changes.
Persist settings and support presets and Reset.
Maintain backwards compatibility (no breaking changes to existing storage keys, and the current look when using defaults).
UI Changes
File: 
client/modals/settings.js
 in 
presentSettingsOverlay.render
Replace the current “Hue” and “Saturation” sliders with a compact “Color” row containing 3 knobs:
Hue: 0–360, step 1
Saturation: 0–100, step 1
Brightness: 0–100, step 1, with 50 as the neutral midpoint
Use 
createKnob()
 from 
client/core/ui/knob.js
 for each control:
API: const { el, getValue, setValue } = createKnob({ min, max, value, step, label, onInput, onChange })
Wire 
onInput
 to call 
window.UITheme.applyDynamicTheme()
 with the updated parameter only.
Wire 
onChange
 to persist values to localStorage (see Persistence).
Apply a knob theme via 
applyKnobTheme(el, themes.neonCyan)
 for consistent appearance with our glass UI.
A11y/tooltips: 
knob.js
 already sets role="slider", ARIA bounds, keyboard and wheel behavior, and a tooltip (via 
tooltip.js
).
Layout:
Place the three knobs horizontally with labels underneath or above (reuse existing Theme panel container styles; no global CSS changes).
Keep existing other controls: Transparency, Gradient, Milkiness (blur), Overlay Darkness, etc.
Theme Manager Changes
File: 
client/core/ui/theme/themeManager.js
Extend 
applyDynamicTheme(params)
 to accept:
saturation (0–100)
brightness (0–100; neutral = 50)
Backwards compatibility:
If params.saturation is not provided, keep reading and using the current intensity value as we do today.
If params.brightness is not provided, assume 50 (neutral).
Keep reading persisted ui_intensity for older users; only write new keys when the new knobs are used.
Persistence:
Read existing: ui_hue (already), ui_intensity (legacy), ui_saturation (new), ui_brightness (new).
Persist new keys: ui_saturation, ui_brightness whenever provided.
CSS variables:
Continue writing --ui-hue as today.
Optionally publish numeric helpers for debugging/consumers:
--ui-saturation (0–100)
--ui-brightness (0–100)
All derived colors still computed in JS and assigned to existing tokens (--ui-accent, --ui-surface-*, --ui-glow-strong, --ui-overlay-*, tooltip tokens, etc.).
Color Model
Keep HSL as the internal CSS representation (native browser support, easy to reason about hue-driven themes).
Saturation:
Replace the “intensity impacts saturation” coupling with a direct saturation control when provided.
Mapping: sat = clamp(saturation * 0.85, 0, 85) (preserves current max levels and look).
Brightness:
Implement brightness as a controlled lightness adjustment around today’s base.
Base lightness (current logic): lightBase = clamp(45 + (60 - satBase) * 0.15, 30, 70), where satBase is the value we used previously (from “intensity” or from saturation if provided).
Apply brightness delta with a neutral midpoint:
brightnessDelta = (brightness - 50) * 0.3
light = clamp(lightBase + brightnessDelta, 30, 70)
Defaults (unchanged visual baseline):
Hue: 210
Saturation: default 60
Brightness: default 50 (neutral)
With these defaults, the computed look should match today’s visuals.
Note: We intentionally keep the “Brightness” knob as a lightness offset rather than adopting HSV to avoid a larger refactor and to preserve current aesthetic across surfaces, borders, and glows. If we later want true HSV, we can add a conversion step (HSV→HSL) and phase it in behind a flag.

Wiring and Events
Knob events:
onInput
: live-update the theme via 
applyDynamicTheme({ hue: X })
, 
applyDynamicTheme({ saturation: Y })
, 
applyDynamicTheme({ brightness: Z })
.
onChange
: persist ui_hue, ui_saturation, ui_brightness.
Presets:
Preset structures in 
presentSettingsOverlay.render
 should be extended to include saturation and brightness. For missing fields (older presets), default saturation=60, brightness=50.
When a preset is applied, call 
setValue()
 on the three knobs to update the UI state and call 
applyDynamicTheme()
 once with all three.
Reset:
Reset sets hue=210, saturation=60, brightness=50, and updates knobs, calls 
applyDynamicTheme()
 and persists.
Data Model and Storage
New keys:
ui_saturation (0–100)
ui_brightness (0–100; 50 is neutral)
Existing keys remain:
ui_hue, ui_intensity (legacy; still read, not written once new knobs are used)
Migration:
If ui_saturation is absent but ui_intensity exists, initialize saturation from intensity.
If ui_brightness is absent, initialize to 50 (neutral).
Theme Panel Changes (Implementation Notes)
File: 
client/modals/settings.js
Import createKnob, applyKnobTheme, themes from 
client/core/ui/knob.js
.
Build a “Color” row with 3 knobs:
Hue knob: { min: 0, max: 360, step: 1, value: currentHue, label: 'Hue' }
Saturation knob: { min: 0, max: 100, step: 1, value: currentSaturation, label: 'Saturation' }
Brightness knob: { min: 0, max: 100, step: 1, value: currentBrightness, label: 'Brightness' }
Use 
applyKnobTheme(el, themes.neonCyan)
 to theme them.
Replace the old slider rows for hue and (renamed) saturation.
Integrate with existing “Presets” and “Reset” logic: update knobs and persist.
Acceptance Criteria
The Theme tab displays Hue, Saturation, Brightness as knobs using 
knob.js
.
Changing any knob updates the theme live and persists on release.
Defaults produce the same visual appearance as current code (no surprise shifts).
Presets correctly update the knobs and theme; missing saturation/brightness in older presets auto-fill to defaults.
Reset restores Hue=210, Saturation=60, Brightness=50.
No regressions to Transparency, Gradient, Milkiness, Overlay Darkness, or font scale.
No global CSS modifications required; knob visuals come from 
knob.js
.
Risks and Mitigations
Saturation/brightness interplay with borders/glows:
We clamp and scale as today; brightness is a bounded offset only, protecting contrast.
Backward compatibility:
Continue supporting ui_intensity reads; write ui_saturation going forward.
Performance:
Same as current 
applyDynamicTheme()
 flow. Knob events use debounced-style change (
onChange
) for persistence.
Out of Scope
Full switch to HSV color pipeline.
Theming changes outside of the Theme panel.
Heavy HTML/CSS rework beyond embedding knobs.
QA Plan
Verify new knobs:
Keyboard arrows adjust values by step.
Mouse wheel increments/decrements.
Tooltip reflects label and percent.
Persistence:
Reload retains values.
Visual:
Defaults match previous look.
Edge values (Saturation 0 and 100; Brightness 0 and 100) remain readable.