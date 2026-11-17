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
