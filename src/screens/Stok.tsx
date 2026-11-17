import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  ChipRow,
  Field,
  Note,
  Screen,
  SectionHeading,
  StockBadge,
  colors,
  formatQty,
  formatRupiah,
  parseQty,
  parseRupiah,
  space,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
import {
  bulkOf,
  teks,
  type BulkContext,
  type JualBy,
  type LowCheck,
  type LowRule,
  type Satuan,
  type StockState,
  type Varian,
} from '@/ledger';
import { useApp } from '@/ledger/useLedger';

const SATUAN: readonly Satuan[] = ['pcs', 'bungkus', 'kg', 'liter', 'sak'];
const JUAL: readonly { value: JualBy; label: string }[] = [
  { value: 'unit', label: teks.jualSatuan },
  { value: 'weight', label: teks.jualBerat },
];

/**
 * Stok — where the shop's product list is made, and its stock is read.
 *
 * Stock is never stored: every number here is folded from the log by the
 * seam (`stockRows`, `stockOf`, `stockHistory`). A varian nobody has counted
 * reads "Belum dihitung", not zero, and a negative count is red and first in
 * the list (DESIGN.md: red is a promise, and this is the promise being broken).
 */
export function StokScreen() {
  const { shop, stockRows, lowChecks } = useApp();
  const [form, setForm] = useState<'kategori' | 'produk' | 'varian' | null>(null);
  const [kategoriId, setKategoriId] = useState<string | null>(null);
  const [produkId, setProdukId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'hitung' | 'minimum' | 'riwayat'; varianId: string } | null>(null);

  /**
   * Every varian in the order the list reads in (negative first, then low,
   * unknown, the rest — see `sortStock`), and the count already derived for
   * it, so the row, the badge and the history can never disagree. Groups
   * keep the order they arrive in; the varian lines are looked up from here.
   */
  const ranked = stockRows();
  const checks = lowChecks();
  const order = new Map(ranked.map((row, index) => [row.varian.id, index]));
  const stock = new Map(ranked.map((row) => [row.varian.id, row.stock]));
  const ordered = (entry: Varian) => order.get(entry.id) ?? Number.MAX_SAFE_INTEGER;
  /** A kategori's rank is the rank of its most urgent varian. */
  const groupRank = (kategoriId: string) => {
    const produkIds = new Set(shop.produk.filter((entry) => entry.kategoriId === kategoriId).map((entry) => entry.id));
    const ranks = shop.varian.filter((entry) => produkIds.has(entry.produkId)).map(ordered);
    return ranks.length === 0 ? Number.MAX_SAFE_INTEGER : Math.min(...ranks);
  };
  const sheetVarian = sheet ? shop.varian.find((entry) => entry.id === sheet.varianId) ?? null : null;

  function close() {
    setForm(null);
    setKategoriId(null);
    setProdukId(null);
  }

  return (
    <Screen
      title="Barang"
      overline="Stok"
      actions={<IconButton name="add" label="Tambah barang" onPress={() => setForm('kategori')} testID="tambah-barang" />}
    >
      <ScrollView contentContainerStyle={styles.content}>
        {shop.kategori.length === 0 ? <Note>{teks.belumAdaKategori}</Note> : null}

        {[...shop.kategori]
          // Groups follow the most urgent varian inside them, so a red varian
          // never hides under a kategori that happens to sort first.
          .sort((a, b) => groupRank(a.id) - groupRank(b.id))
          .map((kategori) => {
          const produk = shop.produk.filter((entry) => entry.kategoriId === kategori.id && !entry.archived);
          return (
            <View key={kategori.id}>
              <View style={styles.kategoriRow}>
                <SectionHeading>{kategori.nama}</SectionHeading>
                <View style={styles.kategoriAdd}>
                  <IconButton
                    name="add-circle-outline"
                    label={`Tambah produk di ${kategori.nama}`}
                    onPress={() => {
                      setKategoriId(kategori.id);
                      setForm('produk');
                    }}
                    testID={`tambah-produk-${kategori.id}`}
                  />
                </View>
              </View>
              {produk.length === 0 ? (
                <AppText typeRole="bodyMedium" tone="muted" style={styles.empty}>
                  {teks.belumAdaProduk}
                </AppText>
              ) : null}
              {produk.map((entry) => {
                const varian = shop.varian
                  .filter((item) => item.produkId === entry.id && !item.archived)
                  .sort((a, b) => ordered(a) - ordered(b));
                return (
                  <View key={entry.id}>
                    <View style={styles.produkRow}>
                      <AppText typeRole="bodyLarge" style={styles.produkName} numberOfLines={1}>
                        {entry.nama}
                      </AppText>
                      <IconButton
                        name="add"
                        label={`Tambah varian di ${entry.nama}`}
                        onPress={() => {
                          setKategoriId(kategori.id);
                          setProdukId(entry.id);
                          setForm('varian');
                        }}
                        testID={`tambah-varian-${entry.id}`}
                      />
                    </View>
                    {varian.map((item) => (
                      <VarianLine
                        key={item.id}
                        varian={item}
                        stock={stock.get(item.id) ?? { kind: 'unknown' }}
                        check={checks.get(item.id) ?? { kind: 'tidakTahu', sebab: 'belum-dihitung' }}
                        bulk={bulkOf(shop, item, (id) => stock.get(id) ?? { kind: 'unknown' })}
                        onCount={() => setSheet({ kind: 'hitung', varianId: item.id })}
                        onMinimum={() => setSheet({ kind: 'minimum', varianId: item.id })}
                        onHistory={() => setSheet({ kind: 'riwayat', varianId: item.id })}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          );
          })}
      </ScrollView>

      <BottomSheet visible={form === 'kategori'} onClose={close} title={teks.tambahKategori} testID="form-kategori">
        <KategoriForm onDone={close} />
      </BottomSheet>

      <BottomSheet
        visible={form === 'produk' && kategoriId !== null}
        onClose={close}
        title={teks.tambahProduk}
        testID="form-produk"
      >
        {kategoriId ? <ProdukForm kategoriId={kategoriId} onDone={close} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={form === 'varian' && produkId !== null}
        onClose={close}
        title={teks.tambahVarian}
        testID="form-varian"
      >
        {produkId ? <VarianForm produkId={produkId} onDone={close} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'hitung' && sheetVarian !== null}
        onClose={() => setSheet(null)}
        title={sheetVarian ? `Hitung ${sheetVarian.nama}` : teks.hitungUlang}
        testID="form-hitung"
      >
        {sheetVarian ? <CountForm varian={sheetVarian} onDone={() => setSheet(null)} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'minimum' && sheetVarian !== null}
        onClose={() => setSheet(null)}
        title={sheetVarian ? `Minimum ${sheetVarian.nama}` : teks.minimumStok}
        testID="form-minimum"
      >
        {sheetVarian ? <MinimumForm varian={sheetVarian} onDone={() => setSheet(null)} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'riwayat' && sheetVarian !== null}
        onClose={() => setSheet(null)}
        title={sheetVarian ? `Riwayat stok ${sheetVarian.nama}` : 'Riwayat stok'}
        testID="form-riwayat"
      >
        {sheetVarian ? <HistoryList varian={sheetVarian} /> : null}
      </BottomSheet>
    </Screen>
  );
}

const signed = (qty: number) => (qty > 0 ? `+${formatQty(qty)}` : formatQty(qty));

/**
 * Why a varian is low, in the owner's words. A warning never appears without
 * the rule that fired, so it can be trusted instead of tuned out.
 */
function lowReason(rule: LowRule): string {
  switch (rule.kind) {
    case 'minimum':
      return `Rendah: di bawah minimum ${formatQty(rule.minimum)}`;
    case 'kecepatan':
      return `Rendah: terjual ${formatQty(rule.sold)} dalam ${rule.hari} hari`;
    case 'habis':
      return 'Rendah: stok habis';
    case 'selisih':
      return 'Rendah: stok minus, hitung ulang';
  }
}

/**
 * The sack stock beside a low packet, and the word it implies. The app shows
 * the fact; it never suggests how many to repack or order.
 */
function bulkCopy(bulk: BulkContext): string {
  const reading = bulk.stock.kind === 'counted' ? formatQty(bulk.stock.qty) : 'belum dihitung';
  if (bulk.choice === 'repack') return `Stok sak: ${reading} · Repack`;
  if (bulk.choice === 'reorder') return `Stok sak: ${reading} · Reorder`;
  return `Stok sak: ${reading}`;
}

/**
 * One sellable size, on a ruled line: name, satuan, the count the log derives,
 * and its state in words beside the number so colour is never the only signal.
 * A negative count makes the whole row red and keeps the sign visible.
 */
/**
 * One sellable size, on a ruled line: name, satuan, the count the log derives,
 * and its state in words beside the number so colour is never the only signal.
 * A negative count makes the whole row red and keeps the sign visible.
 */
function VarianLine({
  varian,
  stock,
  check,
  bulk,
  onCount,
  onMinimum,
  onHistory,
}: {
  varian: Varian;
  stock: StockState;
  check: LowCheck;
  bulk: BulkContext | null;
  onCount: () => void;
  onMinimum: () => void;
  onHistory: () => void;
}) {
  const negative = stock.kind === 'counted' && stock.qty < 0;
  const reading = stock.kind === 'unknown' ? 'Stok belum dihitung' : `Stok ${formatQty(stock.qty)}`;
  const rule = varian.minimum != null ? `minimum ${formatQty(varian.minimum)}` : 'tanpa minimum';

  return (
    <Pressable
      testID={`stok-baris-${varian.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${varian.nama}, ${reading}`}
      onPress={onCount}
      style={[styles.varianRow, negative ? styles.varianNegative : null]}
    >
      <View style={styles.varianMain}>
        <AppText typeRole="bodyLarge" numberOfLines={1} tone={negative ? 'owed' : 'default'}>
          {varian.nama}
        </AppText>
        <AppText typeRole="labelSmall" tone={negative ? 'owed' : 'muted'}>
          {`${formatRupiah(varian.harga)} · per ${varian.satuan} · ${rule}`}
        </AppText>
        {check.kind === 'rendah' ? (
          <AppText
            typeRole="labelSmall"
            tone={negative ? 'owed' : 'default'}
            testID={`alasan-rendah-${varian.id}`}
          >
            {lowReason(check.rule)}
          </AppText>
        ) : null}
        {check.kind === 'rendah' && bulk ? (
          <AppText typeRole="labelSmall" tone="muted" testID={`sak-${varian.id}`}>
            {bulkCopy(bulk)}
          </AppText>
        ) : null}
        {check.kind === 'tidakTahu' && check.sebab === 'riwayat-terlalu-sedikit' ? (
          <AppText typeRole="labelSmall" tone="muted" testID={`alasan-tidak-tahu-${varian.id}`}>
            Riwayat penjualan belum cukup untuk menilai. Atur minimum untuk peringatan.
          </AppText>
        ) : null}
      </View>
      <View style={styles.rowButtons}>
        <IconButton name="add-circle-outline" label={`Hitung stok ${varian.nama}`} onPress={onCount} testID={`hitung-${varian.id}`} />
        <IconButton name="tune" label={`Atur minimum ${varian.nama}`} onPress={onMinimum} testID={`minimum-${varian.id}`} />
        <IconButton name="history" label={`Riwayat stok ${varian.nama}`} onPress={onHistory} testID={`riwayat-${varian.id}`} />
      </View>
      <StockBadge
        qty={stock.kind === 'counted' ? stock.qty : null}
        minimum={varian.minimum ?? null}
        low={check.kind === 'rendah'}
        testID={`stok-angka-${varian.id}`}
      />
    </Pressable>
  );
}
/**
 * The correction, in the owner's terms: the number actually on the shelf. The
 * seam turns it into a delta from what the app believed and keeps their reason
 * beside it, so two corrections add up instead of overwriting.
 */
function CountForm({ varian, onDone }: { varian: Varian; onDone: () => void }) {
  const { adjustStock, stockOf } = useApp();
  const [jumlah, setJumlah] = useState('');
  const [alasan, setAlasan] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    const counted = parseQty(jumlah);
    if (counted === null) {
      setError('Jumlah harus angka. Contoh: 12 atau 12,5');
      return;
    }
    try {
      await adjustStock({ varianId: varian.id, counted, reason: alasan });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  const stock = stockOf(varian.id);
  return (
    <>
      <AppText typeRole="bodyMedium" tone="muted">
        {stock.kind === 'unknown'
          ? 'Aplikasi belum pernah menghitung barang ini.'
          : `Aplikasi mencatat ${formatQty(stock.qty)} ${varian.satuan}. Tulis berapa yang benar-benar ada di rak.`}
      </AppText>
      <Field
        label={`Jumlah di rak (${varian.satuan})`}
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="decimal-pad"
        placeholder="12"
        testID="hitung-jumlah"
      />
      <Field
        label={teks.alasan}
        value={alasan}
        onChangeText={setAlasan}
        placeholder="Contoh: hitung gudang, ada yang pecah"
        error={error}
        testID="hitung-alasan"
      />
      <Note>{teks.hitungPenjelasan}</Note>
      <Button label={teks.simpan} onPress={submit} testID="simpan-hitung" />
    </>
  );
}

/** The owner's own low-stock rule for one varian (user story 41). */
function MinimumForm({ varian, onDone }: { varian: Varian; onDone: () => void }) {
  const { catalog } = useApp();
  const [jumlah, setJumlah] = useState(varian.minimum != null ? formatQty(varian.minimum) : '');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!catalog) return;
    const minimum = jumlah.trim() === '' ? null : parseQty(jumlah);
    if (jumlah.trim() !== '' && minimum === null) {
      setError('Minimum harus angka. Contoh: 5');
      return;
    }
    try {
      await catalog.setMinimum(varian.id, minimum);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field
        label={`Peringatkan jika di bawah (${varian.satuan})`}
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="decimal-pad"
        placeholder="5"
        error={error}
        testID="minimum-jumlah"
      />
      <Note>{teks.minimumPenjelasan}</Note>
      <Button label={teks.simpan} onPress={submit} testID="simpan-minimum" />
    </>
  );
}

/**
 * Everything that moved this varian's count, oldest first — sales and
 * corrections alike — each with the count after it. A correction reads as its
 * delta, never as "now 8": what was written is what is shown.
 */
function HistoryList({ varian }: { varian: Varian }) {
  const { stockHistory } = useApp();
  const entries = stockHistory(varian.id);

  if (entries.length === 0) {
    return <Note>{`Belum ada yang mengubah stok ${varian.nama}.`}</Note>;
  }

  return (
    <View testID="riwayat-daftar">
      {[...entries].reverse().map((entry) => (
        <View
          key={entry.kind === 'sale' ? `${entry.saleId}-${entry.at}` : entry.eventId}
          style={styles.historyRow}
        >
          <View style={styles.varianMain}>
            <AppText typeRole="bodyMedium" numberOfLines={1}>
              {entry.kind === 'adjusted'
                ? entry.reason
                : entry.kind === 'received'
                  ? entry.settlement === 'titip'
                    ? 'Titip dari supplier'
                    : 'Barang masuk'
                  : 'Penjualan'}
            </AppText>
            <AppText typeRole="labelSmall" tone="muted">
              {`${tanggal(entry.at)} · sisa ${formatQty(entry.after)} ${varian.satuan}`}
            </AppText>
          </View>
          <AppText typeRole="numericMedium" tone={entry.delta < 0 ? 'owed' : 'default'} align="right">
            {signed(entry.delta)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/** A moment as the shop writes it: 31/10 14.20. */
function tanggal(at: string): string {
  const moment = new Date(at);
  const pad = (value: number) => String(value).padStart(2, '0');
  return `${pad(moment.getDate())}/${pad(moment.getMonth() + 1)} ${pad(moment.getHours())}.${pad(moment.getMinutes())}`;
}
function KategoriForm({ onDone }: { onDone: () => void }) {
  const { catalog } = useApp();
  const [nama, setNama] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!catalog) return;
    try {
      await catalog.createKategori({ nama });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label={teks.nama} value={nama} onChangeText={setNama} autoFocus error={error} testID="kategori-nama" />
      <Button label={teks.simpan} onPress={submit} testID="simpan-kategori" />
    </>
  );
}

function ProdukForm({ kategoriId, onDone }: { kategoriId: string; onDone: () => void }) {
  const { catalog } = useApp();
  const [nama, setNama] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!catalog) return;
    try {
      await catalog.createProduk({ kategoriId, nama });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label={teks.nama} value={nama} onChangeText={setNama} autoFocus error={error} testID="produk-nama" />
      <Button label={teks.simpan} onPress={submit} testID="simpan-produk" />
    </>
  );
}

/**
 * The varian form. Satuan is picked here and the note underneath says it is
 * final, because the ledger has no event that could change it afterwards.
 */
function VarianForm({ produkId, onDone }: { produkId: string; onDone: () => void }) {
  const { catalog } = useApp();
  const [nama, setNama] = useState('');
  const [kode, setKode] = useState('');
  const [satuan, setSatuan] = useState<Satuan>('pcs');
  const [jualBy, setJualBy] = useState<JualBy>('unit');
  const [harga, setHarga] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!catalog) return;
    const rupiah = parseRupiah(harga);
    if (rupiah === null) {
      setError('Harga harus angka. Contoh: 13.500');
      return;
    }
    try {
      await catalog.createVarian({ produkId, nama, kode, satuan, jualBy, harga: rupiah });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field
        label={teks.nama}
        value={nama}
        onChangeText={setNama}
        placeholder="Tepung terigu 1 kg"
        autoFocus
        testID="varian-nama"
      />
      <Field label={teks.kode} value={kode} onChangeText={setKode} autoCapitalize="characters" testID="varian-kode" />

      <AppText typeRole="labelSmall" tone="muted" style={styles.pickLabel}>
        {teks.satuan}
      </AppText>
      <ChipRow>
        {SATUAN.map((unit) => (
          <Chip key={unit} label={unit} selected={satuan === unit} onPress={() => setSatuan(unit)} testID={`satuan-${unit}`} />
        ))}
      </ChipRow>
      <Note>{teks.satuanTetap}</Note>

      <AppText typeRole="labelSmall" tone="muted" style={styles.pickLabel}>
        {teks.dijual}
      </AppText>
      <ChipRow>
        {JUAL.map((option) => (
          <Chip
            key={option.value}
            label={option.label}
            selected={jualBy === option.value}
            onPress={() => setJualBy(option.value)}
            testID={`jual-${option.value}`}
          />
        ))}
      </ChipRow>

      <Field
        label={teks.harga}
        value={harga}
        onChangeText={setHarga}
        keyboardType="number-pad"
        placeholder="13.500"
        error={error}
        testID="varian-harga"
      />
      <Button label={teks.simpan} onPress={submit} testID="simpan-varian" />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.lg },
  kategoriRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: space.md },
  kategoriAdd: { paddingTop: space.lg },
  empty: { paddingHorizontal: space.gutter, paddingVertical: space.xs },
  produkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.gutter,
    paddingRight: space.sm,
    minHeight: 40,
    backgroundColor: colors.surface,
  },
  produkName: { flex: 1 },
  varianRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: space.gutter + space.md,
    paddingRight: space.gutter,
    minHeight: space.row + 8,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  varianMain: { flex: 1 },
  // Red is a promise (DESIGN.md): a negative count is that promise broken, so
  // it reads in the same ink as a debt, and it sits at the top of the list.
  varianNegative: { borderLeftWidth: 3, borderLeftColor: colors.error, paddingLeft: space.gutter + space.md - 3 },
  rowButtons: { flexDirection: 'row', alignItems: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  pickLabel: { paddingBottom: space.xs },
});
