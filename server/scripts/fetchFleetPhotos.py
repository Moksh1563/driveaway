"""
Fetch model-matched car photos from Wikimedia Commons for every car in data/fleet.js.

For each car, files are read from the car's Commons category (plus one level of subcategories),
filtered to real exterior photos (landscape, >= 1920px wide, no interiors/engines/badges/toys),
and four are picked with angle variety (front, side, rear, then the best remaining).
Author and licence are kept for each photo so the site can credit them.

Usage (from server/):
    node -e "console.log(JSON.stringify(require('./data/fleet.js')))" > data/fleet.json
    python -I scripts/fetchFleetPhotos.py data/fleet.json data/fleetPhotos.json
"""
import json, os, re, sys, time, html, urllib.error, urllib.parse, urllib.request

API = 'https://commons.wikimedia.org/w/api.php'
UA = 'DriveawayFleetSeed/1.0 (educational car-rental demo; contact via project maintainer)'
THUMB = 1280  # a standard Wikimedia thumbnail width

EXCLUDE = re.compile(
    r'interior|innen|innenraum|cockpit|dashboard|armaturen|engine|motor\b|motorraum|badge|logo|emblem|'
    r'wheel|felge|rim\b|detail|seat|sitz|steering|lenkrad|light|leuchte|scheinwerfer|lamp|'
    r'model\b|modell|scale|lego|toy|spielzeug|diecast|hot wheels|drawing|render|sketch|crash|accident|'
    r'wreck|unfall|spy|erlkönig|prototype|camouflage|exhaust|auspuff|brake|bremse|door|tür|trunk|kofferraum|'
    r'boot\b|key|schlüssel|display|screen|plate|sticker|decal|cutaway|chassis|frame|stand\b|booth|'
    r'drift|race|rennen|racing|gt3 cup|track day|rallye|rally\b|police|polizei|taxi|limousine service|'
    r'convertible|cabrio|spyder|spider|volante|roadster(?!\sbc)',
    re.I)
ANGLES = {
    'front': re.compile(r'front|vorne|frontansicht|\bfr\b|3/4 front|three-quarter front', re.I),
    'side': re.compile(r'side|seite|profile|profil|seitenansicht|\bleft\b|\bright\b', re.I),
    'rear': re.compile(r'rear|heck|back|hinten|\bre\b|3/4 rear', re.I),
}


def api(params):
    params = {**params, 'format': 'json', 'formatversion': '2'}
    url = API + '?' + urllib.parse.urlencode(params)
    err = None
    for attempt in range(8):
        time.sleep(1.2)  # be polite: roughly one request per second
        try:
            req = urllib.request.Request(url, headers={'User-Agent': UA})
            with urllib.request.urlopen(req, timeout=40) as r:
                return json.load(r)
        except urllib.error.HTTPError as e:
            err = e
            wait = int(e.headers.get('Retry-After') or 0) or (10 * (attempt + 1))
            print(f'  HTTP {e.code}, waiting {wait}s', flush=True)
            time.sleep(min(wait, 120))
        except Exception as e:  # transient network errors
            err = e
            time.sleep(5 * (attempt + 1))
    raise err


def category_files(cat, depth=1, seen=None, limit=400):
    """Files in a category and its direct subcategories, with imageinfo."""
    seen = seen if seen is not None else set()
    if cat in seen:
        return []
    seen.add(cat)
    out = []
    cont = {}
    pages_read = 0
    while len(out) < limit and pages_read < 4:
        pages_read += 1
        data = api({
            'action': 'query', 'generator': 'categorymembers', 'gcmtitle': f'Category:{cat}',
            'gcmtype': 'file|subcat', 'gcmlimit': '100', 'prop': 'imageinfo',
            'iiprop': 'url|size|mime|extmetadata', 'iiurlwidth': str(THUMB), **cont,
        })
        pages = (data.get('query') or {}).get('pages') or []
        subcats = []
        for p in pages:
            if p.get('ns') == 14:
                subcats.append(p['title'].split(':', 1)[1])
            elif p.get('imageinfo'):
                out.append(p)
        direct = sum(1 for p in out if candidate(p))
        if depth > 0 and direct < 12:
            for sc in subcats[:8]:
                if not EXCLUDE.search(sc):
                    out.extend(category_files(sc, depth - 1, seen, limit=150))
        if 'continue' in data:
            cont = {k: v for k, v in data['continue'].items() if k != 'continue'}
        else:
            break
    return out


def clean(text):
    text = re.sub(r'<[^>]+>', '', html.unescape(text or '')).strip()
    return re.sub(r'\s+', ' ', text)[:120]


def candidate(p):
    ii = p['imageinfo'][0]
    title = p['title']
    if ii.get('mime') != 'image/jpeg':
        return None
    w, h = ii.get('width', 0), ii.get('height', 0)
    if w < 1920 or not h or not (1.25 <= w / h <= 2.1):
        return None
    if EXCLUDE.search(title):
        return None
    meta = ii.get('extmetadata') or {}
    lic = clean((meta.get('LicenseShortName') or {}).get('value'))
    if not lic or 'fair use' in lic.lower():
        return None
    angle = next((a for a, rx in ANGLES.items() if rx.search(title)), None)
    return {
        'title': title,
        'thumb': ii.get('thumburl'),
        'page': ii.get('descriptionurl'),
        'width': w,
        'author': clean((meta.get('Artist') or {}).get('value')) or 'Unknown author',
        'license': lic,
        'angle': angle,
        'quality': 'Quality images' in json.dumps(meta),
    }


def pick(cands, n=4):
    """Prefer one front, one side, one rear, then fill; avoid near-identical file names."""
    chosen, used_stems = [], set()

    def stem(t):
        return re.sub(r'[\d_\-\s()]+', ' ', t.lower()).strip()[:40]

    def take(c):
        chosen.append(c)
        used_stems.add(stem(c['title']))

    ranked = sorted(cands, key=lambda c: (not c['quality'], -c['width']))
    for angle in ('front', 'side', 'rear'):
        for c in ranked:
            if c['angle'] == angle and c not in chosen:
                take(c)
                break
    for c in ranked:
        if len(chosen) >= n:
            break
        if c not in chosen and stem(c['title']) not in used_stems:
            take(c)
    for c in ranked:  # still short: allow same-shoot frames
        if len(chosen) >= n:
            break
        if c not in chosen:
            take(c)
    return chosen[:n]


def main(src, dst):
    fleet = json.load(open(src, encoding='utf-8'))
    result = json.load(open(dst, encoding='utf-8')) if os.path.exists(dst) else {}
    for car in fleet:
        if car['name'] in result and len(result[car['name']]['photos']) >= 4:
            continue
        cands, used_cat = [], None
        for cat in car['commons']:
            files = category_files(cat)
            cands = [c for c in (candidate(p) for p in files) if c]
            if len(cands) >= 4:
                used_cat = cat
                break
        picked = pick(cands)
        result[car['name']] = {'category': used_cat, 'candidates': len(cands), 'photos': picked, 'pool': cands[:40]}
        print(f"{car['type']:9} {car['name']:34} cat={used_cat!s:40} cands={len(cands):3} picked={len(picked)}", flush=True)
        json.dump(result, open(dst, 'w', encoding='utf-8'), indent=1, ensure_ascii=False)  # save as we go


if __name__ == '__main__':
    main(sys.argv[1], sys.argv[2])
