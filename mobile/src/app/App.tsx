import { useEffect, useState } from 'react'
import { StatusBar } from 'expo-status-bar'
import { NavigationContainer, DarkTheme, type Theme } from '@react-navigation/native'
import { createNativeStackNavigator } from '@react-navigation/native-stack'
import { SafeAreaProvider } from 'react-native-safe-area-context'
import * as Font from 'expo-font'
import * as SplashScreen from 'expo-splash-screen'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors } from '../design-system/tokens'
import { runBootstrap } from './bootstrap'
import { RootNavigator } from '../navigation/RootNavigator'
import { LibrarySelectScreen } from '../screens/LibrarySelect/LibrarySelectScreen'
import { TutorialScreen } from '../screens/Tutorial/TutorialScreen'
import { EssentialsScreen } from '../screens/Essentials/EssentialsScreen'
import { DiagnosticsScreen } from '../screens/Diagnostics/DiagnosticsScreen'
import { TransfersScreen } from '../screens/Transfers/TransfersScreen'
import { ArtSyncScreen } from '../screens/ArtSync/ArtSyncScreen'
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
}

const Stack = createNativeStackNavigator<RootStackParamList>()

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

export default function App() {
  const [fontsReady, setFontsReady] = useState(false)

  useEffect(() => {
    void runBootstrap()
  }, [])

  useEffect(() => {
    Font.loadAsync(MaterialIcons.font)
      .catch(() => undefined)
      .finally(() => {
        setFontsReady(true)
        void SplashScreen.hideAsync()
      })
  }, [])

  if (!fontsReady) return null

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
        </Stack.Navigator>
        <DownloadsFab />
        <ConnectionToast />
      </NavigationContainer>
    </SafeAreaProvider>
  )
}
