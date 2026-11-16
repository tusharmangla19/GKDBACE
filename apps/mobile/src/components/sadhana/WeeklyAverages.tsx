import React from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { TrendingUp, TrendingDown } from 'lucide-react-native';
import {
	averagesFields,
	type Delta,
	type DeltaSentiment,
	type FieldKey,
	type Metric,
	type PeriodStats,
} from '@iyf/domain';
import { Radius, Space, Type, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/**
 * MY WEEKLY AVERAGES — one flat table. Twelve identical rows, values in a single
 * right-aligned column, a narrow delta column, hairline rules between.
 *
 * Earlier versions split the same twelve fields into four "hero" cards over an
 * eight-cell grid. That split was arbitrary — SP Books was promoted and Other
 * Books demoted for no reason a devotee would recognise — and it forced two
 * visual languages onto one list. Everything that made it noisy is gone:
 *   - the hero/secondary tiers, the tinted icon circles, the per-row icons
 *   - "/ day" printed twelve times; the heading says it once
 *   - "from N of M days" under every card; one note now covers the rule
 *   - a horizontal scroll that hid Seva off-screen entirely
 *
 * Alignment is the whole point: label flexes, value and delta sit in fixed
 * columns, so the eye scans one vertical axis instead of twelve.
 *
 * Values, units and aggregation come from @iyf/domain. That matters most for
 * Mangala Arti and Class, which are a COUNT OF DAYS, not a per-day average.
 *
 * Delta colour follows each field's own `goodDirection`, so Day Rest Time renders
 * grey — more daytime rest is not an improvement, and less is not either.
 */

// Takes the palette rather than closing over one: at module scope there is no
// `Palette` in scope, and the themed sheet's parameter of that name is not
// visible here. Referencing it threw the moment a delta was comparable.
const toneFor = (sentiment: DeltaSentiment, Palette: PaletteShape) =>
	sentiment === 'good' ? Palette.good : sentiment === 'bad' ? Palette.bad : Palette.textMuted;

/** Short unit: "rounds", "min", "days", or nothing at all for a time of day. */
const shortUnit = (metric: Metric) => (metric.field.agg === 'circularMean' ? '' : metric.unit);

/**
 * A middle dot holds the column when there is nothing to report — either no
 * change, or no previous period to compare against. An arrow with no number, or
 * a blank, would break the alignment the table depends on.
 */
function DeltaCell({ delta }: { delta: Delta }) {
	const [styles, Palette] = useStyles(makeStyles);
	if (!delta.comparable || !delta.compact) {
		return <Text style={styles.deltaNone}>·</Text>;
	}
	const Icon = delta.direction === 'up' ? TrendingUp : TrendingDown;
	const color = toneFor(delta.sentiment, Palette);
	return (
		<View style={styles.deltaCell}>
			<Icon size={11} color={color} />
			<Text style={[styles.deltaText, { color }]}>{delta.compact}</Text>
		</View>
	);
}

interface RowProps {
	metric: Metric;
	isFirst: boolean;
	isCharted: boolean;
	/** Absent when the field cannot be charted - the row is then inert. */
	onPress?: () => void;
}

function Row({ metric, isFirst, isCharted, onPress }: RowProps) {
	const [styles] = useStyles(makeStyles);
	const { field, display, count, delta } = metric;
	const hasValue = display !== null && count > 0;
	const unit = shortUnit(metric);

	return (
		<Pressable
			onPress={onPress}
			disabled={!onPress}
			style={({ pressed }) => [
				styles.row,
				!isFirst && styles.rowDivided,
				isCharted && styles.rowCharted,
				pressed && onPress && styles.rowPressed,
			]}
			accessibilityRole={onPress ? 'button' : 'text'}
			accessibilityLabel={
				hasValue
					? `${field.label}, ${display} ${unit}${
							delta.comparable ? `, ${delta.display}` : ''
						}${onPress ? '. Tap to chart it' : ''}`
					: `${field.label}, not recorded`
			}
		>
			<Text style={styles.label} numberOfLines={1}>
				{field.label}
			</Text>

			<Text style={styles.value} numberOfLines={1}>
				{hasValue ? (
					<>
						{display}
						{unit ? <Text style={styles.unit}> {unit}</Text> : null}
					</>
				) : (
					<Text style={styles.valueEmpty}>—</Text>
				)}
			</Text>

			<View style={styles.deltaColumn}>{hasValue ? <DeltaCell delta={delta} /> : null}</View>
		</Pressable>
	);
}

interface WeeklyAveragesProps {
	stats: PeriodStats;
	/** The field the trend chart is currently showing, highlighted in the table. */
	chartedField?: FieldKey;
	onChartField?: (_key: FieldKey) => void;
}

export default function WeeklyAverages({ stats, chartedField, onChartField }: WeeklyAveragesProps) {
	const [styles] = useStyles(makeStyles);
	const { metricByKey, period } = stats;

	return (
		<View style={styles.wrapper}>
			<View style={styles.heading}>
				<Text style={styles.sectionLabel}>
					MY {period.unit === 'week' ? 'WEEKLY' : 'MONTHLY'} AVERAGES
				</Text>
				<Text style={styles.qualifier}>per day</Text>
			</View>
			{/* Said once here rather than under every row. */}
			<Text style={styles.note}>Counts only the days a field was filled in.</Text>

			<View style={styles.table}>
				{averagesFields.map((field, index) => {
					const metric = metricByKey[field.key];
					const trendable = metric.agg === 'mean' || metric.agg === 'trueCount';
					return (
						<Row
							key={field.key}
							metric={metric}
							isFirst={index === 0}
							isCharted={chartedField === field.key}
							onPress={trendable && onChartField ? () => onChartField(field.key) : undefined}
						/>
					);
				})}
			</View>
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		wrapper: {
			marginBottom: Space.md,
		},
		heading: {
			flexDirection: 'row',
			alignItems: 'baseline',
			gap: 6,
		},
		sectionLabel: {
			...Type.sectionLabel,
			color: Palette.textMuted,
		},
		qualifier: {
			fontSize: 10,
			color: Palette.future,
		},
		note: {
			fontSize: 10,
			color: Palette.textMuted,
			marginTop: 2,
			marginBottom: Space.sm,
		},
		table: {
			backgroundColor: Palette.surface,
			borderRadius: Radius.md,
			borderWidth: 1,
			borderColor: Palette.border,
			overflow: 'hidden',
		},
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingVertical: 11,
			paddingHorizontal: Space.lg - 2,
			minHeight: 42,
		},
		rowDivided: {
			borderTopWidth: 1,
			borderTopColor: Palette.border,
		},
		rowCharted: {
			backgroundColor: Palette.accentWash,
		},
		rowPressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		label: {
			flex: 1,
			fontSize: 13,
			color: Palette.textPrimary,
			paddingRight: Space.sm,
		},
		// Fixed column so every value lands on the same axis.
		value: {
			width: 92,
			textAlign: 'right',
			fontSize: 14,
			fontWeight: '700',
			color: Palette.textPrimary,
		},
		unit: {
			fontSize: 10,
			fontWeight: '500',
			color: Palette.textMuted,
		},
		valueEmpty: {
			fontSize: 14,
			fontWeight: '700',
			color: Palette.future,
		},
		deltaColumn: {
			width: 44,
			alignItems: 'flex-end',
		},
		deltaCell: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 2,
		},
		deltaText: {
			fontSize: 11,
			fontWeight: '700',
		},
		deltaNone: {
			fontSize: 13,
			color: Palette.future,
		},
	});
