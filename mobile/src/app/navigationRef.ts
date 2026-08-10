import { createNavigationContainerRef } from '@react-navigation/native'
import type { RootStackParamList } from './App'

/**
 * Lets components outside the navigator tree (the global downloads FAB)
 * trigger navigation without needing `useNavigation`, which only works for
 * descendants of a `Navigator`.
 */
export const navigationRef = createNavigationContainerRef<RootStackParamList>()
