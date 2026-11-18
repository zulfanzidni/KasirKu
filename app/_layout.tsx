import { useEffect, useState, type ReactNode } from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import {
  useFonts,
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
} from '@expo-google-fonts/ibm-plex-sans';
import { colors, Note } from '@/design';
import { LedgerProvider, useApp } from '@/ledger/useLedger';
import { Shell } from '@/screens/Shell';
// Loads the phone's SQLite file and storage and hands them to the app.
import './connectPhone';

/**
 * Fonts and the ledger are the two things that must be ready before anything
 * renders: the till has one voice, and every number on screen is read off the
 * log. Both are loaded here, behind a holding screen.
 */
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    PlexSans_400Regular: IBMPlexSans_400Regular,
    PlexSans_500Medium: IBMPlexSans_500Medium,
    PlexSans_600SemiBold: IBMPlexSans_600SemiBold,
  });

  const fontsReady = fontsLoaded || fontError;

  if (!fontsReady) return <Loading />;

  return (
    <SafeAreaProvider>
      <StatusBar style="dark" backgroundColor={colors.surface} />
      <LedgerProvider>
        <LedgerReady>
          <Shell />
        </LedgerReady>
      </LedgerProvider>
    </SafeAreaProvider>
  );
}

/** One last gate: the till does not appear until the log has been read. */
function LedgerReady({ children }: { children: ReactNode }) {
  const { ready, error } = useApp();
  const [gaveUp, setGaveUp] = useState(false);

  useEffect(() => {
    if (ready || error) setGaveUp(true);
  }, [ready, error]);

  if (error) {
    return (
      <View style={styles.loading}>
        <Note>{`Catatan tidak bisa dibuka: ${error}`}</Note>
      </View>
    );
  }
  if (!gaveUp) return <Loading />;
  return <>{children}</>;
}

function Loading() {
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: { flex: 1, backgroundColor: colors.surface, alignItems: 'center', justifyContent: 'center' },
});
