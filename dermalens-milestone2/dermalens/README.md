# DermaLens (Milestones 1-2: backend, seed data and website)

A cosmetic ingredient classifier. Milestone 1 is the Flask + SQLite backend, a seeded
database (187 ingredients, 27 demo products, per-category ingredient tables) and tests.

## Run (Windows / Mac / Linux, Python 3.11+)
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m seed.load             # creates dermalens.db with sample data
python -m pytest -q             # should show 9 passed
python -m app.main              # API on http://127.0.0.1:8000
```
Open the WEBSITE at http://127.0.0.1:8000/  (keep the terminal open; Ctrl+C stops it).
Raw API examples: /api/search?q=serum , /api/categories/lipstick , /api/ingredients?q=glycerin

## What the website has now (milestone 2)
Header with name + search (autocomplete), home page with product-type tiles, category pages
(basic ingredients with typical min/max %), product pages (label-order ingredients, clickable
ingredient details, what's-inside tags, basic safety summary, where-to-buy table), ingredient
encyclopedia. Analyzer, Compare, Dupes, Routine, Concerns and Login are placeholders for later milestones.

## Frontend note
The website is plain HTML/CSS/JavaScript in `backend/static/` (no Node or npm needed). The original
prompt asked for React + Tailwind; the build workspace could not install them, so this version has
no build step. It can be ported to React later.

## Honesty notes (explain these in your viva)
- All products, brands, prices and retailer links are FICTIONAL sample data (`is_sample_data`).
- Ingredient min/max values are approximate TYPICAL RANGES, never exact amounts in a product,
  because a label only shows ingredient order.
- Irritancy / comedogenic scores are rough educational estimates, not medical ratings.
- Only 187 ingredients are seeded (the prompt asked for 300+); add lines to
  `seed/ingredients_data.py` or write a loader for real data (Open Beauty Facts, EU CosIng).

## Stack change
The original prompt asked for FastAPI + SQLAlchemy. The build workspace could not install them,
so this version uses Flask + sqlite3 (standard library). The API shape is the same.
