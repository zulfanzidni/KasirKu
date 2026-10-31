import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, shape, space } from '../tokens';

export interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  testID?: string;
}

/**
 * A one-of-N choice, for a satuan or how an item is sold. Selected reads as
 * the ink wash, not as a second colour.
 */
export function Chip({ label, selected = false, onPress, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={label}
      onPress={onPress}
      android_ripple={{ color: colors.primaryContainer }}
      style={[styles.chip, selected && styles.selected]}
    >
      <AppText typeRole="labelLarge" tone={selected ? 'primary' : 'default'}>
        {label}
      </AppText>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingBottom: space.md },
  chip: {
    minHeight: space.touch,
    minWidth: space.touch,
    paddingHorizontal: space.md,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: shape.sm,
    backgroundColor: colors.surfaceContainerLowest,
  },
  selected: { backgroundColor: colors.primaryContainer, borderColor: colors.primary },
});
