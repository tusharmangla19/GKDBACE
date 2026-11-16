import React, { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { format } from 'date-fns';
import { ChevronDown, Check } from 'lucide-react-native';
import {
	buildTrend,
	TRENDABLE_FIELDS,
	DAY_STATE,
	type FieldKey,
	type PeriodDay,
	type PeriodUnit,
} from '@iyf/domain';
import { Radius, Space, Type, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

const CHART_HEIGHT = 150;
const LABEL_BLOCK = 34;
/** Above this many days the bars stop fitting, so the plot scrolls instead. */
const SCROLL_THRESHOLD = 10;
const SCROLL_COLUMN_WIDTH = 34;

/**
 * WEEKLY TREND — bars, not a line.
 *
 * A line across a sparse log draws a segment through days that were never
 * recorded, which invents data. Each day is its own bar; an unrecorded day is a
 * dashed empty slot and an upcoming day is left blank. The dashed reference line
 * is the target the number is meaningless without (Japa 16).
 *
 * Controlled: the parent owns the selected field so this dropdown and the cards
 * in WeeklyAverages drive one piece of state.
 */

function niceCeiling(value: number): number {
	if (value <= 0) return 10;
	const magnitude = Math.pow(10, Math.floor(Math.log10(value)));
	for (const step of [1, 1.5, 2, 2.5, 5, 10]) {
		const candidate = step * magnitude;
		if (candidate >= value) return candidate;
	}
	return 10 * magnitude;
}

interface PlotFrameProps {
	scrolls: boolean;
	/** Explicit width only while scrolling; otherwise the bars divide the card. */
	width?: number;
	children: React.ReactNode;
}

function PlotFrame({ scrolls, width, children }: PlotFrameProps) {
	const [styles] = useStyles(makeStyles);
	if (!scrolls) return <View style={styles.plot}>{children}</View>;
	return (
		<ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ width }}>
			<View style={[styles.plot, { width }]}>{children}</View>
		</ScrollView>
	);
}

interface WeeklyTrendCardProps {
	days: readonly PeriodDay[];
	fieldKey: FieldKey;
	onFieldChange: (_key: FieldKey) => void;
	onSelectDay?: (_date: Date) => void;
	periodWord?: PeriodUnit;
}

export default function WeeklyTrendCard({
	days,
	fieldKey,
	onFieldChange,
	onSelectDay,
	periodWord = 'week',
}: WeeklyTrendCardProps) {
	const [styles, Palette] = useStyles(makeStyles);
	const [pickerOpen, setPickerOpen] = useState(false);
	const trend = useMemo(() => buildTrend(days, fieldKey), [days, fieldKey]);
	const field = trend.field;

	const isYesNo = field?.agg === 'trueCount';
	const target = isYesNo ? null : (field?.target ?? null);
	const unit = isYesNo ? 'days' : field?.unit || '';

	const ceiling = useMemo(() => {
		if (isYesNo) return 1;
		return niceCeiling(Math.max(trend.max ?? 0, target ?? 0) || 1);
	}, [trend.max, target, isYesNo]);

	/*
	 * buildTrend returns a null field for a key that is not in the schema. A typed
	 * `fieldKey` makes that unreachable, but the guard has to be a real one: the
	 * alternative was `field?.label` inside an accessibility string, which reads
	 * "no undefined recorded" out loud instead of failing.
	 *
	 * It sits below the hooks deliberately - an early return above them would
	 * change the hook order between renders.
	 */
	if (!field) return null;

	const gridLines = isYesNo ? [1, 0] : [ceiling, ceiling * 0.75, ceiling * 0.5, ceiling * 0.25, 0];

	const scrolls = trend.points.length > SCROLL_THRESHOLD;
	const plotWidth = scrolls ? trend.points.length * SCROLL_COLUMN_WIDTH : undefined;

	const elapsedCount = trend.points.filter((p) => p.state !== DAY_STATE.FUTURE).length;
	const recorded = trend.points.filter((p) => p.value !== null).length;

	return (
		<View style={styles.card}>
			<View style={styles.header}>
				<Text style={styles.title}>{periodWord === 'week' ? 'WEEKLY TREND' : 'MONTHLY TREND'}</Text>

				<Pressable
					onPress={() => setPickerOpen((open) => !open)}
					style={({ pressed }) => [styles.picker, pressed && styles.pickerPressed]}
					accessibilityRole="button"
					accessibilityState={{ expanded: pickerOpen }}
					accessibilityLabel={`Charting ${field.label}. Tap to choose another metric`}
				>
					<Text style={styles.pickerText} numberOfLines={1}>
						{field.label} {unit ? `(${unit})` : ''}
					</Text>
					<ChevronDown size={15} color={Palette.textSecondary} />
				</Pressable>
			</View>

			{pickerOpen ? (
				<View style={styles.pickerPanel}>
					{TRENDABLE_FIELDS.map((option) => {
						const active = option.key === fieldKey;
						return (
							<Pressable
								key={option.key}
								onPress={() => {
									onFieldChange(option.key);
									setPickerOpen(false);
								}}
								style={({ pressed }) => [
									styles.pickerOption,
									pressed && styles.pickerOptionPressed,
								]}
								accessibilityRole="button"
								accessibilityState={{ selected: active }}
							>
								<Text style={[styles.pickerOptionText, active && styles.pickerOptionActive]}>
									{option.label}
									{option.agg === 'trueCount' ? ' (days)' : ` (${option.unit})`}
								</Text>
								{active ? <Check size={14} color={Palette.accentText} /> : null}
							</Pressable>
						);
					})}
				</View>
			) : null}

			<View style={styles.plotRow}>
				<View style={styles.yAxis}>
					{gridLines.map((value, index) => (
						<Text key={index} style={styles.axisLabel}>
							{isYesNo ? (value ? 'Yes' : 'No') : Math.round(value)}
						</Text>
					))}
				</View>

				<PlotFrame scrolls={scrolls} width={plotWidth}>
					<View style={styles.grid} pointerEvents="none">
						{gridLines.map((_, index) => (
							<View key={index} style={styles.gridLine} />
						))}
					</View>

					{target != null && target <= ceiling ? (
						<View
							pointerEvents="none"
							style={[styles.targetLine, { bottom: (target / ceiling) * CHART_HEIGHT }]}
						>
							<View style={styles.targetDash} />
							<Text style={styles.targetLabel}>
								{target} {unit}
							</Text>
						</View>
					) : null}

					<View style={styles.bars}>
						{trend.points.map((point) => {
							const isFuture = point.state === DAY_STATE.FUTURE;
							const value = point.value;
							const ratio = value === null ? 0 : Math.min(value / ceiling, 1);
							const height = value ? Math.max(ratio * CHART_HEIGHT, 3) : 0;
							const onTarget = target != null && value != null && value >= target;

							return (
								<Pressable
									key={point.date.toISOString()}
									disabled={isFuture || !onSelectDay}
									onPress={() => onSelectDay && onSelectDay(point.date)}
									style={[styles.barColumn, scrolls && { flex: 0, width: SCROLL_COLUMN_WIDTH }]}
									accessibilityRole="button"
									accessibilityLabel={
										isFuture
											? `${format(point.date, 'EEEE d')}, upcoming`
											: value === null
												? `${format(point.date, 'EEEE d')}, no ${field.label} recorded. Tap to add`
												: `${format(point.date, 'EEEE d')}, ${
														isYesNo ? (value ? 'yes' : 'no') : `${point.display} ${unit}`
													}`
									}
								>
									<Text style={styles.barValue}>
										{value === null ? '' : isYesNo ? (value ? 'Yes' : 'No') : value}
									</Text>

									<View style={styles.barSlot}>
										{isFuture ? (
											<View style={styles.futureSlot} />
										) : value === null ? (
											<View style={styles.emptySlot} />
										) : (
											<View
												style={[
													styles.bar,
													{ height },
													onTarget && styles.barOnTarget,
													value === 0 && styles.barZero,
												]}
											/>
										)}
									</View>

									<Text style={[styles.barDay, isFuture && styles.barTextFuture]}>
										{format(point.date, 'EEE')}
									</Text>
									<Text style={[styles.barDate, isFuture && styles.barTextFuture]}>
										{format(point.date, 'd')}
									</Text>
								</Pressable>
							);
						})}
					</View>
				</PlotFrame>
			</View>

			<View style={styles.footnote}>
				<Text style={styles.footnoteText}>
					{recorded === 0
						? `No ${field.label} recorded this ${periodWord} yet. Tap a dashed slot to add a day.`
						: `${recorded} of ${elapsedCount} days recorded. Tap a dashed slot to add that day.`}
				</Text>
			</View>
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
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: Space.sm,
		},
		title: {
			...Type.sectionLabel,
			fontSize: 12,
			color: Palette.textPrimary,
			flexShrink: 1,
		},
		picker: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 6,
			paddingVertical: 7,
			paddingHorizontal: Space.md,
			borderRadius: Radius.sm,
			borderWidth: 1,
			borderColor: Palette.border,
			backgroundColor: Palette.surface,
			maxWidth: 170,
		},
		pickerPressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		pickerText: {
			...Type.caption,
			color: Palette.textPrimary,
			fontWeight: '600',
			flexShrink: 1,
		},
		pickerPanel: {
			marginTop: Space.sm,
			borderRadius: Radius.sm,
			borderWidth: 1,
			borderColor: Palette.border,
			backgroundColor: Palette.surfaceSunken,
			overflow: 'hidden',
		},
		pickerOption: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingVertical: 11,
			paddingHorizontal: Space.md,
		},
		pickerOptionPressed: {
			backgroundColor: Palette.accentWash,
		},
		pickerOptionText: {
			...Type.caption,
			color: Palette.textSecondary,
		},
		pickerOptionActive: {
			color: Palette.accentText,
			fontWeight: '700',
		},
		plotRow: {
			flexDirection: 'row',
			marginTop: Space.lg,
		},
		yAxis: {
			height: CHART_HEIGHT,
			justifyContent: 'space-between',
			alignItems: 'flex-end',
			marginRight: Space.sm,
			marginBottom: LABEL_BLOCK,
		},
		axisLabel: {
			fontSize: 10,
			color: Palette.textMuted,
			lineHeight: 11,
		},
		plot: {
			flex: 1,
			justifyContent: 'flex-end',
		},
		grid: {
			position: 'absolute',
			left: 0,
			right: 0,
			height: CHART_HEIGHT,
			bottom: LABEL_BLOCK,
			justifyContent: 'space-between',
		},
		gridLine: {
			height: 1,
			backgroundColor: Palette.border,
		},
		targetLine: {
			position: 'absolute',
			left: 0,
			right: 0,
			marginBottom: LABEL_BLOCK,
			flexDirection: 'row',
			alignItems: 'center',
			zIndex: 1,
		},
		targetDash: {
			flex: 1,
			borderBottomWidth: 1,
			borderStyle: 'dashed',
			borderColor: Palette.good,
		},
		targetLabel: {
			fontSize: 9,
			fontWeight: '700',
			color: Palette.good,
			marginLeft: 4,
		},
		bars: {
			flexDirection: 'row',
			alignItems: 'flex-end',
			justifyContent: 'space-between',
		},
		barColumn: {
			flex: 1,
			alignItems: 'center',
		},
		barValue: {
			fontSize: 10,
			fontWeight: '700',
			color: Palette.textSecondary,
			height: 14,
		},
		barSlot: {
			height: CHART_HEIGHT,
			justifyContent: 'flex-end',
			alignItems: 'center',
			width: '100%',
		},
		bar: {
			width: '56%',
			borderTopLeftRadius: 4,
			borderTopRightRadius: 4,
			backgroundColor: Palette.accent,
		},
		barOnTarget: {
			backgroundColor: Palette.goodFill,
		},
		barZero: {
			height: 3,
			backgroundColor: Palette.borderStrong,
		},
		emptySlot: {
			width: '56%',
			height: '100%',
			borderWidth: 1,
			borderStyle: 'dashed',
			borderColor: Palette.borderStrong,
			borderRadius: Radius.sm,
		},
		futureSlot: {
			width: '56%',
			height: 2,
			backgroundColor: Palette.future,
		},
		barDay: {
			fontSize: 10,
			fontWeight: '600',
			color: Palette.textSecondary,
			marginTop: 7,
		},
		barDate: {
			fontSize: 10,
			color: Palette.textMuted,
		},
		barTextFuture: {
			color: Palette.future,
		},
		footnote: {
			flexDirection: 'row',
			gap: 6,
			marginTop: Space.md,
			paddingTop: Space.md,
			borderTopWidth: 1,
			borderTopColor: Palette.border,
		},
		footnoteText: {
			...Type.micro,
			color: Palette.textMuted,
			flex: 1,
			lineHeight: 15,
		},
	});
