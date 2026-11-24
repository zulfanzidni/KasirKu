const { getDefaultConfig } = require('expo/metro-config');

/**
 * The app ships to Android; web is only how a screen is looked at while it is
 * being designed (`npm run storybook`). expo-sqlite's web build loads its
 * SQLite engine from a `.wasm` file, which Metro does not treat as an asset by
 * default, so the bundle fails before the first screen paints without this.
 */
const config = getDefaultConfig(__dirname);

config.resolver.assetExts.push('wasm');

module.exports = config;
