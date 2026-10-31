import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from './AppText';
import { HeaderAction } from './Icons';
import { colors, space } from '../tokens';

export interface ScreenProps {
  title: string;
  /** A caps word under the title: which screen this is. */
  overline?: string;
  /** Actions pinned to the right of the header, e.g. the add button. */
  actions?: ReactNode;
  /** A ruled area pinned to the bottom, above the system inset. */
  footer?: ReactNode;
  children: ReactNode;
}

/**
 * The paper sheet: a header with the screen's title in pen and a rule beneath,
 * the 20 dp gutter DESIGN.md fixes, and nothing else. Screens compose it
 * rather than re-declaring a background or an inset.
 */
export function Screen({ title, overline, actions, footer, children }: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <AppText typeRole="headlineSmall" tone="primary" numberOfLines={1}>
            {title}
          </AppText>
          {overline ? (
            <AppText typeRole="labelSmall" tone="muted">
              {overline}
            </AppText>
          ) : null}
        </View>
        {actions ? <HeaderAction>{actions}</HeaderAction> : null}
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
  headerText: { flex: 1 },
  body: { flex: 1 },
  footer: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: 1.5,
    borderTopColor: colors.primary,
    paddingHorizontal: space.gutter,
    paddingTop: space.md,
  },
});
