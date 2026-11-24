import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon, type IconName } from './Icon';
import { colors, shape, space } from '../tokens';

export interface TabItem {
  key: string;
  label: string;
  icon: IconName;
}

export interface TabBarProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * The app's four destinations, along the bottom (DESIGN.md Navigation).
 *
 * One blue pill marks where you are; every other icon is quiet. The pill is the
 * blue wash rather than a filled blue button, because the tab is a place, not
 * an action.
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
              <Icon name={tab.icon} size={20} color={selected ? colors.primary : colors.onSurfaceVariant} />
            </View>
            <AppText typeRole="tabLabel" tone={selected ? 'primary' : 'muted'} style={styles.label}>
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
  tab: { flex: 1, alignItems: 'center', minHeight: space.touch, paddingTop: 6 },
  pill: {
    width: 56,
    height: 30,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primaryContainer },
  label: { paddingTop: 2 },
});
