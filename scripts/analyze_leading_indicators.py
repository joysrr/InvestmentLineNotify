#!/usr/bin/env python3
"""
分析 market/history 各日指標 vs 0050 股價變化
找出潛在領先指標
"""
import json
import glob
import os
from datetime import datetime, timedelta

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 1. 讀 market/history ──────────────────────────────────────────────────────
market_files = sorted(glob.glob(os.path.join(BASE, 'data/market/history/2026-*.json')))
daily = []
for f in market_files:
    d = json.load(open(f))
    dt = os.path.basename(f).replace('.json', '')
    data = d.get('data', {})
    mo = data.get('rawMarketOverview', {}) or {}
    mi = data.get('rawInstitutional', {}) or {}
    mm = data.get('rawMargin', {}) or {}
    rm = data.get('rawUsMarket', {}) or {}
    rv = data.get('rawValuation', {}) or {}
    rc = data.get('rawCnn', {}) or {}

    daily.append({
        'date': dt,
        'taiex': mo.get('taiex'),
        'taiex_chg_pct': mo.get('changePercent'),
        'trade_val_100m': mo.get('tradeValueHundredMillion'),
        'avg20d_vol': mo.get('avgTradeValue20dHundredMillion'),
        'foreign_net': mi.get('foreignNetBuy'),
        'trust_net': mi.get('trustNetBuy'),
        'dealer_net': mi.get('dealerNetBuy'),
        'total_inst_net': mi.get('totalNetBuy'),
        'margin_bal': mm.get('marginBalance100M'),
        'margin_chg': mm.get('marginBalanceChange100M'),
        'vix': rm.get('vix'),
        'spx_chg': rm.get('spxChg'),
        'is_high_risk': rm.get('isHighRisk'),
        'pe': rv.get('pe'),
        'pb': rv.get('pb'),
        'dy': rv.get('yield'),
        'cnn_score': rc.get('score'),
        'cnn_prev_week': rc.get('previous1Week'),
    })

# ── 2. 讀 pbHistory ───────────────────────────────────────────────────────────
pb_raw = json.load(open(os.path.join(BASE, 'data/pbHistory.json')))
# format: {'date':'20261012','pb':4.31}
pb_map = {}
for x in pb_raw:
    dt = x['date']
    # normalize to YYYY-MM-DD
    if len(dt) == 8:
        dt = f"{dt[:4]}-{dt[4:6]}-{dt[6:]}"
    pb_map[dt] = x['pb']

# ── 3. 讀 vixHistory ──────────────────────────────────────────────────────────
vix_raw = json.load(open(os.path.join(BASE, 'data/vixHistory.json')))
vix_map = {x['date']: x['value'] for x in vix_raw}

# ── 4. 讀 0050 每日收盤 ────────────────────────────────────────────────────────
stock_files = sorted(glob.glob(os.path.join(BASE, 'data/stock_history/0050_*.json')))
price_map = {}
for f in stock_files:
    rows = json.load(open(f))
    for row in rows:
        price_map[row['date']] = {'close': row['close'], 'vol': row['volume']}

print(f"資料範圍:")
print(f"  market/history: {len(daily)} 天 ({daily[0]['date']} ~ {daily[-1]['date']})")
print(f"  pbHistory: {len(pb_raw)} 筆")
print(f"  vixHistory: {len(vix_raw)} 筆")
print(f"  0050 price: {len(price_map)} 天")
print()

# ── 5. 合併成時序表 ───────────────────────────────────────────────────────────
print(f"{'日期':12} {'加權指數':9} {'漲跌%':6} {'0050收':7} {'三大法人億':10} {'外資':8} {'融資差億':8} {'VIX':6} {'SPX%':6} {'CNN':5} {'PB':5}")
print('-'*100)

for row in daily:
    dt = row['date']
    price = price_map.get(dt, {})
    inst = row['total_inst_net']
    inst_str = f"{inst/1e8:.1f}" if inst is not None else '?'
    foreign = row['foreign_net']
    foreign_str = f"{foreign/1e8:.1f}" if foreign is not None else '?'
    margin_chg = row['margin_chg']
    margin_str = f"{margin_chg:.1f}" if margin_chg is not None else '?'
    
    print(
        f"{dt:12} "
        f"{str(row['taiex'] or '?'):9} "
        f"{str(row['taiex_chg_pct'] or '?'):6} "
        f"{str(price.get('close','?')):7} "
        f"{inst_str:10} "
        f"{foreign_str:8} "
        f"{margin_str:8} "
        f"{str(row['vix'] or '?'):6} "
        f"{str(row['spx_chg'] or '?'):6} "
        f"{str(row['cnn_score'] or '?'):5} "
        f"{str(pb_map.get(dt, '?')):5}"
    )
