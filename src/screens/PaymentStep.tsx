import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Button,
  Chip,
  TotalBlock,
  colors,
  computeTotals,
  formatRupiah,
  formatRupiahFull,
  parseRupiah,
  space,
  typography,
  fontFamily,
  type Discount,
} from '@/design';
import type { Cart, PaymentInput } from '@/ledger';

/** Which way the discount was typed. The number field holds both. */
export type DiskonCara = 'rupiah' | 'persen';

export interface PaymentStepProps {
  cart: Cart;
  onBack: () => void;
  /** Called once with the settled payment. The screen owns the save guard. */
  onPay: (payment: PaymentInput) => void;
  /** The button is inert from the tap that started saving. */
  saving: boolean;
  error?: string | null;
}

/**
 * Bayar — the payment step.
 *
 * It reads the order in the order the money moves: what the goods come to, the
 * discount the owner chose, the pembulatan the cash step forces, then the
 * total. Under that, what the customer handed over and the kembalian live, so
 * the owner reads the change back without doing arithmetic.
 *
 * Kembalian is never negative. When the cash falls short the app says how much
 * is missing and refuses to save: a partly paid sale is a hutang, and hutang
 * needs a customer (ticket 07).
 */
export function PaymentStep({ cart, onBack, onPay, saving, error }: PaymentStepProps) {
  const insets = useSafeAreaInsets();
  const [diskonCara, setDiskonCara] = useState<DiskonCara>('rupiah');
  const [diskonTeks, setDiskonTeks] = useState('');
  const [diterimaTeks, setDiterimaTeks] = useState('');

  const gross = cart.reduce((sum, line) => sum + line.jumlah, 0);
  const discount = useMemo(() => readDiscount(diskonCara, diskonTeks), [diskonCara, diskonTeks]);
  const tendered = parseRupiah(diterimaTeks) ?? 0;

  const totals = useMemo(
    () => computeTotals({ lines: cart.map((line) => ({ unitPrice: line.harga, qty: line.qty })), discount, tendered }),
    // The lines' own rounded totals are what was rung up; recomputing them here
    // is the same rounding, so the two cannot drift.
    [cart, discount, tendered],
  );

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          Bayar
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          {`${cart.length} barang · tunai`}
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        {cart.map((line) => (
          <View key={line.varianId} style={styles.item}>
            <AppText typeRole="bodyLarge" numberOfLines={1} style={styles.itemName}>
              {line.nama}
            </AppText>
            <AppText typeRole="numericLarge" align="right">
              {formatRupiah(line.jumlah)}
            </AppText>
          </View>
        ))}

        <View style={styles.section}>
          <AppText typeRole="labelSmall" tone="muted">
            Potongan
          </AppText>
          <View style={styles.row}>
            <AppText typeRole="bodyLarge" style={styles.rowLabel}>
              Total barang
            </AppText>
            <AppText typeRole="numericLarge" align="right" testID="bayar-gross">
              {formatRupiah(gross)}
            </AppText>
          </View>
          <View style={styles.row}>
            <AppText typeRole="bodyLarge" style={styles.rowLabel}>
              Diskon
            </AppText>
            <AppText typeRole="numericLarge" align="right" testID="bayar-diskon">
              {formatRupiah(totals.discount)}
            </AppText>
          </View>
          <View style={styles.chips}>
            <Chip label="Rp" selected={diskonCara === 'rupiah'} onPress={() => setDiskonCara('rupiah')} testID="diskon-rupiah" />
            <Chip label="%" selected={diskonCara === 'persen'} onPress={() => setDiskonCara('persen')} testID="diskon-persen" />
          </View>
          <TextInput
            testID="bayar-diskon-input"
            accessibilityLabel="Diskon"
            keyboardType="number-pad"
            value={diskonTeks}
            onChangeText={setDiskonTeks}
            placeholder={diskonCara === 'persen' ? 'Mis. 10' : 'Mis. 1.500'}
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.input}
          />
          <AppText typeRole="bodyMedium" tone="muted" style={styles.hint}>
            {diskonCara === 'persen'
              ? `Diskon ${trimNumber(diskonTeks)}% dihitung dari total barang, lalu dibulatkan ke rupiah.`
              : 'Diskon dihitung dari total barang, tidak pernah melebihi totalnya.'}
          </AppText>

          <View style={styles.row}>
            <AppText typeRole="bodyLarge" style={styles.rowLabel}>
              Pembulatan
            </AppText>
            <AppText typeRole="numericLarge" align="right" testID="bayar-pembulatan">
              {signed(totals.rounding)}
            </AppText>
          </View>
        </View>

        <TotalBlock label="Total" amount={totals.due} testID="bayar-total" style={styles.total} />

        <View style={styles.section}>
          <AppText typeRole="labelSmall" tone="muted">
            Tunai
          </AppText>
          <TextInput
            testID="uang-diterima"
            accessibilityLabel="Uang diterima"
            keyboardType="number-pad"
            value={diterimaTeks}
            onChangeText={setDiterimaTeks}
            placeholder="Berapa uang yang diterima?"
            placeholderTextColor={colors.onSurfaceVariant}
            style={styles.input}
          />
          <View style={styles.row}>
            <AppText typeRole="bodyLarge" style={styles.rowLabel}>
              Diterima
            </AppText>
            <AppText typeRole="numericLarge" align="right" testID="bayar-diterima">
              {formatRupiah(totals.tendered)}
            </AppText>
          </View>
          <View style={[styles.row, styles.kembalian]}>
            <AppText typeRole="titleMedium" tone="primary" style={styles.rowLabel}>
              Kembalian
            </AppText>
            <AppText typeRole="numericLarge" tone="primary" align="right" testID="bayar-kembalian">
              {formatRupiah(totals.kembalian)}
            </AppText>
          </View>
          {totals.hutang > 0 ? (
            <AppText typeRole="bodyMedium" tone="owed" testID="bayar-kurang" style={styles.kurang}>
              {`Kurang ${formatRupiahFull(totals.hutang)} dari total. Penjualan dengan hutang membutuhkan pelanggan — belum bisa disimpan di sini.`}
            </AppText>          ) : null}
        </View>

        {error ? (
          <AppText typeRole="bodyMedium" tone="owed" style={styles.kurang}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Kembali" variant="outlined" onPress={onBack} disabled={saving} style={styles.back} />
        <Button
          label={saving ? 'Menyimpan…' : 'Simpan & nota'}
          onPress={() => onPay({ discount, tendered })}
          disabled={saving || totals.hutang > 0 || totals.due <= 0}
          testID="simpan-pembayaran"
          style={styles.grow}
        />
      </View>
    </View>
  );
}

/** What was typed, as the discount it means. Empty or unreadable is no discount. */
function readDiscount(cara: DiskonCara, teks: string): Discount {
  const value = parseRupiah(teks);
  if (value === null || value <= 0) return { kind: 'none' };
  return cara === 'rupiah' ? { kind: 'rupiah', value } : { kind: 'percent', value };
}

/** `+200`, `−200`, or the dash when the cash step came out exact. */
function signed(amount: number): string {
  if (amount === 0) return '—';
  return `${amount > 0 ? '+' : '−'}${formatRupiah(Math.abs(amount))}`;
}

/** "10" not "10,00" — the percent the owner typed, read back. */
function trimNumber(text: string): string {
  const value = parseRupiah(text);
  return value === null ? '0' : String(value);
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
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    gap: space.sm,
    minHeight: 40,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  itemName: { flex: 1 },
  section: { paddingHorizontal: space.gutter, paddingTop: space.md, gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  rowLabel: { flex: 1 },
  kembalian: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingTop: space.sm,
    marginTop: space.xs,
  },
  chips: { flexDirection: 'row', gap: space.sm },
  input: {
    minHeight: space.touch,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 4,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
  },
  hint: { marginTop: -space.xs },
  total: { paddingHorizontal: space.gutter, marginTop: space.lg },
  kurang: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter, paddingTop: space.md },
  back: { width: 112 },
  grow: { flex: 1 },
});
