# Caissa — Design System

**Document ID:** CAISSA-DS-001  
**Document Type:** Product Design System Specification  
**Version:** 1.0  
**Status:** Approved for Visual Design and Frontend Planning  
**Product:** Caissa  
**Product Slogan:** Beyond the Best Move  
**Prepared:** July 2026  
**Owner:** Md. Saminul Amin  
**Primary Audience:** Product Design, Frontend Engineering, UX, QA, Brand, and Codex-assisted development

---

## 1. Purpose

This document defines the visual and interaction design language of Caissa.

It converts the product philosophy and UX requirements into a consistent system of color, typography, spacing, layout, shape, elevation, iconography, motion, component styling, chessboard presentation, data visualization, accessibility behavior, responsive rules, and implementation constraints.

The design system exists to ensure that Caissa feels like one coherent product across every screen and state. It is not a collection of decorative preferences; it is a set of implementation rules.

## 2. Related Documents

- `00_product_identity.md`
- `01_prd.md`
- `02_ux_specification.md`
- `04_technical_specification.md` — planned
- `05_architecture_design.md` — planned
- `06_ai_architecture.md` — planned

When conflicts occur, use this priority:

1. Chess correctness and usability
2. Accessibility
3. UX specification
4. Product identity
5. This design system
6. Local implementation preference

---

# 3. Design Philosophy

Caissa’s visual identity should express calm intelligence, human warmth, precision, restraint, focus, premium craftsmanship, and respect for the game.

The interface should feel modern without looking temporary or trend-dependent.

Caissa should not feel like:

- A generic glassmorphism dashboard
- A neon esports interface
- A loud gaming launcher
- A copy of Chess.com or Lichess
- A futuristic AI demonstration
- A corporate analytics product
- A medieval chess theme

The desired visual position is:

> Contemporary, thoughtful, tactile, and quietly premium.

## 3.1 Core Visual Principles

### The Board Is the Hero

The board must remain the strongest visual object during gameplay. Surrounding UI should support, not compete with it.

### Warmth Over Sterility

Warm neutrals should make the product feel more human. Warmth may appear through ivory text, sand-toned surfaces, muted bronze accents, natural board colors, and soft shadow temperature.

### Depth Without Noise

Depth should come from surface layering, controlled shadows, tonal contrast, and spatial grouping—not from heavy gradients, glows, or excessive translucency.

### Information Has Hierarchy

Every screen must make clear what the user is doing, what requires attention, what can be acted upon, and what is supporting information.

### Restraint Is a Feature

Avoid too many badges, colors, card styles, font weights, animations, and visual metaphors. Use progressive disclosure.

---

# 4. Brand Foundation

**Brand name:** Caissa  
**Primary slogan:** Beyond the Best Move

Preferred styling:

- Use “Caissa” in sentence case.
- Do not use all caps as the default wordmark.
- Treat the slogan as editorial content, not a badge.

Brand personality:

- Intelligent
- Calm
- Refined
- Encouraging
- Precise
- Human

---

# 5. Color System

## 5.1 Color Strategy

Caissa uses a dark-first interface with warm neutral surfaces and a restrained verdigris accent. The accent should suggest intelligence, quiet confidence, clarity, and stability.

It must not feel like bright gaming green, finance-app green, medical teal, or neon cyan.

## 5.2 Core Palette

### Ink Scale

| Token | Value | Usage |
|---|---:|---|
| `ink-950` | `#0B0D0F` | App background |
| `ink-900` | `#101316` | Primary surface |
| `ink-850` | `#15191D` | Raised surface |
| `ink-800` | `#1B2025` | Elevated card |
| `ink-750` | `#22282E` | Hover surface |
| `ink-700` | `#2A3138` | Strong border |
| `ink-600` | `#3C454E` | Muted border |
| `ink-500` | `#58636E` | Disabled structure |

### Ivory Scale

| Token | Value | Usage |
|---|---:|---|
| `ivory-50` | `#FAF8F2` | Primary text |
| `ivory-100` | `#F3EFE6` | Strong secondary text |
| `ivory-200` | `#E6E0D5` | Standard secondary text |
| `ivory-300` | `#CFC7B9` | Muted text |
| `ivory-400` | `#AFA79B` | Disabled text |
| `ivory-500` | `#817A71` | Decorative text |

### Verdigris Scale

| Token | Value | Usage |
|---|---:|---|
| `verdigris-50` | `#EAF7F3` | Light accent text/surface |
| `verdigris-100` | `#CBE9E0` | Subtle highlight |
| `verdigris-200` | `#9ED4C6` | Secondary active |
| `verdigris-300` | `#68B9A7` | Active border |
| `verdigris-400` | `#3E9D89` | Primary accent |
| `verdigris-500` | `#2F7F70` | Pressed accent |
| `verdigris-600` | `#24665B` | Dark accent |
| `verdigris-700` | `#1C5048` | Deep accent |

### Bronze Scale

| Token | Value | Usage |
|---|---:|---|
| `bronze-100` | `#F0E2C8` | Light special surface |
| `bronze-200` | `#D7BC8D` | Premium highlight |
| `bronze-300` | `#B99358` | Editorial accent |
| `bronze-400` | `#8E6D3C` | Pressed bronze |
| `bronze-500` | `#694E2B` | Deep bronze |

Bronze must not become a second primary action color.

## 5.3 Semantic Colors

| Purpose | Soft | Base | Strong |
|---|---:|---:|---:|
| Success | `#DCEFE6` | `#4F9C76` | `#2F6E50` |
| Warning | `#F4E8C9` | `#C7963E` | `#806023` |
| Error | `#F4DEDC` | `#C66D67` | `#84413D` |
| Information | `#DBE8F2` | `#668EAE` | `#3E627E` |

Semantic colors must remain muted enough to fit the product while retaining accessible contrast.

## 5.4 Dark Theme Semantic Tokens

```css
:root {
  /* Implemented as warm ink rather than the cool ink scale above; see tokens.css. */
  --color-bg-app: #0D0C0A;
  --color-bg-surface: #14120F;
  --color-bg-raised: #1A1815;
  --color-bg-elevated: #211E1A;
  --color-bg-hover: #29251F;

  --color-border-subtle: #2C2822;
  --color-border-strong: #423B32;

  --color-text-primary: #F5EFE4;
  --color-text-secondary: #CFC5B5;
  --color-text-muted: #A2978A;
  --color-text-disabled: #7A7166;

  --color-accent: #3E9D89;
  --color-accent-hover: #4EAC98;
  --color-accent-pressed: #2F7F70;
  --color-accent-soft: rgba(62, 157, 137, 0.14);

  --color-focus: #9ED4C6;
}
```

## 5.5 Light Theme Direction

Light theme is allowed but not required for the earliest prototype.

| Token | Value |
|---|---:|
| App background | `#F3EEE4` |
| Primary surface | `#FBF8F2` |
| Raised surface | `#F6F1E7` |
| Primary text | `#1C1915` |
| Secondary text | `#4B453D` |
| Border | `#DDD4C4` |
| Accent | `#276B5F` |

The implemented palettes for both themes live in `packages/design-tokens/tokens.css` and
`apps/web/src/app/theme-palettes.ts`; those files are the source of truth when this table
and the code disagree.

Light theme must preserve the same hierarchy and should not be treated as a simple color inversion.

## 5.6 Color Usage Rules

Primary accent may be used for:

- Primary CTA
- Selected navigation
- Current active control
- Legal move marker
- Focused state
- Important AI identity cue
- Active review step

Primary accent must not be used for:

- Every icon
- Every heading
- Every border
- Large backgrounds
- Decorative glows
- Non-interactive text

Bronze may be used for editorial highlights, product philosophy moments, premium theme labels, and rare celebratory states.

---

# 6. Chessboard Color System

## 6.1 Default Theme: Caissa Classic

| Element | Value |
|---|---:|
| Light square | `#CFC4AF` |
| Dark square | `#586B62` |
| Light square hover | `#D8CEBA` |
| Dark square hover | `#64786E` |
| Selected square | `#79A895` |
| Last move light | `#B8B67E` |
| Last move dark | `#7E8D62` |
| Check square | `#A85E59` |
| Legal marker | `rgba(16, 19, 22, 0.24)` |
| Capture ring | `rgba(16, 19, 22, 0.38)` |

The board should feel tactile and natural without literal wood texture.

## 6.2 Alternate Theme: Midnight Study

| Element | Value |
|---|---:|
| Light square | `#87949A` |
| Dark square | `#34434A` |
| Selected square | `#5D9E91` |
| Last move | `#8C8D5D` |
| Check square | `#A95E62` |

## 6.3 Alternate Theme: Linen

| Element | Value |
|---|---:|
| Light square | `#E8E0D1` |
| Dark square | `#9A8975` |
| Selected square | `#7FA995` |
| Last move | `#BBAE72` |
| Check square | `#B56862` |

## 6.4 Board Theme Rules

- No highly saturated square colors.
- No photographic wood textures in the default theme.
- Piece contrast must be tested on every square.
- Check must remain distinguishable from selection and last move.
- A colorblind-safe alternative must be available.
- Coordinates must remain legible on both square colors.

---

# 7. Chess Piece System

## 7.1 Launch Style

Recommended direction:

- Contemporary Staunton silhouette
- Clear at small sizes
- Slightly softened geometry
- Strong distinction between bishop, pawn, and queen
- No decorative medieval detailing
- No glossy 3D rendering
- SVG implementation

## 7.2 Piece Colors

White pieces:

- Base: `#F4F0E8`
- Detail: `#9D9589`

Black pieces:

- Base: `#1A1F23`
- Detail: `#637078`

## 7.3 Piece States

Required:

- Default
- Hover
- Selected
- Dragging
- Disabled
- Captured transition
- Promotion preview

A dragged piece may receive slight scale, increased shadow, and higher z-index. Avoid rotation, bounce, or cartoon-like effects.

---

# 8. Typography

## 8.1 Type Roles

Caissa uses three typographic roles:

1. Product and editorial expression
2. Interface clarity
3. Chess notation and technical detail

## 8.2 Recommended Fonts

### Display: Source Serif 4

Use for hero headings, product philosophy, editorial review headings, and occasional lessons.

### Interface: Manrope

Use for navigation, buttons, labels, cards, settings, body copy, and clocks.

### Notation: JetBrains Mono

Use for PGN, engine lines, raw evaluation, move sequences, and developer diagnostics.

## 8.3 Font Stack

```css
--font-display: "Source Serif 4", Georgia, serif;
--font-ui: "Manrope", Inter, system-ui, sans-serif;
--font-mono: "JetBrains Mono", "SFMono-Regular", Consolas, monospace;
```

## 8.4 Type Scale

| Token | Size | Line Height | Weight | Usage |
|---|---:|---:|---:|---|
| `display-xl` | 64px | 1.05 | 500 | Large desktop hero |
| `display-lg` | 52px | 1.08 | 500 | Standard hero |
| `display-md` | 42px | 1.12 | 500 | Editorial heading |
| `heading-xl` | 32px | 1.2 | 600 | Page title |
| `heading-lg` | 26px | 1.25 | 600 | Section title |
| `heading-md` | 21px | 1.3 | 600 | Card title |
| `heading-sm` | 18px | 1.35 | 600 | Subsection |
| `body-lg` | 18px | 1.6 | 400 | Lead copy |
| `body-md` | 16px | 1.55 | 400 | Default body |
| `body-sm` | 14px | 1.5 | 400 | Supporting text |
| `label-md` | 14px | 1.2 | 600 | Controls |
| `label-sm` | 12px | 1.2 | 600 | Metadata |
| `caption` | 12px | 1.4 | 400 | Notes |
| `clock-xl` | 36px | 1.0 | 650 | Desktop clock |
| `clock-lg` | 28px | 1.0 | 650 | Mobile/tablet clock |

## 8.5 Typography Rules

- Do not use display font for buttons.
- Normal body text must not be below 14px.
- Uppercase is reserved for small metadata labels.
- Uppercase label tracking: `0.08em`.
- Paragraph measure target: 55–75 characters.
- Do not center long-form text.
- Engine notation must not dominate human explanation.
- Clocks use tabular numerals.

---

# 9. Spacing System

Base unit: **4px**

| Token | Value |
|---|---:|
| `space-0` | 0 |
| `space-1` | 4px |
| `space-2` | 8px |
| `space-3` | 12px |
| `space-4` | 16px |
| `space-5` | 20px |
| `space-6` | 24px |
| `space-8` | 32px |
| `space-10` | 40px |
| `space-12` | 48px |
| `space-16` | 64px |
| `space-20` | 80px |
| `space-24` | 96px |

Rules:

- Control spacing: 8–12px
- Label-to-input: 8px
- Card padding: 16–24px
- Major section spacing: 48–80px
- Modal padding: 24px desktop, 20px mobile
- Board-to-panel: 20–32px
- Avoid arbitrary values unless board geometry requires them.

---

# 10. Grid and Layout

## 10.1 Maximum Width

Standard:

```css
max-width: 1440px;
```

Analysis-heavy screens may use:

```css
max-width: 1600px;
```

## 10.2 Grid

Desktop:

- 12 columns
- 24px gutters
- 32px outer margins

Tablet:

- 8 columns
- 20px gutters
- 24px outer margins

Mobile:

- 4 columns
- 16px gutters
- 16px outer margins

## 10.3 Gameplay Ratio

Desktop target:

- Board area: 55–65%
- Supporting panels: 35–45%

The board must remain visually dominant.

---

# 11. Shape and Radius

| Token | Value | Usage |
|---|---:|---|
| `radius-xs` | 4px | Tiny indicators |
| `radius-sm` | 8px | Inputs, chips |
| `radius-md` | 12px | Buttons, compact cards |
| `radius-lg` | 16px | Standard cards |
| `radius-xl` | 22px | Dialogs, major panels |
| `radius-pill` | 999px | Status pills only |

Rules:

- Board outer radius: 10–16px
- Primary buttons: `radius-md`
- Cards: `radius-lg`
- Dialogs: `radius-xl`
- Avoid universal pill styling.
- Avoid repeating large radii in nested components.

---

# 12. Borders and Elevation

## 12.1 Border Tokens

```css
--border-width-default: 1px;
--border-width-strong: 2px;
--border-color-subtle: #2A3138;
--border-color-strong: #3C454E;
```

Use borders for structure, not decoration. Cards may use either a border or elevation; they do not always need both.

## 12.2 Shadows

```css
--shadow-xs: 0 1px 2px rgba(0, 0, 0, 0.20);
--shadow-sm: 0 4px 12px rgba(0, 0, 0, 0.24);
--shadow-md: 0 10px 30px rgba(0, 0, 0, 0.30);
--shadow-lg: 0 22px 60px rgba(0, 0, 0, 0.38);
--shadow-board: 0 18px 44px rgba(0, 0, 0, 0.34);
```

Elevation levels:

| Level | Usage |
|---|---|
| 0 | App background |
| 1 | Standard surface |
| 2 | Raised card |
| 3 | Sticky panel, dropdown |
| 4 | Dialog, sheet |
| 5 | Dragged piece, critical overlay |

Rules:

- Avoid colored shadows.
- Avoid accent glows.
- Use stronger elevation only for temporary floating elements.

---

# 13. Transparency and Blur

Allowed uses:

- Modal backdrop
- Compact floating board controls
- Tooltip surface
- Sticky top bar over content

Recommended pattern:

```css
backdrop-filter: blur(12px);
background: rgba(16, 19, 22, 0.82);
```

Do not construct the entire interface from translucent panels.

---

# 14. Iconography

Recommended library: **Lucide**

Rules:

- Default size: 18–20px
- Compact: 16px
- Prominent action: 22–24px
- Stroke width: 1.75–2
- Icons support labels; they do not replace unclear actions
- Destructive icons include text where context is ambiguous
- Do not mix icon families
- Do not use emoji as UI icons

---

# 15. Illustration and Imagery

Preferred:

- Abstract board geometry
- Cropped board details
- Strategic line motifs
- Calm editorial chess photography
- Minimal AI probability diagrams
- Thoughtful human interaction moments

Avoid:

- Robot heads
- Brain icons
- Neon circuitry
- Futuristic holograms
- Medieval kings
- Fire and lightning
- Generic AI sparkles
- Generic business stock photography

Decorative motifs may use board-grid fragments, move-path lines, notation marks, square framing, and quiet probability fields.

---

# 16. Motion System

## 16.1 Principles

Motion communicates cause, direction, continuity, hierarchy, and completion. It should feel controlled and confident.

## 16.2 Duration Tokens

| Token | Value | Usage |
|---|---:|---|
| `motion-instant` | 80ms | Press feedback |
| `motion-fast` | 140ms | Hover, selection |
| `motion-standard` | 220ms | Piece movement, controls |
| `motion-slow` | 320ms | Drawer, modal |
| `motion-emphasis` | 450ms | Result transition |

## 16.3 Easing

```css
--ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
--ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
--ease-exit: cubic-bezier(0.7, 0, 0.84, 0);
--ease-piece: cubic-bezier(0.22, 1, 0.36, 1);
```

## 16.4 Chess Motion

- Piece move: 140–220ms
- Invalid return: 160ms
- Board flip: 280–360ms
- Promotion chooser: 180–240ms
- Capture fade: coordinated with move
- Check: one controlled pulse
- AI delay: functional, not decorative

## 16.5 Reduced Motion

Reduced motion should remove decorative transitions, board rotation animation, pulses, and celebratory effects while preserving essential state feedback.

---

# 17. Component Architecture

Every reusable component should define applicable states:

- Default
- Hover
- Focus
- Active
- Selected
- Disabled
- Loading
- Error

---

# 18. Buttons

Variants:

- Primary
- Secondary
- Ghost
- Destructive

Primary is reserved for one main action per section.

| Size | Height | Horizontal Padding |
|---|---:|---:|
| Small | 36px | 12px |
| Medium | 44px | 16px |
| Large | 52px | 22px |

Rules:

- Labels begin with clear verbs.
- Do not place two primary buttons side by side.
- Loading preserves width.
- Icon-only buttons require accessible names.
- Disabled styling must not rely only on opacity.

---

# 19. Inputs and Selection Controls

## 19.1 Inputs

Heights:

- Compact: 38px
- Default: 44px
- Large: 52px

Style:

- Raised surface
- Subtle border
- Verdigris focus border and ring
- Visible label
- Actionable error message

Placeholder is not a replacement for a label.

## 19.2 Segmented Controls

Use for:

- Player color
- Difficulty
- Review mode
- Theme
- Side selection

Rules:

- 2–5 options
- Selected state uses more than color
- Keyboard arrows navigate
- Mobile labels remain readable

---

# 20. Cards

Variants:

- Standard
- Interactive
- Editorial
- Critical Moment

Rules:

- Avoid excessive nesting.
- Interactive cards require hover and focus.
- Editorial cards may use serif headings.
- Not all cards should have equal weight.
- Prefer spacing over excessive dividers.

---

# 21. Navigation

Desktop:

- Compact top navigation
- Product name left
- Primary destinations center or left
- Utilities right
- Play may receive restrained emphasis

Mobile:

- Bottom navigation for major destinations
- Drawer for secondary destinations
- Compact top bar during gameplay

Active navigation may use accent text, a subtle background, and an indicator. Do not turn every item into a large pill.

---

# 22. Dialogs, Sheets, Tooltips, and Toasts

## Dialogs

Use for destructive confirmation, critical error, and compact result presentation.

## Sheets

Use for mobile move history, in-game settings, analysis details, and promotion fallback.

## Tooltips

Use for icon-only controls, engine status, notation, and AI information. Essential content must never exist only in a tooltip.

## Toasts

Use for preference saved, game restored, PGN copied, export complete, and temporary engine status.

Toast rules:

- Non-blocking
- Short
- Maximum two visible
- Persist when user action is required

---

# 23. Chess Clock Component

Required states:

- Inactive
- Active
- Low time
- Critical time
- Paused
- Expired

Rules:

- Use tabular numerals.
- Active state must not rely on color only.
- Avoid continuous flashing.
- Associate each clock clearly with its player.

---

# 24. Player Identity Component

May contain:

- Display name
- Opponent type
- Approximate strength
- Side
- Clock
- AI thinking state
- Captured material

It should feel like participant identity, not a dense profile card.

---

# 25. Move History

Visual model:

- Move number
- White move
- Black move
- Current move highlight
- Scroll position
- Review navigation

Rules:

- Monospace may be used for notation.
- Current move must be clear.
- Selected move must not look like a CTA.
- Auto-scroll should be smooth but restrained.

---

# 26. Evaluation Bar

Not shown during standard play.

Used in:

- Analysis
- Guided assisted mode
- Advanced review

Rules:

- Equal position is visually neutral.
- Advantage direction is labeled.
- Text alternative is available.
- Raw value is optional.
- Mate is distinct.
- Avoid dramatic red-versus-green treatment.

---

# 27. Review Components

## 27.1 Critical Moment Card

Contains:

- Move number
- Classification
- Explanation
- Better move
- Optional short variation
- Try Move action

## 27.2 Key Lesson Card

Style:

- Editorial
- Calm
- May use a slight bronze accent
- No large warning icon

## 27.3 Move Classifications

| Classification | Treatment |
|---|---|
| Best | Verdigris |
| Strong | Muted verdigris |
| Good | Neutral positive |
| Inaccuracy | Warm sand |
| Mistake | Amber |
| Blunder | Muted red |
| Forced | Cool neutral |
| Missed opportunity | Bronze |

Labels must not overwhelm explanations.

---

# 28. Charts and Data Visualization

Evaluation graph requirements:

- Visible zero line
- White and Black advantage labels
- Current move marker
- Critical moment markers
- Accessible tooltips
- No decorative gradients

Preferred chart types:

- Line
- Bar
- Compact distribution

Avoid:

- 3D charts
- Dense pie charts
- Excessive color coding
- Long decorative chart animations

---

# 29. Empty, Loading, and Error States

## Empty State Structure

1. Clear title
2. Brief explanation
3. One relevant action
4. Optional quiet illustration

## Loading

- Keep layout stable.
- Use skeletons only where shape is known.
- Show meaningful status text.
- Avoid generic spinners as the sole long-task indicator.

## Error

Explain:

- What happened
- Whether data is safe
- What the user can do

Errors should be calm and actionable.

---

# 30. Accessibility

## 30.1 Contrast Targets

- 4.5:1 for normal text
- 3:1 for large text
- 3:1 for interactive boundaries where applicable
- Target WCAG 2.2 AA

All final combinations must be tested.

## 30.2 Focus Ring

```css
outline: 2px solid #9ED4C6;
outline-offset: 3px;
```

## 30.3 Colorblind Safety

Use shape, pattern, outline, or text alongside color for:

- Legal moves
- Captures
- Check
- Active clock
- Move classification
- Errors

## 30.4 Touch Target

Recommended minimum:

```text
44 × 44 px
```

---

# 31. Responsive Rules

## Buttons

- Full-width only when context benefits.
- Preserve 44px touch height on mobile.

## Cards

- Stack on mobile.
- Preserve internal hierarchy.

## Dialogs

- Centered on desktop.
- Bottom sheet or wide card on mobile.
- Respect safe areas.

## Board

- Use maximum safe width.
- Preserve square aspect ratio.
- Never introduce horizontal page scrolling.
- Collapse secondary panels before shrinking the board excessively.

## Breakpoint Guidance

```css
--breakpoint-sm: 640px;
--breakpoint-md: 768px;
--breakpoint-lg: 1024px;
--breakpoint-xl: 1280px;
--breakpoint-2xl: 1536px;
```

Component behavior should respond to content pressure rather than device labels alone.

---

# 32. Design Tokens

Use semantic names inside components.

Preferred:

```css
var(--color-text-primary)
```

Avoid direct palette usage such as:

```css
var(--ivory-50)
```

Token categories:

- `color-*`
- `space-*`
- `radius-*`
- `shadow-*`
- `font-*`
- `text-*`
- `motion-*`
- `z-*`
- `size-*`

## 32.1 Z-Index Scale

| Token | Value | Usage |
|---|---:|---|
| `z-base` | 0 | Normal content |
| `z-sticky` | 20 | Sticky header |
| `z-dropdown` | 40 | Dropdown |
| `z-overlay` | 60 | Backdrop |
| `z-dialog` | 80 | Dialog |
| `z-toast` | 100 | Toast |
| `z-drag` | 120 | Dragged piece |

Avoid arbitrary z-index values.

## 32.2 CSS Variable Foundation

```css
:root {
  --font-display: "Source Serif 4", Georgia, serif;
  --font-ui: "Manrope", Inter, system-ui, sans-serif;
  --font-mono: "JetBrains Mono", Consolas, monospace;

  --space-1: 0.25rem;
  --space-2: 0.5rem;
  --space-3: 0.75rem;
  --space-4: 1rem;
  --space-6: 1.5rem;
  --space-8: 2rem;
  --space-12: 3rem;
  --space-16: 4rem;

  --radius-sm: 0.5rem;
  --radius-md: 0.75rem;
  --radius-lg: 1rem;
  --radius-xl: 1.375rem;

  --motion-fast: 140ms;
  --motion-standard: 220ms;
  --motion-slow: 320ms;

  --ease-standard: cubic-bezier(0.2, 0.8, 0.2, 1);
  --ease-enter: cubic-bezier(0.16, 1, 0.3, 1);
  --ease-piece: cubic-bezier(0.22, 1, 0.36, 1);
}
```

---

# 33. Tailwind Integration Direction

Recommended approach:

- Map semantic CSS variables into Tailwind tokens.
- Do not scatter literal hex values through JSX.
- Avoid arbitrary values except for rare geometry.
- Centralize component variants.
- Use one consistent class-composition utility.
- Preserve semantic state names.

Conceptual mapping:

```ts
colors: {
  background: "var(--color-bg-app)",
  surface: "var(--color-bg-surface)",
  raised: "var(--color-bg-raised)",
  text: {
    primary: "var(--color-text-primary)",
    secondary: "var(--color-text-secondary)",
    muted: "var(--color-text-muted)",
  },
  accent: {
    DEFAULT: "var(--color-accent)",
    hover: "var(--color-accent-hover)",
    pressed: "var(--color-accent-pressed)",
  },
}
```

---

# 34. Component Documentation Requirements

Every reusable component should document:

- Purpose
- Variants
- Sizes
- States
- Props
- Accessibility behavior
- Keyboard behavior
- Responsive behavior
- Loading behavior
- Error behavior
- Usage examples
- Anti-patterns

Storybook is recommended after the component system becomes stable, but is not mandatory for the first prototype.

---

# 35. Codex Design Rules

Codex-generated UI must follow these rules:

1. Do not invent colors outside approved tokens.
2. Do not use gradients unless explicitly approved.
3. Do not use neon cyan, bright gaming green, or unrelated accents.
4. Do not apply glassmorphism to every surface.
5. Do not use pill shapes for all controls.
6. Do not introduce a second icon library.
7. Do not use emoji as interface icons.
8. Do not add decorative AI imagery.
9. Do not use random shadows or arbitrary radii.
10. Do not reduce normal text below accessible sizes.
11. Do not hide essential actions behind hover.
12. Do not let secondary panels reduce board usability.
13. Do not make error states visually aggressive.
14. Do not present raw engine terminology as the default explanation.
15. Do not copy another chess platform’s visual design.
16. Do not use inline style literals when a token exists.
17. Do not add components that lack focus, disabled, loading, and error behavior where applicable.
18. Do not ship a board theme without piece-contrast testing.

---

# 36. Design Review Checklist

Before approving a screen, verify:

## Hierarchy

- Is the primary task obvious?
- Is the board dominant where required?
- Is there one clear primary action?

## Consistency

- Are approved tokens used?
- Are component variants reused?
- Are spacing and radii consistent?

## Accessibility

- Is contrast sufficient?
- Is focus visible?
- Does it work without hover?
- Is color supplemented by another cue?

## Responsiveness

- Does it work on mobile?
- Does the board retain usable size?
- Do dialogs and sheets behave correctly?

## Brand

- Does it feel calm and intelligent?
- Is it restrained?
- Does it avoid generic AI aesthetics?

## Content

- Is wording clear and human?
- Is technical information progressively disclosed?
- Are errors actionable?

---

# 37. Launch Design Deliverables

Before implementation begins, the design phase should produce:

1. Brand wordmark exploration
2. Dark theme token sheet
3. Light theme direction
4. Default chessboard theme
5. Launch piece set
6. Desktop game screen
7. Mobile game screen
8. Game setup
9. Result state
10. Guided review
11. Advanced analysis
12. Settings
13. History
14. Empty states
15. Engine loading and error states
16. Core component library
17. Responsive annotations
18. Accessibility annotations
19. Motion reference
20. Developer handoff notes

---

# 38. Locked Design Decisions

The following are approved:

1. Caissa is dark-first.
2. Warm neutrals are central to the identity.
3. Verdigris is the primary accent.
4. Bronze is a rare editorial accent.
5. Caissa Classic is the default board theme.
6. The product avoids neon and generic AI aesthetics.
7. Source Serif 4 is the preferred display typeface.
8. Manrope is the preferred interface typeface.
9. JetBrains Mono is reserved for notation and technical content.
10. The board is the strongest visual object during gameplay.
11. Motion is restrained and purposeful.
12. Cards use moderate radii rather than universal pill styling.
13. Heavy gradients are not part of the launch system.
14. Live evaluation is visually secondary and off by default.
15. Human explanation outranks raw engine output.

---

# 39. Open Design Decisions

Resolve during visual design:

1. Final wordmark treatment
2. Final SVG piece set
3. Whether the brand mark uses a chess motif
4. Final light-theme launch scope
5. Exact board coordinate style
6. Exact colorblind board alternative
7. Whether result screens include optional celebration
8. Final chart library styling
9. Whether serif is used for headings only or selected editorial body
10. Whether compact mode ships in v1.0

---

# 40. Definition of Done

The design system is implementation-ready when:

- Semantic tokens are finalized.
- Dark theme passes contrast testing.
- Default board passes piece-contrast testing.
- Core components have complete states.
- Desktop and mobile gameplay screens are approved.
- Reduced-motion behavior is documented.
- Keyboard focus styling is approved.
- Error, loading, and empty states are designed.
- Review components support guided and advanced layers.
- Codex implementation rules are included in the repository.
- No launch screen depends on an undefined visual decision.

---

# 41. Final Design Direction

Caissa should look as though every detail was considered, but nothing was added merely to prove that it was designed.

Its visual language should support the same belief as the product itself:

> Intelligence is most powerful when it is clear, calm, and human.

The design should not ask users to admire the interface instead of playing chess. It should make playing, reflecting, and learning feel effortless.
