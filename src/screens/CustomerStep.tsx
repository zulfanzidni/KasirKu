import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText, Button, Note, RuledRow, colors, space } from '@/design';
import type { HutangState, Pelanggan } from '@/ledger';
import { hutangLabel } from '@/screens/hutangLabel';

export interface CustomerStepProps {
  /** Every live customer, in the order the shop lists them. */
  pelanggan: Pelanggan[];
  /** One customer's balance, folded from the log. */
  hutangOf: (pelangganId: string) => { state: HutangState };
  /** Null means a walk-in: no customer, and therefore no hutang allowed. */
  onPick: (pelangganId: string | null) => void;
  onBack: () => void;
}

/**
 * Pelanggan — the step between the cart and the payment.
 *
 * The customer is chosen here, before any money is counted, because a shortfall
 * is hutang and hutang needs an owner. Picking is a normal step, not an error
 * sprung after the fact (user story 13). A walk-in is an explicit choice, so
 * "nobody" is never the silent default.
 */
export function CustomerStep({ pelanggan, hutangOf, onPick, onBack }: CustomerStepProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          Pelanggan
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          Sebelum bayar
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Note>
          Pilih pelanggan dulu. Kalau uangnya kurang, sisanya dicatat sebagai hutang pelanggan ini.
        </Note>

        <View style={styles.list}>
          <RuledRow
            title="Tanpa pelanggan"
            value="Umum"
            onPress={() => onPick(null)}
            testID="pelanggan-umum"
          />
          {pelanggan.map((entry) => {
            const { state } = hutangOf(entry.id);
            return (
              <RuledRow
                key={entry.id}
                title={entry.nama}
                value={hutangLabel(state)}
                onPress={() => onPick(entry.id)}
                testID={`pilih-pelanggan-${entry.id}`}
              />
            );
          })}
        </View>

        {pelanggan.length === 0 ? (
          <AppText typeRole="bodyMedium" tone="muted" style={styles.empty}>
            Belum ada pelanggan. Tambahkan di menu Orang supaya hutang punya nama.
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Kembali" variant="outlined" onPress={onBack} testID="kembali-pelanggan" />
      </View>
    </View>
  );
}

/** The balance in the shop's words: "Hutang Rp 10.000", "Lunas", "Kredit Rp 5.000". */
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
  list: { paddingTop: space.sm },
  empty: { paddingHorizontal: space.gutter, paddingTop: space.md },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.md },
});
