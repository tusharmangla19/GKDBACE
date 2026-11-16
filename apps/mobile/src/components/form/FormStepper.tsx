import React, { useRef } from 'react';
import { View, Text, Pressable, StyleSheet, TextInput, Platform } from 'react-native';
import type { DayValue } from '@iyf/domain';
import { Radius, Space, Type, HIT_SIZE, type PaletteShape } from '@/constants/palette';
import { useStyles } from '@/hooks/useStyles';
import type { FieldFocus } from '@/hooks/useFormFocus';

/**
 * +/- with a directly editable number.
 *
 * ZERO IS A REAL READING. Day Rest Time of 0 means no daytime sleep, which is
 * information, not a missing entry - so these fields start at 0, show 0, and save
 * 0. The trade-off is deliberate and worth knowing: a day saved without touching
 * a field records 0 for it, and that 0 counts in the averages.
 *
 * Tapping the number OR its unit suffix focuses the input, so large values can be
 * typed instead of tapped up.
 */
interface FormStepperProps {
	/** Tolerant of the legacy string forms; always emits a number. */
	value: DayValue | undefined;
	onChange: (_value: number) => void;
	step?: number;
	min?: number;
	max?: number;
	suffix?: string;
	label?: string;
	/** The vow, if the field has one - the value turns green once it is met. */
	target?: number | null;
	/** Joins the Next-key chain. Absent outside the entry form. */
	focus?: FieldFocus;
}

export default function FormStepper({
	value,
	onChange,
	step = 1,
	min = 0,
	max = 999,
	suffix = '',
	label,
	target = null,
	focus,
}: FormStepperProps) {
	const [styles] = useStyles(makeStyles);
	const inputRef = useRef<TextInput>(null);
	const boxId = focus?.ids[0];
	const advances = !!boxId && !focus.isLast(boxId);

	// A numeric field is never really unset - 0 is a valid reading - so an absent
	// value shows as the minimum rather than as a placeholder.
	const parsed = value === null || value === undefined || value === '' ? min : Number(value);
	const safeValue = Number.isNaN(parsed) ? min : parsed;

	// Emits a NUMBER. The record stores real types now, so there is nothing to
	// stringify on the way out.
	const commit = (next: number) => onChange(Math.min(Math.max(next, min), max));

	const handleMinus = () => commit(safeValue - step);
	const handlePlus = () => commit(safeValue + step);

	const handleText = (text: string) => {
		const digits = text.replace(/[^0-9]/g, '');
		// Clearing the box means zero, not "unset".
		commit(digits === '' ? min : parseInt(digits, 10));
	};

	const hitTarget = target != null && safeValue >= target;

	return (
		<View style={styles.container}>
			<Pressable
				onPress={handleMinus}
				hitSlop={6}
				style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
				accessibilityRole="button"
				accessibilityLabel={`Decrease ${label || 'value'} by ${step}`}
			>
				<Text style={styles.buttonText}>−</Text>
			</Pressable>

			<Pressable
				style={styles.valueContainer}
				onPress={() => inputRef.current?.focus()}
				accessibilityLabel={`${label || 'Value'}, ${safeValue} ${suffix}. Tap to type`}
			>
				<TextInput
					ref={(node) => {
						inputRef.current = node;
						if (boxId) focus.register(boxId, node);
					}}
					style={[styles.valueInput, hitTarget && styles.valueOnTarget]}
					value={String(safeValue)}
					onChangeText={handleText}
					keyboardType="number-pad"
					inputMode="numeric"
					accessibilityLabel={label || 'Value'}
					selectTextOnFocus
					maxLength={4}
					returnKeyType={advances ? 'next' : 'done'}
					// "submit" fires onSubmitEditing WITHOUT blurring, so the keyboard
					// stays up across the hop. The default blurs first, which drops it
					// and bounces the layout on every field.
					submitBehavior={advances ? 'submit' : 'blurAndSubmit'}
					onSubmitEditing={() => boxId && focus.next(boxId)}
				/>
				{suffix ? (
					<Text style={[styles.suffixText, hitTarget && styles.valueOnTarget]}>{suffix}</Text>
				) : null}
			</Pressable>

			<Pressable
				onPress={handlePlus}
				hitSlop={6}
				style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
				accessibilityRole="button"
				accessibilityLabel={`Increase ${label || 'value'} by ${step}`}
			>
				<Text style={styles.buttonText}>+</Text>
			</Pressable>
		</View>
	);
}

const makeStyles = (Palette: PaletteShape) =>
	StyleSheet.create({
		container: {
			flexDirection: 'row',
			alignItems: 'center',
			gap: Space.sm,
		},
		button: {
			width: HIT_SIZE,
			height: HIT_SIZE,
			borderRadius: Radius.pill,
			backgroundColor: Palette.surfaceSunken,
			alignItems: 'center',
			justifyContent: 'center',
		},
		buttonPressed: {
			backgroundColor: Palette.accentWash,
		},
		buttonText: {
			fontSize: 20,
			lineHeight: 22,
			color: Palette.textPrimary,
			fontWeight: '600',
		},
		// Snug, but wide enough that the +/- buttons still line up down the form.
		// "min" is the widest common suffix; Japa's "rounds" is allowed to push a
		// couple of pixels past rather than padding every other row to match it.
		valueContainer: {
			minWidth: 60,
			minHeight: HIT_SIZE,
			flexDirection: 'row',
			alignItems: 'center',
			justifyContent: 'center',
			gap: 3,
		},
		valueInput: {
			...Type.bodyStrong,
			...(Platform.OS === 'web' && { fontSize: 16, width: 40 }),
			color: Palette.textPrimary,
			padding: 0,
			textAlign: 'center',
			// Fits the widest value in the schema (Seva / Day Rest go to 1440).
			minWidth: 28,
		},
		valueOnTarget: {
			color: Palette.good,
		},
		suffixText: {
			...Type.caption,
			color: Palette.textSecondary,
			fontWeight: '600',
		},
	});
