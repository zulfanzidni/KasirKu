import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Button,
  Note,
  RuledRow,
  TotalBlock,
  colors,
  formatRupiah,
  space,
} from '@/design';
import { receiptOf, type ReceiptData, type ReceiptShop, type Sale } from '@/ledger';

export interface ReceiptScreenProps {
  sale: Sale;
  /**
   * The shop's header and footer from settings. Required on purpose: a screen
   * that forgets it would silently print a nota with the wrong shop name.
   */
  shop: ReceiptShop;
  onNewSale: () => void;
  onShare: () => void;
  sharing?: boolean;
  shareError?: string | null;
}

/**
 * The nota after saving: the same paper the customer takes away, drawn from
 * the same `ReceiptData` the PDF is printed from. What the owner sees here and
 * what the customer gets cannot disagree.
 */
export function ReceiptScreen({ sale, shop, onNewSale, onShare, sharing, shareError }: ReceiptScreenProps) {
  const insets = useSafeAreaInsets();
  const nota = receiptOf(sale, shop);

  return (
    <View style={[styles.screen, { paddingTop: insets.top, paddingBottom: Math.max(insets.bottom, space.lg) }]}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          Tersimpan
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          Penjualan tercatat
        </AppText>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <ReceiptPaper nota={nota} />
        {shareError ? <Note>{`Nota belum bisa dibagikan: ${shareError}`}</Note> : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button label="Nota baru" variant="outlined" onPress={onNewSale} testID="nota-baru" style={styles.back} />
        <Button
          label={sharing ? 'Menyiapkan…' : 'Bagikan nota'}
          onPress={onShare}
          disabled={sharing}
          testID="bagikan-nota"
          style={styles.grow}
        />
      </View>
    </View>
  );
}

/** The paper itself: header, lines, the sums under the double rule, footer. */
export function ReceiptPaper({ nota }: { nota: ReceiptData }) {
  return (
    <View style={styles.paper} testID="nota-kertas">
      <View style={styles.shop}>
        <AppText typeRole="headlineSmall" tone="primary" align="center">
          {nota.header.nama}
        </AppText>
        {nota.header.keterangan ? (
          <AppText typeRole="bodyMedium" tone="muted" align="center">
            {nota.header.keterangan}
          </AppText>
        ) : null}
      </View>

      <View style={styles.meta}>
        <AppText typeRole="bodyMedium" tone="muted" testID="nota-nomor">
          {`No. ${nota.number}`}
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted">
          {`${nota.tanggal} · ${nota.jam}`}
        </AppText>
      </View>

      {nota.voided ? (
        <View style={styles.void} testID="nota-batal">
          <AppText typeRole="titleMedium" tone="owed" align="center">
            NOTA DIBATALKAN
          </AppText>
          {nota.voidReason ? (
            <AppText typeRole="bodyMedium" tone="muted" align="center">
              {nota.voidReason}
            </AppText>
          ) : null}
        </View>
      ) : null}

      {nota.lines.map((line, index) => (
        <RuledRow key={`${line.label}-${index}`} title={line.label} qtyMark={line.qty} value={formatRupiah(line.amount)} />
      ))}

      <View style={styles.sums}>
        <SumRow label="Total barang" value={formatRupiah(nota.gross)} testID="nota-gross" />
        <SumRow
          label="Diskon"
          value={nota.discount > 0 ? `−${formatRupiah(nota.discount)}` : '—'}
          testID="nota-diskon"
        />
        <SumRow label="Pembulatan" value={signed(nota.rounding)} testID="nota-pembulatan" />
      </View>

      <TotalBlock label="Total" amount={nota.total} testID="nota-total" style={styles.total} />

      <View style={styles.sums}>
        <SumRow label="Tunai" value={formatRupiah(nota.tendered)} testID="nota-tunai" />
        <SumRow label="Kembalian" value={formatRupiah(nota.kembalian)} testID="nota-kembalian" emphasis />
        {nota.hutang > 0 ? (
          <SumRow
            label={nota.pelanggan ? `Hutang ${nota.pelanggan}` : 'Hutang'}
            value={formatRupiah(nota.hutang)}
            testID="nota-hutang"
            emphasis
          />
        ) : null}
      </View>

      <View style={styles.foot}>
        <AppText typeRole="bodyMedium" tone="muted" align="center" testID="nota-footer">
          {nota.footer}
        </AppText>
      </View>
    </View>
  );
}

function SumRow({ label, value, testID, emphasis }: { label: string; value: string; testID?: string; emphasis?: boolean }) {
  return (
    <View style={styles.sumRow}>
      <AppText typeRole={emphasis ? 'titleMedium' : 'bodyLarge'} tone={emphasis ? 'primary' : 'default'} style={styles.sumLabel}>
        {label}
      </AppText>
      <AppText typeRole="numericLarge" tone={emphasis ? 'primary' : 'default'} align="right" testID={testID}>
        {value}
      </AppText>
    </View>
  );
}

/** `+200`, `−200`, or the dash when the cash step came out exact. */
function signed(amount: number): string {
  if (amount === 0) return '—';
  return `${amount > 0 ? '+' : '−'}${formatRupiah(Math.abs(amount))}`;
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
  paper: { backgroundColor: colors.surfaceContainerLowest, margin: space.md, paddingBottom: space.md },
  shop: { paddingHorizontal: space.gutter, paddingTop: space.lg, gap: space.xs },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  void: {
    marginHorizontal: space.gutter,
    marginTop: space.sm,
    paddingVertical: space.sm,
    borderWidth: 2,
    borderColor: colors.error,
    gap: space.xs,
  },
  sums: { paddingHorizontal: space.gutter, paddingTop: space.sm, gap: space.xs },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  sumLabel: { flex: 1 },
  total: { paddingHorizontal: space.gutter, marginTop: space.sm },
  foot: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  footer: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter, paddingTop: space.md },
  back: { width: 112 },
  grow: { flex: 1 },
});
