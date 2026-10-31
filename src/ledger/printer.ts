import type { Printer } from './types';

/**
 * The phone's printer, connected the same way as its database: the app entry
 * wires the real one, and the tests wire one that records the paper.
 *
 * Until it is connected, printing refuses out loud rather than silently handing
 * the customer nothing.
 */
export const printer: { current: Printer } = {
  current: {
    print: async () => {
      throw new Error('Pencetak nota belum disambungkan.');
    },
    share: async () => {},
    canShare: async () => false,
  },
};

/** Point the app at a printer. Only the app entry and the tests call this. */
export function connectPrinter(next: Printer): void {
  printer.current = next;
}
