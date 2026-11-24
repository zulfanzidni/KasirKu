import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Icon, type IconName } from './Icon';
import { colors, elevation, shape, space } from '../tokens';

/**
 * Names the screens used before the Vuesax port. Kept so a screen that has not
 * been re-cut yet still draws a correct icon; new work passes an `IconName`.
 */
const legacy: Record<string, IconName> = {
  'arrow-back': 'arrowLeft',
  'add': 'add',
  'add-circle-outline': 'addCircle',
  'close': 'close',
  'delete-outline': 'trash',
  'edit': 'edit',
  'history': 'clock',
  'remove': 'minus',
  'tune': 'filter',
  'upload-file': 'importIcon',
  'inventory-2': 'box',
  'keyboard-arrow-up': 'arrowUp',
  'keyboard-arrow-down': 'arrowDown',
  'point-of-sale': 'cart',
  'groups': 'people',
  'more-horiz': 'moreSquare',
};

function resolve(name: IconName | keyof typeof legacy): IconName {
  return (legacy[name as string] ?? name) as IconName;
}

/** The 48 dp hit area every icon control keeps, whatever its drawing. */
export function IconButton({
  name,
  label,
  onPress,
  tone = 'default',
  testID,
  size = 22,
}: {
  name: IconName | keyof typeof legacy;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'owed';
  testID?: string;
  size?: number;
}) {
  const color = tone === 'owed' ? colors.error : tone === 'primary' ? colors.primary : colors.onSurface;

  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={4}
      android_ripple={{ color: colors.primaryContainer, borderless: true }}
      style={styles.icon}
    >
      <Icon name={resolve(name)} size={size} color={color} />
    </Pressable>
  );
}

/**
 * The small round white control the design puts in a screen's corner: a sheet's
 * dismiss, a step back. It floats on the ground the way a card does.
 */
export function RoundButton({
  icon,
  label,
  onPress,
  testID,
  size = 32,
}: {
  icon: IconName;
  label: string;
  onPress: () => void;
  testID?: string;
  size?: number;
}) {
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      android_ripple={{ color: colors.primaryContainer, borderless: true }}
      style={styles.roundTouch}
    >
      <View style={[styles.round, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name={icon} size={Math.round(size * 0.5)} color={colors.onSurfaceVariant} />
      </View>
    </Pressable>
  );
}

export function CloseButton({ onPress, label = 'Tutup' }: { onPress: () => void; label?: string }) {
  return <RoundButton icon="close" label={label} onPress={onPress} />;
}

/** A back control in the header's leading slot. */
export function BackButton({ onPress, label = 'Kembali' }: { onPress: () => void; label?: string }) {
  return <RoundButton icon="arrowLeft" label={label} onPress={onPress} size={36} />;
}

export function HeaderAction({ children }: { children: ReactNode }) {
  return <View style={styles.action}>{children}</View>;
}

const styles = StyleSheet.create({
  icon: { minWidth: space.touch, minHeight: space.touch, alignItems: 'center', justifyContent: 'center' },
  roundTouch: { minWidth: space.touch, minHeight: space.touch, alignItems: 'center', justifyContent: 'center' },
  round: {
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.surfaceContainerLowest,
    borderRadius: shape.full,
    ...elevation.raised,
  },
  action: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
});
