import hashlib
import re
from typing import Union


def slugify(name: str) -> str:
    base = re.sub(r"\.pdf$", "", name, flags=re.I)
    return re.sub(r"[^a-z0-9]+", "-", base.lower()).strip("-")


def stable_id(source: str, page: int, kind: str, seq: int = 0, suffix: str = "") -> str:
    slug = slugify(source)
    parts = [slug, f"p{page:02d}", kind]
    if seq:
        parts.append(f"{seq:03d}")
    if suffix:
        parts.append(suffix)
    return "-".join(parts)


def content_hash(data: Union[str, bytes]) -> str:
    if isinstance(data, bytes):
        return hashlib.sha256(data).hexdigest()[:12]
    return hashlib.sha256(data.encode("utf-8")).hexdigest()[:12]
