import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react-native';
import { DAY_STATE, type DayStateValue, type PeriodStats } from '@iyf/domain';
import { Radius, Space, Type, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * WEEK COMPLETION — the headline fraction, a labelled dot per day, and a
 * segmented bar. No summary sentence: the fraction and the bar already say it,
 * and the count of unlogged days belongs on the button that acts on them.
 *
 * Denominators are ELAPSED days, not the nominal 7: on a Wednesday this reads
 * "2 / 3", because Thursday cannot be a day you failed to log. Upcoming days get
 * their own marker and are stated separately.
 *
 * Every dot is a tap target that opens that day in the entry form.
 */

function DayMarker({ state }: { state: DayStateValue }) {
	const [styles, Palette] = useStyles(makeStyles);
	if (state === DAY_STATE.COMPLETE) return <View style={[styles.dot, styles.dotComplete]} />;
	if (state === DAY_STATE.PARTIAL) return <View style={[styles.ring, styles.ringPartial]} />;
	if (state === DAY_STATE.MISSING) {
		return (
			<View style={styles.openMarker}>
				<Pencil size={11} color={Palette.bad} strokeWidth={2.5} />
			</View>
		);
	}
	return <View style={[styles.ring, styles.ringFuture]} />;
}

const STATE_WORD: Record<DayStateValue, string> = {
	[DAY_STATE.COMPLETE]: 'fully logged',
	[DAY_STATE.PARTIAL]: 'partly logged',
	[DAY_STATE.MISSING]: 'not logged yet',
	[DAY_STATE.FUTURE]: 'upcoming',
};

interface WeekCompletionCardProps {
	stats: PeriodStats;
	onSelectDay?: (_date: Date) => void;
	onFillOpenDays: () => void;
}

export default function WeekCompletionCard({
	stats,
	onSelectDay,
	onFillOpenDays,
}: WeekCompletionCardProps) {
	const [styles, Palette] = useStyles(makeStyles);
	const { completion, days, period } = stats;
	const { logged, partial, elapsed, open } = completion;
	const periodWord = period.unit;

	return (
		<View style={styles.card}>
			<View style={styles.topRow}>
				<View style={styles.headline}>
					<Text style={styles.sectionLabel}>
						{periodWord === 'week' ? 'WEEK COMPLETION' : 'MONTH COMPLETION'}
					</Text>
					<Text style={styles.big}>
						{logged} <Text style={styles.bigSlash}>/</Text> {elapsed}
					</Text>
					<Text style={styles.bigCaption}>days logged</Text>
				</View>

				{periodWord === 'week' ? (
					<View style={styles.dotsRow}>
						{days.map((day) => (
							<Pressable
								key={day.key}
								disabled={day.state === DAY_STATE.FUTURE}
								onPress={() => onSelectDay && onSelectDay(day.date)}
								hitSlop={{ top: 10, bottom: 10, left: 2, right: 2 }}
								style={styles.dayColumn}
								accessibilityRole="button"
								accessibilityLabel={`${format(day.date, 'EEEE d MMMM')}, ${
									STATE_WORD[day.state]
								}${day.state === DAY_STATE.FUTURE ? '' : '. Tap to open this day'}`}
							>
								<Text
									style={[styles.dayName, day.isToday && styles.dayNameToday]}
									numberOfLines={1}
								>
									{format(day.date, 'EEEEEE')}
								</Text>
								<DayMarker state={day.state} />
							</Pressable>
						))}
					</View>
				) : null}
			</View>

			<View style={styles.track}>
				{days.map((day) => (
					<View
						key={day.key}
						style={[
							styles.segment,
							day.state === DAY_STATE.COMPLETE && styles.segComplete,
							day.state === DAY_STATE.PARTIAL && styles.segPartial,
						]}
					/>
				))}
			</View>

			{open > 0 ? (
				<Pressable
					onPress={onFillOpenDays}
					style={({ pressed }) => [styles.cta, pressed && styles.ctaPressed]}
					accessibilityRole="button"
					accessibilityLabel={`Fill in ${open} open ${open === 1 ? 'day' : 'days'}`}
				>
					<Pencil size={14} color={Palette.accentStrong} />
					<Text style={styles.ctaText}>
						Fill in {open} open {open === 1 ? 'day' : 'days'}
						{partial > 0 ? ` (${partial} part-done)` : ''}
					</Text>
				</Pressable>
			) : null}
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		card: {
			backgroundColor: Palette.surface,
			borderRadius: Radius.lg,
			borderWidth: 1,
			borderColor: Palette.border,
			padding: Space.lg,
			marginBottom: Space.md,
		},
		topRow: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			justifyContent: 'space-between',
		},
		headline: {
			paddingRight: Space.md,
		},
		sectionLabel: {
			...Type.sectionLabel,
			color: Palette.textMuted,
		},
		big: {
			fontSize: 26,
			fontWeight: '700',
			color: Palette.textPrimary,
			marginTop: Space.sm,
		},
		bigSlash: {
			fontSize: 19,
			fontWeight: '400',
			color: Palette.textMuted,
		},
		bigCaption: {
			...Type.caption,
			color: Palette.textSecondary,
			marginTop: 2,
		},
		// flex + minWidth:0 so seven columns divide whatever space is left after the
		// headline. A fixed per-column width pushed Sunday outside the card.
		dotsRow: {
			flexDirection: 'row',
			flex: 1,
			minWidth: 0,
			justifyContent: 'space-between',
		},
		dayColumn: {
			flex: 1,
			minWidth: 0,
			alignItems: 'center',
			paddingTop: 2,
		},
		dayName: {
			fontSize: 10,
			fontWeight: '600',
			color: Palette.textSecondary,
			marginBottom: Space.sm,
		},
		dayNameToday: {
			color: Palette.accentText,
			fontWeight: '700',
		},
		dot: {
			width: 11,
			height: 11,
			borderRadius: 6,
		},
		dotComplete: {
			backgroundColor: Palette.goodFill,
		},
		ring: {
			width: 11,
			height: 11,
			borderRadius: 6,
			borderWidth: 1.5,
		},
		ringPartial: {
			borderColor: Palette.accent,
			borderWidth: 2.5,
		},
		ringFuture: {
			borderColor: Palette.future,
		},
		openMarker: {
			width: 11,
			height: 11,
			alignItems: 'center',
			justifyContent: 'center',
		},
		track: {
			flexDirection: 'row',
			gap: 4,
			marginTop: Space.lg,
		},
		segment: {
			flex: 1,
			height: 6,
			borderRadius: 3,
			backgroundColor: Palette.track,
		},
		segComplete: { backgroundColor: Palette.goodFill },
		segPartial: { backgroundColor: Palette.accent },
		cta: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: Space.sm,
			marginTop: Space.lg,
			paddingVertical: Space.md,
			borderRadius: Radius.md,
			backgroundColor: Palette.accentWash,
			borderWidth: 1,
			borderColor: Palette.accent,
		},
		ctaPressed: { opacity: 0.75 },
		ctaText: {
			...Type.bodyStrong,
			color: Palette.accentText,
		},
	});
