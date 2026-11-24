import { useState } from 'react';
import { ScrollView, StyleSheet, View as RNView } from 'react-native';
import { AppText, Card, CardRow, Icon, Note, RowAvatar, Screen, colors, space } from '@/design';
import { PelangganScreen } from '@/screens/Pelanggan';
import { PemasokScreen } from '@/screens/Pemasok';

/**
 * Orang — the two people the shop keeps books with: the suppliers it owes and
 * the customers who owe it. They are separate ledgers and separate screens;
 * this is only the door between them.
 */

type View = 'menu' | 'pemasok' | 'pelanggan';

export function OrangScreen() {
  const [view, setView] = useState<View>('menu');

  if (view === 'pemasok') return <PemasokScreen onBack={() => setView('menu')} />;
  if (view === 'pelanggan') return <PelangganScreen onBack={() => setView('menu')} />;

  return (
    <Screen title="Orang" role="Orang" subtitle="Pemasok dan pelanggan">
      <ScrollView contentContainerStyle={styles.content}>
        <Note flush>Pilih buku yang mau dibuka.</Note>
        <Card>
          <CardRow onPress={() => setView('pemasok')} testID="buka-pemasok" accessibilityLabel="Pemasok">
            <RowAvatar size={40} tone="action">
              <Icon name="box" size={20} color={colors.primary} />
            </RowAvatar>
            <RNView style={styles.rowText}>
              <AppText typeRole="titleSmall">Pemasok</AppText>
              <AppText typeRole="bodySmall" tone="muted">
                Utang dan titip
              </AppText>
            </RNView>
            <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
          </CardRow>
          <CardRow
            divided
            onPress={() => setView('pelanggan')}
            testID="buka-pelanggan"
            accessibilityLabel="Pelanggan"
          >
            <RowAvatar size={40} tone="action">
              <Icon name="people" size={20} color={colors.primary} />
            </RowAvatar>
            <RNView style={styles.rowText}>
              <AppText typeRole="titleSmall">Pelanggan</AppText>
              <AppText typeRole="bodySmall" tone="muted">
                Hutang
              </AppText>
            </RNView>
            <Icon name="arrowRight" size={18} color={colors.onSurfaceVariant} />
          </CardRow>
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: space.gutter, paddingBottom: space.lg },
  rowText: { flex: 1, gap: 1 },
});
