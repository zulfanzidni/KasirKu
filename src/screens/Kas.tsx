import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import {
  AppText,
  BottomSheet,
  Button,
  Card,
  Field,
  Note,
  Screen,
  SectionHeading,
  TotalBlock,
  colors,
  formatMoment,
  formatRupiah,
  parseRupiah,
  space,
  useFrame,
} from '@/design';
import { baselineKindLabel, baselineLabel, selisihLabel, type CashCount } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

/**
 * Kas — the drawer, and Tutup Toko.
 *
 * Expected cash is never a number someone remembered: it is the last declared
 * float or previous count plus every movement since. The screen always names
 * that baseline, because a difference the owner cannot explain is one they will
 * learn to ignore.
 *
 * Tutup Toko is a checkpoint, not a lock: the day's figures and a count are
 * recorded, and selling carries on.
 */

type Sheet = 'pengeluaran' | 'tarik' | 'setor' | 'float' | 'hitung';

export function KasScreen({ onBack }: { onBack?: () => void } = {}) {
  const { cashDrawer, cashCounts, todayTotals } = useApp();
  const [sheet, setSheet] = useState<Sheet | null>(null);

  const drawer = cashDrawer();
  const counts = cashCounts();
  const today = todayTotals();
  const { wide } = useFrame();

  const summary = (
    <View style={styles.block}>
      <TotalBlock amount={drawer.expected} label="Kas yang seharusnya" testID="kas-expected" />
      <AppText typeRole="bodySmall" tone="muted" testID="kas-patokan">
        {baselineLabel(drawer.baseline)}
      </AppText>
    </View>
  );

  const movements = (
    <Card>
      <CashRow title="Penjualan tunai" amount={drawer.penjualan} testID="kas-penjualan" />
      <CashRow title="Penjualan dibatalkan" amount={-drawer.pembatalan} testID="kas-pembatalan" divided />
      <CashRow title="Pembayaran hutang" amount={drawer.hutang} testID="kas-hutang" divided />
      <CashRow title="Setor uang" amount={drawer.setor} testID="kas-setor" divided />
      <CashRow title="Bayar pemasok" amount={-drawer.pemasok} testID="kas-pemasok" divided />
      <CashRow title="Pengeluaran" amount={-drawer.pengeluaran} testID="kas-pengeluaran" divided />
      <CashRow title="Tarik uang" amount={-drawer.tarik} testID="kas-tarik" divided />
    </Card>
  );

  const actions = (
    <>
      <View style={styles.actions}>
        <Button
          label="Catat pengeluaran"
          variant="outlined"
          onPress={() => setSheet('pengeluaran')}
          testID="catat-pengeluaran"
          style={styles.grow}
        />
        <Button
          label="Hitung kas"
          onPress={() => setSheet('hitung')}
          testID="hitung-kas"
          style={styles.grow}
        />
      </View>
      <View style={styles.actions}>
        <Button
          label="Tarik uang"
          variant="text"
          onPress={() => setSheet('tarik')}
          testID="tarik-uang"
          style={styles.grow}
        />
        <Button
          label="Setor uang"
          variant="text"
          onPress={() => setSheet('setor')}
          testID="setor-uang"
          style={styles.grow}
        />
      </View>
      <View style={styles.actions}>
        <Button
          label="Nyatakan kas awal"
          variant="text"
          onPress={() => setSheet('float')}
          testID="nyatakan-kas-awal"
        />
      </View>
    </>
  );

  const tutupToko = (
    <>
      <SectionHeading flush>Tutup Toko</SectionHeading>
      <Card>
        <CashRow title="Penjualan hari ini" amount={today.penjualan} testID="tutup-penjualan" />
        <CashRow title="Diskon hari ini" amount={today.diskon} testID="tutup-diskon" divided />
        <CashRow title="Kas yang seharusnya" amount={drawer.expected} testID="tutup-expected" divided />
      </Card>
      <Note flush>
        Tutup toko hanya mencatat. Tidak ada yang dikunci: penjualan berikutnya tetap bisa dicatat.
      </Note>
      <View style={styles.actions}>
        <Button label="Tutup toko" onPress={() => setSheet('hitung')} testID="tutup-hitung" />
      </View>
    </>
  );

  const history = (
    <>
      <SectionHeading flush>Riwayat hitung kas</SectionHeading>
      {counts.length === 0 ? (
        <Note flush>Belum ada hitung kas. Hitung laci supaya selisihnya ketahuan.</Note>
      ) : (
        <Card>
          {counts.map((count, index) => (
            <CountRow key={count.eventId} count={count} index={index} divided={index > 0} />
          ))}
        </Card>
      )}
    </>
  );

  return (
    <Screen title="Kas" subtitle="Laci tunai hari ini" role="Lainnya" onBack={onBack}>
      {wide ? (
        // Landscape: the drawer's own readings on the left, the things that
        // change them on the right. Both columns scroll on their own, so
        // recording an expense never hides the balance it is checked against.
        <View style={styles.columns}>
          <ScrollView
            style={styles.column}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            testID="kas-kolom-kiri"
          >
            {summary}
            {movements}
            {history}
          </ScrollView>
          <View style={styles.columnRule} />
          <ScrollView
            style={styles.column}
            contentContainerStyle={styles.content}
            keyboardShouldPersistTaps="handled"
            testID="kas-kolom-kanan"
          >
            {actions}
            {tutupToko}
          </ScrollView>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {summary}
          {movements}
          {actions}
          {tutupToko}
          {history}
        </ScrollView>
      )}

      <BottomSheet
        visible={sheet === 'pengeluaran'}
        onClose={() => setSheet(null)}
        title="Catat pengeluaran"
        testID="form-pengeluaran"
      >
        {sheet === 'pengeluaran' ? (
          <MovementForm
            kind="expense"
            label="Pengeluaran"
            reasonLabel="Untuk apa"
            reasonRequired
            onDone={() => setSheet(null)}
          />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'tarik'} onClose={() => setSheet(null)} title="Tarik uang" testID="form-tarik">
        {sheet === 'tarik' ? (
          <MovementForm kind="withdrawn" label="Tarik uang" reasonLabel="Keterangan (opsional)" onDone={() => setSheet(null)} />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'setor'} onClose={() => setSheet(null)} title="Setor uang" testID="form-setor">
        {sheet === 'setor' ? (
          <MovementForm kind="deposited" label="Setor uang" reasonLabel="Keterangan (opsional)" onDone={() => setSheet(null)} />
        ) : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'float'} onClose={() => setSheet(null)} title="Nyatakan kas awal" testID="form-float">
        {sheet === 'float' ? <OpeningFloatForm onDone={() => setSheet(null)} /> : null}
      </BottomSheet>

      <BottomSheet visible={sheet === 'hitung'} onClose={() => setSheet(null)} title="Hitung kas" testID="form-hitung">
        {sheet === 'hitung' ? <CountForm onDone={() => setSheet(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function CashRow({
  title,
  amount,
  testID,
  divided = false,
}: {
  title: string;
  amount: number;
  testID: string;
  divided?: boolean;
}) {
  const value = amount === 0 ? 'Rp 0' : amount < 0 ? `−Rp ${formatRupiah(-amount)}` : `Rp ${formatRupiah(amount)}`;
  // A refund or an outflow is information, not money owed: the sign says which
  // way the cash went, and red is kept for what someone still owes.
  return (
    <View style={[styles.cashRow, divided && styles.cashRowDivided]} testID={testID}>
      <AppText typeRole="bodyMedium" style={styles.cashLabel}>
        {title}
      </AppText>
      <AppText typeRole="numericMedium" align="right">
        {value}
      </AppText>
    </View>
  );
}

function CountRow({ count, index, divided }: { count: CashCount; index: number; divided: boolean }) {
  return (
    <View style={[styles.history, divided && styles.cashRowDivided]} testID={`hitung-baris-${index}`}>
      <AppText typeRole="titleSmall">{formatMoment(count.at)}</AppText>
      <AppText typeRole="bodySmall" tone="muted">
        {`Seharusnya Rp ${formatRupiah(count.expected)} · Dihitung Rp ${formatRupiah(count.counted)} · ${selisihLabel(
          count.difference,
        )} · ${baselineKindLabel(count.baseline)}`}
      </AppText>
      {count.catatan ? (
        <AppText typeRole="bodySmall" tone="muted">
          {count.catatan}
        </AppText>
      ) : null}
    </View>
  );
}

function MovementForm({
  kind,
  label,
  reasonLabel,
  reasonRequired = false,
  onDone,
}: {
  kind: 'expense' | 'withdrawn' | 'deposited';
  label: string;
  reasonLabel: string;
  reasonRequired?: boolean;
  onDone: () => void;
}) {
  const { recordCashMovement } = useApp();
  const [jumlah, setJumlah] = useState('');
  const [keterangan, setKeterangan] = useState('');
  const [error, setError] = useState<string | null>(null);

  const prefix = kind === 'expense' ? 'pengeluaran' : kind === 'withdrawn' ? 'tarik' : 'setor';

  async function submit() {
    setError(null);
    const rupiah = parseRupiah(jumlah);
    if (rupiah === null) {
      setError('Jumlah harus angka. Contoh: 25.000');
      return;
    }
    if (reasonRequired && !keterangan.trim()) {
      setError('Keterangan wajib diisi supaya uangnya bisa dipertanggungjawabkan.');
      return;
    }
    try {
      await recordCashMovement({ kind, jumlah: rupiah, keterangan });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field
        label={`Jumlah ${label.toLowerCase()} (Rp)`}
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="number-pad"
        placeholder="25.000"
        error={error}
        testID={`${prefix}-jumlah`}
      />
      <Field
        label={reasonLabel}
        value={keterangan}
        onChangeText={setKeterangan}
        placeholder={kind === 'expense' ? 'Contoh: listrik' : kind === 'withdrawn' ? 'Contoh: setor ke bank' : 'Contoh: tambah modal'}
        testID={`${prefix}-keterangan`}
      />
      <Note>
        {kind === 'expense'
          ? 'Pengeluaran mengurangi kas yang seharusnya. Tulis untuk apa, supaya selisih nanti bisa dijelaskan.'
          : kind === 'withdrawn'
            ? 'Uang yang ditarik keluar dari laci, termasuk menyetor hasil penjualan ke bank.'
            : 'Uang yang masuk ke laci dari luar, bukan dari penjualan.'}
      </Note>
      <Button label="Simpan" onPress={submit} testID={`simpan-${prefix}`} />
    </>
  );
}

function OpeningFloatForm({ onDone }: { onDone: () => void }) {
  const { setOpeningFloat } = useApp();
  const [jumlah, setJumlah] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    const rupiah = parseRupiah(jumlah);
    if (rupiah === null) {
      setError('Jumlah harus angka. Contoh: 200.000');
      return;
    }
    try {
      await setOpeningFloat({ jumlah: rupiah });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Note>
        Nyatakan berapa uang yang ada di laci sekarang. Angka ini menjadi patokan kas yang seharusnya sampai ada
        hitung berikutnya.
      </Note>
      <Field
        label="Kas awal (Rp)"
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="number-pad"
        placeholder="200.000"
        autoFocus
        error={error}
        testID="float-jumlah"
      />
      <Button label="Simpan kas awal" onPress={submit} testID="simpan-float" />
    </>
  );
}

function CountForm({ onDone }: { onDone: () => void }) {
  const { cashDrawer, countCash } = useApp();
  const drawer = cashDrawer();
  const [jumlah, setJumlah] = useState('');
  const [catatan, setCatatan] = useState('');
  const [error, setError] = useState<string | null>(null);

  const counted = parseRupiah(jumlah);
  const difference = counted === null ? null : counted - drawer.expected;

  async function submit() {
    setError(null);
    if (counted === null) {
      setError('Jumlah dihitung harus angka. Contoh: 195.000');
      return;
    }
    try {
      await countCash({ counted, catatan });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      {/*
        The figure being counted against comes first, so focusing the count
        field can never push it away. It is printed once, as the total window.
      */}
      <View style={styles.countSummary} testID="hitung-ringkasan">
        <TotalBlock amount={drawer.expected} label="Kas yang seharusnya" testID="hitung-expected" />
        <AppText typeRole="labelSmall" tone="muted" testID="hitung-patokan">
          {baselineLabel(drawer.baseline)}
        </AppText>
      </View>
      <Field
        label="Uang yang dihitung (Rp)"
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="number-pad"
        placeholder="195.000"
        autoFocus
        error={error}
        testID="hitung-jumlah"
      />
      <AppText typeRole="titleMedium" tone={difference !== null && difference !== 0 ? 'owed' : 'primary'} testID="hitung-selisih">
        {difference === null ? 'Masukkan jumlah yang dihitung' : selisihLabel(difference)}
      </AppText>
      <Field
        label="Catatan (opsional)"
        value={catatan}
        onChangeText={setCatatan}
        placeholder="Contoh: uang kembalian terselip"
        testID="hitung-catatan"
      />
      <Note>Hitung kas tidak mengunci toko. Penjualan sesudahnya tetap bisa dicatat.</Note>
      <Button label="Simpan hitung kas" onPress={submit} testID="simpan-hitung" />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingBottom: space.xxl, gap: space.sm },
  columns: { flex: 1, flexDirection: 'row', minHeight: 0 },
  column: { flex: 1, minWidth: 0 },
  columnRule: { width: StyleSheet.hairlineWidth, backgroundColor: colors.outline },
  block: { paddingTop: space.lg, gap: space.xs },
  actions: { flexDirection: 'row', gap: space.sm, paddingTop: space.sm },
  grow: { flex: 1 },
  countSummary: { paddingTop: space.sm, paddingBottom: space.md, gap: space.xs },
  cashRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    minHeight: 44,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
  },
  cashRowDivided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  cashLabel: { flex: 1 },
  history: {
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
    gap: space.xs,
  },
});
