// Temporary start script to bypass lock file issue
process.env.SKIP_LOCK_CHECK = 'true';
require('tsx/cjs').register();
require('./src/index.ts');