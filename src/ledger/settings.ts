/**
 * The shop's settings, written as events (spec §The event log: settings.updated).
 *
 * They are part of the record, not of the phone: the second phone and a
 * restored backup have to print the same nota, and a setting kept only on one
 * phone would quietly disagree. Validation lives here rather than in the form,
 * so no screen can save a nota with no shop name on it.
 */

import type { ReceiptShop } from './receipt';

/** What the settings form can change. */
export interface SettingsInput {
  header: { nama: string; keterangan: string };
  footer: string;
}

export interface Settings {
  /** Writes one `settings.updated`. Returns the event's id. */
  updateReceipt(input: SettingsInput): Promise<string>;
}

export class SettingsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'SettingsError';
  }
}

/** Trims what the owner typed, and refuses the one thing a nota cannot be without. */
export function normaliseSettings(input: SettingsInput): ReceiptShop {
  const nama = input.header.nama.trim();
  if (!nama) throw new SettingsError('Nama toko wajib diisi.');
  return {
    header: { nama, keterangan: input.header.keterangan.trim() },
    footer: input.footer.trim(),
  };
}

export function createSettings(append: (type: string, payload: unknown) => Promise<string>): Settings {
  return {
    async updateReceipt(input) {
      return append('settings.updated', { receipt: normaliseSettings(input) });
    },
  };
}
