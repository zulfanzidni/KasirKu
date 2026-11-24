import type { TextStyle } from 'react-native';

/**
 * Boose — design tokens.
 *
 * Single source of truth for every colour, type size, spacing and shape value
 * in the app. Nothing outside this folder may declare a raw hex value, a font
 * size, or a spacing number, except a component's own layout arithmetic.
 *
 * Read DESIGN.md before changing anything here.
 *
 * Every screen reads these roles, never a value, so this file is the whole
 * visual world: change the tokens and all fifteen screens change with them.
 *
 * The world is Boose (the Sado Brew admin in `UI.figcraft`): white cards on a
 * cool ground, one blue that means "do this", and money that reads as money.
 * The typeface stays IBM Plex Sans — Boose sets Nunito, which has no tabular
 * figures, and a till is mostly numbers in columns.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * A cool ground, white cards, one blue, one near-black ink. Red is not an
 * accent: it is money someone still owes or money leaving the drawer. Teal is
 * money arriving, never an action.
 *
 * Exposed as Material 3 colour roles so a future dark theme resolves through
 * the same keys rather than through raw hex at the call site.
 */
export const colors = {
  /** Every primary action, the total block, the active tab. */
  primary: '#007AFF',
  onPrimary: '#FFFFFF',
  /** Active-tab pill, quiet selected rows, an icon tint. */
  primaryContainer: '#E6F0FF',
  onPrimaryContainer: '#0B1220',

  /** The counter the app sits on. */
  surface: '#F1F5F9',
  onSurface: '#0B1220',
  /** Panels and lists: a sheet laid on the counter. */
  surfaceContainerLowest: '#FFFFFF',
  /** Labels, units, timestamps. 4.8:1 on a panel, 4.6:1 on the counter. */
  onSurfaceVariant: '#64748B',

  outline: '#E2E8F0',
  outlineVariant: '#EFF3F8',

  /** Money arriving: kembalian, uang masuk, a lunas row. Never an action. */
  positive: '#00C9B1',
  /** The wash behind a word like `tunai` or `lunas`. Never a filled control. */
  positiveContainer: 'rgba(0, 201, 177, 0.12)',

  /** Only money still owed, negative stock, expenses, and a destructive confirm. */
  error: '#FF5555',
  onError: '#FFFFFF',
  /** The wash behind a word like `tempo` or `batal`. */
  errorContainer: 'rgba(255, 85, 85, 0.12)',

  /**
   * The well a tile's photograph sits in. Nothing in v1 fills it: a tile is a
   * target, and the well is the shape a picture will take.
   */
  imageWell: '#DDE5EE',

  disabled: '#EFF3F8',
  disabledContent: '#94A3B8',

  scrim: 'rgba(11, 18, 32, 0.40)',
} as const;

export type ColorToken = keyof typeof colors;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

/**
 * One voice. The till is an instrument, and an instrument has one legible face:
 * IBM Plex Sans. It carries real tabular figures, which is what a column of
 * rupiah needs. There is no second, decorative face in the app.
 *
 * Boose sets Nunito; this app does not, because Nunito has no tabular figures
 * and a column of money that shimmers cannot be read at a glance. See
 * DESIGN.md §Why Plex and not Boose's Nunito.
 */
export const fontFamily = {
  print: 'PlexSans_400Regular',
  printMedium: 'PlexSans_500Medium',
  printSemibold: 'PlexSans_600SemiBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Material 3 type roles, sized for a counter rather than a desk. `fontSize`
 * values are device-independent points that follow the system font scale —
 * Android's `sp`. Never multiply these by a density factor by hand.
 */
export const typography = {
  /** The total in its window. Appears once per screen, and only for money. */
  displayLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 34,
    lineHeight: 38,
    letterSpacing: -0.5,
    fontVariant: tabular,
  },
  headlineSmall: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 28,
    lineHeight: 34,
    letterSpacing: -0.4,
    fontVariant: tabular,
  },
  /** A stat's figure, a large card number. */
  headlineMedium: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.3,
    fontVariant: tabular,
  },
  /** A figure that leads a screen. */
  headlineLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 26,
    lineHeight: 32,
    letterSpacing: -0.4,
    fontVariant: tabular,
  },
  titleMedium: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0,
  },
  /** A card's own title, and the shop's name in the header. */
  titleLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 16,
    lineHeight: 20,
    letterSpacing: 0,
  },
  /** An item's name in a tile or a row: the default name size. */
  titleSmall: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 14,
    lineHeight: 18,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontFamily: fontFamily.print,
    fontSize: 15,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: fontFamily.print,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  /** Timestamps, units, a row's second line. */
  bodySmall: {
    fontFamily: fontFamily.print,
    fontSize: 12,
    lineHeight: 16,
    letterSpacing: 0,
  },
  labelLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 15,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  /** A chip, a small control's word. */
  labelMedium: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
  },
  /** The word under a navigation icon, and nowhere else. */
  tabLabel: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 11,
    lineHeight: 15,
    letterSpacing: 0,
  },
  labelSmall: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.1,
    textTransform: 'uppercase' as const,
  },
  /** A figure inside a small line: money or a quantity, never a heading. */
  numericSmall: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 0.2,
    fontVariant: tabular,
  },
  numericLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 17,
    lineHeight: 22,
    letterSpacing: 0,
    fontVariant: tabular,
  },
  numericMedium: {
    fontFamily: fontFamily.printMedium,
    fontSize: 13,
    lineHeight: 18,
    letterSpacing: 0,
    fontVariant: tabular,
  },
  /** A figure that stands alone in a card: the cart bar's total, a metric. */
  numericDisplay: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 22,
    lineHeight: 28,
    letterSpacing: -0.2,
    fontVariant: tabular,
  },
} as const;

export type TypeRole = keyof typeof typography;

// ---------------------------------------------------------------------------
// Spacing — 4dp base
// ---------------------------------------------------------------------------

export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  /** Screen edge gutter, both sides. */
  gutter: 20,
  /** Height of a list row. Tall enough for a thumb, tight enough to scan. */
  row: 48,
  /** Minimum touch target, per Material and DESIGN.md. */
  touch: 48,
} as const;

// ---------------------------------------------------------------------------
// Layout — how the frame reflows between portrait and landscape
// ---------------------------------------------------------------------------

/**
 * Material's window-size breakpoint. Under it the app is "compact" and keeps the
 * bottom bar; at or above it there is width to spare, so navigation moves to a
 * rail down the left edge and screens may use two panes.
 */
export const layout = {
  /** Width at which navigation becomes a rail and Kasir splits in two. */
  wide: 600,
  /** Rail width. Narrower than the old bottom bar is tall, which is the point. */
  rail: 72,
  /** The nota panel's fixed width in two-pane Kasir. */
  notaPanel: 320,
} as const;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/** A card corner, not a pill. Boose's generous rounding. */
export const shape = {
  none: 0,
  sm: 8,
  /** Buttons, inputs, small chips. */
  md: 12,
  /** Cards and tiles. */
  lg: 16,
  /** The receipt sheet. */
  xl: 20,
  /** Bottom-sheet top corners only. */
  sheetTop: 16,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  /** A section rule. Heavier than a row rule, lighter than a border. */
  rule: 3,
  focus: 2,
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Quiet and quick. State changes are steps, never eases that draw attention.
 * `savingSale` is the one authored moment: the total settling into the window.
 */
export const motion = {
  /** A tile joining the nota. */
  step: 90,
  /** Screen fades. */
  screen: 200,
  /** The one authored moment. */
  savingSale: 180,
} as const;

// ---------------------------------------------------------------------------
// Elevation — tonal plus one soft shadow
// ---------------------------------------------------------------------------

/**
 * Boose separates surfaces by lifting them, not by drawing lines. A card sits on
 * the ground with one soft shadow below it; a sheet that floats over content
 * gets a larger one.
 */
export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Every card and tile: the default surface. */
  raised: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.08,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  /** The search field and small controls that sit on a card. */
  subtle: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.06,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  /** Bottom sheets and dialogs. */
  overlay: {
    shadowColor: '#0F172A',
    shadowOpacity: 0.14,
    shadowRadius: 24,
    shadowOffset: { width: 0, height: -6 },
    elevation: 8,
  },
} as const;
