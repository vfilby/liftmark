// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Ensure expo-router can discover all routes in production builds
config.resolver.sourceExts = [...(config.resolver.sourceExts || [])];

// Enable unstable settings for better route discovery
config.transformer = {
  ...config.transformer,
  unstable_allowRequireContext: true,
};

module.exports = config;
