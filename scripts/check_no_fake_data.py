"""
check_no_fake_data.py — Rigorous audit script for forbidden synthetic / mock / random data.

Scans the data pipeline, scoring engines, spatial analysis services, routing services,
and data folders to ensure no mock, random, fake, or synthetic data feeds the analysis.

Exits with code 1 if violations are found, code 0 if completely clean.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

WORKSPACE_ROOT = Path(__file__).parent.parent
TARGET_DIRS = [
    WORKSPACE_ROOT / "backend" / "app",
    WORKSPACE_ROOT / "backend" / "scripts",
    WORKSPACE_ROOT / "scripts",
    WORKSPACE_ROOT / "src" / "lib" / "sitescope",
]

# Patterns strictly forbidden in data pipeline and scoring paths
FORBIDDEN_PATTERNS = [
    (r"\bnp\.random\b", "Forbidden np.random usage"),
    (r"\brandom\.uniform\b", "Forbidden random.uniform usage"),
    (r"\brandom\.random\b", "Forbidden random.random usage"),
    (r"\brandom\.randint\b", "Forbidden random.randint usage"),
    (r"\bfaker\b", "Forbidden faker library usage"),
    (r"\bmake_synthetic_city\b", "Forbidden synthetic city generator"),
    (r"\"synthetic\":\s*True", "Forbidden synthetic flag marked True in code/data"),
    (r"\"synthetic\":\s*true", "Forbidden synthetic flag marked true in code/data"),
    (r"Synthetic mobility footfall traces", "Forbidden synthetic data label"),
    (r"Synthetic census proxy", "Forbidden synthetic census data"),
    (r"Synthetic road/transit graph", "Forbidden synthetic transportation graph"),
    (r"Synthetic POI dataset", "Forbidden synthetic POI dataset"),
    (r"Synthetic zoning", "Forbidden synthetic zoning dataset"),
    (r"Synthetic flood/AQI", "Forbidden synthetic flood/AQI dataset"),
    (r"mulberry32", "Forbidden pseudo-random generator in data/scoring"),
]

# Files explicitly exempted (e.g., this checker script itself, sensitivity analysis with Monte Carlo over weights)
EXEMPT_FILES = {
    "check_no_fake_data.py",
    "sensitivity.py",  # Monte Carlo jitter over weights is permitted by rule 1
}


def scan_file(file_path: Path) -> list[str]:
    violations = []
    if file_path.name in EXEMPT_FILES:
        return violations

    try:
        content = file_path.read_text(encoding="utf-8", errors="ignore")
    except Exception as e:
        return [f"Could not read {file_path}: {e}"]

    for line_no, line in enumerate(content.splitlines(), start=1):
        for pattern, desc in FORBIDDEN_PATTERNS:
            if re.search(pattern, line):
                # Check for special exemption comments if any
                if "# allowed-randomness" in line or "# allowed-test" in line:
                    continue
                violations.append(
                    f"[{file_path.relative_to(WORKSPACE_ROOT)}:{line_no}] {desc} -> {line.strip()}"
                )

    return violations


def main():
    # Ensure UTF-8 output on Windows consoles
    if sys.stdout.encoding.lower() != "utf-8":
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")

    print("=" * 70)
    print("[AUDIT] RUNNING REAL-DATA COMPLIANCE AUDIT (check_no_fake_data.py)")
    print("=" * 70)

    all_violations = []

    for target_dir in TARGET_DIRS:
        if not target_dir.exists():
            continue
        for ext in ("*.py", "*.ts", "*.json", "*.parquet"):
            for file_path in target_dir.rglob(ext):
                v = scan_file(file_path)
                if v:
                    all_violations.extend(v)

    # Check data/ directory if it exists
    data_dir = WORKSPACE_ROOT / "data"
    if data_dir.exists():
        for meta_file in data_dir.rglob("meta.json"):
            v = scan_file(meta_file)
            if v:
                all_violations.extend(v)

    if all_violations:
        print(f"\n❌ FAILED: Found {len(all_violations)} forbidden fake/synthetic data occurrences:\n")
        for v in all_violations:
            print(f"  • {v}")
        print("\n" + "=" * 70)
        sys.exit(1)
    else:
        print("\n✅ PASSED: Zero fake/mock/synthetic data violations found in target paths.")
        print("=" * 70)
        sys.exit(0)


if __name__ == "__main__":
    main()
