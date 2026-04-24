import obsidianmd from "eslint-plugin-obsidianmd";

export default [
	{
		ignores: ["eslint.config.mjs", "main.js", "node_modules/**"],
	},
	...obsidianmd.configs.recommendedWithLocalesEn,
	{
		files: ["src/**/*.ts"],
		languageOptions: {
			parserOptions: {
				project: "./tsconfig.json",
				tsconfigRootDir: import.meta.dirname,
			},
		},
	},
];
