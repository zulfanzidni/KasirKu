import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Field, Note, SectionHeading, space } from '@/design';
import { useApp } from '@/ledger/useLedger';

/**
 * Pengaturan — what the nota says about the shop.
 *
 * The name and the closing line are the shop's own words, so the form does not
 * suggest copy or "improve" it. Saving writes `settings.updated`; the fields
 * follow what the record says until the owner starts typing, so opening the
 * screen again shows the truth rather than what this phone last typed.
 *
 * A section, not a full screen: it sits inside Lainnya, which owns the title.
 */
export function PengaturanScreen() {
  const { shop, settings } = useApp();
  const [draft, setDraft] = useState<{ nama: string; keterangan: string; footer: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // The fields follow the record until the owner starts typing. Starting from
  // the read-only defaults while the log was still opening would otherwise
  // make the screen show "KasirKu" over a shop that has a name.
  const nama = draft?.nama ?? shop.receipt.header.nama;
  const keterangan = draft?.keterangan ?? shop.receipt.header.keterangan;
  const footer = draft?.footer ?? shop.receipt.footer;

  /**
   * One edit at a time, applied to the *latest* draft. A field captures its own
   * values when it renders, so writing the draft from those would let a second
   * keystroke in another field undo the first — the owner would lose a line
   * they just typed.
   */
  const edit = (change: Partial<{ nama: string; keterangan: string; footer: string }>) => {
    setDraft((prev) => ({
      nama: prev?.nama ?? shop.receipt.header.nama,
      keterangan: prev?.keterangan ?? shop.receipt.header.keterangan,
      footer: prev?.footer ?? shop.receipt.footer,
      ...change,
    }));
    setSaved(false);
  };

  function simpan() {
    if (saving || !settings) return;
    const draftValues = { header: { nama, keterangan }, footer };
    setSaving(true);
    setSaved(false);
    setError(null);
    settings
      .updateReceipt(draftValues)
      .then(() => setSaved(true))
      .catch((cause: unknown) => setError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setSaving(false));
  }

  const namaKosong = error === 'Nama toko wajib diisi.';

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      <SectionHeading>Nota</SectionHeading>
      <Note>Ini yang tercetak di nota pelanggan. Ganti dengan nama dan ucapan toko Anda sendiri.</Note>

      <View style={styles.form}>
        <Field
          label="Nama toko"
          testID="toko-nama"
          value={nama}
          onChangeText={(value) => edit({ nama: value })}
          error={namaKosong ? error : null}
        />
        <Field
          label="Alamat atau telepon (opsional)"
          testID="toko-keterangan"
          value={keterangan}
          onChangeText={(value) => edit({ keterangan: value })}
          multiline
          numberOfLines={2}
        />
        <Field
          label="Ucapan penutup"
          testID="toko-footer"
          value={footer}
          onChangeText={(value) => edit({ footer: value })}
          multiline
          numberOfLines={2}
        />

        {saved ? (
          <AppText typeRole="bodyMedium" tone="primary" testID="pengaturan-tersimpan">
            Pengaturan nota tersimpan.
          </AppText>
        ) : null}
        {error && !namaKosong ? (
          <AppText typeRole="bodyMedium" tone="owed">
            {error}
          </AppText>
        ) : null}

        <View style={styles.actions}>
          <Button label={saving ? 'Menyimpan…' : 'Simpan'} onPress={simpan} disabled={saving} testID="simpan-pengaturan" />
        </View>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.xxl },
  form: { paddingHorizontal: space.gutter, paddingTop: space.xs },
  actions: { paddingTop: space.md },
});
