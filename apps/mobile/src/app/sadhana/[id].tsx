import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { ArrowLeft, CircleAlert, ChevronDown } from 'lucide-react-native';
import { format, subDays, addWeeks } from 'date-fns';
import {
	buildPeriod,
	buildPeriodStats,
	devoteesData,
	formatPeriodLabel,
	indexByDate,
	isDayStarted,
	emptyDay,
	morningProgramSchema,
	toDateKey,
	type DayDraft,
	type DayRecord,
	type DayValue,
	type FieldKey,
} from '@iyf/domain';
import { listDays, saveDay } from '@iyf/data';

import TodayView, { type AutofillSource } from '@/components/sadhana/TodayView';
import PeriodView from '@/components/sadhana/PeriodView';
import { Radius, Space, Type, HIT_SIZE, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';

type TabKey = 'today' | 'week' | 'month';

const TABS: readonly { key: TabKey; label: string }[] = [
	{ key: 'today', label: 'TODAY' },
	{ key: 'week', label: 'WEEK' },
	{ key: 'month', label: 'MONTH' },
];

/** One day's worth of form state: the schema's fields plus the day it is for. */
type FormState = DayDraft & { date: string };

/**
 * A fresh day. Numbers start at 0 because zero is a real reading - no seva, no
 * other lecture - and making the devotee type it was friction at 4am. Times and
 * booleans stay null: there is no sensible default wake-up time, and a defaulted
 * "no" would be a claim the devotee never made.
 *
 * No `timestamp` any more. That field existed only to give the year-less date
 * string something to sort by; the date key now carries its own year.
 */
const blankForm = (date: Date): FormState => ({ date: toDateKey(date), ...emptyDay() });

/**
 * The most recent day before `selectedDate` that has anything logged, or null.
 *
 * Walks back by date key, which is now sortable - so this could become a query.
 * Kept as a local walk because the days are already in memory.
 *
 * Lives outside the component deliberately. Inline in a useMemo, the early
 * returns inside the loop defeated the React Compiler's memoization analysis
 * (react-hooks/preserve-manual-memoization); as a plain call it is opaque to it.
 * Pure search logic has no business inside a component either.
 */
const findAutofillSource = (
	byDate: Record<string, DayRecord>,
	selectedDate: Date
): AutofillSource | null => {
	if (isDayStarted(byDate[toDateKey(selectedDate)])) return null;
	for (let back = 1; back <= 60; back += 1) {
		const day = subDays(selectedDate, back);
		const record = byDate[toDateKey(day)];
		if (isDayStarted(record)) return { date: day, record };
	}
	return null;
};

/**
 * Owns the data and the date, and hands both to whichever tab is showing.
 *
 * The subcollection is fetched ONCE per devotee and shared across Today / Week /
 * Month. Reads here are whole-subcollection (there is no month index in
 * Firestore), so refetching per tab switch would be the most expensive thing the
 * app does.
 *
 * There is exactly one date control per tab: the day strip on Today, the pager on
 * Week and Month. The old header month dropdown competed with both and could
 * disagree with the pager the moment a week straddled a month boundary.
 */
export default function SadhanaDetailScreen() {
	const [styles, Palette] = useStyles(makeStyles);
	const { id } = useLocalSearchParams();
	const router = useRouter();
	const devoteeId = String(id);
	const devotee = devoteesData.find((d) => d.id.toString() === devoteeId);

	const [activeTab, setActiveTab] = useState<TabKey>('today');
	const [anchor, setAnchor] = useState(() => new Date());
	const [selectedDate, setSelectedDate] = useState(() => new Date());
	const [records, setRecords] = useState<DayRecord[]>([]);
	const [formData, setFormData] = useState(() => blankForm(new Date()));
	const [baseline, setBaseline] = useState(() => blankForm(new Date()));
	const [isLoading, setIsLoading] = useState(true);
	const [isSaving, setIsSaving] = useState(false);
	const [notice, setNotice] = useState<string | null>(null);
	const [loadError, setLoadError] = useState<string | null>(null);
	// Bumped by retryLoad. The load effect has no other dependency that changes
	// on a retry - the devotee and the reader are both the same - so without
	// this the spinner comes back on and no read is ever issued.
	const [reloadToken, setReloadToken] = useState(0);
	const noticeTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

	// `now` is captured once per mount so "today" cannot shift mid-render and
	// change what counts as an elapsed day halfway down the screen.
	const now = useMemo(() => new Date(), []);

	const byDate = useMemo(() => indexByDate(records), [records]);

	const loadRecords = useCallback(async () => {
		try {
			return { rows: await listDays(devoteeId), error: null };
		} catch (error) {
			console.error('Failed to load sadhana records', error);
			return {
				rows: [],
				error: 'Could not load your sadhana. Check your connection and try again.',
			};
		}
	}, [devoteeId]);

	// Result is discarded if the devotee changed while the read was in flight.
	// Nothing is set synchronously here: a setState in an effect body runs on
	// every render pass, which is what react-hooks/set-state-in-effect catches.
	useEffect(() => {
		if (!devotee) return undefined;
		let cancelled = false;
		void reloadToken;
		loadRecords().then(({ rows, error }) => {
			if (cancelled) return;
			setRecords(rows);
			setLoadError(error);
			setIsLoading(false);
		});
		return () => {
			cancelled = true;
		};
	}, [devotee, loadRecords, reloadToken]);

	const retryLoad = () => {
		setIsLoading(true);
		setLoadError(null);
		setRecords([]);
		setReloadToken((token) => token + 1);
	};

	/*
	 * The form is a copy of one day's record that the devotee can edit, so it has
	 * to reload when the day changes or when fresh records arrive.
	 *
	 * Adjusted during render rather than in an effect. In an effect the previous
	 * day's values paint for a frame before being replaced, and a stray keystroke
	 * in that window would be written against the wrong date. `syncedFor` makes
	 * the reload run once per change instead of on every render.
	 */
	const dayKey = toDateKey(selectedDate);
	const dayRecord = byDate[dayKey] ?? null;
	const [syncedFor, setSyncedFor] = useState<{ key: string | null; record: DayRecord | null }>({
		key: null,
		record: null,
	});

	if (syncedFor.key !== dayKey || syncedFor.record !== dayRecord) {
		const next = dayRecord
			? { ...blankForm(selectedDate), ...dayRecord, date: dayKey }
			: blankForm(selectedDate);
		setSyncedFor({ key: dayKey, record: dayRecord });
		setFormData(next);
		setBaseline(next);
	}

	useEffect(() => () => clearTimeout(noticeTimer.current), []);

	const flashNotice = (message: string) => {
		setNotice(message);
		clearTimeout(noticeTimer.current);
		noticeTimer.current = setTimeout(() => setNotice(null), 2600);
	};

	const isDirty = useMemo(
		() => morningProgramSchema.some((field) => formData[field.key] !== baseline[field.key]),
		[formData, baseline]
	);

	// Values are stored typed now, so the form holds numbers, booleans and
	// "HH:MM" strings rather than stringifying everything on the way in.
	const handleFieldChange = (fieldKey: FieldKey, value: DayValue) => {
		setFormData((prev) => ({ ...prev, [fieldKey]: value }));
	};

	const handleSave = async () => {
		setIsSaving(true);
		try {
			// The repository owns the upsert, the field whitelist and the id scheme.
			// `records` is passed so the existing-day lookup costs no extra read.
			const saved = await saveDay(devoteeId, formData);

			setRecords((prev) => {
				const index = prev.findIndex((r) => r.date === saved.date);
				if (index === -1) return [...prev, saved];
				const copy = [...prev];
				copy[index] = { ...copy[index], ...saved };
				return copy;
			});
			setBaseline({ ...formData });
			flashNotice(`Saved ${format(selectedDate, 'EEE d MMM')}`);
		} catch (error) {
			console.error('Failed to save sadhana', error);
			flashNotice('Could not save. Your entry is still here — try again.');
		} finally {
			setIsSaving(false);
		}
	};

	const autofillSource = useMemo(
		() => findAutofillSource(byDate, selectedDate),
		[byDate, selectedDate]
	);

	const handleAutofill = () => {
		if (!autofillSource) return;
		const key = toDateKey(selectedDate);
		const next = { ...blankForm(selectedDate) };
		morningProgramSchema.forEach((field) => {
			next[field.key] = autofillSource.record[field.key] ?? null;
		});
		next.date = key;
		setFormData(next);
		flashNotice(`Copied ${format(autofillSource.date, 'EEE d MMM')} — adjust and save`);
	};

	const openDay = (date: Date) => {
		setSelectedDate(date);
		setAnchor(date);
		setActiveTab('today');
	};

	const weekStats = useMemo(
		() => buildPeriodStats(records, selectedDate, 'week', now),
		[records, selectedDate, now]
	);

	// The day strip is the date control on the Today tab, so it has to be able to
	// reach last week's open days.
	const shiftWeek = (direction: number) => setSelectedDate((prev) => addWeeks(prev, direction));

	// The month label in the header always follows whatever period is on screen.
	const headerMonth = activeTab === 'today' ? selectedDate : anchor;
	const canPageWeekForward = !buildPeriod(addWeeks(selectedDate, 1), 'week', now).days.every(
		(day) => day > now
	);

	if (!devotee) {
		return (
			<SafeAreaView style={styles.safeArea}>
				<View style={styles.centered}>
					<CircleAlert size={28} color={Palette.textMuted} />
					<Text style={styles.emptyTitle}>Devotee not found</Text>
					<Pressable onPress={() => router.back()} style={styles.backLink}>
						<Text style={styles.backLinkText}>Go back</Text>
					</Pressable>
				</View>
			</SafeAreaView>
		);
	}

	return (
		<SafeAreaView style={styles.safeArea} edges={['top', 'left', 'right', 'bottom']}>
			<View style={styles.header}>
				<Pressable
					onPress={() => router.back()}
					hitSlop={8}
					style={styles.backButton}
					accessibilityRole="button"
					accessibilityLabel="Go back"
				>
					<ArrowLeft size={22} color={Palette.textPrimary} />
				</Pressable>

				<View style={styles.avatar}>
					<Text style={styles.avatarText}>{devotee.name.charAt(0)}</Text>
				</View>

				<View style={styles.headerText}>
					<Text style={styles.headerName} numberOfLines={1}>
						{devotee.name}
					</Text>
					<Text style={styles.headerSub}>Personal Sadhana</Text>
				</View>

				{/* Shows the month of whatever period is in view, and opens the Month
				    tab on it - derived state, so it can never disagree with the pager
				    the way a second independent month picker did. */}
				<Pressable
					onPress={() => setActiveTab('month')}
					hitSlop={8}
					style={({ pressed }) => [styles.monthChip, pressed && styles.monthChipPressed]}
					accessibilityRole="button"
					accessibilityLabel={`${format(headerMonth, 'MMMM yyyy')}. Open the month view`}
				>
					<Text style={styles.monthChipText}>{format(headerMonth, 'MMM yyyy')}</Text>
					<ChevronDown size={15} color={Palette.textSecondary} />
				</Pressable>
			</View>

			<View style={styles.tabs}>
				{TABS.map((tab) => {
					const active = tab.key === activeTab;
					return (
						<Pressable
							key={tab.key}
							onPress={() => setActiveTab(tab.key)}
							style={[styles.tab, active && styles.tabActive]}
							accessibilityRole="tab"
							accessibilityState={{ selected: active }}
						>
							<Text style={active ? styles.tabTextActive : styles.tabText}>{tab.label}</Text>
						</Pressable>
					);
				})}
			</View>

			{notice ? (
				<View style={styles.notice} accessibilityLiveRegion="polite">
					<Text style={styles.noticeText}>{notice}</Text>
				</View>
			) : null}

			{isLoading ? (
				<View style={styles.centered}>
					<ActivityIndicator size="large" color={Palette.accent} />
					<Text style={styles.loadingText}>Loading your sadhana…</Text>
				</View>
			) : loadError ? (
				<View style={styles.centered}>
					<CircleAlert size={26} color={Palette.bad} />
					<Text style={styles.emptyTitle}>{loadError}</Text>
					<Pressable onPress={retryLoad} style={styles.backLink} accessibilityRole="button">
						<Text style={styles.backLinkText}>Try again</Text>
					</Pressable>
				</View>
			) : activeTab === 'today' ? (
				<TodayView
					days={weekStats.days}
					weekLabel={formatPeriodLabel(weekStats.period)}
					selectedDate={selectedDate}
					formData={formData}
					onFieldChange={handleFieldChange}
					onSelectDay={(day) => setSelectedDate(day.date)}
					onSave={handleSave}
					isSaving={isSaving}
					isDirty={isDirty}
					onAutofill={handleAutofill}
					autofillSource={autofillSource}
					onShiftWeek={shiftWeek}
					canGoForward={canPageWeekForward}
				/>
			) : (
				<PeriodView
					unit={activeTab}
					records={records}
					anchor={anchor}
					onAnchorChange={setAnchor}
					onOpenDay={openDay}
					now={now}
				/>
			)}
		</SafeAreaView>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		safeArea: {
			flex: 1,
			backgroundColor: Palette.canvas,
		},
		header: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingHorizontal: Space.md,
			paddingVertical: Space.md,
			backgroundColor: Palette.surface,
			gap: Space.sm,
		},
		backButton: {
			width: HIT_SIZE,
			height: HIT_SIZE,
			alignItems: 'center',
			justifyContent: 'center',
			marginLeft: -Space.sm,
		},
		headerText: {
			flex: 1,
		},
		headerName: {
			...Type.title,
			color: Palette.textPrimary,
		},
		headerSub: {
			...Type.caption,
			color: Palette.textMuted,
			marginTop: 1,
		},
		monthChip: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 4,
			paddingVertical: 6,
			paddingHorizontal: Space.sm,
			borderRadius: Radius.sm,
		},
		monthChipPressed: {
			backgroundColor: Palette.surfaceSunken,
		},
		monthChipText: {
			...Type.bodyStrong,
			color: Palette.textPrimary,
		},
		avatar: {
			width: 36,
			height: 36,
			borderRadius: 18,
			backgroundColor: Palette.surfaceSunken,
			alignItems: 'center',
			justifyContent: 'center',
		},
		avatarText: {
			...Type.bodyStrong,
			color: Palette.textSecondary,
		},
		tabs: {
			flexDirection: 'row',
			backgroundColor: Palette.surface,
			borderBottomWidth: 1,
			borderBottomColor: Palette.border,
			paddingHorizontal: Space.md,
		},
		tab: {
			flex: 1,
			alignItems: 'center',
			paddingVertical: Space.md,
			borderBottomWidth: 2,
			borderBottomColor: 'transparent',
		},
		tabActive: {
			borderBottomColor: Palette.accent,
		},
		tabText: {
			...Type.sectionLabel,
			color: Palette.textMuted,
		},
		tabTextActive: {
			...Type.sectionLabel,
			color: Palette.accentText,
		},
		notice: {
			backgroundColor: Palette.accentWash,
			paddingVertical: Space.sm,
			paddingHorizontal: Space.lg,
			borderBottomWidth: 1,
			borderBottomColor: Palette.accent,
		},
		noticeText: {
			...Type.caption,
			color: Palette.accentText,
			fontWeight: '600',
			textAlign: 'center',
		},
		centered: {
			flex: 1,
			alignItems: 'center',
			justifyContent: 'center',
			padding: Space.xl,
			gap: Space.md,
		},
		loadingText: {
			...Type.caption,
			color: Palette.textMuted,
		},
		emptyTitle: {
			...Type.bodyStrong,
			color: Palette.textPrimary,
			textAlign: 'center',
		},
		backLink: {
			paddingVertical: Space.sm,
			paddingHorizontal: Space.lg,
		},
		backLinkText: {
			...Type.bodyStrong,
			color: Palette.accentText,
		},
	});
