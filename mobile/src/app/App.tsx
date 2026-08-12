import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, spacing, typography } from '../design-system/tokens'
import appConfig from '../../app.json'
import { runBootstrap } from './bootstrap'
import { RootNavigator } from '../navigation/RootNavigator'
import { LibrarySelectScreen } from '../screens/LibrarySelect/LibrarySelectScreen'
import { TutorialScreen } from '../screens/Tutorial/TutorialScreen'
import { EssentialsScreen } from '../screens/Essentials/EssentialsScreen'
import { DiagnosticsScreen } from '../screens/Diagnostics/DiagnosticsScreen'
import { TransfersScreen } from '../screens/Transfers/TransfersScreen'
import { ArtSyncScreen } from '../screens/ArtSync/ArtSyncScreen'
import { SourcesScreen } from '../screens/Sources/SourcesScreen'
import { DownloadsFab } from '../components/DownloadsFab'
import { ConnectionToast } from '../components/ConnectionToast'
import { navigationRef } from './navigationRef'

void SplashScreen.preventAutoHideAsync()

export type RootStackParamList = {
  Tabs: undefined
  LibrarySelect: undefined
  Sharing: undefined
  Tutorial: undefined
  Essentials: undefined
  Diagnostics: undefined
  Transfers: undefined
  ArtSync: undefined
  Sources: undefined
}

const Stack = createNativeStackNavigator<RootStackParamList>()

const APP_VERSION = appConfig.expo.version ?? '—'

/**
 * Shown in place of the native splash (which is just a static logo image,
 * no room for dynamic text) while fonts load — the brief window between
 * `preventAutoHideAsync()` and `hideAsync()`. Carries the app identity
 * (name, version) and a piracy disclaimer, since this is the very first
 * thing anyone sees, including anyone reviewing what the app is for.
 */
function SplashOverlay() {
  return (
    <View style={splashStyles.container}>
      <Image source={require('../../assets/logo-mark.png')} style={splashStyles.logo} resizeMode="contain" />
      <Text style={splashStyles.name}>OPL Forge</Text>
      <Text style={splashStyles.version}>v{APP_VERSION}</Text>
      <Text style={splashStyles.disclaimer}>
        Use apenas com jogos que você possui legalmente. Este app não distribui nem hospeda conteúdo protegido por
        direitos autorais.
      </Text>
    </View>
  )
}

const splashStyles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.xs
  },
  logo: { width: 96, height: 96, marginBottom: spacing.md },
  name: { color: colors.foreground, fontSize: typography.title.fontSize, fontWeight: '700' },
  version: { color: colors.mutedForeground, fontSize: typography.caption.fontSize, marginBottom: spacing.lg },
  disclaimer: {
    color: colors.mutedForeground,
    fontSize: typography.caption.fontSize,
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 320
  }
})

/**
 * Dark-only navigation theme (FR-012) — there is no light variant to fall
 * back to, matching the desktop app's fixed dark theme.
 */
const oplForgeNavigationTheme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    background: colors.background,
    card: colors.card,
    text: colors.foreground,
    border: colors.border,
    primary: colors.primary
  }
}

/** Minimum time the branded splash (name/version/piracy notice) stays on screen, so it's actually readable rather than a one-frame flash. */
const MIN_SPLASH_MS = 1500

export default function App() {
  const [fontsReady, setFontsReady] = useState(false)
  const [minDurationElapsed, setMinDurationElapsed] = useState(false)

  useEffect(() => {
    void runBootstrap()
  }, [])

  useEffect(() => {
    void SplashScreen.hideAsync()
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_SPLASH_MS)
    Font.loadAsync(MaterialIcons.font)
      .catch(() => undefined)
      .finally(() => setFontsReady(true))
    return () => clearTimeout(timer)
  }, [])

  if (!fontsReady || !minDurationElapsed) return <SplashOverlay />

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={oplForgeNavigationTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName="Tabs"
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.foreground,
            contentStyle: { backgroundColor: colors.background }
          }}
        >
          <Stack.Screen name="Tabs" component={RootNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="LibrarySelect"
            component={LibrarySelectScreen}
            options={{ title: 'Biblioteca' }}
          />
          <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ title: 'Configurar PS2' }} />
          <Stack.Screen name="Essentials" component={EssentialsScreen} options={{ title: 'Catálogo Essentials' }} />
          <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: 'Diagnóstico' }} />
          <Stack.Screen name="Transfers" component={TransfersScreen} options={{ title: 'Transferências' }} />
          <Stack.Screen name="ArtSync" component={ArtSyncScreen} options={{ title: 'Sincronizar Artes' }} />
          <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: 'Google Drive' }} />
        </Stack.Navigator>
        <DownloadsFab />
        <ConnectionToast />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
