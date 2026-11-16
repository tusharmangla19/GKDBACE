import { useMemo } from 'react';
import { useColorScheme } from 'react-native';
import { DarkPalette, LightPalette, type PaletteShape } from '@/constants/palette';

/**
 * Themed stylesheets.
 *
 * `StyleSheet.create` at module scope runs once at import, so a flat colour
 * constant can never respond to the colour scheme. Each component instead
 * exports a `makeStyles(palette)` factory and calls this hook, which reselects
 * and re-memoises when the scheme changes.
 *
 *   const makeStyles = (p: PaletteShape) =>
 *     StyleSheet.create({ card: { backgroundColor: p.surface } });
 *
 *   const [styles, palette] = useStyles(makeStyles);
 *
 * The factory must be defined at module scope so its identity is stable;
 * declaring it inside the component would rebuild the sheet on every render.
 */
export function useStyles<T>(factory: (_palette: PaletteShape) => T) {
	const scheme = useColorScheme();
	const isDark = scheme === 'dark';
	const palette = isDark ? DarkPalette : LightPalette;
	const styles = useMemo(() => factory(palette), [factory, palette]);
	return [styles, palette, isDark ? 'dark' : 'light'] as const;
}

/** When only the colours are needed - icon tints, chart fills, status bar. */
export function usePalette(): PaletteShape {
	const scheme = useColorScheme();
	return scheme === 'dark' ? DarkPalette : LightPalette;
}
