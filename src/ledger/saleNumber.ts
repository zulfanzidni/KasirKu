/**
 * The human-facing sale number: `YYYYMMDD-<device>-<seq>` (spec §Receipts).
 *
 * It exists so the owner can find a sale and re-share its receipt. It is a
 * convenience and never a key — the sale's identity stays its UUID — which is
 * why two phones can number independently and still never collide: the device
 * segment tells them apart.
 *
 * Pure and derived from the event alone, so the fold produces the same number
 * on every phone and for every sale, including one written before this rule
 * existed.
 */

import type { StoredEvent } from './store';

/** What a device calls itself in a sale number. What two phones never share. */
export type DeviceCode = string;

/**
 * A device's short code: its id, reduced to something a person can read off a
 * receipt. The leading 8 hex characters of a UUID are the device's own random
 * prefix, so two phones collide only with probability 2⁻³² per pair.
 */
export function deviceCode(deviceId: string): DeviceCode {
  const compact = deviceId.replace(/[^0-9a-zA-Z]/g, '').toUpperCase();
  return compact.slice(0, 4).padEnd(4, '0');
}

/** The device-local calendar day of a moment, as `YYYYMMDD`. */
export function dayStamp(createdAt: string): string {
  const at = new Date(createdAt);
  if (Number.isNaN(at.getTime())) return '00000000';
  const year = at.getFullYear();
  const month = String(at.getMonth() + 1).padStart(2, '0');
  const day = String(at.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/** `20261031-4F3A-014`: unique across two offline phones, sortable by day. */
export function saleNumber(createdAt: string, deviceId: string, seq: number): string {
  return `${dayStamp(createdAt)}-${deviceCode(deviceId)}-${String(seq).padStart(3, '0')}`;
}

/** The number a sale event carries, or — for an older event — the one its envelope earns it. */
export function saleNumberOf(event: StoredEvent): string {
  const recorded = event.type === 'sale.completed' ? event.payload.number : undefined;
  return recorded ?? saleNumber(event.createdAt, event.deviceId, event.seq);
}
