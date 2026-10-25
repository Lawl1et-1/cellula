"""Authoring helper: turns a list of steps into a disease's stages, tracks and actors (focus mode)."""
import json, re, glob, os

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
REG = open(os.path.join(ROOT, 'src/engine/channels/registry.ts'), encoding='utf-8').read()
REST = {m.group(1): float(m.group(2)) for m in re.finditer(r"'([\w.]+)': \{ range: \[[^\]]+\], rest: ([\d.]+)", REG)}


def C(fr, en, *sources, simp=None):
    c = {"text": {"fr": fr, "en": en}, "sources": [{"id": s} for s in sources]}
    if simp:
        c["simplification"] = {"fr": simp[0], "en": simp[1]}
    return c


def T(fr, en):
    return {"fr": fr, "en": en}


def hero(model, path, label=None, offset=None, count=1):
    h = {"model": model, "path": path if isinstance(path, list) else [path]}
    if offset:
        h["offset"] = list(offset)
    if count != 1:
        h["count"] = count
    if label:
        h["label"] = T(*label)
    return h


def label(at, fr, en, offset=None):
    lb = {"at": at, "text": T(fr, en)}
    if offset:
        lb["offset"] = list(offset)
    return lb


def step(id, title, caption, focus, highlight=(), camera=None, heroes=(), labels=(), set=None, actors=(), signs=(), seconds=12):
    return dict(id=id, title=title, caption=caption, focus=focus, highlight=list(highlight), camera=camera,
                heroes=list(heroes), labels=list(labels), set=set or {}, actors=list(actors), signs=list(signs), seconds=seconds)


def path_actor(path, cargo, count, at=0.0, until=1.0):
    return {"actor": "path", "at": at, "until": until, "params": {"path": path, "cargo": cargo, "count": count}}


def burst(frm, cargo, count, at=0.0, until=1.0):
    return {"actor": "burst", "at": at, "until": until, "params": {"from": frm, "cargo": cargo, "count": count}}


def pulse(at_anchor, at=0.0, until=1.0):
    return {"actor": "pulse", "at": at, "until": until, "params": {"at": at_anchor}}


def r4(x):
    return round(x, 4)


def build(disease_id, steps):
    files = [f for f in glob.glob(os.path.join(ROOT, 'content/diseases/*/*.json'))
             if json.load(open(f, encoding='utf-8'))['id'] == disease_id]
    assert len(files) == 1, disease_id
    path = files[0]
    d = json.load(open(path, encoding='utf-8'))
    n = len(steps)
    stages, actors = [], []
    channels = {}
    for s in steps:
        for ch in s['set']:
            assert ch in REST, f'{disease_id}: unknown channel {ch}'
            channels.setdefault(ch, [{"t": 0, "v": REST[ch]}])
    current = {ch: REST[ch] for ch in channels}
    for i, s in enumerate(steps):
        a, b = r4(i / n), (1 if i == n - 1 else r4((i + 1) / n))
        L = b - a
        stage = {
            "id": s['id'],
            "title": T(*s['title']),
            "range": [a, b],
            "description": s['caption'],
            "cellularSigns": s['signs'],
            "focus": s['focus'],
        }
        if s['camera']:
            stage["camera"] = s['camera']
        if s['highlight']:
            stage["highlight"] = s['highlight']
        if s['heroes']:
            stage["heroes"] = s['heroes']
        if s['labels']:
            stage["labels"] = s['labels']
        stage["seconds"] = s['seconds']
        stages.append(stage)
        for ch, v in s['set'].items():
            keys = channels[ch]
            keys.append({"t": r4(a + 0.1 * L), "v": current[ch]})
            keys.append({"t": r4(a + 0.7 * L), "v": v})
            current[ch] = v
        for act in s['actors']:
            g = dict(act)
            g['at'] = r4(a + act['at'] * L)
            g['until'] = r4(a + act['until'] * L)
            actors.append(g)
    d['stages'] = stages
    d['tracks'] = [{"channel": ch, "keys": keys} for ch, keys in channels.items()]
    d['actors'] = actors
    d['durationSeconds'] = sum(s['seconds'] for s in steps)
    d['review']['lastChecked'] = '2026-10-25'
    open(path, 'w', encoding='utf-8', newline='').write(json.dumps(d, ensure_ascii=False, indent=2) + '\n')
    print(f'{disease_id}: {n} steps')
