import React, { useMemo } from 'react';
import {
	View,
	Text,
	StyleSheet,
	ScrollView,
	Pressable,
	ActivityIndicator,
	KeyboardAvoidingView,
	Platform,
} from 'react-native';
import { format, isSameDay } from 'date-fns';
import { CircleCheck, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react-native';
import DayStrip from '@/components/sadhana/DayStrip';
import FieldIcon from '@/components/FieldIcon';
import FormStepper from '@/components/form/FormStepper';
import FormToggle from '@/components/form/FormToggle';
import FormTimeInput from '@/components/form/FormTimeInput';
import {
	ENTRY_REQUIRED_FIELDS,
	FIELD_GROUPS,
	fieldLabel,
	isUnset,
	morningProgramSchema,
	type DayDraft,
	type DayRecord,
	type DayValue,
	type FieldKey,
	type PeriodDay,
	type SadhanaField,
} from '@iyf/domain';
import { Radius, Space, Type, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';
import { useFormFocus } from '@/hooks/useFormFocus';

/**
 * Daily entry. The form is generated entirely from @iyf/domain, so a field
 * cannot be silently dropped (Mangala Arti and 16th Round were missing from the
 * summary views) and its unit cannot disagree with what the summary displays.
 */
/** The day autofill copies from: the most recent one with anything logged. */
export interface AutofillSource {
	date: Date;
	record: DayRecord;
}

interface TodayViewProps {
	/** The week the day strip shows. */
	days: readonly PeriodDay[];
	selectedDate: Date;
	formData: DayDraft;
	onFieldChange: (_key: FieldKey, _value: DayValue) => void;
	onSelectDay: (_day: PeriodDay) => void;
	onSave: () => void;
	isSaving: boolean;
	isDirty: boolean;
	onAutofill: () => void;
	/** Null when there is no earlier day to copy. */
	autofillSource: AutofillSource | null;
	weekLabel: string;
	onShiftWeek: (_direction: number) => void;
	canGoForward: boolean;
}

export default function TodayView({
	days,
	selectedDate,
	formData,
	onFieldChange,
	onSelectDay,
	onSave,
	isSaving,
	isDirty,
	onAutofill,
	autofillSource,
	weekLabel,
	onShiftWeek,
	canGoForward,
}: TodayViewProps) {
	const [styles, Palette] = useStyles(makeStyles);
	// Only fields that need an explicit answer can be outstanding: a numeric field
	// sitting at 0 is answered rather than skipped, and "16th Round" is optional -
	// enterable by anyone, required of no one.
	const outstanding = useMemo(
		() => ENTRY_REQUIRED_FIELDS.filter((field) => isUnset(formData[field.key])),
		[formData]
	);
	const required = ENTRY_REQUIRED_FIELDS.length;
	const answered = required - outstanding.length;
	const complete = outstanding.length === 0;
	const isTodayDate = isSameDay(selectedDate, new Date());
	const hasSavedRecord = !!days.find((day) => isSameDay(day.date, selectedDate))?.record;
	const isEmptyDay = answered === 0;

	// Both constants come from @iyf/domain at module scope, so this is the same
	// list every render - which is what keeps the focus order below stable.
	const groups = useMemo(
		() =>
			FIELD_GROUPS.map((group) => ({
				...group,
				fields: morningProgramSchema.filter((f) => f.group === group.key),
			})).filter((g) => g.fields.length),
		[]
	);

	// The Next key walks the form in exactly this order, so it is derived from the
	// same grouping the fields render from rather than from the schema.
	const orderedFields = useMemo(() => groups.flatMap((g) => g.fields), [groups]);
	const focusFor = useFormFocus(orderedFields);

	const renderInput = (field: SadhanaField) => {
		// Typed now: a number, a "HH:MM" string, or a boolean. null means unset.
		const value = formData[field.key] ?? null;

		if (field.input === 'time') {
			return (
				<FormTimeInput
					value={value}
					label={field.label}
					focus={focusFor(field)}
					onChange={(next: string | null) => onFieldChange(field.key, next)}
				/>
			);
		}
		if (field.input === 'toggle') {
			return (
				<FormToggle
					value={typeof value === 'boolean' ? value : null}
					label={field.label}
					onChange={(next: boolean) => onFieldChange(field.key, next)}
				/>
			);
		}
		return (
			<FormStepper
				value={value}
				step={field.step ?? 1}
				max={field.max ?? 999}
				suffix={field.unit === 'min' ? 'min' : field.unit === 'rounds' ? 'rounds' : ''}
				label={field.label}
				target={field.target}
				focus={focusFor(field)}
				onChange={(next: number) => onFieldChange(field.key, next)}
			/>
		);
	};

	/*
	 * The form is twelve fields tall and the number pad covers roughly the bottom
	 * third, so tapping Wake Up or anything in Rest & Rhythm used to hide the very
	 * field being edited.
	 *
	 * Two mechanisms, one per platform, because applying both would lift the field
	 * twice:
	 *
	 *   iOS      the ScrollView's own keyboard insets. Native, and it also scrolls
	 *            the focused field into view rather than only making room.
	 *   Android  KeyboardAvoidingView. `edgeToEdgeEnabled=true` (the default since
	 *            SDK 54) means the window no longer resizes for the keyboard, so
	 *            the `adjustResize` in AndroidManifest.xml cannot lift the field on
	 *            its own and something in JS has to.
	 *
	 * `behavior` must be "padding" rather than "height" here: under edge-to-edge,
	 * "height" fights the insets and leaves a gap where the navigation bar was.
	 */
	return (
		<KeyboardAvoidingView
			style={styles.keyboardView}
			behavior={Platform.OS === 'android' ? 'padding' : undefined}
		>
			<ScrollView
				style={styles.scroll}
				contentContainerStyle={styles.content}
				keyboardShouldPersistTaps="handled"
				// iOS only; ignored on Android, where the view above does the work.
				automaticallyAdjustKeyboardInsets
			>
				<View style={styles.stripCard}>
					<View style={styles.stripHeader}>
						<Pressable
							onPress={() => onShiftWeek(-1)}
							hitSlop={8}
							style={({ pressed }) => [styles.stripArrow, pressed && styles.stripArrowPressed]}
							accessibilityRole="button"
							accessibilityLabel="Previous week"
						>
							<ChevronLeft size={20} color={Palette.accentStrong} />
						</Pressable>
						<Text style={styles.stripLabel}>{weekLabel}</Text>
						<Pressable
							onPress={() => onShiftWeek(1)}
							disabled={!canGoForward}
							hitSlop={8}
							style={({ pressed }) => [
								styles.stripArrow,
								pressed && canGoForward && styles.stripArrowPressed,
								!canGoForward && styles.stripArrowDisabled,
							]}
							accessibilityRole="button"
							accessibilityState={{ disabled: !canGoForward }}
							accessibilityLabel="Next week"
						>
							<ChevronRight
								size={20}
								color={canGoForward ? Palette.accentStrong : Palette.future}
							/>
						</Pressable>
					</View>
					{/* No legend here: this strip is for navigating days. The Week tab
				    explains what each marker means. */}
					<DayStrip
						days={days}
						selectedDate={selectedDate}
						onSelectDay={onSelectDay}
						showLegend={false}
					/>
				</View>

				<View style={styles.card}>
					<View style={styles.cardHeader}>
						<View style={styles.cardHeaderText}>
							<Text style={styles.cardTitle}>
								{isTodayDate ? 'Today' : format(selectedDate, 'EEEE')}
							</Text>
							<Text style={styles.cardDate}>{format(selectedDate, 'd MMMM yyyy')}</Text>
						</View>

						{complete ? (
							<View style={styles.completeBadge}>
								<CircleCheck size={15} color={Palette.good} />
								<Text style={styles.completeBadgeText}>Ready to save</Text>
							</View>
						) : (
							<Text style={styles.progressText}>{outstanding.length} still to set</Text>
						)}
					</View>

					<View style={styles.progressTrack}>
						<View
							style={[
								styles.progressFill,
								complete && styles.progressFillDone,
								{ width: `${(answered / required) * 100}%` },
							]}
						/>
					</View>

					{isEmptyDay && autofillSource ? (
						<Pressable
							onPress={onAutofill}
							style={({ pressed }) => [styles.autofill, pressed && styles.autofillPressed]}
							accessibilityRole="button"
							accessibilityLabel={`Copy your entry from ${format(autofillSource.date, 'EEEE d MMMM')}`}
						>
							<Sparkles size={15} color={Palette.accentText} />
							<Text style={styles.autofillText}>
								Copy {format(autofillSource.date, 'EEE d MMM')}, then adjust
							</Text>
						</Pressable>
					) : null}

					{groups.map((group) => (
						<View key={group.key} style={styles.group}>
							<Text style={styles.groupLabel}>{group.label}</Text>
							{group.fields.map((field) => (
								<View key={field.key} style={styles.fieldRow}>
									<View style={styles.fieldLabelWrap}>
										<FieldIcon
											name={field.icon}
											size={17}
											color={outstanding.includes(field) ? Palette.open : Palette.textSecondary}
										/>
										{/* "16th Round" reads as "Japa finished" below sixteen, where
								    that is the only honest name for it. */}
										<Text style={styles.fieldLabel}>{fieldLabel(field, formData)}</Text>
									</View>
									<View style={styles.fieldInput}>{renderInput(field)}</View>
								</View>
							))}
						</View>
					))}
				</View>

				<Pressable
					onPress={onSave}
					disabled={isSaving || !isDirty}
					style={({ pressed }) => [
						styles.saveButton,
						(!isDirty || isSaving) && styles.saveButtonDisabled,
						pressed && isDirty && styles.saveButtonPressed,
					]}
					accessibilityRole="button"
					accessibilityState={{ disabled: isSaving || !isDirty }}
				>
					{isSaving ? (
						<ActivityIndicator color={Palette.textOnAccent} />
					) : (
						<Text style={styles.saveButtonText}>
							{isDirty
								? `Save ${format(selectedDate, 'EEE d MMM')}`
								: hasSavedRecord
									? 'Saved'
									: 'Nothing to save yet'}
						</Text>
					)}
				</Pressable>
			</ScrollView>
		</KeyboardAvoidingView>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		keyboardView: { flex: 1 },
		scroll: { flex: 1 },
		content: {
			paddingHorizontal: Space.lg,
			paddingBottom: Space.xxl,
		},
		stripCard: {
			backgroundColor: Palette.surface,
			borderRadius: Radius.lg,
			borderWidth: 1,
			borderColor: Palette.border,
			padding: Space.md,
			marginTop: Space.md,
			marginBottom: Space.md,
		},
		stripHeader: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			marginBottom: Space.xs,
		},
		stripArrow: {
			width: 34,
			height: 34,
			alignItems: 'center',
			justifyContent: 'center',
			borderRadius: Radius.pill,
		},
		stripArrowPressed: {
			backgroundColor: Palette.accentWash,
		},
		stripArrowDisabled: {
			opacity: 0.5,
		},
		stripLabel: {
			...Type.micro,
			fontWeight: '700',
			color: Palette.textSecondary,
		},
		card: {
			backgroundColor: Palette.surface,
			borderRadius: Radius.lg,
			borderWidth: 1,
			borderColor: Palette.border,
			padding: Space.lg,
		},
		cardHeader: {
			flexDirection: 'row',
			alignItems: 'flex-start',
			justifyContent: 'space-between',
		},
		cardHeaderText: { flex: 1 },
		cardTitle: {
			...Type.title,
			color: Palette.textPrimary,
		},
		cardDate: {
			...Type.caption,
			color: Palette.textMuted,
			marginTop: 1,
		},
		progressText: {
			...Type.micro,
			color: Palette.textSecondary,
		},
		completeBadge: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: 5,
			backgroundColor: Palette.goodWash,
			paddingHorizontal: Space.sm,
			paddingVertical: 4,
			borderRadius: Radius.pill,
		},
		completeBadgeText: {
			fontSize: 11,
			fontWeight: '700',
			color: Palette.good,
		},
		progressTrack: {
			height: 4,
			borderRadius: 2,
			backgroundColor: Palette.track,
			marginTop: Space.md,
			overflow: 'hidden',
		},
		progressFill: {
			height: 4,
			borderRadius: 2,
			backgroundColor: Palette.accent,
		},
		progressFillDone: {
			backgroundColor: Palette.goodFill,
		},
		autofill: {
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
		autofillPressed: { opacity: 0.75 },
		autofillText: {
			...Type.bodyStrong,
			color: Palette.accentText,
		},
		group: {
			marginTop: Space.lg,
		},
		groupLabel: {
			...Type.micro,
			fontWeight: '700',
			color: Palette.accentText,
			marginBottom: Space.xs,
		},
		fieldRow: {
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'space-between',
			paddingVertical: Space.sm,
			borderTopWidth: 1,
			borderTopColor: Palette.border,
		},
		fieldLabelWrap: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: Space.sm,
			flexShrink: 1,
			paddingRight: Space.sm,
		},
		fieldLabel: {
			...Type.bodyStrong,
			fontWeight: '700',
			color: Palette.textPrimary,
		},

		fieldInput: {
			alignItems: 'flex-end',
		},
		saveButton: {
			backgroundColor: Palette.accentStrong,
			borderRadius: Radius.md,
			paddingVertical: Space.lg,
			alignItems: 'center',
			marginTop: Space.lg,
		},
		saveButtonDisabled: {
			backgroundColor: Palette.borderStrong,
		},
		saveButtonPressed: {
			opacity: 0.85,
		},
		saveButtonText: {
			...Type.title,
			color: Palette.textOnAccent,
		},
	});
