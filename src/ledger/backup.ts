/**
 * A backup file: the whole event log, the phone that wrote it, and the last
 * number that phone used.
 *
 * It is JSON rather than a copy of the SQLite file on purpose. The database is
 * only the events (ADR 0001), and the events are the one thing every phone can
 * read, so a backup stays portable and readable even if the storage engine
 * changes. `lastSeq` travels with it because a restored phone continues the
 * same stream: reusing a number would make two events claim to be one.
 */
import type { StoredEvent } from './store';

/** The mark that says a file is ours, so another JSON file is refused plainly. */
export const BACKUP_FORMAT = 'kasirku-cadangan';

/** Bumped only when the file stops being readable by an older app. */
export const BACKUP_VERSION = 1;

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  /** The phone that wrote the history; the restored app adopts it. */
  deviceId: string;
  /** The last `seq` this device used, so the next event continues the stream. */
  lastSeq: number;
  events: StoredEvent[];
}

/** A file that is not a backup of this app, or cannot be read. */
export class BackupError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BackupError';
  }
}

const NOT_OURS = 'Berkas ini bukan cadangan KasirKu.';

/** The bytes of a backup, indented so a person can open and read the file. */
export function serializeBackup(backup: BackupFile): string {
  return JSON.stringify(backup, null, 2);
}

/**
 * Reads a file the owner picked. It either yields a whole, trustworthy backup
 * or refuses with the reason: a half-read history is worse than no restore, so
 * every field that the phone will rely on is checked here, before anything is
 * replaced.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    throw new BackupError(NOT_OURS);
  }
  if (!isRecord(raw) || raw.format !== BACKUP_FORMAT) throw new BackupError(NOT_OURS);

  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) throw new BackupError(NOT_OURS);
  if (version > BACKUP_VERSION) {
    throw new BackupError('Cadangan ini dari versi KasirKu yang lebih baru. Perbarui aplikasi dulu.');
  }

  const { deviceId, lastSeq, events } = raw;
  if (typeof deviceId !== 'string' || deviceId.trim() === '') throw new BackupError(NOT_OURS);
  if (typeof lastSeq !== 'number' || !Number.isFinite(lastSeq) || lastSeq < 0) throw new BackupError(NOT_OURS);
  if (!Array.isArray(events) || !events.every(isStoredEvent)) throw new BackupError(NOT_OURS);

  // Two events with one id would make the restored log lie about what happened.
  const ids = new Set(events.map((event) => event.id));
  if (ids.size !== events.length) throw new BackupError(NOT_OURS);

  return { format: BACKUP_FORMAT, version, deviceId, lastSeq, events: events as StoredEvent[] };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/**
 * Whether a value carries a whole event envelope. Backups and the sync answer
 * both refuse anything less: an event with no id or no payload would poison the
 * fold, and a half-read history is worse than none.
 */
export function isStoredEvent(value: unknown): value is StoredEvent {
  if (!isRecord(value)) return false;
  return (
    typeof value.id === 'string' &&
    value.id !== '' &&
    typeof value.deviceId === 'string' &&
    value.deviceId !== '' &&
    typeof value.seq === 'number' &&
    Number.isInteger(value.seq) &&
    value.seq > 0 &&
    typeof value.createdAt === 'string' &&
    value.createdAt !== '' &&
    typeof value.type === 'string' &&
    value.type !== '' &&
    isRecord(value.payload)
  );
}
