# -*- coding: utf-8 -*-
"""
每日抓取纳指100估值指标，写入 data/valuation.json

数据源（全部免费、无需 API Key）：
  - PE 3/5/10年分位: worldperatio.com 纳指100单页（各窗口均值与σ偏离 → 正态近似分位）
  - VIX: CBOE 官方 CDN（VIX 发布方，1990年至今完整历史，精确计算近10年分位）

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

ENTITIES = {
    "&sigma;": "σ", "&mu;": "μ", "&nbsp;": " ", "&mdash;": "-",
    "&middot;": "·", "&amp;": "&", "&lt;": "<", "&gt;": ">",
}


def http_get(url):
    req = urllib.request.Request(url, headers=HEADERS)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return resp.read().decode("utf-8", "ignore")


def strip_tags(fragment):
    for k, v in ENTITIES.items():
        fragment = fragment.replace(k, v)
    text = re.sub(r"<[^>]+>", " ", fragment)
    return re.sub(r"\s+", " ", text).strip()


def norm_cdf(z):
    """标准正态分布累积函数，用于把 σ 偏离换算成分位"""
    return 0.5 * (1.0 + math.erf(z / math.sqrt(2.0)))


# ---------------------------------------------------------------- PE (worldperatio)
def fetch_pe():
    html = http_get("https://worldperatio.com/index/nasdaq-100")
    # 表头形如 "Current P/E<br>( 29.74 )"，先去掉 <br> 才能整段匹配
    html = re.sub(r"<br\s*/?>", " ", html)

    # 当前 PE，来自表头 "vs Current P/E ( 29.74 )"
    m = re.search(r"Current P/E\s*\(\s*([\d.]+)\s*\)", html)
    if not m:
        raise ValueError("未找到当前 PE")
    current_pe = float(m.group(1))

    # 各窗口行：Period | 均值μ | σ | 范围 | vs当前 | σ偏离 | 评级
    windows = {}
    for tr in re.findall(r"<tr.*?</tr>", html, re.S):
        tds = [strip_tags(td) for td in re.findall(r"<t[dh][^>]*>(.*?)</t[dh]>", tr, re.S)]
        if len(tds) >= 7 and re.fullmatch(r"Last \d+Y", tds[0]):
            years = tds[0].split()[1][:-1]  # "Last 10Y" -> "10"
            mdev = re.search(r"[+-]?\d+\.?\d*", tds[5])
            if not mdev:
                continue
            sigma_dev = float(mdev.group(0))
            windows["y" + years] = {
                "mean": float(tds[1]),
                "sigma_dev": sigma_dev,
                "percentile": round(100.0 * norm_cdf(sigma_dev), 1),
                "label": tds[6],
            }

    for need in ("y3", "y5", "y10"):
        if need not in windows:
            raise ValueError("缺少 %s 窗口数据" % need)

    return {"value": current_pe, "windows": windows, "ok": True}


# ---------------------------------------------------------------- VIX (CBOE)
def fetch_vix():
    payload = json.loads(http_get(
        "https://cdn.cboe.com/api/global/delayed_quotes/charts/historical/_VIX.json"))
    rows = []
    for item in payload.get("data", []):
        d, c = item.get("date"), item.get("close")
        if d and c and re.fullmatch(r"\d{4}-\d{2}-\d{2}", d):
            try:
                rows.append((d, float(c)))
            except ValueError:
                pass
    if not rows:
        raise ValueError("CBOE 返回为空")

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
        "vix": safe(fetch_vix),
    }

    # 某指标抓取失败时沿用上次成功的数据
    for key in ("pe", "vix"):
        if not indicators[key].get("ok") and old_indicators.get(key, {}).get("ok"):
            prev = dict(old_indicators[key])
            prev["note"] = "本次抓取失败，沿用上次数据"
            indicators[key] = prev

    now_bj = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    result = {
        "updated_at": now_bj.strftime("%Y-%m-%d %H:%M") + " (北京时间)",
        "source_note": "PE 3/5/10年分位: worldperatio.com | VIX: CBOE 官方数据",
        "indicators": indicators,
    }

    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[ok] data/valuation.json 已更新")
    pe, vix = indicators["pe"], indicators["vix"]
    print("  pe: ok=%s value=%s" % (pe.get("ok"), pe.get("value")))
    for y in ("y3", "y5", "y10"):
        w = pe.get("windows", {}).get(y, {})
        print("    %s: pct=%sσ%s label=%s" % (y, w.get("percentile"), w.get("sigma_dev"), w.get("label")))
    print("  vix: ok=%s value=%s pct=%s as_of=%s" % (
        vix.get("ok"), vix.get("value"), vix.get("percentile"), vix.get("as_of")))


if __name__ == "__main__":
    main()
