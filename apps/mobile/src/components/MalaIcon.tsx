import React from 'react';
import Svg, { Circle } from 'react-native-svg';

/**
 * A japa mala, drawn to sit in the same set as the lucide icons around it:
 * 24x24 viewBox, single colour, sized and weighted to match.
 *
 * This replaces a literal mala emoji. The emoji said the right thing but rendered
 * in full colour at its own weight, so it was the one icon in the app that looked
 * like it came from somewhere else.
 *
 * Nine beads, not twelve: at the 18px this renders at, twelve beads leave gaps of
 * about half a pixel and collapse into a plain dotted ring. Nine keeps them
 * separable. Beads are filled rather than stroked because an outlined circle this
 * small with lucide's 2px stroke is just a blob. The larger bead at bottom centre
 * is the head bead - it is what makes this read as a mala rather than a dial.
 */
interface MalaIconProps {
	size?: number;
	color?: string;
}

export default function MalaIcon({ size = 18, color = 'currentColor' }: MalaIconProps) {
	return (
		<Svg width={size} height={size} viewBox="0 0 24 24" fill="none">
			<Circle key={1} cx="7.5" cy="17.36" r="1.35" fill={color} />
			<Circle key={2} cx="5.11" cy="13.22" r="1.35" fill={color} />
			<Circle key={3} cx="5.94" cy="8.5" r="1.35" fill={color} />
			<Circle key={4} cx="9.61" cy="5.42" r="1.35" fill={color} />
			<Circle key={5} cx="14.39" cy="5.42" r="1.35" fill={color} />
			<Circle key={6} cx="18.06" cy="8.5" r="1.35" fill={color} />
			<Circle key={7} cx="18.89" cy="13.22" r="1.35" fill={color} />
			<Circle key={8} cx="16.5" cy="17.36" r="1.35" fill={color} />
			<Circle cx="12.0" cy="19.0" r="2.1" fill={color} />
		</Svg>
	);
}
