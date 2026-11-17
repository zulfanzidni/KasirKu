import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/ledger/useLedger';
import { AppText, Note, colors, space } from '@/design';
import { TabBar, type TabItem } from '@/design/components/TabBar';
import { KasirScreen } from '@/screens/Kasir';
import { OrangScreen } from '@/screens/Orang';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { StokScreen } from '@/screens/Stok';

/**
 * The four destinations of DESIGN.md §Navigation. This ticket needs the till
 * and the place master data is created; the other two say what they are
 * waiting for rather than pretending to work.
 */
const TABS: readonly TabItem[] = [
  { key: 'kasir', label: 'Kasir', icon: 'point-of-sale' },
  { key: 'stok', label: 'Stok', icon: 'inventory-2' },
  { key: 'orang', label: 'Orang', icon: 'groups' },
  { key: 'lain', label: 'Lainnya', icon: 'more-horiz' },
];

export function Shell() {
  const [tab, setTab] = useState('kasir');
  const { error } = useApp();
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.root, { paddingBottom: insets.bottom }]}>
      <View style={styles.body}>
        {error ? (
          <View style={styles.center}>
            <Note>{`Catatan tidak bisa dibuka: ${error}`}</Note>
          </View>
        ) : null}
        {!error && tab === 'kasir' ? <KasirScreen /> : null}
        {!error && tab === 'stok' ? <StokScreen /> : null}
        {!error && tab === 'orang' ? <OrangScreen /> : null}
        {!error && tab === 'lain' ? (
          <View style={styles.lainScreen}>
            <View style={styles.lainHeader}>
              <AppText typeRole="headlineSmall" tone="primary">
                Lainnya
              </AppText>
              <AppText typeRole="labelSmall" tone="muted">
                Riwayat dan laporan menyusul
              </AppText>
            </View>
            <PengaturanScreen />
          </View>
        ) : null}
      </View>
      <TabBar tabs={TABS} active={tab} onChange={setTab} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  body: { flex: 1 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingHorizontal: space.gutter },
  lainScreen: { flex: 1 },
  lainHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.lg,
    paddingBottom: space.sm,
  },
});
