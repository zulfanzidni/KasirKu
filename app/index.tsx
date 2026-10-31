import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Button, StockBadge, TotalBlock, colors, formatQty, formatRupiah, space } from '@/design';

/**
 * One sellable line of the nota: kode, name, stock reading, price.
 *
 * It owns its own layout because a variant row is the most repeated object in
 * the app — every screen that lists stock or sells an item uses this shape, and
 * getting the three columns aligned here is what keeps prices from shimmying.
 */
function VariantRow({
  title,
  kode,
  price,
  stock,
  minimum,
  qtyMark,
  selected,
}: {
  title: string;
  kode: string;
  price: number;
  stock: number | null;
  minimum?: number | null;
  qtyMark?: string;
  selected?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${title}${qtyMark ? `, ${qtyMark}` : ''}, ${formatRupiah(price)}`}
      android_ripple={{ color: colors.primaryContainer }}
      style={({ pressed }) => [
        styles.row,
        selected && styles.rowSelected,
        pressed && styles.rowPressed,
      ]}
    >
      <View style={styles.rowMain}>
        <AppText typeRole="labelSmall" tone="muted" style={styles.rowKode} numberOfLines={1}>
          {kode}
        </AppText>
        <AppText typeRole="bodyLarge" numberOfLines={1} style={styles.rowTitle}>
          {title}
        </AppText>
        {qtyMark ? (
          <AppText typeRole="numericMedium" tone="muted" style={styles.rowQty}>
            {qtyMark}
          </AppText>
        ) : null}
      </View>
      <StockBadge qty={stock} minimum={minimum} />
      <AppText typeRole="numericLarge" align="right" style={styles.rowPrice}>
        {formatRupiah(price)}
      </AppText>
    </Pressable>
  );
}

function SectionHeading({ children }: { children: string }) {
  return (
    <AppText typeRole="titleMedium" tone="primary" style={styles.section}>
      {children}
    </AppText>
  );
}

/**
 * Kasir — first surface built on Nota.
 *
 * A static composition of real shop content, not placeholder tiles: the flour
 * variants the owner actually sells, real prices, real stock states including
 * the three that matter most — low, never-counted, and negative.
 */
export default function KasirScreen() {
  const lines = [
    { name: 'Tepung terigu 1 kg', qty: 2, total: 27000 },
    { name: 'Gula pasir 1 kg', qty: 1, total: 16000 },
    { name: 'Minyak goreng 1 L', qty: 1, total: 18500 },
  ];

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
      <View style={styles.header}>
        <AppText typeRole="headlineSmall" tone="primary">
          KasirKu
        </AppText>
        <AppText typeRole="labelSmall" tone="muted">
          Kasir
        </AppText>
      </View>

      <ScrollView style={styles.list} contentContainerStyle={styles.listContent}>
        <View style={styles.search}>
          <AppText typeRole="bodyMedium" tone="muted">
            Cari nama atau kode…
          </AppText>
        </View>

        <SectionHeading>Sembako</SectionHeading>

        <AppText typeRole="labelSmall" tone="muted" style={styles.group}>
          Tepung
        </AppText>
        <VariantRow
          title="Tepung terigu 1 kg"
          kode="TLG-1"
          qtyMark="×2"
          price={27000}
          stock={24}
          minimum={5}
          selected
        />
        <VariantRow title="Tepung terigu 2 kg" kode="TLG-2" price={26000} stock={8} minimum={3} />
        <VariantRow title="Tepung sagu 1 kg" kode="TSG-1" price={11000} stock={2} minimum={5} />

        <SectionHeading>Minyak & Gula</SectionHeading>
        <VariantRow title="Minyak goreng 1 L" kode="MNY-1" price={18500} stock={11} />
        <VariantRow title="Gula pasir 1 kg" kode="GLA-1" price={16000} stock={null} />
        <VariantRow title="Beras premium 5 kg" kode="BR-5" price={72000} stock={-2} />
      </ScrollView>

      <View style={styles.cart}>
        <View style={styles.cartHead}>
          <AppText typeRole="labelSmall" tone="primary">
            Nota
          </AppText>
          <AppText typeRole="bodyMedium" tone="muted">
            {lines.length} barang
          </AppText>
        </View>

        {lines.map((line) => (
          <View key={line.name} style={styles.cartLine}>
            <AppText typeRole="bodyLarge" numberOfLines={1} style={styles.cartName}>
              {line.name}
            </AppText>
            <AppText typeRole="numericMedium" tone="muted" style={styles.cartQty}>
              {`×${formatQty(line.qty)}`}
            </AppText>
            <AppText typeRole="numericMedium" align="right" style={styles.cartAmount}>
              {formatRupiah(line.total)}
            </AppText>
          </View>
        ))}

        <TotalBlock amount={61500} style={styles.total} />

        <View style={styles.actions}>
          <Button label="Batalkan" variant="outlined" onPress={() => {}} style={styles.cancel} />
          <Button label="Bayar" onPress={() => {}} style={styles.pay} />
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.surface },
  header: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
    paddingBottom: space.md,
    minHeight: 56,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.primary,
  },
  list: { flex: 1 },
  listContent: { paddingBottom: space.lg },
  search: {
    marginHorizontal: space.gutter,
    marginTop: space.md,
    height: 44,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: 4,
  },
  headerTitle: { flexShrink: 1, paddingVertical: 2 },
  section: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xs },
  group: { paddingHorizontal: space.gutter, paddingBottom: space.xs },
  row: {
    height: 54,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    gap: space.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
    overflow: 'hidden',
  },
  rowSelected: { backgroundColor: colors.primaryContainer, paddingRight: space.md },
  rowPressed: { opacity: 0.9 },
  rowMain: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.xs },
  rowKode: { width: 46 },
  rowTitle: { flexShrink: 1 },
  rowQty: { width: 24, paddingLeft: space.sm, textAlign: 'right' },
  rowPrice: { width: 72 },
  cart: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1.5,
    borderTopColor: colors.primary,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
  },
  cartHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    marginBottom: space.xs,
  },
  cartLine: { flexDirection: 'row', alignItems: 'center', height: 32 },
  cartName: { flex: 1 },
  cartQty: { width: 40 },
  cartAmount: { width: 76 },
  total: { marginTop: space.sm },
  actions: { flexDirection: 'row', gap: space.sm, paddingBottom: space.lg },
  cancel: { width: 112 },
  pay: { flex: 1 },
});
