import React, { type ComponentType } from 'react';
import {
	Moon,
	Sunrise,
	Landmark,
	CircleDot,
	Clock,
	GraduationCap,
	Headphones,
	Volume2,
	BookOpen,
	BookMarked,
	Flag,
	Armchair,
} from 'lucide-react-native';
import MalaIcon from '@/components/MalaIcon';
import { usePalette } from '@/hooks/useStyles';

/**
 * One distinct glyph per field. The previous set reused the same headphone icon
 * for Japa / SP Lecture / Other Lecture and the same book for both book fields,
 * so the icons carried no information at all.
 *
 * Japa uses MalaIcon, drawn locally in lucide's idiom - see that file for why it
 * is not the mala emoji.
 */
const ICONS: Record<string, ComponentType<{ size?: number; color?: string }>> = {
	moon: Moon,
	sunrise: Sunrise,
	temple: Landmark,
	beads: MalaIcon,
	clock: Clock,
	lectern: GraduationCap,
	headphones: Headphones,
	speaker: Volume2,
	book: BookOpen,
	bookOpen: BookMarked,
	flag: Flag,
	hammock: Armchair,
};

interface FieldIconProps {
	/** A `SadhanaField.icon` value. Anything unrecognised falls back to a dot. */
	name: string;
	size?: number;
	color?: string;
}

export default function FieldIcon({ name, size = 18, color }: FieldIconProps) {
	const palette = usePalette();
	const Glyph = ICONS[name] || CircleDot;
	// Resolved here rather than as a default parameter, so the fallback follows
	// the colour scheme instead of being frozen at module load.
	return <Glyph size={size} color={color ?? palette.textSecondary} />;
}
