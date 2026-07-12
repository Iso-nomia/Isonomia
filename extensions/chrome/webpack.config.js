const path = require("path");
const CopyWebpackPlugin = require("copy-webpack-plugin");
const MiniCssExtractPlugin = require("mini-css-extract-plugin");

module.exports = (env, argv) => {
  const isProd = argv.mode === "production";

  return {
    entry: {
      "background/service-worker": "./src/background/service-worker.ts",
      "content/content-bundle": "./src/content/content-entry.ts",
      "popup/popup": "./src/popup/popup.tsx",
      "options/options": "./src/options/options.tsx",
    },
    output: {
      path: path.resolve(__dirname, "dist"),
      filename: "[name].js",
      clean: true,
    },
    resolve: {
      extensions: [".ts", ".tsx", ".js", ".jsx"],
      alias: {
        "react": "preact/compat",
        "react-dom": "preact/compat",
      },
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: {
            loader: "ts-loader",
            options: {
              transpileOnly: !isProd,
            },
          },
          exclude: /node_modules/,
        },
        {
          test: /\.css$/,
          use: [MiniCssExtractPlugin.loader, "css-loader"],
        },
      ],
    },
    plugins: [
      new MiniCssExtractPlugin({
        filename: "[name].css",
      }),
      new CopyWebpackPlugin({
        patterns: [
          { from: "manifest.json", to: "../manifest.json" },
          { from: "popup.html", to: "../popup.html" },
          { from: "options.html", to: "../options.html" },
          {
            from: "icons",
            to: "../icons",
            noErrorOnMissing: true,
          },
        ],
      }),
    ],
    devtool: isProd ? false : "cheap-module-source-map",
    optimization: {
      minimize: isProd,
    },
    stats: "minimal",
  };
};
