# -*- coding: utf-8 -*-
"""
每日抓取纳指100估值指标，写入 data/valuation.json

数据源（全部免费、无需 API Key）：
  - PE:  worldperatio.com（10年标准差 → 正态近似分位）
  - PS:  gurufocus.com（原始值；可能有 Cloudflare 拦截，失败自动容错）
  - VIX: FRED (VIXCLS)（官方序列，可精确计算近10年分位）
  - PB:  无稳定免费数据源 → 保留上次数据，页面上手动维护

只使用 Python 标准库，GitHub Actions 开箱即用。
"""
import datetime
import json
import math
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT_FILE = ROOT / "data" / "valuation.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
    "Accept-Language": "en-US,en;q=0.9",
}


def http_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "ignore")


def norm_cdf(z):
    """标准正态分布累积函数，用于把 σ 偏离换算成分位"""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


# ---------------------------------------------------------------- VIX (FRED)
def fetch_vix():
    csv = http_get("https://fred.stlouisfed.org/graph/fredgraph.csv?id=VIXCLS")
    rows = []
    for line in csv.splitlines()[1:]:
        parts = line.split(",")
        if len(parts) == 2 and re.fullmatch(r"\d{4}-\d{2}-\d{2}", parts[0]) \
                and re.fullmatch(r"\d+(\.\d+)?", parts[1]):
            rows.append((parts[0], float(parts[1])))
    if not rows:
        raise ValueError("FRED 返回为空")

    as_of, vix = rows[-1]

    # 近10年历史分位（精确计算）
    cutoff = (datetime.date.today() - datetime.timedelta(days=3650)).isoformat()
    hist = [v for d, v in rows if d >= cutoff]
    pct = 100.0 * sum(1 for v in hist if v <= vix) / len(hist) if hist else None

    return {
        "value": vix,
        "percentile": round(pct, 1) if pct is not None else None,
        "as_of": as_of,
        "ok": True,
    }


# ---------------------------------------------------------------- PE (worldperatio)
def fetch_pe():
    html = http_get("https://worldperatio.com/major-stock-index-pe-ratios/")

    # 找到 Nasdaq 100 所在表格行，按 | 分列
    line = None
    for l in html.splitlines():
        if "Nasdaq 100" in l or "Nasdaq-100" in l:
            line = l
            break
    if not line:
        raise ValueError("未找到 Nasdaq 100 行")

    cells = [c.strip() for c in line.split("|")]
    if len(cells) < 11:
        raise ValueError("表格列数异常: %d" % len(cells))

    pe = float(cells[2])
    # 列: [_, name, PE, eval5, eval10, eval20, avg5, avg10, avg20, dev5σ, dev10σ, dev20σ, ...]
    dev10_raw = re.sub(r"[^\d.+-]", "", cells[10])  # "+0.60 σ" -> "+0.60"
    dev10 = float(dev10_raw)

    pct = round(100.0 * norm_cdf(dev10), 1)
    return {
        "value": pe,
        "percentile": pct,
        "as_of": None,
        "ok": True,
        "note": "分位为10年正态近似",
    }


# ---------------------------------------------------------------- PS (gurufocus)
def fetch_ps():
    html = http_get("https://www.gurufocus.com/economic_indicators/6777/nasdaq-100-price-to-sales")

    # 优先匹配 "was X as of DATE" 句式，其次 "Last Value"
    m = re.search(r"was\s+([\d.]+)\s+as of\s+([\d-]+)", html)
    as_of = None
    if m:
        ps = float(m.group(1))
        as_of = m.group(2)
    else:
        m = re.search(r"Last Value\D{0,20}?([\d.]+)", html)
        if not m:
            raise ValueError("未匹配到 PS 数值")
        ps = float(m.group(1))

    return {"value": ps, "percentile": None, "as_of": as_of, "ok": True}


# ---------------------------------------------------------------- main
def main():
    old_indicators = {}
    if OUT_FILE.exists():
        try:
            old_indicators = json.loads(OUT_FILE.read_text(encoding="utf-8")).get("indicators", {})
        except Exception:
            pass

    def safe(fn):
        try:
            return fn()
        except Exception as e:
            print("[warn] %s 失败: %s" % (getattr(fn, "__name__", fn), e))
            return {"ok": False, "error": str(e)}

    indicators = {
        "pe": safe(fetch_pe),
        # PB 无稳定免费数据源：保留旧值，由页面手动维护
        "pb": old_indicators.get("pb") or {
            "ok": False,
            "note": "无稳定免费数据源，请手动维护",
        },
        "ps": safe(fetch_ps),
        "vix": safe(fetch_vix),
    }

    # 某指标抓取失败时沿用上次成功的数据
    for key in ("pe", "ps", "vix"):
        if not indicators[key].get("ok") and old_indicators.get(key, {}).get("ok"):
            prev = dict(old_indicators[key])
            prev["note"] = "本次抓取失败，沿用上次数据"
            indicators[key] = prev

    now_bj = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    result = {
        "updated_at": now_bj.strftime("%Y-%m-%d %H:%M") + " (北京时间)",
        "source_note": "PE: worldperatio.com | PS: gurufocus.com | VIX: FRED (VIXCLS)",
        "indicators": indicators,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[ok] data/valuation.json 已更新")
    for k, v in indicators.items():
        print("  %s: ok=%s value=%s percentile=%s" % (
            k, v.get("ok"), v.get("value"), v.get("percentile")))


if __name__ == "__main__":
    main()
