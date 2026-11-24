import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  CardRow,
  Field,
  Icon,
  MetricCard,
  Note,
  RowAvatar,
  Screen,
  SectionHeading,
  SplitPane,
  colors,
  formatMoment,
  formatRupiah,
  parseRupiah,
  space,
  useFrame,
} from '@/design';
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
  const saldoOf = (entry: Pelanggan) => hutangOf(entry.id).state;
  const totalHutang = live.reduce((sum, entry) => {
    const state = saldoOf(entry);
    return state.kind === 'hutang' ? sum + state.jumlah : sum;
  }, 0);
  const belumLunas = live.filter((entry) => saldoOf(entry).kind === 'hutang');
  const lunas = live.filter((entry) => saldoOf(entry).kind !== 'hutang');

  const row = (entry: Pelanggan, divided: boolean) => {
    const state = saldoOf(entry);
    const owed = state.kind === 'hutang';
    const kredit = state.kind === 'kredit';
    return (
      <CardRow
        key={entry.id}
        divided={divided}
        onPress={() => setDetailId(entry.id)}
        testID={`pelanggan-baris-${entry.id}`}
        accessibilityLabel={`${entry.nama}, ${hutangLabel(state)}`}
        style={wide && entry.id === detailId ? styles.picked : undefined}
      >
        <RowAvatar size={40} tone={owed ? 'owed' : kredit ? 'positive' : 'muted'}>
          <AppText typeRole="titleSmall" tone={owed ? 'owed' : kredit ? 'positive' : 'muted'}>
            {entry.nama.trim().charAt(0).toUpperCase()}
          </AppText>
        </RowAvatar>
        <View style={styles.rowText}>
          <AppText typeRole="titleSmall" numberOfLines={1}>
            {entry.nama}
          </AppText>
          <AppText typeRole="bodySmall" tone="muted">
            {owed ? 'Hutang' : kredit ? 'Kredit' : 'Lunas'}
          </AppText>
        </View>
        <AppText typeRole="numericMedium" tone={owed ? 'owed' : kredit ? 'positive' : 'muted'} align="right">
          {state.kind === 'lunas' ? '—' : formatRupiah(state.jumlah)}
        </AppText>
        <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
      </CardRow>
    );
  };

  const list = (
    <>
      <MetricCard
        label="Total hutang"
        value={formatRupiah(totalHutang)}
        tone={totalHutang > 0 ? 'owed' : 'default'}
        note={
          belumLunas.length > 0
            ? `${belumLunas.length} pelanggan belum lunas`
            : 'Semua pelanggan lunas'
        }
        testID="pelanggan-total"
      />

      {live.length === 0 ? (
        <Note flush>Belum ada pelanggan. Tambahkan supaya hutang punya nama.</Note>
      ) : null}

      {belumLunas.length > 0 ? (
        <>
          <SectionHeading flush>Belum lunas</SectionHeading>
          <Card>{belumLunas.map((entry, index) => row(entry, index > 0))}</Card>
        </>
      ) : null}

      {lunas.length > 0 ? (
        <>
          <SectionHeading flush>Lunas</SectionHeading>
          <Card>{lunas.map((entry, index) => row(entry, index > 0))}</Card>
        </>
      ) : null}

      <Note flush>Hutang dihitung dari penjualan yang belum dibayar, pembayaran, dan hapus buku.</Note>
    </>
  );

  return (
    <Screen
      title="Pelanggan"
      subtitle={`${live.length} pelanggan · hutang warung`}
      role="Orang"
      onBack={onBack}
      actions={
        <Button
          label="Baru"
          icon="add"
          size="small"
          fullWidth={false}
          onPress={() => setAdding(true)}
          testID="tambah-pelanggan"
        />
      }
    >
      <SplitPane
        testID="pelanggan-pecah"
        detailTestID="pelanggan-pane"
        list={<ScrollView contentContainerStyle={styles.content}>{list}</ScrollView>}
        detail={
          detail ? (
            <ScrollView contentContainerStyle={styles.pane}>
              <PelangganDetail pelanggan={detail} hutang={hutangOf(detail.id)} onClose={() => setDetailId(null)} />
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
      <Card padded style={styles.status}>
        <AppText typeRole="labelSmall" tone="muted">
          Saldo
        </AppText>
        <AppText
          typeRole="headlineMedium"
          tone={hutang.state.kind === 'hutang' ? 'owed' : 'positive'}
          testID="pelanggan-status"
        >
          {hutangLabel(hutang.state)}
        </AppText>
      </Card>

      {mode === 'riwayat' ? <HutangHistory entries={hutang.entries} /> : null}
      {mode === 'bayar' ? (
        <PembayaranForm pelangganId={pelanggan.id} onDone={() => setMode('riwayat')} />
      ) : null}
      {mode === 'hapusbuku' ? (
        <HapusBukuForm pelangganId={pelanggan.id} onDone={() => setMode('riwayat')} />
      ) : null}

      {error ? (
        <AppText typeRole="bodySmall" tone="owed" testID="pelanggan-galat" style={styles.error}>
          {error}
        </AppText>
      ) : null}

      {mode === 'riwayat' ? (
        <View style={styles.actions}>
          <Button
            label="Catat pembayaran"
            size="medium"
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
            size="medium"
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
          <Button label="Arsipkan pelanggan" variant="text" size="small" onPress={arsipkan} testID="arsipkan-pelanggan" />
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
    <Card testID="riwayat-hutang" style={styles.history}>
      {[...entries].reverse().map((entry, index) => (
        <View key={entryKey(entry)} style={[styles.historyRow, index > 0 && styles.historyDivided]}>
          <View style={styles.historyMain}>
            <AppText typeRole="titleSmall" numberOfLines={1}>
              {entryLabel(entry)}
            </AppText>
            <AppText typeRole="bodySmall" tone="muted">
              {`${formatMoment(entry.at, { withYear: false })} · sisa ${formatRupiah(Math.max(0, entry.setelah))}${
                entry.setelah < 0 ? ` · kredit ${formatRupiah(-entry.setelah)}` : ''
              }`}
            </AppText>
          </View>
          <AppText typeRole="numericMedium" tone={entry.kind === 'penjualan' ? 'owed' : 'positive'} align="right">
            {signed(entry)}
          </AppText>
        </View>
      ))}
    </Card>
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
  content: { paddingHorizontal: space.gutter, paddingBottom: space.xl, gap: space.sm },
  pane: { paddingBottom: space.lg, gap: space.sm },
  paneEmpty: { paddingTop: space.sm },
  rowText: { flex: 1, gap: 1 },
  picked: { backgroundColor: colors.primaryContainer },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.md },
  status: { gap: space.xs },
  history: { padding: 0 },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: space.row,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  historyDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  historyMain: { flex: 1, gap: 1 },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.md },
  grow: { flex: 1 },
  archive: { paddingTop: space.sm, alignItems: 'flex-end' },
  error: { paddingTop: space.sm },
});
