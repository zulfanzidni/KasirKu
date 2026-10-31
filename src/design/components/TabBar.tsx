import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, shape, space } from '../tokens';

export interface TabItem {
  key: string;
  label: string;
  icon: keyof typeof MaterialIcons.glyphMap;
}

export interface TabBarProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Material 3 navigation bar, four destinations, in the shop's own words
 * (DESIGN.md §Navigation). Icons are one weight, never emoji.
 */
export function TabBar({ tabs, active, onChange }: TabBarProps) {
  return (
    <View style={styles.bar}>
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            android_ripple={{ color: colors.primaryContainer, borderless: true }}
            onPress={() => onChange(tab.key)}
            style={styles.tab}
          >
            <View style={[styles.pill, selected && styles.pillActive]}>
              <MaterialIcons name={tab.icon} size={22} color={selected ? colors.primary : colors.onSurfaceVariant} />
            </View>
            <AppText typeRole="labelLarge" tone={selected ? 'primary' : 'muted'} style={styles.label}>
              {tab.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceContainerLowest,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.outline,
    paddingBottom: space.sm,
  },
  tab: { flex: 1, alignItems: 'center', minHeight: space.touch, paddingTop: space.sm },
  pill: {
    width: 64,
    height: 32,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primaryContainer },
  label: { fontSize: 12, lineHeight: 16, paddingTop: 2 },
});
