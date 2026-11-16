import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Platform, View } from 'react-native';
import { usePalette } from '@/hooks/useStyles';

/**
 * Owns the two things a theme has to get right above every screen: the native
 * stack's own background (otherwise a light card flashes behind a dark screen
 * during a push) and the status bar's content colour.
 *
 * A plain stack, not tabs. My Sadhana and Profile were removed, and a tab bar
 * holding a single item is chrome that navigates nowhere - the leaderboard is
 * simply the root, and a devotee's detail screen pushes on top of it.
 */
export default function RootLayout() {
	const palette = usePalette();

	return (
		<View
			style={{
				flex: 1,
				backgroundColor: palette.canvas,
				...(Platform.OS === 'web' && { width: '100%', maxWidth: 760, alignSelf: 'center' }),
			}}
		>
			{/* "auto" is expo-status-bar's default and already follows the active
		    colour scheme, so no manual branch is needed. */}
			<StatusBar style="auto" />
			<Stack
				screenOptions={{
					headerShown: false,
					contentStyle: { backgroundColor: palette.canvas },
				}}
			>
				<Stack.Screen name="index" />
				<Stack.Screen name="sadhana/[id]" />
			</Stack>
		</View>
	);
}
