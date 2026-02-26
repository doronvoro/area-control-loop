const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const config = getDefaultConfig(__dirname);

// Watch the parent types directory for shared types
config.watchFolders = [path.resolve(__dirname, '../types')];

// Resolve @shared/* imports to ../types/*
config.resolver.extraNodeModules = {
  '@shared': path.resolve(__dirname, '../types'),
};

// Allow importing from parent directory
config.resolver.nodeModulesPaths = [
  path.resolve(__dirname, 'node_modules'),
];

module.exports = config;
