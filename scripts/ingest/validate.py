"""Validation report for ingested manual data."""

from __future__ import annotations

import json
from collections import Counter, defaultdict
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from config import DATA_DIR, FILES_DIR


def load_json(name: str) -> Any:
    path = DATA_DIR / name
    if not path.exists():
        return None
    with open(path, encoding="utf-8") as f:
        return json.load(f)


def validate() -> dict:
    pages = load_json("pages.json") or []
    tables = load_json("tables.json") or []
    figures = load_json("figures.json") or []
    duty = load_json("duty-cycle.json") or []
    polarity = load_json("polarity.json") or []
    settings = load_json("settings.json") or []
    troubleshooting = load_json("troubleshooting.json") or []
    manifest = load_json("manifest.json") or {}

    issues: list[dict] = []

    # Expected pages per source
    import fitz

    for pdf in sorted(FILES_DIR.glob("*.pdf")):
        doc = fitz.open(pdf)
        expected = len(doc)
        doc.close()
        found = [p for p in pages if p["source"] == pdf.name]
        if len(found) != expected:
            issues.append(
                {
                    "severity": "error",
                    "category": "missing_pages",
                    "source": pdf.name,
                    "message": f"Expected {expected} pages, found {len(found)}",
                }
            )

    # Low text pages
    for p in pages:
        if p.get("textLength", 0) < 50:
            issues.append(
                {
                    "severity": "info",
                    "category": "image_only_page",
                    "source": p["source"],
                    "page": p["page"],
                    "message": f"Page has only {p['textLength']} chars — flagged for multimodal interpretation",
                }
            )

    # Duplicate figures by asset path
    paths = [f.get("provenance", {}).get("assetPath") for f in figures]
    path_counts = Counter(p for p in paths if p)
    for path, count in path_counts.items():
        if count > 1:
            issues.append(
                {
                    "severity": "warning",
                    "category": "duplicate_figure",
                    "message": f"Asset {path} referenced {count} times",
                }
            )

    # Tables needing review
    for t in tables:
        if t.get("needsReview"):
            issues.append(
                {
                    "severity": "warning",
                    "category": "table_needs_review",
                    "source": t["provenance"]["source"],
                    "page": t["provenance"]["page"],
                    "id": t["id"],
                    "message": f"Table {t['id']} needs manual verification (confidence={t['provenance'].get('confidence')})",
                }
            )

    # Duty cycle consistency — group by process+voltage+amps
    dc_groups: dict[str, list] = defaultdict(list)
    for d in duty:
        if d.get("needsReview"):
            issues.append(
                {
                    "severity": "warning",
                    "category": "duty_cycle_incomplete",
                    "id": d["id"],
                    "source": d["provenance"]["source"],
                    "page": d["provenance"]["page"],
                    "message": f"Duty cycle entry missing process or voltage: {d.get('amps')}A @ {d.get('dutyPercent')}%",
                }
            )
        key = f"{d.get('process')}|{d.get('inputVoltage')}|{d.get('amps')}|{d.get('dutyPercent')}"
        dc_groups[key].append(d)

    for key, entries in dc_groups.items():
        if len(entries) > 1:
            issues.append(
                {
                    "severity": "warning",
                    "category": "duplicate_duty_cycle",
                    "message": f"Duplicate duty cycle entries for {key}",
                    "count": len(entries),
                }
            )

    # Polarity entries needing review
    for pol in polarity:
        if pol.get("needsReview"):
            issues.append(
                {
                    "severity": "warning",
                    "category": "polarity_needs_review",
                    "id": pol["id"],
                    "source": pol["provenance"]["source"],
                    "page": pol["provenance"]["page"],
                    "message": "Polarity entry incomplete — verify sockets and type",
                }
            )

    # Settings requiring multimodal
    for s in settings:
        if s.get("needsMultimodalInterpretation"):
            issues.append(
                {
                    "severity": "info",
                    "category": "multimodal_required",
                    "id": s["id"],
                    "source": s["provenance"]["source"],
                    "page": s["provenance"]["page"],
                    "message": f"Settings/chart requires runtime vision: {s.get('type')}",
                }
            )

    # Extraction failures from manifest (table-level only as errors)
    for err in manifest.get("errors", []):
        severity = "error" if "tables:" in err and "extract failed" in err else "warning"
        issues.append(
            {
                "severity": severity,
                "category": "extraction_failure",
                "message": err,
            }
        )

    # MIG 200A 240V benchmark check (known from manual p7)
    mig_200_240 = [
        d
        for d in duty
        if d.get("amps") == 200
        and d.get("dutyPercent") == 25
        and (d.get("inputVoltage") == 240 or d.get("process") == "mig")
    ]
    if not mig_200_240:
        issues.append(
            {
                "severity": "warning",
                "category": "benchmark_missing",
                "message": "Could not verify MIG 25% @ 200A on 240V from extracted duty-cycle data",
            }
        )

    report = {
        "generatedAt": datetime.now(timezone.utc).isoformat(),
        "summary": {
            "totalIssues": len(issues),
            "errors": sum(1 for i in issues if i["severity"] == "error"),
            "warnings": sum(1 for i in issues if i["severity"] == "warning"),
            "info": sum(1 for i in issues if i["severity"] == "info"),
        },
        "issues": issues,
    }

    with open(DATA_DIR / "validation-report.json", "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    return report


if __name__ == "__main__":
    r = validate()
    print(json.dumps(r["summary"], indent=2))
