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
  colors,
  formatQty,
  formatRupiah,
  parseQty,
  parseRupiah,
  space,
} from '@/design';
import { IconButton } from '@/design/components/Icons';
import { sellableVarian, type Settlement, type SupplierPayable } from '@/ledger';
import { useApp } from '@/ledger/useLedger';

/**
 * Pemasok — who the shop buys from, what each visit brought, and what is owed
 * before the supplier walks in.
 *
 * The total is never stored and never typed: it is the log's answer, and the
 * screen always shows what it is made of (tempo, titip that sold, and what has
 * been paid) so the owner never does arithmetic at the door.
 */

type Sheet =
  | { kind: 'pemasok' }
  | { kind: 'nota'; supplierId: string }
  | { kind: 'bayar'; supplierId: string }
  | { kind: 'kembali'; supplierId: string };

const SETTLEMENTS: readonly { value: Settlement; label: string }[] = [
  { value: 'tunai', label: 'Tunai' },
  { value: 'tempo', label: 'Tempo' },
  { value: 'titip', label: 'Titip' },
];

function settlementLabel(settlement: Settlement): string {
  return SETTLEMENTS.find((entry) => entry.value === settlement)?.label ?? settlement;
}

export function PemasokScreen({ onBack }: { onBack?: () => void } = {}) {
  const { shop, supplierPayables, titipStock } = useApp();
  const [sheet, setSheet] = useState<Sheet | null>(null);
  const payables = supplierPayables();
  const titip = titipStock();
  const sheetPayable = (() => {
    if (!sheet || sheet.kind === 'pemasok') return null;
    return payables.find((entry) => entry.supplier.id === sheet.supplierId) ?? null;
  })();

  return (
    <Screen
      title="Pemasok"
      overline="Orang"
      actions={
        <View style={styles.headerActions}>
          {onBack ? (
            <IconButton name="arrow-back" label="Kembali" onPress={onBack} testID="kembali-ke-orang" />
          ) : null}
          <IconButton
            name="add"
            label="Tambah pemasok"
            onPress={() => setSheet({ kind: 'pemasok' })}
            testID="tambah-pemasok"
          />
        </View>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        {payables.length === 0 ? <Note>Belum ada pemasok.</Note> : null}
        {payables.map((entry) => (
          <SupplierRow
            key={entry.supplier.id}
            payable={entry}
            titip={titip
              .filter((line) => line.supplierId === entry.supplier.id)
              .map((line) => {
                const varian = shop.varian.find((candidate) => candidate.id === line.varianId);
                return {
                  varianId: line.varianId,
                  nama: varian?.nama ?? line.varianId,
                  satuan: varian?.satuan ?? 'pcs',
                  qty: line.qty,
                };
              })}
            onNota={() => setSheet({ kind: 'nota', supplierId: entry.supplier.id })}
            onBayar={() => setSheet({ kind: 'bayar', supplierId: entry.supplier.id })}
            onKembali={() => setSheet({ kind: 'kembali', supplierId: entry.supplier.id })}
          />
        ))}
      </ScrollView>

      <BottomSheet
        visible={sheet?.kind === 'pemasok'}
        onClose={() => setSheet(null)}
        title="Tambah pemasok"
        testID="form-pemasok"
      >
        {sheet?.kind === 'pemasok' ? <SupplierForm onDone={() => setSheet(null)} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'nota'}
        onClose={() => setSheet(null)}
        title={sheetPayable ? `Nota dari ${sheetPayable.supplier.nama}` : 'Nota dari pemasok'}
        testID="form-nota"
      >
        {sheet?.kind === 'nota' ? <DeliveryForm supplierId={sheet.supplierId} onDone={() => setSheet(null)} /> : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'bayar'}
        onClose={() => setSheet(null)}
        title={sheetPayable ? `Bayar ${sheetPayable.supplier.nama}` : 'Bayar pemasok'}
        testID="form-bayar-pemasok"
      >
        {sheet?.kind === 'bayar' && sheetPayable ? (
          <PaymentForm payable={sheetPayable} onDone={() => setSheet(null)} />
        ) : null}
      </BottomSheet>

      <BottomSheet
        visible={sheet?.kind === 'kembali'}
        onClose={() => setSheet(null)}
        title={sheetPayable ? `Kembalikan titip ke ${sheetPayable.supplier.nama}` : 'Kembalikan titip'}
        testID="form-kembali-titip"
      >
        {sheet?.kind === 'kembali' ? <ReturnForm supplierId={sheet.supplierId} onDone={() => setSheet(null)} /> : null}
      </BottomSheet>
    </Screen>
  );
}

function SupplierRow({
  payable,
  titip,
  onNota,
  onBayar,
  onKembali,
}: {
  payable: SupplierPayable;
  titip: { varianId: string; nama: string; satuan: string; qty: number }[];
  onNota: () => void;
  onBayar: () => void;
  onKembali: () => void;
}) {
  const { supplier, tempo, titip: titipSold, paid, total } = payable;
  const titipReading = titip.map((line) => `${formatQty(line.qty)} ${line.satuan}`).join(' · ');

  return (
    <View testID={`pemasok-baris-${supplier.id}`} style={styles.supplier}>
      <AppText typeRole="bodyLarge">{supplier.nama}</AppText>
      <AppText
        typeRole="titleMedium"
        tone={total > 0 ? 'owed' : 'muted'}
        testID={`utang-${supplier.id}`}
      >
        {total > 0 ? `Utang Rp ${formatRupiah(total)}` : 'Tidak ada utang'}
      </AppText>
      <AppText typeRole="labelSmall" tone="muted" testID={`rincian-${supplier.id}`}>
        {`Tempo Rp ${formatRupiah(tempo)} · Titip terjual Rp ${formatRupiah(titipSold)} · Dibayar Rp ${formatRupiah(paid)}`}
      </AppText>
      {titip.length > 0 ? (
        <AppText typeRole="labelSmall" tone="muted" testID={`titip-pemasok-${supplier.id}`}>
          {`Titip di rak: ${titipReading}`}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Button label="Catat nota" variant="outlined" onPress={onNota} testID={`nota-${supplier.id}`} />
        <Button label="Bayar" variant="text" onPress={onBayar} testID={`bayar-${supplier.id}`} />
        <Button label="Kembalikan titip" variant="text" onPress={onKembali} testID={`kembali-${supplier.id}`} />
      </View>
    </View>
  );
}

function SupplierForm({ onDone }: { onDone: () => void }) {
  const { supplierBook } = useApp();
  const [nama, setNama] = useState('');
  const [telepon, setTelepon] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!supplierBook) return;
    try {
      await supplierBook.createSupplier({ nama, telepon });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <Field label="Nama pemasok" value={nama} onChangeText={setNama} autoFocus error={error} testID="pemasok-nama" />
      <Field
        label="Telepon (opsional)"
        value={telepon}
        onChangeText={setTelepon}
        keyboardType="phone-pad"
        testID="pemasok-telepon"
      />
      <Button label="Simpan pemasok" onPress={submit} testID="simpan-pemasok" />
    </>
  );
}

interface DraftLine {
  varianId: string;
  nama: string;
  satuan: string;
  qty: number;
  settlement: Settlement;
  hargaBeli?: number;
}

/**
 * One visit, several lines. Each line chooses its own settlement because a
 * real delivery mixes cash goods, credited goods and consignment goods; the
 * saved note is still one record, sharing one nota id.
 */
function DeliveryForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const { shop, supplierBook } = useApp();
  const sellable = sellableVarian(shop);
  const [varianId, setVarianId] = useState<string | null>(sellable[0]?.id ?? null);
  const [settlement, setSettlement] = useState<Settlement>('tunai');
  const [qty, setQty] = useState('');
  const [harga, setHarga] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([]);
  const [error, setError] = useState<string | null>(null);

  const varian = sellable.find((entry) => entry.id === varianId) ?? null;

  function addLine() {
    setError(null);
    if (!varian) {
      setError('Pilih barang dulu.');
      return;
    }
    const jumlah = parseQty(qty);
    if (jumlah === null || jumlah <= 0) {
      setError('Jumlah harus angka lebih dari 0. Contoh: 10 atau 2,5');
      return;
    }
    const rupiah = harga.trim() === '' ? null : parseRupiah(harga);
    if (harga.trim() !== '' && rupiah === null) {
      setError('Harga beli harus angka. Contoh: 8.000');
      return;
    }
    if (settlement !== 'tunai' && rupiah === null) {
      setError('Harga beli wajib untuk tempo atau titip.');
      return;
    }
    setLines((current) => [
      ...current,
      {
        varianId: varian.id,
        nama: varian.nama,
        satuan: varian.satuan,
        qty: jumlah,
        settlement,
        hargaBeli: rupiah ?? undefined,
      },
    ]);
    setQty('');
    setHarga('');
  }

  async function submit() {
    if (!supplierBook) return;
    setError(null);
    if (lines.length === 0) {
      setError('Nota harus punya minimal satu baris.');
      return;
    }
    try {
      await supplierBook.receiveDelivery({
        supplierId,
        lines: lines.map((line) => ({
          varianId: line.varianId,
          qty: line.qty,
          settlement: line.settlement,
          hargaBeli: line.hargaBeli,
        })),
      });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <AppText typeRole="labelSmall" tone="muted" style={styles.pickLabel}>
        Barang
      </AppText>
      <ChipRow>
        {sellable.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.nama}
            selected={entry.id === varianId}
            onPress={() => setVarianId(entry.id)}
            testID={`nota-varian-${entry.id}`}
          />
        ))}
      </ChipRow>

      <AppText typeRole="labelSmall" tone="muted" style={styles.pickLabel}>
        Cara bayar
      </AppText>
      <ChipRow>
        {SETTLEMENTS.map((entry) => (
          <Chip
            key={entry.value}
            label={entry.label}
            selected={settlement === entry.value}
            onPress={() => setSettlement(entry.value)}
            testID={`nota-${entry.value}`}
          />
        ))}
      </ChipRow>

      <Field
        label={`Jumlah (${varian?.satuan ?? 'satuan'})`}
        value={qty}
        onChangeText={setQty}
        keyboardType="decimal-pad"
        placeholder="10"
        testID="nota-jumlah"
      />
      <Field
        label="Harga beli per satuan (Rp)"
        value={harga}
        onChangeText={setHarga}
        keyboardType="number-pad"
        placeholder="8.000"
        testID="nota-harga"
      />
      <Button label="Tambah baris" variant="outlined" onPress={addLine} testID="nota-tambah-baris" />

      {lines.map((line, index) => (
        <View key={`${line.varianId}-${index}`} testID={`nota-baris-${index}`} style={styles.draftLine}>
          <AppText typeRole="bodyMedium">
            {`${line.nama} · ${formatQty(line.qty)} ${line.satuan} · ${settlementLabel(line.settlement)}`}
          </AppText>
          <AppText typeRole="labelSmall" tone="muted">
            {line.hargaBeli == null ? 'Tanpa harga beli' : `Harga beli Rp ${formatRupiah(line.hargaBeli)}`}
          </AppText>
        </View>
      ))}

      {error ? (
        <AppText typeRole="bodyMedium" tone="owed" testID="nota-error">
          {error}
        </AppText>
      ) : null}
      <Note>Nota ini boleh mencampur tunai, tempo, dan titip dalam satu kunjungan.</Note>
      <Button label="Simpan nota" onPress={submit} testID="simpan-nota" />
    </>
  );
}

function PaymentForm({ payable, onDone }: { payable: SupplierPayable; onDone: () => void }) {
  const { supplierBook } = useApp();
  const [jumlah, setJumlah] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!supplierBook) return;
    const amount = parseRupiah(jumlah);
    if (amount === null) {
      setError('Jumlah harus angka. Contoh: 50.000');
      return;
    }
    try {
      await supplierBook.paySupplier({ supplierId: payable.supplier.id, amount });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  return (
    <>
      <AppText typeRole="bodyMedium" tone="muted" testID="bayar-total">
        {`Sisa utang Rp ${formatRupiah(payable.total)}`}
      </AppText>
      <Field
        label="Jumlah dibayar (Rp)"
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="number-pad"
        placeholder="50.000"
        error={error}
        testID="bayar-jumlah"
      />
      <Note>Pembayaran sebagian mengurangi utang; sisanya tetap tercatat.</Note>
      <Button label="Simpan pembayaran" onPress={submit} testID="simpan-bayar" />
    </>
  );
}

function ReturnForm({ supplierId, onDone }: { supplierId: string; onDone: () => void }) {
  const { shop, titipStock, supplierBook } = useApp();
  const titip = titipStock(supplierId).flatMap((line) => {
    const varian = shop.varian.find((entry) => entry.id === line.varianId);
    return varian ? [{ ...line, varian }] : [];
  });
  const [varianId, setVarianId] = useState<string | null>(titip[0]?.varianId ?? null);
  const [jumlah, setJumlah] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!supplierBook) return;
    if (!varianId) {
      setError('Pilih barang titip dulu.');
      return;
    }
    const qty = parseQty(jumlah);
    if (qty === null || qty <= 0) {
      setError('Jumlah harus angka lebih dari 0.');
      return;
    }
    try {
      await supplierBook.returnTitip({ supplierId, varianId, qty });
      onDone();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  }

  if (titip.length === 0) return <Note>Tidak ada titip yang tersisa.</Note>;

  return (
    <>
      <ChipRow>
        {titip.map((line) => (
          <Chip
            key={line.varianId}
            label={`${line.varian.nama} (${formatQty(line.qty)} ${line.varian.satuan})`}
            selected={line.varianId === varianId}
            onPress={() => setVarianId(line.varianId)}
            testID={`kembali-varian-${line.varianId}`}
          />
        ))}
      </ChipRow>
      <Field
        label="Jumlah dikembalikan"
        value={jumlah}
        onChangeText={setJumlah}
        keyboardType="decimal-pad"
        placeholder="4"
        error={error}
        testID="kembali-jumlah"
      />
      <Note>Barang titip yang kembali ke pemasok tidak mengubah uang: utang hanya lahir dari unit yang terjual.</Note>
      <Button label="Simpan pengembalian" onPress={submit} testID="simpan-kembali" />
    </>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.lg },
  headerActions: { flexDirection: 'row', alignItems: 'center' },
  supplier: {
    paddingHorizontal: space.gutter,
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    gap: space.xs,
  },
  actions: { paddingTop: space.sm, gap: space.sm },
  pickLabel: { paddingBottom: space.xs },
  draftLine: {
    paddingVertical: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
});
