import { StyleSheet, View } from 'react-native';
import { AppText, BottomSheet, Button, RuledRow, formatQty, formatRupiah, space } from '@/design';
import type { Varian } from '@/ledger';
import type { TapOutcome } from '@/ledger/useLedger';

export interface ChoiceSheetProps {
  /** What the last tap asked for, or null when nothing is being chosen. */
  choice: Extract<TapOutcome, { kind: 'chooseVariant' | 'chooseWeight' }> | null;
  onClose: () => void;
  onAdd: (varianId: string, qty: number) => void;
}

type Choice = NonNullable<ChoiceSheetProps['choice']>;
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
        <Button label="Batal" variant="text" fullWidth={false} onPress={onClose} testID="batal-pilih" />
      </View>
    </BottomSheet>
  );
}

function VariantChoices({ varian, onAdd }: { varian: Varian[]; onAdd: Add }) {
  return (
    <View style={styles.flat}>
      {varian.map((item) => (
        <RuledRow
          key={item.id}
          title={item.nama}
          kode={item.kode ?? undefined}
          value={formatRupiah(item.harga)}
          onPress={() => onAdd(item.id, 1)}
          testID={`pilih-${item.id}`}
        />
      ))}
    </View>
  );
}

function WeightChoices({ varian, pilihan, onAdd }: { varian: Varian; pilihan: number[]; onAdd: Add }) {
  return (
    <View style={styles.flat}>
      <AppText typeRole="bodyMedium" tone="muted" style={styles.note}>
        {`${varian.nama} · ${formatRupiah(varian.harga)} per ${varian.satuan}`}
      </AppText>
      {pilihan.map((qty) => (
        <RuledRow
          key={qty}
          title={`${formatQty(qty)} ${varian.satuan}`}
          value={formatRupiah(Math.round(varian.harga * qty))}
          onPress={() => onAdd(varian.id, qty)}
          testID={`pilih-${varian.id}-${qty}`}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flat: { marginHorizontal: -space.gutter },
  footer: { paddingTop: space.sm, alignItems: 'flex-end' },
  note: { paddingHorizontal: space.gutter, paddingBottom: space.sm },
});
