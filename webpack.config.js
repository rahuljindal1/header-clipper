const path = require('path');
const CopyPlugin = require('copy-webpack-plugin');

module.exports = {
    entry: {
        popup: './popup.js',
        background: './background.js'
    },
    output: {
        filename: '[name].bundle.js',
        path: path.resolve(__dirname, 'dist'),
    },
    mode: 'production',
    module: {
        rules: [
            {
                test: /\.css$/,
                use: ['style-loader', 'css-loader'],
            },
        ],
    },
    plugins: [
        new CopyPlugin({
            patterns: [
                { from: 'popup.html', to: 'popup.html' },
                { from: 'manifest.json', to: 'manifest.json' },
                { from: 'icons', to: 'icons' },
                { from: 'styles.css', to: 'styles.css' }
            ],
        }),
    ],
};