import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { AppText, Button, Field, formatMoment, Note, SectionHeading, space, useFrame } from '@/design';
import { backupFiles, parseBackup, type BackupFile } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

/**
 * Pengaturan — the shop's two phones, the nota, and the shop's backup.
 *
 * Sinkron is the first thing on the page because it is the question behind
 * every number: when did these phones last agree, and what is still waiting to
 * be sent? A failed exchange is said out loud, beside the fact that nothing was
 * lost.
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
  const {
    shop,
    settings,
    backupText,
    hasHistory,
    restoreBackup,
    lastSyncAt,
    unsentCount,
    syncNow,
    deviceId,
    adoptableIdentities,
    adoptIdentity,
  } = useApp();
  const { wide } = useFrame();
  const [draft, setDraft] = useState<{ nama: string; keterangan: string; footer: string } | null>(null);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const [syncBusy, setSyncBusy] = useState(false);
  const [syncNotice, setSyncNotice] = useState<string | null>(null);
  const [syncError, setSyncError] = useState<string | null>(null);

  const [backupBusy, setBackupBusy] = useState<'ekspor' | 'pulihkan' | null>(null);
  const [backupNotice, setBackupNotice] = useState<string | null>(null);
  const [backupError, setBackupError] = useState<string | null>(null);
  /** A parsed backup waiting for the owner to agree that history will be replaced. */
  const [pending, setPending] = useState<{ name: string; backup: BackupFile } | null>(null);

  const [adoptBusy, setAdoptBusy] = useState(false);
  const [adoptNotice, setAdoptNotice] = useState<string | null>(null);
  const [adoptError, setAdoptError] = useState<string | null>(null);
  /** The identity the owner picked, waiting for them to agree to the risk. */
  const [adoptPending, setAdoptPending] = useState<string | null>(null);

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

  /**
   * The manual exchange. A failure is said out loud, with the fact that nothing
   * was lost: a silent backlog is what makes an owner trust a stale number.
   */
  async function sinkron() {
    if (syncBusy) return;
    setSyncBusy(true);
    setSyncNotice(null);
    setSyncError(null);
    try {
      const report = await syncNow();
      setSyncNotice(
        `Sinkron selesai. ${report.pushed} catatan terkirim, ${report.applied} catatan baru dari ponsel lain.`,
      );
    } catch (cause) {
      setSyncError(`Sinkron gagal: ${pesanDari(cause)} Catatan yang belum terkirim tetap tersimpan di ponsel ini.`);
    } finally {
      setSyncBusy(false);
    }
  }

  /**
   * Adopting a dead phone's name. The refusal is the app's, not a warning: if
   * the old phone's notes are still arriving, two phones on one name would
   * collide, so nothing is changed and the reason is said plainly.
   */
  async function adopsi(candidateId: string) {
    if (adoptBusy) return;
    setAdoptBusy(true);
    setAdoptPending(null);
    setAdoptNotice(null);
    setAdoptError(null);
    try {
      await adoptIdentity(candidateId);
      setAdoptNotice(
        `Identitas ${candidateId} diadopsi. Catatan berikutnya melanjutkan nomor urut ponsel lama, bukan mulai dari satu lagi.`,
      );
    } catch (cause) {
      setAdoptError(`Adopsi ditolak: ${pesanDari(cause)}`);
    } finally {
      setAdoptBusy(false);
    }
  }

  const bagianSinkron = (
    <>
      <SectionHeading>Sinkron</SectionHeading>
      <Note>
        Dua ponsel bertukar catatan lewat satu tempat bersama, supaya stok dan uangnya sama. Menjual tetap bisa tanpa
        internet; catatan yang belum terkirim menunggu sampai sambungannya ada.
      </Note>

      <View style={styles.sync} testID="sinkron-status">
        <AppText typeRole="bodyMedium" testID="sinkron-terakhir">
          {lastSyncAt ? `Tersinkron terakhir ${formatMoment(lastSyncAt)}.` : 'Belum pernah sinkron.'}
        </AppText>
        <AppText typeRole="bodyMedium" tone="muted" testID="sinkron-belum-terkirim">
          {unsentCount > 0 ? `${unsentCount} catatan belum terkirim.` : 'Semua catatan sudah terkirim.'}
        </AppText>
      </View>

      <View style={styles.syncActions}>
        <Button
          label={syncBusy ? 'Menyinkronkan…' : 'Sinkron sekarang'}
          onPress={sinkron}
          disabled={syncBusy}
          testID="sinkron-sekarang"
          style={styles.grow}
        />
      </View>

      {syncNotice ? (
        <AppText typeRole="bodyMedium" tone="primary" style={styles.syncNote} testID="sinkron-pesan">
          {syncNotice}
        </AppText>
      ) : null}
      {syncError ? (
        <AppText typeRole="bodyMedium" tone="owed" style={styles.syncNote} testID="sinkron-galat">
          {syncError}
        </AppText>
      ) : null}
    </>
  );

  const bagianNota = (
    <>
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
    </>
  );

  const bagianCadangan = (
    <View style={[styles.backup, wide && styles.backupWide]}>
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
  );

  const bagianAdopsi = (
    <View style={styles.adoption}>
      <SectionHeading>Identitas ponsel</SectionHeading>
      <AppText typeRole="bodyMedium" tone="muted" style={styles.adoptNote} testID="adopsi-penjelasan">
        Kalau ponsel lama rusak dan tidak akan dipakai lagi, ponsel ini bisa memakai namanya supaya catatan yang belum
        terkirim tidak hilang. Ini berisiko: kalau ponsel lama ternyata masih menyinkron, dua ponsel memakai satu nama
        dan catatan bisa hilang. Jalan yang lebih aman adalah memulihkan cadangan di bagian Cadangan di atas.
      </AppText>
      <AppText typeRole="labelSmall" tone="muted" style={styles.adoptNote} testID="adopsi-sekarang">
        {`Ponsel ini memakai identitas ${deviceId || '…'}.`}
      </AppText>

      {adoptableIdentities.length === 0 ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.adoptNote} testID="adopsi-kosong">
          Belum ada identitas ponsel lain di catatan ini. Sinkron dulu supaya identitas ponsel lama terlihat.
        </AppText>
      ) : (
        <View style={styles.adoptList}>
          {adoptableIdentities.map((identity) => (
            <View key={identity.deviceId} style={styles.adoptRow}>
              <View style={styles.adoptText}>
                <AppText typeRole="bodyMedium">{identity.deviceId}</AppText>
                <AppText typeRole="labelSmall" tone="muted">
                  {`${identity.events} catatan · nomor terakhir ${identity.lastSeq} · ${formatMoment(identity.lastAt)}`}
                </AppText>
              </View>
              <Button
                label="Adopsi"
                variant="outlined"
                onPress={() => {
                  setAdoptPending(identity.deviceId);
                  setAdoptNotice(null);
                  setAdoptError(null);
                }}
                disabled={adoptBusy}
                testID={`adopsi-${identity.deviceId}`}
                style={styles.adoptButton}
              />
            </View>
          ))}
        </View>
      )}

      {adoptPending ? (
        <View style={styles.warning} testID="peringatan-adopsi">
          <AppText typeRole="bodyMedium" tone="owed">
            {`Ponsel ini akan memakai nama ${adoptPending} dan melanjutkan nomor urutnya. Lakukan hanya kalau ponsel lama benar-benar tidak akan dipakai lagi. Kalau masih ragu, pulihkan cadangan saja.`}
          </AppText>
          <View style={styles.actions}>
            <Button
              label="Batal"
              variant="outlined"
              onPress={() => setAdoptPending(null)}
              testID="batal-adopsi"
              style={styles.cancel}
            />
            <Button
              label="Adopsi identitas"
              variant="destructive"
              onPress={() => adopsi(adoptPending)}
              disabled={adoptBusy}
              testID="konfirmasi-adopsi"
              style={styles.grow}
            />
          </View>
        </View>
      ) : null}

      {adoptNotice ? (
        <AppText typeRole="bodyMedium" tone="primary" style={styles.adoptNote} testID="adopsi-pesan">
          {adoptNotice}
        </AppText>
      ) : null}
      {adoptError ? (
        <AppText typeRole="bodyMedium" tone="owed" style={styles.adoptNote} testID="adopsi-galat">
          {adoptError}
        </AppText>
      ) : null}
    </View>
  );

  // Two columns in landscape: the shop's own words on the left, the backup that
  // keeps them on the right. Same sections, same order, one ScrollView — so the
  // restore warning still stands between the owner and the destructive button.
  if (wide) {
    return (
      <ScrollView contentContainerStyle={[styles.body, styles.bodyWide]} keyboardShouldPersistTaps="handled">
        <View style={styles.column} testID="pengaturan-kolom-kiri">
          {bagianSinkron}
          {bagianNota}
        </View>
        <View style={styles.column} testID="pengaturan-kolom-kanan">
          {bagianCadangan}
          {bagianAdopsi}
        </View>
      </ScrollView>
    );
  }

  return (
    <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
      {bagianSinkron}
      {bagianNota}
      {bagianCadangan}
      {bagianAdopsi}
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
  bodyWide: { flexDirection: 'row', alignItems: 'flex-start' },
  column: { flex: 1, minWidth: 0 },
  form: { paddingHorizontal: space.gutter, paddingTop: space.xs },
  actions: { paddingTop: space.md, flexDirection: 'row', gap: space.sm },
  sync: { paddingHorizontal: space.gutter, gap: space.xs },
  syncActions: { paddingTop: space.md, paddingHorizontal: space.gutter, flexDirection: 'row', gap: space.sm },
  syncNote: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  backup: { paddingHorizontal: space.gutter, paddingTop: space.xxl },
  /** First section of the right column: the heading already carries the top gap. */
  backupWide: { paddingTop: 0 },
  adoption: { paddingHorizontal: space.gutter, paddingTop: space.xxl },
  adoptNote: { paddingTop: space.sm },
  adoptList: { paddingTop: space.md, gap: space.sm },
  adoptRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  adoptText: { flex: 1, gap: 2 },
  adoptButton: { width: 104 },
  warning: { paddingTop: space.md, gap: space.xs },
  cancel: { width: 96 },
  grow: { flex: 1 },
});
