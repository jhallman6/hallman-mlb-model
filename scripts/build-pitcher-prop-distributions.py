import json
from collections import Counter
from pathlib import Path

source = Path(r"C:\Users\jimmy\.codex\attachments\d9744337-f715-496b-91ad-0426e54b3f8b\pasted-text.txt")
target = Path(__file__).resolve().parents[1] / "data" / "pitcher-prop-distributions.json"
lines = [line.strip() for line in source.read_text(encoding="utf-8-sig").splitlines() if line.strip()]
headers = lines[0].split("\t")
columns = {header: [] for header in headers}
for line in lines[1:]:
    parts = line.split("\t")
    if len(parts) < len(headers):
        continue
    try:
        values = [int(float(parts[i])) for i in range(len(headers))]
    except ValueError:
        continue
    for header, value in zip(headers, values):
        columns[header].append(value)

result = {"source": source.name, "sampleSize": min(map(len, columns.values())), "markets": {}}
for header, values in columns.items():
    counts = Counter(values)
    total = len(values)
    result["markets"][header] = [
        {"value": value, "count": counts[value], "probability": counts[value] / total}
        for value in range(min(counts), max(counts) + 1)
    ]

target.write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print(f"wrote {result['sampleSize']} observations across {len(result['markets'])} markets")
