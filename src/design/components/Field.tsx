import { useState } from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { AppText } from './AppText';
import { colors, fontFamily, shape, space, typography } from '../tokens';

export interface FieldProps extends TextInputProps {
  label: string;
  /** Shown under the field in the `owed` red: a validation message, nothing else. */
  error?: string | null;
  hint?: string;
  /** A unit or currency mark inside the field, at its right edge. */
  suffix?: string;
  /** `amount` sets the figure large and tabular: a sum the owner is typing. */
  size?: 'normal' | 'amount';
  testID?: string;
}

/**
 * An input as a card: caps label above, white field with a hairline, and blue
 * only while the field has the caret. Errors are words in red under the field,
 * never a red border alone.
 */
export function Field({ label, error, hint, suffix, size = 'normal', testID, style, ...rest }: FieldProps) {
  const [focused, setFocused] = useState(false);
  const amount = size === 'amount';

  return (
    <View style={styles.wrap}>
      <AppText typeRole="labelSmall" tone="muted" style={styles.label}>
        {label}
      </AppText>
      <View
        style={[
          styles.field,
          amount && styles.fieldAmount,
          focused && styles.fieldFocused,
          error ? styles.fieldError : null,
        ]}
      >
        <TextInput
          testID={testID}
          accessibilityLabel={label}
          placeholderTextColor={colors.onSurfaceVariant}
          selectionColor={colors.primary}
          onFocus={(event) => {
            setFocused(true);
            rest.onFocus?.(event);
          }}
          onBlur={(event) => {
            setFocused(false);
            rest.onBlur?.(event);
          }}
          style={[amount ? styles.inputAmount : styles.input, style]}
          {...rest}
        />
        {suffix ? (
          <AppText typeRole={amount ? 'headlineSmall' : 'bodyLarge'} tone="muted">
            {suffix}
          </AppText>
        ) : null}
      </View>
      {error ? (
        <AppText typeRole="bodySmall" tone="owed" style={styles.message}>
          {error}
        </AppText>
      ) : hint ? (
        <AppText typeRole="bodySmall" tone="muted" style={styles.message}>
          {hint}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: space.md },
  label: { paddingBottom: space.sm },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    minHeight: 52,
    paddingHorizontal: space.md,
    backgroundColor: colors.surfaceContainerLowest,
    borderWidth: 1,
    borderColor: colors.outline,
    borderRadius: shape.md,
  },
  fieldAmount: { minHeight: 64 },
  fieldFocused: { borderWidth: 1.5, borderColor: colors.primary },
  fieldError: { borderWidth: 1.5, borderColor: colors.error },
  input: {
    flex: 1,
    paddingVertical: space.sm,
    color: colors.onSurface,
    ...typography.bodyLarge,
    fontFamily: fontFamily.print,
    textAlignVertical: 'center',
  },
  inputAmount: {
    flex: 1,
    paddingVertical: space.sm,
    color: colors.onSurface,
    ...typography.headlineSmall,
    fontFamily: fontFamily.printSemibold,
    textAlignVertical: 'center',
  },
  message: { paddingTop: space.sm },
});
