import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Field,
  Note,
  Screen,
  colors,
  formatRupiah,
  space,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
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
 */
export function RiwayatScreen({ onBack }: { onBack?: () => void } = {}) {
  const { shop } = useApp();
  const [detailId, setDetailId] = useState<string | null>(null);

  const sales = saleHistory(shop);
  const live = liveSales(shop);
  // What customers were charged on the sales that still count: the same net
  // figure the rows show and today's totals use.
  const revenue = live.reduce((sum, sale) => sum + totalOf(sale), 0);
  const detail = detailId ? shop.sales.find((sale) => sale.id === detailId) ?? null : null;

  return (
    <Screen
      title="Riwayat"
      overline="Penjualan"
      actions={
        onBack ? <IconButton name="arrow-back" label="Kembali" onPress={onBack} testID="kembali-dari-riwayat" /> : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.summary} testID="riwayat-ringkasan">
          <View>
            <AppText typeRole="labelSmall" tone="muted">
              Penjualan yang dihitung
            </AppText>
            <AppText typeRole="titleMedium" tone="primary">
              {`${live.length} transaksi`}
            </AppText>
          </View>
          <AppText typeRole="numericLarge" align="right">
            {`Rp ${formatRupiah(revenue)}`}
          </AppText>
        </View>

        <Note>
          Penjualan yang dibatalkan tetap ada di sini, ditandai. Nomor nota yang dipegang pelanggan selalu bisa dilacak.
        </Note>

        {sales.length === 0 ? (
          <AppText typeRole="bodyMedium" tone="muted" style={styles.empty}>
            Belum ada penjualan.
          </AppText>
        ) : null}

        {sales.map((sale) => (
          <SaleRow key={sale.id} sale={sale} onPress={() => setDetailId(sale.id)} />
        ))}
      </ScrollView>

      <BottomSheet
        visible={detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? `Nota ${detail.number}` : 'Nota'}
        testID="riwayat-detail"
      >
        {detail ? <SaleDetail sale={detail} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function SaleRow({ sale, onPress }: { sale: Sale; onPress: () => void }) {
  return (
    <Pressable
      testID={`riwayat-baris-${sale.id}`}
      accessibilityRole="button"
      accessibilityLabel={`Nota ${sale.number}, ${formatRupiah(totalOf(sale))}${sale.voided ? ', dibatalkan' : ''}`}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={styles.row}
    >
      <View style={styles.rowMain}>
        <AppText typeRole="bodyLarge" numberOfLines={1} testID={`riwayat-nomor-${sale.id}`}>
          {`No. ${sale.number}`}
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          {`${tanggal(sale.createdAt)}${sale.pelangganNama ? ` · ${sale.pelangganNama}` : ''}`}
        </AppText>
      </View>
      {sale.voided ? (
        <AppText typeRole="labelSmall" tone="owed" testID={`riwayat-status-${sale.id}`}>
          Dibatalkan
        </AppText>
      ) : null}
      <AppText typeRole="numericLarge" tone={sale.voided ? 'owed' : 'default'} align="right" style={styles.amount}>
        {formatRupiah(totalOf(sale))}
      </AppText>
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
            <AppText typeRole="bodyMedium" tone="owed" testID="riwayat-galat" style={styles.error}>
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
            onPress={share}
            disabled={sharing}
            testID="riwayat-bagikan"
            style={styles.grow}
          />
          {sale.voided ? null : (
            <Button
              label="Batalkan penjualan"
              variant="destructive"
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

/** A moment as the shop writes it: 17/11 14.20. */
function tanggal(at: string): string {
  const moment = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(moment.getDate())}/${pad(moment.getMonth() + 1)} ${pad(moment.getHours())}.${pad(moment.getMinutes())}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.xxl },
  summary: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  row: {
    minHeight: space.row,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    overflow: 'hidden',
  },
  rowMain: { flex: 1 },
  amount: { minWidth: 88 },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  back: { width: 96 },
  grow: { flex: 1 },
  error: { paddingBottom: space.sm },
});
