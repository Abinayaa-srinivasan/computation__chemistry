"""SQLite helpers. Uses only the standard library (sqlite3) so setup stays simple."""
import os
import sqlite3

DB_PATH = os.environ.get(
    "DERMALENS_DB", os.path.join(os.path.dirname(__file__), "..", "dermalens.db")
)

SCHEMA = """
CREATE TABLE IF NOT EXISTS categories (
    name TEXT PRIMARY KEY, meaning TEXT
);
CREATE TABLE IF NOT EXISTS ingredients (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    inci_name TEXT UNIQUE NOT NULL,
    norm_name TEXT NOT NULL,
    aliases TEXT NOT NULL,            -- JSON list
    categories TEXT NOT NULL,         -- JSON list
    description TEXT,
    irritancy INTEGER DEFAULT 0,      -- 0-5 rough educational estimate
    comedogenic INTEGER DEFAULT 0,    -- 0-5 rough educational estimate
    flags TEXT NOT NULL,              -- JSON list
    skin_types TEXT NOT NULL,         -- JSON list
    incompatible_with TEXT NOT NULL,  -- JSON list
    typical_min REAL, typical_max REAL,
    range_source TEXT,
    is_sample_data INTEGER DEFAULT 1
);
CREATE TABLE IF NOT EXISTS alias_index (
    alias_norm TEXT PRIMARY KEY,
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id)
);
CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL, brand TEXT NOT NULL, category TEXT NOT NULL,
    size TEXT, price REAL, image TEXT,
    is_sample_data INTEGER DEFAULT 1,
    status TEXT DEFAULT 'approved'    -- pending / approved / rejected (contributions)
);
CREATE TABLE IF NOT EXISTS product_ingredients (
    product_id INTEGER NOT NULL REFERENCES products(id),
    position INTEGER NOT NULL,        -- label order, 1 = highest concentration
    ingredient_id INTEGER REFERENCES ingredients(id),
    raw_name TEXT NOT NULL,
    PRIMARY KEY (product_id, position)
);
CREATE TABLE IF NOT EXISTS retailer_links (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id),
    retailer TEXT NOT NULL, url TEXT NOT NULL, price REAL
);
CREATE TABLE IF NOT EXISTS category_ingredients (
    category TEXT NOT NULL, ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    role TEXT, typical_min REAL, typical_max REAL, why TEXT,
    PRIMARY KEY (category, ingredient_id)
);
CREATE TABLE IF NOT EXISTS concerns (
    name TEXT PRIMARY KEY, label TEXT NOT NULL, description TEXT
);
CREATE TABLE IF NOT EXISTS concern_ingredients (
    concern TEXT NOT NULL REFERENCES concerns(name),
    ingredient_id INTEGER NOT NULL REFERENCES ingredients(id),
    priority INTEGER NOT NULL,        -- 3 first-line, 2 good option, 1 supporting
    why TEXT, how_to_use TEXT, caution TEXT,
    PRIMARY KEY (concern, ingredient_id)
);
CREATE TABLE IF NOT EXISTS concern_avoid (
    concern TEXT NOT NULL REFERENCES concerns(name), item TEXT NOT NULL, why TEXT
);
CREATE TABLE IF NOT EXISTS concern_tips (
    concern TEXT NOT NULL REFERENCES concerns(name), tip TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_products_category ON products(category);
"""


def connect(path=None):
    conn = sqlite3.connect(path or DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn


def init_db(path=None):
    conn = connect(path)
    conn.executescript(SCHEMA)
    conn.commit()
    return conn
