import { useState } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/ledger/useLedger';
import { AppText, Note, RuledRow, colors, layout, space } from '@/design';
import { NavRail } from '@/design/components/NavRail';
import { TabBar, type TabItem } from '@/design/components/TabBar';
import { KasScreen } from '@/screens/Kas';
import { KasirScreen } from '@/screens/Kasir';
import { LaporanScreen } from '@/screens/Laporan';
import { OrangScreen } from '@/screens/Orang';
import { PengaturanScreen } from '@/screens/Pengaturan';
import { RiwayatScreen } from '@/screens/Riwayat';
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
  const [lainView, setLainView] = useState<'menu' | 'kas' | 'riwayat' | 'laporan'>('menu');
  const { error } = useApp();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();

  /**
   * One navigation, two shapes. Landscape gives width and takes height, so the
   * bar becomes a rail; portrait does the opposite, so it stays a bar. The four
   * destinations and their words never change.
   */
  const wide = width >= layout.wide;

  return (
    <View
      style={[
        styles.root,
        { paddingBottom: insets.bottom, paddingLeft: insets.left, paddingRight: insets.right },
      ]}
    >
      <View style={styles.frame}>
        {wide ? <NavRail tabs={TABS} active={tab} onChange={setTab} /> : null}
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
            lainView === 'kas' ? (
              <KasScreen onBack={() => setLainView('menu')} />
            ) : lainView === 'riwayat' ? (
              <RiwayatScreen onBack={() => setLainView('menu')} />
            ) : lainView === 'laporan' ? (
              <LaporanScreen onBack={() => setLainView('menu')} />
            ) : (
              <View style={styles.lainScreen}>
                <View style={styles.lainHeader}>
                  <AppText typeRole="headlineSmall" tone="primary">
                    Lainnya
                  </AppText>
                  <AppText typeRole="labelSmall" tone="muted">
                    Kas, nota, dan cadangan
                  </AppText>
                </View>
                <RuledRow
                  title="Kas"
                  value="Kas & Tutup Toko"
                  onPress={() => setLainView('kas')}
                  testID="buka-kas"
                />
                <RuledRow
                  title="Riwayat"
                  value="Nota & pembatalan"
                  onPress={() => setLainView('riwayat')}
                  testID="buka-riwayat"
                />
                <RuledRow
                  title="Laporan"
                  value="Penjualan & peringkat"
                  onPress={() => setLainView('laporan')}
                  testID="buka-laporan"
                />
                <PengaturanScreen />
              </View>
            )
          ) : null}
        </View>
      </View>
      {wide ? null : <TabBar tabs={TABS} active={tab} onChange={setTab} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surface },
  frame: { flex: 1, flexDirection: 'row' },
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
