import { useEffect, useState } from 'react'
import { Image, StyleSheet, Text, View } from 'react-native'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { useTranslation } from 'react-i18next'
import '../i18n'
import { colors, spacing, typography } from '../design-system/tokens'
import appConfig from '../../app.json'
import { runBootstrap } from './bootstrap'
import { RootNavigator } from '../navigation/RootNavigator'
import { LibrarySelectScreen } from '../screens/LibrarySelect/LibrarySelectScreen'
import { LanguageSelectScreen } from '../screens/LanguageSelect/LanguageSelectScreen'
import { TutorialScreen } from '../screens/Tutorial/TutorialScreen'
import { EssentialsScreen } from '../screens/Essentials/EssentialsScreen'
import { DiagnosticsScreen } from '../screens/Diagnostics/DiagnosticsScreen'
import { TransfersScreen } from '../screens/Transfers/TransfersScreen'
import { ArtSyncScreen } from '../screens/ArtSync/ArtSyncScreen'
import { SourcesScreen } from '../screens/Sources/SourcesScreen'
import { DownloadsFab } from '../components/DownloadsFab'
import { ConnectionToast } from '../components/ConnectionToast'
import { navigationRef } from './navigationRef'
import { SplashProgress } from '../components/splash/SplashProgress'
import { useSettingsStore } from '../stores/settings-store'

void SplashScreen.preventAutoHideAsync()

export type RootStackParamList = {
  Tabs: undefined
  LanguageSelect: undefined
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
  const { t } = useTranslation()
  return (
    <View style={splashStyles.container}>
      <Image source={require('../../assets/logo-mark.png')} style={splashStyles.logo} resizeMode="contain" />
      <Text style={splashStyles.name}>{t('common.appName')}</Text>
      <Text style={splashStyles.version}>v{APP_VERSION}</Text>
      <Text style={splashStyles.disclaimer}>{t('splash.disclaimer')}</Text>
      <SplashProgress />
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
  const [bootstrapReady, setBootstrapReady] = useState(false)
  const languageSource = useSettingsStore((state) => state.languageSource)
  const { t } = useTranslation()

  useEffect(() => {
    void runBootstrap().finally(() => setBootstrapReady(true))
  }, [])

  useEffect(() => {
    void SplashScreen.hideAsync()
    const timer = setTimeout(() => setMinDurationElapsed(true), MIN_SPLASH_MS)
    Font.loadAsync(MaterialIcons.font)
      .catch(() => undefined)
      .finally(() => setFontsReady(true))
    return () => clearTimeout(timer)
  }, [])

  // Splash stays visible for the real bootstrap duration (FR-014/SC-005),
  // not just the fixed MIN_SPLASH_MS — whichever finishes last.
  if (!fontsReady || !minDurationElapsed || !bootstrapReady) return <SplashOverlay />

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} theme={oplForgeNavigationTheme}>
        <StatusBar style="light" />
        <Stack.Navigator
          initialRouteName={languageSource === 'user' ? 'Tabs' : 'LanguageSelect'}
          screenOptions={{
            headerStyle: { backgroundColor: colors.card },
            headerTintColor: colors.foreground,
            contentStyle: { backgroundColor: colors.background }
          }}
        >
          <Stack.Screen name="Tabs" component={RootNavigator} options={{ headerShown: false }} />
          <Stack.Screen
            name="LanguageSelect"
            component={LanguageSelectScreen}
            options={{ headerShown: false }}
          />
          <Stack.Screen
            name="LibrarySelect"
            component={LibrarySelectScreen}
            options={{ title: t('nav.library') }}
          />
          <Stack.Screen name="Tutorial" component={TutorialScreen} options={{ title: t('tutorial.title') }} />
          <Stack.Screen name="Essentials" component={EssentialsScreen} options={{ title: t('essentialsCatalogTab.title') }} />
          <Stack.Screen name="Diagnostics" component={DiagnosticsScreen} options={{ title: t('diagnostics.screenTitle') }} />
          <Stack.Screen name="Transfers" component={TransfersScreen} options={{ title: t('essentialsScreen.tabs.downloads') }} />
          <Stack.Screen name="ArtSync" component={ArtSyncScreen} options={{ title: t('artSync.title') }} />
          <Stack.Screen name="Sources" component={SourcesScreen} options={{ title: t('sources.title') }} />
        </Stack.Navigator>
        <DownloadsFab />
        <ConnectionToast />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
