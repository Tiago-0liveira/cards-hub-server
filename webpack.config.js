const path = require('path');
const nodeExternals = require("webpack-node-externals");

module.exports = {
	entry: './src/server.ts', // Your main entry file
	output: {
		filename: 'bundle.js',
		path: path.resolve(__dirname, 'dist'),
	},
	target: "node",
	externals: [nodeExternals()], // ✅ Ignore all `node_modules`
	resolve: {
		extensions: ['.ts', '.js'],
	},
	module: {
		rules: [
			{
				test: /\.ts$/,
				use: 'ts-loader',
				exclude: /node_modules/,
			},
		],
	}
};
