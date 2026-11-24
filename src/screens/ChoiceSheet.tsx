import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, Card, CardRow, Icon, formatQty, formatRupiah, colors, space } from '@/design';
import type { Varian } from '@/ledger';
import type { TapOutcome } from '@/ledger/useLedger';

export interface ChoiceSheetProps {
  /** The weight the last tap asked for, or null when nothing is being chosen. */
  choice: Extract<TapOutcome, { kind: 'chooseWeight' }> | null;
  onClose: () => void;
  onAdd: (varianId: string, qty: number) => void;
}

type Add = ChoiceSheetProps['onAdd'];

/**
 * The one reveal the till has left: how much of a weight item.
 *
 * The grid is already one tile per varian, so a tile tap has already chosen
 * the size. Only weight still needs an amount before anything is added.
 */
export function ChoiceSheet({ choice, onClose, onAdd }: ChoiceSheetProps) {
  return (
    <BottomSheet visible={choice !== null} onClose={onClose} title="Berapa kg?" testID="pilih-varian">
      {choice?.kind === 'chooseWeight' ? (
        <WeightChoices varian={choice.varian} pilihan={choice.pilihan} onAdd={onAdd} />
      ) : null}
      <View style={styles.footer}>
        <Button label="Batal" variant="text" size="small" fullWidth={false} onPress={onClose} testID="batal-pilih" />
      </View>
    </BottomSheet>
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
