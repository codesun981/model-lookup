#!/usr/bin/env python3
"""从 models.dev 拉取最新数据，与 data/models.json 比对，有变化才更新。

用法: python3 scripts/update_data.py /tmp/api.json
退出码恒为 0；是否变化由调用方用 `git diff --quiet -- data/` 判断。
"""
import datetime
import json
import sys

SRC = sys.argv[1]

new = json.load(open(SRC, encoding="utf-8"))
old = json.load(open("data/models.json", encoding="utf-8"))

if new == old:
    print("no change")
    sys.exit(0)

json.dump(new, open("data/models.json", "w", encoding="utf-8"),
          ensure_ascii=False, separators=(",", ":"))
n_models = sum(len(p.get("models", {})) for p in new.values())
meta = {
    "updated_at": datetime.datetime.now(datetime.timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
    "providers": len(new),
    "models": n_models,
    "source": "https://models.dev/api.json",
}
json.dump(meta, open("data/meta.json", "w", encoding="utf-8"),
          ensure_ascii=False, indent=1)
print(f"updated: {len(new)} providers, {n_models} models")
