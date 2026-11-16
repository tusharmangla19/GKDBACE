import React, { useState } from 'react';
import {
	View,
	Text,
	StyleSheet,
	Pressable,
	LayoutAnimation,
	Platform,
	UIManager,
} from 'react-native';
import { ChevronRight, ChevronDown, ChevronUp } from 'lucide-react-native';
import { useRouter } from 'expo-router';
import FieldIcon from '@/components/FieldIcon';
import { fieldByKey, type Devotee, type FieldKey, type Metric } from '@iyf/domain';
import { type PaletteShape, Radius, Space, Type } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
	UIManager.setLayoutAnimationEnabledExperimental(true);
}

/**
 * One devotee. No rank, no medal.
 *
 * Nothing here is ever sorted, and the version that numbered every row and handed
 * out gold/silver/bronze was awarding them by position in devoteesData.js - the
 * devotee with the worst month on screen held silver. This is a roster of a
 * group's practice, not a scoreboard of it.
 *
 * Two affordances, kept deliberately distinct. The row itself opens the devotee's
 * sadhana; a labelled strip along the bottom expands their averages. An earlier
 * version used a bare chevron for each, which gave one row two silent controls
 * that did different things.
 *
 * The five preview values come straight from the same `buildPeriodStats` metrics
 * the Week tab renders, so a number here can never disagree with the number on
 * the detail screen - and units come from the schema, which is how "SP Books in
 * pages" and "Seva in hrs/week" got invented last time.
 */
const PREVIEW_FIELDS: readonly FieldKey[] = [
	'japa',
	'mangalaArti',
	'spLecture',
	'spBooks',
	'wakeUpTime',
];

interface DevoteeListItemProps {
	devotee: Devotee;
	daysLogged: number;
	/** Days of the month that have happened - never the nominal 30. */
	elapsedDays: number;
	loggedToday: boolean;
	/** The same metrics the Week tab renders, so the two cannot disagree. */
	metrics?: Record<FieldKey, Metric>;
}

export default function DevoteeListItem({
	devotee,
	daysLogged,
	elapsedDays,
	loggedToday,
	metrics,
}: DevoteeListItemProps) {
	const [styles, Palette] = useStyles(makeStyles);
	const [expanded, setExpanded] = useState(false);
	const router = useRouter();

	const toggle = () => {
		LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
		setExpanded((open) => !open);
	};

	return (
		<View style={styles.container}>
			<Pressable
				onPress={() => router.push({ pathname: '/sadhana/[id]', params: { id: devotee.id } })}
				style={({ pressed }) => [styles.row, pressed && styles.rowPressed]}
				accessibilityRole="button"
				accessibilityLabel={`${devotee.name}, ${daysLogged} of ${elapsedDays} days logged this month${
					loggedToday ? ', logged today' : ''
				}. Open their sadhana`}
			>
				<View style={[styles.avatar, loggedToday && styles.avatarToday]}>
					<Text style={[styles.avatarText, loggedToday && styles.avatarTextToday]}>
						{devotee.name.charAt(0).toUpperCase()}
					</Text>
				</View>

				<Text style={styles.name} numberOfLines={1}>
					{devotee.name}
				</Text>

				<View style={styles.right}>
					<Text style={styles.count}>
						{daysLogged}
						<Text style={styles.countOf}>/{elapsedDays}</Text>
					</Text>
					<Text style={styles.countLabel}>logged</Text>
				</View>

				<ChevronRight color={Palette.future} size={18} />
			</Pressable>

			<Pressable
				onPress={toggle}
				hitSlop={{ top: 6, bottom: 10, left: 12, right: 24 }}
				style={({ pressed }) => [styles.toggle, pressed && styles.togglePressed]}
				accessibilityRole="button"
				accessibilityState={{ expanded }}
				accessibilityLabel={`${expanded ? 'Hide' : 'Show'} ${devotee.name}'s averages`}
			>
				<Text style={styles.toggleText}>{expanded ? 'Hide averages' : 'Averages'}</Text>
				{expanded ? (
					<ChevronUp size={13} color={Palette.accentText} />
				) : (
					<ChevronDown size={13} color={Palette.accentText} />
				)}
			</Pressable>

			{expanded ? (
				<View style={styles.panel}>
					{PREVIEW_FIELDS.map((fieldKey) => {
						const field = fieldByKey[fieldKey];
						const metric = metrics?.[fieldKey];
						const hasValue = metric && metric.display !== null && metric.count > 0;
						return (
							<View key={fieldKey} style={styles.cell}>
								<FieldIcon name={field.icon} size={15} color={Palette.textSecondary} />
								<Text style={styles.cellLabel} numberOfLines={1}>
									{field.label}
								</Text>
								<Text style={styles.cellValue} numberOfLines={1}>
									{hasValue ? metric.display : '—'}
								</Text>
								<Text style={styles.cellUnit} numberOfLines={1}>
									{hasValue ? metric.unit : ''}
								</Text>
							</View>
						);
					})}
				</View>
			) : null}
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		container: {
			backgroundColor: Palette.surface,
			borderBottomWidth: 1,
			borderBottomColor: Palette.border,
		},
		row: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: Space.md,
			paddingTop: Space.md,
			paddingBottom: 0,
			paddingHorizontal: Space.lg,
		},
		rowPressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		avatar: {
			width: 34,
			height: 34,
			borderRadius: 17,
			backgroundColor: Palette.surfaceSunken,
			alignItems: 'center',
			justifyContent: 'center',
		},
		// A ring on whoever has logged today - the one thing the monthly fraction
		// does not tell you.
		avatarToday: {
			backgroundColor: Palette.goodWash,
			borderWidth: 1.5,
			borderColor: Palette.goodFill,
		},
		avatarText: {
			...Type.bodyStrong,
			color: Palette.textSecondary,
		},
		avatarTextToday: {
			color: Palette.good,
		},
		name: {
			flex: 1,
			fontSize: 14,
			fontWeight: '600',
			color: Palette.textPrimary,
		},
		right: {
			alignItems: 'flex-end',
			minWidth: 46,
		},
		count: {
			fontSize: 15,
			fontWeight: '700',
			color: Palette.textPrimary,
		},
		countOf: {
			fontSize: 11,
			fontWeight: '500',
			color: Palette.textMuted,
		},
		countLabel: {
			fontSize: 9,
			color: Palette.textMuted,
		},

		toggle: {
			flexDirection: 'row',
			alignItems: 'center',
			alignSelf: 'flex-start',
			gap: 4,
			// Indented to start under the devotee's name rather than the avatar, so
			// it reads as belonging to that name.
			paddingLeft: Space.lg + 34 + Space.md,
			paddingRight: Space.md,
			paddingBottom: Space.md,
			paddingTop: 0,
		},
		togglePressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		toggleText: {
			fontSize: 10,
			fontWeight: '700',
			letterSpacing: 0.4,
			color: Palette.accentText,
			textTransform: 'uppercase',
		},

		panel: {
			flexDirection: 'row',
			backgroundColor: Palette.surfaceSunken,
			marginHorizontal: Space.md,
			marginBottom: Space.md,
			paddingVertical: Space.md,
			borderRadius: Radius.md,
		},
		cell: {
			flex: 1,
			alignItems: 'center',
			gap: 2,
			paddingHorizontal: 2,
		},
		cellLabel: {
			fontSize: 9,
			color: Palette.textMuted,
			textAlign: 'center',
		},
		cellValue: {
			fontSize: 14,
			fontWeight: '700',
			color: Palette.textPrimary,
		},
		cellUnit: {
			fontSize: 9,
			color: Palette.textMuted,
		},
	});
