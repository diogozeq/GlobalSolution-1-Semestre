"""Pure-Python TF-IDF retriever — zero dependencies.

Guarantees the RAG demo works offline even when ChromaDB / embedding models are
unavailable. Cosine similarity over TF-IDF vectors of the knowledge-base chunks.
"""
from __future__ import annotations

import math
import re
from collections import Counter

_TOKEN = re.compile(r"[a-zA-ZÀ-ÿ0-9]+")

_STOP = {
    "a", "o", "e", "de", "da", "do", "das", "dos", "em", "no", "na", "que",
    "para", "com", "um", "uma", "os", "as", "por", "se", "ao", "à", "é",
    "the", "of", "and", "to", "in", "is", "for",
}


def tokenize(text: str) -> list[str]:
    return [w.lower() for w in _TOKEN.findall(text) if w.lower() not in _STOP and len(w) > 1]


class TfidfIndex:
    def __init__(self, chunks: list[dict]):
        self.chunks = chunks
        self.docs_tokens = [tokenize(c["text"]) for c in chunks]
        self.df: Counter = Counter()
        for tokens in self.docs_tokens:
            for term in set(tokens):
                self.df[term] += 1
        self.n = max(len(chunks), 1)
        self.idf = {t: math.log((self.n + 1) / (df + 1)) + 1 for t, df in self.df.items()}
        self.vectors = [self._vectorize(tokens) for tokens in self.docs_tokens]

    def _vectorize(self, tokens: list[str]) -> dict[str, float]:
        if not tokens:
            return {}
        tf = Counter(tokens)
        total = len(tokens)
        vec = {t: (count / total) * self.idf.get(t, math.log(self.n + 1) + 1) for t, count in tf.items()}
        norm = math.sqrt(sum(v * v for v in vec.values())) or 1.0
        return {t: v / norm for t, v in vec.items()}

    @staticmethod
    def _cosine(a: dict[str, float], b: dict[str, float]) -> float:
        if len(a) > len(b):
            a, b = b, a
        return sum(w * b.get(t, 0.0) for t, w in a.items())

    def search(self, query: str, k: int = 4) -> list[dict]:
        qvec = self._vectorize(tokenize(query))
        scored = [
            (self._cosine(qvec, vec), idx) for idx, vec in enumerate(self.vectors)
        ]
        scored.sort(reverse=True)
        results: list[dict] = []
        for score, idx in scored[:k]:
            if score <= 0:
                continue
            chunk = self.chunks[idx]
            results.append({**chunk, "score": round(float(score), 4)})
        return results
