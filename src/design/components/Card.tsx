import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { colors, elevation, shape, space } from '../tokens';

/**
 * The world's one surface: a white card floating on the cool ground.
 *
 * Separation is elevation, not rules. A card inside a card is forbidden
 * (DESIGN.md Anti-patterns), which is why `CardRow` never draws its own
 * shadow — it lives on the card it belongs to.
 */
export function Card({
  children,
  style,
  padded = false,
  testID,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  /** 16 dp all round. Off when the card's own rows own their inset. */
  padded?: boolean;
  testID?: string;
}) {
  return (
    <View testID={testID} style={[styles.card, padded && styles.padded, style]}>
      {children}
    </View>
  );
}

/** A column of cards, 8 dp apart. Lists in this app are stacks, not tables. */
export function CardStack({
  children,
  style,
  gap = space.sm,
}: {
  children: ReactNode;
  style?: StyleProp<ViewStyle>;
  gap?: number;
}) {
  return <View style={[{ gap }, style]}>{children}</View>;
}

/** One row on a card. Pressable when the row goes somewhere. */
export function CardRow({
  children,
  onPress,
  testID,
  accessibilityLabel,
  divided = false,
  minHeight = 64,
  style,
}: {
  children: ReactNode;
  onPress?: () => void;
  testID?: string;
  accessibilityLabel?: string;
  /** A hairline above the row, for the second and later rows of one card. */
  divided?: boolean;
  minHeight?: number;
  style?: StyleProp<ViewStyle>;
}) {
  const content = (
    <View style={[styles.row, { minHeight }, divided && styles.divided, style]}>{children}</View>
  );

  if (!onPress) {
    return <View testID={testID}>{content}</View>;
  }

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      android_ripple={{ color: colors.primaryContainer }}
      onPress={onPress}
      style={styles.pressable}
    >
      {content}
    </Pressable>
  );
}

/** The square or circle a row leads with: a letter, an icon, a picture well. */
export function RowAvatar({
  children,
  tone = 'action',
  size = 40,
  rounded = true,
}: {
  children?: ReactNode;
  tone?: 'action' | 'muted' | 'owed' | 'positive';
  size?: number;
  rounded?: boolean;
}) {
  const background =
    tone === 'owed'
      ? colors.errorContainer
      : tone === 'positive'
        ? colors.positiveContainer
        : tone === 'muted'
          ? colors.surface
          : colors.primaryContainer;

  return (
    <View
      style={[
        styles.avatar,
        { width: size, height: size, borderRadius: rounded ? size / 2 : shape.sm, backgroundColor: background },
      ]}
    >
      {children}
    </View>
  );
}

/**
 * A figure that leads a card: a caps label, the number, and one line that says
 * what the number is. `tone` carries the meaning red and teal are reserved for.
 */
export function MetricCard({
  label,
  value,
  note,
  tone = 'default',
  style,
  testID,
}: {
  label: string;
  value: string;
  note?: string;
  tone?: 'default' | 'owed' | 'positive' | 'primary';
  style?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const color =
    tone === 'owed' ? colors.error : tone === 'positive' ? colors.positive : tone === 'primary' ? colors.primary : colors.onSurface;

  return (
    <Card padded testID={testID} style={[styles.metric, style]}>
      <AppText typeRole="labelSmall" tone="muted" style={styles.metricLabel}>
        {label}
      </AppText>
      <AppText typeRole="headlineMedium" style={{ color }}>
        {value}
      </AppText>
      {note ? (
        <AppText typeRole="bodySmall" tone="muted" style={styles.metricNote}>
          {note}
        </AppText>
      ) : null}
    </Card>
  );
}

/**
 * A word that says what state a figure is in: `Tempo`, `Tunai`, `Titip`,
 * `Lunas`, `Batal`. It is a wash with the word on it — colour is never the only
 * signal, and a pill never replaces the number it describes.
 */
export function StatusPill({
  label,
  tone = 'neutral',
  testID,
}: {
  label: string;
  tone?: 'neutral' | 'owed' | 'positive' | 'primary';
  testID?: string;
}) {
  const background =
    tone === 'owed'
      ? colors.errorContainer
      : tone === 'positive'
        ? colors.positiveContainer
        : tone === 'primary'
          ? colors.primaryContainer
          : colors.surface;
  const color =
    tone === 'owed'
      ? colors.error
      : tone === 'positive'
        ? colors.positive
        : tone === 'primary'
          ? colors.primary
          : colors.onSurfaceVariant;

  return (
    <View testID={testID} style={[styles.pill, { backgroundColor: background }]}>
      <AppText typeRole="tabLabel" style={{ color }}>
        {label}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.lg,
    ...elevation.raised,
  },
  padded: { padding: space.lg },
  pressable: { overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  divided: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.outline },
  avatar: { alignItems: 'center', justifyContent: 'center' },
  metric: { gap: space.xs },
  metricLabel: { letterSpacing: 0.9 },
  metricNote: { marginTop: space.xs },
  pill: { alignSelf: 'flex-start', borderRadius: shape.full, paddingHorizontal: space.sm, paddingVertical: 1 },
});
