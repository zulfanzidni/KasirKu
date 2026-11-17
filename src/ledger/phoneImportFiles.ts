/**
 * The phone's spreadsheet picker: expo-document-picker reads the file the owner
 * chooses, and nothing above this file imports that module.
 */
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import type { ImportFiles } from './importFiles';

/** What a spreadsheet can arrive as on Android. */
const SHEET_TYPES = ['text/csv', 'text/comma-separated-values', 'text/tab-separated-values', 'text/plain'];

export const phoneImportFiles: ImportFiles = {
  async pick() {
    const result = await DocumentPicker.getDocumentAsync({ type: SHEET_TYPES, copyToCacheDirectory: true });
    if (result.canceled) return null;
    const asset = result.assets[0];
    return { name: asset.name, text: await new File(asset.uri).text() };
  },
};
