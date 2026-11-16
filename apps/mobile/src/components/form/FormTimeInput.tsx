import React, { useRef, useState } from 'react';
import { View, Text, TextInput, Pressable, StyleSheet, Platform } from 'react-native';
import { parseTimeToMinutes, minutesToWireTime, type DayValue } from '@iyf/domain';
import { type PaletteShape, Radius, Space, Type, HIT_SIZE } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';
import type { FieldFocus } from '@/hooks/useFormFocus';

type Meridiem = 'AM' | 'PM';

const MERIDIEMS: readonly Meridiem[] = ['AM', 'PM'];

/**
 * What the two boxes plus AM/PM currently mean, in minutes past midnight, or
 * null while they are not yet a time. An empty minute box is o'clock, not
 * "incomplete" - that is what lets "4" resolve to 4:00 on its own.
 */
function fieldsToMinutes(h: string, m: string, p: Meridiem): number | null {
	const hourNum = parseInt(h, 10);
	if (Number.isNaN(hourNum) || hourNum < 1 || hourNum > 12) return null;
	const minuteNum = m === '' ? 0 : parseInt(m, 10);
	if (Number.isNaN(minuteNum) || minuteNum > 59) return null;
	return ((hourNum % 12) + (p === 'PM' ? 12 : 0)) * 60 + minuteNum;
}

/**
 * Separate hour and minute fields, 12-hour entry, 24-hour storage.
 *
 * The single masked field this replaces forced a leading zero: waking at 4:00
 * meant typing "0400", because "400" was sliced into "40:0". Nobody types a
 * leading zero at 4am. Here you type 4, focus jumps to minutes on its own, you
 * type 0 or nothing, and it resolves to 4:00.
 *
 * Auto-advance rule: a first digit of 2-9 cannot begin a valid 12-hour hour, so
 * it commits immediately. A 1 waits, since 1, 10, 11 and 12 are all live.
 *
 * Storage stays "HH:MM" 24-hour - the wire format every time field is written
 * in, so a record means the same thing whatever wrote it. Reading is tolerant
 * ("22:30", "10:30 PM", "4:15 am"); writing is strict.
 */
interface FormTimeInputProps {
	/** "HH:MM" as stored, or null when the devotee has not set a time. */
	value: DayValue | undefined;
	onChange: (_value: string | null) => void;
	label?: string;
	/** Joins the Next-key chain. Absent outside the entry form. */
	focus?: FieldFocus;
}

export default function FormTimeInput({ value, onChange, label, focus }: FormTimeInputProps) {
	const [styles, Palette] = useStyles(makeStyles);
	// Two boxes, so two links in the chain: the hour's Next reaches its own
	// minutes, and only the minutes hand on to the next field.
	const hourId = focus?.ids[0];
	const minuteId = focus?.ids[1];
	const minuteAdvances = !!minuteId && !focus.isLast(minuteId);
	const [hour, setHour] = useState('');
	const [minute, setMinute] = useState('');
	const [period, setPeriod] = useState<Meridiem>('AM');
	const [syncedValue, setSyncedValue] = useState<DayValue | undefined>();
	const minuteRef = useRef<TextInput>(null);

	/*
	 * The two boxes are a 12-hour view of a 24-hour prop, so they have to resync
	 * when the prop changes - loading another day, or autofill.
	 *
	 * Adjusted during render rather than in an effect. An effect would paint the
	 * previous day's time for one frame and then correct it, and React treats
	 * setState-in-effect for derived state as an anti-pattern for exactly that
	 * reason. Comparing against the last value we synced makes it run once per
	 * change instead of every render.
	 */
	if (value !== syncedValue) {
		setSyncedValue(value);
		const mins = parseTimeToMinutes(value);
		if (mins === null) {
			setHour('');
			setMinute('');
		} else if (mins !== fieldsToMinutes(hour, minute, period)) {
			// Only overwrite when the prop is genuinely someone else's time. Our own
			// emit comes straight back as a prop change, and rewriting the boxes from
			// it filled the empty minute box with "00" - which, at maxLength 2 with no
			// selection left, silently swallowed every digit typed after the hour
			// auto-advanced. Typing 4 then 15 has to reach 4:15.
			const h24 = Math.floor(mins / 60);
			setHour(String(h24 % 12 || 12));
			setMinute(String(mins % 60).padStart(2, '0'));
			setPeriod(h24 >= 12 ? 'PM' : 'AM');
		}
	}

	const emit = (h: string, m: string, p: Meridiem) => {
		const mins = fieldsToMinutes(h, m, p);
		if (mins === null) return;
		onChange(minutesToWireTime(mins));
	};

	const handleHour = (text: string) => {
		const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
		setHour(digits);
		if (digits === '') {
			// null, not "": an empty box means not recorded.
			onChange(null);
			return;
		}
		if (parseInt(digits, 10) > 12) return; // wait for a correction
		// 2-9 can only ever be a single-digit hour, so move on without waiting.
		if (digits.length === 2 || parseInt(digits, 10) > 1) minuteRef.current?.focus();
		emit(digits, minute, period);
	};

	const handleMinute = (text: string) => {
		const digits = text.replace(/[^0-9]/g, '').slice(0, 2);
		if (digits !== '' && parseInt(digits, 10) > 59) return;
		setMinute(digits);
		emit(hour, digits, period);
	};

	// Pad on blur so "4:5" settles as 4:05 rather than staying ambiguous.
	const padMinute = () => {
		if (minute.length === 1) setMinute(minute.padStart(2, '0'));
		else if (minute === '' && hour !== '') setMinute('00');
	};

	const setPeriodAndEmit = (next: Meridiem) => {
		setPeriod(next);
		emit(hour, minute, next);
	};

	return (
		<View style={styles.container}>
			<View style={styles.fields}>
				<TextInput
					ref={(node) => {
						if (hourId) focus.register(hourId, node);
					}}
					style={styles.input}
					value={hour}
					onChangeText={handleHour}
					keyboardType="number-pad"
					inputMode="numeric"
					placeholder="--"
					placeholderTextColor={Palette.open}
					maxLength={2}
					selectTextOnFocus
					// An hour box always has its own minutes after it, so it never
					// reads "Done".
					returnKeyType="next"
					submitBehavior="submit"
					onSubmitEditing={() => hourId && focus.next(hourId)}
					accessibilityLabel={`${label || 'Time'} hour`}
				/>
				<Text style={styles.colon}>:</Text>
				<TextInput
					ref={(node) => {
						minuteRef.current = node;
						if (minuteId) focus.register(minuteId, node);
					}}
					style={styles.input}
					value={minute}
					onChangeText={handleMinute}
					onBlur={padMinute}
					keyboardType="number-pad"
					inputMode="numeric"
					placeholder="00"
					placeholderTextColor={Palette.open}
					maxLength={2}
					selectTextOnFocus
					returnKeyType={minuteAdvances ? 'next' : 'done'}
					submitBehavior={minuteAdvances ? 'submit' : 'blurAndSubmit'}
					onSubmitEditing={() => minuteId && focus.next(minuteId)}
					accessibilityLabel={`${label || 'Time'} minutes`}
				/>
			</View>

			<View style={styles.periodGroup}>
				{MERIDIEMS.map((option) => {
					const active = period === option;
					return (
						<Pressable
							key={option}
							onPress={() => setPeriodAndEmit(option)}
							hitSlop={6}
							style={({ pressed }) => [
								styles.periodButton,
								active && styles.periodButtonActive,
								pressed && styles.periodButtonPressed,
							]}
							accessibilityRole="button"
							accessibilityState={{ selected: active }}
							accessibilityLabel={option}
						>
							<Text style={[styles.periodText, active && styles.periodTextActive]}>{option}</Text>
						</Pressable>
					);
				})}
			</View>
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		container: {
			flexDirection: 'row',
			alignItems: 'center',
			borderWidth: 1,
			borderColor: Palette.border,
			borderRadius: Radius.sm,
			overflow: 'hidden',
			backgroundColor: Palette.surface,
			minHeight: 38,
		},
		fields: {
			flexDirection: 'row',
			alignItems: 'center',
			paddingHorizontal: Space.sm,
		},
		input: {
			...Type.bodyStrong,
			...(Platform.OS === 'web' && { fontSize: 16 }),
			color: Palette.textPrimary,
			paddingVertical: 7,
			width: 26,
			textAlign: 'center',
		},
		colon: {
			...Type.bodyStrong,
			color: Palette.textMuted,
			marginHorizontal: 1,
		},
		periodGroup: {
			flexDirection: 'row',
			borderLeftWidth: 1,
			borderLeftColor: Palette.border,
		},
		periodButton: {
			minWidth: 32,
			minHeight: HIT_SIZE,
			alignItems: 'center',
			justifyContent: 'center',
			backgroundColor: Palette.surfaceSunken,
		},
		periodButtonActive: {
			backgroundColor: Palette.accentWash,
		},
		periodButtonPressed: {
			opacity: 0.7,
		},
		periodText: {
			fontSize: 11,
			fontWeight: '600',
			color: Palette.textMuted,
		},
		periodTextActive: {
			color: Palette.accentText,
			fontWeight: '800',
		},
	});
