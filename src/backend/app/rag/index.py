"""Knowledge-base loader + index (ChromaDB semantic, TF-IDF fallback)."""
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
_COLLECTION = "orbitguard_kb"


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
                    "text": para,
                    "title": title,
                    "source_url": source_url,
                    "file": path.name,
                }
            )
    return chunks


class KnowledgeIndex:
    def __init__(self) -> None:
        self.mode: str | None = None
        self.chunks: list[dict] = []
        self._tfidf: TfidfIndex | None = None
        self._collection = None

    # -- building --
    def build(self, force: bool = False) -> int:
        self.chunks = _load_chunks()
        if settings.embeddings_provider != "none":
            if self._build_chroma(force):
                self.mode = "chroma"
                return len(self.chunks)
        self._tfidf = TfidfIndex(self.chunks)
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
            col = client.get_or_create_collection(_COLLECTION)
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
        except Exception as exc:  # noqa: BLE001 - any failure -> fallback
            logger.warning("ChromaDB unavailable, using TF-IDF fallback: %s", exc)
            return False

    # -- querying --
    def search(self, query: str, k: int = 4) -> list[dict]:
        if self.mode is None:
            self.build()
        if self.mode == "chroma" and self._collection is not None:
            try:
                res = self._collection.query(query_texts=[query], n_results=k)
                out: list[dict] = []
                docs = res.get("documents", [[]])[0]
                metas = res.get("metadatas", [[]])[0]
                dists = res.get("distances", [[]])[0] if res.get("distances") else [None] * len(docs)
                for doc, meta, dist in zip(docs, metas, dists):
                    out.append(
                        {
                            "text": doc,
                            "title": meta.get("title", ""),
                            "source_url": meta.get("source_url", ""),
                            "score": round(1 - dist, 4) if dist is not None else None,
                        }
                    )
                if out:
                    return out
            except Exception as exc:  # noqa: BLE001 - degrade to tfidf
                logger.warning("Chroma query failed, falling back: %s", exc)
                if self._tfidf is None:
                    self._tfidf = TfidfIndex(self.chunks)
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
