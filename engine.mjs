// Flat configuration only. Never include input values in validation errors.
function record(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) ||
      ![Object.prototype, null].includes(Object.getPrototypeOf(value)))
    throw Error('Expected a plain data object');
  const descriptors = Object.getOwnPropertyDescriptors(value);
  if (Reflect.ownKeys(descriptors).some(key => typeof key !== 'string' ||
      !descriptors[key].enumerable || !Object.hasOwn(descriptors[key], 'value')))
    throw Error('Only enumerable data properties are supported');
  return Object.fromEntries(Object.entries(descriptors).map(([key, d]) => [key, d.value]));
}
function fields(value, names) {
  const data = record(value);
  if (Object.keys(data).length !== names.length || names.some(n => !Object.hasOwn(data, n)))
    throw Error('Missing or unsupported schema fields');
  return data;
}
function list(value) {
  if (!Array.isArray(value) || value.length > 500) throw Error('Expected an array with at most 500 items');
  const result = [];
  for (let i = 0; i < value.length; i++) {
    const d = Object.getOwnPropertyDescriptor(value, String(i));
    if (!d || !Object.hasOwn(d, 'value')) throw Error('Array entries must be data values');
    result.push(d.value);
  }
  return result;
}
function text(value) {
  if (typeof value !== 'string' || !value.trim() || value.length > 100000)
    throw Error('Expected nonempty text (maximum 100000 characters)');
  return value;
}
function scalar(value) {
  if (value === null || typeof value === 'string' || typeof value === 'boolean' ||
      (typeof value === 'number' && Number.isFinite(value))) return value;
  throw Error('Configuration values must be flat JSON scalars; nested objects and arrays are unsupported');
}
export function run(input) {
  const root = fields(input, ['secretKeys', 'layers']);
  const secretKeys = list(root.secretKeys).map(text);
  const layers = list(root.layers).map(value => {
    const layer = fields(value, ['name', 'values']);
    const entries = Object.entries(record(layer.values)).map(([key, value]) => [key, scalar(value)]);
    return {name: text(layer.name), values: Object.fromEntries(entries)};
  });
  if (JSON.stringify({secretKeys, layers}).length > 200000) throw Error('Input exceeds 200000 serialized characters');
  const secret = new Set(secretKeys), effective = new Map(), provenance = new Map();
  layers.forEach((layer, layerIndex) => {
    for (const [key, value] of Object.entries(layer.values)) {
      effective.set(key, {key, value: secret.has(key) ? '[REDACTED]' : JSON.stringify(value),
        source: layer.name, sourceIndex: layerIndex});
      if (!provenance.has(key)) provenance.set(key, []);
      provenance.get(key).push({layerIndex, layerName: layer.name});
    }
  });
  const rows = [...effective.values()].map(row => ({...row,
    history: provenance.get(row.key).map(p => p.layerName).join(' → ')}));
  const unmatchedSecretKeys = [...secret].filter(key => !effective.has(key)).sort();
  return {
    metrics: {keys: rows.length, redacted: rows.filter(row => secret.has(row.key)).length,
      unmatchedSecretKeys: unmatchedSecretKeys.length},
    rows, unmatchedSecretKeys,
    provenance: [...provenance].map(([key, assignments]) => ({key, assignments}))
  };
}
