/**
 * Dates as the shop writes them.
 *
 * One formatter, so the same moment never reads two ways on two screens. Local
 * time, as the phone knows it: a nota is dated by the day the shop lived, not by
 * UTC.
 */

/**
 * A moment as the shop writes it: `17/11/2026 14.20`.
 *
 * `withYear: false` gives the short form the history lists use — `17/11 14.20` —
 * where the year would be noise in a row that is already dated by its place in
 * the list.
 */
export function formatMoment(at: string, options: { withYear?: boolean } = {}): string {
  const moment = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  const day = `${pad(moment.getDate())}/${pad(moment.getMonth() + 1)}`;
  const time = `${pad(moment.getHours())}.${pad(moment.getMinutes())}`;
  return options.withYear === false ? `${day} ${time}` : `${day}/${moment.getFullYear()} ${time}`;
}

const HARI = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'] as const;
const BULAN = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'] as const;

/**
 * The day the way a shop says it: `Selasa, 24 Nov`. The header carries it under
 * the shop's name, because which day the till is having decides what the owner
 * expects to see on it.
 */
export function formatDay(at: string | Date = new Date()): string {
  const moment = typeof at === 'string' ? new Date(at) : at;
  return `${HARI[moment.getDay()]}, ${moment.getDate()} ${BULAN[moment.getMonth()]}`;
}

/** The day without its weekday: `24 Nov`. */
export function formatShortDay(at: string | Date): string {
  const moment = typeof at === 'string' ? new Date(at) : at;
  return `${moment.getDate()} ${BULAN[moment.getMonth()]}`;
}

/** The clock alone: `14.20`, as every rupiah in the app writes its time. */
export function formatClock(at: string | Date): string {
  const moment = typeof at === 'string' ? new Date(at) : at;
  return `${String(moment.getHours()).padStart(2, '0')}.${String(moment.getMinutes()).padStart(2, '0')}`;
}
