import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Card, CardRow, Icon, Note, RowAvatar, Screen, colors, space } from '@/design';
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
  return (
    <Screen
      title="Pelanggan"
      role="Kasir"
      subtitle="Sebelum bayar"
      onBack={onBack}
      footer={null}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Note flush>
          Pilih pelanggan dulu. Kalau uangnya kurang, sisanya dicatat sebagai hutang pelanggan ini.
        </Note>

        <Card>
          <CardRow onPress={() => onPick(null)} testID="pelanggan-umum" accessibilityLabel="Tanpa pelanggan, Umum">
            <RowAvatar size={36} tone="muted">
              <Icon name="people" size={18} color={colors.onSurfaceVariant} />
            </RowAvatar>
            <View style={styles.rowText}>
              <AppText typeRole="titleSmall">Tanpa pelanggan</AppText>
              <AppText typeRole="bodySmall" tone="muted">
                Umum
              </AppText>
            </View>
            <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
          </CardRow>

          {pelanggan.map((entry, index) => {
            const { state } = hutangOf(entry.id);
            return (
              <CardRow
                key={entry.id}
                divided={index > 0}
                onPress={() => onPick(entry.id)}
                testID={`pilih-pelanggan-${entry.id}`}
                accessibilityLabel={entry.nama}
              >
                <RowAvatar size={36}>
                  <AppText typeRole="titleSmall" tone="primary">
                    {entry.nama.trim().charAt(0).toUpperCase()}
                  </AppText>
                </RowAvatar>
                <View style={styles.rowText}>
                  <AppText typeRole="titleSmall" numberOfLines={1}>
                    {entry.nama}
                  </AppText>
                  <AppText typeRole="bodySmall" tone="muted">
                    {hutangLabel(state)}
                  </AppText>
                </View>
                <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
              </CardRow>
            );
          })}
        </Card>

        {pelanggan.length === 0 ? (
          <Note flush>Belum ada pelanggan. Tambahkan di menu Orang supaya hutang punya nama.</Note>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.gutter, paddingBottom: space.lg },
  rowText: { flex: 1, gap: 1 },
});
