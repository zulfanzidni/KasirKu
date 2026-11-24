import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  Chip,
  Field,
  Icon,
  RowAvatar,
  Screen,
  SectionHeading,
  TotalBlock,
  colors,
  computeTotals,
  formatRupiah,
  formatRupiahFull,
  parseRupiah,
  shape,
  space,
  type Discount,
} from '@/design';
import type { Cart, PaymentInput, Pelanggan } from '@/ledger';

/** Which way the discount was typed. The number field holds both. */
export type DiskonCara = 'rupiah' | 'persen';

export interface PaymentStepProps {
  cart: Cart;
  /** The customer chosen in the step before this one; null for a walk-in. */
  pelanggan: Pelanggan | null;
  /** Reopens the customer step, so a shortfall can still get an owner. */
  onPickCustomer: () => void;
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
export function PaymentStep({ cart, pelanggan, onPickCustomer, onBack, onPay, saving, error }: PaymentStepProps) {
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
    <Screen
      title="Bayar"
      role="Kasir"
      subtitle={`${cart.length} barang · ${formatRupiah(gross)}`}
      footer={
        <View style={styles.footer}>
          <Button
            label={saving ? 'Menyimpan…' : 'Simpan'}
            onPress={() => onPay({ discount, tendered, pelangganId: pelanggan?.id })}
            disabled={saving || (totals.hutang > 0 && !pelanggan) || totals.due <= 0}
            testID="simpan-pembayaran"
          />
          <Button
            label="Kembali ke nota"
            variant="text"
            size="small"
            fullWidth={false}
            onPress={onBack}
            disabled={saving}
            testID="kembali-dari-bayar"
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card style={styles.customer}>
          <RowAvatar size={36} tone="action">
            <Icon name="user" size={18} color={colors.primary} />
          </RowAvatar>
          <View style={styles.customerMain}>
            <AppText typeRole="titleSmall" testID="bayar-pelanggan">
              {pelanggan ? pelanggan.nama : 'Umum'}
            </AppText>
            <AppText typeRole="bodySmall" tone="muted">
              {pelanggan ? 'Punya hutang bisa dicatat' : 'Tanpa pelanggan'}
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ganti pelanggan"
            onPress={onPickCustomer}
            disabled={saving}
            hitSlop={8}
            testID="ganti-pelanggan"
          >
            <AppText typeRole="labelMedium" tone="primary">
              Ubah
            </AppText>
          </Pressable>
        </Card>

        <SectionHeading flush>Rincian</SectionHeading>
        <Card padded style={styles.detail}>
          <View style={styles.sumRow}>
            <AppText typeRole="bodyMedium" tone="muted" style={styles.sumLabel}>
              Total barang
            </AppText>
            <AppText typeRole="numericMedium" align="right" testID="bayar-gross">
              {formatRupiah(gross)}
            </AppText>
          </View>
          <View style={styles.sumRow}>
            <AppText typeRole="bodyMedium" tone="muted" style={styles.sumLabel}>
              Diskon
            </AppText>
            <AppText typeRole="numericMedium" align="right" testID="bayar-diskon">
              {formatRupiah(totals.discount)}
            </AppText>
          </View>
          <View style={styles.discountRow}>
            <Chip
              label="Rp"
              selected={diskonCara === 'rupiah'}
              onPress={() => setDiskonCara('rupiah')}
              testID="diskon-rupiah"
            />
            <Chip
              label="%"
              selected={diskonCara === 'persen'}
              onPress={() => setDiskonCara('persen')}
              testID="diskon-persen"
            />
            <View style={styles.discountField}>
              <Field
                testID="bayar-diskon-input"
                label="Diskon"
                keyboardType="number-pad"
                value={diskonTeks}
                onChangeText={setDiskonTeks}
                placeholder={diskonCara === 'persen' ? 'Mis. 10' : 'Mis. 1.500'}
              />
            </View>
          </View>
          <AppText typeRole="bodySmall" tone="muted">
            {diskonCara === 'persen'
              ? `Diskon ${trimNumber(diskonTeks)}% dihitung dari total barang, lalu dibulatkan ke rupiah.`
              : 'Diskon dihitung dari total barang, tidak pernah melebihi totalnya.'}
          </AppText>
          <View style={[styles.sumRow, styles.rule]}>
            <AppText typeRole="bodyMedium" tone="muted" style={styles.sumLabel}>
              Pembulatan
            </AppText>
            <AppText typeRole="numericMedium" align="right" testID="bayar-pembulatan">
              {signed(totals.rounding)}
            </AppText>
          </View>
        </Card>

        <TotalBlock label="Total" amount={totals.due} testID="bayar-total" style={styles.total} />

        <Field
          testID="uang-diterima"
          label="Tunai diterima"
          size="amount"
          suffix="Rp"
          keyboardType="number-pad"
          value={diterimaTeks}
          onChangeText={setDiterimaTeks}
          placeholder="0"
          style={styles.tunaiInput}
        />

        <View style={styles.quick}>
          {[
            { label: '50 rb', value: 50_000 },
            { label: '100 rb', value: 100_000 },
            { label: 'Pas', value: totals.due },
          ].map((option) => (
            <Pressable
              key={option.label}
              accessibilityRole="button"
              accessibilityLabel={`Isi ${option.label}`}
              onPress={() => setDiterimaTeks(String(option.value))}
              android_ripple={{ color: colors.primaryContainer }}
              style={styles.quickButton}
            >
              <AppText typeRole="bodySmall" tone="muted">
                {option.label}
              </AppText>
            </Pressable>
          ))}
        </View>

        <Card padded style={styles.change}>
          <View style={styles.changeCol}>
            <AppText typeRole="bodySmall" tone="muted">
              Kembalian
            </AppText>
            <AppText typeRole="headlineMedium" tone="positive" testID="bayar-kembalian">
              {formatRupiah(totals.kembalian)}
            </AppText>
          </View>
          <View style={[styles.changeCol, styles.changeRight]}>
            <AppText typeRole="bodySmall" tone="muted">
              Hutang
            </AppText>
            <AppText typeRole="headlineMedium" testID="bayar-hutang-nilai">
              {formatRupiah(totals.hutang)}
            </AppText>
          </View>
        </Card>

        {totals.hutang > 0 ? (
          pelanggan ? (
            <AppText typeRole="bodySmall" tone="owed" testID="bayar-hutang" style={styles.warning}>
              {`Kurang ${formatRupiahFull(totals.hutang)} dari total. Sisanya dicatat sebagai hutang ${pelanggan.nama}.`}
            </AppText>
          ) : (
            <AppText typeRole="bodySmall" tone="owed" testID="bayar-kurang" style={styles.warning}>
              {`Kurang ${formatRupiahFull(totals.hutang)} dari total. Penjualan dengan hutang membutuhkan pelanggan — pilih pelanggan dulu.`}
            </AppText>
          )
        ) : null}

        <Card padded style={styles.noteCard}>
          <AppText typeRole="bodySmall" tone="muted">
            Pembulatan ke Rp 500 diterapkan bila perlu.
          </AppText>
        </Card>

        {error ? (
          <AppText typeRole="bodySmall" tone="owed" style={styles.warning}>
            {error}
          </AppText>
        ) : null}
      </ScrollView>
    </Screen>
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
  body: { paddingHorizontal: space.gutter, paddingBottom: space.xl, gap: space.sm },
  customer: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md, borderRadius: 16 },
  customerMain: { flex: 1, gap: 1 },
  detail: { gap: space.sm },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  sumLabel: { flex: 1 },
  rule: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline, paddingTop: space.sm },
  discountRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  discountField: { flex: 1 },
  total: { marginTop: space.sm },
  tunaiInput: { paddingHorizontal: space.xs },
  quick: { flexDirection: 'row', gap: space.sm },
  quickButton: {
    flex: 1,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
  },
  change: { flexDirection: 'row', gap: space.md },
  changeCol: { flex: 1, gap: 2 },
  changeRight: { alignItems: 'flex-end' },
  warning: { paddingHorizontal: space.xs },
  noteCard: { borderRadius: 16 },
  footer: { gap: space.xs, alignItems: 'center' },
});
