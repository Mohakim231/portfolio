const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');

module.exports = {
  mode: 'development',
  
  entry: './src/main.js',

  output: {
    path: path.resolve(__dirname, 'dist'),
    filename: 'bundle.js',
    clean: true,
  },

  devServer: {
    static: {
      directory: path.join(__dirname, 'dist'),
    },
    hot: true,
  },

  plugins: [
    new HtmlWebpackPlugin({
      template: './index.html',
      filename: 'index.html',
    }),

    new CopyWebpackPlugin({
      patterns: [
        { from: 'public', to: '' },
      ],
    }),
  ],

  module: {
    rules: [
      {
        test: /\.css$/i,
        use: ['style-loader', 'css-loader'],
      },
    ],
  },

  devtool: 'eval-source-map',
};
