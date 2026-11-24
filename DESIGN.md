---
name: Driveaway
description: Exotic and luxury car rental in Ahmedabad, sorted and worn as a factory paint book.
colors:
  primer-ground: "#ECEAE6"
  primer-surface: "#F6F5F2"
  primer-raised: "#FFFFFF"
  primer-ink: "#111113"
  primer-muted: "#5E5B57"
  primer-line: "#D6D2CB"
  clearcoat-ground: "#0C0C0D"
  clearcoat-surface: "#161618"
  clearcoat-raised: "#1F1F22"
  clearcoat-ink: "#F2F0EC"
  clearcoat-muted: "#A29E98"
  clearcoat-line: "#2E2E32"
  on-paint-light: "#FFFFFF"
  on-paint-dark: "#111113"
  paint-01-french-racing-blue: "#1F3C88"
  paint-02-rosso-corsa: "#D0021B"
  paint-03-racing-green: "#0F4D2E"
  paint-04-giallo: "#F2B705"
  paint-05-voltage-teal: "#0B7785"
  paint-06-arancio: "#E8590C"
  paint-07-graphite: "#4A4E57"
  paint-08-lilac: "#7B61C9"
  status-ok: "#1E8E4E"
  status-warn: "#B7791F"
  status-danger: "#C81E1E"
typography:
  display:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "min(5rem, fit-to-line)"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  headline:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "3rem"
    fontWeight: 900
    lineHeight: 0.9
    letterSpacing: "-0.02em"
    fontVariation: "'wdth' 125"
  title:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "17px"
    fontWeight: 900
    lineHeight: 1.05
    letterSpacing: "-0.025em"
    fontVariation: "'wdth' 125"
  body:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.5
    fontFeature: "'ss01', 'tnum'"
    fontVariation: "'wdth' 100"
  label:
    fontFamily: "Archivo, system-ui, sans-serif"
    fontSize: "11px"
    fontWeight: 700
    lineHeight: 1.4
    letterSpacing: "0.12em"
    fontVariation: "'wdth' 62"
rounded:
  badge: "6px"
  tag: "8px"
  field: "12px"
  chip: "18px"
  modal: "22px"
  frame: "28px"
  pill: "9999px"
spacing:
  gutter-sm: "16px"
  gutter-md: "24px"
  gutter-lg: "32px"
  card: "20px"
  panel: "28px"
  section: "80px"
  section-lg: "96px"
components:
  button-ink:
    backgroundColor: "{colors.primer-ink}"
    textColor: "{colors.primer-ground}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-paint:
    backgroundColor: "{colors.paint-02-rosso-corsa}"
    textColor: "{colors.on-paint-light}"
    rounded: "{rounded.pill}"
    padding: "16px 32px"
  button-line:
    backgroundColor: "transparent"
    textColor: "{colors.primer-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.primer-ink}"
    rounded: "{rounded.pill}"
    padding: "12px 20px"
  field:
    backgroundColor: "{colors.primer-raised}"
    textColor: "{colors.primer-ink}"
    rounded: "{rounded.field}"
    padding: "12px 16px"
  car-card:
    backgroundColor: "{colors.primer-raised}"
    textColor: "{colors.primer-ink}"
    rounded: "{rounded.chip}"
    padding: "{spacing.card}"
  paint-tag:
    backgroundColor: "{colors.paint-02-rosso-corsa}"
    textColor: "{colors.on-paint-light}"
    typography: "{typography.label}"
    rounded: "{rounded.tag}"
    padding: "6px 10px"
  status-badge:
    textColor: "{colors.primer-muted}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
  modal:
    backgroundColor: "{colors.primer-surface}"
    textColor: "{colors.primer-ink}"
    rounded: "{rounded.modal}"
    padding: "24px"
---

# Design System: Driveaway

<!-- impeccable:design-map -->
Name: Driveaway
Colors: primary: paint-01-french-racing-blue #1F3C88; neutral: primer-ground #ECEAE6; status: status-ok #1E8E4E; primary: paint-02-rosso-corsa #D0021B; primary: paint-03-racing-green #0F4D2E (+20 more in the sidecar)
Fonts: Archivo (display, headline, title, body, label)
Spacing: gutter-sm 16px, gutter-md 24px, gutter-lg 32px, card 20px, panel 28px, section 80px, section-lg 96px
Radius: badge 6px, tag 8px, field 12px, chip 18px, modal 22px, frame 28px, pill 9999px
North Star: "The Paint Book"
Rules:
- The Paint Owns Chroma Rule. Chrome is neutral ink on primer or clear coat.
- The On-Colour Rule. Text on a paint always uses that paint's paired on-colour: Giallo and Arancio take ink (#111113); every other paint takes white.
- The One Paint Per Region Rule. A region declares its paint once at its root; descendants read the paint and on-paint tokens.
- The Width Axis Rule. Voice changes by width, not by family.
- The Fit-the-Line Rule. The hero headline is sized from its own character count against the container width, never larger than 5rem, so a long category name ("Hatchbacks, in Lilac.") never breaks mid-word or overflows.
- The Flat at Rest Rule. Cards and lists sit flat with a 1px line border.
Elevation:
- Soft: 0 8px 24px -12px rgb(0 0 0 / 0.25)
- Lift: 0 24px 60px -24px rgb(0 0 0 / 0.45)
- Chip: 0 1px 0 rgb(255 255 255 / 0.18) inset, 0 18px 40px -18px rgb(0 0 0 / 0.55)
Don't:
- Don't reintroduce a gold or amber accent, a dark-photo hero with a gold button, or a grid of identical dark cards.
- Don't add accent colours outside the eight paints and three status colours.
- Don't fill chrome (navigation, forms, tables, admin panels) with paint; paint there is limited to the avatar, the active-link bar and category tags.
- Don't set label text below 11px or use a second typeface.
- Don't use colour or a shadow to show resting state; cards are flat until hovered or focused.
Do:
- Do let a category's paint flood whole regions (hero, page head, a closing band) as lacquer, and keep everything else neutral ink.
- Do pair every paint with its on-colour: ink #111113 on Giallo and Arancio, white on the rest.
- (+5 more)
Map: src/components/home/PaintPicker.jsx
Map: src/hooks/useViewTransitionNavigate.js
Map: src/hooks/useScrollDrift.js
Full: .impeccable/design-full.md (read a section when you need its detail)
