import { createBottomTabNavigator } from '@react-navigation/bottom-tabs'
import { Image, View } from 'react-native'
import { useSafeAreaInsets } from 'react-native-safe-area-context'
import { useTranslation } from 'react-i18next'
import MaterialIcons from '@expo/vector-icons/MaterialIcons'
import { colors, spacing } from '../design-system/tokens'
import { HomeScreen } from '../screens/Home/HomeScreen'
import { LibraryScreen } from '../screens/Library/LibraryScreen'
import { SharingScreen } from '../screens/Sharing/SharingScreen'
import { EssentialsScreen } from '../screens/Essentials/EssentialsScreen'
import { SettingsScreen } from '../screens/Settings/SettingsScreen'

export type TabParamList = {
  Home: undefined
  Library: undefined
  Essentials: undefined
  Sharing: undefined
  Settings: undefined
}

const Tab = createBottomTabNavigator<TabParamList>()

const TAB_ICON: Record<keyof TabParamList, keyof typeof MaterialIcons.glyphMap> = {
  Home: 'home',
  Library: 'videogame-asset',
  Essentials: 'travel-explore',
  Sharing: 'wifi-tethering',
  Settings: 'settings'
}

function HeaderLogo() {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, paddingLeft: spacing.md }}>
      <Image source={require('../../assets/logo-mark.png')} style={{ width: 28, height: 28 }} resizeMode="contain" />
    </View>
  )
}

function TabIcon({ name, focused }: { name: keyof typeof MaterialIcons.glyphMap; focused: boolean }) {
  return (
    <View
      style={{
        width: 56,
        height: 32,
        borderRadius: 999,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: focused ? `${colors.primary}33` : 'transparent'
      }}
    >
      <MaterialIcons name={name} size={24} color={focused ? colors.primary : colors.mutedForeground} />
    </View>
  )
}

/**
 * T069 — mobile-native bottom-tab shell (FR-011), following the Stitch
 * "Forge Dark" design system: Material Symbols-equivalent icons (not emoji),
 * an active-tab pill highlight, and safe-area-aware height so the bar never
 * sits under the gesture nav on edge-to-edge Android (App.tsx wraps the tree
 * in SafeAreaProvider so useSafeAreaInsets below reads real inset values).
 * LibrarySelect/Tutorial stay as root-stack pushes (App.tsx) so they can be
 * reached from any tab (e.g. Home's "select library" action).
 */
export function RootNavigator() {
  const { t } = useTranslation()
  const insets = useSafeAreaInsets()
  const bottomInset = Math.max(insets.bottom, spacing.md) + spacing.sm

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerStyle: { backgroundColor: colors.card },
        headerTintColor: colors.foreground,
        headerLeft: () => <HeaderLogo />,
        headerTitleStyle: { fontWeight: '700' as const },
        tabBarStyle: {
          backgroundColor: colors.card,
          borderTopColor: colors.border,
          height: 56 + bottomInset,
          paddingTop: spacing.xs,
          paddingBottom: bottomInset
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.mutedForeground,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '500' as const },
        tabBarIcon: ({ focused }) => <TabIcon name={TAB_ICON[route.name as keyof TabParamList]} focused={focused} />
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'OPL Forge', tabBarLabel: t('nav.home') }} />
      <Tab.Screen name="Library" component={LibraryScreen} options={{ title: t('nav.library') }} />
      <Tab.Screen name="Essentials" component={EssentialsScreen} options={{ title: t('nav.essentials'), tabBarLabel: t('nav.essentials') }} />
      <Tab.Screen name="Sharing" component={SharingScreen} options={{ title: t('nav.sharing') }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: t('nav.settings') }} />
    </Tab.Navigator>
  )
}
