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

## Overview

**Creative North Star: "The Paint Book"**

Driveaway is a factory swatch book that happens to rent cars. Every car category owns one paint, and any region of the page that is about a category wears that paint as a full lacquered field. Everything else, the chrome, the navigation, the forms, the tables, stays in neutral primer (light theme) or clear coat (dark theme) and plain ink, so the paint is the only colour you notice.

Density is moderate and editorial: wide uppercase display type, generous section rhythm (80–96px), one 1280px container. Chroma is spent in large, deliberate blocks (hero fields, swatch chips, the closing hub band) rather than sprinkled as accents. The signature interaction is the repaint: choosing a swatch wipes the new paint across the field from the chip that was pressed.

The system rejects the exotic-rental default of a dark photo hero, a gold call-to-action and a grid of equal cards. The old amber accent is retired and does not come back.

**Key Characteristics:**
- Neutral primer/clear-coat chrome; all chroma comes from eight category paints.
- Paint applied as lacquer: a solid field with a soft clear-coat highlight sweep.
- One family, Archivo, with its width axis doing the voice work (125% display, 62% codes, 100% body).
- Ink pill buttons; one paint-coloured action per screen at most.
- Unavailable cars shown matte and desaturated ("unlit"), never hidden.
- 18px chip corners with an occasional oversized bottom-left corner on signature panels.

## Colors

A neutral, slightly warm paper-and-ink frame holding eight saturated automotive paints.

### Primary
The primary colour is whichever paint is "on show". A region sets it once (as `--paint` and `--on-paint` RGB channels via the paint helper), and everything inside uses the paint and on-paint tokens. The eight factory paints, numbered as in a paint book:
- **01 French Racing Blue** (#1F3C88): Hypercar.
- **02 Rosso Corsa** (#D0021B): Supercar. The default paint on show, and the paint the root falls back to.
- **03 Racing Green** (#0F4D2E): Luxury.
- **04 Giallo** (#F2B705): SUV. Takes dark ink labels.
- **05 Voltage Teal** (#0B7785): Electric. Deliberately deeper than a bright cyan so white labels clear 4.5:1.
- **06 Arancio** (#E8590C): Sports. Takes dark ink labels.
- **07 Graphite** (#4A4E57): Sedan, and the fallback for any unknown category.
- **08 Lilac** (#7B61C9): Hatchback.

### Neutral
Primer (light theme) / Clear coat (dark theme), swapped by the `dark` class on the root:
- **Ground** (#ECEAE6 / #0C0C0D): page background and the sticky header.
- **Surface** (#F6F5F2 / #161618): banded sections, admin sidebar, menus, modals.
- **Raised** (#FFFFFF / #1F1F22): cards, fields, the order slip.
- **Ink** (#111113 / #F2F0EC): all text, primary buttons, focus rings.
- **Muted** (#5E5B57 / #A29E98): secondary text, labels, specs.
- **Line** (#D6D2CB / #2E2E32): hairline borders, rules, dividers.
- **Clear-coat scrim** (#0C0C0D at 70–85%): pills and modal backdrops laid over photos, in both themes.

### Status
- **OK** (#1E8E4E), **Warn** (#B7791F), **Danger** (#C81E1E): booking and fleet status only, shown as a small dot plus label, and danger for destructive actions. Never used as decoration.

### Named Rules
**The Paint Owns Chroma Rule.** Chrome is neutral ink on primer or clear coat. The only saturated colour on a screen is a category paint (plus status dots). If a new element wants colour, it takes the paint of the category it belongs to, or it stays ink.

**The On-Colour Rule.** Text on a paint always uses that paint's paired on-colour: Giallo and Arancio take ink (#111113); every other paint takes white. A new or adjusted paint must reach 4.5:1 against its on-colour before it ships.

**The One Paint Per Region Rule.** A region declares its paint once at its root; descendants read the paint and on-paint tokens. Never hard-code a paint hex into a child of a painted region.

## Typography

**Display Font:** Archivo (variable, wdth 62–125, wght 400–900), with system-ui fallback
**Body Font:** Archivo at 100% width
**Label/Mono Font:** Archivo at 62% width (the "code" voice)

**Character:** One grotesque stretched three ways. Expanded black capitals read like a model badge on a tailgate; condensed tracked capitals read like a paint code on a door-jamb sticker. Numbers are tabular everywhere (`tnum`, plus `ss01`).

### Hierarchy
- **Display** (900, 125% width, uppercase, line-height 0.9, -0.02em): hero headline, sized to fit its longest line in the container and capped at 5rem. Page heads use the same style at clamp(2.8rem, 6.5vw, 6rem).
- **Headline** (900, 125% width, uppercase, 2.25rem mobile / 3rem desktop, line-height 0.9): section headings.
- **Title** (900, 125% width, uppercase, 17px to 1.5rem, line-height 1.05): car names, step titles, modal titles, prices.
- **Body** (400, 100% width, 1rem, ~1.5; lead copy 1.125rem leading-snug): running text, kept under ~28rem (max-w-md) beside display type. Headings balance, paragraphs wrap pretty.
- **Label** (700, 62% width, uppercase, 0.12em tracking, 11–13px): paint codes, field labels, spec labels, status badges, metadata lines under headings.

### Named Rules
**The Width Axis Rule.** Voice changes by width, not by family. Display and titles are 125% black uppercase; codes and labels are 62% bold tracked uppercase; reading text is 100%. No second typeface.

**The Fit-the-Line Rule.** The hero headline is sized from its own character count against the container width, never larger than 5rem, so a long category name ("Hatchbacks, in Lilac.") never breaks mid-word or overflows.

## Layout

One centred container (max 1280px) with gutters of 16px, 24px at 640px and 32px at 1024px. Sections breathe at 80px vertical padding, 96px from 640px. Content grids are 12-column on large screens, typically 5/7 splits (copy and order slip left, car frame right); card grids go 1 → 2 (640px) → 3 (1280px) columns with 24px gaps. Section heads sit on a hairline rule with the heading left and a line button right, wrapping on narrow screens. The header is fixed at 72px; the first section offsets by that height. On mobile the hero photo moves above the order slip, and the swatch fan becomes a horizontally scrolling strip that bleeds to the screen edge. Admin uses a sticky sidebar (256px, collapsing to 72px) beside the same container.

## Elevation & Depth

Hybrid: surfaces are flat and hairline-bordered at rest; shadows appear for things that float (the order slip, hero frame, menus, modals) and as a response to intent (card hover). Depth inside paint comes from the lacquer highlight, not from shadow.

### Shadow Vocabulary
- **Soft** (`box-shadow: 0 8px 24px -12px rgb(0 0 0 / 0.25)`): scrolled header, paint tags on photos, paint button hover.
- **Lift** (`box-shadow: 0 24px 60px -24px rgb(0 0 0 / 0.45)`): card hover, order slip, hero photo frame, menus, modals.
- **Chip** (`box-shadow: 0 1px 0 rgb(255 255 255 / 0.18) inset, 0 18px 40px -18px rgb(0 0 0 / 0.55)`): swatch chips and painted panels; the inset line is the clear coat catching light.

### Named Rules
**The Flat at Rest Rule.** Cards and lists sit flat with a 1px line border. They lift (translate up 4px, Lift shadow) only on hover or keyboard focus.

## Shapes

Soft, swatch-like rectangles. Cards, chips and panels use an 18px chip corner; fields and inner rows 12px; small paint tags 8px; category badges 6px. All actions, status badges and avatars are full pills. The modal is 22px and the hero photo frame 28px. Signature paint panels (the hero photo frame, the first "how it works" card) cut one oversized bottom-left corner (96px and 56px) like a die-cut swatch; swatch chips in the fan and the garage are rounded on top only, standing on the edge below them. Borders are always 1px hairlines in the line colour; the empty garage uses a dashed hairline.

## Components

### Buttons
Confident ink pills; colour is earned, not default.
- **Shape:** full pill (9999px), 600 weight, 14px, 12px × 20px padding; large size 16px × 28–32px at 16px.
- **Ink (default):** ink background, ground-coloured text; hover drops to 85% ink.
- **Paint:** the page's current paint with its on-colour; hover brightens 10% and adds the Soft shadow. Reserved for the commit action of a car (Book on car detail, Confirm on booking).
- **Line:** transparent with a line border; hover darkens the border to ink. Secondary actions and section-head links.
- **Ghost:** transparent; hover lays a 5% ink wash.
- **Danger:** status-danger background, white text.
- **All:** 200ms ease-out on colour and shadow, press scales to 0.98, disabled at 50% opacity. Focus is a 2px ink outline offset 3px (on-paint inside painted regions).

### Chips
- **Paint tag:** a small lacquer tag (8px corners, label type) reading "02 · Supercar" pinned top-left on car photos.
- **Category badge:** the category's paint hex with its on-colour, 6px corners, label type.
- **Status badge:** pill with a 6% ink wash, a 6px status dot and label type in the status colour; over photos it becomes a clear-coat scrim pill with white text.

### Cards / Containers
- **Corner Style:** 18px chip corner.
- **Background:** raised, with a 1px line border.
- **Shadow Strategy:** Flat at Rest; Lift on hover/focus.
- **Internal Padding:** 20px on car cards, 24–28px on panels.
- **Car card:** a 16:10 photo (eases to 1.04× scale on hover over 700ms), paint tag top-left, name in title type with full width, company as a label, price in wide black with "/day" muted, specs as a muted inline list. The footer row ("View and book") fills with the car's paint from the left on hover (500ms) and its text turns on-paint.

### Inputs / Fields
- **Style:** raised background, 1px line border, 12px corners, 12px × 16px padding, 14px text, placeholder in 70% muted. Labels above in label type at 12px, muted.
- **Focus:** border turns ink, no glow ring; the text caret is the current paint.
- **Disabled:** 50% opacity.

### Navigation
Fixed 72px ground-coloured header; transparent bottom border at the top of the page, gaining a line border and Soft shadow once scrolled. Links are 14px semibold muted, turning ink on hover; the active link is ink with a 3px paint underline bar. Right side: an "Offers" line pill, the theme toggle, and either Log in (ghost) / Sign up (ink) or an account pill with a lacquer avatar opening a surface menu. On mobile the links expand below the bar as wide black uppercase words at 1.5rem.

### Lacquer and Unlit (signature)
**Lacquer** is how paint is applied: the current paint as a solid field with an overlay of a 118° white highlight sweep (14% → 4% → clear by 46%) and a 12% darkening along the bottom 30%. It is used for hero fields, swatch chips, paint tags, avatars, painted section bands and the card footer fill. **Unlit** is the same material switched off: saturation 15%, brightness 92%, no highlight. Any car that is not available renders unlit, with its status on a scrim pill.

### Swatch fan and repaint (signature)
The hero ends in a fan of lacquer chips, one per category (paint number in label type, category in title type, "from" price), standing on the bottom edge; the active chip shows an on-paint dot. Choosing a chip wipes the new paint across the field as a circle growing from that chip's position at the bottom edge (650ms, cubic-bezier(0.16, 1, 0.3, 1)); the headline cross-fades over 350ms. With reduced motion the paint swaps instantly. The dashboard's garage repeats the chip form: one top-rounded paint chip per booked car.

## Do's and Don'ts

### Do:
- **Do** let a category's paint flood whole regions (hero, page head, a closing band) as lacquer, and keep everything else neutral ink.
- **Do** pair every paint with its on-colour: ink #111113 on Giallo and Arancio, white on the rest.
- **Do** use Archivo's width axis for hierarchy: 125% black uppercase display, 62% tracked uppercase labels at 11px minimum, 100% body.
- **Do** use ink pills for actions and save the paint button for the one booking commit on a screen.
- **Do** show unavailable cars unlit with their status, and offer the notify action instead of hiding them.
- **Do** keep 18px chip corners on cards and chips, and reserve the oversized bottom-left corner for signature paint panels.
- **Do** honour reduced motion: the wipe and every transition collapse to an instant change.

### Don't:
- **Don't** reintroduce a gold or amber accent, a dark-photo hero with a gold button, or a grid of identical dark cards.
- **Don't** add accent colours outside the eight paints and three status colours.
- **Don't** fill chrome (navigation, forms, tables, admin panels) with paint; paint there is limited to the avatar, the active-link bar and category tags.
- **Don't** set label text below 11px or use a second typeface.
- **Don't** use colour or a shadow to show resting state; cards are flat until hovered or focused.
