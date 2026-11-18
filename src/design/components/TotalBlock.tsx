import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { formatRupiah } from '../money';
import { colors, shape, space } from '../tokens';

export interface TotalBlockProps {
  /** Integer rupiah. */
  amount: number;
  /** The word beside the number. Default "Total". */
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The signature move of the whole design: the total in its window.
 *
 * A dark block, the word in small caps at its left, the amount in tabular
 * figures at its right — the till's own display reading back at you. It appears
 * on Kasir, on the receipt, and at the close of Tutup Toko, and nothing else in
 * the app is ever this large, which is what makes it read as *the* number
 * rather than *a* number.
 */
export function TotalBlock({ amount, label = 'Total', style, testID }: TotalBlockProps) {
  return (
    <View testID={testID} style={[styles.block, style]}>
      <AppText typeRole="labelSmall" tone="onPrimaryMuted">
        {label}
      </AppText>
      <AppText
        typeRole="displayLarge"
        tone="onPrimary"
        align="right"
        accessibilityLabel={`Total ${amount}`}
      >
        {formatRupiah(amount)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    gap: space.sm,
    backgroundColor: colors.primary,
    borderRadius: shape.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
