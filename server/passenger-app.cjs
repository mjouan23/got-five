// cPanel Passenger loader is CommonJS; load the ESM server entrypoint dynamically.
import('./src/server.js').catch((error) => {
  console.error('Failed to start ESM server:', error);
  process.exit(1);
});
