import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Field,
  Note,
  RuledRow,
  Screen,
  SplitPane,
  colors,
  formatMoment,
  formatRupiah,
  parseRupiah,
  space,
  useFrame,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
import type { HutangEntry, HutangLedger, Pelanggan } from '@/ledger';
import { useApp } from '@/ledger/useLedger';
import { hutangLabel } from '@/screens/hutangLabel';

/**
 * Pelanggan — who owes the shop, and what happened to that debt.
 *
 * The balance is never a stored number: it is folded from the sales that left
 * money unpaid, the payments made, and the write-offs. A payment and a
 * write-off are listed apart, because only one of them brought cash in.
 */
export function PelangganScreen({ onBack }: { onBack?: () => void } = {}) {
  const { shop, hutangOf } = useApp();
  const { wide } = useFrame();
  const [adding, setAdding] = useState(false);
  const [detailId, setDetailId] = useState<string | null>(null);

  const live = shop.pelanggan
    .filter((entry) => !entry.archived)
    .sort((a, b) => a.nama.localeCompare(b.nama, 'id'));
  const detail = detailId ? shop.pelanggan.find((entry) => entry.id === detailId) ?? null : null;

  const list = (
    <>
      <Note>Hutang pelanggan dihitung dari penjualan yang belum dibayar, pembayaran, dan hapus buku.</Note>

      {live.length === 0 ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.empty}>
          Belum ada pelanggan. Tambahkan supaya hutang punya nama.
        </AppText>
      ) : null}

      {live.map((entry) => {
        const { state } = hutangOf(entry.id);
        return (
          <RuledRow
            key={entry.id}
            title={entry.nama}
            value={hutangLabel(state)}
            owed={state.kind === 'hutang'}
            selected={wide && entry.id === detailId}
            onPress={() => setDetailId(entry.id)}
            testID={`pelanggan-baris-${entry.id}`}
          />
        );
      })}
    </>
  );

  return (
    <Screen
      title="Pelanggan"
      overline="Orang"
      actions={
        <View style={styles.headerActions}>
          {onBack ? (
            <IconButton name="arrow-back" label="Kembali" onPress={onBack} testID="kembali-ke-orang" />
          ) : null}
          <IconButton
            name="add"
            label="Tambah pelanggan"
            onPress={() => setAdding(true)}
            testID="tambah-pelanggan"
          />
        </View>
      }
    >
      <SplitPane
        testID="pelanggan-pecah"
        detailTestID="pelanggan-pane"
        list={<ScrollView contentContainerStyle={styles.content}>{list}</ScrollView>}
        detail={
          detail ? (
            <ScrollView contentContainerStyle={styles.pane}>
              <PelangganDetail
                pelanggan={detail}
                hutang={hutangOf(detail.id)}
                onClose={() => setDetailId(null)}
              />
            </ScrollView>
          ) : (
            <View style={styles.paneEmpty}>
              <AppText typeRole="bodyMedium" tone="muted">
                Pilih pelanggan
              </AppText>
            </View>
          )
        }
      />

      <BottomSheet visible={adding} onClose={() => setAdding(false)} title="Tambah pelanggan" testID="form-pelanggan">
        <PelangganForm onDone={() => setAdding(false)} />
      </BottomSheet>

      <BottomSheet
        visible={!wide && detail !== null}
        onClose={() => setDetailId(null)}
        title={detail ? detail.nama : 'Pelanggan'}
        testID="detail-pelanggan"
      >
        {detail ? <PelangganDetail pelanggan={detail} hutang={hutangOf(detail.id)} onClose={() => setDetailId(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function PelangganForm({ onDone }: { onDone: () => void }) {
  const { tambahPelanggan } = useApp();
  const [nama, setNama] = useState('');
  const [telepon, setTelepon] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      await tambahPelanggan({ nama, telepon });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label="Nama" value={nama} onChangeText={setNama} autoFocus error={error} testID="pelanggan-nama" />
      <Field
        label="Telepon (opsional)"
        value={telepon}
        onChangeText={setTelepon}
        keyboardType="phone-pad"
        testID="pelanggan-telepon"
      />
      <Button label="Simpan" onPress={submit} testID="simpan-pelanggan" />
    </>
  );
}

type Mode = 'riwayat' | 'bayar' | 'hapusbuku';

function PelangganDetail({
  pelanggan,
  hutang,
  onClose,
}: {
  pelanggan: Pelanggan;
  hutang: HutangLedger;
  onClose: () => void;
}) {
  const { arsipkanPelanggan } = useApp();
  const [mode, setMode] = useState<Mode>('riwayat');
  const [error, setError] = useState<string | null>(null);

  async function arsipkan() {
    setError(null);
    try {
      await arsipkanPelanggan(pelanggan.id);
      onClose();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <View style={styles.status}>
        <AppText typeRole="labelSmall" tone="muted">
          Saldo
        </AppText>
        <AppText
          typeRole="titleMedium"
          tone={hutang.state.kind === 'hutang' ? 'owed' : 'primary'}
          testID="pelanggan-status"
        >
          {hutangLabel(hutang.state)}
        </AppText>
      </View>

      {mode === 'riwayat' ? <HutangHistory entries={hutang.entries} /> : null}
      {mode === 'bayar' ? (
        <PembayaranForm pelangganId={pelanggan.id} onDone={() => setMode('riwayat')} />
      ) : null}
      {mode === 'hapusbuku' ? (
        <HapusBukuForm pelangganId={pelanggan.id} onDone={() => setMode('riwayat')} />
      ) : null}

      {error ? (
        <AppText typeRole="bodyMedium" tone="owed" testID="pelanggan-galat" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {mode === 'riwayat' ? (
        <View style={styles.actions}>
          <Button
            label="Catat pembayaran"
            onPress={() => {
              setError(null);
              setMode('bayar');
            }}
            disabled={hutang.state.kind !== 'hutang'}
            testID="catat-pembayaran"
            style={styles.grow}
          />
          <Button
            label="Hapus buku"
            variant="outlined"
            onPress={() => {
              setError(null);
              setMode('hapusbuku');
            }}
            disabled={hutang.state.kind !== 'hutang'}
            testID="hapus-buku"
            style={styles.grow}
          />
        </View>
      ) : null}

      {mode === 'riwayat' ? (
        <View style={styles.archive}>
          <Button label="Arsipkan pelanggan" variant="text" onPress={arsipkan} testID="arsipkan-pelanggan" />
        </View>
      ) : null}
    </>
  );
}

function PembayaranForm({ pelangganId, onDone }: { pelangganId: string; onDone: () => void }) {
  const { catatPembayaranHutang } = useApp();
  const [jumlah, setJumlah] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const rupiah = parseRupiah(jumlah);
    if (rupiah === null) {
      setError('Jumlah harus angka. Contoh: 10.000');
      return;
    }
    try {
      await catatPembayaranHutang({ pelangganId, jumlah: rupiah });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field
        label="Uang diterima (Rp)"
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="number-pad"
        placeholder="10.000"
        autoFocus
        error={error}
        testID="bayar-hutang-jumlah"
      />
      <Note>Pembayaran mengurangi hutang dan dihitung sebagai uang masuk. Kelebihan bayar menjadi kredit.</Note>
      <Button label="Simpan pembayaran" onPress={submit} testID="simpan-pembayaran-hutang" />
    </>
  );
}

function HapusBukuForm({ pelangganId, onDone }: { pelangganId: string; onDone: () => void }) {
  const { hapusBukuHutang } = useApp();
  const [alasan, setAlasan] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    try {
      await hapusBukuHutang({ pelangganId, alasan });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Note>Hapus buku menghapus sisa hutang tanpa menerima uang. Ini bukan pembayaran.</Note>
      <Field
        label="Alasan"
        value={alasan}
        onChangeText={setAlasan}
        placeholder="Contoh: tidak jadi ditagih"
        autoFocus
        error={error}
        testID="hapusbuku-alasan"
      />
      <Button label="Hapus buku" variant="destructive" onPress={submit} testID="simpan-hapusbuku" />
    </>
  );
}

function HutangHistory({ entries }: { entries: HutangLedger['entries'] }) {
  if (entries.length === 0) {
    return <Note>Belum ada hutang atau pembayaran.</Note>;
  }

  return (
    <View testID="riwayat-hutang">
      {[...entries].reverse().map((entry) => (
        <View key={entryKey(entry)} style={styles.historyRow}>
          <View style={styles.historyMain}>
            <AppText typeRole="bodyMedium" numberOfLines={1}>
              {entryLabel(entry)}
            </AppText>
            <AppText typeRole="labelSmall" tone="muted">
              {`${formatMoment(entry.at, { withYear: false })} · sisa ${formatRupiah(Math.max(0, entry.setelah))}${
                entry.setelah < 0 ? ` · kredit ${formatRupiah(-entry.setelah)}` : ''
              }`}
            </AppText>
          </View>
          <AppText typeRole="numericMedium" tone={entry.kind === 'penjualan' ? 'owed' : 'default'} align="right">
            {signed(entry)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

function entryKey(entry: HutangEntry): string {
  return entry.kind === 'penjualan' ? entry.saleId : entry.eventId;
}

function entryLabel(entry: HutangEntry): string {
  if (entry.kind === 'penjualan') return 'Penjualan';
  if (entry.kind === 'pembayaran') return 'Pembayaran';
  return `Hapus buku · ${entry.alasan}`;
}

/** A sale adds to the debt; a payment or a write-off takes away from it. */
function signed(entry: HutangEntry): string {
  const sign = entry.kind === 'penjualan' ? '+' : '−';
  return `${sign}${formatRupiah(entry.jumlah)}`;
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.lg },
  pane: { paddingBottom: space.lg },
  paneEmpty: { paddingTop: space.sm },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  status: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  historyMain: { flex: 1 },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  grow: { flex: 1 },
  archive: { paddingTop: space.sm, alignItems: 'flex-end' },
  error: { paddingTop: space.sm },
});
