const path = require("path");
const enableImportsFromExternalPaths = require("./enable-imports-from-external-paths.js");

// Paths to the code you want to use
const common = path.resolve(__dirname, "../common");

module.exports = {
  plugins: [
    {
      plugin: {
        overrideWebpackConfig: ({ webpackConfig }) => {
          enableImportsFromExternalPaths(webpackConfig, [
            // Add the paths here
            common,
          ]);
          return webpackConfig;
        },
      },
    },
  ],
};