import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import {
  Kalam_400Regular,
  Kalam_700Bold,
  useFonts,
} from '@expo-google-fonts/kalam';
import {
  IBMPlexSans_400Regular,
  IBMPlexSans_500Medium,
  IBMPlexSans_600SemiBold,
  useFonts as usePlexFonts,
} from '@expo-google-fonts/ibm-plex-sans';
import { StatusBar } from 'expo-status-bar';
import { colors } from '@/design';

void SplashScreen.preventAutoHideAsync();

/**
 * Fonts are the one thing that must be ready before anything renders: the
 * whole world is two voices, and a fallback face would read as a different
 * app. Both families are bundled, never fetched at runtime — the shop has no
 * reliable internet.
 */
export default function RootLayout() {
  const [penLoaded, penError] = useFonts({ Kalam_400Regular, Kalam_700Bold });
  const [printLoaded, printError] = usePlexFonts({
    PlexSans_400Regular: IBMPlexSans_400Regular,
    PlexSans_500Medium: IBMPlexSans_500Medium,
    PlexSans_600SemiBold: IBMPlexSans_600SemiBold,
  });

  const ready = (penLoaded || penError) && (printLoaded || printError);

  useEffect(() => {
    if (ready) void SplashScreen.hideAsync();
  }, [ready]);

  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, justifyContent: 'center' }}>
        <ActivityIndicator color={colors.primary} />
      </View>
    );
  }

  return (
    <>
      <StatusBar style="dark" backgroundColor={colors.surface} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.surface },
          animation: 'fade',
        }}
      />
    </>
  );
}
