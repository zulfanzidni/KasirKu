import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, space } from '../tokens';

/**
 * The few icons the till needs, from one family and one weight
 * (DESIGN.md: never emoji or Unicode glyphs standing in for icons).
 */
export function CloseButton({ onPress, label = 'Tutup' }: { onPress: () => void; label?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={styles.icon}
    >
      <MaterialIcons name="close" size={22} color={colors.onSurface} />
    </Pressable>
  );
}

export function IconButton({
  name,
  label,
  onPress,
  tone = 'default',
  testID,
}: {
  name: keyof typeof MaterialIcons.glyphMap;
  label: string;
  onPress: () => void;
  tone?: 'default' | 'primary' | 'owed';
  testID?: string;
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
      <MaterialIcons name={name} size={22} color={color} />
    </Pressable>
  );
}

export function HeaderAction({ children }: { children: ReactNode }) {
  return <View style={styles.action}>{children}</View>;
}

const styles = StyleSheet.create({
  icon: { minWidth: space.touch, minHeight: space.touch, alignItems: 'center', justifyContent: 'center' },
  action: { flexDirection: 'row', alignItems: 'center' },
});
