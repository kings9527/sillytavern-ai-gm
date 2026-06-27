/**
 * Node.js ES Module Loader to intercept better-sqlite3
 * Redirects all imports of 'better-sqlite3' to our mock
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier === 'better-sqlite3') {
    const url = new URL('./better-sqlite3-mock.js', import.meta.url).href;
    return { url, shortCircuit: true };
  }
  return nextResolve(specifier, context);
}
