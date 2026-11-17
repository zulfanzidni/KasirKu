/**
 * Where a backup file goes, and where it comes back from.
 *
 * The app never imports a file API itself: this seam is wired to the phone at
 * the entry point, and tests wire one that keeps the "files" in memory. That is
 * what lets a screen test save a backup and import it again without touching a
 * real disk.
 */
export interface SavedFile {
  name: string;
  uri: string;
}

export interface PickedFile {
  name: string;
  text: string;
}

export interface BackupFiles {
  /** Writes the text to a file the owner can keep and returns where it landed. */
  save(text: string, name: string): Promise<SavedFile>;
  /** Asks the phone for a backup file. Null when the owner backs out. */
  pick(): Promise<PickedFile | null>;
  /** Whether this phone can hand a file to the share sheet at all. */
  canShare(): Promise<boolean>;
  /** Hands the file to Android's own share sheet, where "save" lives too. */
  share(uri: string, mimeType: string): Promise<void>;
}

/**
 * Until the app entry wires the phone, backing up refuses out loud rather than
 * pretending a file exists.
 */
export const backupFiles: { current: BackupFiles } = {
  current: {
    save: async () => {
      throw new Error('Penyimpanan berkas belum disambungkan.');
    },
    pick: async () => {
      throw new Error('Penyimpanan berkas belum disambungkan.');
    },
    canShare: async () => false,
    share: async () => {
      throw new Error('Penyimpanan berkas belum disambungkan.');
    },
  },
};

/** Point the app at a phone's files. Only the app entry and the tests call this. */
export function connectBackupFiles(next: BackupFiles): void {
  backupFiles.current = next;
}
