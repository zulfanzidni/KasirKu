import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Note,
  colors,
  fontFamily,
  formatQty,
  formatRupiah,
  layout,
  shape,
  space,
  typography,
} from '@/design';
import { teks, type PaymentInput, type Sale, type Varian } from '@/ledger';
import { shareReceipt } from '@/ledger/receipt';
import { printer } from '@/ledger/printer';
import { useApp, type TapOutcome } from '@/ledger/useLedger';
import { searchVarian, sellableVarian } from '@/ledger/queries';
import { NotaPanel, NotaSheet } from '@/screens/Nota';
import { ChoiceSheet } from '@/screens/ChoiceSheet';
import { CustomerStep } from '@/screens/CustomerStep';
import { PaymentStep } from '@/screens/PaymentStep';
import { ReceiptScreen } from '@/screens/Receipt';

/**
 * Kasir — the sell screen.
 *
 * The grid lists variants, not products: a tap either adds one, opens the
 * sizes of a multi-variant product, or opens the weight control.
 *
 * The frame is the till. Portrait is one column: the grid with the nota folded
 * along the bottom. Landscape is two panes: the grid on the left, the nota as a
 * fixed panel on the right where the counter's paper would be. Same state, same
 * cart, two shapes for two widths.
 */
export function KasirScreen() {
  const { shop, cart, cartRestored, tapItem, addVarian, setLineQty, removeLine, cancelCart, saveSale, lastSaleId, forgetLastSale, todayTotals, hutangOf } =
    useApp();
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'chooseVariant' | 'chooseWeight' }> | null>(null);
  const [step, setStep] = useState<'nota' | 'pelanggan' | 'bayar'>('nota');
  const [pelangganId, setPelangganId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /** Wide enough for two panes: the width Material calls "medium" and up. */
  const wide = width >= layout.wide;

  const sellable = useMemo(() => sellableVarian(shop), [shop]);
  const varian = useMemo(() => searchVarian(sellable, query), [sellable, query]);
  const pelanggan = pelangganId ? shop.pelanggan.find((entry) => entry.id === pelangganId) ?? null : null;
  const hari = todayTotals();

  function handleTap(item: Varian) {
    const outcome = tapItem(item.id);
    if (outcome.kind === 'chooseVariant' || outcome.kind === 'chooseWeight') setChoice(outcome);
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

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={[styles.topbar, wide && styles.topbarWide]}>
        <View style={styles.brand}>
          <AppText typeRole="headlineSmall">KasirKu</AppText>
          {wide ? (
            <AppText typeRole="labelSmall" tone="muted">
              Kasir
            </AppText>
          ) : null}
        </View>

        <TextInput
          testID="cari-barang"
          accessibilityLabel="Cari barang"
          value={query}
          onChangeText={setQuery}
          placeholder={teks.cari}
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCorrect={false}
          style={[styles.search, wide && styles.searchWide]}
        />

        <View style={[styles.today, wide && styles.todayWide]} testID="hari-ini">
          <AppText typeRole="labelSmall" tone="muted">
            Hari ini
          </AppText>
          <AppText typeRole="bodyMedium" testID="hari-ini-jualan">
            {`Jualan ${formatRupiah(hari.penjualan)}`}
          </AppText>
          <AppText typeRole="bodyMedium" testID="hari-ini-tunai">
            {`Tunai ${formatRupiah(hari.tunai)}`}
          </AppText>
        </View>
      </View>

      {cartRestored ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.restored} testID="nota-dipulihkan">
          {teks.dipulihkan}
        </AppText>
      ) : null}

      <View style={styles.main}>
        {sellable.length === 0 ? (
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
              return (
                <VarianTile
                  varian={item}
                  qty={line?.qty ?? 0}
                  onPress={() => handleTap(item)}
                />
              );
            }}
          />
        )}

        {wide ? (
          <NotaPanel
            cart={cart}
            onSetQty={setLineQty}
            onRemove={removeLine}
            onCancel={cancelCart}
            onSave={() => setStep('pelanggan')}
            saving={saving}
          />
        ) : null}
      </View>

      {saveError ? (
        <AppText typeRole="bodyMedium" tone="owed" style={styles.saveError}>
          {saveError}
        </AppText>
      ) : null}

      {wide ? null : (
        <NotaSheet
          cart={cart}
          onSetQty={setLineQty}
          onRemove={removeLine}
          onCancel={cancelCart}
          onSave={() => setStep('pelanggan')}
          saving={saving}
        />
      )}

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
 * One tappable tile. It shows the variant's own name — variants are what is
 * sold, so the size is never guessed from the product — its price and unit, and
 * how many of them the nota already holds.
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
      style={({ pressed }) => [styles.tile, inCart && styles.tileInCart, pressed && styles.tilePressed]}
    >
      <AppText typeRole="bodyLarge" numberOfLines={2} style={styles.tileName}>
        {varian.nama}
      </AppText>
      <View style={styles.tileFoot}>
        {inCart ? (
          <View style={styles.mark}>
            <AppText typeRole="labelSmall" tone="onPrimary" style={styles.markText}>
              {`×${formatQty(qty)}`}
            </AppText>
          </View>
        ) : null}
        <AppText typeRole="numericLarge" style={styles.tilePrice}>
          {formatRupiah(varian.harga)}
        </AppText>
        <AppText typeRole="labelSmall" tone="muted" style={styles.unit}>
          {`/${varian.satuan}`}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  topbar: {
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    gap: space.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  topbarWide: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  brand: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  search: {
    height: space.touch,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: shape.md,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
  },
  searchWide: { flex: 1, maxWidth: 320, height: 40 },
  today: { flexDirection: 'row', alignItems: 'baseline', gap: space.md },
  todayWide: { marginLeft: 'auto', gap: space.lg },
  restored: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  main: { flex: 1, flexDirection: 'row' },
  grid: { flex: 1 },
  gridContent: { padding: space.sm, gap: space.sm, paddingBottom: space.lg },
  tileRow: { gap: space.sm },
  tile: {
    flex: 1,
    minHeight: 78,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    justifyContent: 'space-between',
    gap: space.xs,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
    borderWidth: 1,
    borderColor: colors.outline,
    overflow: 'hidden',
  },
  tileInCart: { borderWidth: 1.5, borderColor: colors.primary },
  tilePressed: { opacity: 0.9 },
  tileName: { flexShrink: 1 },
  tileFoot: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'flex-end', gap: space.xs },
  mark: { backgroundColor: colors.primary, borderRadius: 3, paddingHorizontal: space.xs, marginRight: 'auto' },
  markText: { fontSize: 10, lineHeight: 14, letterSpacing: 0.2 },
  tilePrice: { fontVariant: ['tabular-nums'] },
  unit: { fontSize: 10, lineHeight: 14, letterSpacing: 0.2 },
  empty: { flex: 1 },
  emptyTitle: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  noMatch: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
  saveError: { paddingHorizontal: space.gutter, paddingBottom: space.sm },
});
