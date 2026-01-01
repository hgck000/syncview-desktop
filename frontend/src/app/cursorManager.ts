type Token = string;

type Entry = {
  cursor: string;
  priority: number;
};

const map = new Map<Token, Entry>();

function apply() {
  let best: Entry | null = null;
  for (const e of map.values()) {
    if (!best || e.priority > best.priority) best = e;
  }
  document.body.style.cursor = best?.cursor ?? "";
}

export function cursorSet(token: Token, cursor: string, priority = 0) {
  map.set(token, { cursor, priority });
  apply();
}

export function cursorClear(token: Token) {
  if (!map.has(token)) return;
  map.delete(token);
  apply();
}
