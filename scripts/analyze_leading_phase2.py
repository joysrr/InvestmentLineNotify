#!/usr/bin/env python3
"""
Phase 2: 計算各指標的 1-day lead 關聯 vs 隔日台股漲跌
找出哪些指標具有領先預測性
"""
import json, glob, os
from datetime import datetime

BASE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))

# ── 讀資料 ────────────────────────────────────────────────────────────────────
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
        'taiex_chg': mo.get('changePercent'),
        'trade_val': mo.get('tradeValueHundredMillion'),
        'avg20d': mo.get('avgTradeValue20dHundredMillion'),
        'foreign': (mi.get('foreignNetBuy') or 0) / 1e8,
        'trust': (mi.get('trustNetBuy') or 0) / 1e8,
        'dealer': (mi.get('dealerNetBuy') or 0) / 1e8,
        'inst_total': (mi.get('totalNetBuy') or 0) / 1e8,
        'margin_chg': mm.get('marginBalanceChange100M'),
        'vix': rm.get('vix'),
        'spx_chg': rm.get('spxChg'),      # '1.14%' or float
        'cnn_score': rc.get('score'),
        'cnn_prev_week': rc.get('previous1Week'),
    })

# 把 spx_chg 字串轉 float
for r in daily:
    s = r['spx_chg']
    if isinstance(s, str):
        try:
            r['spx_chg'] = float(s.replace('%','').strip())
        except:
            r['spx_chg'] = None
    # vix 也可能是字串
    v = r['vix']
    if isinstance(v, str):
        try:
            r['vix'] = float(v.replace('%','').strip())
        except:
            r['vix'] = None

# 清出完整資料的交易日
valid = [r for r in daily if r['taiex_chg'] is not None]

# ── 分析 1: SPX 隔日效果 ──────────────────────────────────────────────────────
print("="*70)
print("【分析 1】SPX 當日漲跌 → 台股隔日表現")
print("="*70)
pairs = []
for i in range(len(valid)-1):
    today = valid[i]
    tomorrow = valid[i+1]
    if today['spx_chg'] is not None and tomorrow['taiex_chg'] is not None:
        pairs.append((today['date'], today['spx_chg'], tomorrow['taiex_chg']))

bull_tw = [p[2] for p in pairs if p[1] > 0]
bear_tw = [p[2] for p in pairs if p[1] < 0]
if bull_tw:
    print(f"  SPX 上漲 ({len(bull_tw)}次) → 台股隔日平均: {sum(bull_tw)/len(bull_tw):.2f}%  正漲比率: {sum(1 for x in bull_tw if x>0)/len(bull_tw):.0%}")
if bear_tw:
    print(f"  SPX 下跌 ({len(bear_tw)}次) → 台股隔日平均: {sum(bear_tw)/len(bear_tw):.2f}%  正漲比率: {sum(1 for x in bear_tw if x>0)/len(bear_tw):.0%}")
print()

# ── 分析 2: VIX 區間 → 台股漲跌 ──────────────────────────────────────────────
print("="*70)
print("【分析 2】VIX 當日水位 → 台股當日漲跌")
print("="*70)
vix_low  = [r for r in valid if r['vix'] is not None and r['vix'] < 15]
vix_mid  = [r for r in valid if r['vix'] is not None and 15 <= r['vix'] < 20]
vix_high = [r for r in valid if r['vix'] is not None and r['vix'] >= 20]
for label, grp in [('<15', vix_low), ('15-20', vix_mid), ('>20', vix_high)]:
    if grp:
        chgs = [r['taiex_chg'] for r in grp if r['taiex_chg'] is not None]
        avg = sum(chgs)/len(chgs)
        pos = sum(1 for x in chgs if x>0)/len(chgs)
        print(f"  VIX {label:6} ({len(grp):2}天) → 台股平均漲跌: {avg:+.2f}%  正漲日比率: {pos:.0%}")
print()

# ── 分析 3: 外資連買/連賣 vs 台股 ─────────────────────────────────────────────
print("="*70)
print("【分析 3】外資買賣超 → 台股當日漲跌")
print("="*70)
f_buy  = [r for r in valid if r['foreign'] > 0.5]
f_sell = [r for r in valid if r['foreign'] < -0.5]
f_neut = [r for r in valid if -0.5 <= r['foreign'] <= 0.5]
for label, grp in [('買超>0.5億', f_buy), ('賣超<-0.5億', f_sell), ('中立', f_neut)]:
    if grp:
        chgs = [r['taiex_chg'] for r in grp if r['taiex_chg'] is not None]
        if chgs:
            avg = sum(chgs)/len(chgs)
            print(f"  外資{label:10} ({len(grp):2}天) → 台股平均: {avg:+.2f}%  正漲比率: {sum(1 for x in chgs if x>0)/len(chgs):.0%}")
print()

# ── 分析 4: 融資變化 → 隔日表現 ──────────────────────────────────────────────
print("="*70)
print("【分析 4】融資增減 → 隔日台股漲跌（反向指標）")
print("="*70)
for i in range(len(valid)-1):
    pass
margin_pairs = []
for i in range(len(valid)-1):
    t = valid[i]
    n = valid[i+1]
    if t['margin_chg'] is not None and n['taiex_chg'] is not None:
        margin_pairs.append((t['date'], t['margin_chg'], n['taiex_chg']))

m_up   = [p for p in margin_pairs if p[1] > 20]   # 融資大增
m_down = [p for p in margin_pairs if p[1] < -20]  # 融資大減
m_flat = [p for p in margin_pairs if -20 <= p[1] <= 20]
for label, grp in [('融資大增>20億', m_up), ('融資大減<-20億', m_down), ('平穩', m_flat)]:
    if grp:
        nxt = [p[2] for p in grp]
        avg = sum(nxt)/len(nxt)
        print(f"  {label:14} ({len(grp):2}次) → 隔日台股平均: {avg:+.2f}%  正漲比率: {sum(1 for x in nxt if x>0)/len(nxt):.0%}")
print()

# ── 分析 5: CNN score 區間 ────────────────────────────────────────────────────
print("="*70)
print("【分析 5】CNN Fear&Greed Score → 隔日台股")
print("="*70)
cnn_pairs = []
for i in range(len(valid)-1):
    t = valid[i]
    n = valid[i+1]
    if t['cnn_score'] is not None and n['taiex_chg'] is not None:
        cnn_pairs.append((t['date'], t['cnn_score'], n['taiex_chg']))
fear   = [p for p in cnn_pairs if p[1] < 30]
neutral= [p for p in cnn_pairs if 30 <= p[1] <= 60]
greed  = [p for p in cnn_pairs if p[1] > 60]
for label, grp in [('Fear<30', fear), ('Neutral 30-60', neutral), ('Greed>60', greed)]:
    if grp:
        nxt = [p[2] for p in grp]
        avg = sum(nxt)/len(nxt)
        print(f"  {label:14} ({len(grp):2}次) → 隔日台股平均: {avg:+.2f}%  正漲比率: {sum(1 for x in nxt if x>0)/len(nxt):.0%}")
print()

# ── 分析 6: 成交量 vs 均量比 ──────────────────────────────────────────────────
print("="*70)
print("【分析 6】成交量/20日均量比 → 當日台股")
print("="*70)
vol_pairs = []
for r in valid:
    if r['trade_val'] and r['avg20d'] and r['avg20d'] > 0 and r['taiex_chg'] is not None:
        ratio = r['trade_val'] / r['avg20d']
        vol_pairs.append((r['date'], ratio, r['taiex_chg']))
high_vol = [p for p in vol_pairs if p[1] > 1.2]
low_vol  = [p for p in vol_pairs if p[1] < 0.8]
norm_vol = [p for p in vol_pairs if 0.8 <= p[1] <= 1.2]
for label, grp in [('爆量>1.2x', high_vol), ('量縮<0.8x', low_vol), ('正常', norm_vol)]:
    if grp:
        chgs = [p[2] for p in grp]
        avg = sum(chgs)/len(chgs)
        print(f"  {label:10} ({len(grp):2}天) → 台股平均: {avg:+.2f}%  正漲比率: {sum(1 for x in chgs if x>0)/len(chgs):.0%}")
print()

# ── 分析 7: 近期重要信號回顧 ─────────────────────────────────────────────────
print("="*70)
print("【分析 7】近期重大事件還原 (2026-10)")
print("="*70)
print(f"{'日期':12} {'台股%':6} {'外資億':7} {'融資差':7} {'VIX':6} {'CNN':5} {'信號'}") 
print('-'*70)
oct_data = [r for r in valid if r['date'] >= '2026-10']
for r in oct_data:
    warn = []
    if r['foreign'] is not None and r['foreign'] < -1: warn.append('外資大賣')
    if r['vix'] is not None and r['vix'] > 20: warn.append(f'VIX高({r["vix"]:.1f})')
    if r['margin_chg'] is not None and r['margin_chg'] < -50: warn.append('融資急減')
    if r['taiex_chg'] is not None and r['taiex_chg'] < -2: warn.append('大跌')
    print(f"  {r['date']:12} {str(r['taiex_chg'] or '?'):6} {r['foreign']:+7.2f} {str(r['margin_chg'] or '?'):7} {str(r['vix'] or '?'):6} {str(r['cnn_score'] or '?'):5} {'|'.join(warn) or '-'}")
