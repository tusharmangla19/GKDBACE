/**
 * Colour and spacing tokens.
 *
 * Two palettes with identical keys, selected by the phone's colour scheme via
 * `useStyles`. Dark mode is not decoration here: sadhana is logged before dawn,
 * usually in a dim room, so a cream-white screen at 4am is the single worst thing
 * this app could do. The dark ground is warm ink-brown rather than black so it
 * stays in the same family as the light theme.
 *
 * Rules that hold in BOTH palettes:
 *
 *  - `accent` is for fills and strokes. It is too light against `surface` to be
 *    used as text in light mode - use `accentText` for that. The pair exists in
 *    dark too so callers never have to branch.
 *  - Status colour is semantic and reserved: `good` = logged / improving,
 *    `bad` = open / regressing, `open` = neutral grey, `future` = hasn't happened.
 *    A brand colour must never be green or red or it will fight the completion
 *    dots on every screen.
 *  - Status hues are LIGHTER in dark mode. The same #1B7F3B that passes AA on
 *    white sits at ~2.5:1 on a dark card, so it is raised rather than reused.
 */

export const LightPalette = {
	canvas: '#F7F3EC',
	surface: '#FFFFFF',
	surfaceSunken: '#F2EEE6',
	border: '#E8E2DA',
	borderStrong: '#D3CBBF',

	textPrimary: '#241F1A',
	textSecondary: '#57504A',
	textMuted: '#6B645C',
	textOnAccent: '#FFFFFF',

	accent: '#CE7005',
	accentStrong: '#B4400A',
	accentText: '#9A4A06',
	accentWash: '#FDF1E1',

	good: '#1B7F3B',
	goodFill: '#2E7D32',
	goodWash: '#E7F4E9',

	bad: '#B3261E',
	badFill: '#C62828',
	badWash: '#FCEBE9',

	// "Open" days are neutral, not a failure. Deliberately not red.
	open: '#8A8178',
	openWash: '#F0ECE4',

	future: '#D8D1C7',
	track: '#ECE7DF',
} as const;

/**
 * Shape of either palette: the light palette's keys, any colour value.
 *
 * Mapped rather than `typeof LightPalette`, which - with `as const` - types every
 * key as its own literal hex and makes the dark palette unassignable to it. The
 * `satisfies` below is what enforces the part that matters: both palettes define
 * every key, checked at compile time.
 */
export type PaletteShape = { readonly [K in keyof typeof LightPalette]: string };

export const DarkPalette = {
	canvas: '#16130F',
	surface: '#201C17',
	surfaceSunken: '#2A251F',
	border: '#302A23',
	borderStrong: '#453D34',

	textPrimary: '#F0EAE1',
	textSecondary: '#BDB4A8',
	textMuted: '#9E9488',
	textOnAccent: '#1A1611',

	accent: '#F2A24C',
	accentStrong: '#F2A24C',
	accentText: '#F7BE7E',
	accentWash: '#33261A',

	good: '#5FC27E',
	goodFill: '#4CAF6A',
	goodWash: '#1D2E22',

	bad: '#F2857A',
	badFill: '#E5645A',
	badWash: '#33201E',

	open: '#8E857A',
	openWash: '#2A251F',

	future: '#463F37',
	track: '#2C2721',
} as const satisfies PaletteShape;

export const Radius = { sm: 8, md: 12, lg: 16, pill: 999 } as const;

export const Space = {
	xs: 4,
	sm: 8,
	md: 12,
	lg: 16,
	xl: 24,
	xxl: 32,
} as const;

/** Minimum comfortable touch target (iOS HIG / Material both land near this). */
export const HIT_SIZE = 44;

export const Type = {
	sectionLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8 },
	metricValue: { fontSize: 22, fontWeight: '700' },
	metricValueSm: { fontSize: 18, fontWeight: '700' },
	title: { fontSize: 15, fontWeight: '700' },
	body: { fontSize: 13, fontWeight: '400' },
	bodyStrong: { fontSize: 13, fontWeight: '600' },
	caption: { fontSize: 11, fontWeight: '400' },
	micro: { fontSize: 10, fontWeight: '500' },
} as const;
