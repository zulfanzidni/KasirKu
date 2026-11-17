import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { Note, RuledRow, Screen, space } from '@/design';
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
    <Screen title="Orang" overline="Pemasok dan pelanggan">
      <ScrollView contentContainerStyle={styles.content}>
        <Note>Pilih buku yang mau dibuka.</Note>
        <RuledRow title="Pemasok" value="Utang dan titip" onPress={() => setView('pemasok')} testID="buka-pemasok" />
        <RuledRow title="Pelanggan" value="Hutang" onPress={() => setView('pelanggan')} testID="buka-pelanggan" />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: space.lg },
});
