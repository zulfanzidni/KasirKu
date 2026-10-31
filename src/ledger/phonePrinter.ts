/**
 * The phone's printer: expo-print writes the PDF, expo-sharing hands it to the
 * share sheet. This file is the only place either module is imported, so
 * everything above it talks to a `Printer` the tests can replace.
 */

import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import type { Printer } from './types';

export const phonePrinter: Printer = {
  async printToFile(html) {
    const { uri } = await Print.printToFileAsync({ html, base64: false });
    return { uri };
  },

  async canShare() {
    return Sharing.isAvailableAsync();
  },

  async share(uri, mimeType) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Ponsel ini tidak bisa membagikan berkas.');
    }
    // The share sheet is also where "save to phone" lives on Android, which is
    // why one action covers both of story 21's verbs.
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Bagikan nota' });
  },
};
