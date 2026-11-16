import React from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { Radius, Type, HIT_SIZE, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * Yes / No pills for the boolean fields.
 *
 * The VALUE is a boolean, or null when the devotee has not answered. It used to
 * be the strings "Yes" and "No" - which is how a build once wrote minutes into
 * this field and had them silently score as "No" everywhere.
 */
interface FormToggleProps {
	/** null until the devotee has actually answered. */
	value: boolean | null;
	onChange: (_value: boolean) => void;
	label?: string;
}

export default function FormToggle({ value, onChange, label }: FormToggleProps) {
	const [styles] = useStyles(makeStyles);
	return (
		<View style={styles.container}>
			{[true, false].map((option, index) => {
				const active = value === option;
				const text = option ? 'Yes' : 'No';
				return (
					<Pressable
						key={text}
						onPress={() => onChange(option)}
						hitSlop={4}
						style={({ pressed }) => [
							styles.button,
							index === 0 && styles.leftButton,
							active && (option ? styles.activeYes : styles.activeNo),
							pressed && styles.pressed,
						]}
						accessibilityRole="button"
						accessibilityState={{ selected: active }}
						accessibilityLabel={`${label || ''} ${text}`.trim()}
					>
						<Text
							style={[styles.text, active && (option ? styles.activeYesText : styles.activeNoText)]}
						>
							{text}
						</Text>
					</Pressable>
				);
			})}
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		container: {
			flexDirection: 'row',
			borderWidth: 1,
			borderColor: Palette.border,
			borderRadius: Radius.sm,
			overflow: 'hidden',
		},
		button: {
			minWidth: 52,
			minHeight: HIT_SIZE,
			paddingHorizontal: 14,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: Palette.surface,
		},
		leftButton: {
			borderRightWidth: 1,
			borderRightColor: Palette.border,
		},
		pressed: {
			opacity: 0.7,
		},
		activeYes: {
			backgroundColor: Palette.goodWash,
		},
		activeNo: {
			backgroundColor: Palette.surfaceSunken,
		},
		text: {
			...Type.bodyStrong,
			color: Palette.textMuted,
		},
		activeYesText: {
			color: Palette.good,
			fontWeight: '800',
		},
		activeNoText: {
			color: Palette.textPrimary,
			fontWeight: '800',
		},
	});
