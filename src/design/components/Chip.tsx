import type { ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, shape, space } from '../tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * A one-of-N choice: the filters above a list, or a satuan in a form.
 *
 * Chosen is blue and white; the rest are white cards with a hairline. The pill
 * is 32 dp tall, as the design draws it, with a 48 dp touch target around it
 * (hit slop) so the floor is kept without fattening the row.
 */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={{ top: 8, bottom: 8 }}
      android_ripple={{ color: colors.primaryContainer, borderless: true }}
      style={[styles.chip, selected ? styles.selected : styles.rest]}
    >
      <AppText typeRole="labelMedium" tone={selected ? 'onPrimary' : 'muted'}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** A chip row that wraps, for a form inside a sheet. */
export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

/** A chip row that scrolls sideways, for the filters above a list. */
export function ChipScroller({ children }: { children: ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.scroller}
      style={styles.scrollerWrap}
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md },
  scrollerWrap: { flexGrow: 0 },
  scroller: { flexDirection: 'row', gap: space.sm, paddingHorizontal: space.gutter },
  chip: {
    minHeight: 32,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderRadius: shape.full,
    borderWidth: 1,
  },
  rest: { backgroundColor: colors.surfaceContainerLowest, borderColor: colors.outline },
  selected: { backgroundColor: colors.primary, borderColor: colors.primary },
});
