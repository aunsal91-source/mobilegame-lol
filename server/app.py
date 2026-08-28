import io
import json
import os
import re
import time
import urllib.parse
from datetime import datetime, timedelta, timezone
from pathlib import Path

import psycopg2
import psycopg2.extras
import requests
import stripe
from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_file, send_from_directory
from flask_cors import CORS
from PIL import Image, ImageDraw, ImageFont

load_dotenv()

STRIPE_SECRET_KEY = os.environ.get("STRIPE_SECRET_KEY", "")
STRIPE_WEBHOOK_SECRET = os.environ.get("STRIPE_WEBHOOK_SECRET", "")
DATABASE_URL = os.environ.get("DATABASE_URL", "")
PORT = int(os.environ.get("PORT", "5183"))
DEBUG = os.environ.get("FLASK_DEBUG", "0") == "1"

stripe.api_key = STRIPE_SECRET_KEY

BASE_DIR = Path(__file__).resolve().parent
SITE_DIR = BASE_DIR.parent

app = Flask(__name__, static_folder=None)
CORS(app)

DAILY_CHART_DAYS = 14
MAX_BOARD_SIZE = 100


def favicon_for(host):
    return f"https://www.google.com/s2/favicons?sz=64&domain={urllib.parse.quote(host)}"


def fetch_app_store_screenshots(app_store_url):
    """Pull official screenshot images for an App Store listing via Apple's public,
    unauthenticated iTunes Lookup API. Returns [] if there's no App Store link, the
    ID can't be parsed, or the lookup fails for any reason."""
    if not app_store_url:
        return []
    m = re.search(r"/id(\d+)", app_store_url)
    if not m:
        return []
    try:
        r = requests.get("https://itunes.apple.com/lookup", params={"id": m.group(1)}, timeout=5)
        results = (r.json() or {}).get("results") or []
        if not results:
            return []
        return (results[0].get("screenshotUrls") or [])[:5]
    except Exception:
        return []


APPLE_GENRE_MAP = {
    "Action": "Action", "Adventure": "Adventure", "Arcade": "Arcade",
    "Board": "Card & Casino", "Card": "Card & Casino", "Casino": "Card & Casino",
    "Casual": "Casual", "Family": "Casual", "Puzzle": "Puzzle",
    "Racing": "Racing", "Role Playing": "Role Playing", "Simulation": "Simulation",
    "Sports": "Sports", "Strategy": "Strategy", "Trivia": "Puzzle", "Word": "Puzzle",
    "Music": "Indie & Other", "Educational": "Indie & Other",
}


def resolve_app_store(url):
    m = re.search(r"/id(\d+)", url)
    if not m:
        return None
    try:
        r = requests.get("https://itunes.apple.com/lookup", params={"id": m.group(1)}, timeout=5)
        results = (r.json() or {}).get("results") or []
        if not results:
            return None
        d = results[0]
        category = None
        for g in d.get("genres") or []:
            if g in APPLE_GENRE_MAP:
                category = APPLE_GENRE_MAP[g]
                break
        desc = (d.get("description") or "").split("\n")[0][:140]
        shots = d.get("screenshotUrls") or []
        icon = d.get("artworkUrl512") or d.get("artworkUrl100") or ""
        return {
            "title": d.get("trackName") or "",
            "desc": desc,
            "logo": icon,
            "preview": (shots[0] if shots else icon) or None,
            "category": category,
            "detectedStore": "appStore",
        }
    except Exception:
        return None


def scrape_og_meta(url, detected_store):
    try:
        r = requests.get(url, timeout=5, headers={"User-Agent": "Mozilla/5.0"})
        html = r.text[:200000]
    except Exception:
        return None

    def og(prop):
        m = re.search(rf'<meta[^>]+property=["\']og:{prop}["\'][^>]+content=["\']([^"\']+)["\']', html, re.I)
        if not m:
            m = re.search(rf'<meta[^>]+content=["\']([^"\']+)["\'][^>]+property=["\']og:{prop}["\']', html, re.I)
        return m.group(1) if m else None

    title = og("title")
    if not title:
        m = re.search(r"<title[^>]*>([^<]+)</title>", html, re.I)
        title = m.group(1).strip() if m else None
    image = og("image")
    return {
        "title": title or "",
        "desc": (og("description") or "")[:140],
        "logo": image or favicon_for(slug(url)),
        "preview": image,
        "category": None,
        "detectedStore": detected_store,
    }


def fetch_app_store_icon_by_name(title):
    """Best-effort lookup of an app's official icon + a screenshot by name, via
    Apple's public iTunes Search API. Used to backfill the hand-written seed
    listings, which don't have a real App Store link to resolve from."""
    try:
        r = requests.get(
            "https://itunes.apple.com/search",
            params={"term": title, "entity": "software", "limit": 1},
            timeout=5,
        )
        results = (r.json() or {}).get("results") or []
        if not results:
            return None
        d = results[0]
        shots = d.get("screenshotUrls") or []
        icon = d.get("artworkUrl512") or d.get("artworkUrl100") or ""
        if not icon:
            return None
        return {
            "logo": icon,
            "preview": shots[0] if shots else icon,
            "appStoreUrl": d.get("trackViewUrl") or "",
        }
    except Exception:
        return None


def rescale_seed_clicks_once():
    """One-time correction: the original seed data used inflated click counts
    (thousands) for demo flavor; real seed listings should start more modest
    (1-100) since click counts now grow for real via /api/click. Guarded by a
    meta flag so it never re-runs and clobbers real accumulated clicks."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT 1 FROM meta WHERE key = 'seed_clicks_rescaled';")
                if cur.fetchone():
                    return
                for i, s in enumerate(SEED_LISTINGS):
                    cur.execute(
                        "UPDATE listings SET clicks = %s WHERE id = %s AND clicks > %s;",
                        (s["clicks"], f"seed-{i}", s["clicks"]),
                    )
                cur.execute(
                    "INSERT INTO meta (key, value) VALUES ('seed_clicks_rescaled', '1') ON CONFLICT (key) DO NOTHING;"
                )
            conn.commit()
    except Exception:
        pass  # best-effort — never break startup over this


def backfill_seed_icons():
    """Seed listings are written by hand with just a favicon — give them real
    App Store icons/preview art too, the same quality a real submission gets.
    Runs once per row (skips anything already backfilled), safe to call on
    every startup."""
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    SELECT id, title FROM listings
                    WHERE id LIKE 'seed-%' AND (preview IS NULL OR preview = '' OR app_store_url = '');
                """)
                rows = cur.fetchall()
            for listing_id, title in rows:
                data = fetch_app_store_icon_by_name(title)
                if not data:
                    continue
                with conn.cursor() as cur:
                    cur.execute(
                        "UPDATE listings SET logo = %s, preview = %s, app_store_url = %s WHERE id = %s;",
                        (data["logo"], data["preview"], data.get("appStoreUrl", ""), listing_id),
                    )
                conn.commit()
    except Exception:
        pass  # best-effort — never break startup over this


def resolve_url_metadata(url):
    if "apps.apple.com" in url or "itunes.apple.com" in url:
        data = resolve_app_store(url)
        if data:
            return data
        return scrape_og_meta(url, "appStore")
    if "play.google.com" in url:
        return scrape_og_meta(url, "playStore")
    return scrape_og_meta(url, None)


def slug(url):
    try:
        parsed = urllib.parse.urlparse(url if url.startswith("http") else "https://" + url)
        host = parsed.netloc or parsed.path
        return host[4:] if host.startswith("www.") else host
    except Exception:
        return url.lstrip("@")


SEED_LISTINGS = [
    {"url": "https://subwaysurfers.com", "title": "Subway Surfers", "desc": "Charted for: turning every commute into a dodge-the-inspector sprint.", "category": "Arcade", "amount": 5, "clicks": 88, "hoursAgo": 40},
    {"url": "https://king.com", "title": "Candy Crush Saga", "desc": "Charted for: making one more level a permanent lie.", "category": "Puzzle", "amount": 5, "clicks": 66, "hoursAgo": 60},
    {"url": "https://clashroyale.com", "title": "Clash Royale", "desc": "Charted for: 3-minute matches that somehow eat 3 hours.", "category": "Strategy", "amount": 6, "clicks": 61, "hoursAgo": 20},
    {"url": "https://brawlstars.com", "title": "Brawl Stars", "desc": "Charted for: turning the group chat into a raid squad.", "category": "Action", "amount": 5, "clicks": 54, "hoursAgo": 80},
    {"url": "https://innersloth.com", "title": "Among Us", "desc": "Charted for: ruining friendships one emergency meeting at a time.", "category": "Casual", "amount": 5, "clicks": 47, "hoursAgo": 30},
    {"url": "https://genshin.hoyoverse.com", "title": "Genshin Impact", "desc": "Charted for: a battery-draining open world you can't put down.", "category": "Role Playing", "amount": 6, "clicks": 78, "hoursAgo": 12},
    {"url": "https://roblox.com", "title": "Roblox", "desc": "Charted for: being ten thousand different games in one app.", "category": "Simulation", "amount": 7, "clicks": 92, "hoursAgo": 5},
    {"url": "https://minecraft.net", "title": "Minecraft", "desc": "Charted for: still not letting go after all these years.", "category": "Adventure", "amount": 6, "clicks": 85, "hoursAgo": 3},
    {"url": "https://callofduty.com/mobile", "title": "Call of Duty: Mobile", "desc": "Charted for: console-grade firefights in your pocket.", "category": "Battle Royale", "amount": 5, "clicks": 39, "hoursAgo": 11},
    {"url": "https://pubgmobile.com", "title": "PUBG Mobile", "desc": "Charted for: making 100-player drop-ins feel routine.", "category": "Battle Royale", "amount": 5, "clicks": 44, "hoursAgo": 22},
    {"url": "https://stumbleguys.com", "title": "Stumble Guys", "desc": "Charted for: chaos physics that end every friendship gently.", "category": "Casual", "amount": 5, "clicks": 28, "hoursAgo": 14},
    {"url": "https://dreamgames.com", "title": "Royal Match", "desc": "Charted for: a talking king with an unreasonable renovation budget.", "category": "Puzzle", "amount": 6, "clicks": 58, "hoursAgo": 10},
    {"url": "https://scopely.com", "title": "Monopoly GO!", "desc": "Charted for: turning a board game into a slot machine, somehow.", "category": "Card & Casino", "amount": 5, "clicks": 71, "hoursAgo": 26},
    {"url": "https://moonactive.com", "title": "Coin Master", "desc": "Charted for: spinning a slot wheel to raid your friends' villages.", "category": "Card & Casino", "amount": 5, "clicks": 33, "hoursAgo": 45},
    {"url": "https://township.com", "title": "Township", "desc": "Charted for: farming, building, and mildly neglecting real life.", "category": "Simulation", "amount": 5, "clicks": 19, "hoursAgo": 18},
    {"url": "https://gameloft.com", "title": "Asphalt 9: Legends", "desc": "Charted for: physics-defying drifts that make traffic jams look tame.", "category": "Racing", "amount": 5, "clicks": 24, "hoursAgo": 55},
    {"url": "https://tocaboca.com", "title": "Toca Life World", "desc": "Charted for: letting kids run entire cities with zero rules.", "category": "Simulation", "amount": 5, "clicks": 22, "hoursAgo": 33},
    {"url": "https://robtopgames.com", "title": "Geometry Dash", "desc": "Charted for: one-tap deaths that somehow keep you smiling.", "category": "Arcade", "amount": 5, "clicks": 15, "hoursAgo": 9},
    {"url": "https://poncle.co", "title": "Vampire Survivors", "desc": "Charted for: a screen full of chaos and one very tired arm.", "category": "Indie & Other", "amount": 6, "clicks": 49, "hoursAgo": 15},
    {"url": "https://lilithgames.com", "title": "AFK Arena", "desc": "Charted for: getting stronger while you're not even playing.", "category": "Idle & Clicker", "amount": 5, "clicks": 26, "hoursAgo": 7},
    {"url": "https://miniclip.com", "title": "8 Ball Pool", "desc": "Charted for: trash-talking strangers over a very small table.", "category": "Sports", "amount": 5, "clicks": 18, "hoursAgo": 50},
]


def get_conn():
    last_err = None
    for attempt in range(3):
        try:
            return psycopg2.connect(DATABASE_URL, sslmode="require", connect_timeout=10)
        except psycopg2.OperationalError as e:
            last_err = e
            time.sleep(0.5 * (attempt + 1))
    raise last_err


def init_db():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("""
                CREATE TABLE IF NOT EXISTS listings (
                    id TEXT PRIMARY KEY,
                    url TEXT NOT NULL,
                    title TEXT NOT NULL,
                    description TEXT NOT NULL DEFAULT '',
                    category TEXT NOT NULL,
                    amount INTEGER NOT NULL,
                    clicks INTEGER NOT NULL DEFAULT 0,
                    claimed_at BIGINT NOT NULL,
                    logo TEXT,
                    preview TEXT,
                    app_store_url TEXT NOT NULL DEFAULT '',
                    play_store_url TEXT NOT NULL DEFAULT ''
                );
            """)
            cur.execute("ALTER TABLE listings ADD COLUMN IF NOT EXISTS preview TEXT;")
            cur.execute("ALTER TABLE listings ADD COLUMN IF NOT EXISTS app_store_url TEXT NOT NULL DEFAULT '';")
            cur.execute("ALTER TABLE listings ADD COLUMN IF NOT EXISTS play_store_url TEXT NOT NULL DEFAULT '';")
            cur.execute("ALTER TABLE listings ADD COLUMN IF NOT EXISTS screenshots TEXT NOT NULL DEFAULT '[]';")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS meta (
                    key TEXT PRIMARY KEY,
                    value TEXT NOT NULL
                );
            """)
            cur.execute("SELECT COUNT(*) FROM listings;")
            (count,) = cur.fetchone()
            if count == 0:
                now_ms = int(time.time() * 1000)
                for i, s in enumerate(SEED_LISTINGS):
                    claimed_at = now_ms - s["hoursAgo"] * 3600 * 1000
                    cur.execute(
                        """INSERT INTO listings (id, url, title, description, category, amount, clicks, claimed_at, logo)
                           VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s)
                           ON CONFLICT (id) DO NOTHING;""",
                        (f"seed-{i}", s["url"], s["title"], s["desc"], s["category"], s["amount"],
                         s["clicks"], claimed_at, favicon_for(slug(s["url"]))),
                    )
            cur.execute("""
                CREATE TABLE IF NOT EXISTS heartbeats (
                    session_id TEXT PRIMARY KEY,
                    last_seen BIGINT NOT NULL
                );
            """)
            cur.execute("""
                CREATE TABLE IF NOT EXISTS visits (
                    session_id TEXT PRIMARY KEY,
                    first_seen BIGINT NOT NULL
                );
            """)
            cur.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS user_agent TEXT;")
            cur.execute("ALTER TABLE visits ADD COLUMN IF NOT EXISTS referrer TEXT;")
            cur.execute("""
                CREATE TABLE IF NOT EXISTS listing_clicks_daily (
                    listing_id TEXT NOT NULL,
                    day DATE NOT NULL,
                    clicks INTEGER NOT NULL DEFAULT 0,
                    PRIMARY KEY (listing_id, day)
                );
            """)
        conn.commit()


ONLINE_WINDOW_MS = 45 * 1000
ONLINE_PADDING = 56
VISITOR_PADDING = 12000


def record_heartbeat(session_id, user_agent="", referrer=""):
    now_ms = int(time.time() * 1000)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO heartbeats (session_id, last_seen) VALUES (%s,%s)
                   ON CONFLICT (session_id) DO UPDATE SET last_seen = EXCLUDED.last_seen;""",
                (session_id, now_ms),
            )
            cur.execute(
                """INSERT INTO visits (session_id, first_seen, user_agent, referrer) VALUES (%s,%s,%s,%s)
                   ON CONFLICT (session_id) DO NOTHING;""",
                (session_id, now_ms, user_agent[:300], referrer[:300]),
            )
            cur.execute("DELETE FROM heartbeats WHERE last_seen < %s;", (now_ms - 24 * 3600 * 1000,))
        conn.commit()


def get_online_count():
    now_ms = int(time.time() * 1000)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM heartbeats WHERE last_seen > %s;", (now_ms - ONLINE_WINDOW_MS,))
            (n,) = cur.fetchone()
    return n + ONLINE_PADDING


def get_visit_count():
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("SELECT COUNT(*) FROM visits;")
            (n,) = cur.fetchone()
    return n + VISITOR_PADDING


def record_click(listing_id):
    today = datetime.now(timezone.utc).date()
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute("UPDATE listings SET clicks = clicks + 1 WHERE id = %s;", (listing_id,))
            cur.execute(
                """INSERT INTO listing_clicks_daily (listing_id, day, clicks) VALUES (%s,%s,1)
                   ON CONFLICT (listing_id, day) DO UPDATE SET clicks = listing_clicks_daily.clicks + 1;""",
                (listing_id, today),
            )
        conn.commit()


def get_daily_clicks_map(listing_ids):
    if not listing_ids:
        return {}
    start_day = datetime.now(timezone.utc).date() - timedelta(days=DAILY_CHART_DAYS - 1)
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """SELECT listing_id, day, clicks FROM listing_clicks_daily
                   WHERE listing_id = ANY(%s) AND day >= %s;""",
                (listing_ids, start_day),
            )
            rows = cur.fetchall()
    by_listing = {}
    for listing_id, day, clicks in rows:
        by_listing.setdefault(listing_id, {})[day.isoformat()] = clicks
    result = {}
    for listing_id in listing_ids:
        series = []
        for i in range(DAILY_CHART_DAYS):
            d = (start_day + timedelta(days=i)).isoformat()
            series.append({"day": d, "clicks": by_listing.get(listing_id, {}).get(d, 0)})
        result[listing_id] = series
    return result


def get_state():
    reconcile_stripe_payments()
    with get_conn() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute("""
                SELECT id, url, title, description AS desc, category, amount, clicks, claimed_at AS "claimedAt",
                       logo, preview, app_store_url AS "appStoreUrl", play_store_url AS "playStoreUrl", screenshots
                FROM listings ORDER BY amount DESC, claimed_at ASC LIMIT %s;
            """, (MAX_BOARD_SIZE,))
            listings = [dict(r) for r in cur.fetchall()]
            for l in listings:
                try:
                    l["screenshots"] = json.loads(l["screenshots"]) if l["screenshots"] else []
                except Exception:
                    l["screenshots"] = []

            cur.execute("""
                SELECT id, url, title, amount, claimed_at AS ts, logo,
                       app_store_url AS "appStoreUrl", play_store_url AS "playStoreUrl"
                FROM listings ORDER BY claimed_at DESC LIMIT 12;
            """)
            activity = [dict(r) for r in cur.fetchall()]

            cur.execute("SELECT COALESCE(SUM(amount), 0) AS total FROM listings WHERE id NOT LIKE 'seed-%';")
            total_earned = cur.fetchone()["total"]

    daily_map = get_daily_clicks_map([l["id"] for l in listings])
    for l in listings:
        l["dailyClicks"] = daily_map.get(l["id"], [])

    return {
        "listings": listings,
        "activity": activity,
        "totalEarned": int(total_earned),
        "visitors": get_visit_count(),
    }


def add_listing(listing_id, url, title, desc, category, amount, logo, preview="", app_store_url="", play_store_url=""):
    now_ms = int(time.time() * 1000)
    screenshots = json.dumps(fetch_app_store_screenshots(app_store_url))
    with get_conn() as conn:
        with conn.cursor() as cur:
            cur.execute(
                """INSERT INTO listings (id, url, title, description, category, amount, clicks, claimed_at, logo, preview, app_store_url, play_store_url, screenshots)
                   VALUES (%s,%s,%s,%s,%s,%s,0,%s,%s,%s,%s,%s,%s)
                   ON CONFLICT (id) DO NOTHING;""",
                (listing_id, url, title, desc, category, amount, now_ms, logo, preview, app_store_url, play_store_url, screenshots),
            )
        conn.commit()


RECONCILE_INTERVAL_MS = 30 * 1000  # don't hit Stripe more than once every 30 seconds


def reconcile_stripe_payments():
    """Safety net for missed webhooks (e.g. a payment lands mid-deploy): pull recent
    completed Stripe Checkout Sessions and backfill any that never made it into
    listings. Throttled via meta so normal traffic doesn't hammer the Stripe API."""
    if not STRIPE_SECRET_KEY:
        return
    now_ms = int(time.time() * 1000)
    try:
        with get_conn() as conn:
            with conn.cursor() as cur:
                cur.execute("SELECT value FROM meta WHERE key = 'last_reconcile';")
                row = cur.fetchone()
                if row and now_ms - int(row[0]) < RECONCILE_INTERVAL_MS:
                    return
                cur.execute(
                    """INSERT INTO meta (key, value) VALUES ('last_reconcile', %s)
                       ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;""",
                    (str(now_ms),),
                )
            conn.commit()

        sessions = stripe.checkout.Session.list(
            limit=20,
            created={"gte": int(time.time()) - 24 * 3600},
        )
        for s in sessions.data:
            if s.payment_status != "paid":
                continue
            meta = s.metadata.to_dict() if s.metadata else {}
            name = meta.get("name")
            url = meta.get("url")
            category = meta.get("category")
            if not (name and url and category):
                continue
            add_listing(
                s.id, url, name, meta.get("desc") or "", category,
                int(s.amount_total // 100), favicon_for(slug(url)),
                meta.get("preview") or "", meta.get("appStoreUrl") or "", meta.get("playStoreUrl") or "",
            )
    except Exception:
        pass  # reconciliation is best-effort — never break the main page over it


IMG_BG = (15, 14, 23)
IMG_BG_ALT = (26, 24, 37)
IMG_BORDER = (46, 42, 61)
IMG_TEXT = (243, 241, 250)
IMG_TEXT_DIM = (167, 159, 192)
IMG_ACCENT = (139, 108, 255)
RANK_BG = [(42, 33, 69), (35, 30, 55), (28, 26, 42)]
RANK_BORDER = [(139, 108, 255), (110, 90, 200), (80, 70, 140)]

FONT_PATH = BASE_DIR / "assets" / "DMSans.ttf"


def brand_font(size, weight="Regular"):
    f = ImageFont.truetype(str(FONT_PATH), size)
    try:
        f.set_variation_by_name(weight)
    except Exception:
        pass
    return f


def fetch_logo_circle(url, size=90):
    try:
        r = requests.get(url, timeout=5)
        src = Image.open(io.BytesIO(r.content)).convert("RGBA")
        src = src.resize((size, size), Image.LANCZOS)
        mask = Image.new("L", (size, size), 0)
        ImageDraw.Draw(mask).ellipse((0, 0, size, size), fill=255)
        out = Image.new("RGBA", (size, size))
        out.paste(src, (0, 0), mask)
        return out
    except Exception:
        return None


def truncate_to_width(draw, text, font, max_width):
    if draw.textlength(text, font=font) <= max_width:
        return text
    while text and draw.textlength(text + "…", font=font) > max_width:
        text = text[:-1]
    return text.rstrip() + "…"


def generate_top3_image(top3):
    W, H = 1080, 1260
    img = Image.new("RGB", (W, H), IMG_BG)
    draw = ImageDraw.Draw(img)

    # header: gamepad glyph + "mobilegame.lol" wordmark
    pad_x, pad_y = 60, 56
    draw.rounded_rectangle([pad_x, pad_y, pad_x + 96, pad_y + 46], radius=20, fill=IMG_TEXT)
    draw.ellipse([pad_x + 62, pad_y + 10, pad_x + 74, pad_y + 22], fill=IMG_ACCENT)
    draw.ellipse([pad_x + 78, pad_y + 22, pad_x + 90, pad_y + 34], fill=(34, 224, 122))

    f_logo = brand_font(54, "Medium")
    x = pad_x + 96 + 26
    y = pad_y - 10
    draw.text((x, y), "mobilegame", font=f_logo, fill=IMG_TEXT)
    x += draw.textlength("mobilegame", font=f_logo)
    draw.text((x, y), ".", font=f_logo, fill=IMG_ACCENT)
    x += draw.textlength(".", font=f_logo)
    draw.text((x, y), "lol", font=f_logo, fill=IMG_TEXT)

    # title + date, centered
    title = "TODAY'S TOP GAMES"
    f_title = brand_font(42, "Bold")
    tw = draw.textlength(title, font=f_title)
    draw.text(((W - tw) / 2, 216), title, font=f_title, fill=IMG_TEXT)

    date_str = datetime.now(timezone.utc).strftime("%-d %B %Y") if os.name != "nt" else datetime.now(timezone.utc).strftime("%d %B %Y").lstrip("0")
    f_date = brand_font(26, "Regular")
    dw = draw.textlength(date_str, font=f_date)
    draw.text(((W - dw) / 2, 276), date_str, font=f_date, fill=IMG_TEXT_DIM)

    # top-3 cards
    card_x, card_w, card_h, gap = 60, W - 120, 240, 26
    card_y0 = 360
    for i, item in enumerate(top3[:3]):
        y0 = card_y0 + i * (card_h + gap)
        draw.rounded_rectangle(
            [card_x, y0, card_x + card_w, y0 + card_h],
            radius=30, fill=RANK_BG[i], outline=RANK_BORDER[i], width=4,
        )

        f_rank = brand_font(72, "Bold")
        draw.text((card_x + 36, y0 + card_h / 2 - 42), f"#{i + 1}", font=f_rank, fill=IMG_ACCENT)

        logo_size = 100
        lx, ly = card_x + 190, y0 + (card_h - logo_size) // 2
        logo_img = fetch_logo_circle(item.get("logo") or "", logo_size)
        if logo_img:
            img.paste(logo_img, (lx, ly), logo_img)
        else:
            draw.ellipse([lx, ly, lx + logo_size, ly + logo_size], fill=IMG_BG_ALT, outline=IMG_BORDER, width=2)
            letter = (item["title"][:1] or "?").upper()
            f_letter = brand_font(42, "Bold")
            lw = draw.textlength(letter, font=f_letter)
            draw.text((lx + logo_size / 2 - lw / 2, ly + logo_size / 2 - 26), letter, font=f_letter, fill=IMG_TEXT_DIM)

        tx = lx + logo_size + 30
        amt_text = f"${item['amount']:,}"
        f_amt = brand_font(54, "Bold")
        amt_w = draw.textlength(amt_text, font=f_amt)
        name_max_w = card_x + card_w - 40 - amt_w - 20 - tx

        f_name = brand_font(42, "Bold")
        name = truncate_to_width(draw, item["title"], f_name, name_max_w)
        draw.text((tx, y0 + 42), name, font=f_name, fill=IMG_TEXT)

        f_cat = brand_font(26, "Regular")
        cat = truncate_to_width(draw, item["category"], f_cat, name_max_w)
        draw.text((tx, y0 + 106), cat, font=f_cat, fill=IMG_TEXT_DIM)

        draw.text((card_x + card_w - 40 - amt_w, y0 + card_h / 2 - 30), amt_text, font=f_amt, fill=IMG_ACCENT)

    footer = "Claim #1 at mobilegame.lol"
    f_footer = brand_font(32, "Medium")
    fw = draw.textlength(footer, font=f_footer)
    draw.text(((W - fw) / 2, card_y0 + 3 * card_h + 2 * gap + 50), footer, font=f_footer, fill=IMG_TEXT_DIM)

    buf = io.BytesIO()
    img.save(buf, format="PNG")
    buf.seek(0)
    return buf


@app.get("/api/top3-image.png")
def api_top3_image():
    state = get_state()
    top3 = state["listings"][:3]
    if len(top3) < 3:
        return jsonify({"error": "Need at least 3 active listings to generate this image."}), 400
    buf = generate_top3_image(top3)
    return send_file(buf, mimetype="image/png", as_attachment=False, download_name="mobilegame-top3.png")


@app.get("/api/state")
def api_state():
    state = get_state()
    return jsonify({
        "listings": state["listings"],
        "activity": state["activity"],
        "totalEarned": state["totalEarned"],
        "visitors": state["visitors"],
        "onlineCount": get_online_count(),
        "stripeConfigured": bool(STRIPE_SECRET_KEY),
    })


@app.post("/api/heartbeat")
def api_heartbeat():
    body = request.get_json(silent=True) or {}
    session_id = (body.get("sessionId") or "").strip()[:64]
    if not session_id:
        return jsonify({"error": "missing sessionId"}), 400
    user_agent = request.headers.get("User-Agent", "")
    referrer = (body.get("referrer") or "").strip()
    record_heartbeat(session_id, user_agent, referrer)
    return jsonify({"onlineCount": get_online_count()})


@app.get("/api/resolve")
def api_resolve():
    raw = (request.args.get("url") or "").strip()
    if not raw:
        return jsonify({"error": "missing url"}), 400
    href = raw if raw.startswith("http") else "https://" + raw.lstrip("@")
    data = resolve_url_metadata(href)
    if not data:
        return jsonify({"error": "couldn't resolve"}), 502
    return jsonify(data)


@app.post("/api/click/<listing_id>")
def api_click(listing_id):
    listing_id = listing_id[:64]
    try:
        record_click(listing_id)
    except Exception:
        pass  # click tracking is best-effort — never block the outbound link
    return ("", 204)


@app.post("/api/checkout")
def api_checkout():
    if not STRIPE_SECRET_KEY:
        return jsonify({"error": "Payments aren't configured on this server yet."}), 503

    body = request.get_json(silent=True) or {}
    name = (body.get("name") or "").strip()[:60]
    url = (body.get("url") or "").strip()
    category = (body.get("category") or "").strip()
    desc = (body.get("desc") or "").strip()[:140]
    app_store_url = (body.get("appStoreUrl") or "").strip()[:300]
    play_store_url = (body.get("playStoreUrl") or "").strip()[:300]
    preview = (body.get("preview") or "").strip()[:500]
    try:
        amount = int(body.get("amount"))
    except (TypeError, ValueError):
        amount = 0

    if not name:
        return jsonify({"error": "Enter the game's name."}), 400
    if not url:
        return jsonify({"error": "Enter a link."}), 400
    if not category:
        return jsonify({"error": "Choose a genre."}), 400
    if amount < 5:
        return jsonify({"error": "Minimum bid is $5."}), 400

    origin = request.headers.get("Origin") or request.host_url.rstrip("/")

    session = stripe.checkout.Session.create(
        mode="payment",
        payment_method_types=["card"],
        line_items=[{
            "price_data": {
                "currency": "usd",
                "product_data": {"name": f"mobilegame.lol bid — {name}"},
                "unit_amount": amount * 100,
            },
            "quantity": 1,
        }],
        metadata={
            "name": name, "url": url, "category": category, "desc": desc,
            "appStoreUrl": app_store_url, "playStoreUrl": play_store_url, "preview": preview,
        },
        success_url=f"{origin}/?bid=success",
        cancel_url=f"{origin}/?bid=cancelled",
    )
    return jsonify({"url": session.url})


@app.post("/webhook")
def stripe_webhook():
    payload = request.data
    sig_header = request.headers.get("Stripe-Signature", "")
    try:
        event = stripe.Webhook.construct_event(payload, sig_header, STRIPE_WEBHOOK_SECRET)
    except (ValueError, stripe.error.SignatureVerificationError):
        return "", 400

    if event["type"] == "checkout.session.completed":
        # stripe-python returns StripeObject instances here, not plain dicts
        # (no .get()) — re-parse the verified raw payload instead.
        session = json.loads(payload)["data"]["object"]
        meta = session.get("metadata") or {}
        amount = (session.get("amount_total") or 0) // 100
        name = meta.get("name") or "Unknown"
        url = meta.get("url") or "#"
        category = meta.get("category") or "Indie & Other"
        desc = meta.get("desc") or ""
        logo = favicon_for(slug(url))

        add_listing(
            session.get("id"), url, name, desc, category, amount, logo,
            meta.get("preview") or "", meta.get("appStoreUrl") or "", meta.get("playStoreUrl") or "",
        )

    return "", 200


@app.get("/")
@app.get("/<path:path>")
def static_files(path="index.html"):
    if not (SITE_DIR / path).exists():
        path = "index.html"
    return send_from_directory(SITE_DIR, path)


init_db()
rescale_seed_clicks_once()
backfill_seed_icons()

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=PORT, debug=DEBUG)
