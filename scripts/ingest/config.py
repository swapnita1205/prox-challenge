from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
FILES_DIR = ROOT / "files"
DATA_DIR = ROOT / "data" / "generated"
ASSETS_DIR = ROOT / "public" / "manual-assets"

RENDER_DPI = 150
FIGURE_MIN_AREA = 15000  # PDF points² — skip icon fragments
IMAGE_MIN_WIDTH = 80
IMAGE_MIN_HEIGHT = 80

# Repeated header/footer lines to exclude from section headings
SKIP_HEADING_PATTERNS = [
    r"for technical questions",
    r"item 57812",
    r"safety\s*welding",
    r"maintenance\s*tig",
    r"save this manual",
]

PROCESS_KEYWORDS = [
    "mig",
    "flux-cored",
    "flux cored",
    "flux",
    "tig",
    "stick",
    "solid core",
    "gasless",
]

WARNING_PATTERNS = [
    (r"\bWARNING!?\b", "warning"),
    (r"\bWaRning!?\b", "warning"),
    (r"\bCAUTION!?\b", "caution"),
    (r"\bcaUtiOn!?\b", "caution"),
    (r"\bDANGER\b", "danger"),
    (r"tO pReVent", "warning"),
]

PART_CONTROL_KEYWORDS = [
    "wire feed",
    "tensioner",
    "idler arm",
    "ground clamp",
    "electrode holder",
    "mig gun",
    "tig torch",
    "power switch",
    "lcd display",
    "main control knob",
    "contact tip",
    "nozzle",
    "spool",
    "regulator",
    "foot pedal",
    "reset button",
]

DEFECT_KEYWORDS = [
    "porosity",
    "burn-through",
    "burn through",
    "spatter",
    "crooked",
    "wavy bead",
    "penetration",
    "slag",
]
