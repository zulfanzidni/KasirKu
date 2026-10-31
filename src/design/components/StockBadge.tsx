import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, space } from '../tokens';

type Status = 'unknown' | 'out' | 'low' | 'ok' | 'negative';

const statusConfig: Record<Status, { label: string; tone: 'muted' | 'owed' | 'primary' | 'default' }> = {
  unknown: { label: 'Belum dihitung', tone: 'muted' },
  // A negative count is the app and the shelf disagreeing: the one place a
  // stock state escalates. It reads first, in red, with the sign visible.
  negative: { label: 'Hitung ulang', tone: 'owed' },
  out: { label: 'Habis', tone: 'owed' },
  low: { label: 'Rendah', tone: 'default' },
  ok: { label: '', tone: 'muted' },
};

export interface StockBadgeProps {
  /** Null means never counted — distinct from zero, and must never read as out. */
  qty: number | null;
  /** The owner's minimum for this variant, if one is set. */
  minimum?: number | null;
  testID?: string;
}

/** Which state a stock figure is in, applying DESIGN.md's rules in order. */
export function stockStatus(qty: number | null, minimum?: number | null): Status {
  if (qty === null) return 'unknown';
  if (qty < 0) return 'negative';
  if (qty === 0) return 'out';
  if (minimum != null && qty < minimum) return 'low';
  return 'ok';
}

/**
 * A stock reading, never a coloured pill hiding the number.
 *
 * "Rendah" is a word, not an amber badge, because nothing here is an alarm —
 * it is a reading the owner acts on. Negative brings the red and moves the row
 * to the top of the list by the screen's ordering, not by this component.
 */
export function StockBadge({ qty, minimum, testID }: StockBadgeProps) {
  const status = stockStatus(qty, minimum);
  const config = statusConfig[status];

  return (
    <View testID={testID} style={styles.wrap} accessibilityLabel={describe(qty, status)}>
      <AppText typeRole="numericMedium" tone={config.tone} align="right">
        {qty === null ? '—' : qty.toString().replace('.', ',')}
      </AppText>
      {config.label ? (
        <AppText typeRole="labelSmall" tone={config.tone} style={styles.label}>
          {config.label}
        </AppText>
      ) : null}
    </View>
  );
}

function describe(qty: number | null, status: Status): string {
  if (qty === null) return 'Stok belum dihitung';
  if (status === 'negative') return `Stok ${qty}, hitung ulang`;
  return status === 'ok' ? `Stok ${qty}` : `Stok ${qty}, ${statusConfig[status].label}`;
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'flex-end', width: 62 },
  label: { marginTop: -3, letterSpacing: 0.2, fontSize: 9, lineHeight: 12 },
});
