import { useCallback, useMemo, useRef } from 'react';
import type { TextInput } from 'react-native';
import type { FieldInput, SadhanaField } from '@iyf/domain';

/**
 * The Next key's walk through the entry form.
 *
 * The number pad's action key used to read "Done" on every field and only
 * dismiss the keyboard, so twelve fields meant twelve dismiss-scroll-tap cycles.
 * Here every text box except the last one advances to the one after it, and only
 * the last reads "Done".
 *
 * The order is the order the form renders in, which is FIELD_GROUPS order rather
 * than schema order - the caller passes its already-grouped fields so the two
 * cannot drift apart.
 *
 * Ids are `${fieldKey}:${boxIndex}`, because a time field is two boxes and the
 * hour has to reach its own minutes before moving on. A toggle is a pair of pills
 * with nothing to type into, so it gets no id and the walk steps over it.
 */
const BOXES_PER_INPUT: Record<FieldInput, number> = { time: 2, stepper: 1, toggle: 0 };

const boxIds = (field: SadhanaField): string[] =>
	Array.from({ length: BOXES_PER_INPUT[field.input] }, (_, i) => `${field.key}:${i}`);

/** What one field needs to join the chain. Optional everywhere, so a form input
 *  rendered outside the entry screen still works with no focus behaviour. */
export interface FieldFocus {
	/** This field's box ids, in tab order. */
	ids: readonly string[];
	/** Publish a box's node so the chain can focus it. */
	register: (_id: string, _node: TextInput | null) => void;
	/** Focus the next box in the form. No-op past the end. */
	next: (_id: string) => void;
	/** True when nothing follows, so the key reads "Done" instead of "Next". */
	isLast: (_id: string) => boolean;
}

export function useFormFocus(fields: readonly SadhanaField[]) {
	const nodes = useRef<Record<string, TextInput | null>>({});
	const order = useMemo(() => fields.flatMap(boxIds), [fields]);

	const register = useCallback((id: string, node: TextInput | null) => {
		// Deleting rather than storing null keeps a remounted box from leaving a
		// dead entry that `next` would silently focus nothing through.
		if (node) nodes.current[id] = node;
		else delete nodes.current[id];
	}, []);

	const next = useCallback(
		(id: string) => {
			const at = order.indexOf(id);
			if (at === -1) return;
			nodes.current[order[at + 1]]?.focus();
		},
		[order]
	);

	const isLast = useCallback((id: string) => order.indexOf(id) === order.length - 1, [order]);

	return useCallback(
		(field: SadhanaField): FieldFocus => ({ ids: boxIds(field), register, next, isLast }),
		[register, next, isLast]
	);
}
