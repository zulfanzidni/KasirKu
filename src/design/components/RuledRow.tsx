import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { colors, space } from '../tokens';

export interface RuledRowProps {
  /** The primary label — an item name, a category name. */
  title: string;
  /** Small tracked prefix: the kode. */
  kode?: string;
  /** Right-hand value, already formatted. */
  value?: string;
  /** Right-hand value is money-owed or negative — the only place red appears. */
  owed?: boolean;
  /** A category heading rather than a sellable row. */
  heading?: boolean;
  /** Selected: wash the row in ink container. */
  selected?: boolean;
  onPress?: () => void;
  /** Quantity mark shown after the title, e.g. "×2". */
  qtyMark?: string;
  testID?: string;
}

/**
 * One ruled line of the nota.
 *
 * The hairline is horizontal only — a left accent bar would be a card border in
 * disguise, and DESIGN.md forbids it. The rule runs edge to edge past the
 * gutter so the page reads as paper.
 */
export function RuledRow({
  title,
  kode,
  value,
  owed = false,
  heading = false,
  selected = false,
  onPress,
  qtyMark,
  testID,
}: RuledRowProps) {
  const content = (
    <View
      style={[
        styles.row,
        heading && styles.headingRow,
        selected && styles.selectedRow,
      ]}
    >
      <View style={styles.left}>
        {kode ? (
          <AppText typeRole="labelSmall" tone="muted" style={styles.kode}>
            {kode}
          </AppText>
        ) : null}
        <AppText
          typeRole={heading ? 'titleMedium' : 'bodyLarge'}
          tone={heading ? 'primary' : 'default'}
          numberOfLines={1}
          style={styles.title}
        >
          {title}
        </AppText>
        {qtyMark ? (
          <AppText typeRole="numericMedium" tone="muted" style={styles.qty}>
            {qtyMark}
          </AppText>
        ) : null}
      </View>
      {value !== undefined ? (
        <AppText typeRole="numericLarge" tone={owed ? 'owed' : 'default'} align="right">
          {value}
        </AppText>
      ) : null}
    </View>
  );

  if (!onPress) return <View testID={testID}>{content}</View>;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={qtyMark ? `${title}, ${qtyMark}` : title}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={styles.pressable}
    >
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  pressable: { overflow: 'hidden' },
  row: {
    height: space.row,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.gutter,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.outline,
  },
  headingRow: {
    height: 34,
    borderBottomWidth: 0,
    paddingTop: space.sm,
  },
  selectedRow: { backgroundColor: colors.primaryContainer },
  left: { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: space.sm },
  kode: { minWidth: 46 },
  title: { flexShrink: 1 },
  qty: { marginLeft: space.xs },
});
