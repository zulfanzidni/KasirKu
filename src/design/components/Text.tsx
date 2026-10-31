import { StyleSheet } from 'react-native';
import { AppText } from './AppText';
import { space } from '../tokens';

/** Section headings and the quiet notes used under a screen title. */
export function SectionHeading({ children }: { children: string }) {
  return (
    <AppText typeRole="titleMedium" tone="primary" style={styles.section}>
      {children}
    </AppText>
  );
}

export function Note({ children }: { children: string }) {
  return (
    <AppText typeRole="bodyMedium" tone="muted" style={styles.note}>
      {children}
    </AppText>
  );
}

const styles = StyleSheet.create({
  section: { paddingHorizontal: space.gutter, paddingTop: space.xl, paddingBottom: space.xs },
  note: { paddingHorizontal: space.gutter, paddingVertical: space.md },
});
