import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { format } from 'date-fns';
import { Pencil } from 'lucide-react-native';
import PeriodPager from '@/components/sadhana/PeriodPager';
import WeekCompletionCard from '@/components/sadhana/WeekCompletionCard';
import WeeklyAverages from '@/components/sadhana/WeeklyAverages';
import WeeklyTrendCard from '@/components/sadhana/WeeklyTrendCard';
import {
	buildPeriod,
	buildPeriodStats,
	isFutureDay,
	shiftPeriod,
	type DayRecord,
	type FieldKey,
	type PeriodUnit,
} from '@iyf/domain';
import { Radius, Space, Type, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * Week and Month are the same view over a different range - one metrics layer,
 * one set of components, no second implementation to drift out of sync.
 *
 * Order: completion -> averages -> trend. The averages cards are the primary way
 * to choose what the chart draws, so they sit above it, and the chart is
 * controlled from here so the cards and its own dropdown share one selection.
 */
interface PeriodViewProps {
	unit: PeriodUnit;
	/** Every day this devotee has logged - streaks span more than the period. */
	records: readonly DayRecord[];
	/** Any date inside the period being viewed. */
	anchor: Date;
	onAnchorChange: (_anchor: Date) => void;
	onOpenDay: (_date: Date) => void;
	/** Captured by the screen so "today" cannot shift mid-render. */
	now: Date;
}

export default function PeriodView({
	unit,
	records,
	anchor,
	onAnchorChange,
	onOpenDay,
	now,
}: PeriodViewProps) {
	const [styles, Palette] = useStyles(makeStyles);
	const [chartedField, setChartedField] = useState<FieldKey>('japa');

	const stats = useMemo(
		() => buildPeriodStats(records, anchor, unit, now),
		[records, anchor, unit, now]
	);

	const nextAnchor = shiftPeriod(stats.period, 1);
	const canGoForward = !isFutureDay(buildPeriod(nextAnchor, unit, now).start, now);
	const notStarted = stats.completion.elapsed === 0;

	const openFirstOpenDay = () => {
		const first = stats.openDays[0];
		if (first) onOpenDay(first.date);
	};

	return (
		<ScrollView
			style={styles.scroll}
			contentContainerStyle={styles.content}
			keyboardShouldPersistTaps="handled"
		>
			<PeriodPager
				period={stats.period}
				onShift={(direction: number) => onAnchorChange(shiftPeriod(stats.period, direction))}
				canGoForward={canGoForward}
			/>

			{notStarted ? (
				<View style={styles.emptyCard}>
					<Text style={styles.emptyTitle}>This {unit} hasn&apos;t started yet</Text>
					<Text style={styles.emptyBody}>
						Nothing to show for {format(stats.period.start, 'MMM d')} onwards. Come back once the
						days have happened.
					</Text>
				</View>
			) : (
				<>
					<WeekCompletionCard
						stats={stats}
						onSelectDay={onOpenDay}
						onFillOpenDays={openFirstOpenDay}
					/>

					{stats.hasAnyData ? (
						<>
							<WeeklyAverages
								stats={stats}
								chartedField={chartedField}
								onChartField={setChartedField}
							/>
							<WeeklyTrendCard
								days={stats.days}
								fieldKey={chartedField}
								onFieldChange={setChartedField}
								onSelectDay={onOpenDay}
								periodWord={unit}
							/>
						</>
					) : (
						<View style={styles.emptyCard}>
							<Text style={styles.emptyTitle}>Nothing logged this {unit} yet</Text>
							<Text style={styles.emptyBody}>
								Log a day and your averages and day-by-day chart appear here.
							</Text>
							<Pressable
								onPress={openFirstOpenDay}
								style={({ pressed }) => [styles.emptyCta, pressed && styles.emptyCtaPressed]}
								accessibilityRole="button"
							>
								<Pencil size={15} color={Palette.textOnAccent} />
								<Text style={styles.emptyCtaText}>Log a day</Text>
							</Pressable>
						</View>
					)}
				</>
			)}
		</ScrollView>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		scroll: { flex: 1 },
		content: {
			paddingHorizontal: Space.lg,
			paddingBottom: Space.xxl,
		},
		emptyCard: {
			backgroundColor: Palette.surface,
			borderRadius: Radius.lg,
			borderWidth: 1,
			borderColor: Palette.border,
			padding: Space.xl,
			alignItems: 'center',
			marginBottom: Space.md,
		},
		emptyTitle: {
			...Type.title,
			color: Palette.textPrimary,
			textAlign: 'center',
		},
		emptyBody: {
			...Type.caption,
			color: Palette.textMuted,
			textAlign: 'center',
			marginTop: Space.sm,
			lineHeight: 18,
		},
		emptyCta: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: Space.sm,
			marginTop: Space.lg,
			paddingVertical: Space.md,
			paddingHorizontal: Space.xl,
			borderRadius: Radius.md,
			backgroundColor: Palette.accentStrong,
		},
		emptyCtaPressed: { opacity: 0.8 },
		emptyCtaText: {
			...Type.bodyStrong,
			color: Palette.textOnAccent,
		},
	});
