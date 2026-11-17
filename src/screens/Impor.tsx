import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Field, Note, Screen, SectionHeading, formatRupiah, space } from '@/design';
import { IconButton } from '@/design/components/Icons';
import { importFiles, planImport, type ImportPlan } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

/**
 * Impor barang — the owner's item list, pasted or picked from a spreadsheet.
 *
 * The screen is deliberately two steps. Pratinjau reads the rows into a plan
 * and shows what would be created and which rows are wrong; nothing is written.
 * Only "Impor" commits, and it commits the whole plan or nothing, because a
 * half-imported catalog is worse than none.
 */
export function ImporScreen({ onBack }: { onBack: () => void }) {
  const { shop, importCatalog } = useApp();
  const [teks, setTeks] = useState('');
  const [plan, setPlan] = useState<ImportPlan | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pesan, setPesan] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  function ubahTeks(value: string) {
    setTeks(value);
    // A changed sheet makes the old preview a lie: it must be asked for again.
    setPlan(null);
    setPesan(null);
  }

  function pratinjau() {
    setError(null);
    setPesan(null);
    setPlan(planImport(teks, shop));
  }

  async function pilihBerkas() {
    setError(null);
    setPesan(null);
    try {
      const picked = await importFiles.current.pick();
      // Backing out of the picker is not an error and changes nothing.
      if (!picked) return;
      ubahTeks(picked.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  async function simpan() {
    if (!plan || plan.errors.length > 0 || busy) return;
    setBusy(true);
    setError(null);
    try {
      const hasil = await importCatalog(plan);
      setPesan(`${hasil.varian} varian diimpor.`);
      setPlan(null);
      setTeks('');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Screen
      title="Impor barang"
      overline="Stok"
      actions={<IconButton name="arrow-back" label="Kembali" onPress={onBack} testID="impor-kembali" />}
    >
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Note>
          Tempel baris dari spreadsheet, atau pilih berkasnya. Satu baris satu varian, kolomnya: kategori, produk,
          varian, satuan, harga, kode, stok awal. Pemisahnya tab atau titik koma.
        </Note>

        <View style={styles.form}>
          <Field
            label="Baris barang"
            value={teks}
            onChangeText={ubahTeks}
            multiline
            numberOfLines={8}
            placeholder={'Sembako\tIndomie goreng\tIndomie goreng\tbungkus\t3.500\tIDM\t40'}
            testID="impor-teks"
          />
          <Button label="Pilih berkas" variant="outlined" onPress={pilihBerkas} testID="impor-berkas" />
          <Button label="Pratinjau" onPress={pratinjau} testID="impor-pratinjau" />
        </View>

        {error ? (
          <AppText typeRole="bodyMedium" tone="owed" testID="impor-galat">
            {error}
          </AppText>
        ) : null}
        {pesan ? (
          <AppText typeRole="bodyMedium" tone="primary" testID="impor-pesan">
            {pesan}
          </AppText>
        ) : null}

        {plan ? <Pratinjau plan={plan} busy={busy} onSimpan={simpan} /> : null}
      </ScrollView>
    </Screen>
  );
}

/**
 * What the commit would do, in the owner's words. A row error is a sentence
 * that names its row, and it disables the commit rather than letting the good
 * rows through.
 */
function Pratinjau({ plan, busy, onSimpan }: { plan: ImportPlan; busy: boolean; onSimpan: () => void }) {
  const adaGalat = plan.errors.length > 0;

  return (
    <View style={styles.preview}>
      {adaGalat ? (
        <View testID="impor-galat-daftar">
          <SectionHeading>{`Baris yang harus diperbaiki (${plan.errors.length})`}</SectionHeading>
          {plan.errors.map((entry) => (
            <AppText
              key={`${entry.baris}-${entry.pesan}`}
              typeRole="bodyMedium"
              tone="owed"
              testID={`impor-galat-${entry.baris}`}
            >
              {entry.pesan}
            </AppText>
          ))}
        </View>
      ) : null}

      {plan.kategori.length > 0 ? (
        <View testID="impor-kategori">
          <SectionHeading>{`Kategori baru (${plan.kategori.length})`}</SectionHeading>
          {plan.kategori.map((entry) => (
            <AppText key={entry.nama} typeRole="bodyMedium">
              {entry.nama}
            </AppText>
          ))}
        </View>
      ) : null}

      {plan.produk.length > 0 ? (
        <View testID="impor-produk">
          <SectionHeading>{`Produk baru (${plan.produk.length})`}</SectionHeading>
          {plan.produk.map((entry) => (
            <AppText key={entry.nama} typeRole="bodyMedium">
              {`${entry.nama} · ${entry.kategori}`}
            </AppText>
          ))}
        </View>
      ) : null}

      {plan.varian.length > 0 ? (
        <View testID="impor-varian">
          <SectionHeading>{`Varian baru (${plan.varian.length})`}</SectionHeading>
          {plan.varian.map((entry) => (
            <AppText key={`${entry.produk}-${entry.nama}`} typeRole="bodyMedium">
              {`${entry.nama} · ${entry.satuan} · Rp ${formatRupiah(entry.harga)}`}
            </AppText>
          ))}
        </View>
      ) : null}

      {plan.varian.length === 0 && !adaGalat ? <Note>Tidak ada baris yang bisa diimpor.</Note> : null}

      <View style={styles.actions}>
        <Button
          label={adaGalat ? 'Perbaiki baris yang salah' : `Impor ${plan.varian.length} varian`}
          onPress={onSimpan}
          disabled={adaGalat || busy || plan.varian.length === 0}
          testID="impor-simpan"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.xxl },
  form: { paddingHorizontal: space.gutter, paddingTop: space.xs, gap: space.sm },
  preview: { paddingTop: space.md },
  actions: { paddingHorizontal: space.gutter, paddingTop: space.lg },
});
