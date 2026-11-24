import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Card, CardRow, Icon, formatQty, formatRupiah, colors, space } from '@/design';
import type { Varian } from '@/ledger';
import type { TapOutcome } from '@/ledger/useLedger';

export interface ChoiceSheetProps {
  /** What the last tap asked for, or null when nothing is being chosen. */
  choice: Extract<TapOutcome, { kind: 'chooseVariant' | 'chooseWeight' }> | null;
  onClose: () => void;
  onAdd: (varianId: string, qty: number) => void;
}

type Add = ChoiceSheetProps['onAdd'];

/**
 * The two reveals the till has: a product's sizes, and the weight amounts.
 *
 * Nothing is added until the cashier chooses here, which is the whole point —
 * a multi-variant product must never silently sell its first size.
 */
export function ChoiceSheet({ choice, onClose, onAdd }: ChoiceSheetProps) {
  return (
    <BottomSheet
      visible={choice !== null}
      onClose={onClose}
      title={choice?.kind === 'chooseWeight' ? 'Berapa kg?' : 'Pilih ukuran'}
      testID="pilih-varian"
    >
      {choice?.kind === 'chooseVariant' ? <VariantChoices varian={choice.varian} onAdd={onAdd} /> : null}
      {choice?.kind === 'chooseWeight' ? (
        <WeightChoices varian={choice.varian} pilihan={choice.pilihan} onAdd={onAdd} />
      ) : null}
      <View style={styles.footer}>
        <Button label="Batal" variant="text" size="small" fullWidth={false} onPress={onClose} testID="batal-pilih" />
      </View>
    </BottomSheet>
  );
}

function VariantChoices({ varian, onAdd }: { varian: Varian[]; onAdd: Add }) {
  return (
    <Card>
      {varian.map((item, index) => (
        <CardRow
          key={item.id}
          divided={index > 0}
          onPress={() => onAdd(item.id, 1)}
          testID={`pilih-${item.id}`}
          accessibilityLabel={`${item.nama}, ${formatRupiah(item.harga)}`}
        >
          <View style={styles.rowText}>
            <AppText typeRole="titleSmall" numberOfLines={1}>
              {item.nama}
            </AppText>
            {item.kode ? (
              <AppText typeRole="bodySmall" tone="muted">
                {item.kode}
              </AppText>
            ) : null}
          </View>
          <AppText typeRole="numericMedium" align="right">
            {formatRupiah(item.harga)}
          </AppText>
          <Icon name="add" size={16} color={colors.primary} strokeWidth={2.2} />
        </CardRow>
      ))}
    </Card>
  );
}

function WeightChoices({ varian, pilihan, onAdd }: { varian: Varian; pilihan: number[]; onAdd: Add }) {
  return (
    <View style={styles.stack}>
      <AppText typeRole="bodySmall" tone="muted">
        {`${varian.nama} · ${formatRupiah(varian.harga)} per ${varian.satuan}`}
      </AppText>
      <Card>
        {pilihan.map((qty, index) => (
          <CardRow
            key={qty}
            divided={index > 0}
            onPress={() => onAdd(varian.id, qty)}
            testID={`pilih-${varian.id}-${qty}`}
            accessibilityLabel={`${formatQty(qty)} ${varian.satuan}`}
          >
            <AppText typeRole="titleSmall" style={styles.rowText}>
              {`${formatQty(qty)} ${varian.satuan}`}
            </AppText>
            <AppText typeRole="numericMedium" align="right">
              {formatRupiah(Math.round(varian.harga * qty))}
            </AppText>
            <Icon name="add" size={16} color={colors.primary} strokeWidth={2.2} />
          </CardRow>
        ))}
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  rowText: { flex: 1, gap: 1 },
  footer: { paddingTop: space.md, alignItems: 'flex-end' },
});
