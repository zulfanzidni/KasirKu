import { Dimensions } from 'react-native';

/**
 * A real phone, not jest's default canvas.
 *
 * jsdom-less RN tests start at 750×1334, which is wider than any phone in
 * portrait and therefore "wide" by our own breakpoint: the till would render
 * its landscape two-pane layout in every test that never asked for a landscape.
 * 411×891 is the phone this app is built for. A test that wants the other shape
 * sets the size itself.
 */
Dimensions.set({
  window: { width: 411, height: 891, scale: 2.6, fontScale: 1 },
  screen: { width: 411, height: 891, scale: 2.6, fontScale: 1 },
});
