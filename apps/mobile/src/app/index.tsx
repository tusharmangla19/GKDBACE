import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
	View,
	Text,
	StyleSheet,
	FlatList,
	ActivityIndicator,
	Image,
	Pressable,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ChevronLeft, ChevronRight } from 'lucide-react-native';
import {
	buildPeriodStats,
	devoteesData,
	indexByDate,
	isDayComplete,
	quoteOfTheDay,
	toDateKey,
	type Devotee,
	type FieldKey,
	type Metric,
} from '@iyf/domain';
import { listMonth } from '@iyf/data';
import { format, addMonths, isAfter } from 'date-fns';

import DevoteeListItem from '@/components/DevoteeListItem';
import { type PaletteShape, Radius, Space, Type, HIT_SIZE } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

/** One row of the roster: the devotee plus their month, ready to render. */
interface RosterRow extends Devotee {
	daysLogged: number;
	elapsedDays: number;
	loggedToday: boolean;
	metrics: Record<FieldKey, Metric>;
}

/**
 * Firestore rejects a read with `code: 'permission-denied'` when the rules have
 * not been deployed, which is worth saying out loud rather than blaming the
 * connection. Narrowed by hand because a caught value is `unknown`.
 */
function errorCode(error: unknown): string | undefined {
	if (typeof error === 'object' && error !== null && 'code' in error) {
		return String((error as { code: unknown }).code);
	}
	return undefined;
}

export default function HomeScreen() {
	const [styles, Palette] = useStyles(makeStyles);
	const [devotees, setDevotees] = useState<RosterRow[]>([]);
	const [isLoading, setIsLoading] = useState(true);
	const [loadError, setLoadError] = useState<string | null>(null);
	const [selectedMonth, setSelectedMonth] = useState(() => new Date());

	// Captured once so "today" cannot shift mid-render and change what counts as
	// an elapsed day partway down the list.
	const now = useMemo(() => new Date(), []);
	const quote = useMemo(() => quoteOfTheDay(now), [now]);

	/*
	 * ONE query for the whole roster.
	 *
	 * This used to be sixteen parallel requests, each returning that devotee's
	 * entire history - roughly 690 documents read to render sixteen numbers. The
	 * flat `days` collection with a sortable date key makes it a single range scan
	 * over one month instead.
	 */
	const loadDevotees = useCallback(async () => {
		try {
			const byDevotee = await listMonth(selectedMonth);
			const todayKey = toDateKey(now);

			const rows = devoteesData.map((devotee) => {
				const records = byDevotee[String(devotee.id)] ?? [];
				const month = buildPeriodStats(records, selectedMonth, 'month', now);

				return {
					...devotee,
					daysLogged: month.completion.logged,
					elapsedDays: month.completion.elapsed,
					loggedToday: isDayComplete(indexByDate(records)[todayKey]),
					// The same formatted metrics the Week tab uses, so the expanded
					// preview cannot disagree with the detail screen.
					metrics: month.metricByKey,
				};
			});

			return { rows, error: null };
		} catch (error) {
			console.error('Could not load the roster', error);
			/*
			 * A failed read used to return an empty list, which then read as a month
			 * nobody had logged - blaming the devotees for a problem that was ours.
			 * "No data" and "could not read" are different states, and only the
			 * second one still gets a message.
			 */
			return {
				rows: null,
				error:
					errorCode(error) === 'permission-denied'
						? "This app can't read the sadhana database yet — its access rules need deploying."
						: 'Could not load the roster. Check your connection and try again.',
			};
		}
	}, [selectedMonth, now]);

	/*
	 * Loads for the selected month, and ignores its own result if the month moved
	 * on before the read came back. Without the guard, paging quickly could paint
	 * an older month's numbers over a newer request.
	 *
	 * The spinner is raised by the month buttons rather than here: a setState in
	 * the effect body runs synchronously on every render pass and is the pattern
	 * react-hooks/set-state-in-effect exists to catch.
	 */
	useEffect(() => {
		let cancelled = false;
		loadDevotees().then(({ rows, error }) => {
			if (cancelled) return;
			setDevotees(rows ?? []);
			setLoadError(error);
			setIsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [loadDevotees]);

	// Re-runs the effect by nudging the month through its own setter.
	const fetchAgain = () => {
		setIsLoading(true);
		setLoadError(null);
		setSelectedMonth((month) => new Date(month.getTime()));
	};

	const changeMonth = (delta: number) => {
		setIsLoading(true);
		setSelectedMonth((month) => addMonths(month, delta));
	};

	const canGoForward = !isAfter(addMonths(selectedMonth, 1), now);

	const renderHeader = () => (
		<View style={styles.header}>
			<View style={styles.brandRow}>
				<Image source={require('../../assets/images/logo.png')} style={styles.logo} />
				<View style={styles.brandText}>
					<Text style={styles.brandKicker}>IYF Devotees</Text>
					<Text style={styles.brandTitle}>Sadhana</Text>
				</View>
				<Image source={require('../../assets/images/spImg.png')} style={styles.spImage} />
			</View>

			{/* One of 26, chosen by the date, so the whole group reads the same verse
			    on the same morning. It used to be a single hardcoded line. */}
			<View style={styles.quoteCard}>
				<Text style={styles.quoteText}>{quote.quote}</Text>
				<Text style={styles.quoteRef}>— {quote.reference}</Text>
			</View>

			<View style={styles.monthRow}>
				<Pressable
					onPress={() => changeMonth(-1)}
					hitSlop={8}
					style={styles.monthArrow}
					accessibilityRole="button"
					accessibilityLabel="Previous month"
				>
					<ChevronLeft size={20} color={Palette.accentStrong} />
				</Pressable>
				<Text style={styles.monthLabel}>{format(selectedMonth, 'MMMM yyyy')}</Text>
				<Pressable
					onPress={() => changeMonth(1)}
					disabled={!canGoForward}
					hitSlop={8}
					style={[styles.monthArrow, !canGoForward && styles.monthArrowOff]}
					accessibilityRole="button"
					accessibilityState={{ disabled: !canGoForward }}
					accessibilityLabel="Next month"
				>
					<ChevronRight size={20} color={canGoForward ? Palette.accentStrong : Palette.future} />
				</Pressable>
			</View>

			{loadError ? (
				<View style={styles.errorNote}>
					<Text style={styles.errorTitle}>{loadError}</Text>
					<Pressable
						onPress={fetchAgain}
						style={({ pressed }) => [styles.retry, pressed && styles.retryPressed]}
						accessibilityRole="button"
					>
						<Text style={styles.retryText}>Try again</Text>
					</Pressable>
				</View>
			) : null}
		</View>
	);

	return (
		<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
			{isLoading ? (
				<View style={styles.loading}>
					<ActivityIndicator size="large" color={Palette.accent} />
				</View>
			) : (
				<FlatList
					data={devotees}
					keyExtractor={(item) => item.id.toString()}
					ListHeaderComponent={renderHeader}
					renderItem={({ item }) => (
						<DevoteeListItem
							devotee={item}
							daysLogged={item.daysLogged}
							elapsedDays={item.elapsedDays}
							loggedToday={item.loggedToday}
							metrics={item.metrics}
						/>
					)}
					contentContainerStyle={styles.listContent}
				/>
			)}
		</SafeAreaView>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		safeArea: { flex: 1, backgroundColor: Palette.canvas },
		loading: { flex: 1, alignItems: 'center', justifyContent: 'center' },
		listContent: { paddingBottom: Space.xl },

		header: { paddingHorizontal: Space.lg, paddingTop: Space.md },
		brandRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			gap: Space.md,
		},
		logo: { width: 40, height: 40, resizeMode: 'contain' },
		spImage: { width: 40, height: 40, resizeMode: 'contain', borderRadius: 20 },
		brandText: { flex: 1, alignItems: 'center' },
		brandKicker: {
			...Type.micro,
			color: Palette.textMuted,
			letterSpacing: 1,
			textTransform: 'uppercase',
		},
		brandTitle: { fontSize: 20, fontWeight: '700', color: Palette.textPrimary },

		quoteCard: {
			marginTop: Space.md,
			padding: Space.md,
			borderRadius: Radius.md,
			backgroundColor: Palette.surface,
			borderWidth: 1,
			borderColor: Palette.border,
			borderLeftWidth: 3,
			borderLeftColor: Palette.accent,
		},
		quoteText: {
			fontSize: 12,
			lineHeight: 18,
			fontStyle: 'italic',
			color: Palette.textSecondary,
		},
		quoteRef: { fontSize: 10, color: Palette.textMuted, marginTop: 5 },

		monthRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginTop: Space.md,
			marginBottom: Space.sm,
		},
		monthArrow: {
			width: HIT_SIZE,
			height: HIT_SIZE,
			alignItems: 'center',
			justifyContent: 'center',
		},
		monthArrowOff: { opacity: 0.5 },
		monthLabel: { ...Type.title, color: Palette.textPrimary },

		errorNote: {
			paddingVertical: Space.lg,
			paddingHorizontal: Space.md,
			borderRadius: Radius.md,
			backgroundColor: Palette.badWash,
			borderWidth: 1,
			borderColor: Palette.bad,
			marginBottom: Space.sm,
			alignItems: 'center',
			gap: Space.sm,
		},
		errorTitle: {
			...Type.bodyStrong,
			color: Palette.bad,
			textAlign: 'center',
		},
		retry: {
			paddingVertical: Space.sm,
			paddingHorizontal: Space.lg,
			borderRadius: Radius.sm,
			borderWidth: 1,
			borderColor: Palette.bad,
		},
		retryPressed: { opacity: 0.7 },
		retryText: { ...Type.bodyStrong, color: Palette.bad },
	});
