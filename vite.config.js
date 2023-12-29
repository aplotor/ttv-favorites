const vite_config = { // https://vitejs.dev/config
	build: {
		lib: {
			formats: [
				"es"
			],
			entry: {
				"background": "./background/background.js",
				"foreground": "./foreground/foreground.js",
				"popup": "./popup/popup.js"
			},
			fileName: (format, name) => `${name}.js`
		},
		outDir: "./build/" // vite empties this dir before building
	}
};

export default vite_config;
