from pathlib import Path
import shutil
import re
from datetime import datetime

# =====================================================
# CHANGE THIS TO YOUR PDF FOLDER
# =====================================================
SOURCE_FOLDER = Path(r"C:\Users\eusuff.binselamat\Downloads\LM Cert\MEWP")
# =====================================================

# Regex to capture:
# YSL0001 (Expiry 01.10.26)
pattern = re.compile(
    r"(YSL\d+)\s*\(Expiry\s*([0-9]{2}\.[0-9]{2}\.(?:[0-9]{2}|[0-9]{4}))\)",
    re.IGNORECASE
)

for pdf in SOURCE_FOLDER.glob("*.pdf"):

    match = pattern.search(pdf.stem)

    if not match:
        print(f"Skipped: {pdf.name}")
        continue

    ysl = match.group(1).upper()
    expiry = match.group(2)

    # Convert 2-digit year to 4-digit
    try:
        if len(expiry.split(".")[-1]) == 2:
            expiry_date = datetime.strptime(expiry, "%d.%m.%y")
        else:
            expiry_date = datetime.strptime(expiry, "%d.%m.%Y")

        expiry = expiry_date.strftime("%d.%m.%Y")

    except Exception:
        print(f"Invalid date: {pdf.name}")
        continue

    # Create folder
    folder = SOURCE_FOLDER / ysl
    folder.mkdir(exist_ok=True)

    # Destination filename
    destination = folder / f"{expiry}.pdf"

    shutil.move(str(pdf), str(destination))

    print(f"Moved: {pdf.name} -> {destination}")
