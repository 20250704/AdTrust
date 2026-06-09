function ngrams(value, size = 3) {
  const text = String(value || "").replace(/\s+/g, "");
  if (!text) return new Set();
  if (text.length <= size) return new Set([text]);
  const set = new Set();
  for (let index = 0; index <= text.length - size; index += 1) {
    set.add(text.slice(index, index + size));
  }
  return set;
}

function similarity(a, b) {
  const left = ngrams(a);
  const right = ngrams(b);
  if (!left.size && !right.size) return 1;
  let intersection = 0;
  left.forEach(item => {
    if (right.has(item)) intersection += 1;
  });
  const union = new Set([...left, ...right]).size || 1;
  return intersection / union;
}

module.exports = { similarity };
