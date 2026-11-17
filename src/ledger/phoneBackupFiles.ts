/**
 * The phone's files: expo-file-system writes the backup, expo-document-picker
 * fetches one back, expo-sharing hands it to Android's share sheet.
 *
 * This file is the only place those modules are imported, so everything above
 * it talks to a `BackupFiles` the tests can replace.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import type { BackupFiles } from './backupFiles';

const JSON_TYPE = 'application/json';

export const phoneBackupFiles: BackupFiles = {
  async save(text, name) {
    // The cache directory is always writable; the share sheet is what moves it
    // somewhere the owner chose, and the picker is what brings it back.
    const file = new File(Paths.cache, name);
    file.create({ overwrite: true });
    await file.write(text);
    return { name, uri: file.uri };
  },

  async pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: JSON_TYPE, copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { name: asset.name, text: await new File(asset.uri).text() };
  },

  async canShare() {
    return Sharing.isAvailableAsync();
  },

  async share(uri, mimeType) {
    if (!(await Sharing.isAvailableAsync())) {
      throw new Error('Ponsel ini tidak bisa membagikan berkas.');
    }
    await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Bagikan cadangan KasirKu' });
  },
};
