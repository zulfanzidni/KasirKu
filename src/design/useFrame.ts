import { useWindowDimensions } from 'react-native';
import { layout } from './tokens';

export interface Frame {
  /** True at or above the width where navigation becomes a rail and panes open. */
  wide: boolean;
  width: number;
  height: number;
}

/**
 * The app's one answer to "is this frame wide?".
 *
 * Screens read this rather than `useWindowDimensions` directly, so a screen
 * cannot invent its own breakpoint and drift from the rail, from Kasir's two
 * panes, or from every other screen that splits in landscape.
 */
export function useFrame(): Frame {
  const { width, height } = useWindowDimensions();
  return { wide: width >= layout.wide, width, height };
}
