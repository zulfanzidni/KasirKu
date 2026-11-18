import { Pressable, StyleSheet, View } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AppText } from './AppText';
import { colors, layout, shape, space } from '../tokens';
import type { TabItem } from './TabBar';

export interface NavRailProps {
  tabs: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
}

/**
 * Material 3 navigation rail: the four destinations of DESIGN.md, laid down the
 * left edge. In landscape the screen is wider than it is tall, so a bar along
 * the bottom would eat the rows the till needs; the rail spends width instead,
 * which landscape has to spare.
 *
 * Same destinations, same words, same active state as `TabBar` — the two are
 * one navigation, cut to fit the shape of the screen.
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
              <MaterialIcons
                name={tab.icon}
                size={22}
                color={selected ? colors.onPrimary : colors.onSurfaceVariant}
              />
            </View>
            <AppText typeRole="labelSmall" tone={selected ? 'primary' : 'muted'} style={styles.label}>
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
    height: 32,
    borderRadius: shape.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pillActive: { backgroundColor: colors.primary },
  label: { fontSize: 10, lineHeight: 14, letterSpacing: 0.4 },
});
