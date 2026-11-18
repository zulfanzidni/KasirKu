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
  SplitPane,
  StockBadge,
  colors,
  formatMoment,
  formatQty,
  formatRupiah,
  parseQty,
  parseRupiah,
  space,
  useFrame,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
import {
  bulkOf,
  teks,
  SATUAN,
  type BulkContext,
  type JualBy,
  type Kategori,
  type LowCheck,
  type LowRule,
  type Produk,
  type Satuan,
  type StockState,
  type Varian,
} from '@/ledger';
import { useApp } from '@/ledger/useLedger';
import { ImporScreen } from '@/screens/Impor';

/** The group a produk falls into when its kategori is archived or absent. */
const TANPA_KATEGORI = 'tanpa-kategori';
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
  const { shop, stockRows, lowChecks, titipOf } = useApp();
  const [form, setForm] = useState<'kategori' | 'produk' | 'varian' | null>(null);
  const [kategoriId, setKategoriId] = useState<string | null>(null);
  const [produkId, setProdukId] = useState<string | null>(null);
  const [sheet, setSheet] = useState<{ kind: 'hitung' | 'minimum' | 'riwayat'; varianId: string } | null>(null);
  const [edit, setEdit] = useState<{ kind: 'kategori' | 'produk'; id: string } | null>(null);
  const [opening, setOpening] = useState(false);
  const [mode, setMode] = useState<'daftar' | 'impor'>('daftar');
  /** The varian the landscape pane is about; portrait never shows it. */
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { wide } = useFrame();

  if (mode === 'impor') return <ImporScreen onBack={() => setMode('daftar')} />;

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
  const editKategori = edit?.kind === 'kategori' ? shop.kategori.find((entry) => entry.id === edit.id) ?? null : null;
  const editProduk = edit?.kind === 'produk' ? shop.produk.find((entry) => entry.id === edit.id) ?? null : null;
  /** The variants the setup pass still has a question about: nobody has counted them. */
  const belumDihitung = ranked.filter((row) => row.stock.kind === 'unknown').map((row) => row.varian);

  /**
   * The varian the pane is about. It is one piece of screen state, so a search
   * or an archive never silently re-points it, and rotating does not lose it.
   * `visible` is the same test the list applies: a varian whose produk is
   * archived has left the list, even though the log still holds it.
   */
  const selected = selectedId ? shop.varian.find((entry) => entry.id === selectedId) ?? null : null;
  const selectedProduk = selected ? shop.produk.find((entry) => entry.id === selected.produkId) ?? null : null;
  const selectedVisible = selected !== null && !selected.archived && selectedProduk !== null && !selectedProduk.archived;

  /**
   * The list is grouped by kategori, and a produk whose kategori is archived
   * (or that never had one) still has a home: "Tanpa kategori". Archiving a
   * kategori therefore never hides its produk (ticket 13).
   */
  const kategoriAktif = shop.kategori.filter((entry) => !entry.archived);
  const kategoriAktifIds = new Set(kategoriAktif.map((entry) => entry.id));
  const groupOf = (entry: Produk) =>
    entry.kategoriId !== null && kategoriAktifIds.has(entry.kategoriId) ? entry.kategoriId : TANPA_KATEGORI;
  const groups: { id: string; nama: string; kategoriId: string | null }[] = [
    ...kategoriAktif.map((entry) => ({ id: entry.id, nama: entry.nama, kategoriId: entry.id })),
    ...(shop.produk.some((entry) => !entry.archived && groupOf(entry) === TANPA_KATEGORI)
      ? [{ id: TANPA_KATEGORI, nama: teks.tanpaKategori, kategoriId: null }]
      : []),
  ];

  function close() {
    setForm(null);
    setKategoriId(null);
    setProdukId(null);
  }

  /**
   * A tap on a row selects it in landscape, where there is a pane to fill. In
   * portrait there is no pane, so the tap keeps its old job: open the count.
   */
  function pressRow(varianId: string) {
    if (wide) setSelectedId(varianId);
    else setSheet({ kind: 'hitung', varianId });
  }

  /** An action on a row also points the landscape pane at that varian. */
  function openSheet(varianId: string, kind: 'hitung' | 'minimum' | 'riwayat') {
    if (wide) setSelectedId(varianId);
    setSheet({ kind, varianId });
  }

  /** The detail pane: this varian's own stock, its movements, and its actions. */
  const pane = selectedVisible && selected ? (
    <StokPane
      varian={selected}
      stock={stock.get(selected.id) ?? { kind: 'unknown' }}
      titip={titipOf(selected.id)}
      check={checks.get(selected.id) ?? { kind: 'tidakTahu', sebab: 'belum-dihitung' }}
      bulk={bulkOf(shop, selected, (id) => stock.get(id) ?? { kind: 'unknown' })}
      onCount={() => setSheet({ kind: 'hitung', varianId: selected.id })}
      onMinimum={() => setSheet({ kind: 'minimum', varianId: selected.id })}
    />
  ) : selected ? (
    <AppText typeRole="bodyMedium" tone="muted" testID="pane-hilang">
      Barang ini tidak ada di daftar.
    </AppText>
  ) : (
    <AppText typeRole="bodyMedium" tone="muted" style={styles.paneEmpty}>
      Pilih barang
    </AppText>
  );

  const list = (
    <ScrollView contentContainerStyle={styles.content}>
        {shop.kategori.length === 0 ? <Note>{teks.belumAdaKategori}</Note> : null}

        {groups
          // Groups follow the most urgent varian inside them, so a red varian
          // never hides under a kategori that happens to sort first.
          .sort((a, b) => groupRank(a.id) - groupRank(b.id))
          .map((group) => {
          const produk = shop.produk.filter((entry) => !entry.archived && groupOf(entry) === group.id);
          return (
            <View key={group.id}>
              <View style={styles.kategoriRow}>
                <SectionHeading>{group.nama}</SectionHeading>
                <View style={styles.kategoriActions}>
                  {group.kategoriId ? (
                    <IconButton
                      name="edit"
                      label={`Ubah kategori ${group.nama}`}
                      onPress={() => setEdit({ kind: 'kategori', id: group.kategoriId as string })}
                      testID={`ubah-kategori-${group.kategoriId}`}
                    />
                  ) : null}
                  {group.kategoriId ? (
                    <IconButton
                      name="add-circle-outline"
                      label={`Tambah produk di ${group.nama}`}
                      onPress={() => {
                        setKategoriId(group.kategoriId);
                        setForm('produk');
                      }}
                      testID={`tambah-produk-${group.kategoriId}`}
                    />
                  ) : null}
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
                        name="edit"
                        label={`Ubah produk ${entry.nama}`}
                        onPress={() => setEdit({ kind: 'produk', id: entry.id })}
                        testID={`ubah-produk-${entry.id}`}
                      />
                      <IconButton
                        name="add"
                        label={`Tambah varian di ${entry.nama}`}
                        onPress={() => {
                          setKategoriId(group.kategoriId);
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
                        titip={titipOf(item.id)}
                        check={checks.get(item.id) ?? { kind: 'tidakTahu', sebab: 'belum-dihitung' }}
                        bulk={bulkOf(shop, item, (id) => stock.get(id) ?? { kind: 'unknown' })}
                        selected={wide ? selectedId === item.id : undefined}
                        onPress={() => pressRow(item.id)}
                        onCount={() => openSheet(item.id, 'hitung')}
                        onMinimum={() => openSheet(item.id, 'minimum')}
                        onHistory={() => openSheet(item.id, 'riwayat')}
                      />
                    ))}
                  </View>
                );
              })}
            </View>
          );
          })}
    </ScrollView>
  );

  return (
    <Screen
      title="Barang"
      overline="Stok"
      actions={
        <>
          <IconButton
            name="inventory-2"
            label="Stok awal"
            onPress={() => setOpening(true)}
            testID="stok-awal"
          />
          <IconButton
            name="upload-file"
            label="Impor barang"
            onPress={() => setMode('impor')}
            testID="impor-barang"
          />
          <IconButton name="add" label="Tambah barang" onPress={() => setForm('kategori')} testID="tambah-barang" />
        </>
      }
    >
      <SplitPane list={list} detail={pane} detailTestID="stok-pane" />

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
        visible={editKategori !== null}
        onClose={() => setEdit(null)}
        title={teks.ubahKategori}
        testID="form-ubah-kategori"
      >
        {editKategori ? <KategoriEditForm kategori={editKategori} onDone={() => setEdit(null)} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={editProduk !== null}
        onClose={() => setEdit(null)}
        title={teks.ubahProduk}
        testID="form-ubah-produk"
      >
        {editProduk ? <ProdukEditForm produk={editProduk} onDone={() => setEdit(null)} /> : null}
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

      <BottomSheet
        visible={opening}
        onClose={() => setOpening(false)}
        title="Stok awal"
        testID="form-stok-awal"
      >
        <OpeningForm varian={belumDihitung} onDone={() => setOpening(false)} />
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
function VarianLine({
  varian,
  stock,
  titip,
  check,
  bulk,
  selected,
  onPress,
  onCount,
  onMinimum,
  onHistory,
}: {
  varian: Varian;
  stock: StockState;
  titip: number;
  check: LowCheck;
  bulk: BulkContext | null;
  /** Undefined in portrait, where a row is never a selection. */
  selected?: boolean;
  onPress: () => void;
  onCount: () => void;
  onMinimum: () => void;
  onHistory: () => void;
}) {
  const negative = stock.kind === 'counted' && stock.qty < 0;
  const low = check.kind === 'rendah';
  const reading = stock.kind === 'unknown' ? 'Stok belum dihitung' : `Stok ${formatQty(stock.qty)}`;
  const rule = varian.minimum != null ? `minimum ${formatQty(varian.minimum)}` : 'tanpa minimum';

  return (
    <Pressable
      testID={`stok-baris-${varian.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${varian.nama}, ${reading}`}
      accessibilityState={selected === undefined ? undefined : { selected }}
      onPress={onPress}
      style={[styles.varianRow, negative ? styles.varianNegative : null, selected ? styles.varianSelected : null]}
    >
      <View style={styles.varianMain}>
        <AppText typeRole="bodyLarge" numberOfLines={1} tone={negative ? 'owed' : 'default'}>
          {varian.nama}
        </AppText>
        <AppText typeRole="labelSmall" tone={negative ? 'owed' : 'muted'}>
          {`${formatRupiah(varian.harga)} · per ${varian.satuan} · ${rule}`}
        </AppText>
        {low ? (
          <AppText
            typeRole="labelSmall"
            tone={negative ? 'owed' : 'default'}
            testID={`alasan-rendah-${varian.id}`}
          >
            {lowReason(check.rule)}
          </AppText>
        ) : null}
        {low && bulk ? (
          <AppText typeRole="labelSmall" tone="muted" testID={`sak-${varian.id}`}>
            {bulkCopy(bulk)}
          </AppText>
        ) : null}
        {check.kind === 'tidakTahu' && check.sebab === 'riwayat-terlalu-sedikit' ? (
          <AppText typeRole="labelSmall" tone="muted" testID={`alasan-tidak-tahu-${varian.id}`}>
            Riwayat penjualan belum cukup untuk menilai. Atur minimum untuk peringatan.
          </AppText>
        ) : null}
        {/* Titip is the supplier's, so it is a separate line and never part of
            the owned number in the badge. */}
        {titip > 0 ? (
          <AppText typeRole="labelSmall" tone="muted" testID={`titip-${varian.id}`}>
            {`Titip ${formatQty(titip)} ${varian.satuan} · bukan milik toko`}
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
        low={low}
        testID={`stok-angka-${varian.id}`}
      />
    </Pressable>
  );
}

/**
 * The landscape pane: the selected varian's own reading, its movements, and the
 * actions the row already offers. Owned and titip are two buckets because titip
 * goods are the supplier's and a shortage must never hide behind them.
 *
 * It is a reading first: the count is the loud figure, and the actions open the
 * same sheets the list uses, so nothing is duplicated.
 */
function StokPane({
  varian,
  stock,
  titip,
  check,
  bulk,
  onCount,
  onMinimum,
}: {
  varian: Varian;
  stock: StockState;
  titip: number;
  check: LowCheck;
  bulk: BulkContext | null;
  onCount: () => void;
  onMinimum: () => void;
}) {
  const negative = stock.kind === 'counted' && stock.qty < 0;
  const rule = varian.minimum != null ? `minimum ${formatQty(varian.minimum)}` : 'tanpa minimum';

  return (
    <ScrollView style={styles.pane} contentContainerStyle={styles.paneContent}>
      <View>
        <AppText typeRole="titleMedium" numberOfLines={2}>
          {varian.nama}
        </AppText>
        <AppText typeRole="numericSmall" tone={negative ? 'owed' : 'muted'}>
          {`${formatRupiah(varian.harga)} · per ${varian.satuan} · ${rule}`}
        </AppText>
      </View>

      <View style={styles.paneBucket}>
        <AppText typeRole="labelSmall" tone="muted">
          Milik toko
        </AppText>
        <StockBadge
          qty={stock.kind === 'counted' ? stock.qty : null}
          minimum={varian.minimum ?? null}
          low={check.kind === 'rendah'}
          testID="pane-stok"
        />
      </View>

      <View style={styles.paneBucket}>
        <AppText typeRole="labelSmall" tone="muted">
          Titip
        </AppText>
        <AppText typeRole="numericMedium" testID="pane-titip">
          {`${formatQty(titip)} ${varian.satuan}`}
        </AppText>
      </View>

      {check.kind === 'rendah' ? (
        <AppText typeRole="labelSmall" tone={negative ? 'owed' : 'default'}>
          {lowReason(check.rule)}
        </AppText>
      ) : null}
      {check.kind === 'rendah' && bulk ? (
        <AppText typeRole="labelSmall" tone="muted">
          {bulkCopy(bulk)}
        </AppText>
      ) : null}

      <View style={styles.paneActions}>
        <Button label="Hitung stok" onPress={onCount} testID="pane-hitung" />
        <Button label="Atur minimum" variant="outlined" onPress={onMinimum} testID="pane-minimum" />
      </View>

      <SectionHeading>Pergerakan</SectionHeading>
      <HistoryList varian={varian} />
    </ScrollView>
  );
}

/**
 * The guided setup pass: one field per varian nobody has counted yet. An empty
 * field is a skip, and a skip writes nothing — the varian stays "belum
 * dihitung", which is not the same as zero. Saving writes one `stock.opening`
 * per filled field, so each count is auditable on its own.
 */
function OpeningForm({ varian, onDone }: { varian: Varian[]; onDone: () => void }) {
  const { recordOpeningStock } = useApp();
  const [jumlah, setJumlah] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit() {
    if (saving) return;
    // Every field is read before anything is written: a typo in the last row
    // must not leave the first rows half-recorded.
    const entries: { varianId: string; qty: number }[] = [];
    for (const entry of varian) {
      const raw = (jumlah[entry.id] ?? '').trim();
      if (raw === '') continue;
      const qty = parseQty(raw);
      if (qty === null) {
        setError(`Jumlah ${entry.nama} harus angka. Contoh: 12 atau 12,5`);
        return;
      }
      entries.push({ varianId: entry.id, qty });
    }
    if (entries.length === 0) {
      onDone();
      return;
    }
    setSaving(true);
    setError(null);
    try {
      for (const entry of entries) await recordOpeningStock(entry);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  }

  if (varian.length === 0) {
    return (
      <>
        <Note>Semua barang sudah dihitung. Stok bisa dikoreksi lewat Hitung ulang kapan saja.</Note>
        <Button label={teks.kembali} variant="outlined" onPress={onDone} testID="lewati-stok-awal" />
      </>
    );
  }

  return (
    <>
      <Note>
        Tulis jumlah yang ada di rak sekarang. Yang dikosongkan tetap “belum dihitung” dan bisa dihitung nanti.
      </Note>
      {varian.map((entry) => (
        <Field
          key={entry.id}
          label={`${entry.nama} (${entry.satuan})`}
          value={jumlah[entry.id] ?? ''}
          onChangeText={(value) => setJumlah((prev) => ({ ...prev, [entry.id]: value }))}
          keyboardType="decimal-pad"
          placeholder="0"
          testID={`stok-awal-${entry.id}`}
        />
      ))}
      {error ? (
        <AppText typeRole="bodyMedium" tone="owed" testID="stok-awal-galat">
          {error}
        </AppText>
      ) : null}
      <Button label={teks.simpan} onPress={submit} disabled={saving} testID="simpan-stok-awal" />
      <Button label="Lewati" variant="outlined" onPress={onDone} testID="lewati-stok-awal" />
    </>
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
                  : entry.kind === 'opening'
                    ? 'Stok awal'
                    : entry.kind === 'returned'
                      ? 'Titip dikembalikan'
                      : entry.kind === 'void'
                        ? 'Penjualan dibatalkan'
                        : 'Penjualan'}
            </AppText>
            <AppText typeRole="labelSmall" tone="muted">
              {`${formatMoment(entry.at, { withYear: false })} · sisa ${formatQty(entry.after)} ${varian.satuan}`}
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
 * Renaming a kategori. Only the name is written: its produk keep their own
 * names and their place, because a kategori is a grouping, not a prefix.
 */
function KategoriEditForm({ kategori, onDone }: { kategori: Kategori; onDone: () => void }) {
  const { catalog } = useApp();
  const [nama, setNama] = useState(kategori.nama);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!catalog) return;
    try {
      await catalog.updateKategori(kategori.id, { nama });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function archive() {
    if (!catalog) return;
    try {
      await catalog.archiveKategori(kategori.id);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label={teks.nama} value={nama} onChangeText={setNama} autoFocus error={error} testID="kategori-nama-ubah" />
      <Button label={teks.simpan} onPress={submit} testID="simpan-kategori-ubah" />
      <Button label={teks.arsipkan} variant="destructive" onPress={archive} testID="arsipkan-kategori" />
    </>
  );
}

/** Renaming a produk, and moving it to another kategori. */
function ProdukEditForm({ produk, onDone }: { produk: Produk; onDone: () => void }) {
  const { catalog, shop } = useApp();
  const [nama, setNama] = useState(produk.nama);
  const [kategoriId, setKategoriId] = useState<string | null>(produk.kategoriId);
  const [error, setError] = useState<string | null>(null);
  const kategori = shop.kategori.filter((entry) => !entry.archived);

  async function submit() {
    if (!catalog) return;
    const changes: { nama?: string; kategoriId?: string | null } = {};
    if (nama.trim() !== produk.nama) changes.nama = nama;
    if (kategoriId !== produk.kategoriId) changes.kategoriId = kategoriId;
    if (Object.keys(changes).length === 0) {
      onDone();
      return;
    }
    try {
      await catalog.updateProduk(produk.id, changes);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function archive() {
    if (!catalog) return;
    try {
      await catalog.archiveProduk(produk.id);
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label={teks.nama} value={nama} onChangeText={setNama} autoFocus error={error} testID="produk-nama-ubah" />

      <AppText typeRole="labelSmall" tone="muted" style={styles.pickLabel}>
        {teks.pindahKategori}
      </AppText>
      <ChipRow>
        {kategori.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.nama}
            selected={kategoriId === entry.id}
            onPress={() => setKategoriId(entry.id)}
            testID={`pindah-kategori-${entry.id}`}
          />
        ))}
      </ChipRow>

      <Button label={teks.simpan} onPress={submit} testID="simpan-produk-ubah" />
      <Button label={teks.arsipkan} variant="destructive" onPress={archive} testID="arsipkan-produk" />
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
  kategoriActions: { flexDirection: 'row', alignItems: 'center', paddingTop: space.lg },
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
  // The landscape pane's row: a wash, never a colour (DESIGN.md §Palette).
  varianSelected: { backgroundColor: colors.primaryContainer },
  rowButtons: { flexDirection: 'row', alignItems: 'center' },
  historyRow: {
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: space.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  pickLabel: { paddingBottom: space.xs },
  pane: { flex: 1, minHeight: 0 },
  paneContent: { paddingBottom: space.lg, gap: space.sm },
  paneBucket: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: space.row,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  paneActions: { gap: space.sm, paddingVertical: space.sm },
  paneEmpty: { paddingVertical: space.lg },
});
