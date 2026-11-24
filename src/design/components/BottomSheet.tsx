import { forwardRef, useEffect, useImperativeHandle, useRef, type ReactNode } from 'react';
import { Animated, Modal, Pressable, StyleSheet, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/design/components/AppText';
import { CloseButton } from '@/design/components/Icons';
import { colors, motion, shape, space } from '@/design/tokens';

export interface BottomSheetHandle {
  close(): void;
}

export interface BottomSheetProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  testID?: string;
}

/**
 * A Material bottom sheet: `sheet` surface, a 16 dp top corner, a scrim, and
 * the standard slide. Pressing Back or the scrim closes it — nothing is trapped
 * here.
 */
export const BottomSheet = forwardRef<BottomSheetHandle, BottomSheetProps>(function BottomSheet(
  { visible, onClose, title, children, testID },
  ref,
) {
  const insets = useSafeAreaInsets();
  const slide = useRef(new Animated.Value(0)).current;

  useImperativeHandle(ref, () => ({ close: onClose }), [onClose]);

  useEffect(() => {
    Animated.timing(slide, {
      toValue: visible ? 1 : 0,
      duration: motion.screen,
      useNativeDriver: true,
    }).start();
  }, [visible, slide]);

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel="Tutup" />
        <Animated.View
          testID={testID}
          style={[
            styles.sheet,
            { paddingBottom: Math.max(insets.bottom, space.lg) },
            {
              transform: [
                { translateY: slide.interpolate({ inputRange: [0, 1], outputRange: [24, 0] }) },
              ],
              opacity: slide,
            },
          ]}
        >
          <View style={styles.grip} />
          <View style={styles.titleRow}>
            <AppText typeRole="titleLarge" style={styles.title} numberOfLines={2}>
              {title}
            </AppText>
            <CloseButton onPress={onClose} />
          </View>
          <ScrollView style={styles.body} contentContainerStyle={styles.bodyContent} keyboardShouldPersistTaps="handled">
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
});

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.scrim },
  sheet: {
    backgroundColor: colors.surfaceContainerLowest,
    borderTopLeftRadius: shape.xl,
    borderTopRightRadius: shape.xl,
    paddingHorizontal: space.gutter,
    paddingTop: space.sm,
    maxHeight: '85%',
  },
  grip: {
    alignSelf: 'center',
    width: 32,
    height: 4,
    borderRadius: shape.full,
    backgroundColor: colors.outline,
    marginBottom: space.md,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingBottom: space.sm },
  title: { flex: 1 },
  body: { flexGrow: 0 },
  bodyContent: { paddingBottom: space.sm },
});
