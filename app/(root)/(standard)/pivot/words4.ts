let WORDS4: string[] = [];

export async function loadWords4() {
  if (WORDS4.length) return WORDS4;          // already cached

  // Fetch words from the public file once
  const res = await fetch('/pivot/4letter.txt');
  const text = await res.text();

  WORDS4 = Array.from(
    new Set(
      text
        .split(/\s+/)               // split on any whitespace
        .map(w => w.trim().toUpperCase())
        // keep *exactly* four letters, nothing else
        .filter(w => /^[A-Z]{4}$/.test(w))
    )
  );

  return WORDS4;
}

