import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { colors, shape, space } from '../tokens';

type Variant = 'filled' | 'outlined' | 'text' | 'destructive';
type Size = 'large' | 'medium' | 'small';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  size?: Size;
  /** A leading glyph, e.g. the `+` on `+ Baru`. */
  icon?: IconName;
  disabled?: boolean;
  /** Stretch to the container width. Default true — till buttons are wide. */
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * The one button family in the world.
 *
 * Blue is the only action colour: a filled button is blue on white, a secondary
 * one is a white card with a hairline, and red only where the action destroys
 * something. The disabled state is not a fade — it drops to the disabled fill,
 * because a faded ink button still reads as tappable across a counter.
 *
 * The fill is its own view, not the Pressable's background. Android replaces a
 * Pressable's background with a RippleDrawable when `android_ripple` is set,
 * and a later colour change on that view does not repaint — which is how a
 * button mounted disabled could stay grey after it was enabled. The fill here
 * never carries a ripple, so changing it is an ordinary paint.
 */
export function Button({
  label,
  onPress,
  variant = 'filled',
  size = 'large',
  icon,
  disabled = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const v = variantStyles[variant][disabled ? 'disabled' : 'enabled'];
  const height = size === 'large' ? 52 : size === 'medium' ? 44 : 34;
  const radius = size === 'small' ? shape.sm : shape.md;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.base,
        { height, minHeight: height, borderRadius: radius },
        fullWidth && styles.fullWidth,
        style,
      ]}
    >
      {({ pressed }) => (
        <View
          testID={testID ? `${testID}-fill` : undefined}
          style={[
            styles.fill,
            { borderRadius: radius },
            size === 'small' && styles.small,
            v.container,
            pressed && !disabled && variant !== 'filled' && styles.pressed,
          ]}
        >
          {pressed && !disabled && variant === 'filled' ? <View style={styles.wash} /> : null}
          {icon ? <Icon name={icon} size={size === 'small' ? 16 : 20} color={v.iconColor} /> : null}
          <AppText typeRole={size === 'small' ? 'labelMedium' : 'labelLarge'} style={v.text}>
            {label}
          </AppText>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { overflow: 'hidden' },
  fill: {
    flex: 1,
    alignSelf: 'stretch',
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  small: { paddingHorizontal: space.md },
  fullWidth: { alignSelf: 'stretch' },
  /** The wash on a filled button: a pale tint over the blue, never a second fill. */
  wash: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.primaryContainer, opacity: 0.12 },
  pressed: { opacity: 0.85 },
});

const variantStyles = {
  filled: {
    enabled: {
      container: { backgroundColor: colors.primary },
      text: { color: colors.onPrimary },
      iconColor: colors.onPrimary,
    },
    disabled: {
      container: { backgroundColor: colors.disabled },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
    },
  },
  outlined: {
    enabled: {
      container: { borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.onSurface },
      iconColor: colors.onSurface,
    },
    disabled: {
      container: { borderWidth: 1, borderColor: colors.disabled, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
    },
  },
  text: {
    enabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.primary },
      iconColor: colors.primary,
    },
    disabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
    },
  },
  destructive: {
    enabled: {
      container: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.error },
      text: { color: colors.error },
      iconColor: colors.error,
    },
    disabled: {
      container: { borderWidth: 1, borderColor: colors.disabled, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
    },
  },
} as const;
