import type { TextStyle } from 'react-native';

/**
 * Nota — design tokens.
 *
 * Single source of truth for every colour, type size, spacing and shape value
 * in the app. Nothing outside this folder may declare a raw hex value, a font
 * size, or a spacing number, except a component's own layout arithmetic.
 *
 * Read DESIGN.md before changing anything here.
 */

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

/**
 * The six colours of the world, exposed as Material 3 colour roles so a future
 * dynamic-colour or dark theme resolves through the same keys rather than
 * through raw hex at the call site.
 */
export const colors = {
  primary: '#1F3A6E',
  onPrimary: '#FDFBF6',
  primaryContainer: '#E7EAE3',
  onPrimaryContainer: '#1F3A6E',

  surface: '#F7F3EA',
  onSurface: '#2F2A24',
  surfaceContainerLowest: '#FDFBF6',
  onSurfaceVariant: '#8A7F6D',

  outline: '#DED5C4',
  outlineVariant: '#DED5C4',

  error: '#A8231F',
  onError: '#FDFBF6',

  disabled: '#E3DCCD',
  disabledContent: '#A69C8B',

  scrim: 'rgba(47, 42, 36, 0.40)',
} as const;

export type ColorToken = keyof typeof colors;

// ---------------------------------------------------------------------------
// Typography
// ---------------------------------------------------------------------------

export const fontFamily = {
  /** A ballpoint's hand. Headings and totals ONLY. */
  pen: 'Kalam_700Bold',
  penRegular: 'Kalam_400Regular',
  /** Everything read under pressure. */
  print: 'PlexSans_400Regular',
  printMedium: 'PlexSans_500Medium',
  printSemibold: 'PlexSans_600SemiBold',
} as const;

const tabular: TextStyle['fontVariant'] = ['tabular-nums'];

/**
 * Material 3 type roles. `fontSize` values are device-independent points that
 * follow the system font scale — Android's `sp`. Never multiply these by a
 * density factor by hand.
 */
export const typography = {
  displayLarge: {
    fontFamily: fontFamily.pen,
    fontSize: 44,
    lineHeight: 58,
    letterSpacing: -0.5,
    fontVariant: tabular,
  },
  headlineSmall: {
    fontFamily: fontFamily.pen,
    fontSize: 24,
    lineHeight: 34,
    letterSpacing: -0.2,
    fontVariant: tabular,
  },
  titleMedium: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
  },
  bodyLarge: {
    fontFamily: fontFamily.print,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0,
  },
  bodyMedium: {
    fontFamily: fontFamily.print,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
  },
  labelLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.1,
  },
  labelSmall: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 11,
    lineHeight: 16,
    letterSpacing: 1.32,
    textTransform: 'uppercase' as const,
  },
  numericLarge: {
    fontFamily: fontFamily.printSemibold,
    fontSize: 20,
    lineHeight: 24,
    letterSpacing: 0,
    fontVariant: tabular,
  },
  numericMedium: {
    fontFamily: fontFamily.printMedium,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
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
  /** Height of a ruled row. Tall enough for a thumb, tight enough to fit eight. */
  row: 46,
  /** Minimum touch target, per Material and DESIGN.md. */
  touch: 48,
} as const;

// ---------------------------------------------------------------------------
// Shape
// ---------------------------------------------------------------------------

/** A notebook corner, not a pill. */
export const shape = {
  none: 0,
  sm: 4,
  md: 4,
  lg: 4,
  /** Bottom-sheet top corners only. */
  sheetTop: 16,
  full: 999,
} as const;

export const borderWidth = {
  hairline: 1,
  /** The accountant's double rule above a total. */
  rule: 3,
  focus: 2,
} as const;

// ---------------------------------------------------------------------------
// Motion
// ---------------------------------------------------------------------------

/**
 * Quiet and quick. State changes are steps, never eases that draw attention.
 * `savingSale` is the one authored moment: the notebook page turning.
 */
export const motion = {
  /** Row appearing in the cart. */
  step: 90,
  /** Screen fades. */
  screen: 200,
  /** The one authored moment. */
  savingSale: 180,
} as const;

// ---------------------------------------------------------------------------
// Elevation — tonal plus one soft shadow
// ---------------------------------------------------------------------------

export const elevation = {
  none: {
    shadowColor: 'transparent',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  /** Sticky totals and floating cart sections. */
  raised: {
    shadowColor: colors.onSurface,
    shadowOpacity: 0.06,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: -2 },
    elevation: 2,
  },
  /** Bottom sheets and dialogs. */
  overlay: {
    shadowColor: colors.onSurface,
    shadowOpacity: 0.12,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: -4 },
    elevation: 6,
  },
} as const;
