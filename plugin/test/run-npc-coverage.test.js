// Run both test suites in a single process for accurate c8 coverage
async function run() {
  await import('./npc-decision-advanced.test.js');
  await import('./npc-decision-coverage.test.js');
}

run().catch(e => {
  console.error('Error:', e);
  process.exit(1);
});
