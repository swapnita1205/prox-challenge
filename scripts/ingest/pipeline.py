#!/usr/bin/env python3
"""WeldPilot offline ingestion pipeline."""

from __future__ import annotations

import sys
import time
from pathlib import Path

# Ensure ingest package on path
sys.path.insert(0, str(Path(__file__).resolve().parent))

from config import FILES_DIR
from extract import (
    IngestState,
    dedupe_duty_cycles,
    dedupe_entities,
    dedupe_sections,
    enrich_duty_from_specs_tables,
    extract_pdf,
    write_outputs,
)
from validate import validate


def main() -> int:
    t0 = time.time()
    state = IngestState()
    all_errors: list[str] = []

    pdfs = sorted(FILES_DIR.glob("*.pdf"))
    if not pdfs:
        print("ERROR: No PDFs found in files/", file=sys.stderr)
        return 1

    print(f"WeldPilot ingest — {len(pdfs)} source PDF(s)")
    for pdf in pdfs:
        print(f"  Extracting {pdf.name}...")
        errs = extract_pdf(pdf.name, state)
        all_errors.extend(errs)
        if errs:
            for e in errs:
                print(f"    WARN: {e}")

    dedupe_sections(state)
    enrich_duty_from_specs_tables(state)
    dedupe_duty_cycles(state)
    dedupe_entities(state)
    elapsed = time.time() - t0
    manifest = write_outputs(state, all_errors, elapsed)

    print("\nExtraction complete:")
    for k, v in manifest["counts"].items():
        print(f"  {k}: {v}")

    print("\nRunning validation...")
    report = validate()
    print(
        f"  Issues: {report['summary']['totalIssues']} "
        f"(errors={report['summary']['errors']}, "
        f"warnings={report['summary']['warnings']}, "
        f"info={report['summary']['info']})"
    )
    print(f"\nDone in {elapsed:.1f}s")
    return 0 if report["summary"]["errors"] == 0 else 1


if __name__ == "__main__":
    raise SystemExit(main())
