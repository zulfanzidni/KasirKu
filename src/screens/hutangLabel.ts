import { formatRupiah } from '@/design';
import type { HutangState } from '@/ledger';

/**
 * A customer's balance in the shop's words. One function, so the picker, the
 * list and the detail sheet can never phrase the same balance differently.
 */
export function hutangLabel(state: HutangState): string {
  if (state.kind === 'hutang') return `Hutang ${formatRupiah(state.jumlah)}`;
  if (state.kind === 'kredit') return `Kredit ${formatRupiah(state.jumlah)}`;
  return 'Lunas';
}
