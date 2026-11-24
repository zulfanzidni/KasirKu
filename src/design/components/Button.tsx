import { Platform, Pressable, StyleSheet, type ViewStyle } from 'react-native';
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

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      android_ripple={disabled ? undefined : { color: v.ripple, borderless: false }}
      style={({ pressed }) => [
        styles.base,
        { height, minHeight: height },
        size === 'small' && styles.small,
        fullWidth && styles.fullWidth,
        v.container,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      {icon ? <Icon name={icon} size={size === 'small' ? 16 : 20} color={v.iconColor} /> : null}
      <AppText typeRole={size === 'small' ? 'labelMedium' : 'labelLarge'} style={v.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    flexDirection: 'row',
    gap: space.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: shape.md,
    paddingHorizontal: space.lg,
    overflow: 'hidden',
  },
  small: { borderRadius: shape.sm, paddingHorizontal: space.md },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: Platform.OS === 'android' ? 1 : 0.85 },
});

const variantStyles = {
  filled: {
    enabled: {
      container: { backgroundColor: colors.primary },
      text: { color: colors.onPrimary },
      iconColor: colors.onPrimary,
      ripple: colors.onPrimary,
    },
    disabled: {
      container: { backgroundColor: colors.disabled },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
      ripple: 'transparent',
    },
  },
  outlined: {
    enabled: {
      container: { borderWidth: 1, borderColor: colors.outline, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.onSurface },
      iconColor: colors.onSurface,
      ripple: colors.primaryContainer,
    },
    disabled: {
      container: { borderWidth: 1, borderColor: colors.disabled, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
      ripple: 'transparent',
    },
  },
  text: {
    enabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.primary },
      iconColor: colors.primary,
      ripple: colors.primaryContainer,
    },
    disabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
      ripple: 'transparent',
    },
  },
  destructive: {
    enabled: {
      container: { backgroundColor: colors.surfaceContainerLowest, borderWidth: 1, borderColor: colors.error },
      text: { color: colors.error },
      iconColor: colors.error,
      ripple: colors.errorContainer,
    },
    disabled: {
      container: { borderWidth: 1, borderColor: colors.disabled, backgroundColor: colors.surfaceContainerLowest },
      text: { color: colors.disabledContent },
      iconColor: colors.disabledContent,
      ripple: 'transparent',
    },
  },
} as const;
