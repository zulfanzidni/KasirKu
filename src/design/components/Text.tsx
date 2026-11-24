import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { space } from '../tokens';

/**
 * A section's name above its cards: caps, tracked, quiet. It is a label, not a
 * heading — the figures inside the cards are what the eye should land on.
 */
export function SectionHeading({ children, right, flush = false }: { children: string; right?: ReactNode; flush?: boolean }) {
  return (
    <View style={[styles.row, flush && styles.flush]}>
      <AppText typeRole="labelSmall" tone="muted" style={styles.section}>
        {children}
      </AppText>
      {right}
    </View>
  );
}

/** One quiet line under a card or a list: how a figure was read, or what to do. */
export function Note({ children, flush = false, testID }: { children: string; flush?: boolean; testID?: string }) {
  return (
    <AppText testID={testID} typeRole="bodySmall" tone="muted" style={[styles.note, flush && styles.flush]}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.gutter,
    paddingTop: space.xl,
    paddingBottom: space.sm,
    gap: space.sm,
  },
  section: { flexShrink: 1 },
  flush: { paddingHorizontal: 0 },
  note: { paddingHorizontal: space.gutter, paddingVertical: space.md },
});
