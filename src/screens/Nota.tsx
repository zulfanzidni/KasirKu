import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Button,
  IconButton,
  TotalBlock,
  colors,
  formatQty,
  formatRupiah,
  parseQty,
  space,
  typography,
  fontFamily,
} from '@/design';
import type { Cart, CartLine } from '@/ledger';

export interface NotaSheetProps {
  cart: Cart;
  onSetQty: (varianId: string, qty: number) => void;
  onRemove: (varianId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * The nota: the running cart, the pen total, and the two actions that end it.
 *
 * Collapsed it is one ruled line — how many, how much — so the grid keeps its
 * room. Opened it is a list of the same cart with each line editable. There is
 * only one cart, so the two views cannot disagree.
 */
export function NotaSheet({ cart, onSetQty, onRemove, onCancel, onSave, saving }: NotaSheetProps) {
  const [open, setOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const insets = useSafeAreaInsets();

  const total = cart.reduce((sum, line) => sum + line.jumlah, 0);
  const empty = cart.length === 0;

  // A cart that empties (saved, or cancelled) cannot leave an open sheet behind.
  useEffect(() => {
    if (empty) {
      setOpen(false);
      setConfirmCancel(false);
    }
  }, [empty]);

  return (
    <View style={[styles.wrap, { paddingBottom: Math.max(insets.bottom, space.md) }]}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={empty ? 'Nota kosong' : `Buka nota, ${cart.length} barang`}
        accessibilityState={{ expanded: open }}
        disabled={empty}
        onPress={() => setOpen((value) => !value)}
        style={styles.header}
      >
        <AppText typeRole="labelSmall" tone="primary">
          Nota
        </AppText>
        <View style={styles.headerRight}>
          <AppText typeRole="bodyMedium" tone="muted">
            {empty ? 'Ketuk barang untuk menambah.' : `${cart.length} barang`}
          </AppText>
          {empty ? null : (
            <IconButton name={open ? 'keyboard-arrow-down' : 'keyboard-arrow-up'} label={open ? 'Tutup nota' : 'Buka nota'} onPress={() => setOpen((value) => !value)} />
          )}
        </View>
      </Pressable>

      {open && !empty ? (
        <View style={styles.lines}>
          <FlatList
            data={cart}
            keyExtractor={(line) => line.varianId}
            style={styles.lineList}
            renderItem={({ item }) => (
              <CartLineRow
                line={item}
                onChange={(qty) => onSetQty(item.varianId, qty)}
                onRemove={() => onRemove(item.varianId)}
              />
            )}
          />
        </View>
      ) : null}

      <TotalBlock amount={total} testID="total-nota" />

      {confirmCancel ? (
        <View style={styles.confirm}>
          <AppText typeRole="bodyMedium">Kosongkan nota? Semua barang akan dibuang.</AppText>
          <View style={styles.actions}>
            <Button label="Tidak" variant="outlined" onPress={() => setConfirmCancel(false)} style={styles.cancel} />
            <Button
              label="Kosongkan"
              variant="destructive"
              onPress={() => {
                setConfirmCancel(false);
                onCancel();
              }}
              testID="kosongkan-nota"
              style={styles.grow}
            />
          </View>
        </View>
      ) : (
        <View style={styles.actions}>
          <Button
            label="Batalkan"
            variant="outlined"
            disabled={empty || saving}
            onPress={() => setConfirmCancel(true)}
            style={styles.cancel}
          />
          <Button
            label={saving ? 'Menyimpan…' : 'Bayar'}
            disabled={empty || saving}
            onPress={onSave}
            testID="simpan-penjualan"
            style={styles.grow}
          />
        </View>
      )}
    </View>
  );
}

/**
 * One line of the nota: name, its own rupiah, and a quantity you can step or
 * type. The steps are 1 for whole items and 1/4 kg for weight items, because
 * those are the amounts the shop actually sells.
 */
function CartLineRow({
  line,
  onChange,
  onRemove,
}: {
  line: CartLine;
  onChange: (qty: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState(formatQty(line.qty));

  // Keep the field in step when the quantity changes from anywhere else.
  useEffect(() => {
    setDraft(formatQty(line.qty));
  }, [line.qty]);

  const step = line.qty < 1 ? 0.25 : 1;
  const smallest = step;

  return (
    <View style={styles.line} testID={`nota-${line.varianId}`}>
      <View style={styles.lineMain}>
        <AppText typeRole="bodyLarge" numberOfLines={1}>
          {line.nama}
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted">
          {`${formatRupiah(line.harga)} / ${line.satuan} · ${formatQty(line.qty)} ${line.satuan}`}
        </AppText>
      </View>
      <View style={styles.lineControls}>
        <IconButton name="remove" label={`Kurangi ${line.nama}`} onPress={() => onChange(round(Math.max(smallest, line.qty - step)))} />
        <TextInput
          testID={`jumlah-${line.varianId}`}
          accessibilityLabel={`Jumlah ${line.nama}`}
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
          onEndEditing={() => {
            const parsed = parseQty(draft);
            if (parsed && parsed > 0) onChange(round(parsed));
            else setDraft(formatQty(line.qty));
          }}
          selectTextOnFocus
          style={styles.qtyInput}
        />
        <IconButton name="add" label={`Tambah ${line.nama}`} onPress={() => onChange(round(line.qty + step))} />
      </View>
      <AppText typeRole="numericMedium" align="right" style={styles.lineTotal}>
        {formatRupiah(line.jumlah)}
      </AppText>
      <IconButton
        name="delete-outline"
        label={`Hapus ${line.nama}`}
        tone="owed"
        onPress={onRemove}
        testID={`hapus-${line.varianId}`}
      />
    </View>
  );
}

/** Two decimals is all a quarter-kilo ever needs; this keeps float dust out. */
function round(qty: number): number {
  return Math.round(qty * 100) / 100;
}

const styles = StyleSheet.create({
  wrap: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1.5,
    borderTopColor: colors.primary,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
  },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', minHeight: 36 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  lines: { maxHeight: 220, marginHorizontal: -space.gutter },
  lineList: { flexGrow: 0 },
  line: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.gutter,
    paddingRight: space.xs,
    minHeight: 56,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  lineMain: { flex: 1 },
  lineControls: { flexDirection: 'row', alignItems: 'center' },
  qtyInput: {
    width: 52,
    minHeight: 36,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.outline,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
    paddingVertical: space.xs,
  },
  lineTotal: { width: 76 },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  cancel: { width: 112 },
  grow: { flex: 1 },
  confirm: {
    paddingTop: space.sm,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    gap: space.sm,
  },
});
