const moduleAlias = require('module-alias');
const path = require('path');

// Register TypeScript path aliases for runtime
moduleAlias.addAliases({
  '@': path.join(__dirname, '../dist/src'),
  '@core': path.join(__dirname, '../dist/src/core'),
  '@modules': path.join(__dirname, '../dist/src/modules'),
  '@api': path.join(__dirname, '../dist/src/api'),
  '@services': path.join(__dirname, '../dist/src/services'),
  '@utils': path.join(__dirname, '../dist/src/utils'),
  '@config': path.join(__dirname, '../dist/src/config')
});