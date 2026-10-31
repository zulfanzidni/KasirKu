import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
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
  colors,
  formatRupiah,
  parseRupiah,
  space,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
import { teks, type JualBy, type Satuan, type Varian } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

const SATUAN: readonly Satuan[] = ['pcs', 'bungkus', 'kg', 'liter', 'sak'];
const JUAL: readonly { value: JualBy; label: string }[] = [
  { value: 'unit', label: teks.jualSatuan },
  { value: 'weight', label: teks.jualBerat },
];

/**
 * Stok — where the shop's own product list is made.
 *
 * This ticket needs only creation, in the three levels the glossary fixes:
 * kategori, then a produk inside it, then a varian with its satuan. Stock
 * displays and corrections are the next tickets.
 */
export function StokScreen() {
  const { shop } = useApp();
  const [form, setForm] = useState<'kategori' | 'produk' | 'varian' | null>(null);
  const [kategoriId, setKategoriId] = useState<string | null>(null);
  const [produkId, setProdukId] = useState<string | null>(null);

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

        {shop.kategori.map((kategori) => {
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
                const varian = shop.varian.filter((item) => item.produkId === entry.id && !item.archived);
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
                      <VarianLine key={item.id} varian={item} />
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
    </Screen>
  );
}

/** One sellable size: name, satuan and price, on a ruled line. */
function VarianLine({ varian }: { varian: Varian }) {
  return (
    <View style={styles.varianRow} testID={`stok-${varian.id}`}>
      <View style={styles.varianMain}>
        <AppText typeRole="bodyLarge" numberOfLines={1}>
          {varian.nama}
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          {`${varian.jualBy === 'weight' ? 'Timbang' : 'Unit'} · per ${varian.satuan}`}
        </AppText>
      </View>
      <AppText typeRole="numericLarge" align="right">
        {formatRupiah(varian.harga)}
      </AppText>
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
  pickLabel: { paddingBottom: space.xs },
});
