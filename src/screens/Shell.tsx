import { useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useApp } from '@/ledger/useLedger';
import {
  AppText,
  Card,
  CardRow,
  Icon,
  Note,
  RowAvatar,
  Screen,
  colors,
  space,
  useFrame,
} from '@/design';
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
  { key: 'kasir', label: 'Kasir', icon: 'cart' },
  { key: 'stok', label: 'Stok', icon: 'box' },
  { key: 'orang', label: 'Orang', icon: 'people' },
  { key: 'lain', label: 'Lainnya', icon: 'moreSquare' },
];

export function Shell() {
  const [tab, setTab] = useState('kasir');
  const [lainView, setLainView] = useState<'menu' | 'kas' | 'riwayat' | 'laporan' | 'pengaturan'>('menu');
  const { error } = useApp();
  const insets = useSafeAreaInsets();
  const { wide } = useFrame();

  /**
   * One navigation, two shapes. Landscape gives width and takes height, so the
   * bar becomes a rail; portrait does the opposite, so it stays a bar. The four
   * destinations and their words never change.
   */

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
            ) : lainView === 'pengaturan' ? (
              <PengaturanScreen onBack={() => setLainView('menu')} />
            ) : (
              <Screen title="Lainnya" role="Lainnya" subtitle="Kas, nota, dan cadangan">
                <ScrollView contentContainerStyle={styles.lainContent}>
                  <Card>
                    <CardRow onPress={() => setLainView('kas')} testID="buka-kas" accessibilityLabel="Kas">
                      <RowAvatar tone="action">
                        <Icon name="wallet" size={20} color={colors.primary} />
                      </RowAvatar>
                      <View style={styles.rowText}>
                        <AppText typeRole="titleSmall">Kas</AppText>
                        <AppText typeRole="bodySmall" tone="muted">
                          Kas & Tutup Toko
                        </AppText>
                      </View>
                      <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
                    </CardRow>
                    <CardRow
                      divided
                      onPress={() => setLainView('riwayat')}
                      testID="buka-riwayat"
                      accessibilityLabel="Riwayat"
                    >
                      <RowAvatar tone="action">
                        <Icon name="receipt" size={20} color={colors.primary} />
                      </RowAvatar>
                      <View style={styles.rowText}>
                        <AppText typeRole="titleSmall">Riwayat</AppText>
                        <AppText typeRole="bodySmall" tone="muted">
                          Nota & pembatalan
                        </AppText>
                      </View>
                      <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
                    </CardRow>
                    <CardRow
                      divided
                      onPress={() => setLainView('laporan')}
                      testID="buka-laporan"
                      accessibilityLabel="Laporan"
                    >
                      <RowAvatar tone="action">
                        <Icon name="chart" size={20} color={colors.primary} />
                      </RowAvatar>
                      <View style={styles.rowText}>
                        <AppText typeRole="titleSmall">Laporan</AppText>
                        <AppText typeRole="bodySmall" tone="muted">
                          Penjualan & peringkat
                        </AppText>
                      </View>
                      <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
                    </CardRow>
                    <CardRow
                      divided
                      onPress={() => setLainView('pengaturan')}
                      testID="buka-pengaturan"
                      accessibilityLabel="Pengaturan"
                    >
                      <RowAvatar tone="action">
                        <Icon name="filter" size={20} color={colors.primary} />
                      </RowAvatar>
                      <View style={styles.rowText}>
                        <AppText typeRole="titleSmall">Pengaturan</AppText>
                        <AppText typeRole="bodySmall" tone="muted">
                          Toko, struk, cadangan
                        </AppText>
                      </View>
                      <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
                    </CardRow>
                  </Card>
                </ScrollView>
              </Screen>
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
  lainContent: { paddingBottom: space.xxl },
  rowText: { flex: 1, gap: 1 },
});
