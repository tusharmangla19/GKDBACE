// Flat config. `expo` brings the React / React Native / import rules that match
// this SDK; `prettier` last so formatting is Prettier's job alone and the two
// never disagree about the same line.
const expoConfig = require('eslint-config-expo/flat');
const prettier = require('eslint-config-prettier/flat');
// Comes in with eslint-config-expo. Declared explicitly because a flat-config
// rule must be in the same object as the plugin that provides it.
const tsPlugin = require('@typescript-eslint/eslint-plugin');

module.exports = [
	...expoConfig,
	prettier,
	{
		ignores: ['node_modules/**', 'android/**', 'ios/**', '.expo/**', 'dist/**', 'scripts/**'],
	},
	{
		plugins: { '@typescript-eslint': tsPlugin },
		rules: {
			// eslint-config-expo already enables @typescript-eslint/no-unused-vars;
			// switching the base rule on as well reported every finding twice.
			'no-unused-vars': 'off',
			'@typescript-eslint/no-unused-vars': [
				'warn',
				{ argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
			],
			'no-console': ['warn', { allow: ['warn', 'error'] }],
		},
	},
];
