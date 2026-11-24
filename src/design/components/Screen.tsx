import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { AppHeader } from './AppHeader';
import { BackButton } from './Icons';
import { colors, space } from '../tokens';

export interface ScreenProps {
  title: string;
  /** One quiet line under the title: what this screen holds, or how much. */
  subtitle?: string;
  /** @deprecated The old name for `subtitle`; still honoured while screens move. */
  overline?: string;
  /** Which part of the shop the header names. */
  role?: string;
  /** Actions pinned to the right of the title, e.g. `+ Baru`. */
  actions?: ReactNode;
  /** A control pinned to the bottom, on the ground rather than in a white bar. */
  footer?: ReactNode;
  /** A nested screen: the header's mark becomes a back control. */
  onBack?: () => void;
  /** Hide the shop bar, e.g. a full-screen receipt. */
  bare?: boolean;
  children: ReactNode;
}

/**
 * The frame every screen composes: the shop's bar, the screen's own title, the
 * 20 dp gutter DESIGN.md fixes, and the ground showing between the cards.
 *
 * There is no rule under the header. Elevation and type size do the separating,
 * which is what makes the screens read as sheets on a counter rather than a
 * ruled ledger.
 */
export function Screen({
  title,
  subtitle,
  overline,
  role = 'Lainnya',
  actions,
  footer,
  onBack,
  bare = false,
  children,
}: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      {bare ? null : <AppHeader role={role} leading={onBack ? <BackButton onPress={onBack} /> : undefined} />}

      <View style={styles.titleRow}>
        <View style={styles.titleText}>
          <AppText typeRole="headlineSmall" numberOfLines={1}>
            {title}
          </AppText>
          {subtitle || overline ? (
            <AppText typeRole="bodyMedium" tone="muted" numberOfLines={2}>
              {subtitle ?? overline}
            </AppText>
          ) : null}
        </View>
        {actions ? <View style={styles.actions}>{actions}</View> : null}
      </View>

      <View style={styles.body}>{children}</View>

      {footer ? (
        <View style={[styles.footer, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{footer}</View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.surface },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    gap: space.sm,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    paddingBottom: space.md,
  },
  titleText: { flex: 1, gap: 2 },
  actions: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { flex: 1 },
  footer: { paddingHorizontal: space.gutter, paddingTop: space.md },
});
