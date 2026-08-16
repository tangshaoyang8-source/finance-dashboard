# -*- coding: utf-8 -*-
"""
每日抓取基金最新净值与涨跌幅，写入 data/fund-data.json

数据源：天天基金历史净值公开接口（免费、无需 API Key）
基金代码列表在 data/funds.json 中维护，格式：{"codes": ["021778", "270042"]}

注意：QDII 基金净值 T+1~T+2 更新，接口返回的是最近已公布的净值日。
"""
import datetime
import json
import pathlib
import re
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parent.parent
FUNDS_FILE = ROOT / "data" / "funds.json"
OUT_FILE = ROOT / "data" / "fund-data.json"

HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36"
    ),
}


def http_get_json(url, referer):
    headers = dict(HEADERS)
    headers["Referer"] = referer
    req = urllib.request.Request(url, headers=headers)
    with urllib.request.urlopen(req, timeout=30) as resp:
        return json.loads(resp.read().decode("utf-8", "ignore"))


def fetch_fund(code):
    url = (
        "https://api.fund.eastmoney.com/f10/lsjz"
        "?fundCode=%s&pageIndex=1&pageSize=3" % code
    )
    payload = http_get_json(url, "https://fundf10.eastmoney.com/jjjz_%s.html" % code)
    rows = (payload.get("Data") or {}).get("LSJZList") or []
    rows = [r for r in rows if r.get("DWJZ")]
    if not rows:
        raise ValueError("无净值数据（代码可能不正确）")

    latest, prev = rows[0], rows[1] if len(rows) > 1 else {}
    return {
        "nav": float(latest["DWJZ"]),
        "date": latest["FSRQ"],
        "change_pct": float(latest["JZZZL"]) if latest.get("JZZZL") not in (None, "") else None,
        "prev_date": prev.get("FSRQ"),
        "prev_change_pct": float(prev["JZZZL"]) if prev.get("JZZZL") not in (None, "") else None,
        "ok": True,
    }


def main():
    if not FUNDS_FILE.exists():
        print("[skip] data/funds.json 不存在，跳过基金抓取")
        return

    codes = []
    try:
        codes = json.loads(FUNDS_FILE.read_text(encoding="utf-8")).get("codes", [])
    except Exception as e:
        print("[warn] funds.json 解析失败: %s" % e)
        return
    if not codes:
        print("[skip] funds.json codes 为空，跳过")
        return

    old_funds = {}
    if OUT_FILE.exists():
        try:
            old_funds = json.loads(OUT_FILE.read_text(encoding="utf-8")).get("funds", {})
        except Exception:
            pass

    funds = {}
    for code in codes:
        code = str(code).strip()
        if not re.fullmatch(r"\d{6}", code):
            print("[warn] 无效代码 %s（应为6位数字），跳过" % code)
            continue
        try:
            funds[code] = fetch_fund(code)
            f = funds[code]
            print("[ok] %s 净值 %s (%s) 涨跌 %s%%" % (
                code, f["nav"], f["date"], f["change_pct"]))
        except Exception as e:
            print("[warn] %s 抓取失败: %s" % (code, e))
            if code in old_funds and old_funds[code].get("ok"):
                prev = dict(old_funds[code])
                prev["note"] = "本次抓取失败，沿用上次数据"
                funds[code] = prev

    if not funds:
        print("[warn] 没有抓到任何基金数据，保留原文件")
        return

    now_bj = datetime.datetime.now(datetime.timezone(datetime.timedelta(hours=8)))
    result = {
        "updated_at": now_bj.strftime("%Y-%m-%d %H:%M") + " (北京时间)",
        "source_note": "天天基金历史净值接口，QDII 净值 T+1~T+2 更新",
        "funds": funds,
    }
    OUT_FILE.parent.mkdir(parents=True, exist_ok=True)
    OUT_FILE.write_text(json.dumps(result, ensure_ascii=False, indent=2), encoding="utf-8")
    print("[ok] data/fund-data.json 已更新（%d 只基金）" % len(funds))


if __name__ == "__main__":
    main()
