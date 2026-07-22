"""
Multimodal PDF extraction for WeldPilot manual ingestion.
Uses PyMuPDF (fitz) for text/bbox/images/rendering, pdfplumber for tables.
"""

from __future__ import annotations

import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

import fitz
import pdfplumber
from PIL import Image

from config import (
    ASSETS_DIR,
    DATA_DIR,
    DEFECT_KEYWORDS,
    FILES_DIR,
    FIGURE_MIN_AREA,
    IMAGE_MIN_HEIGHT,
    IMAGE_MIN_WIDTH,
    PART_CONTROL_KEYWORDS,
    PROCESS_KEYWORDS,
    RENDER_DPI,
    SKIP_HEADING_PATTERNS,
    WARNING_PATTERNS,
)
from ids import content_hash, slugify, stable_id


@dataclass
class Provenance:
    source: str
    page: int
    section: str | None = None
    bbox: list[float] | None = None
    extraction_method: str = "unknown"
    confidence: float = 0.5
    neighboring_text: str | None = None
    asset_path: str | None = None

    def to_dict(self) -> dict[str, Any]:
        d: dict[str, Any] = {
            "source": self.source,
            "page": self.page,
            "extractionMethod": self.extraction_method,
            "confidence": round(self.confidence, 3),
        }
        if self.section:
            d["section"] = self.section
        if self.bbox:
            d["bbox"] = [round(x, 2) for x in self.bbox]
        if self.neighboring_text:
            d["neighboringText"] = self.neighboring_text
        if self.asset_path:
            d["assetPath"] = self.asset_path
        return d


@dataclass
class IngestState:
    pages: list[dict] = field(default_factory=list)
    sections: list[dict] = field(default_factory=list)
    tables: list[dict] = field(default_factory=list)
    figures: list[dict] = field(default_factory=list)
    warnings: list[dict] = field(default_factory=list)
    entities: list[dict] = field(default_factory=list)
    relationships: list[dict] = field(default_factory=list)
    duty_cycles: list[dict] = field(default_factory=list)
    polarity: list[dict] = field(default_factory=list)
    settings: list[dict] = field(default_factory=list)
    troubleshooting: list[dict] = field(default_factory=list)
    parts: list[dict] = field(default_factory=list)
    defects: list[dict] = field(default_factory=list)
    current_section: str | None = None
    section_stack: list[str] = field(default_factory=list)
    figure_hashes: dict[str, str] = field(default_factory=dict)


def _bbox_from_block(block: dict) -> list[float]:
    return list(block.get("bbox", [0, 0, 0, 0]))


def _normalize_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", str(text)).strip()


def _is_skip_heading(text: str) -> bool:
    lower = text.lower()
    return any(re.search(p, lower) for p in SKIP_HEADING_PATTERNS)


def _detect_heading(span: dict, body_size: float) -> bool:
    size = span.get("size", 0)
    flags = span.get("flags", 0)
    bold = bool(flags & 2**4)
    text = (span.get("text") or "").strip()
    if not text or len(text) > 80 or _is_skip_heading(text):
        return False
    if size >= body_size + 3:
        return True
    if bold and size >= body_size + 1 and len(text) < 60:
        return True
    if text.isupper() and 8 <= len(text) <= 60 and size >= body_size:
        return True
    if re.match(r"^\d+\.\s+[A-Z]", text) and len(text) < 70:
        return True
    return False


def _body_font_size(blocks: list[dict]) -> float:
    sizes: list[float] = []
    for block in blocks:
        if block.get("type") != 0:
            continue
        for line in block.get("lines", []):
            for span in line.get("spans", []):
                t = span.get("text", "").strip()
                if t and len(t) > 2:
                    sizes.append(span.get("size", 10))
    if not sizes:
        return 10.0
    sizes.sort()
    return sizes[len(sizes) // 2]


def _neighboring_text(page_dict: dict, bbox: list[float], radius: float = 40) -> str:
    x0, y0, x1, y1 = bbox
    expanded = [x0 - radius, y0 - radius, x1 + radius, y1 + radius]
    parts: list[str] = []
    for block in page_dict.get("blocks", []):
        if block.get("type") != 0:
            continue
        bb = block.get("bbox", [0, 0, 0, 0])
        if bb[2] >= expanded[0] and bb[0] <= expanded[2] and bb[3] >= expanded[1] and bb[1] <= expanded[3]:
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if t:
                        parts.append(t)
    return _normalize_text(" ".join(parts))[:500]


def _extract_processes(text: str) -> list[str]:
    lower = text.lower()
    found: list[str] = []
    mapping = {
        "mig": "mig",
        "flux-cored": "flux",
        "flux cored": "flux",
        "gasless": "flux",
        "solid core": "mig",
        "tig": "tig",
        "stick": "stick",
    }
    for key, val in mapping.items():
        if key in lower and val not in found:
            found.append(val)
    return found


def _parse_duty_from_text(text: str, source: str, page: int, section: str | None, state: IngestState):
    patterns = [
        (r"(\d+)\s*%\s*@\s*(\d+)\s*A", "rated"),
        (r"100\s*%\s*(?:@|Continuous Use at|Continuous use at)\s*(\d+)\s*A", "continuous"),
        (r"(\d+)\s*VAC", "voltage"),
    ]
    voltage = None
    process = None
    lower = text.lower()
    for p in PROCESS_KEYWORDS:
        if p in lower:
            process = _extract_processes(p)[0] if _extract_processes(p) else None
            break

    vm = re.search(r"(\d{3})\s*VAC", text)
    if vm:
        voltage = int(vm.group(1))

    for m in re.finditer(r"(\d+)\s*%\s*@\s*(\d+)\s*A", text):
        pct, amps = int(m.group(1)), int(m.group(2))
        dc_id = stable_id(source, page, "duty", suffix=content_hash(f"{pct}-{amps}"))
        entry = {
            "id": dc_id,
            "process": process,
            "inputVoltage": voltage,
            "dutyPercent": pct,
            "amps": amps,
            "provenance": Provenance(
                source=source,
                page=page,
                section=section,
                extraction_method="regex_text",
                confidence=0.7 if process and voltage else 0.5,
                neighboring_text=text[:300],
            ).to_dict(),
            "needsReview": not (process and voltage),
        }
        state.duty_cycles.append(entry)

    for m in re.finditer(r"100\s*%\s*(?:@|Continuous Use at|Continuous use at)\s*(\d+)\s*A", text, re.I):
        amps = int(m.group(1))
        dc_id = stable_id(source, page, "duty-cont", suffix=content_hash(str(amps)))
        state.duty_cycles.append(
            {
                "id": dc_id,
                "process": process,
                "inputVoltage": voltage,
                "dutyPercent": 100,
                "amps": amps,
                "continuous": True,
                "provenance": Provenance(
                    source=source,
                    page=page,
                    section=section,
                    extraction_method="regex_text",
                    confidence=0.7 if process and voltage else 0.5,
                    neighboring_text=text[:300],
                ).to_dict(),
                "needsReview": not (process and voltage),
            }
        )


def _extract_polarity(text: str, source: str, page: int, section: str | None, state: IngestState):
    lower = re.sub(r"\s+", " ", text).lower()
    if not any(k in lower for k in ["polarity", "dcep", "dcen", "socket", "ground clamp cable"]):
        return

    polarity_type = None
    if "dcep" in lower or "electrode positive" in lower:
        polarity_type = "DCEP"
    elif "dcen" in lower or "electrode negative" in lower:
        polarity_type = "DCEN"

    process = None
    if "flux" in lower or "gasless" in lower:
        process = "flux"
    elif "solid core" in lower or "gas shielded" in lower:
        process = "mig-solid"
    elif "tig" in lower:
        process = "tig"
    elif "stick" in lower:
        process = "stick"

    ground_socket = None
    electrode_socket = None
    if re.search(r"ground clamp cable[^.\n]{0,40}(?:into|in)[^.\n]{0,20}positive", lower):
        ground_socket = "positive"
    if re.search(r"ground clamp cable[^.\n]{0,40}(?:into|in)[^.\n]{0,20}negative", lower):
        ground_socket = "negative"
    if re.search(r"(?:wire feed\s*)?power cable[^.\n]{0,40}(?:into|in)[^.\n]{0,20}positive", lower):
        electrode_socket = "positive"
    if re.search(r"(?:wire feed\s*)?power cable[^.\n]{0,40}(?:into|in)[^.\n]{0,20}negative", lower):
        electrode_socket = "negative"

    pid = stable_id(source, page, "polarity", suffix=content_hash(f"{polarity_type}-{process}-{ground_socket}-{electrode_socket}-{text[:40]}"))
    # Skip near-duplicate polarity records on same page
    existing = [p for p in state.polarity if p["id"] == pid]
    if existing:
        return
    state.polarity.append(
        {
            "id": pid,
            "polarityType": polarity_type,
            "process": process,
            "groundSocket": ground_socket,
            "electrodeSocket": electrode_socket,
            "instructions": _normalize_text(text)[:1000],
            "provenance": Provenance(
                source=source,
                page=page,
                section=section,
                extraction_method="regex_section_text",
                confidence=0.85 if polarity_type and ground_socket else 0.55,
                neighboring_text=text[:400],
            ).to_dict(),
            "needsReview": not (polarity_type and (ground_socket or electrode_socket)),
        }
    )


def _extract_wire_feed(text: str, source: str, page: int, section: str | None, state: IngestState):
    lower = text.lower()
    if not any(k in lower for k in ["wire feed", "tensioner", "idler", "ctwd", "drive roll"]):
        return
    eid = stable_id(source, page, "wire-feed", suffix=content_hash(text[:60]))
    state.entities.append(
        {
            "id": eid,
            "type": "wire_feed_instruction",
            "label": "Wire feed / tension instruction",
            "text": _normalize_text(text)[:800],
            "processes": _extract_processes(text),
            "provenance": Provenance(
                source=source,
                page=page,
                section=section,
                extraction_method="keyword_section",
                confidence=0.75,
                neighboring_text=text[:300],
            ).to_dict(),
        }
    )


def _extract_warnings(text: str, source: str, page: int, section: str | None, state: IngestState, bbox: list[float] | None = None):
    for pattern, level in WARNING_PATTERNS:
        for m in re.finditer(pattern, text, re.I):
            start = max(0, m.start() - 20)
            snippet = _normalize_text(text[start : start + 400])
            wid = stable_id(source, page, "warn", suffix=content_hash(snippet[:80]))
            state.warnings.append(
                {
                    "id": wid,
                    "level": level,
                    "text": snippet,
                    "provenance": Provenance(
                        source=source,
                        page=page,
                        section=section,
                        bbox=bbox,
                        extraction_method="regex_warning",
                        confidence=0.9,
                        neighboring_text=snippet,
                    ).to_dict(),
                }
            )


def _extract_entities_from_text(text: str, source: str, page: int, section: str | None, state: IngestState):
    lower = text.lower()
    for kw in PART_CONTROL_KEYWORDS:
        if kw in lower:
            eid = stable_id(source, page, "entity", suffix=content_hash(kw))
            state.entities.append(
                {
                    "id": eid,
                    "type": "part_or_control",
                    "label": kw.title(),
                    "text": _normalize_text(text)[:400],
                    "processes": _extract_processes(text),
                    "provenance": Provenance(
                        source=source,
                        page=page,
                        section=section,
                        extraction_method="keyword_match",
                        confidence=0.8,
                    ).to_dict(),
                }
            )

    for kw in DEFECT_KEYWORDS:
        if kw in lower:
            did = stable_id(source, page, "defect", suffix=content_hash(kw))
            defect = {
                "id": did,
                "defect": kw,
                "description": _normalize_text(text)[:600],
                "causes": [],
                "corrections": [],
                "processes": _extract_processes(text),
                "provenance": Provenance(
                    source=source,
                    page=page,
                    section=section,
                    extraction_method="keyword_defect_section",
                    confidence=0.7,
                    neighboring_text=text[:300],
                ).to_dict(),
                "needsReview": True,
            }
            # Parse numbered causes/solutions
            for cm in re.finditer(r"(\d+)\.\s*([^:]+):\s*([^.]+\.?)", text):
                defect["causes"].append(_normalize_text(cm.group(2) + ": " + cm.group(3)))
            state.defects.append(defect)
            state.entities.append(
                {
                    "id": stable_id(source, page, "entity-defect", suffix=content_hash(kw)),
                    "type": "weld_defect",
                    "label": kw.title(),
                    "text": _normalize_text(text)[:400],
                    "processes": _extract_processes(text),
                    "provenance": Provenance(
                        source=source,
                        page=page,
                        section=section,
                        extraction_method="keyword_match",
                        confidence=0.75,
                    ).to_dict(),
                }
            )


def _extract_troubleshooting_table(
    table: list[list[str | None]],
    source: str,
    page: int,
    section: str | None,
    state: IngestState,
    bbox: list[float] | None,
    table_index: int,
):
    if not table or len(table) < 2:
        return
    header = [_normalize_text(c).lower() for c in table[0]]
    is_trouble = any("problem" in h or "cause" in h or "solution" in h for h in header)
    if not is_trouble and len(table[0]) < 2:
        return

    col_problem = next((i for i, h in enumerate(header) if "problem" in h), 0)
    col_causes = next((i for i, h in enumerate(header) if "cause" in h), 1)
    col_solutions = next((i for i, h in enumerate(header) if "solution" in h), 2 if len(header) > 2 else 1)

    for row_idx, row in enumerate(table[1:], start=1):
        if not row or all(not c for c in row):
            continue
        problem = _normalize_text(row[col_problem] if col_problem < len(row) else None)
        causes = _normalize_text(row[col_causes] if col_causes < len(row) else None)
        solutions = _normalize_text(row[col_solutions] if col_solutions < len(row) else None)
        if not problem and not causes:
            continue

        tid = stable_id(source, page, "trouble", seq=table_index * 100 + row_idx)
        entry = {
            "id": tid,
            "problem": problem,
            "possibleCauses": causes,
            "likelySolutions": solutions,
            "processes": _extract_processes(problem + " " + causes),
            "provenance": Provenance(
                source=source,
                page=page,
                section=section,
                bbox=bbox,
                extraction_method="pdfplumber_table",
                confidence=0.8 if problem and solutions else 0.6,
                neighboring_text=f"{problem} | {causes}"[:400],
            ).to_dict(),
            "needsReview": len(problem) < 5,
        }
        state.troubleshooting.append(entry)
        state.relationships.append(
            {
                "id": stable_id(source, page, "rel", suffix=content_hash(tid)),
                "type": "troubleshooting",
                "from": problem,
                "via": causes,
                "to": solutions,
                "sourceId": tid,
            }
        )


def _table_to_records(
    table: list[list[str | None]],
    source: str,
    page: int,
    section: str | None,
    state: IngestState,
    bbox: list[float] | None,
    table_index: int,
    confidence: float,
):
    tid = stable_id(source, page, "table", seq=table_index)
    headers = [_normalize_text(c) for c in (table[0] if table else [])]
    rows = []
    for row in table[1:] if len(table) > 1 else []:
        rows.append([_normalize_text(c) for c in row])

    # Detect specs / duty cycle tables
    header_text = " ".join(headers).lower()
    is_specs = any(k in header_text for k in ["duty", "current", "voltage", "mig", "tig", "stick", "specification"])
    is_parts = any(k in header_text for k in ["part", "item", "qty", "quantity", "description"])

    record = {
        "id": tid,
        "headers": headers,
        "rows": rows,
        "rowCount": len(rows),
        "columnCount": len(headers),
        "category": "specifications" if is_specs else ("parts_list" if is_parts else "general"),
        "provenance": Provenance(
            source=source,
            page=page,
            section=section,
            bbox=bbox,
            extraction_method="pdfplumber_table",
            confidence=confidence,
            neighboring_text=" | ".join(headers)[:300],
        ).to_dict(),
        "needsReview": confidence < 0.7 or len(rows) == 0,
    }
    state.tables.append(record)

    if is_specs:
        for row in rows:
            row_text = " ".join(row)
            _parse_duty_from_text(row_text, source, page, section, state)

    if is_parts:
        for row_idx, row in enumerate(rows):
            if len(row) >= 2:
                pid = stable_id(source, page, "part", seq=row_idx)
                state.parts.append(
                    {
                        "id": pid,
                        "cells": row,
                        "provenance": Provenance(
                            source=source,
                            page=page,
                            section=section,
                            bbox=bbox,
                            extraction_method="pdfplumber_table_row",
                            confidence=confidence,
                        ).to_dict(),
                        "needsReview": True,
                    }
                )

    _extract_troubleshooting_table(table, source, page, section, state, bbox, table_index)


def extract_pdf(source_filename: str, state: IngestState) -> list[str]:
    """Extract one PDF. Returns list of error messages."""
    errors: list[str] = []
    pdf_path = FILES_DIR / source_filename
    slug = slugify(source_filename)
    asset_dir = ASSETS_DIR / slug
    asset_dir.mkdir(parents=True, exist_ok=True)

    fitz_doc = fitz.open(pdf_path)
    plumber_doc = pdfplumber.open(pdf_path)

    for page_num in range(len(fitz_doc)):
        page_index = page_num + 1
        fitz_page = fitz_doc[page_num]
        plumber_page = plumber_doc.pages[page_num]
        page_dict = fitz_page.get_text("dict")
        blocks = page_dict.get("blocks", [])
        text_blocks = [b for b in blocks if b.get("type") == 0]
        plain_text = fitz_page.get_text("text").strip()
        body_size = _body_font_size(blocks)

        # Full-page render
        render_name = f"p{page_index:02d}.png"
        render_path = asset_dir / render_name
        try:
            pix = fitz_page.get_pixmap(dpi=RENDER_DPI, alpha=False)
            pix.save(str(render_path))
            render_rel = f"/manual-assets/{slug}/{render_name}"
        except Exception as e:
            render_rel = None
            errors.append(f"{source_filename} p{page_index}: render failed: {e}")

        text_confidence = min(1.0, len(plain_text) / 200) if plain_text else 0.1
        image_only = len(plain_text) < 50

        page_id = stable_id(source_filename, page_index, "page")
        page_record = {
            "id": page_id,
            "source": source_filename,
            "page": page_index,
            "text": plain_text,
            "textLength": len(plain_text),
            "textBlockCount": len(text_blocks),
            "imageCount": len(fitz_page.get_images(full=True)),
            "imageOnly": image_only,
            "provenance": Provenance(
                source=source_filename,
                page=page_index,
                extraction_method="pymupdf_text",
                confidence=text_confidence,
                asset_path=render_rel,
            ).to_dict(),
            "renderAssetPath": render_rel,
            "needsMultimodalInterpretation": image_only,
        }
        state.pages.append(page_record)

        if image_only:
            fig_id = stable_id(source_filename, page_index, "figure", seq=0, suffix="fullpage")
            state.figures.append(
                {
                    "id": fig_id,
                    "kind": "full_page_image_only",
                    "caption": None,
                    "provenance": Provenance(
                        source=source_filename,
                        page=page_index,
                        extraction_method="pymupdf_render",
                        confidence=0.95,
                        asset_path=render_rel,
                        neighboring_text=plain_text or None,
                    ).to_dict(),
                    "needsMultimodalInterpretation": True,
                }
            )
            state.settings.append(
                {
                    "id": stable_id(source_filename, page_index, "settings-img"),
                    "type": "process_selection_chart" if "selection" in source_filename else "image_only_page",
                    "data": None,
                    "provenance": Provenance(
                        source=source_filename,
                        page=page_index,
                        extraction_method="image_only_preserved",
                        confidence=0.2,
                        asset_path=render_rel,
                    ).to_dict(),
                    "needsMultimodalInterpretation": True,
                    "needsReview": True,
                }
            )

        # Section headings from text blocks
        seen_headings_on_page: set[str] = set()
        for block in text_blocks:
            block_text_parts: list[str] = []
            heading_spans: list[str] = []
            for line in block.get("lines", []):
                for span in line.get("spans", []):
                    t = span.get("text", "").strip()
                    if not t:
                        continue
                    block_text_parts.append(t)
                    if _detect_heading(span, body_size):
                        heading_spans.append(t)

            block_text = _normalize_text(" ".join(block_text_parts))
            bbox = _bbox_from_block(block)

            if heading_spans:
                for h in heading_spans:
                    if h in seen_headings_on_page:
                        continue
                    seen_headings_on_page.add(h)
                    hid = stable_id(source_filename, page_index, "section", suffix=content_hash(h))
                    state.sections.append(
                        {
                            "id": hid,
                            "title": h,
                            "level": 1 if h.isupper() else 2,
                            "parentId": None,
                            "provenance": Provenance(
                                source=source_filename,
                                page=page_index,
                                section=h,
                                bbox=bbox,
                                extraction_method="pymupdf_font_heuristic",
                                confidence=0.75,
                                neighboring_text=block_text[:300],
                            ).to_dict(),
                        }
                    )
                    state.current_section = h

            if block_text:
                _extract_warnings(block_text, source_filename, page_index, state.current_section, state, bbox)
                _extract_polarity(block_text, source_filename, page_index, state.current_section, state)
                _extract_wire_feed(block_text, source_filename, page_index, state.current_section, state)
                _extract_entities_from_text(block_text, source_filename, page_index, state.current_section, state)
                _parse_duty_from_text(block_text, source_filename, page_index, state.current_section, state)

        # Page-level structured passes (cross-block context)
        if plain_text:
            _extract_polarity(plain_text, source_filename, page_index, state.current_section, state)
            _parse_duty_from_text(plain_text, source_filename, page_index, state.current_section, state)
        for img_idx, img_info in enumerate(fitz_page.get_images(full=True)):
            xref = img_info[0]
            try:
                base = fitz_doc.extract_image(xref)
                img_bytes = base["image"]
                width = base.get("width", 0)
                height = base.get("height", 0)
                if width < IMAGE_MIN_WIDTH or height < IMAGE_MIN_HEIGHT:
                    continue

                ext = base.get("ext", "png")
                img_name = f"p{page_index:02d}-img-{img_idx:03d}.{ext}"
                img_path = asset_dir / img_name
                img_path.write_bytes(img_bytes)

                # Get image bbox on page
                img_bbox = None
                area = width * height
                for rect in fitz_page.get_image_rects(xref):
                    img_bbox = [rect.x0, rect.y0, rect.x1, rect.y1]
                    area = (rect.x1 - rect.x0) * (rect.y1 - rect.y0)
                    break

                if area < FIGURE_MIN_AREA:
                    img_path.unlink(missing_ok=True)
                    continue

                img_rel = f"/manual-assets/{slug}/{img_name}"
                h = content_hash(img_bytes[:2000])
                if h in state.figure_hashes:
                    continue
                state.figure_hashes[h] = img_rel

                neighbor = _neighboring_text(page_dict, img_bbox or [0, 0, 0, 0])
                fig_id = stable_id(source_filename, page_index, "figure", seq=img_idx)
                is_diagram = area >= FIGURE_MIN_AREA

                state.figures.append(
                    {
                        "id": fig_id,
                        "kind": "embedded_image",
                        "caption": neighbor[:200] if neighbor else None,
                        "width": base.get("width"),
                        "height": base.get("height"),
                        "area": area,
                        "isDiagram": is_diagram,
                        "provenance": Provenance(
                            source=source_filename,
                            page=page_index,
                            section=state.current_section,
                            bbox=img_bbox,
                            extraction_method="pymupdf_extract_image",
                            confidence=0.9,
                            neighboring_text=neighbor,
                            asset_path=img_rel,
                        ).to_dict(),
                        "needsMultimodalInterpretation": not neighbor,
                    }
                )
            except Exception as e:
                errors.append(f"{source_filename} p{page_index} img{img_idx}: {e}")

        # Tables via pdfplumber
        try:
            found_tables = plumber_page.find_tables()
            for t_idx, table_obj in enumerate(found_tables):
                bbox = list(table_obj.bbox) if table_obj.bbox else None
                try:
                    extracted = table_obj.extract()
                except Exception as te:
                    errors.append(f"{source_filename} p{page_index} table{t_idx}: extract failed: {te}")
                    extracted = None
                if not extracted:
                    # Preserve table region as crop if bbox available
                    if bbox and render_rel:
                        crop_id = stable_id(source_filename, page_index, "table-crop", seq=t_idx)
                        try:
                            clip = fitz.Rect(bbox)
                            crop_pix = fitz_page.get_pixmap(dpi=RENDER_DPI, clip=clip, alpha=False)
                            crop_name = f"p{page_index:02d}-table-{t_idx:03d}.png"
                            crop_pix.save(str(asset_dir / crop_name))
                            crop_rel = f"/manual-assets/{slug}/{crop_name}"
                            state.tables.append(
                                {
                                    "id": crop_id,
                                    "headers": [],
                                    "rows": [],
                                    "category": "unextracted_table_image",
                                    "provenance": Provenance(
                                        source=source_filename,
                                        page=page_index,
                                        section=state.current_section,
                                        bbox=bbox,
                                        extraction_method="pymupdf_table_crop",
                                        confidence=0.4,
                                        asset_path=crop_rel,
                                    ).to_dict(),
                                    "needsReview": True,
                                    "needsMultimodalInterpretation": True,
                                }
                            )
                        except Exception as ce:
                            errors.append(f"{source_filename} p{page_index} table crop: {ce}")
                    continue

                # Table confidence from cell fill ratio
                total_cells = sum(len(r) for r in extracted)
                filled = sum(
                    1
                    for r in extracted
                    for c in r
                    if c is not None and str(c).strip()
                )
                conf = filled / total_cells if total_cells else 0.5

                _table_to_records(
                    extracted,
                    source_filename,
                    page_index,
                    state.current_section,
                    state,
                    bbox,
                    t_idx,
                    conf,
                )
        except Exception as e:
            errors.append(f"{source_filename} p{page_index} tables: {e}")
            extracted = None
            found_tables = []

    fitz_doc.close()
    plumber_doc.close()
    return errors


def dedupe_duty_cycles(state: IngestState):
    seen: set[tuple] = set()
    unique: list[dict] = []
    for d in state.duty_cycles:
        key = (
            d.get("process"),
            d.get("inputVoltage"),
            d.get("amps"),
            d.get("dutyPercent"),
            d.get("continuous"),
            d["provenance"]["source"],
            d["provenance"]["page"],
        )
        if key in seen:
            continue
        seen.add(key)
        unique.append(d)
    state.duty_cycles = unique


def enrich_duty_from_specs_tables(state: IngestState):
    """Parse page-7 style specification tables into structured duty-cycle records."""
    process_map = {"mig": "mig", "tig": "tig", "stick": "stick"}

    for table in state.tables:
        if table.get("category") != "specifications":
            continue
        headers = table.get("headers") or []
        if not headers:
            continue
        process = process_map.get(headers[0].lower().strip())
        if not process:
            continue

        source = table["provenance"]["source"]
        page = table["provenance"]["page"]
        section = table["provenance"].get("section")

        for row in table.get("rows", []):
            if not row or "duty" not in row[0].lower():
                continue
            for col_idx, cell in enumerate(row[1:], start=1):
                if not cell:
                    continue
                voltage = 120 if col_idx == 1 else 240
                cell_text = _normalize_text(cell)

                for m in re.finditer(r"(\d+)\s*%\s*@\s*(\d+)\s*A", cell_text):
                    pct, amps = int(m.group(1)), int(m.group(2))
                    dc_id = stable_id(source, page, "duty", suffix=content_hash(f"{process}-{voltage}-{pct}-{amps}"))
                    state.duty_cycles.append(
                        {
                            "id": dc_id,
                            "process": process,
                            "inputVoltage": voltage,
                            "dutyPercent": pct,
                            "amps": amps,
                            "continuous": False,
                            "provenance": Provenance(
                                source=source,
                                page=page,
                                section=section or headers[0],
                                extraction_method="pdfplumber_specs_table",
                                confidence=0.95,
                                neighboring_text=cell_text,
                            ).to_dict(),
                            "needsReview": False,
                        }
                    )

                for m in re.finditer(
                    r"100\s*%\s*@\s*(\d+)\s*A", cell_text, re.I
                ):
                    amps = int(m.group(1))
                    dc_id = stable_id(source, page, "duty-cont", suffix=content_hash(f"{process}-{voltage}-100-{amps}"))
                    state.duty_cycles.append(
                        {
                            "id": dc_id,
                            "process": process,
                            "inputVoltage": voltage,
                            "dutyPercent": 100,
                            "amps": amps,
                            "continuous": True,
                            "provenance": Provenance(
                                source=source,
                                page=page,
                                section=section or headers[0],
                                extraction_method="pdfplumber_specs_table",
                                confidence=0.95,
                                neighboring_text=cell_text,
                            ).to_dict(),
                            "needsReview": False,
                        }
                    )


def dedupe_sections(state: IngestState):
    seen: set[tuple] = set()
    unique: list[dict] = []
    for s in state.sections:
        key = (s["provenance"]["source"], s["provenance"]["page"], s["title"])
        if key in seen:
            continue
        seen.add(key)
        unique.append(s)
    state.sections = unique


def dedupe_entities(state: IngestState):
    seen: set[str] = set()
    unique = []
    for e in state.entities:
        key = f"{e['type']}:{e['label']}:{e['provenance']['source']}:{e['provenance']['page']}"
        if key in seen:
            continue
        seen.add(key)
        unique.append(e)
    state.entities = unique


def write_outputs(state: IngestState, errors: list[str], elapsed_sec: float):
    DATA_DIR.mkdir(parents=True, exist_ok=True)

    manifest = {
        "version": 2,
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "elapsedSeconds": round(elapsed_sec, 2),
        "sources": sorted(p.name for p in FILES_DIR.glob("*.pdf")),
        "counts": {
            "pages": len(state.pages),
            "sections": len(state.sections),
            "tables": len(state.tables),
            "figures": len(state.figures),
            "warnings": len(state.warnings),
            "entities": len(state.entities),
            "relationships": len(state.relationships),
            "dutyCycles": len(state.duty_cycles),
            "polarity": len(state.polarity),
            "settings": len(state.settings),
            "troubleshooting": len(state.troubleshooting),
            "defects": len(state.defects),
            "parts": len(state.parts),
        },
        "errors": errors,
    }

    outputs = {
        "pages.json": state.pages,
        "sections.json": state.sections,
        "tables.json": state.tables,
        "figures.json": state.figures,
        "warnings.json": state.warnings,
        "entities.json": state.entities,
        "relationships.json": state.relationships,
        "duty-cycle.json": state.duty_cycles,
        "polarity.json": state.polarity,
        "settings.json": state.settings,
        "troubleshooting.json": state.troubleshooting,
        "defects.json": state.defects,
        "parts.json": state.parts,
        "manifest.json": manifest,
    }

    for name, data in outputs.items():
        path = DATA_DIR / name
        with open(path, "w", encoding="utf-8") as f:
            json.dump(data, f, indent=2, ensure_ascii=False)

    # Legacy compatibility
    chunks = []
    for p in state.pages:
        if p["textLength"] < 20:
            continue
        chunks.append(
            {
                "id": stable_id(p["source"], p["page"], "chunk"),
                "source": p["source"],
                "page": p["page"],
                "text": p["text"][:2000],
                "topics": [],
                "processes": _extract_processes(p["text"]),
            }
        )
    with open(DATA_DIR / "chunks.json", "w", encoding="utf-8") as f:
        json.dump({"version": 2, "chunks": chunks}, f, indent=2)

    asset_manifest = {
        "version": 2,
        "assets": [
            {
                "id": f["id"],
                "source": f["provenance"]["source"],
                "page": f["provenance"]["page"],
                "path": f["provenance"].get("assetPath"),
                "caption": f.get("caption"),
                "kind": f.get("kind"),
            }
            for f in state.figures
            if f.get("provenance", {}).get("assetPath")
        ]
        + [
            {
                "id": p["id"],
                "source": p["source"],
                "page": p["page"],
                "path": p.get("renderAssetPath"),
                "caption": f"Full page render — {p['source']} p{p['page']}",
                "kind": "page_render",
            }
            for p in state.pages
            if p.get("renderAssetPath")
        ],
    }
    with open(DATA_DIR / "asset-manifest.json", "w", encoding="utf-8") as f:
        json.dump(asset_manifest, f, indent=2)

    return manifest
