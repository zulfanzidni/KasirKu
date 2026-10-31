import { StyleSheet, Text, type TextProps } from 'react-native';
import { colors, typography, type TypeRole } from '../tokens';

type Tone = 'default' | 'primary' | 'muted' | 'owed' | 'onPrimary';

const toneColor: Record<Tone, string> = {
  default: colors.onSurface,
  primary: colors.primary,
  muted: colors.onSurfaceVariant,
  owed: colors.error,
  onPrimary: colors.onPrimary,
};

/**
 * `typeRole` rather than `role`: React Native's Text already has a `role` prop
 * for accessibility, and shadowing it would silently break screen readers.
 */
export interface AppTextProps extends TextProps {
  /** Material type role. Never a raw size. */
  typeRole?: TypeRole;
  tone?: Tone;
  /** Optical alignment for columns of money. Implies tabular numerals. */
  align?: 'left' | 'right' | 'center';
}

/**
 * The only text primitive in the app.
 *
 * Every role comes from the type scale, so a screen cannot invent a size. The
 * `align` prop exists because a right-aligned money column is the most common
 * layout in a till, and it always implies tabular numerals.
 */
export function AppText({
  typeRole = 'bodyLarge',
  tone = 'default',
  align,
  style,
  ...rest
}: AppTextProps) {
  return (
    <Text
      {...rest}
      style={[
        typography[typeRole],
        { color: toneColor[tone] },
        align === 'right' && styles.right,
        align === 'center' && styles.center,
        style,
      ]}
    />
  );
}

const styles = StyleSheet.create({
  right: { textAlign: 'right' },
  center: { textAlign: 'center' },
});