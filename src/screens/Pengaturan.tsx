import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Field, Note, SectionHeading, space } from '@/design';
import { backupFiles, parseBackup, type BackupFile } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

/**
 * Pengaturan — what the nota says about the shop, and the shop's backup.
 *
 * The name and the closing line are the shop's own words, so the form does not
 * suggest copy or "improve" it. Saving writes `settings.updated`; the fields
 * follow what the record says until the owner starts typing, so opening the
 * screen again shows the truth rather than what this phone last typed.
 *
 * Cadangan is here because losing the phone must not lose the shop's history
 * (ADR 0003). Export writes the whole log to a file and offers it to the share
 * sheet; import refuses to replace a log that already holds sales without
 * saying plainly what will be lost, and it can be cancelled.
 *
 * A section, not a full screen: it sits inside Lainnya, which owns the title.
 */
export function PengaturanScreen() {
  const { shop, settings, backupText, hasHistory, restoreBackup } = useApp();
  const [draft, setDraft] = useState<{ nama: string; keterangan: string; footer: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [backupBusy, setBackupBusy] = useState<'ekspor' | 'pulihkan' | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  /** A parsed backup waiting for the owner to agree that history will be replaced. */
  const [pending, setPending] = useState<{ name: string; backup: BackupFile } | null>(null);

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

  function catatBackup(pesan: string | null, galat: string | null) {
    setBackupNotice(pesan);
    setBackupError(galat);
  }

  async function ekspor() {
    if (backupBusy) return;
    setBackupBusy('ekspor');
    catatBackup(null, null);
    try {
      const text = await backupText();
      const saved = await backupFiles.current.save(text, namaCadangan(new Date()));
      let pesan = 'Cadangan dibuat di ponsel ini. Pindahkan berkasnya ke tempat lain.';
      if (await backupFiles.current.canShare()) {
        try {
          await backupFiles.current.share(saved.uri, 'application/json');
          pesan = 'Cadangan dibuat. Simpan atau bagikan berkasnya ke tempat lain.';
        } catch (cause) {
          pesan = `Cadangan dibuat, tetapi belum bisa dibagikan: ${pesanDari(cause)}`;
        }
      }
      setBackupNotice(pesan);
    } catch (cause) {
      catatBackup(null, pesanDari(cause));
    } finally {
      setBackupBusy(null);
    }
  }

  async function pilihCadangan() {
    if (backupBusy) return;
    setBackupBusy('pulihkan');
    catatBackup(null, null);
    try {
      const picked = await backupFiles.current.pick();
      // Backing out of the file picker is not an error and changes nothing.
      if (!picked) return;
      const backup = parseBackup(picked.text);
      if (hasHistory()) {
        setPending({ name: picked.name, backup });
        return;
      }
      await pulihkan(backup);
    } catch (cause) {
      catatBackup(null, pesanDari(cause));
    } finally {
      setBackupBusy(null);
    }
  }

  async function pulihkan(backup: BackupFile) {
    setBackupBusy('pulihkan');
    setPending(null);
    try {
      await restoreBackup(backup);
      setBackupNotice('Cadangan dipulihkan. Riwayat di ponsel ini sekarang sama dengan berkas cadangan.');
    } catch (cause) {
      catatBackup(null, pesanDari(cause));
    } finally {
      setBackupBusy(null);
    }
  }

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

      <View style={styles.backup}>
        <SectionHeading>Cadangan</SectionHeading>
        <Note>
          Simpan seluruh riwayat penjualan ke satu berkas, supaya ponsel yang rusak tidak menghapus buku toko. Simpan
          berkasnya di tempat lain, bukan hanya di ponsel ini.
        </Note>

        {pending ? (
          <View style={styles.warning} testID="peringatan-pulihkan">
            <AppText typeRole="bodyMedium" tone="owed">
              {`Ponsel ini sudah berisi riwayat. Memulihkan cadangan akan MENGGANTI seluruh riwayat di ponsel ini — termasuk penjualan yang sudah tercatat — dengan isi ${pending.name} (${pending.backup.events.length} catatan). Penjualan yang ada di sini akan hilang dan tidak bisa dikembalikan.`}
            </AppText>
            <View style={styles.actions}>
              <Button
                label="Batal"
                variant="outlined"
                onPress={() => setPending(null)}
                testID="batal-pulihkan"
                style={styles.cancel}
              />
              <Button
                label="Ganti riwayat"
                variant="destructive"
                onPress={() => pulihkan(pending.backup)}
                disabled={backupBusy === 'pulihkan'}
                testID="konfirmasi-pulihkan"
                style={styles.grow}
              />
            </View>
          </View>
        ) : (
          <View style={styles.actions}>
            <Button
              label={backupBusy === 'ekspor' ? 'Menyiapkan…' : 'Ekspor cadangan'}
              variant="outlined"
              onPress={ekspor}
              disabled={backupBusy !== null}
              testID="ekspor-cadangan"
              style={styles.grow}
            />
            <Button
              label={backupBusy === 'pulihkan' ? 'Memulihkan…' : 'Pulihkan'}
              onPress={pilihCadangan}
              disabled={backupBusy !== null}
              testID="pulihkan-cadangan"
              style={styles.grow}
            />
          </View>
        )}

        {backupNotice ? (
          <AppText typeRole="bodyMedium" tone="primary" testID="cadangan-pesan">
            {backupNotice}
          </AppText>
        ) : null}
        {backupError ? (
          <AppText typeRole="bodyMedium" tone="owed" testID="cadangan-galat">
            {backupError}
          </AppText>
        ) : null}
      </View>
    </ScrollView>
  );
}

/** `cadangan-kasirku-20261117-1420.json`: date first, so files sort by day. */
function namaCadangan(at: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0');
  return `cadangan-kasirku-${at.getFullYear()}${pad(at.getMonth() + 1)}${pad(at.getDate())}-${pad(at.getHours())}${pad(at.getMinutes())}.json`;
}

function pesanDari(cause: unknown): string {
  return cause instanceof Error ? cause.message : String(cause);
}

const styles = StyleSheet.create({
  body: { paddingBottom: space.xxl },
  form: { paddingHorizontal: space.gutter, paddingTop: space.xs },
  actions: { paddingTop: space.md, flexDirection: 'row', gap: space.sm },
  backup: { paddingHorizontal: space.gutter, paddingTop: space.xxl },
  warning: { paddingTop: space.md, gap: space.xs },
  cancel: { width: 96 },
  grow: { flex: 1 },
});
