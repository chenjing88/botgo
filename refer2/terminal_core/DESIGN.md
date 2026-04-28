---
name: Terminal Core
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#3a3939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#b9ccb2'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#84967e'
  outline-variant: '#3b4b37'
  surface-tint: '#00e639'
  primary: '#ebffe2'
  on-primary: '#003907'
  primary-container: '#00ff41'
  on-primary-container: '#007117'
  inverse-primary: '#006e16'
  secondary: '#ffb77d'
  on-secondary: '#4d2600'
  secondary-container: '#fd8b00'
  on-secondary-container: '#603100'
  tertiary: '#fff8f4'
  on-tertiary: '#442b10'
  tertiary-container: '#ffd5ae'
  on-tertiary-container: '#7a5b3c'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#72ff70'
  primary-fixed-dim: '#00e639'
  on-primary-fixed: '#002203'
  on-primary-fixed-variant: '#00530e'
  secondary-fixed: '#ffdcc3'
  secondary-fixed-dim: '#ffb77d'
  on-secondary-fixed: '#2f1500'
  on-secondary-fixed-variant: '#6e3900'
  tertiary-fixed: '#ffdcbd'
  tertiary-fixed-dim: '#e7bf99'
  on-tertiary-fixed: '#2c1701'
  on-tertiary-fixed-variant: '#5d4124'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  headline-lg:
    fontFamily: Space Grotesk
    fontSize: 24px
    fontWeight: '700'
    lineHeight: 32px
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Space Grotesk
    fontSize: 18px
    fontWeight: '600'
    lineHeight: 24px
  body-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 18px
  code-md:
    fontFamily: monospace
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 22px
  label-caps:
    fontFamily: Space Grotesk
    fontSize: 11px
    fontWeight: '700'
    lineHeight: 16px
    letterSpacing: 0.1em
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 16px
  lg: 24px
  xl: 48px
  gutter: 16px
  container-max: 1200px
---

## Brand & Style

This design system is built on the utilitarian aesthetic of classic command-line interfaces. It prioritizes function, speed, and information density, stripping away decorative fluff in favor of raw data and structural clarity. The personality is technical, precise, and uncompromising, designed for users who value efficiency and deep-focus environments.

The design style is a hybrid of **Minimalism** and **Technical Brutalism**. It utilizes a strict adherence to a grid, high-contrast typography, and a limited color palette that mirrors the "green-screen" or "orange-amber" glow of vintage terminals, modernized for high-resolution displays. The emotional response is one of total control and professional competence.

## Colors

The color palette is strictly "Dark Mode" to preserve eye comfort and maintain the terminal atmosphere. 

*   **Backgrounds:** A near-pure black is used for the primary canvas to maximize contrast. Secondary surfaces use a slightly lifted grey to define structure without losing depth.
*   **Primary Accents:** Neon Green (The "Matrix" standard) is used for success states, prompts, and active command lines.
*   **Secondary Accents:** Burnt Orange is utilized for warnings, secondary indicators, and specific data highlights to differentiate from the primary flow.
*   **Functional Colors:** White is the default for standard information. Muted greys are reserved for metadata, timestamps, and inactive text to create a hierarchy of relevance.

## Typography

While **Space Grotesk** provides a technical, geometric edge for headlines and labels, the core of the design system relies on a **monospaced font stack** (system-default monospace) for all data-heavy content.

*   **Headlines:** Used sparingly to define major modules or sections.
*   **Body Content:** All primary interaction points and data streams must use a monospaced font to maintain alignment and the CLI aesthetic. 
*   **Labels:** Small caps and increased letter spacing should be used for status indicators and metadata tags.
*   **Styling:** Bold weights are used for user-inputted commands, while regular weights are used for system-generated responses.

## Layout & Spacing

The layout follows a **Fixed Grid** philosophy, simulating the character-grid of a terminal. All spacing is derived from a 4px base unit to ensure alignment with monospaced character widths.

*   **Flow:** Vertical scrolling is the primary interaction model. Information is stacked chronologically or by priority in a single-column flow, though secondary technical panels can be pinned to the right.
*   **Density:** Spacing is tight to maximize the amount of information visible at once. Margins between data lines are minimal (4px to 8px).
*   **Margins:** Large external margins (48px+) are used only at the top level to focus the eye on the central "command column."

## Elevation & Depth

In keeping with the CLI aesthetic, traditional shadows are strictly forbidden. Depth is communicated through:

*   **Bold Borders:** Subtle 1px lines in low-contrast grey define different zones of the interface.
*   **Tonal Layers:** Using background color shifts (e.g., a dark grey surface over a black background) to denote active focus areas or tooltips.
*   **Inversion:** For high-priority focus, text and background colors are inverted (e.g., black text on a green background) rather than using shadows.
*   **Ascii-Style Framing:** Box-drawing characters or CSS equivalents are used to "frame" content blocks, mimicking legacy terminal windowing.

## Shapes

The design system uses a **Sharp (0px)** roundedness philosophy. 

Every element—buttons, input fields, containers, and badges—must have 90-degree corners. This reinforces the technical, brutalist nature of the system and ensures alignment with the rigid grid. The only exception is for circular status indicators (pills) where required by universal convention, though even these should ideally be represented by square blocks or ASCII characters (e.g., `[ ]` vs `( )`).

## Components

*   **Buttons:** Rectangular with a 1px border. The hover state should result in a full-color fill of the border color with inverted text.
*   **Input Fields:** Styled as a command prompt (`>`). A blinking cursor block (primary color) indicates focus. No background fill; just a bottom border or simple prefix.
*   **Chips/Tags:** Represented as text within brackets, e.g., `[STATUS:OK]`. Use the accent colors for the text inside.
*   **Lists:** Items are prefixed with bullets or numbers, e.g., `01.` or `*`. Hovering over a list item should highlight the entire line with a subtle background tint.
*   **Cards:** Minimal containers with a 1px border and a title bar that includes a "header" label in the top-left corner, often interrupting the border line itself.
*   **Scrollbars:** Ultra-thin, non-rounded tracks and thumbs. The thumb should be a solid block of the primary accent color.
*   **Progress Bars:** Represented as a series of blocks `[██████░░░░]` to maintain the terminal visual language.