import json
import openpyxl
from pathlib import Path

source = Path(r"C:\Users\jimmy\OneDrive\Documents\MLB Model park factors.xlsx")
target = Path(__file__).resolve().parents[1] / "data" / "mlb-park-factors.json"
book = openpyxl.load_workbook(source, data_only=False, read_only=True)
sheet = book["Park Fact"]
rows = []
for row in sheet.iter_rows(min_row=3, values_only=True):
    team, player, park = row[0], row[1], row[2]
    if not team or not player:
        continue
    try:
        hr = float(row[3])
        babip = (float(row[4]) + float(row[5])) / 2
    except (TypeError, ValueError):
        continue
    rows.append({"team": str(team), "player": str(player), "park": str(park or ""), "hr": hr, "babip": babip})

target.write_text(json.dumps({"source": source.name, "rows": rows}, indent=2) + "\n", encoding="utf-8")
print(f"wrote {len(rows)} park-factor rows to {target}")
