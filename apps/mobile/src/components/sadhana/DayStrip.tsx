import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react-native';
import { DAY_STATE, type DayStateValue, type PeriodDay } from '@iyf/domain';
import { Radius, Space, Type, HIT_SIZE, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * The week's days as tappable targets. Four states, never colour-only:
 *
 *   complete  filled dot          every field logged
 *   partial   ring                started, some fields blank
 *   open      pencil glyph        elapsed and untouched  (neutral grey, NOT red)
 *   future    faint bar           has not happened yet - cannot be "missing"
 *
 * The open marker is a pencil rather than another abstract shape: it stays
 * distinct from the filled dot and the ring without relying on colour, and it
 * says what tapping the day will do instead of leaving that to a footnote.
 *
 * Tapping a day opens that day in the entry form. That is the whole point of
 * this strip: the useful response to a gap is filling it, not being told about it.
 */

function DayMarker({ state }: { state: DayStateValue }) {
	const [styles, Palette] = useStyles(makeStyles);
	if (state === DAY_STATE.COMPLETE) {
		return <View style={[styles.marker, styles.complete]} />;
	}
	if (state === DAY_STATE.PARTIAL) {
		return <View style={[styles.marker, styles.partial]} />;
	}
	if (state === DAY_STATE.MISSING) {
		return (
			<View style={styles.openMarker}>
				<Pencil size={11} color={Palette.open} strokeWidth={2.5} />
			</View>
		);
	}
	return <View style={styles.futureMarker} />;
}

const STATE_WORD: Record<DayStateValue, string> = {
	[DAY_STATE.COMPLETE]: 'fully logged',
	[DAY_STATE.PARTIAL]: 'partly logged',
	[DAY_STATE.MISSING]: 'not logged yet',
	[DAY_STATE.FUTURE]: 'upcoming',
};

interface DayStripProps {
	days: readonly PeriodDay[];
	selectedDate?: Date | null;
	onSelectDay?: (_day: PeriodDay) => void;
	showLegend?: boolean;
}

export default function DayStrip({
	days,
	selectedDate,
	onSelectDay,
	showLegend = true,
}: DayStripProps) {
	const [styles, Palette] = useStyles(makeStyles);
	return (
		<View>
			<View style={styles.row}>
				{days.map((day) => {
					const isSelected =
						selectedDate && format(day.date, 'yyyy-MM-dd') === format(selectedDate, 'yyyy-MM-dd');
					const isFuture = day.state === DAY_STATE.FUTURE;

					return (
						<Pressable
							key={day.key}
							disabled={isFuture}
							onPress={() => onSelectDay && onSelectDay(day)}
							hitSlop={6}
							accessibilityRole="button"
							accessibilityState={{ selected: !!isSelected, disabled: isFuture }}
							accessibilityLabel={`${format(day.date, 'EEEE d MMMM')}, ${STATE_WORD[day.state]}${
								isFuture ? '' : '. Tap to open this day'
							}`}
							style={({ pressed }) => [
								styles.day,
								isSelected && styles.daySelected,
								pressed && !isFuture && styles.dayPressed,
							]}
						>
							<Text style={[styles.dayName, isFuture && styles.dayTextFuture]}>
								{format(day.date, 'EEE').toUpperCase()}
							</Text>
							<Text style={[styles.dayNumber, isFuture && styles.dayTextFuture]}>
								{format(day.date, 'd')}
							</Text>
							<DayMarker state={day.state} />
							{day.isToday ? (
								<Text style={styles.todayTag}>TODAY</Text>
							) : (
								<View style={styles.tagSpacer} />
							)}
						</Pressable>
					);
				})}
			</View>

			{showLegend ? (
				<View style={styles.legend} accessibilityRole="summary">
					<View style={styles.legendItem}>
						<View style={[styles.legendMarker, styles.complete]} />
						<Text style={styles.legendText}>Logged</Text>
					</View>
					<View style={styles.legendItem}>
						<View style={[styles.legendMarker, styles.partial]} />
						<Text style={styles.legendText}>Partly</Text>
					</View>
					<View style={styles.legendItem}>
						<Pencil size={10} color={Palette.open} strokeWidth={2.5} />
						<Text style={styles.legendText}>Open — tap to fill</Text>
					</View>
					<View style={styles.legendItem}>
						<View style={styles.legendFuture} />
						<Text style={styles.legendText}>Upcoming</Text>
					</View>
				</View>
			) : null}
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		row: {
			flexDirection: 'row',
			justifyContent: 'space-between',
		},
		day: {
			alignItems: 'center',
			justifyContent: 'center',
			minWidth: HIT_SIZE,
			minHeight: HIT_SIZE + 20,
			paddingVertical: Space.xs,
			borderRadius: Radius.md,
			borderWidth: 1,
			borderColor: 'transparent',
		},
		daySelected: {
			backgroundColor: Palette.accentWash,
			borderColor: Palette.accent,
		},
		dayPressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		dayName: {
			...Type.micro,
			color: Palette.textMuted,
			marginBottom: 2,
		},
		dayNumber: {
			fontSize: 16,
			fontWeight: '600',
			color: Palette.textPrimary,
			marginBottom: Space.xs,
		},
		dayTextFuture: {
			color: Palette.open,
		},
		marker: {
			width: 10,
			height: 10,
			borderRadius: 5,
		},
		complete: {
			backgroundColor: Palette.goodFill,
		},
		partial: {
			borderWidth: 2,
			borderColor: Palette.accent,
			backgroundColor: 'transparent',
		},
		openMarker: {
			width: 10,
			height: 10,
			alignItems: 'center',
			justifyContent: 'center',
		},
		futureMarker: {
			width: 10,
			height: 2,
			borderRadius: 1,
			backgroundColor: Palette.future,
			marginVertical: 4,
		},
		todayTag: {
			fontSize: 9,
			fontWeight: '700',
			color: Palette.accentText,
			marginTop: 3,
		},
		tagSpacer: {
			height: 12,
		},
		legend: {
			flexDirection: 'row',
			flexWrap: 'wrap',
			marginTop: Space.md,
			columnGap: Space.md,
			rowGap: Space.xs,
		},
		legendItem: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 5,
		},
		legendMarker: {
			width: 8,
			height: 8,
			borderRadius: 4,
		},
		legendFuture: {
			width: 8,
			height: 2,
			borderRadius: 1,
			backgroundColor: Palette.future,
		},
		legendText: {
			...Type.micro,
			color: Palette.textMuted,
		},
	});
