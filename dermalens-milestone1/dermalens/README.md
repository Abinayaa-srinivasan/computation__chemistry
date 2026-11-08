# DermaLens (Milestones 1-3: backend, website and Ingredient Analyzer)

A cosmetic ingredient classifier. Milestone 1 is the Flask + SQLite backend, a seeded
database (187 ingredients, 27 demo products, per-category ingredient tables) and tests.

## Run (Windows / Mac / Linux, Python 3.11+)
```
cd backend
python -m venv .venv
.venv\Scripts\activate          # Mac/Linux: source .venv/bin/activate
pip install -r requirements.txt
python -m seed.load             # creates dermalens.db with sample data
python -m pytest -q             # should show 23 passed (the OCR test is skipped if Tesseract is missing)
python -m app.main              # API on http://127.0.0.1:8000
```
Open the WEBSITE at http://127.0.0.1:8000/  (keep the terminal open; Ctrl+C stops it).
Raw API examples: /api/search?q=serum , /api/categories/lipstick , /api/ingredients?q=glycerin

## What the website has now (milestone 2)
Header with name + search (autocomplete), home page with product-type tiles, category pages
(basic ingredients with typical min/max %), product pages (label-order ingredients, clickable
ingredient details, what's-inside tags, basic safety summary, where-to-buy table), ingredient
encyclopedia. Compare, Dupes, Routine, Concerns and Login are placeholders for later milestones.

## Ingredient Analyzer (milestone 3)
Open http://127.0.0.1:8000/#/analyze . Paste a list, click "Try an example", upload or drop a photo of a
label, or use the camera. Each ingredient gets categories, a green/yellow/red rating and a reason;
you also get an overall verdict, flags, "what it does", clashing pairs, and a list of unrecognised ingredients.

How it works (good viva material):
1. Split the text (handles label line-wraps) and normalise names (lowercase, strip accents/punctuation).
2. Match against ingredient names and aliases: exact first, then fuzzy (difflib, cutoff 0.88) to fix typos and
   OCR slips. Fuzzy matches are shown as "matched approximately". The cutoff is strict on purpose: for a safety
   tool, "not recognised" is better than a wrong match.
3. Rate each ingredient and build the verdict with fixed rules over the ingredient table (irritancy,
   flags, comedogenic score, clashes). Same input always gives the same output, and every point has a reason.
4. Unknown ingredients get a SUGGESTED category from keyword rules, else a small ML model (TF-IDF character
   n-grams + logistic regression), always shown with a confidence.

Evaluate the ML part: `python -m eval.evaluate_classifier` (leave-one-out cross-validation).
On the sample table it scores about 46% accuracy from names alone. That is low because a name is weak
evidence for many categories, which is exactly why the app labels it a suggestion with a confidence
and prefers keyword rules when one applies. Say this honestly in your viva; adding real data would help.

### Reading photos (OCR)
Photo reading needs the free Tesseract program on your computer, in addition to `pip install -r requirements.txt`:
- Windows: install from https://github.com/UB-Mannheim/tesseract/wiki (tick "Add to PATH"), then restart the terminal.
- Mac: `brew install tesseract`.  Linux: `sudo apt install tesseract-ocr`.
Without it, the site shows a clear message and you can still paste text. OCR makes mistakes, so the text
box is editable before you analyse. Camera access needs http://127.0.0.1 or https (browsers block it elsewhere).

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
