-- Tabella cards
CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  status TEXT NOT NULL DEFAULT 'non_attiva', -- non_attiva | attiva | utilizzata
  activated_at TEXT,
  used_at TEXT,
  sponsor_id INTEGER
);

-- Tabella sponsors
CREATE TABLE IF NOT EXISTS sponsors (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  type TEXT NOT NULL,               -- bar | ristorante | pizzeria
  max_uses INTEGER NOT NULL,
  remaining_uses INTEGER NOT NULL
);

-- Tabella scans (log)
CREATE TABLE IF NOT EXISTS scans (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  card_id TEXT NOT NULL,
  sponsor_id INTEGER,
  timestamp TEXT NOT NULL,
  action TEXT NOT NULL,             -- attivazione | utilizzo
  FOREIGN KEY(card_id) REFERENCES cards(id),
  FOREIGN KEY(sponsor_id) REFERENCES sponsors(id)
);

-- Tabella users (admin + sponsor)
CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,           -- per semplicità: testo in chiaro
  role TEXT NOT NULL,               -- admin | sponsor
  sponsor_id INTEGER,
  FOREIGN KEY(sponsor_id) REFERENCES sponsors(id)
);