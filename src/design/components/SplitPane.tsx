import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useFrame } from '../useFrame';
import { colors, layout, space } from '../tokens';

export interface SplitPaneProps {
  /** The list. Shown in both frames. */
  list: ReactNode;
  /** The thing you must see while using the list. Shown only in a wide frame. */
  detail?: ReactNode;
  testID?: string;
  detailTestID?: string;
}

/**
 * Two panes in a wide frame, one in a compact one.
 *
 * This is DESIGN.md §Two panes with a body: the list on the left, the selected
 * thing on the right, and in portrait the list alone — because a narrow screen
 * has no room to show both, and a pane you have to scroll past is worse than a
 * sub-view you can go back from.
 */
export function SplitPane({ list, detail, testID, detailTestID }: SplitPaneProps) {
  const { wide } = useFrame();

  if (!wide || !detail) {
    return (
      <View style={styles.list} testID={testID}>
        {list}
      </View>
    );
  }

  return (
    <View style={styles.row} testID={testID}>
      <View style={styles.list}>{list}</View>
      <View style={[styles.detail, { width: layout.notaPanel }]} testID={detailTestID}>
        {detail}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flex: 1, flexDirection: 'row', minHeight: 0 },
  list: { flex: 1, minWidth: 0 },
  detail: {
    flexShrink: 0,
    backgroundColor: colors.surface,
    borderLeftWidth: StyleSheet.hairlineWidth,
    borderLeftColor: colors.outline,
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
  },
});
