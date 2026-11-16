import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { ChevronLeft, ChevronRight, CalendarDays } from 'lucide-react-native';
import { formatPeriodLabel, type Period } from '@iyf/domain';
import { Radius, Space, Type, HIT_SIZE, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * The ONLY date control on the Week / Month tabs. The screen used to carry three
 * competing ones (a header month dropdown, the tab row, and this pager) which
 * could disagree the moment a week straddled a month boundary.
 *
 * Paging forward past the current period is disabled - there is nothing to see.
 */
interface PeriodPagerProps {
	period: Period;
	/** -1 for the previous period, +1 for the next. */
	onShift: (_direction: number) => void;
	canGoForward: boolean;
}

export default function PeriodPager({ period, onShift, canGoForward }: PeriodPagerProps) {
	const [styles, Palette] = useStyles(makeStyles);
	const label = formatPeriodLabel(period);

	return (
		<View style={styles.row}>
			<Pressable
				onPress={() => onShift(-1)}
				hitSlop={8}
				style={({ pressed }) => [styles.arrow, pressed && styles.arrowPressed]}
				accessibilityRole="button"
				accessibilityLabel={`Previous ${period.unit}`}
			>
				<ChevronLeft size={22} color={Palette.accentStrong} />
			</Pressable>

			<View style={styles.labelWrap}>
				<CalendarDays size={15} color={Palette.textSecondary} />
				<Text style={styles.label} accessibilityRole="header">
					{label}
				</Text>
			</View>

			<Pressable
				onPress={() => onShift(1)}
				disabled={!canGoForward}
				hitSlop={8}
				style={({ pressed }) => [
					styles.arrow,
					pressed && canGoForward && styles.arrowPressed,
					!canGoForward && styles.arrowDisabled,
				]}
				accessibilityRole="button"
				accessibilityState={{ disabled: !canGoForward }}
				accessibilityLabel={`Next ${period.unit}`}
			>
				<ChevronRight size={22} color={canGoForward ? Palette.accentStrong : Palette.future} />
			</Pressable>
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingVertical: Space.sm,
		},
		arrow: {
			width: HIT_SIZE,
			height: HIT_SIZE,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: Radius.pill,
		},
		arrowPressed: {
			backgroundColor: Palette.accentWash,
		},
		arrowDisabled: {
			opacity: 0.5,
		},
		labelWrap: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: Space.sm,
		},
		label: {
			...Type.title,
			color: Palette.textPrimary,
		},
	});
