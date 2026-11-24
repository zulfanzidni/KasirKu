import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppHeader,
  AppText,
  BottomSheet,
  Button,
  Card,
  Chip,
  ChipScroller,
  Icon,
  Note,
  SearchField,
  colors,
  formatQty,
  formatRupiah,
  shape,
  space,
  useFrame,
} from '@/design';
import { teks, type PaymentInput, type Sale, type Varian } from '@/ledger';
import { shareReceipt } from '@/ledger/receipt';
import { printer } from '@/ledger/printer';
import { useApp, type TapOutcome } from '@/ledger/useLedger';
import { searchVarian, sellableVarian } from '@/ledger/queries';
import { CartBar, NotaPanel, NotaScreen } from '@/screens/Nota';
import { ChoiceSheet } from '@/screens/ChoiceSheet';
import { CustomerStep } from '@/screens/CustomerStep';
import { PaymentStep } from '@/screens/PaymentStep';
import { ReceiptScreen } from '@/screens/Receipt';

/**
 * Kasir — the sell screen.
 *
 * The grid lists variants, not products: a tap adds that varian, except a
 * weight item, which opens the amount control. A tile is a target, not a line
 * of text: its picture well is the top half of the card.
 *
 * The frame is the till. Portrait is one column: the grid with the cart along
 * the bottom. Landscape is two panes: the grid on the left, the nota as a fixed
 * panel on the right where the counter's paper would be.
 */
export function KasirScreen() {
  const {
    shop,
    cart,
    cartRestored,
    tapItem,
    addVarian,
    setLineQty,
    removeLine,
    cancelCart,
    saveSale,
    lastSaleId,
    forgetLastSale,
    todayTotals,
    hutangOf,
  } = useApp();
  const [query, setQuery] = useState('');
  const [kategoriId, setKategoriId] = useState<string | null>(null);
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'chooseWeight' }> | null>(null);
  const [step, setStep] = useState<'nota' | 'pelanggan' | 'bayar'>('nota');
  const [notaOpen, setNotaOpen] = useState(false);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [pelangganId, setPelangganId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  /** Wide enough for two panes: the width Material calls "medium" and up. */
  const { wide } = useFrame();

  const sellable = useMemo(() => sellableVarian(shop), [shop]);
  const varian = useMemo(() => {
    const found = searchVarian(sellable, query);
    if (!kategoriId) return found;
    const produkIds = new Set(
      shop.produk.filter((entry) => entry.kategoriId === kategoriId).map((entry) => entry.id),
    );
    return found.filter((entry) => produkIds.has(entry.produkId));
  }, [sellable, query, kategoriId, shop.produk]);
  const pelanggan = pelangganId ? shop.pelanggan.find((entry) => entry.id === pelangganId) ?? null : null;
  const hari = todayTotals();
  const kategoriAktif = shop.kategori.filter((entry) => !entry.archived);
  const notaHariIni = shop.sales.filter((sale) => sameDay(sale.createdAt, new Date()) && !sale.voided).length;

  function handleTap(item: Varian) {
    const outcome = tapItem(item.id);
    if (outcome.kind === 'chooseWeight') setChoice(outcome);
  }

  /**
   * The one save path. `setSaving` runs synchronously inside the press, so the
   * button below is disabled on the very next render; `saving` also guards
   * this closure, so a second press in the same tick cannot start a second save.
   */
  function handleSave(payment: PaymentInput) {
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    // A null (another save in flight) never reaches here — `saving` above
    // refuses it — but the type says so, and a refusal must hand the button back.
    Promise.resolve(saveSale(payment))
      .then((saleId) => {
        // Success replaces this screen with the receipt; a refusal (an empty
        // cart, or another save already running) hands the button back.
        if (!saleId) setSaving(false);
      })
      .catch((cause: unknown) => {
        setSaveError(cause instanceof Error ? cause.message : String(cause));
        setSaving(false);
      });
  }

  /**
   * Writes the nota to a PDF and opens the share sheet. The sale is already
   * saved, so a failed share loses nothing but the paper: it says so and
   * leaves the nota on screen to try again.
   */
  function handleShare(sale: Sale) {
    if (sharing) return;
    setSharing(true);
    setShareError(null);
    shareReceipt(printer.current, sale, shop.receipt)
      .catch((cause: unknown) => setShareError(cause instanceof Error ? cause.message : String(cause)))
      .finally(() => setSharing(false));
  }

  if (lastSaleId) {
    const sale = shop.sales.find((entry) => entry.id === lastSaleId);
    if (sale) {
      return (
        <ReceiptScreen
          sale={sale}
          shop={shop.receipt}
          onNewSale={() => {
            forgetLastSale();
            setStep('nota');
            setPelangganId(null);
          }}
          onShare={() => handleShare(sale)}
          sharing={sharing}
          shareError={shareError}
        />
      );
    }
  }

  if (step === 'pelanggan') {
    return (
      <CustomerStep
        pelanggan={shop.pelanggan.filter((entry) => !entry.archived)}
        hutangOf={hutangOf}
        onPick={(id) => {
          setPelangganId(id);
          setStep('bayar');
        }}
        onBack={() => setStep('nota')}
      />
    );
  }

  if (step === 'bayar') {
    return (
      <PaymentStep
        cart={cart}
        pelanggan={pelanggan}
        onPickCustomer={() => setStep('pelanggan')}
        saving={saving}
        error={saveError}
        onBack={() => setStep('nota')}
        onPay={handleSave}
      />
    );
  }

  const header = (
    <>
      <AppHeader role="Kasir" />
      <View style={styles.titleBlock}>
        <AppText typeRole="headlineSmall">Kasir</AppText>
        <AppText typeRole="bodyMedium" tone="muted" testID="hari-ini">
          {`Hari ini · ${notaHariIni} nota · `}
          <AppText typeRole="bodyMedium" tone="muted" testID="hari-ini-jualan">
            {`Jualan ${formatRupiah(hari.penjualan)}`}
          </AppText>
          {' · '}
          <AppText typeRole="bodyMedium" tone="muted" testID="hari-ini-tunai">
            {`Tunai ${formatRupiah(hari.tunai)}`}
          </AppText>
        </AppText>
      </View>
      <SearchField
        testID="cari-barang"
        accessibilityLabel="Cari barang"
        value={query}
        onChangeText={setQuery}
        placeholder={teks.cari}
        style={styles.search}
      />
      <ChipScroller>
        <Chip label="Semua" selected={kategoriId === null} onPress={() => setKategoriId(null)} testID="filter-semua" />
        {kategoriAktif.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.nama}
            selected={kategoriId === entry.id}
            onPress={() => setKategoriId(entry.id)}
            testID={`filter-${entry.id}`}
          />
        ))}
      </ChipScroller>
      <View style={styles.gap} />
    </>
  );

  const grid =
    sellable.length === 0 ? (
      <View style={styles.empty}>
        <AppText typeRole="titleMedium" style={styles.emptyTitle}>
          {teks.belumDiatur}
        </AppText>
        <Note>{teks.kosongPanduan}</Note>
      </View>
    ) : (
      <FlatList
        data={varian}
        keyExtractor={(item) => item.id}
        numColumns={2}
        style={styles.grid}
        contentContainerStyle={styles.gridContent}
        columnWrapperStyle={styles.tileRow}
        keyboardShouldPersistTaps="handled"
        ListEmptyComponent={
          <AppText typeRole="bodyMedium" tone="muted" style={styles.noMatch}>
            Tidak ada barang yang cocok.
          </AppText>
        }
        renderItem={({ item }) => {
          const line = cart.find((entry) => entry.varianId === item.id);
          return <VarianTile varian={item} qty={line?.qty ?? 0} onPress={() => handleTap(item)} />;
        }}
      />
    );

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {header}

      {cartRestored ? (
        <AppText typeRole="bodySmall" tone="muted" style={styles.restored} testID="nota-dipulihkan">
          {teks.dipulihkan}
        </AppText>
      ) : null}

      {wide ? (
        <View style={styles.main}>
          <View style={styles.pane}>{grid}</View>
          <NotaPanel
            cart={cart}
            onSetQty={setLineQty}
            onRemove={removeLine}
            onCancel={() => setConfirmCancel(true)}
            onSave={() => setStep('pelanggan')}
            saving={saving}
          />
        </View>
      ) : (
        <View style={styles.pane}>{grid}</View>
      )}

      {saveError ? (
        <AppText typeRole="bodySmall" tone="owed" style={styles.saveError}>
          {saveError}
        </AppText>
      ) : null}

      {wide ? null : (
        <CartBar
          cart={cart}
          onOpen={() => setNotaOpen(true)}
          onCancel={() => setConfirmCancel(true)}
          onSave={() => setStep('pelanggan')}
          saving={saving}
        />
      )}

      {notaOpen && !wide ? (
        <NotaScreen
          cart={cart}
          onClose={() => setNotaOpen(false)}
          onSetQty={setLineQty}
          onRemove={removeLine}
          onCancel={() => {
            setNotaOpen(false);
            setConfirmCancel(true);
          }}
          onSave={() => setStep('pelanggan')}
          saving={saving}
        />
      ) : null}

      <BottomSheet
        visible={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Batalkan nota"
        testID="konfirmasi-batal"
      >
        <View style={styles.confirm}>
          <AppText typeRole="bodyLarge">Kosongkan nota? Semua barang akan dibuang.</AppText>
          <View style={styles.confirmActions}>
            <Button
              label="Tidak"
              variant="outlined"
              onPress={() => setConfirmCancel(false)}
              style={styles.confirmCancel}
            />
            <Button
              label="Kosongkan"
              variant="destructive"
              onPress={() => {
                setConfirmCancel(false);
                cancelCart();
              }}
              testID="kosongkan-nota"
              style={styles.grow}
            />
          </View>
        </View>
      </BottomSheet>

      <ChoiceSheet
        choice={choice}
        onClose={() => setChoice(null)}
        onAdd={(varianId, qty) => {
          addVarian(varianId, qty);
          setChoice(null);
        }}
      />
    </View>
  );
}

/**
 * One tappable tile. The well at its top is the photo's shape — the shop has no
 * pictures yet, so it stays the ground's own grey. The blue mark says how many
 * of this variant the nota already holds; the blue circle adds one more.
 */
function VarianTile({ varian, qty, onPress }: { varian: Varian; qty: number; onPress: () => void }) {
  const inCart = qty > 0;
  return (
    <Pressable
      testID={`grid-${varian.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${varian.nama}, ${formatRupiah(varian.harga)} per ${varian.satuan}`}
      accessibilityState={{ selected: inCart }}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={styles.tilePress}
    >
      <Card style={styles.tile}>
        <View style={styles.well}>
          {inCart ? (
            <View style={styles.qtyBadge}>
              <AppText typeRole="tabLabel" tone="onPrimary" testID={`qty-${varian.id}`}>
                {formatQty(qty)}
              </AppText>
            </View>
          ) : null}
        </View>
        <View style={styles.tileBody}>
          <AppText typeRole="titleSmall" numberOfLines={1}>
            {varian.nama}
          </AppText>
          <View style={styles.tileFoot}>
            <AppText typeRole="titleSmall">{formatRupiah(varian.harga)}</AppText>
            <AppText typeRole="bodySmall" tone="muted" numberOfLines={1}>
              {`/${varian.satuan}`}
            </AppText>
            <View style={styles.add}>
              <Icon name="add" size={14} color={colors.onPrimary} strokeWidth={2.2} />
            </View>
          </View>
        </View>
      </Card>
    </Pressable>
  );
}

function sameDay(at: string, now: Date): boolean {
  const then = new Date(at);
  return (
    then.getFullYear() === now.getFullYear() &&
    then.getMonth() === now.getMonth() &&
    then.getDate() === now.getDate()
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  titleBlock: { paddingHorizontal: space.gutter, paddingTop: space.sm, paddingBottom: space.md, gap: 2 },
  search: { marginHorizontal: space.gutter },
  gap: { height: space.md },
  restored: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  main: { flex: 1, flexDirection: 'row' },
  pane: { flex: 1 },
  grid: { flex: 1 },
  gridContent: { padding: space.gutter, paddingTop: space.md, gap: space.sm, paddingBottom: space.lg },
  tileRow: { gap: space.sm },
  tilePress: { flex: 1 },
  tile: { minHeight: 124, overflow: 'hidden' },
  well: {
    height: 66,
    backgroundColor: colors.imageWell,
    borderTopLeftRadius: shape.lg,
    borderTopRightRadius: shape.lg,
    alignItems: 'flex-end',
  },
  qtyBadge: {
    margin: space.sm,
    minWidth: 22,
    height: 22,
    paddingHorizontal: 5,
    borderRadius: 11,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tileBody: { padding: space.sm, paddingHorizontal: space.md, gap: space.xs },
  tileFoot: { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  add: {
    marginLeft: 'auto',
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  empty: { flex: 1 },
  emptyTitle: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  noMatch: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
  saveError: { paddingHorizontal: space.gutter, paddingBottom: space.sm },
  confirm: { gap: space.lg },
  confirmActions: { flexDirection: 'row', gap: space.sm },
  confirmCancel: { width: 104 },
  grow: { flex: 1 },
});
