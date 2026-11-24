import { StyleSheet, TextInput, View, type ViewStyle } from 'react-native';
import { Icon } from './Icon';
import { colors, fontFamily, shape, space, typography } from '../tokens';

export interface SearchFieldProps {
  value: string;
  onChangeText: (text: string) => void;
  placeholder: string;
  accessibilityLabel?: string;
  testID?: string;
  /** A control that belongs with the search, e.g. Stok's `Repack`. */
  right?: React.ReactNode;
  style?: ViewStyle;
}

/**
 * The search field: a white card on the ground, the magnifier quiet at its
 * left. It is 48 dp because a thumb finds it without looking, and it carries no
 * border because the card is already the shape.
 */
export function SearchField({
  value,
  onChangeText,
  placeholder,
  accessibilityLabel,
  testID,
  right,
  style,
}: SearchFieldProps) {
  return (
    <View style={[styles.wrap, style]}>
      <View style={styles.field}>
        <Icon name="search" size={18} color={colors.onSurfaceVariant} />
        <TextInput
          testID={testID}
          accessibilityLabel={accessibilityLabel ?? placeholder}
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          placeholderTextColor={colors.onSurfaceVariant}
          returnKeyType="search"
          autoCorrect={false}
          style={styles.input}
        />
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  field: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    height: 48,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.md,
  },
  input: {
    flex: 1,
    height: '100%',
    paddingVertical: 0,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
  },
});
