import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  AppText,
  Note,
  colors,
  fontFamily,
  formatQty,
  formatRupiah,
  space,
  typography,
} from '@/design';
import { teks, type PaymentInput, type Sale, type Varian } from '@/ledger';
import { shareReceipt } from '@/ledger/receipt';
import { printer } from '@/ledger/printer';
import { useApp, type TapOutcome } from '@/ledger/useLedger';
import { searchVarian } from '@/ledger/queries';
import { NotaSheet } from '@/screens/Nota';
import { ChoiceSheet } from '@/screens/ChoiceSheet';
import { PaymentStep } from '@/screens/PaymentStep';
import { ReceiptScreen } from '@/screens/Receipt';

/**
 * Kasir — the sell screen.
 *
 * The grid lists variants, not products: a tap either adds one, opens the
 * sizes of a multi-variant product, or opens the weight control. The cart sits
 * below it so the running total is on screen at all times.
 */
export function KasirScreen() {
  const { shop, cart, cartRestored, tapItem, addVarian, setLineQty, removeLine, cancelCart, saveSale, lastSaleId, forgetLastSale } =
    useApp();
  const [query, setQuery] = useState('');
  const [choice, setChoice] = useState<Extract<TapOutcome, { kind: 'chooseVariant' | 'chooseWeight' }> | null>(null);
  const [paying, setPaying] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [shareError, setShareError] = useState<string | null>(null);
  const insets = useSafeAreaInsets();

  const varian = useMemo(() => searchVarian(shop.varian.filter((entry) => !entry.archived), query), [shop.varian, query]);

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
    saveSale(payment)
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
          onNewSale={forgetLastSale}
          onShare={() => handleShare(sale)}
          sharing={sharing}
          shareError={shareError}
        />
      );
    }
  }

  if (paying) {
    return (
      <PaymentStep
        cart={cart}
        saving={saving}
        error={saveError}
        onBack={() => setPaying(false)}
        onPay={handleSave}
      />
    );
  }

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          KasirKu
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          Kasir
        </AppText>
      </View>

      <View style={styles.searchRow}>
        <TextInput
          testID="cari-barang"
          accessibilityLabel="Cari barang"
          value={query}
          onChangeText={setQuery}
          placeholder={teks.cari}
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.search}
        />
      </View>

      {cartRestored ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.restored} testID="nota-dipulihkan">
          {teks.dipulihkan}
        </AppText>
      ) : null}

      {shop.varian.length === 0 ? (
        <View style={styles.empty}>
          <AppText typeRole="titleMedium" tone="primary" style={styles.emptyTitle}>
            {teks.belumDiatur}
          </AppText>
          <Note>{teks.kosongPanduan}</Note>
        </View>
      ) : (
        <FlatList
          data={varian}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.gridContent}
          keyboardShouldPersistTaps="handled"
          ListEmptyComponent={
            <AppText typeRole="bodyMedium" tone="muted" style={styles.noMatch}>
              Tidak ada barang yang cocok.
            </AppText>
          }
          renderItem={({ item }) => <VarianRow varian={item} cart={cart} onPress={() => handleTap(item)} />}
        />
      )}

      {saveError ? (
        <AppText typeRole="bodyMedium" tone="owed" style={styles.saveError}>
          {saveError}
        </AppText>
      ) : null}

      <NotaSheet
        cart={cart}
        onSetQty={setLineQty}
        onRemove={removeLine}
        onCancel={cancelCart}
        onSave={() => setPaying(true)}
        saving={saving}
      />

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
 * One tappable line of the grid. It shows the variant's own name — variants
 * are what is sold, so the size is never guessed from the product.
 */
function VarianRow({ varian, cart, onPress }: { varian: Varian; cart: ReturnType<typeof useApp>['cart']; onPress: () => void }) {
  const line = cart.find((entry) => entry.varianId === varian.id);
  return (
    <Pressable
      testID={`grid-${varian.id}`}
      accessibilityRole="button"
      accessibilityLabel={`${varian.nama}, ${formatRupiah(varian.harga)} per ${varian.satuan}`}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={({ pressed }) => [styles.row, line ? styles.rowInCart : null, pressed && styles.rowPressed]}
    >
      <View style={styles.rowMain}>
        {varian.kode ? (
          <AppText typeRole="labelSmall" tone="muted" style={styles.kode}>
            {varian.kode}
          </AppText>
        ) : null}
        <AppText typeRole="bodyLarge" numberOfLines={1} style={styles.rowName}>
          {varian.nama}
        </AppText>
        {line ? (
          <AppText typeRole="numericMedium" tone="primary" style={styles.mark}>
            {`×${formatQty(line.qty)}`}
          </AppText>
        ) : null}
      </View>
      <AppText typeRole="numericLarge" align="right" style={styles.price}>
        {formatRupiah(varian.harga)}
      </AppText>
      <AppText typeRole="labelSmall" tone="muted" style={styles.unit}>
        {`/${varian.satuan}`}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    minHeight: 56,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  searchRow: { paddingHorizontal: space.gutter, paddingTop: space.md },
  search: {
    height: space.touch,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 4,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
  },
  restored: { paddingHorizontal: space.gutter, paddingTop: space.sm },
  empty: { flex: 1 },
  emptyTitle: { paddingHorizontal: space.gutter, paddingTop: space.xl },
  noMatch: { paddingHorizontal: space.gutter, paddingVertical: space.lg },
  gridContent: { paddingBottom: space.lg },
  row: {
    minHeight: space.touch + 6,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    overflow: 'hidden',
  },
  rowInCart: { backgroundColor: colors.primaryContainer },
  rowPressed: { opacity: 0.9 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  kode: { minWidth: 46 },
  rowName: { flexShrink: 1 },
  mark: { paddingLeft: space.xs },
  price: { width: 80 },
  unit: { width: 44 },
  saveError: { paddingHorizontal: space.gutter, paddingBottom: space.sm },
});
