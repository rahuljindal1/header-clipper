const path = require("path");
const CopyPlugin = require("copy-webpack-plugin");

module.exports = {
    entry: {
        popup: "./popup.ts",
        background: "./background.ts",
    },
    output: {
        filename: "[name].js",
        path: path.resolve(__dirname, "dist"),
    },
    mode: "production",
    resolve: {
        extensions: [".ts", ".js"],
    },
    module: {
        rules: [
            {
                test: /\.ts$/,
                use: "ts-loader",
                exclude: /node_modules/,
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: "popup.html", to: "popup.html" },
                { from: "manifest.json", to: "manifest.json" },
                { from: "icons", to: "icons" },
                { from: "styles.css", to: "styles.css" },
                { from: "mock.js", to: "mock.js" },
            ],
        }),
    ],
};
