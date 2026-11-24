import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useApp } from '@/ledger/useLedger';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { formatDay } from '../dates';
import { colors, space } from '../tokens';

export interface AppHeaderProps {
  /** Which part of the shop this screen belongs to: `Kasir`, `Stok`, `Orang`… */
  role: string;
  /** Replaces the shop's mark, e.g. a back control on a nested screen. */
  leading?: ReactNode;
  /** The shop's mark; its initial by default. */
  mark?: string;
  /** Hide the alert bell (a sheet or a sub-screen that has no header of its own). */
  bare?: boolean;
  testID?: string;
}

/**
 * The shop's own bar, above every screen's title.
 *
 * It says who is selling and which day it is — the two facts the owner checks
 * without meaning to — and carries the alert bell at the far right. It is not a
 * toolbar: there is no screen name here, because the title below says it in
 * larger type.
 */
export function AppHeader({ role, leading, mark, bare = false, testID }: AppHeaderProps) {
  const { shop } = useApp();
  const nama = shop.receipt.header.nama;
  const initial = (mark ?? nama).trim().charAt(0).toUpperCase() || 'K';

  return (
    <View style={styles.bar} testID={testID}>
      {leading ?? (
        <View style={styles.mark}>
          <AppText typeRole="titleLarge" tone="primary">
            {initial}
          </AppText>
        </View>
      )}

      <View style={styles.who}>
        <AppText typeRole="titleLarge" numberOfLines={1} testID="nama-toko">
          {nama}
        </AppText>
        <AppText typeRole="bodySmall" tone="muted" numberOfLines={1}>
          {`${role} · ${formatDay()}`}
        </AppText>
      </View>

      {bare ? null : (
        <View style={styles.bell} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Icon name="bell" size={20} color={colors.onSurfaceVariant} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.sm,
    minHeight: 56,
  },
  mark: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.primaryContainer,
    alignItems: 'center',
    justifyContent: 'center',
  },
  who: { flex: 1, gap: 1 },
  bell: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
});
