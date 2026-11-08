"""Ingredient-name normalisation shared by the seed loader and (later) the analyzer."""
import re
import unicodedata


def normalize(name: str) -> str:
    """lowercase, strip accents, remove punctuation noise, collapse whitespace.

    'Aqua / Water ' -> 'aqua water'; 'Sodium  Hyaluronate.' -> 'sodium hyaluronate'
    """
    s = unicodedata.normalize("NFKD", name or "")
    s = "".join(c for c in s if not unicodedata.combining(c))
    s = s.lower().replace("&", " and ")
    s = re.sub(r"\(.*?\)", " ", s)       # drop parenthetical notes like (nano)
    s = re.sub(r"[^a-z0-9/+\- ]", " ", s)  # keep letters, digits and a few INCI symbols
    s = re.sub(r"\s+", " ", s).strip()
    return s


def split_ingredient_list(text: str):
    """Split a pasted label into individual ingredient names (label order)."""
    text = re.sub(r"(?i)^\s*ingredients?\s*[:\-]?\s*", "", text.strip())
    parts = re.split(r"[,;\n•·]+", text)
    return [p.strip(" .\t") for p in parts if p.strip(" .\t")]
