import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Card, Screen, TotalBlock, colors, formatQty, formatRupiah, space } from '@/design';
import type { Sale } from '@/ledger';

export interface ConfirmationScreenProps {
  sale: Sale;
  onNewSale: () => void;
}

/**
 * After a sale is saved: the same total window as the cart, now reading a sale
 * that exists in the log. It shows what was written, not a congratulation — the
 * till has no celebration (DESIGN.md §Motion).
 */
export function ConfirmationScreen({ sale, onNewSale }: ConfirmationScreenProps) {
  const jam = new Date(sale.createdAt).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });

  return (
    <Screen
      title="Struk"
      subtitle={`Tersimpan · ${jam}`}
      role="Kasir"
      footer={<Button label="Penjualan baru" onPress={onNewSale} testID="nota-baru" />}
    >
      <ScrollView contentContainerStyle={styles.body}>
        <Card>
          {sale.lines.map((line, index) => (
            <View key={line.varianId} style={[styles.line, index > 0 && styles.divided]}>
              <View style={styles.lineMain}>
                <AppText typeRole="titleSmall" numberOfLines={1}>
                  {line.nama}
                </AppText>
                <AppText typeRole="bodySmall" tone="muted">
                  {`${formatQty(line.qty)} ${line.satuan}`}
                </AppText>
              </View>
              <AppText typeRole="numericMedium" align="right">
                {formatRupiah(line.jumlah)}
              </AppText>
            </View>
          ))}
        </Card>
        <TotalBlock amount={sale.total} style={styles.total} testID="total-tersimpan" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingBottom: space.lg, gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.md },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  lineMain: { flex: 1, gap: 1 },
  total: { marginTop: space.sm },
});
