import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Card,
  CardRow,
  Chip,
  ChipRow,
  ChipScroller,
  Field,
  Note,
  RowAvatar,
  Screen,
  SectionHeading,
  colors,
  formatMoment,
  formatQty,
  formatRupiah,
  space,
  useFrame,
} from '@/design';
import { sellableVarian } from '@/ledger/queries';
import {
  defaultFilter,
  geserHari,
  labelRentang,
  MIN_HARI_LAPORAN,
  tanggalLokal,
  tanggalPendek,
  type LaporanFilter,
  type LaporanPeringkat,
  type LaporanPreset,
  type LaporanTitik,
} from '@/ledger/laporan';
import { useApp } from '@/ledger/useLedger';

/**
 * Laporan — what the shop sold, over a window the owner chose.
 *
 * The report is a fold of the log, never a stored total. It opens on this month
 * because that is the question the owner asks most often, and it always states
 * the basis of its figures: the local day boundary, when the phones last spoke,
 * and how many local events are still waiting to be sent. A "today" that has
 * not synced is not the whole shop's day, and the screen says so.
 */
export function LaporanScreen({ onBack }: { onBack?: () => void } = {}) {
  const { laporan, shop } = useApp();
  const { wide } = useFrame();
  const [filter, setFilter] = useState<LaporanFilter>(defaultFilter);
  const [tampilan, setTampilan] = useState<'hari' | 'minggu'>('hari');
  const [draftDari, setDraftDari] = useState('');
  const [draftSampai, setDraftSampai] = useState('');
  const [galatKustom, setGalatKustom] = useState<string | null>(null);
  const [pilihVarian, setPilihVarian] = useState(false);

  const report = laporan(filter);
  const kategori = shop.kategori.filter((entry) => !entry.archived);
  const barang = sellableVarian(shop).sort((left, right) => left.nama.localeCompare(right.nama, 'id'));

  const pilihPreset = (preset: LaporanPreset) => setFilter((current) => ({ ...current, preset }));

  /** The custom fields start on the last thirty days, so the owner edits a real range. */
  function pilihKustom() {
    const hariIni = tanggalLokal(new Date());
    const dari = draftDari || geserHari(hariIni, -29);
    const sampai = draftSampai || hariIni;
    if (!draftDari) setDraftDari(dari);
    if (!draftSampai) setDraftSampai(sampai);
    setGalatKustom(null);
    setFilter((current) => ({ ...current, preset: 'kustom', dari, sampai }));
  }

  function terapkanKustom() {
    const sah = /^\d{4}-\d{2}-\d{2}$/.test(draftDari) && /^\d{4}-\d{2}-\d{2}$/.test(draftSampai);
    if (!sah) {
      setGalatKustom('Tanggal ditulis seperti 2026-11-01.');
      return;
    }
    setGalatKustom(null);
    setFilter((current) => ({ ...current, preset: 'kustom', dari: draftDari, sampai: draftSampai }));
  }

  /**
   * The day's figures, in reading order. In landscape this is the first column;
   * in portrait it is the top of the one column. The same elements are used in
   * both frames, so no figure is computed or rendered twice.
   */
  const angka = (
    <>
      <Card padded testID="laporan-total" style={styles.total}>
        <AppText typeRole="labelSmall" tone="muted">
          Penjualan
        </AppText>
        <AppText typeRole="headlineSmall">{`Rp ${formatRupiah(report.penjualan)}`}</AppText>
        <AppText typeRole="bodySmall" tone="muted">
          {`${report.transaksi} transaksi`}
        </AppText>
      </Card>

      <Card padded style={styles.banding} testID="laporan-banding">
        <AppText typeRole="bodySmall" tone="muted">
          {`Periode sebelumnya (${labelRentang(report.rentangSebelumnya)})`}
        </AppText>
        <AppText typeRole="numericMedium">{`Rp ${formatRupiah(report.sebelumnya.penjualan)}`}</AppText>
        <AppText typeRole="bodySmall" tone={bandingTone(report.penjualan, report.sebelumnya.penjualan)}>
          {bandingLabel(report.penjualan, report.sebelumnya.penjualan)}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted">
          {`${report.sebelumnya.transaksi} transaksi`}
        </AppText>
      </Card>

      <View style={styles.basis}>
        <AppText typeRole="bodySmall" tone="muted" testID="laporan-dasar-hari">
          {report.dasar.hari}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted" testID="laporan-dasar-sinkron">
          {report.dasar.lastSyncAt ? `Tersinkron terakhir ${formatMoment(report.dasar.lastSyncAt)}.` : 'Belum pernah sinkron.'}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted" testID="laporan-dasar-belum-terkirim">
          {report.dasar.unsentCount > 0
            ? `${report.dasar.unsentCount} catatan belum terkirim.`
            : 'Semua catatan sudah terkirim.'}
        </AppText>
      </View>

      <View style={styles.toggle}>
        <ChipRow>
          <Chip label="Per hari" selected={tampilan === 'hari'} onPress={() => setTampilan('hari')} testID="tampilan-hari" />
          <Chip
            label="Per minggu"
            selected={tampilan === 'minggu'}
            onPress={() => setTampilan('minggu')}
            testID="tampilan-minggu"
          />
        </ChipRow>
      </View>

      <SectionHeading flush>Penjualan dari hari ke hari</SectionHeading>
      <Card>
        {tampilan === 'hari'
          ? report.perHari.map((titik, index) => (
              <TitikRow
                key={titik.kunci}
                label={tanggalPendek(titik.kunci)}
                titik={titik}
                divided={index > 0}
                testID={`laporan-hari-${titik.kunci}`}
              />
            ))
          : report.perMinggu.map((titik, index) => (
              <TitikRow
                key={titik.kunci}
                label={`${tanggalPendek(titik.kunci)}–${tanggalPendek(titik.sampai)}`}
                titik={titik}
                divided={index > 0}
                testID={`laporan-minggu-${titik.kunci}`}
              />
            ))}
      </Card>
    </>
  );

  /** The rankings, beside the figures in landscape and below them in portrait. */
  const peringkat = (
    <>
      <SectionHeading flush>Produk terlaris</SectionHeading>
      {report.produk.kind === 'cukup' ? (
        <Card>
          {report.produk.rows.map((row, index) => (
            <View
              key={row.id}
              style={[styles.peringkat, index > 0 && styles.peringkatDivided]}
              testID={`laporan-produk-${row.id}`}
            >
              <RowAvatar size={28} tone="action">
                <AppText typeRole="tabLabel" tone="primary">
                  {index + 1}
                </AppText>
              </RowAvatar>
              <AppText typeRole="titleSmall" style={styles.peringkatNama}>
                {`${index + 1}. ${row.nama}`}
              </AppText>
              <AppText typeRole="numericMedium">{`Rp ${formatRupiah(row.penjualan)}`}</AppText>
            </View>
          ))}
        </Card>
      ) : (
        <AppText typeRole="bodySmall" tone="muted" style={styles.kurang} testID="laporan-produk-kurang">
          {pesanKurang(report.produk)}
        </AppText>
      )}

      <SectionHeading flush>Peringkat per satuan</SectionHeading>
      <Note flush>Kilogram tidak pernah diadu dengan bungkus. Setiap satuan punya peringkatnya sendiri.</Note>
      {report.satuan.kind === 'cukup' ? (
        report.satuan.groups.map((group) => (
          <View key={group.satuan} testID={`laporan-satuan-${group.satuan}`} style={styles.grup}>
            <AppText typeRole="labelSmall" tone="muted" style={styles.grupJudul}>
              {`Peringkat per ${group.satuan}`}
            </AppText>
            <Card>
              {group.rows.map((row, index) => (
                <View
                  key={row.id}
                  style={[styles.peringkat, index > 0 && styles.peringkatDivided]}
                  testID={`laporan-satuan-${group.satuan}-${row.id}`}
                >
                  <AppText typeRole="titleSmall" style={styles.peringkatNama}>
                    {`${index + 1}. ${row.nama}`}
                  </AppText>
                  <AppText typeRole="numericMedium">
                    {`${formatQty(row.qty ?? 0)} ${group.satuan} · Rp ${formatRupiah(row.penjualan)}`}
                  </AppText>
                </View>
              ))}
            </Card>
          </View>
        ))
      ) : (
        <AppText typeRole="bodySmall" tone="muted" style={styles.kurang} testID="laporan-satuan-kurang">
          {pesanKurang(report.satuan)}
        </AppText>
      )}

      <SectionHeading flush>Total per kategori</SectionHeading>
      <Note flush>Total kategori menjumlahkan semua produk di dalamnya. Total satu produk adalah angka lain, dan keduanya ditulis terpisah.</Note>
      {report.kategori.length === 0 ? (
        <AppText typeRole="bodySmall" tone="muted" style={styles.kurang} testID="laporan-kategori-kosong">
          Belum ada penjualan di rentang ini.
        </AppText>
      ) : (
        <Card>
          {report.kategori.map((row, index) => (
            <View
              key={row.id}
              style={[styles.peringkat, index > 0 && styles.peringkatDivided]}
              testID={`laporan-kategori-${row.id}`}
            >
              <AppText typeRole="titleSmall" style={styles.peringkatNama}>
                {row.nama}
              </AppText>
              <AppText typeRole="numericMedium">{`Rp ${formatRupiah(row.penjualan)}`}</AppText>
            </View>
          ))}
        </Card>
      )}
    </>
  );

  return (
    <Screen title="Laporan" subtitle="Angka yang menjelaskan diri" role="Lainnya" onBack={onBack}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}>
          <ChipScroller>
            <Chip label="Hari ini" selected={filter.preset === 'hari'} onPress={() => pilihPreset('hari')} testID="filter-hari" />
            <Chip
              label="Minggu ini"
              selected={filter.preset === 'minggu'}
              onPress={() => pilihPreset('minggu')}
              testID="filter-minggu"
            />
            <Chip
              label="Bulan ini"
              selected={filter.preset === 'bulan'}
              onPress={() => pilihPreset('bulan')}
              testID="filter-bulan"
            />
            <Chip
              label="Pilih tanggal"
              selected={filter.preset === 'kustom'}
              onPress={pilihKustom}
              testID="filter-kustom"
            />
          </ChipScroller>

          {filter.preset === 'kustom' ? (
            <Card padded style={styles.kustom}>
              <Field
                label="Dari tanggal"
                value={draftDari}
                onChangeText={setDraftDari}
                placeholder="2026-11-01"
                testID="kustom-dari"
              />
              <Field
                label="Sampai tanggal"
                value={draftSampai}
                onChangeText={setDraftSampai}
                placeholder="2026-11-17"
                error={galatKustom}
                testID="kustom-sampai"
              />
              <Chip label="Terapkan rentang" selected={false} onPress={terapkanKustom} testID="terapkan-kustom" />
            </Card>
          ) : null}

          <ChipScroller>
            <Chip
              label="Semua kategori"
              selected={filter.kategoriId === null}
              onPress={() => setFilter((current) => ({ ...current, kategoriId: null }))}
              testID="filter-kategori-semua"
            />
            {kategori.map((entry) => (
              <Chip
                key={entry.id}
                label={entry.nama}
                selected={filter.kategoriId === entry.id}
                onPress={() => setFilter((current) => ({ ...current, kategoriId: entry.id }))}
                testID={`filter-kategori-${entry.id}`}
              />
            ))}
          </ChipScroller>

          <ChipRow>
            <Chip
              label={filter.varianId ? 'Ganti varian' : 'Pilih varian'}
              selected={filter.varianId !== null}
              onPress={() => setPilihVarian(true)}
              testID="pilih-barang"
            />
            {filter.varianId ? (
              <Chip
                label="Semua varian"
                selected={false}
                onPress={() => setFilter((current) => ({ ...current, varianId: null }))}
                testID="filter-barang-semua"
              />
            ) : null}
          </ChipRow>
        </View>

        <Card padded style={styles.applied} testID="laporan-filter">
          <AppText typeRole="titleSmall">{report.tampilanFilter.rentang}</AppText>
          <AppText typeRole="bodySmall" tone="muted">
            {`${report.tampilanFilter.kategori} · ${report.tampilanFilter.varian}`}
          </AppText>
        </Card>

        {wide ? (
          <View style={styles.columns} testID="laporan-kolom">
            <View style={styles.column} testID="laporan-kolom-kiri">
              {angka}
            </View>
            <View style={styles.column} testID="laporan-kolom-kanan">
              {peringkat}
            </View>
          </View>
        ) : (
          <>
            {angka}
            {peringkat}
          </>
        )}

        <Note flush>
          Angka di laporan ini adalah nilai barang yang terjual, sebelum diskon. Kas dan Riwayat menampilkan yang
          dibayar pelanggan.
        </Note>
      </ScrollView>

      <BottomSheet
        visible={pilihVarian}
        onClose={() => setPilihVarian(false)}
        title="Pilih varian"
        testID="sheet-barang"
      >
        <ScrollView>
          <Card>
            <CardRow
              onPress={() => {
                setFilter((current) => ({ ...current, varianId: null }));
                setPilihVarian(false);
              }}
              testID="filter-barang-semua"
            >
              <AppText typeRole="titleSmall">Semua varian</AppText>
            </CardRow>
            {barang.map((entry, index) => (
              <CardRow
                key={entry.id}
                divided={index > 0}
                onPress={() => {
                  setFilter((current) => ({ ...current, varianId: entry.id }));
                  setPilihVarian(false);
                }}
                testID={`filter-barang-${entry.id}`}
              >
                <AppText typeRole="titleSmall" style={styles.peringkatNama} numberOfLines={1}>
                  {entry.nama}
                </AppText>
                <AppText typeRole="bodySmall" tone="muted">
                  {entry.satuan}
                </AppText>
              </CardRow>
            ))}
          </Card>
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

/** One day or week of the sales-over-time view. */
function TitikRow({
  label,
  titik,
  testID,
  divided,
}: {
  label: string;
  titik: LaporanTitik;
  testID: string;
  divided: boolean;
}) {
  return (
    <View style={[styles.titik, divided && styles.peringkatDivided]} testID={testID}>
      <AppText typeRole="bodySmall" tone="muted">
        {label}
      </AppText>
      <AppText typeRole="numericMedium" tone={titik.penjualan === 0 ? 'muted' : 'default'}>
        {`Rp ${formatRupiah(titik.penjualan)} · ${titik.transaksi} transaksi`}
      </AppText>
    </View>
  );
}

/** Why a ranking is not shown, in the owner's words. */
function pesanKurang(peringkat: Extract<LaporanPeringkat, { kind: 'kurang' }>): string {
  if (peringkat.sebab === 'belum-ada') {
    return 'Belum ada penjualan di rentang ini, jadi belum ada yang bisa disebut terlaris.';
  }
  return `Riwayat baru ${peringkat.hari} hari penjualan. Peringkat baru bisa disebut setelah ${MIN_HARI_LAPORAN} hari, supaya tiga hari jualan tidak terbaca sebagai fakta.`;
}

/** The comparison in the owner's words: up, down, or the same. */
function bandingLabel(kini: number, lalu: number): string {
  const selisih = kini - lalu;
  if (selisih === 0) return 'Sama dengan periode sebelumnya.';
  if (selisih > 0) return `Naik Rp ${formatRupiah(selisih)} dari periode sebelumnya.`;
  return `Turun Rp ${formatRupiah(-selisih)} dari periode sebelumnya.`;
}

function bandingTone(kini: number, lalu: number): 'primary' | 'muted' {
  if (kini === lalu) return 'muted';
  // Up is ink; down is simply a smaller number. A quieter month is not a debt,
  // so red stays out of the comparison.
  return kini > lalu ? 'primary' : 'muted';
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.sm },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  column: { flex: 1, minWidth: 0, gap: space.sm },
  filters: { gap: space.sm },
  applied: { gap: 1 },
  total: { gap: space.xs },
  basis: { gap: 2, paddingTop: space.xs },
  banding: { gap: 2 },
  kustom: { gap: space.sm },
  toggle: { paddingTop: space.sm },
  titik: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  peringkat: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  peringkatDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  peringkatNama: { flex: 1, paddingRight: space.sm },
  kurang: { paddingVertical: space.xs },
  grup: { gap: space.xs },
  grupJudul: { letterSpacing: 0.9 },
});
