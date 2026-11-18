import { Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { AppText } from './AppText';
import { borderWidth, colors, shape, space } from '../tokens';

type Variant = 'filled' | 'outlined' | 'text' | 'destructive';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: Variant;
  disabled?: boolean;
  /** Stretch to the container width. Default true — till buttons are wide. */
  fullWidth?: boolean;
  style?: ViewStyle;
  testID?: string;
}

/**
 * Material 3 buttons, themed by Jendela kasir.
 *
 * The disabled state is not a fade: it drops to the `disabled` fill, because a
 * faded ink button still reads as tappable across a counter. That matters most
 * on Kasir's Bayar, which must look inert the instant it is pressed.
 */
export function Button({
  label,
  onPress,
  variant = 'filled',
  disabled = false,
  fullWidth = true,
  style,
  testID,
}: ButtonProps) {
  const v = variantStyles[variant][disabled ? 'disabled' : 'enabled'];

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
        fullWidth && styles.fullWidth,
        v.container,
        pressed && !disabled && styles.pressed,
        style,
      ]}
    >
      <AppText typeRole="labelLarge" style={v.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** The double rule above a total — the accountant's line under a written sum. */
export function TotalRule({ width = borderWidth.rule }: { width?: number }) {
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no"
      style={[styles.doubleRule, { borderTopWidth: width }]}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    height: space.touch,
    minHeight: space.touch,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: shape.md,
    overflow: 'hidden',
  },
  fullWidth: { alignSelf: 'stretch' },
  pressed: { opacity: Platform.OS === 'android' ? 1 : 0.85 },
  doubleRule: {
    borderTopColor: colors.primary,
    borderBottomWidth: 1,
    borderBottomColor: colors.primary,
    paddingTop: 2,
    marginBottom: space.sm,
  },
});

const variantStyles = {
  filled: {
    enabled: {
      container: { backgroundColor: colors.primary },
      text: { color: colors.onPrimary },
      ripple: colors.onPrimary,
    },
    disabled: {
      container: { backgroundColor: colors.disabled },
      text: { color: colors.disabledContent },
      ripple: 'transparent',
    },
  },
  outlined: {
    enabled: {
      container: { borderWidth: 1.5, borderColor: colors.outline, backgroundColor: 'transparent' },
      text: { color: colors.onSurface },
      ripple: colors.primaryContainer,
    },
    disabled: {
      container: { borderWidth: 1.5, borderColor: colors.disabled, backgroundColor: 'transparent' },
      text: { color: colors.disabledContent },
      ripple: 'transparent',
    },
  },
  text: {
    enabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.primary },
      ripple: colors.primaryContainer,
    },
    disabled: {
      container: { backgroundColor: 'transparent' },
      text: { color: colors.disabledContent },
      ripple: 'transparent',
    },
  },
  destructive: {
    enabled: {
      container: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.error },
      text: { color: colors.error },
      ripple: 'rgba(168,35,31,0.12)',
    },
    disabled: {
      container: { borderWidth: 1.5, borderColor: colors.disabled, backgroundColor: 'transparent' },
      text: { color: colors.disabledContent },
      ripple: 'transparent',
    },
  },
} as const;
