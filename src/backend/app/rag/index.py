"""Knowledge-base loader + hybrid index (semantic ChromaDB + lexical TF-IDF).

Retrieval strategy:
- ChromaDB (cosine) gives semantic recall (paraphrases).
- TF-IDF gives strong lexical recall (good for Portuguese keyword overlap, where
  the default English MiniLM embeddings are weaker).
- Results are fused with Reciprocal Rank Fusion (RRF) — scale-agnostic, robust.

If ChromaDB is unavailable, the index degrades to pure TF-IDF (offline-safe).
"""
from __future__ import annotations

import logging
import re
from pathlib import Path

from sqlmodel import Session, delete, select

from app.core.config import settings
from app.models import KnowledgeDocument, utcnow
from app.rag.fallback import TfidfIndex

logger = logging.getLogger("orbitguard.rag")

KB_DIR = Path(__file__).resolve().parent.parent / "knowledge_base"
_URL_RE = re.compile(r"https?://[^\s)\]]+")
_HEADING_RE = re.compile(r"^#{1,6}\s*", re.MULTILINE)
_COLLECTION = "orbitguard_kb_cos"  # cosine-space collection (v2)


def _clean(text: str) -> str:
    """Strip markdown heading hashes so cited chunks read cleanly."""
    return _HEADING_RE.sub("", text).strip()


def _load_chunks() -> list[dict]:
    """Read every markdown doc and split into paragraph chunks with metadata."""
    chunks: list[dict] = []
    if not KB_DIR.exists():
        return chunks
    for path in sorted(KB_DIR.glob("*.md")):
        text = path.read_text(encoding="utf-8")
        title_match = re.search(r"^#\s+(.+)$", text, re.MULTILINE)
        title = title_match.group(1).strip() if title_match else path.stem
        url_match = _URL_RE.search(text)
        source_url = url_match.group(0) if url_match else ""
        paragraphs = [p.strip() for p in re.split(r"\n\s*\n", text) if len(p.strip()) > 40]
        for i, para in enumerate(paragraphs):
            chunks.append(
                {
                    "id": f"{path.stem}-{i}",
                    "text": _clean(para),
                    "title": title,
                    "source_url": source_url,
                    "file": path.name,
                }
            )
    return chunks


def _rrf(result_lists: list[list[dict]], k: int = 60) -> list[dict]:
    """Reciprocal Rank Fusion of several ranked result lists (by chunk id)."""
    scores: dict[str, float] = {}
    meta: dict[str, dict] = {}
    for lst in result_lists:
        for rank, item in enumerate(lst):
            cid = item.get("id")
            if not cid:
                continue
            scores[cid] = scores.get(cid, 0.0) + 1.0 / (k + rank + 1)
            meta.setdefault(cid, item)
    ranked = sorted(scores.keys(), key=lambda c: scores[c], reverse=True)
    return [{**meta[c], "rrf": round(scores[c], 4)} for c in ranked]


class KnowledgeIndex:
    def __init__(self) -> None:
        self.mode: str | None = None
        self.chunks: list[dict] = []
        self._tfidf: TfidfIndex | None = None
        self._collection = None

    # -- building --
    def build(self, force: bool = False) -> int:
        self.chunks = _load_chunks()
        self._tfidf = TfidfIndex(self.chunks)  # always available (cheap, offline)
        if settings.embeddings_provider != "none" and self._build_chroma(force):
            self.mode = "hybrid"
        else:
            self.mode = "tfidf"
        return len(self.chunks)

    def _build_chroma(self, force: bool) -> bool:
        if not self.chunks:
            return False
        try:
            import chromadb

            client = chromadb.PersistentClient(path=settings.chroma_path)
            if force:
                try:
                    client.delete_collection(_COLLECTION)
                except Exception:  # noqa: BLE001
                    pass
            col = client.get_or_create_collection(
                _COLLECTION, metadata={"hnsw:space": "cosine"}
            )
            if force or col.count() == 0:
                col.add(
                    ids=[c["id"] for c in self.chunks],
                    documents=[c["text"] for c in self.chunks],
                    metadatas=[
                        {"title": c["title"], "source_url": c["source_url"], "file": c["file"]}
                        for c in self.chunks
                    ],
                )
            self._collection = col
            return True
        except Exception as exc:  # noqa: BLE001 - any failure -> TF-IDF only
            logger.warning("ChromaDB unavailable, using TF-IDF fallback: %s", exc)
            return False

    # -- querying --
    def _semantic(self, query: str, n: int) -> list[dict]:
        res = self._collection.query(query_texts=[query], n_results=n)
        ids = (res.get("ids") or [[]])[0]
        docs = (res.get("documents") or [[]])[0]
        metas = (res.get("metadatas") or [[]])[0]
        dists = (res.get("distances") or [[None] * len(docs)])[0]
        out: list[dict] = []
        for cid, doc, meta, dist in zip(ids, docs, metas, dists):
            out.append(
                {
                    "id": cid,
                    "text": doc,
                    "title": meta.get("title", ""),
                    "source_url": meta.get("source_url", ""),
                    "score": round(1 - dist, 4) if dist is not None else None,  # cosine sim
                }
            )
        return out

    def search(self, query: str, k: int = 4) -> list[dict]:
        if self.mode is None:
            self.build()
        if self._collection is not None:
            try:
                pool = max(k * 3, 8)
                semantic = self._semantic(query, pool)
                lexical = self._tfidf.search(query, pool) if self._tfidf else []
                fused = _rrf([semantic, lexical])
                if fused:
                    return fused[:k]
            except Exception as exc:  # noqa: BLE001 - degrade to TF-IDF
                logger.warning("Hybrid search failed, falling back to TF-IDF: %s", exc)
        if self._tfidf is None:
            self._tfidf = TfidfIndex(self.chunks)
        return self._tfidf.search(query, k)


_INDEX: KnowledgeIndex | None = None


def get_index() -> KnowledgeIndex:
    global _INDEX
    if _INDEX is None:
        _INDEX = KnowledgeIndex()
        _INDEX.build()
    return _INDEX


def reindex(session: Session | None = None) -> dict:
    """Force a rebuild and (optionally) record KnowledgeDocument rows."""
    index = get_index()
    n = index.build(force=True)
    docs = 0
    if session is not None:
        session.exec(delete(KnowledgeDocument))
        seen: set[str] = set()
        for c in index.chunks:
            if c["title"] in seen:
                continue
            seen.add(c["title"])
            session.add(
                KnowledgeDocument(
                    title=c["title"], source_url=c["source_url"], kind="reference",
                    indexed_at=utcnow(),
                )
            )
            docs += 1
        session.commit()
    return {"indexed_chunks": n, "docs": docs or len({c["title"] for c in index.chunks}), "mode": index.mode}


def current_mode() -> str:
    """Report the RAG backend without forcing a (heavy) index build."""
    if _INDEX is not None and _INDEX.mode:
        return _INDEX.mode
    if settings.embeddings_provider == "none":
        return "tfidf"
    try:
        import chromadb  # noqa: F401

        return "hybrid"
    except Exception:  # noqa: BLE001
        return "tfidf"
