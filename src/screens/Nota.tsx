import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardStack,
  CloseButton,
  Icon,
  IconButton,
  Screen,
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

export interface NotaProps {
  cart: Cart;
  onSetQty: (varianId: string, qty: number) => void;
  onRemove: (varianId: string) => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}

/**
 * The cart along the bottom of the till in portrait.
 *
 * It is one line — how many, how much, pay — because the grid above it is what
 * the owner is working in. The line opens the nota; the blue button goes
 * straight to the money.
 */
export function CartBar({
  cart,
  onOpen,
  onCancel,
  onSave,
  saving,
}: {
  cart: Cart;
  onOpen: () => void;
  onCancel: () => void;
  onSave: () => void;
  saving: boolean;
}) {
  const total = cart.reduce((sum, line) => sum + line.jumlah, 0);
  const empty = cart.length === 0;

  return (
    <View style={styles.barWrap}>
      <Card style={styles.bar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Buka nota"
          accessibilityState={{ expanded: false, disabled: empty }}
          disabled={empty}
          onPress={onOpen}
          style={styles.barLeft}
        >
          <Icon name="cart" size={20} color={colors.primary} />
          <View style={styles.barText}>
            <AppText typeRole="labelMedium">{empty ? 'Nota kosong' : `${cart.length} barang`}</AppText>
            {empty ? (
              <AppText typeRole="bodySmall" tone="muted">
                Ketuk barang untuk menambah.
              </AppText>
            ) : null}
          </View>
          <AppText typeRole="numericDisplay" align="right">
            {formatRupiah(total)}
          </AppText>
        </Pressable>

        {empty ? null : (
          <IconButton name="trash" size={18} label="Batalkan" onPress={onCancel} />
        )}

        <Button
          label={saving ? 'Menyimpan' : 'Bayar'}
          size="small"
          fullWidth={false}
          disabled={empty || saving}
          onPress={onSave}
          testID="simpan-penjualan"
        />
      </Card>
    </View>
  );
}

/**
 * The nota, opened: every line editable in place, the sums under them, and the
 * two ways to end the sale.
 *
 * A tall screen has room for steppers, so this is where a quantity is changed
 * by hand. In landscape the same cart is `NotaPanel`, where a line is a reading
 * and the controls live in a sheet.
 */
export function NotaScreen({
  cart,
  onClose,
  onSetQty,
  onRemove,
  onCancel,
  onSave,
  saving,
}: NotaProps & { onClose: () => void }) {
  const total = cart.reduce((sum, line) => sum + line.jumlah, 0);

  return (
    <View style={styles.overlay}>
      <Screen
        title="Nota"
        role="Kasir"
        subtitle={`${cart.length} barang`}
        actions={<CloseButton onPress={onClose} label="Tutup nota" />}
        footer={
          <View style={styles.overlayFoot}>
            <Button
              label="Batalkan"
              variant="outlined"
              onPress={onCancel}
              disabled={saving || cart.length === 0}
              style={styles.cancelButton}
            />
            <Button
              label={saving ? 'Menyimpan' : 'Bayar'}
              onPress={onSave}
              disabled={saving || cart.length === 0}
              testID="bayar-nota"
              style={styles.grow}
            />
          </View>
        }
      >
        <ScrollView contentContainerStyle={styles.overlayBody} keyboardShouldPersistTaps="handled">
          <CardStack>
            {cart.map((line) => (
              <CartLineCard
                key={line.varianId}
                line={line}
                onChange={(qty) => onSetQty(line.varianId, qty)}
                onRemove={() => onRemove(line.varianId)}
              />
            ))}
          </CardStack>
          <SummaryCard total={total} />
        </ScrollView>
      </Screen>
    </View>
  );
}

export interface NotaPanelProps extends NotaProps {}

/**
 * The nota in landscape: a fixed panel at the right edge, always open. There is
 * no room here for a stepper on every line, so a line is a reading — name,
 * quantity, amount — and tapping one opens the editor sheet.
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
        <AppText typeRole="titleMedium">Nota</AppText>
        <AppText typeRole="bodySmall" tone="muted">
          {empty ? 'Ketuk barang' : `${cart.length} barang`}
        </AppText>
      </View>

      <ScrollView style={styles.panelList} contentContainerStyle={styles.panelListContent}>
        {empty ? (
          <AppText typeRole="bodySmall" tone="muted">
            Belum ada barang di nota.
          </AppText>
        ) : (
          <Card>
            {cart.map((line, index) => (
              <PanelLine
                key={line.varianId}
                line={line}
                divided={index > 0}
                selected={line.varianId === editingId}
                onPress={() => setEditingId(line.varianId)}
              />
            ))}
          </Card>
        )}
      </ScrollView>

      <SummaryCard total={total} compact />

      <View style={styles.panelActions}>
        <Button
          label="Batalkan"
          variant="outlined"
          size="medium"
          disabled={empty || saving}
          onPress={onCancel}
          style={styles.cancelButton}
        />
        <Button
          label={saving ? 'Menyimpan' : 'Bayar'}
          size="medium"
          disabled={empty || saving}
          onPress={onSave}
          testID="simpan-penjualan"
          style={styles.grow}
        />
      </View>

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
function PanelLine({
  line,
  selected,
  divided,
  onPress,
}: {
  line: CartLine;
  selected: boolean;
  divided: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID={`panel-${line.varianId}`}
      accessibilityRole="button"
      accessibilityLabel={`${line.nama}, ${formatQty(line.qty)} ${line.satuan}, ${formatRupiah(line.jumlah)}`}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={[styles.panelLine, divided && styles.panelLineDivided, selected && styles.panelLineSelected]}
    >
      <View style={styles.panelLineMain}>
        <AppText typeRole="titleSmall" numberOfLines={1}>
          {line.nama}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted">
          {`${formatQty(line.qty)} ${line.satuan} × ${formatRupiah(line.harga)}`}
        </AppText>
      </View>
      <AppText typeRole="numericMedium" align="right">
        {formatRupiah(line.jumlah)}
      </AppText>
    </Pressable>
  );
}

/**
 * One line of the opened nota: the picture's well, the name, its own rupiah,
 * and a quantity you can step or type. The steps are 1 for whole items and
 * 1/4 kg for weight items, because those are the amounts the shop sells.
 */
function CartLineCard({
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
    <Card style={styles.line} testID={`nota-${line.varianId}`}>
      <View style={styles.well} />
      <View style={styles.lineBody}>
        <View style={styles.lineTop}>
          <AppText typeRole="titleSmall" numberOfLines={1} style={styles.lineName}>
            {line.nama}
          </AppText>
          <AppText typeRole="numericMedium" align="right">
            {formatRupiah(line.jumlah)}
          </AppText>
        </View>
        <AppText typeRole="bodySmall" tone="muted">
          {`${formatRupiah(line.harga)} / ${line.satuan}`}
        </AppText>
        <View style={styles.lineFoot}>
          <View style={styles.stepper}>
            <IconButton
              name="minus"
              size={16}
              label={`Kurangi ${line.nama}`}
              onPress={() => onChange(round(Math.max(smallest, line.qty - step)))}
            />
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
            <IconButton
              name="add"
              size={16}
              label={`Tambah ${line.nama}`}
              onPress={() => onChange(round(line.qty + step))}
            />
          </View>
          <IconButton
            name="trash"
            size={16}
            label={`Hapus ${line.nama}`}
            onPress={onRemove}
            testID={`hapus-${line.varianId}`}
          />
        </View>
      </View>
    </Card>
  );
}

/** The sums under the lines: what the goods come to, and the number that ends it. */
export function SummaryCard({ total, compact = false }: { total: number; compact?: boolean }) {
  return (
    <Card style={compact ? styles.summaryCompact : styles.summary} testID="total-nota">
      <View style={styles.sumRow}>
        <AppText typeRole="bodySmall" tone="muted">
          Subtotal
        </AppText>
        <AppText typeRole="numericMedium" align="right">
          {formatRupiah(total)}
        </AppText>
      </View>
      <View style={[styles.sumRow, styles.sumTotal]}>
        <AppText typeRole="titleSmall">Total</AppText>
        <AppText typeRole="numericDisplay" tone="primary" align="right">
          {formatRupiah(total)}
        </AppText>
      </View>
    </Card>
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
      <AppText typeRole="bodySmall" tone="muted">
        {`${formatRupiah(line.harga)} / ${line.satuan}`}
      </AppText>

      <View style={styles.editor}>
        <IconButton
          name="minus"
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
        <Button label="Hapus" variant="destructive" testID="hapus-baris" onPress={onRemove} style={styles.grow} />
      </View>
      <Button label="Selesai" variant="outlined" onPress={onClose} style={styles.editorDone} />
    </BottomSheet>
  );
}

/** Two decimals is all a quarter-kilo ever needs; this keeps float dust out. */
function round(qty: number): number {
  return Math.round(qty * 100) / 100;
}

const styles = StyleSheet.create({
  barWrap: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.sm },
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    borderRadius: 14,
    paddingLeft: space.md,
    paddingRight: 8,
  },
  barLeft: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  barText: { flex: 1 },

  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.surface },
  overlayBody: { paddingHorizontal: space.gutter, paddingBottom: space.lg, gap: space.sm },
  overlayFoot: { flexDirection: 'row', gap: space.sm },

  line: { flexDirection: 'row', overflow: 'hidden' },
  well: { width: 60, backgroundColor: colors.imageWell },
  lineBody: { flex: 1, padding: space.md, gap: 2 },
  lineTop: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  lineName: { flex: 1 },
  lineFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.xs },
  stepper: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 24,
    paddingHorizontal: space.xs,
    backgroundColor: colors.outlineVariant,
    borderRadius: shape.full,
  },
  qtyInput: {
    minWidth: 40,
    height: 24,
    paddingVertical: 0,
    textAlign: 'center',
    color: colors.onSurface,
    ...typography.numericMedium,
    fontFamily: fontFamily.printSemibold,
  },

  summary: { padding: space.md, gap: space.sm },
  summaryCompact: { padding: space.md, gap: space.xs },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  sumTotal: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: space.sm },

  panel: {
    width: layout.notaPanel,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.outline,
    paddingHorizontal: space.md,
    paddingTop: space.sm,
    paddingBottom: space.md,
    gap: space.sm,
  },
  panelHead: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  panelList: { flex: 1 },
  panelListContent: { paddingBottom: space.sm },
  panelLine: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  panelLineDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  panelLineSelected: { backgroundColor: colors.primaryContainer },
  panelLineMain: { flex: 1, gap: 1 },
  panelActions: { flexDirection: 'row', gap: space.sm },
  cancelButton: { width: 104 },
  grow: { flex: 1 },

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
  editorDone: { marginTop: space.md, borderRadius: shape.md },
});
