CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  email TEXT,
  first_name TEXT,
  last_name TEXT,
  styles TEXT,
  delivery TEXT,
  status TEXT NOT NULL,
  photo_base64 TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS order_status_history (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id TEXT NOT NULL,
  status TEXT NOT NULL,
  note TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(order_id) REFERENCES orders(id)
);

CREATE TRIGGER IF NOT EXISTS trg_orders_updated_at
AFTER UPDATE ON orders
FOR EACH ROW
BEGIN
  UPDATE orders SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
