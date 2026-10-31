import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { colors, fontFamily, shape, space, typography } from '../tokens';

export interface FieldProps extends TextInputProps {
  label: string;
  /** Shown under the field in the `owed` red: a validation message, nothing else. */
  error?: string | null;
  hint?: string;
  testID?: string;
}

/**
 * A ruled input on the nota: a label in caps, paper beneath, and the ink focus
 * ring Material asks for. Errors are words in red, never a red border alone.
 */
export function Field({ label, error, hint, testID, style, ...rest }: FieldProps) {
  return (
    <View style={styles.wrap}>
      <AppText typeRole="labelSmall" tone="muted" style={styles.label}>
        {label}
      </AppText>
      <TextInput
        testID={testID}
        accessibilityLabel={label}
        placeholderTextColor={colors.onSurfaceVariant}
        selectionColor={colors.primary}
        style={[styles.input, error ? styles.inputError : null, style]}
        {...rest}
      />
      {error ? (
        <AppText typeRole="bodyMedium" tone="owed" style={styles.message}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText typeRole="bodyMedium" tone="muted" style={styles.message}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: space.md },
  label: { paddingBottom: space.xs },
  input: {
    minHeight: space.touch,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: shape.sm,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
    textAlignVertical: 'center',
  },
  inputError: { borderColor: colors.error, borderWidth: 1.5 },
  message: { paddingTop: space.xs },
});
