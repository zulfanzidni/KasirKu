import { StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { formatRupiah } from '../money';
import { colors, space } from '../tokens';

export interface TotalBlockProps {
  /** Integer rupiah. */
  amount: number;
  /** The word above the number. Default "Total". */
  label?: string;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The signature move of the whole design: the accountant's double rule, the
 * word, and the amount set in pen at a size readable across the counter.
 *
 * This construction appears on Kasir, on the receipt, and at the close of
 * Tutup Toko. Nothing else in the app is ever this large, which is what makes
 * it read as *the* number rather than *a* number.
 */
export function TotalBlock({ amount, label = 'Total', style, testID }: TotalBlockProps) {
  return (
    <View testID={testID} style={style}>
      <View style={styles.doubleRule}>
        <View style={styles.ruleTop} />
        <View style={styles.ruleGap} />
        <View style={styles.ruleBottom} />
      </View>
      <View style={styles.row}>
        <AppText typeRole="labelSmall" tone="primary">
          {label}
        </AppText>
        <AppText
          typeRole="displayLarge"
          tone="primary"
          align="right"
          style={styles.amount}
          accessibilityLabel={`Total ${amount}`}
        >
          {formatRupiah(amount)}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  doubleRule: { marginBottom: space.sm },
  ruleTop: { height: 2, backgroundColor: colors.primary },
  ruleGap: { height: 2 },
  ruleBottom: { height: 1, backgroundColor: colors.primary },
  amount: { lineHeight: 48 },
  row: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingBottom: space.xs,
  },
});
