import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardStack,
  Chip,
  ChipScroller,
  Field,
  Note,
  Screen,
  SplitPane,
  StatusPill,
  colors,
  formatMoment,
  formatRupiah,
  space,
  useFrame,
} from '@/design';
import { liveSales, receiptOf, saleHistory, shareReceipt, type Sale } from '@/ledger';
import { printer } from '@/ledger/printer';
import { useApp } from '@/ledger/useLedger';
import { ReceiptPaper } from '@/screens/Receipt';

/**
 * Riwayat — every sale the shop has written, newest first.
 *
 * A voided sale is not hidden: the owner, or a customer holding the paper, can
 * still find its number. Opening a sale shows the same nota the customer took
 * away, and a voided nota is printed marked as cancelled. A mistake is
 * corrected by appending a void and ringing the sale up again, never by
 * deleting the record.
 *
 * The frame follows the same rule as Kasir: portrait is the list, with the nota
 * pushed on top; landscape is the list on the left and the chosen nota's paper
 * on the right, so a receipt can be checked without leaving the history.
 */
export function RiwayatScreen({ onBack }: { onBack?: () => void } = {}) {
  const { shop } = useApp();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter] = useState<'semua' | 'batal'>('semua');
  const { wide } = useFrame();

  const sales = saleHistory(shop);
  const live = liveSales(shop);
  // What customers were charged on the sales that still count: the same net
  // figure the rows show and today's totals use.
  const revenue = live.reduce((sum, sale) => sum + totalOf(sale), 0);
  const batal = sales.filter((sale) => sale.voided).length;
  const shown = filter === 'batal' ? sales.filter((sale) => sale.voided) : sales;
  const detail = selectedId ? shop.sales.find((sale) => sale.id === selectedId) ?? null : null;

  return (
    <Screen
      title="Riwayat"
      subtitle="Nota lampau dan pembatalan"
      role="Lainnya"
      onBack={onBack}
    >
      <SplitPane
        testID="riwayat-pecah"
        detailTestID="riwayat-pane"
        list={
          <ScrollView contentContainerStyle={styles.content}>
            <Card padded testID="riwayat-ringkasan" style={styles.summary}>
              <AppText typeRole="labelSmall" tone="muted">
                Jualan
              </AppText>
              <AppText typeRole="headlineMedium">{formatRupiah(revenue)}</AppText>
              <View style={styles.summaryRow}>
                <View style={styles.summaryCell}>
                  <AppText typeRole="bodySmall" tone="muted">
                    Nota
                  </AppText>
                  <AppText typeRole="numericMedium">{`${live.length} transaksi`}</AppText>
                </View>
                <View style={styles.summaryCell}>
                  <AppText typeRole="bodySmall" tone="muted">
                    Dibatalkan
                  </AppText>
                  <AppText typeRole="numericMedium" tone={batal > 0 ? 'owed' : 'default'}>
                    {batal}
                  </AppText>
                </View>
              </View>
            </Card>

            <ChipScroller>
              <Chip label="Semua" selected={filter === 'semua'} onPress={() => setFilter('semua')} testID="riwayat-filter-semua" />
              <Chip label="Dibatalkan" selected={filter === 'batal'} onPress={() => setFilter('batal')} testID="riwayat-filter-batal" />
            </ChipScroller>

            {sales.length === 0 ? <Note flush>Belum ada penjualan.</Note> : null}

            <CardStack>
              {shown.map((sale) => (
                <SaleRow
                  key={sale.id}
                  sale={sale}
                  selected={wide && selectedId === sale.id}
                  onPress={() => setSelectedId(sale.id)}
                />
              ))}
            </CardStack>

            <Note flush>
              Ketuk nota untuk rincian, batalkan, atau jual ulang. Nota yang dibatalkan tetap bisa dilacak nomornya.
            </Note>
          </ScrollView>
        }
        detail={
          <ScrollView style={styles.paneScroll} contentContainerStyle={styles.paneContent}>
            {detail ? (
              <SaleDetail key={detail.id} sale={detail} />
            ) : (
              <AppText typeRole="bodyMedium" tone="muted" style={styles.paneEmpty} testID="riwayat-pane-kosong">
                Pilih nota
              </AppText>
            )}
          </ScrollView>
        }
      />

      {wide ? null : (
        <BottomSheet
          visible={detail !== null}
          onClose={() => setSelectedId(null)}
          title={detail ? `Nota ${detail.number}` : 'Nota'}
          testID="riwayat-detail"
        >
          {detail ? <SaleDetail sale={detail} /> : null}
        </BottomSheet>
      )}
    </Screen>
  );
}

function SaleRow({ sale, selected, onPress }: { sale: Sale; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      testID={`riwayat-baris-${sale.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Nota ${sale.number}, ${formatRupiah(totalOf(sale))}${sale.voided ? ', dibatalkan' : ''}`}
      accessibilityState={{ selected }}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={styles.press}
    >
      <Card style={[styles.row, selected && styles.rowSelected]}>
        <View style={styles.rowMain}>
          <AppText typeRole="titleSmall" numberOfLines={1} testID={`riwayat-nomor-${sale.id}`}>
            {`No. ${sale.number}`}
          </AppText>
          <AppText typeRole="bodySmall" tone="muted" numberOfLines={1}>
            {`${formatMoment(sale.createdAt, { withYear: false })} · ${sale.lines.length} barang · Tunai${
              sale.pelangganNama ? ` · ${sale.pelangganNama}` : ''
            }`}
          </AppText>
        </View>
        {sale.voided ? (
          <StatusPill label="Dibatalkan" tone="owed" testID={`riwayat-status-${sale.id}`} />
        ) : null}
        <AppText typeRole="numericLarge" tone={sale.voided ? 'muted' : 'default'} align="right">
          {formatRupiah(totalOf(sale))}
        </AppText>
      </Card>
    </Pressable>
  );
}

function SaleDetail({ sale }: { sale: Sale }) {
  const { shop, voidSale } = useApp();
  const [mode, setMode] = useState<'nota' | 'batal'>('nota');
  const [alasan, setAlasan] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);

  async function submitVoid() {
    setError(null);
    try {
      await voidSale({ saleId: sale.id, alasan });
      setMode('nota');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function share() {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    try {
      await shareReceipt(printer.current, sale, shop.receipt);
    } catch (cause) {
      setShareError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSharing(false);
    }
  }

  return (
    <>
      <ReceiptPaper nota={receiptOf(sale, shop.receipt)} />

      {sale.voided ? (
        <Note>{`Dibatalkan: ${sale.voidReason ?? 'tanpa alasan tercatat'}. Penjualan ini tidak dihitung lagi.`}</Note>
      ) : null}

      {shareError ? <Note>{`Nota belum bisa dibagikan: ${shareError}`}</Note> : null}

      {mode === 'batal' ? (
        <>
          <Field
            label="Alasan pembatalan"
            value={alasan}
            onChangeText={setAlasan}
            placeholder="Contoh: salah input"
            autoFocus
            testID="riwayat-alasan"
          />
          {error ? (
            <AppText typeRole="bodySmall" tone="owed" testID="riwayat-galat" style={styles.error}>
              {error}
            </AppText>
          ) : null}
          <Note>
            Penjualan tidak dihapus. Notanya tetap ada di Riwayat, ditandai dibatalkan, dan stok, hutang, serta kasnya
            kembali seperti sebelum penjualan.
          </Note>
          <View style={styles.actions}>
            <Button label="Tidak" variant="outlined" onPress={() => setMode('nota')} style={styles.back} />
            <Button
              label="Batalkan penjualan"
              variant="destructive"
              onPress={submitVoid}
              testID="riwayat-simpan-batal"
              style={styles.grow}
            />
          </View>
        </>
      ) : (
        <View style={styles.actions}>
          <Button
            label={sharing ? 'Menyiapkan…' : 'Bagikan nota'}
            variant="outlined"
            size="medium"
            onPress={share}
            disabled={sharing}
            testID="riwayat-bagikan"
            style={styles.grow}
          />
          {sale.voided ? null : (
            <Button
              label="Batalkan"
              variant="destructive"
              size="medium"
              onPress={() => {
                setError(null);
                setMode('batal');
              }}
              testID="riwayat-batal"
              style={styles.grow}
            />
          )}
        </View>
      )}
    </>
  );
}

/** What the customer was charged: the receipt total, after discount and pembulatan. */
function totalOf(sale: Sale): number {
  return sale.payment?.net ?? sale.total;
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.sm },
  summary: { gap: space.xs },
  summaryRow: { flexDirection: 'row', gap: space.xl, marginTop: space.xs },
  summaryCell: { gap: 1 },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  press: { borderRadius: 16 },
  row: {
    minHeight: 64,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  rowMain: { flex: 1, gap: 1 },
  rowSelected: { backgroundColor: colors.primaryContainer },
  paneScroll: { flex: 1 },
  paneContent: { paddingBottom: space.xxl, gap: space.sm },
  paneEmpty: { paddingTop: space.md },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  back: { width: 96 },
  grow: { flex: 1 },
  error: { paddingBottom: space.sm },
});
