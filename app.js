(() => {
  "use strict";

  const STORAGE_KEY = "mobilegame_state_v1";
  const LAUNCH_KEY = "mobilegame_launch_v1";
  const SESSION_KEY = "mobilegame_session_v1";
  const PAGE_SIZE = 50;
  const MIN_BID = 5;
  const MAX_BOARD_SIZE = 100;

  const GENRES = [
    "Action",
    "Adventure",
    "Arcade",
    "Battle Royale",
    "Card & Casino",
    "Casual",
    "Idle & Clicker",
    "Puzzle",
    "Racing",
    "Role Playing",
    "Simulation",
    "Sports",
    "Strategy",
    "Indie & Other",
  ];

  const ALL_ICON = `<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;
  const GENRE_ICON = `<svg class="cat-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><path d="M6 12h4m-2-2v4"/><circle cx="16" cy="11" r="1"/><circle cx="18.5" cy="13.5" r="1"/><rect x="2" y="6" width="20" height="12" rx="6"/></svg>`;

  function faviconFor(host) {
    return `https://www.google.com/s2/favicons?sz=64&domain=${encodeURIComponent(host)}`;
  }

  const SEED_LISTINGS = [
    { url: "https://subwaysurfers.com", title: "Subway Surfers", desc: "turning every commute into a dodge-the-inspector sprint.", category: "Arcade", amount: 4200, clicks: 88, hoursAgo: 40, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://king.com", title: "Candy Crush Saga", desc: "making one more level a permanent lie.", category: "Puzzle", amount: 3600, clicks: 66, hoursAgo: 60, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://clashroyale.com", title: "Clash Royale", desc: "3-minute matches that somehow eat 3 hours.", category: "Strategy", amount: 3100, clicks: 61, hoursAgo: 20, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://brawlstars.com", title: "Brawl Stars", desc: "turning the group chat into a raid squad.", category: "Action", amount: 2650, clicks: 54, hoursAgo: 80, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://innersloth.com", title: "Among Us", desc: "ruining friendships one emergency meeting at a time.", category: "Casual", amount: 2200, clicks: 47, hoursAgo: 30, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://genshin.hoyoverse.com", title: "Genshin Impact", desc: "a battery-draining open world you can't put down.", category: "Role Playing", amount: 3900, clicks: 78, hoursAgo: 12, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://roblox.com", title: "Roblox", desc: "being ten thousand different games in one app.", category: "Simulation", amount: 4500, clicks: 92, hoursAgo: 5, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://minecraft.net", title: "Minecraft", desc: "still not letting go after all these years.", category: "Adventure", amount: 3300, clicks: 85, hoursAgo: 3, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://callofduty.com/mobile", title: "Call of Duty: Mobile", desc: "console-grade firefights in your pocket.", category: "Battle Royale", amount: 2900, clicks: 39, hoursAgo: 11, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://pubgmobile.com", title: "PUBG Mobile", desc: "making 100-player drop-ins feel routine.", category: "Battle Royale", amount: 2400, clicks: 44, hoursAgo: 22, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://stumbleguys.com", title: "Stumble Guys", desc: "chaos physics that end every friendship gently.", category: "Casual", amount: 1650, clicks: 28, hoursAgo: 14, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://dreamgames.com", title: "Royal Match", desc: "a talking king with an unreasonable renovation budget.", category: "Puzzle", amount: 2980, clicks: 58, hoursAgo: 10, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://scopely.com", title: "Monopoly GO!", desc: "turning a board game into a slot machine, somehow.", category: "Card & Casino", amount: 3500, clicks: 71, hoursAgo: 26, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://moonactive.com", title: "Coin Master", desc: "spinning a slot wheel to raid your friends' villages.", category: "Card & Casino", amount: 2100, clicks: 33, hoursAgo: 45, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://township.com", title: "Township", desc: "farming, building, and mildly neglecting real life.", category: "Simulation", amount: 1400, clicks: 19, hoursAgo: 18, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://gameloft.com", title: "Asphalt 9: Legends", desc: "physics-defying drifts that make traffic jams look tame.", category: "Racing", amount: 1900, clicks: 24, hoursAgo: 55, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://tocaboca.com", title: "Toca Life World", desc: "letting kids run entire cities with zero rules.", category: "Simulation", amount: 1550, clicks: 22, hoursAgo: 33, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://robtopgames.com", title: "Geometry Dash", desc: "one-tap deaths that somehow keep you smiling.", category: "Arcade", amount: 1200, clicks: 15, hoursAgo: 9, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://poncle.co", title: "Vampire Survivors", desc: "a screen full of chaos and one very tired arm.", category: "Indie & Other", amount: 2600, clicks: 49, hoursAgo: 15, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://lilithgames.com", title: "AFK Arena", desc: "getting stronger while you're not even playing.", category: "Idle & Clicker", amount: 1750, clicks: 26, hoursAgo: 7, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://miniclip.com", title: "8 Ball Pool", desc: "trash-talking strangers over a very small table.", category: "Sports", amount: 1300, clicks: 18, hoursAgo: 50, appStoreUrl: "", playStoreUrl: "" },
    { url: "https://habby.com", title: "Archero", desc: "turning tap-to-shoot into a genuine addiction.", category: "Action", amount: 5, clicks: 41, hoursAgo: 6, appStoreUrl: "https://apps.apple.com/us/app/archero/id1453651052?uo=4", playStoreUrl: "" },
    { url: "https://habby.com", title: "Survivor.io", desc: "outrunning a screen full of monsters, barely.", category: "Action", amount: 5, clicks: 35, hoursAgo: 60, appStoreUrl: "https://apps.apple.com/us/app/survivor-io/id1528941310?uo=4", playStoreUrl: "" },
    { url: "https://superplay.com", title: "Dice Dreams", desc: "turning a dice roll into a friendship-ending raid.", category: "Card & Casino", amount: 5, clicks: 52, hoursAgo: 29, appStoreUrl: "https://apps.apple.com/us/app/dice-dreams/id1484468651?uo=4", playStoreUrl: "" },
    { url: "https://metacoregames.com", title: "Merge Mansion", desc: "a grandma with more secrets than furniture.", category: "Casual", amount: 5, clicks: 44, hoursAgo: 17, appStoreUrl: "https://apps.apple.com/us/app/merge-mansion-puzzles-story/id1484442152?uo=4", playStoreUrl: "" },
    { url: "https://www.marvelsnap.com", title: "Marvel Snap", desc: "six-card decks that end in three-minute heartbreaks.", category: "Card & Casino", amount: 5, clicks: 67, hoursAgo: 3, appStoreUrl: "https://apps.apple.com/us/app/marvel-snap-hero-card-game/id1592081003?uo=4", playStoreUrl: "" },
    { url: "https://www.playbalatro.com", title: "Balatro", desc: "turning poker hands into a joker-fueled fever dream.", category: "Card & Casino", amount: 5, clicks: 91, hoursAgo: 8, appStoreUrl: "https://apps.apple.com/us/app/balatro/id6502453075?uo=4", playStoreUrl: "" },
    { url: "https://dead-cells.com", title: "Dead Cells", desc: "dying beautifully, over and over again.", category: "Action", amount: 5, clicks: 38, hoursAgo: 45, appStoreUrl: "https://apps.apple.com/us/app/dead-cells/id1389752090?uo=4", playStoreUrl: "" },
    { url: "https://devolverdigital.com", title: "Loop Hero", desc: "building a world just to loop through its doom.", category: "Strategy", amount: 5, clicks: 20, hoursAgo: 65, appStoreUrl: "https://apps.apple.com/us/app/loop-hero/id6464048549?uo=4", playStoreUrl: "" },
    { url: "https://www.stardewvalley.net", title: "Stardew Valley", desc: "quitting your corporate job, virtually.", category: "Simulation", amount: 5, clicks: 73, hoursAgo: 24, appStoreUrl: "https://apps.apple.com/us/app/stardew-valley/id1406710800?uo=4", playStoreUrl: "" },
    { url: "https://dinopolo.club", title: "Mini Metro", desc: "making subway planning weirdly stressful.", category: "Strategy", amount: 5, clicks: 29, hoursAgo: 52, appStoreUrl: "https://apps.apple.com/us/app/mini-metro/id837860959?uo=4", playStoreUrl: "" },
    { url: "https://voodoo.io", title: "Going Balls", desc: "a rolling ball that judges your reflexes harshly.", category: "Arcade", amount: 5, clicks: 56, hoursAgo: 12, appStoreUrl: "https://apps.apple.com/us/app/going-balls/id1499081620?uo=4", playStoreUrl: "" },
    { url: "https://peoplefun.com", title: "Wordscapes", desc: "turning a coffee break into forty-five minutes.", category: "Puzzle", amount: 5, clicks: 47, hoursAgo: 38, appStoreUrl: "https://apps.apple.com/us/app/wordscapes-word-game/id1207472156?uo=4", playStoreUrl: "" },
  ].map((s) => ({ ...s, logo: faviconFor(slug(s.url)), preview: null }));

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));

  function fmtMoney(n) {
    return "$" + Math.round(n).toLocaleString("en-US");
  }

  function timeAgo(ts) {
    const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
    if (s < 60) return "just now";
    const m = Math.floor(s / 60);
    if (m < 60) return `${m} minute${m === 1 ? "" : "s"} ago`;
    const h = Math.floor(m / 60);
    if (h < 24) return `${h} hour${h === 1 ? "" : "s"} ago`;
    const d = Math.floor(h / 24);
    return `${d} day${d === 1 ? "" : "s"} ago`;
  }

  function slug(url) {
    try {
      return new URL(/^https?:\/\//.test(url) ? url : "https://" + url).hostname.replace(/^www\./, "");
    } catch {
      return url.replace(/^@/, "");
    }
  }

  function resolveUrl(rawValue) {
    if (!rawValue) return "";
    return /^https?:\/\//.test(rawValue) ? rawValue : "https://" + rawValue.replace(/^@/, "");
  }

  // ---- state ----
  let state = load();
  let backendAvailable = false;
  let stripeConfigured = false;
  let onlineCount = 60 + Math.floor(Math.random() * 140);

  function getSessionId() {
    let id = localStorage.getItem(SESSION_KEY);
    if (!id) {
      id = "s-" + Date.now().toString(36) + "-" + Math.random().toString(36).slice(2, 10);
      localStorage.setItem(SESSION_KEY, id);
    }
    return id;
  }

  async function sendHeartbeat() {
    try {
      const res = await fetch("/api/heartbeat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId: getSessionId(), referrer: document.referrer }),
      });
      if (!res.ok) return;
      const data = await res.json();
      if (typeof data.onlineCount === "number") {
        onlineCount = data.onlineCount;
        renderHero();
      }
    } catch {
      // no backend running here — fake counter keeps ticking instead
    }
  }

  function trackClick(id) {
    if (!backendAvailable || !id) return;
    try {
      navigator.sendBeacon
        ? navigator.sendBeacon(`/api/click/${encodeURIComponent(id)}`, new Blob([], { type: "text/plain" }))
        : fetch(`/api/click/${encodeURIComponent(id)}`, { method: "POST", keepalive: true });
    } catch {
      // best-effort only — never block navigation on this
    }
  }

  async function tryLoadBackend() {
    try {
      const res = await fetch("/api/state");
      if (!res.ok) return;
      const data = await res.json();
      state = {
        listings: data.listings,
        activity: data.activity,
        totalEarned: data.totalEarned,
        visitors: data.visitors,
      };
      if (typeof data.onlineCount === "number") onlineCount = data.onlineCount;
      backendAvailable = true;
      stripeConfigured = !!data.stripeConfigured;
      renderAll();
    } catch {
      // no backend reachable — fall back to local demo mode
      renderAll();
    }
  }

  function load() {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      try { return JSON.parse(raw); } catch { /* fall through to seed */ }
    }
    const now = Date.now();
    const listings = SEED_LISTINGS.map((s, i) => ({
      id: "seed-" + i,
      url: s.url,
      title: s.title,
      desc: s.desc,
      category: s.category,
      amount: s.amount,
      clicks: s.clicks,
      claimedAt: now - s.hoursAgo * 3600 * 1000,
      logo: s.logo,
      preview: s.preview,
      appStoreUrl: s.appStoreUrl,
      playStoreUrl: s.playStoreUrl,
      dailyClicks: [],
    }));
    const activity = listings
      .slice()
      .sort((a, b) => a.claimedAt - b.claimedAt)
      .map((l) => ({ id: l.id, title: l.title, url: l.url, amount: l.amount, ts: l.claimedAt, logo: l.logo }));
    const fresh = {
      listings,
      activity,
      totalEarned: listings.reduce((sum, l) => sum + l.amount, 0),
      visitors: 68412 + Math.floor(Math.random() * 500),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(fresh));
    return fresh;
  }

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function getLaunch() {
    let t = localStorage.getItem(LAUNCH_KEY);
    if (!t) {
      t = String(Date.now() - 169 * 3600 * 1000); // pretend it's been running a while, like the original
      localStorage.setItem(LAUNCH_KEY, t);
    }
    return parseInt(t, 10);
  }

  // ---- derived views ----
  function effectiveAmount(l) {
    return l.amount;
  }

  function tzOffsetMinutes(timeZone, date) {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone, hour12: false,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
    }).formatToParts(date).reduce((acc, p) => { acc[p.type] = p.value; return acc; }, {});
    const asUTC = Date.UTC(
      parts.year, parts.month - 1, parts.day,
      parts.hour === "24" ? 0 : parts.hour, parts.minute, parts.second,
    );
    return (asUTC - date.getTime()) / 60000;
  }

  function startOfTodayUTC() {
    const now = new Date();
    const ymd = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(now);
    return new Date(ymd + "T00:00:00Z").getTime();
  }

  function rankedListings({ today = false, category = null } = {}) {
    let list = state.listings.slice();
    if (today) {
      const cutoff = startOfTodayUTC();
      list = list.filter((l) => l.claimedAt >= cutoff);
    }
    if (category) list = list.filter((l) => l.category === category);
    list.sort((a, b) => {
      const ea = effectiveAmount(a), eb = effectiveAmount(b);
      if (eb !== ea) return eb - ea;
      return a.claimedAt - b.claimedAt;
    });
    return list.slice(0, MAX_BOARD_SIZE);
  }

  function categoryTotals() {
    const totals = {};
    for (const c of GENRES) totals[c] = 0;
    for (const l of state.listings) {
      if (l.id.startsWith("seed-")) continue; // unclaimed listings haven't actually been paid for — count as $0
      totals[l.category] = (totals[l.category] || 0) + l.amount;
    }
    return totals;
  }

  // ---- UI state ----
  let activeTab = "all";
  let activeCategory = null;
  let boardPage = 1;

  // ---- render ----
  function renderAll() {
    renderHero();
    renderBidWidget();
    renderCategories();
    renderFilterStatus();
    renderBoard();
    renderTodayTop();
    renderActivity();
    renderAbout();
  }

  function renderAbout() {
    const launch = getLaunch();
    const dateStr = new Date(launch).toLocaleString("en-US", {
      day: "numeric", month: "long", year: "numeric", hour: "numeric", minute: "2-digit",
      timeZone: "UTC",
    });
    $("#aboutLaunchDate").textContent = dateStr;
    $("#aboutVisitors").textContent = state.visitors.toLocaleString("en-US");
    $("#aboutRevenue").textContent = fmtMoney(state.totalEarned);
    const highest = state.listings.reduce((max, l) => Math.max(max, l.amount), 0);
    $("#aboutHighest").textContent = fmtMoney(highest);
  }

  function renderHero() {
    $("#totalEarned").textContent = fmtMoney(state.totalEarned);
    $("#visitorCount").textContent = state.visitors.toLocaleString("en-US");
    $("#onlineCount").textContent = String(onlineCount);
  }

  function currentTopAmount() {
    const list = rankedListings({ category: activeCategory });
    const top = list.length ? effectiveAmount(list[0]) : 0;
    return Math.max(MIN_BID - 1, top);
  }

  function sizeAmountInput(el) {
    el.size = Math.max(2, el.value.length);
  }

  function renderBidWidget() {
    $("#claimLabel").innerHTML = activeCategory
      ? `Get your <span class="claim-highlight">Mobile Game</span> to <span class="claim-highlight">#1</span> in ${escapeHtml(activeCategory)} for`
      : `Get your <span class="claim-highlight">Mobile Game</span> to <span class="claim-highlight">#1</span> for`;
    const top = currentTopAmount();
    const amountEl = $("#bidAmount");
    if (!amountEl.dataset.userEdited) {
      amountEl.value = top + 1;
    }
    sizeAmountInput(amountEl);
    const catSel = $("#bidCategory");
    if (!catSel.dataset.built) {
      for (const c of GENRES) {
        const opt = document.createElement("option");
        opt.value = c;
        opt.textContent = c;
        catSel.appendChild(opt);
      }
      catSel.dataset.built = "1";
    }
  }

  function renderCategories() {
    const totals = categoryTotals();
    const allTotal = Object.values(totals).reduce((sum, v) => sum + v, 0);
    const ul = $("#categoryList");
    ul.innerHTML = "";
    const allLi = document.createElement("li");
    allLi.className = activeCategory === null ? "active" : "";
    allLi.innerHTML = `<a href="#board" data-cat="">${ALL_ICON}<span>All</span><span class="cat-amt">${fmtMoney(allTotal)}</span></a>`;
    ul.appendChild(allLi);
    for (const c of GENRES) {
      const li = document.createElement("li");
      li.className = activeCategory === c ? "active" : "";
      li.innerHTML = `<a href="#board" data-cat="${c}">${GENRE_ICON}<span>${c}</span><span class="cat-amt">${fmtMoney(totals[c])}</span></a>`;
      ul.appendChild(li);
    }
    ul.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", (e) => {
        e.preventDefault();
        activeCategory = a.dataset.cat || null;
        boardPage = 1;
        renderCategories();
        renderBoard();
        renderBidWidget();
        renderFilterStatus();
      });
    });
  }

  function currentTopAmountFor(cat) {
    const list = rankedListings({ category: cat });
    return list.length ? effectiveAmount(list[0]) : 0;
  }

  function renderFilterStatus() {
    const el = $("#filterStatus");
    if (!activeCategory) {
      el.hidden = true;
      el.innerHTML = "";
      return;
    }
    const top = currentTopAmountFor(activeCategory);
    el.hidden = false;
    el.innerHTML = `<span>${escapeHtml(activeCategory)} — top bid right now: <strong class="money">${top ? fmtMoney(top) : "no bids yet"}</strong></span><button type="button" id="clearFilter">Clear filter</button>`;
    $("#clearFilter").addEventListener("click", () => {
      activeCategory = null;
      boardPage = 1;
      renderCategories();
      renderBoard();
      renderBidWidget();
      renderFilterStatus();
    });
  }

  function listingCard(l, rank) {
    const li = document.createElement("li");
    li.className = "listing-card" + (rank <= 3 ? ` rank-${rank}` : "");
    li.innerHTML = `
      <div class="rank-num">#${rank}</div>
      ${l.preview ? `<div class="listing-preview"><img class="preview-thumb" src="${l.preview}" alt="" loading="lazy" onerror="this.parentElement.remove()"></div>` : `<div class="listing-preview-empty"></div>`}
      <div class="listing-main">
        <div class="listing-title-row">
          <a class="listing-title" href="${safeHref(smartLinkFor(l))}" target="_blank" rel="noopener noreferrer" data-track="${l.id}"><img class="fav" src="${l.logo || faviconFor(slug(l.url))}" alt="" onerror="this.style.visibility='hidden'">${escapeHtml(l.title)}</a>
          <span class="badge">${escapeHtml(l.category)}</span>
        </div>
        <div class="listing-desc">${escapeHtml(l.desc || slug(l.url))}</div>
        <div class="listing-meta">
          <span>${timeAgo(l.claimedAt)}</span>
          <span class="meta-dot">•</span><span>${l.clicks.toLocaleString("en-US")} clicks</span>
        </div>
      </div>
      <div class="listing-side">
        <span class="money">${fmtMoney(l.amount)}</span>
        <button type="button" data-claim="${l.id}">claim this spot for ${fmtMoney(l.amount + 1)}</button>
      </div>
      ${rank === 1 && l.screenshots && l.screenshots.length ? `<div class="screenshot-strip">${l.screenshots.map((s) => `<img class="screenshot-thumb" src="${s}" alt="" loading="lazy" onerror="this.remove()">`).join("")}</div>` : ""}
    `;
    return li;
  }

  function paginationRange(current, total) {
    const delta = 1;
    const range = [];
    for (let i = 1; i <= total; i++) {
      if (i === 1 || i === total || (i >= current - delta && i <= current + delta)) {
        range.push(i);
      }
    }
    const withDots = [];
    let prev = null;
    for (const i of range) {
      if (prev !== null && i - prev > 1) withDots.push("...");
      withDots.push(i);
      prev = i;
    }
    return withDots;
  }

  function renderPagination(total) {
    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
    if (boardPage > totalPages) boardPage = totalPages;
    const nav = $("#boardPagination");
    const numbersEl = $("#pageNumbers");
    numbersEl.innerHTML = "";
    nav.hidden = totalPages <= 1;
    if (totalPages > 1) {
      paginationRange(boardPage, totalPages).forEach((p) => {
        if (p === "...") {
          const span = document.createElement("span");
          span.className = "page-ellipsis";
          span.textContent = "…";
          numbersEl.appendChild(span);
        } else {
          const btn = document.createElement("button");
          btn.type = "button";
          btn.className = "page-num" + (p === boardPage ? " active" : "");
          btn.textContent = p;
          btn.addEventListener("click", () => {
            boardPage = p;
            renderBoard();
            $("#board").scrollIntoView({ behavior: "smooth", block: "start" });
          });
          numbersEl.appendChild(btn);
        }
      });
      $("#pagePrev").disabled = boardPage === 1;
      $("#pageNext").disabled = boardPage === totalPages;
    }
    const summary = $("#pageSummary");
    if (!total) {
      summary.textContent = "";
    } else {
      const start = (boardPage - 1) * PAGE_SIZE + 1;
      const end = Math.min(total, boardPage * PAGE_SIZE);
      summary.textContent = `${start.toLocaleString("en-US")} – ${end.toLocaleString("en-US")} of ${total.toLocaleString("en-US")}`;
    }
  }

  function renderBoard() {
    const list = rankedListings({ today: activeTab === "today", category: activeCategory });
    const olTop = $("#listingListTop");
    const olRest = $("#listingListRest");
    olTop.innerHTML = "";
    olRest.innerHTML = "";
    const totalPages = Math.max(1, Math.ceil(list.length / PAGE_SIZE));
    if (boardPage > totalPages) boardPage = totalPages;
    const start = (boardPage - 1) * PAGE_SIZE;
    const shown = list.slice(start, start + PAGE_SIZE);

    const showInterstitial = boardPage === 1 && shown.length > 3;
    $("#todaySection").hidden = !showInterstitial;
    $("#activitySection").hidden = !showInterstitial;

    const topSlice = showInterstitial ? shown.slice(0, 3) : shown;
    const restSlice = showInterstitial ? shown.slice(3) : [];
    topSlice.forEach((l, i) => olTop.appendChild(listingCard(l, start + i + 1)));
    restSlice.forEach((l, i) => olRest.appendChild(listingCard(l, start + 3 + i + 1)));

    if (!shown.length) {
      const empty = document.createElement("li");
      empty.style.color = "var(--text-dim)";
      empty.style.fontSize = "13px";
      empty.style.padding = "20px";
      empty.textContent = "No games ranked here yet. Be the first to post a bid.";
      olTop.appendChild(empty);
    }
    [...olTop.querySelectorAll("[data-claim]"), ...olRest.querySelectorAll("[data-claim]")].forEach((btn) => {
      btn.addEventListener("click", () => claimRank(btn.dataset.claim));
    });
    [...olTop.querySelectorAll("[data-track]"), ...olRest.querySelectorAll("[data-track]")].forEach((a) => {
      a.addEventListener("click", () => trackClick(a.dataset.track));
    });
    renderPagination(list.length);
  }

  function renderTodayTop() {
    const list = rankedListings({ today: true }).slice(0, 3);
    const row = $("#todayTop");
    row.innerHTML = "";
    if (!list.length) {
      row.innerHTML = `<span class="today-empty">No bids posted today yet.</span>`;
      return;
    }
    list.forEach((l, i) => {
      const card = document.createElement("a");
      card.className = "today-card";
      card.href = safeHref(smartLinkFor(l));
      card.target = "_blank";
      card.rel = "noopener noreferrer";
      card.addEventListener("click", () => trackClick(l.id));
      card.innerHTML = `
        <div class="today-card-top">
          <span class="today-rank">#${i + 1}</span>
          <img class="fav" src="${l.logo || faviconFor(slug(l.url))}" alt="" onerror="this.style.visibility='hidden'">
          <span class="today-title">${escapeHtml(l.title)}</span>
        </div>
        <div class="today-desc">${escapeHtml(l.desc || slug(l.url))}</div>
        <div class="today-amt money">${fmtMoney(l.amount)}</div>
      `;
      row.appendChild(card);
    });
  }

  function renderActivity() {
    const items = state.activity.slice().sort((a, b) => b.ts - a.ts).slice(0, 12);
    const row = $("#activityList");
    row.innerHTML = "";
    items.forEach((a) => {
      const chip = document.createElement("a");
      chip.className = "activity-chip";
      chip.href = safeHref(smartLinkFor(a));
      chip.target = "_blank";
      chip.rel = "noopener noreferrer";
      chip.addEventListener("click", () => trackClick(a.id));
      chip.innerHTML = `
        <img class="fav" src="${a.logo || faviconFor(slug(a.url))}" alt="" onerror="this.style.visibility='hidden'">
        <span class="activity-chip-title">${escapeHtml(a.title)}</span>
        <span class="activity-chip-when">${timeAgo(a.ts)}</span>
      `;
      row.appendChild(chip);
    });
  }

  function detectDevice() {
    const ua = navigator.userAgent || "";
    if (/iPad|iPhone|iPod/.test(ua) && !window.MSStream) return "ios";
    if (/Android/i.test(ua)) return "android";
    return "other";
  }
  const DEVICE = detectDevice();

  function smartLinkFor(l) {
    if (DEVICE === "ios" && l.appStoreUrl) return l.appStoreUrl;
    if (DEVICE === "android" && l.playStoreUrl) return l.playStoreUrl;
    return l.url;
  }

  function safeHref(url) {
    const withProto = /^https?:\/\//.test(url) ? url : "https://" + url.replace(/^@/, "");
    try {
      const u = new URL(withProto);
      if (u.protocol === "http:" || u.protocol === "https:") return u.href;
    } catch { /* fall through */ }
    return "#";
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ---- actions ----
  // URL preview / auto-fetch state
  let previewTimer = null;
  let fetchedMeta = null; // { forUrl, title, desc, logo, preview }

  function schedulePreview(rawValue) {
    clearTimeout(previewTimer);
    const value = rawValue.trim();
    const box = $("#urlPreview");
    if (!value || value.length < 2) {
      box.hidden = true;
      fetchedMeta = null;
      return;
    }
    box.hidden = false;
    box.innerHTML = `<span class="preview-loading">fetching game info…</span>`;
    previewTimer = setTimeout(() => fetchPreview(value), 600);
  }

  async function fetchPreview(rawValue) {
    const href = resolveUrl(rawValue);
    const host = slug(href);
    const fallback = { forUrl: rawValue, title: host, desc: "", logo: faviconFor(host), preview: null, category: null, detectedStore: null };

    if (backendAvailable) {
      try {
        const res = await fetch(`/api/resolve?url=${encodeURIComponent(href)}`);
        if (res.ok) {
          const d = await res.json();
          fetchedMeta = {
            forUrl: rawValue,
            title: d.title || host,
            desc: d.desc || "",
            logo: d.logo || faviconFor(host),
            preview: d.preview || null,
            category: d.category || null,
            detectedStore: d.detectedStore || null,
          };
          renderPreview(fetchedMeta);
          applyAutoFill(fetchedMeta, href);
          return;
        }
      } catch {
        // fall through to the generic client-side preview below
      }
    }

    try {
      const res = await fetch(`https://api.microlink.io/?url=${encodeURIComponent(href)}&palette=false`);
      const json = await res.json();
      const d = json && json.data;
      if (json.status === "success" && d) {
        const logo = (d.logo && d.logo.url) || (d.image && d.image.url) || fallback.logo;
        fetchedMeta = {
          forUrl: rawValue,
          title: d.title || host,
          desc: d.description || "",
          logo,
          preview: (d.image && d.image.url) || null,
          category: null,
          detectedStore: null,
        };
      } else {
        fetchedMeta = fallback;
      }
    } catch {
      fetchedMeta = fallback;
    }
    renderPreview(fetchedMeta);
    applyAutoFill(fetchedMeta, href);
  }

  function applyAutoFill(meta, href) {
    if (meta.title && !$("#bidName").dataset.userEdited) $("#bidName").value = meta.title;
    if (meta.desc && !$("#bidDesc").dataset.userEdited) $("#bidDesc").value = meta.desc;
    if (meta.category && !$("#bidCategory").dataset.userEdited) $("#bidCategory").value = meta.category;
    if (meta.detectedStore === "appStore" && !$("#bidAppStore").dataset.userEdited) $("#bidAppStore").value = href;
    if (meta.detectedStore === "playStore" && !$("#bidPlayStore").dataset.userEdited) $("#bidPlayStore").value = href;
  }

  function renderPreview(meta) {
    const box = $("#urlPreview");
    box.hidden = false;
    box.innerHTML = `<img src="${meta.logo}" alt="" onerror="this.style.display='none'"><span class="preview-title">${escapeHtml(meta.title)}</span>`;
  }

  function placeBid({ url, rawUrl, title, category, desc, amount, appStoreUrl, playStoreUrl }) {
    amount = Math.max(5, Math.round(amount));
    const id = "u-" + Date.now() + "-" + Math.random().toString(36).slice(2, 7);
    const host = slug(url);
    const meta = fetchedMeta && fetchedMeta.forUrl === rawUrl ? fetchedMeta : null;
    const logo = (meta && meta.logo) || faviconFor(host);
    const preview = meta && meta.preview;
    const listing = {
      id,
      url,
      title,
      desc: desc || "",
      category,
      amount,
      clicks: 0,
      claimedAt: Date.now(),
      logo,
      preview,
      appStoreUrl: appStoreUrl || "",
      playStoreUrl: playStoreUrl || "",
      dailyClicks: [],
    };
    state.listings.push(listing);
    state.activity.push({ id, title: listing.title, url, amount, ts: listing.claimedAt, logo });
    state.totalEarned += amount;
    save();
    renderAll();
  }

  function claimRank(id) {
    const target = state.listings.find((l) => l.id === id);
    if (!target) return;
    const amount = target.amount + 1;
    $("#bidAmount").value = amount;
    $("#bidAmount").dataset.userEdited = "1";
    if (target.category) $("#bidCategory").value = target.category;
    $("#bidWidget").scrollIntoView({ behavior: "smooth", block: "center" });
    $("#bidUrl").focus();
  }

  // ---- wire up ----
  function init() {
    // theme
    const savedTheme = localStorage.getItem("mobilegame_theme") || "light";
    document.documentElement.dataset.theme = savedTheme;
    $("#themeToggle").textContent = savedTheme === "dark" ? "☀️" : "🌙";
    $("#themeToggle").addEventListener("click", () => {
      const cur = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = cur;
      localStorage.setItem("mobilegame_theme", cur);
      $("#themeToggle").textContent = cur === "dark" ? "☀️" : "🌙";
    });

    // tabs
    $$(".tab").forEach((tab) => {
      tab.addEventListener("click", () => {
        $$(".tab").forEach((t) => {
          t.classList.remove("active");
          t.setAttribute("aria-selected", "false");
        });
        tab.classList.add("active");
        tab.setAttribute("aria-selected", "true");
        activeTab = tab.dataset.tab;
        boardPage = 1;
        renderBoard();
      });
    });

    // stepper
    $("#stepDown").addEventListener("click", () => {
      const el = $("#bidAmount");
      el.dataset.userEdited = "1";
      el.value = Math.max(5, (parseInt(el.value, 10) || 5) - 1);
      sizeAmountInput(el);
    });
    $("#stepUp").addEventListener("click", () => {
      const el = $("#bidAmount");
      el.dataset.userEdited = "1";
      el.value = (parseInt(el.value, 10) || 5) + 1;
      sizeAmountInput(el);
    });
    $("#bidAmount").addEventListener("input", (e) => {
      e.target.dataset.userEdited = "1";
      e.target.value = e.target.value.replace(/[^0-9]/g, "");
      sizeAmountInput(e.target);
    });

    // auto-fetch logo/title/genre/preview as the URL is typed
    $("#bidUrl").addEventListener("input", (e) => schedulePreview(e.target.value));

    // on mobile, the name/genre/store-link/pitch fields start collapsed —
    // they're usually auto-filled from the URL above anyway
    $("#moreDetailsToggle").addEventListener("click", () => {
      const box = $("#moreDetailsFields");
      const open = box.classList.toggle("open");
      $("#moreDetailsToggle").textContent = open ? "Fewer details ▴" : "More details ▾";
      $("#moreDetailsToggle").setAttribute("aria-expanded", String(open));
    });

    // once the gamer types into one of these directly, stop auto-filling it
    ["#bidName", "#bidDesc", "#bidCategory", "#bidAppStore", "#bidPlayStore"].forEach((sel) => {
      $(sel).addEventListener("input", (e) => { e.target.dataset.userEdited = "1"; });
    });

    // form
    $("#bidForm").addEventListener("submit", async (e) => {
      e.preventDefault();
      const name = $("#bidName").value.trim();
      const rawUrl = $("#bidUrl").value.trim();
      const category = $("#bidCategory").value;
      const desc = $("#bidDesc").value.trim();
      const amount = parseInt($("#bidAmount").value, 10);
      const appStoreUrl = $("#bidAppStore").value.trim();
      const playStoreUrl = $("#bidPlayStore").value.trim();
      const msg = $("#formMsg");

      if (!rawUrl) { msg.textContent = "Enter a link."; msg.className = "form-msg error"; return; }
      if (!name || !category) {
        $("#moreDetailsFields").classList.add("open");
        $("#moreDetailsToggle").textContent = "Fewer details ▴";
        $("#moreDetailsToggle").setAttribute("aria-expanded", "true");
        msg.textContent = !name ? "Enter the game's name." : "Choose a genre.";
        msg.className = "form-msg error";
        return;
      }
      if (!amount || amount < 5) { msg.textContent = "Minimum bid is $5."; msg.className = "form-msg error"; return; }

      const url = resolveUrl(rawUrl);
      const preview = fetchedMeta && fetchedMeta.forUrl === rawUrl ? fetchedMeta.preview : null;

      if (backendAvailable && stripeConfigured) {
        const submitBtn = $("#bidForm button[type=submit]");
        submitBtn.disabled = true;
        msg.textContent = "Taking you to checkout…";
        msg.className = "form-msg";
        try {
          const res = await fetch("/api/checkout", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name, url, category, desc, amount, appStoreUrl, playStoreUrl, preview }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Something went wrong.");
          window.location.href = data.url;
        } catch (err) {
          msg.textContent = err.message || "Couldn't start checkout. Try again.";
          msg.className = "form-msg error";
          submitBtn.disabled = false;
        }
        return;
      }

      // No payment backend running — fall back to the local-only demo.
      placeBid({ url, rawUrl, title: name, category, desc, amount, appStoreUrl, playStoreUrl });
      msg.textContent = `You posted a ${fmtMoney(amount)} bid! (demo mode — no backend running, so no real payment was taken)`;
      msg.className = "form-msg success";
      $("#bidForm").reset();
      ["#bidAmount", "#bidName", "#bidDesc", "#bidCategory", "#bidAppStore", "#bidPlayStore"].forEach((sel) => {
        $(sel).dataset.userEdited = "";
      });
      $("#bidCategory").value = "";
      $("#urlPreview").hidden = true;
      fetchedMeta = null;
    });

    // pagination
    $("#pagePrev").addEventListener("click", () => {
      if (boardPage > 1) { boardPage -= 1; renderBoard(); $("#board").scrollIntoView({ behavior: "smooth", block: "start" }); }
    });
    $("#pageNext").addEventListener("click", () => {
      boardPage += 1;
      renderBoard();
      $("#board").scrollIntoView({ behavior: "smooth", block: "start" });
    });

    // online counter: real heartbeat-backed count once a backend is found,
    // otherwise a gently drifting fake number so the demo still feels alive
    setInterval(() => {
      if (backendAvailable) return;
      onlineCount = Math.max(20, onlineCount + Math.floor(Math.random() * 11) - 5);
      renderHero();
    }, 4000);
    setInterval(() => {
      if (backendAvailable) sendHeartbeat();
    }, 20000);

    setInterval(renderAll, 30000); // keep relative timestamps + launch hours fresh

    // wait for the real backend before showing any numbers — avoids flashing
    // stale/local demo figures on screen before the real data arrives
    tryLoadBackend().then(() => {
      if (backendAvailable) sendHeartbeat();
      const params = new URLSearchParams(window.location.search);
      const msg = $("#formMsg");
      if (params.get("bid") === "success") {
        msg.textContent = "Bid paid — you're on the board!";
        msg.className = "form-msg success";
        tryLoadBackend();
      } else if (params.get("bid") === "cancelled") {
        msg.textContent = "Checkout cancelled — no charge was made.";
        msg.className = "form-msg error";
      }
      if (params.has("bid")) {
        params.delete("bid");
        const qs = params.toString();
        window.history.replaceState({}, "", window.location.pathname + (qs ? `?${qs}` : ""));
      }
    });
  }

  document.addEventListener("DOMContentLoaded", init);
})();
