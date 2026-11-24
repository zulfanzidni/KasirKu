import { Pressable, StyleSheet, View } from 'react-native';
import { AppText } from './AppText';
import { Icon } from './Icon';
import { colors, layout, shape, space } from '../tokens';
import type { TabItem } from './TabBar';

export interface NavRailProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * The four destinations laid down the left edge in landscape, where width is
 * the thing the screen has to spare and height is not. Same words, same wash
 * pill, same one blue as the bar it replaces.
 */
export function NavRail({ tabs, active, onChange }: NavRailProps) {
  return (
    <View style={styles.rail} testID="nav-rail">
      {tabs.map((tab) => {
        const selected = tab.key === active;
        return (
          <Pressable
            key={tab.key}
            accessibilityRole="tab"
            accessibilityState={{ selected }}
            accessibilityLabel={tab.label}
            testID={`rail-${tab.key}`}
            android_ripple={{ color: colors.primaryContainer, borderless: true }}
            onPress={() => onChange(tab.key)}
            style={styles.item}
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
  rail: {
    width: layout.rail,
    flexDirection: 'column',
    backgroundColor: colors.surfaceContainerLowest,
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: colors.outline,
    paddingTop: space.sm,
    paddingBottom: space.sm,
  },
  item: { alignItems: 'center', gap: 2, paddingVertical: space.xs },
  pill: {
    width: 56,
    height: 30,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primaryContainer },
  label: { fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
});
