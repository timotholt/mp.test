# UI Standards

This document captures shared UI values and behaviors for auth modals and related UI.

## Colors (hex and RGB)

- Button text (enabled): `#dff1ff` (rgb 223, 241, 255)
- Button text (disabled): `#9fb1c6` (rgb 159, 177, 198)
- Error text (modals): `#ff4d4f` (rgb 255, 77, 79)
- Success text (modals): `#9fffb3` (rgb 159, 255, 179)
- Input/button border (base): `rgba(120,170,255,0.60)` (base rgb 120, 170, 255)

## Shadows and highlights

- Input shadow (base): `inset 0 0 12px rgba(40,100,200,0.10), 0 0 12px rgba(120,170,255,0.18)`
- Input shadow (focus): `inset 0 0 16px rgba(60,140,240,0.18), 0 0 18px rgba(140,190,255,0.30)`
- Button shadow (base): `inset 0 0 14px rgba(40,100,200,0.12), 0 0 16px rgba(120,170,255,0.22)`
- Button shadow (hover): `inset 0 0 18px rgba(60,140,240,0.18), 0 0 20px rgba(140,190,255,0.30)`

## Behaviors

- Inputs and primary buttons get white border/highlight on hover/focus.
- Disabled buttons are dim (opacity ~0.5) and do not show hover/focus glow.
- Tooltips use "far" mode.
  - Bottom action rows (e.g., Cancel/Create, Send Reset): prefer bottom-first placement `b,bc,br,bl,t`.
  - Other controls (e.g., provider buttons): use a side/top placement appropriate to layout.
  - Create (enabled): "Create your account"
  - Create (disabled): "Fill in all fields properly to create an account"
  - Cancel: "Return to the login page"
- Focus trap for modals keeps Tab navigation within inputs and primary buttons.
- Password eye icon buttons are clickable but not tab stops.

## Typography

- Modal title (name): 22px, weight 700.
- Modal tagline/subtitle: 13px, subtle tone (recommended color `#cfe6ff`) with ~0.9 opacity.

## Layout and Centering

- Center all modals both vertically and horizontally:
  - Use a wrapper with `display: flex; align-items: center; justify-content: center; min-height: 100vh; padding: 24px;`.
- Modal card uses a glass surface with rounded corners and consistent border/shadow (see Colors and Shadows above).

## Taglines

- Create Account modals show a randomly selected tagline under the title from a curated list in `client/modals/createAccount.js`. Keep the tone grimdark, witty, and short.
