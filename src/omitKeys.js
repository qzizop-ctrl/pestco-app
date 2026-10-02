// Returns a shallow copy of `obj` without the listed keys. Used instead of
// destructuring unused variables out of an object just to drop them.
export function omitKeys(obj, keys) {
  const out = { ...obj };
  for (const k of keys) delete out[k];
  return out;
}
