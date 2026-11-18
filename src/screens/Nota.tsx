import { useEffect, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  BottomSheet,
  Button,
  IconButton,
  TotalBlock,
  colors,
  fontFamily,
  formatQty,
  formatRupiah,
  layout,
  parseQty,
  shape,
  space,
  typography,
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
 * The nota in portrait: the running cart, the total in its window, and the two
 * actions that end it.
 *
 * Collapsed it is one line — how many, how much — so the grid keeps its room.
 * Opened it is the same cart with each line editable in place, because a tall
 * screen has the room for steppers. In landscape the same nota is `NotaPanel`,
 * always open, with the controls moved into a sheet: a wide screen has width
 * for two panes and no height to spare.
 */
export function NotaSheet({ cart, onSetQty, onRemove, onCancel, onSave, saving }: NotaSheetProps) {
  const [open, setOpen] = useState(false);
  const insets = useSafeAreaInsets();

  const total = cart.reduce((sum, line) => sum + line.jumlah, 0);
  const empty = cart.length === 0;

  // A cart that empties (saved, or cancelled) cannot leave an open sheet behind.
  useEffect(() => {
    if (empty) setOpen(false);
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
            <IconButton
              name={open ? 'keyboard-arrow-down' : 'keyboard-arrow-up'}
              label={open ? 'Tutup nota' : 'Buka nota'}
              onPress={() => setOpen((value) => !value)}
            />
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

      <NotaFooter total={total} empty={empty} saving={saving} onCancel={onCancel} onSave={onSave} />
    </View>
  );
}

export interface NotaPanelProps extends NotaSheetProps {}

/**
 * The nota in landscape: a fixed panel at the right edge, always open, never
 * collapsible. There is no room here for a stepper on every line, so a line is
 * a reading — name, quantity, amount — and tapping one opens the editor sheet.
 * The total and the two actions sit pinned at the foot, where a thumb can reach
 * them without covering the grid.
 */
export function NotaPanel({ cart, onSetQty, onRemove, onCancel, onSave, saving }: NotaPanelProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const total = cart.reduce((sum, line) => sum + line.jumlah, 0);
  const empty = cart.length === 0;
  const editing = editingId ? cart.find((line) => line.varianId === editingId) ?? null : null;

  // A line that leaves the cart (removed, or the cart emptied) closes its editor.
  useEffect(() => {
    if (!editing) setEditingId(null);
  }, [editing]);

  return (
    <View style={styles.panel} testID="nota-panel">
      <View style={styles.panelHead}>
        <AppText typeRole="labelSmall" tone="primary">
          Nota
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted">
          {empty ? 'Ketuk barang' : `${cart.length} barang`}
        </AppText>
      </View>

      <FlatList
        data={cart}
        keyExtractor={(line) => line.varianId}
        style={styles.panelList}
        contentContainerStyle={empty ? styles.panelListEmpty : undefined}
        ListEmptyComponent={
          <AppText typeRole="bodyMedium" tone="muted">
            Belum ada barang di nota.
          </AppText>
        }
        renderItem={({ item }) => (
          <PanelLine
            line={item}
            selected={item.varianId === editingId}
            onPress={() => setEditingId(item.varianId)}
          />
        )}
      />

      <NotaFooter total={total} empty={empty} saving={saving} onCancel={onCancel} onSave={onSave} />

      <LineEditor
        line={editing}
        onClose={() => setEditingId(null)}
        onSetQty={(qty) => editing && onSetQty(editing.varianId, round(qty))}
        onRemove={() => {
          if (!editing) return;
          onRemove(editing.varianId);
          setEditingId(null);
        }}
      />
    </View>
  );
}

/** One nota line in the panel: what it is, how many, how much. */
function PanelLine({ line, selected, onPress }: { line: CartLine; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={`panel-${line.varianId}`}
      accessibilityRole="button"
      accessibilityLabel={`${line.nama}, ${formatQty(line.qty)} ${line.satuan}, ${formatRupiah(line.jumlah)}`}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={[styles.panelLine, selected && styles.panelLineSelected]}
    >
      <AppText typeRole="bodyLarge" numberOfLines={1} style={styles.panelName}>
        {line.nama}
      </AppText>
      <AppText typeRole="numericMedium" tone="muted" style={styles.panelQty}>
        {`×${formatQty(line.qty)}`}
      </AppText>
      <AppText typeRole="numericMedium" align="right" style={styles.panelAmount}>
        {formatRupiah(line.jumlah)}
      </AppText>
    </Pressable>
  );
}

/**
 * The line's full controls, in a sheet: a step down, a quantity you can type, a
 * step up, the line's own rupiah, and the way to take it off the nota.
 */
function LineEditor({
  line,
  onClose,
  onSetQty,
  onRemove,
}: {
  line: CartLine | null;
  onClose: () => void;
  onSetQty: (qty: number) => void;
  onRemove: () => void;
}) {
  const [draft, setDraft] = useState('');

  // Opening the editor on another line must not keep the previous draft.
  useEffect(() => {
    setDraft(line ? formatQty(line.qty) : '');
  }, [line?.varianId]);

  if (!line) return null;

  const step = line.qty < 1 ? 0.25 : 1;

  return (
    <BottomSheet visible onClose={onClose} title={line.nama} testID="atur-jumlah">
      <AppText typeRole="bodyMedium" tone="muted">
        {`${formatRupiah(line.harga)} / ${line.satuan}`}
      </AppText>

      <View style={styles.editor}>
        <IconButton
          name="remove"
          label={`Kurangi ${line.nama}`}
          onPress={() => onSetQty(Math.max(step, line.qty - step))}
        />
        <TextInput
          testID="atur-jumlah-input"
          accessibilityLabel={`Jumlah ${line.nama}`}
          keyboardType="decimal-pad"
          value={draft}
          onChangeText={setDraft}
          onEndEditing={() => {
            const parsed = parseQty(draft);
            if (parsed && parsed > 0) onSetQty(parsed);
            else setDraft(formatQty(line.qty));
          }}
          selectTextOnFocus
          style={styles.editorInput}
        />
        <IconButton
          name="add"
          label={`Tambah ${line.nama}`}
          onPress={() => onSetQty(line.qty + step)}
        />
      </View>

      <View style={styles.editorFoot}>
        <AppText typeRole="numericLarge" align="right" style={styles.editorTotal}>
          {formatRupiah(line.harga * line.qty)}
        </AppText>
        <Button label="Hapus" variant="destructive" testID="hapus-baris" onPress={onRemove} style={styles.editorGrow} />
      </View>
      <Button label="Selesai" variant="outlined" onPress={onClose} style={styles.editorDone} />
    </BottomSheet>
  );
}

/** The total in its window and the two actions that end the sale. Shared. */
function NotaFooter({
  total,
  empty,
  saving,
  onCancel,
  onSave,
}: {
  total: number;
  empty: boolean;
  saving: boolean;
  onCancel: () => void;
  onSave: () => void;
}) {
  const [confirmCancel, setConfirmCancel] = useState(false);

  return (
    <>
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
    </>
  );
}

/**
 * One line of the portrait nota: name, its own rupiah, and a quantity you can
 * step or type. The steps are 1 for whole items and 1/4 kg for weight items,
 * because those are the amounts the shop actually sells.
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
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    gap: space.sm,
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
    borderBottomColor: colors.outlineVariant,
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

  panel: {
    width: layout.notaPanel,
    backgroundColor: colors.surfaceContainerLowest,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.outline,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  panelHead: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
  },
  panelList: { flex: 1 },
  panelListEmpty: { paddingVertical: space.lg },
  panelLine: {
    flexDirection: 'row',
    alignItems: 'baseline',
    height: 44,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outlineVariant,
  },
  panelLineSelected: { backgroundColor: colors.primaryContainer },
  panelName: { flex: 1 },
  panelQty: { minWidth: 34, textAlign: 'right' },
  panelAmount: { minWidth: 72 },

  editor: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.md,
    paddingVertical: space.lg,
  },
  editorInput: {
    minWidth: 96,
    textAlign: 'center',
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    color: colors.onSurface,
    ...typography.numericLarge,
    fontFamily: fontFamily.printSemibold,
    paddingVertical: space.xs,
  },
  editorFoot: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  editorTotal: { flex: 1 },
  editorGrow: { flex: 1 },
  editorDone: { marginTop: space.md, borderRadius: shape.md },

  confirm: { gap: space.sm },
  actions: { flexDirection: 'row', gap: space.sm },
  cancel: { width: 104 },
  grow: { flex: 1 },
});
