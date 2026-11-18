import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Chip,
  ChipRow,
  Field,
  Note,
  RuledRow,
  Screen,
  SectionHeading,
  colors,
  formatMoment,
  formatQty,
  formatRupiah,
  space,
  useFrame,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
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
      <SectionHeading>Dasar laporan</SectionHeading>
      <View style={styles.basis}>
        <AppText typeRole="bodyMedium" tone="muted" testID="laporan-dasar-hari">
          {report.dasar.hari}
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted" testID="laporan-dasar-sinkron">
          {report.dasar.lastSyncAt ? `Tersinkron terakhir ${formatMoment(report.dasar.lastSyncAt)}.` : 'Belum pernah sinkron.'}
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted" testID="laporan-dasar-belum-terkirim">
          {report.dasar.unsentCount > 0
            ? `${report.dasar.unsentCount} catatan belum terkirim.`
            : 'Semua catatan sudah terkirim.'}
        </AppText>
      </View>

      <View style={styles.total} testID="laporan-total">
        <AppText typeRole="labelSmall" tone="muted">
          Penjualan
        </AppText>
        <AppText typeRole="numericLarge">{`Rp ${formatRupiah(report.penjualan)}`}</AppText>
        <AppText typeRole="bodyMedium" tone="muted">
          {`${report.transaksi} transaksi`}
        </AppText>
      </View>

      <View style={styles.banding} testID="laporan-banding">
        <AppText typeRole="bodyMedium" tone="muted">
          {`Periode sebelumnya (${labelRentang(report.rentangSebelumnya)}): Rp ${formatRupiah(
            report.sebelumnya.penjualan,
          )} · ${report.sebelumnya.transaksi} transaksi`}
        </AppText>
        <AppText typeRole="bodyMedium" tone={bandingTone(report.penjualan, report.sebelumnya.penjualan)}>
          {bandingLabel(report.penjualan, report.sebelumnya.penjualan)}
        </AppText>
      </View>

      <SectionHeading>Penjualan dari hari ke hari</SectionHeading>
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

      {tampilan === 'hari'
        ? report.perHari.map((titik) => (
            <TitikRow key={titik.kunci} label={tanggalPendek(titik.kunci)} titik={titik} testID={`laporan-hari-${titik.kunci}`} />
          ))
        : report.perMinggu.map((titik) => (
            <TitikRow
              key={titik.kunci}
              label={`${tanggalPendek(titik.kunci)}–${tanggalPendek(titik.sampai)}`}
              titik={titik}
              testID={`laporan-minggu-${titik.kunci}`}
            />
          ))}
    </>
  );

  /** The rankings, beside the figures in landscape and below them in portrait. */
  const peringkat = (
    <>
      <SectionHeading>Produk terlaris</SectionHeading>
      {report.produk.kind === 'cukup' ? (
        report.produk.rows.map((row, index) => (
          <View key={row.id} style={styles.peringkat} testID={`laporan-produk-${row.id}`}>
            <AppText typeRole="bodyLarge" style={styles.peringkatNama}>
              {`${index + 1}. ${row.nama}`}
            </AppText>
            <AppText typeRole="numericLarge">{`Rp ${formatRupiah(row.penjualan)}`}</AppText>
          </View>
        ))
      ) : (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.kurang} testID="laporan-produk-kurang">
          {pesanKurang(report.produk)}
        </AppText>
      )}

      <SectionHeading>Peringkat per satuan</SectionHeading>
      <Note>Kilogram tidak pernah diadu dengan bungkus. Setiap satuan punya peringkatnya sendiri.</Note>
      {report.satuan.kind === 'cukup' ? (
        report.satuan.groups.map((group) => (
          <View key={group.satuan} testID={`laporan-satuan-${group.satuan}`}>
            <AppText typeRole="titleMedium" tone="primary" style={styles.grupJudul}>
              {`Peringkat per ${group.satuan}`}
            </AppText>
            {group.rows.map((row, index) => (
              <View key={row.id} style={styles.peringkat} testID={`laporan-satuan-${group.satuan}-${row.id}`}>
                <AppText typeRole="bodyLarge" style={styles.peringkatNama}>
                  {`${index + 1}. ${row.nama}`}
                </AppText>
                <AppText typeRole="numericMedium">
                  {`${formatQty(row.qty ?? 0)} ${group.satuan} · Rp ${formatRupiah(row.penjualan)}`}
                </AppText>
              </View>
            ))}
          </View>
        ))
      ) : (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.kurang} testID="laporan-satuan-kurang">
          {pesanKurang(report.satuan)}
        </AppText>
      )}

      <SectionHeading>Total per kategori</SectionHeading>
      <Note>Total kategori menjumlahkan semua produk di dalamnya. Total satu produk adalah angka lain, dan keduanya ditulis terpisah.</Note>
      {report.kategori.length === 0 ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.kurang} testID="laporan-kategori-kosong">
          Belum ada penjualan di rentang ini.
        </AppText>
      ) : (
        report.kategori.map((row) => (
          <View key={row.id} style={styles.peringkat} testID={`laporan-kategori-${row.id}`}>
            <AppText typeRole="bodyLarge" style={styles.peringkatNama}>
              {row.nama}
            </AppText>
            <AppText typeRole="numericLarge">{`Rp ${formatRupiah(row.penjualan)}`}</AppText>
          </View>
        ))
      )}
    </>
  );

  return (
    <Screen
      title="Laporan"
      overline="Penjualan"
      actions={
        onBack ? <IconButton name="arrow-back" label="Kembali" onPress={onBack} testID="kembali-dari-laporan" /> : undefined
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.filters}>
          <ChipRow>
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
          </ChipRow>

          {filter.preset === 'kustom' ? (
            <View style={styles.kustom}>
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
            </View>
          ) : null}

          <ChipRow>
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
          </ChipRow>

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

        <View style={styles.applied} testID="laporan-filter">
          <AppText typeRole="bodyMedium">{report.tampilanFilter.rentang}</AppText>
          <AppText typeRole="labelSmall" tone="muted">
            {`${report.tampilanFilter.kategori} · ${report.tampilanFilter.varian}`}
          </AppText>
        </View>

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

        <Note>
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
          <RuledRow
            title="Semua varian"
            onPress={() => {
              setFilter((current) => ({ ...current, varianId: null }));
              setPilihVarian(false);
            }}
            testID="filter-barang-semua"
          />
          {barang.map((entry) => (
            <RuledRow
              key={entry.id}
              title={entry.nama}
              value={entry.satuan}
              onPress={() => {
                setFilter((current) => ({ ...current, varianId: entry.id }));
                setPilihVarian(false);
              }}
              testID={`filter-barang-${entry.id}`}
            />
          ))}
        </ScrollView>
      </BottomSheet>
    </Screen>
  );
}

/** One day or week of the sales-over-time view. */
function TitikRow({ label, titik, testID }: { label: string; titik: LaporanTitik; testID: string }) {
  return (
    <View style={styles.titik} testID={testID}>
      <AppText typeRole="bodyMedium">{label}</AppText>
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
  content: { paddingBottom: space.xxl },
  columns: { flexDirection: 'row', alignItems: 'flex-start', gap: space.xl },
  column: { flex: 1, minWidth: 0 },
  filters: { paddingHorizontal: space.gutter, paddingTop: space.md },
  applied: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    gap: 2,
  },
  total: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    gap: space.xs,
  },
  basis: { paddingHorizontal: space.gutter, gap: space.xs },
  banding: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    gap: 2,
  },
  kustom: { paddingBottom: space.sm },
  toggle: { paddingHorizontal: space.gutter },
  titik: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  peringkat: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  peringkatNama: { flex: 1, paddingRight: space.sm },
  kurang: { paddingHorizontal: space.gutter, paddingVertical: space.sm },
  grupJudul: { paddingHorizontal: space.gutter, paddingTop: space.md, paddingBottom: space.xs },
});
