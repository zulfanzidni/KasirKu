import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, RuledRow, TotalBlock, colors, formatQty, formatRupiah, space } from '@/design';
import type { Sale } from '@/ledger';

export interface ConfirmationScreenProps {
  sale: Sale;
  onNewSale: () => void;
}

/**
 * After a sale is saved: the same double rule and pen total as the cart, now
 * reading a sale that exists in the log. It shows what was written, not a
 * congratulation — the till has no celebration (DESIGN.md §Motion).
 */
export function ConfirmationScreen({ sale, onNewSale }: ConfirmationScreenProps) {
  const insets = useSafeAreaInsets();
  const jam = new Date(sale.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          Tersimpan
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          Penjualan tercatat
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <AppText typeRole="bodyMedium" tone="muted" style={styles.note}>
          {`Tercatat pukul ${jam}. Ini satu penjualan di buku.`}
        </AppText>
        {sale.lines.map((line) => (
          <RuledRow
            key={line.varianId}
            title={line.nama}
            qtyMark={`×${formatQty(line.qty)}`}
            value={formatRupiah(line.jumlah)}
          />
        ))}
        <TotalBlock amount={sale.total} style={styles.total} testID="total-tersimpan" />
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Nota baru" onPress={onNewSale} testID="nota-baru" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    minHeight: 56,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  body: { paddingBottom: space.lg },
  note: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  total: { marginTop: space.lg, paddingHorizontal: space.gutter },
  footer: { paddingHorizontal: space.gutter },
});
