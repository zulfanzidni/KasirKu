import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  Button,
  Card,
  Note,
  RowAvatar,
  Screen,
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
  const nota = receiptOf(sale, shop);

  return (
    <Screen
      title="Struk"
      role="Kasir"
      subtitle={`Tersimpan · ${nota.number}`}
      footer={
        <View style={styles.footer}>
          <Button
            label={sharing ? 'Menyiapkan…' : 'Bagikan PDF'}
            onPress={onShare}
            disabled={sharing}
            testID="bagikan-nota"
          />
          <Button label="Penjualan baru" variant="outlined" onPress={onNewSale} testID="nota-baru" />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.body}>
        <ReceiptPaper nota={nota} />
        {shareError ? <Note>{`Nota belum bisa dibagikan: ${shareError}`}</Note> : null}
      </ScrollView>
    </Screen>
  );
}

/** The paper itself: header, lines, the sums above the total window, footer. */
export function ReceiptPaper({ nota }: { nota: ReceiptData }) {
  const initial = nota.header.nama.trim().charAt(0).toUpperCase() || 'K';

  return (
    <Card padded style={styles.paper} testID="nota-kertas">
      <View style={styles.shop}>
        <RowAvatar size={44} tone="action">
          <AppText typeRole="titleLarge" tone="primary">
            {initial}
          </AppText>
        </RowAvatar>
        <View style={styles.shopText}>
          <AppText typeRole="titleLarge" numberOfLines={1} testID="nota-toko">
            {nota.header.nama}
          </AppText>
          {nota.header.keterangan ? (
            <AppText typeRole="bodySmall" tone="muted" numberOfLines={2}>
              {nota.header.keterangan}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.meta}>
        <AppText typeRole="bodySmall" tone="muted" testID="nota-nomor">
          {`No. ${nota.number}`}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted">
          {`${nota.tanggal} · ${nota.jam}`}
        </AppText>
      </View>

      {nota.voided ? (
        <View style={styles.void} testID="nota-batal">
          <AppText typeRole="labelSmall" tone="owed">
            NOTA DIBATALKAN
          </AppText>
          {nota.voidReason ? (
            <AppText typeRole="bodySmall" tone="muted">
              {nota.voidReason}
            </AppText>
          ) : null}
        </View>
      ) : null}

      <View style={styles.lines}>
        {nota.lines.map((line, index) => (
          <View key={`${line.label}-${index}`} style={styles.line}>
            <View style={styles.lineMain}>
              <AppText typeRole="titleSmall" numberOfLines={1}>
                {line.label}
              </AppText>
              <AppText typeRole="bodySmall" tone="muted">
                {line.qty}
              </AppText>
            </View>
            <AppText typeRole="numericMedium" align="right">
              {formatRupiah(line.amount)}
            </AppText>
          </View>
        ))}
      </View>

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
        <AppText typeRole="bodySmall" tone="muted" align="center" testID="nota-footer">
          {nota.footer}
        </AppText>
      </View>
    </Card>
  );
}

function SumRow({
  label,
  value,
  testID,
  emphasis,
}: {
  label: string;
  value: string;
  testID?: string;
  emphasis?: boolean;
}) {
  return (
    <View style={styles.sumRow}>
      <AppText typeRole="bodySmall" tone="muted" style={styles.sumLabel}>
        {label}
      </AppText>
      <AppText typeRole={emphasis ? 'numericMedium' : 'bodySmall'} tone={emphasis ? 'positive' : 'default'} align="right" testID={testID}>
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
  body: { paddingHorizontal: space.gutter, paddingBottom: space.lg },
  paper: { gap: space.md, borderRadius: 20 },
  shop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shopText: { flex: 1, gap: 1 },
  meta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingBottom: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  void: {
    paddingVertical: space.sm,
    paddingHorizontal: space.md,
    backgroundColor: colors.errorContainer,
    borderRadius: 10,
    gap: 2,
  },
  lines: { gap: space.sm },
  line: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  lineMain: { flex: 1 },
  sums: { gap: space.xs },
  sumRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', gap: space.sm },
  sumLabel: { flex: 1 },
  total: { marginTop: space.xs },
  foot: { paddingTop: space.sm },
  footer: { gap: space.sm },
});
