/**
 * Where a spreadsheet comes from.
 *
 * The import screen never touches expo-document-picker itself: this seam is
 * wired to the phone at the entry point, and tests wire one that keeps the
 * "file" in memory. That is what lets a screen test pick a sheet and preview it
 * without a real disk.
 */
export interface ImportFile {
  name: string;
  text: string;
}

export interface ImportFiles {
  /** Asks the phone for a spreadsheet. Null when the owner backs out. */
  pick(): Promise<ImportFile | null>;
}

/** Until the app entry wires the phone, picking refuses out loud. */
export const importFiles: { current: ImportFiles } = {
  current: {
    pick: async () => {
      throw new Error('Pemilih berkas belum disambungkan.');
    },
  },
};

/** Point the app at a phone's files. Only the app entry and the tests call this. */
export function connectImportFiles(next: ImportFiles): void {
  importFiles.current = next;
}
