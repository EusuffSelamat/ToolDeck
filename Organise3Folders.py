from pathlib import Path
import shutil

# ======================================================
# CHANGE THIS TO YOUR MAIN EQUIPMENT FOLDER
# ======================================================
ROOT = Path(r"\\apdc-ext01\SGData\SG_Service\Operator\Invoice")

# Folder containing new files to sort
SOURCE = ROOT 
# ======================================================

equipment = {
    "Spider Crane": [
        "YC054","YC043","YC052","YC051","YC065","YC083",
        "YC076","YC079","YC077","YC063","YC074","YC106",
        "YC094","YC061"
    ],

    "Boom Lift": [
        "YAB740","YAB743","YAB746","YAB663","YAB733",
        "YAB665","SAB0021","SAB0022","SAB0023","SAB0024"
    ],

    "Scissor Lift": [
        "YSL662","YSL646","YSL669","YSL671","YSL727",
        "YSL1683","YSL1699","YSL1710","YSL1716","YSL1717",
        "YSL1731","YSL1732","YSL1737","YSL602","YSL603",
        "YSL606","YSL1704","YSL1702","YSL1895","YSL1794",
        "YSL1804","YSL1827","YSL1935","YSL1832","YSL1835",
        "YSL1841","YSL1845","YSL1866","YSL1867","YSL1870",
        "YSL1871","YSL1873","YSL1874","YSL1896","YSL1904",
        "YSL1909","YSL1910","YSL1911","YSL1916","YSL1801",
        "YSL1920","YSL1921","YSL1928","YSL1849","YSL1933",
        "YSL1938","YSL1840","YSL1939","YSL1864","YSL1948",
        "YSL1963","YSL1974","YSL1982","YSL1984","YSL1791",
        "YSL1986","YSL1901","YSL1983","YSL1936","YSL1965",
        "YSL1979","YSL1894","YSL1959","YSL1925","YSL1962",
        "YSL1957"
    ]
}

# ------------------------------------------------------
# Build lookup dictionary
# ------------------------------------------------------
lookup = {}

for category, plants in equipment.items():
    for plant in plants:
        lookup[plant] = category

# ------------------------------------------------------
# Sort files
# ------------------------------------------------------
moved = 0
skipped = 0

for file in SOURCE.iterdir():

    if not file.is_file():
        continue

    filename = file.name.upper()

    matched = False

    for plant, category in lookup.items():

        if filename.startswith(plant):

            destination = ROOT / category / plant / file.name

            shutil.move(str(file), str(destination))

            print(f"✓ {file.name}")
            print(f"  → {category}/{plant}")

            moved += 1
            matched = True
            break

    if not matched:
        print(f"⚠ No matching Plant No.: {file.name}")
        skipped += 1

print("\n-----------------------------------")
print(f"Files moved : {moved}")
print(f"Files skipped : {skipped}")
print("-----------------------------------")
