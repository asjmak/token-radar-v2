// Launch Radar — fitted-comp-1 dashboard. Renders window.RADAR (written by main.ts as
// ../data.js), re-checks the board's own claims live in the integrity strip, and routes
// #/p/<slug> to a per-protocol detail view. No network, no framework.
(function () {
  'use strict';
  var R = window.RADAR;
  var $ = function (id) { return document.getElementById(id); };
  if (!R) { $('m-standfirst').textContent = 'The board data (data.js) did not load.'; return; }

  var rows = R.rows;
  var bySlug = {};
  rows.forEach(function (r) { bySlug[r.slug] = r; });

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function money(v) {
    if (v >= 1e9) return '$' + (v / 1e9).toFixed(2) + 'B';
    if (v >= 1e6) return '$' + (v / 1e6).toFixed(1) + 'M';
    if (v >= 1e3) return '$' + (v / 1e3).toFixed(1) + 'K';
    return '$' + v;
  }
  function pct(v, dp) { return (v * 100).toFixed(dp === undefined ? 0 : dp) + '%'; }
  function ageLabel(days) {
    if (days === null || days === undefined) return '—';
    if (days < 365) return Math.round(days / 30.44) + ' mo';
    return (days / 365.25).toFixed(1) + ' yr';
  }

  // ---------------------------------------------------------- masthead + cover
  var acc = R.accounting;
  $('m-version').textContent = R.model_version;
  $('m-standfirst').textContent =
    'Snapshot of ' + R.as_of + '. ' + acc.scanned + ' protocols accounted for: ' + acc.launched +
    ' already record a token, ' + acc.board_rows + ' are ranked below, ' + acc.aside +
    ' set aside as products of tokens that already trade. Ranked by expected value — a fitted launch value, weighted by fitted launch odds.';
  $('m-chips').innerHTML =
    '<span class="chip"><b>' + acc.board_rows + '</b> ranked</span>' +
    '<span class="chip"><b>' + acc.watchlist_rows + '</b> watchlist covered</span>' +
    '<span class="chip"><b>' + acc.early_rows + '</b> early finds</span>' +
    '<span class="chip">leave-one-out <b>×' + R.validation.loo.median_factor + '</b></span>' +
    '<span class="chip">walk-forward <b>×' + R.validation.wf.median_factor + '</b></span>';
  $('m-source').textContent = 'Source: ' + R.source + ' Watchlist floor: ' + money(R.floor_usd) + ' TVL.';

  var kept = R.validation.trials.filter(function (t) { return t.kept; });
  var dropped = R.validation.trials.filter(function (t) { return !t.kept; });
  var trialRows = R.validation.trials.map(function (t) {
    return '<tr><td>' + esc(t.term) + '</td><td class="num">' + t.loo_median + '</td><td class="num">' + t.wf_median + '</td>' +
      '<td>' + (t.kept ? '<span class="kept">kept</span> (coef ' + t.coef + ')' : '<span class="dropped">dropped</span>') + '</td></tr>';
  }).join('');
  var topOffsets = R.fit.offsets.slice(0, 8).map(function (o) {
    return '<tr><td>' + esc(o.category) + '</td><td class="num">' + o.peers + '</td><td class="num">×' + o.mult + '</td></tr>';
  }).join('');
  function fAt(days) {
    var k = R.odds.knots;
    if (days <= k[0][0]) return k[0][1];
    for (var i = 1; i < k.length; i++) {
      if (days <= k[i][0]) {
        return k[i - 1][1] + ((k[i][1] - k[i - 1][1]) * (days - k[i - 1][0])) / (k[i][0] - k[i - 1][0]);
      }
    }
    return k[k.length - 1][1];
  }
  var fLine = [182, 365, 730, 1095, 1460, 1825].map(function (d) {
    return 'F(' + (d / 365.25).toFixed(d < 730 ? 1 : 0) + 'y)=' + fAt(d).toFixed(2);
  }).join(' · ');
  $('cover-body').innerHTML =
    '<div class="cover-grid">' +
    '<div><h3>The fitted value model</h3>' +
    '<p>log<sub>10</sub>(launch value) = <b>' + R.fit.intercept + '</b> + <b>' + R.fit.slope + '</b> × log<sub>10</sub>(TVL) ' +
    '+ category offset' + (kept.length ? ' + ' + kept.map(function (t) { return '<b>' + t.coef + '</b> × ' + t.term; }).join(' + ') : '') +

    '.</p><p>Fitted on the <b>' + R.fit.comps + ' traded protocols</b> in launch-comparable categories — of the ' + R.fit.traded +
    ' protocols carrying a market cap, exchanges, staking and bridge products are set aside as teachers, and a trim pass dropped ' +
    R.fit.trimmed + ' outlier comp' + (R.fit.trimmed === 1 ? '' : 's') + ' the first fit missed by over 2.25σ before refitting. ' +
    'The slope under 1 is the size discount: doubling TVL does not double a launch price. Category offsets are ' +
    'shrunk toward the curve, so thin categories barely move a price.</p>' +
    '<table class="mini"><thead><tr><th>Category offset</th><th class="num">Comps</th><th class="num">Mult</th></tr></thead><tbody>' + topOffsets + '</tbody></table></div>' +
    '<div><h3>Two blind tests, or the term is dropped</h3>' +
    '<p>Size curve + offsets alone: leave-one-out ×' + R.validation.baseline.loo_median + ', walk-forward ×' + R.validation.baseline.wf_median + '. ' +
    'A term joins only if it improves <b>both</b> medians by at least 0.5%. Final model: <span class="big">LOO ×' + R.validation.loo.median_factor +
    '</span> and <span class="big">WF ×' + R.validation.wf.median_factor + '</span> — the typical factor the price is wrong by, on protocols the fit never saw ' +
    '(walk-forward trains on the oldest ' + R.validation.wf_train + ' dated comps and is tested on the newest ' + R.validation.wf.n + ').</p>' +
    '<table class="mini"><thead><tr><th>Term trial</th><th class="num">LOO ×</th><th class="num">WF ×</th><th>Verdict</th></tr></thead><tbody>' + trialRows + '</tbody></table>' +
    (dropped.length ? '<p>Dropped, and named: ' + dropped.map(function (t) { return t.term; }).join(', ') + ' — on this snapshot they did not survive both tests.</p>' : '') +
    '</div>' +
    '<div><h3>Launch odds, from the peers’ record</h3>' +
    '<p>F(a) is the share of dated protocols that record a token by age a: ' + fLine + '. A protocol still tokenless at age a gets ' +
    'odds (F(a+2y) − F(a)) / (1 − F(a)) — of its peers that reached a without a token, the share that launched within two years — ' +
    'scaled by its category’s own launch record (market-wide, ' + pct(R.odds.global_share, 1) + ' of protocols record a token). ' +
    'Old, still-tokenless protocols get low odds: their peers mostly launched long ago or never did.</p>' +
    '<p>Farm verdicts are costed, not vibes: gas by chain, capital locked at 5%/yr over the hold, the reader’s minutes priced in. ' +
    'FARM when the launch odds reach 30%, the plan breaks even capturing ≤0.25% of the row’s expected value, and the hour costs ≤$25; ' +
    'THIN from 15% odds and ≤1.2% capture; SKIP beyond — a cheap plan for a launch the record says is not coming is still a skip.</p></div>' +
    '</div>';

  // ---------------------------------------------------------- integrity strip
  function check(list, ok, label, why) { list.push({ ok: ok, label: label, why: why }); }
  var checks = [];
  check(checks, rows.length === acc.board_rows, 'Board size',
    rows.length + ' rows rendered, ' + acc.board_rows + ' claimed');
  var ranksOk = rows.every(function (r, i) { return r.rank === i + 1; });
  check(checks, ranksOk, 'Ranks are exactly 1..N', 'checked every row in rank order');
  var mono = true;
  for (var i = 1; i < rows.length; i++) if (rows[i].implied_value_usd > rows[i - 1].implied_value_usd) mono = false;
  check(checks, mono, 'Expected value never rises as rank ascends', 'the gate’s sorted_by_value row, recomputed');
  var wl = rows.filter(function (r) { return r.watchlist; }).length;
  check(checks, wl === acc.watchlist_rows && acc.watchlist_rows + acc.early_rows === acc.board_rows,
    'Watchlist coverage', wl + ' of ' + acc.watchlist_rows + ' watchlist protocols ranked, none missing');
  check(checks, acc.launched + acc.pre_token === acc.scanned && acc.board_rows + acc.aside === acc.pre_token,
    'Full accounting', acc.launched + ' launched + ' + acc.board_rows + ' ranked + ' + acc.aside + ' set aside = ' + acc.scanned);
  var evOk = rows.every(function (r) { return Math.abs(Math.round(r.launch_value_usd * r.launch_odds) - r.implied_value_usd) <= 1; });
  check(checks, evOk, 'Expected = launch × odds on every row', 'recomputed for all ' + rows.length + ' rows');
  var stepsOk = rows.every(function (r) {
    return r.farm_steps.length >= 3 && r.farm_steps.length <= 12 &&
      r.farm_steps.every(function (s) { var t = s.trim(); return t.length >= 20 && t.length <= 600; });
  });
  check(checks, stepsOk, 'Farm steps within the gate’s bounds', '3–12 steps a row, 20–600 characters each');

  // Re-derive three filed launch values from the printed coefficients alone.
  var offsetMult = {};
  R.fit.offsets.forEach(function (o) { offsetMult[o.category] = o.mult; });
  var coef = {};
  kept.forEach(function (t) { coef[t.term] = t.coef; });
  function termVal(term, r) {
    if (term === 'growth') return Math.min(80, Math.max(-40, r.change_7d === null ? 0 : r.change_7d)) / 100;
    if (term === 'age') return (r.age_days === null ? R.fit.age_fallback : Math.min(r.age_days, 1825)) / 365.25;
    return Math.min(Math.max(r.chains.length - 1, 0), 5);
  }
  function rederive(r) {
    var log = R.fit.intercept + R.fit.slope * Math.log10(r.tvl_usd) + Math.log10(offsetMult[r.category || '(none)'] || 1);
    Object.keys(coef).forEach(function (t) { log += coef[t] * termVal(t, r); });
    return Math.pow(10, log);
  }
  var probes = [rows[0], rows[Math.floor(rows.length / 2)], rows[rows.length - 1]];
  var reOk = probes.every(function (r) {
    return Math.abs(rederive(r) - r.launch_value_usd) / r.launch_value_usd <= 0.015;
  });
  check(checks, reOk, 'Filed values re-derive from the printed coefficients',
    'ranks 1, ' + probes[1].rank + ' and ' + probes[2].rank + ' recomputed in your browser, within rounding');
  $('checks').innerHTML = checks.map(function (c) {
    return '<li class="' + (c.ok ? 'pass' : 'fail') + '"><b>' + esc(c.label) + '</b> — <span class="why">' + esc(c.why) + '</span></li>';
  }).join('');

  // ---------------------------------------------------------- board table
  var cats = [];
  var chains = [];
  rows.forEach(function (r) {
    if (r.category && cats.indexOf(r.category) < 0) cats.push(r.category);
    r.chains.forEach(function (c) { if (chains.indexOf(c) < 0) chains.push(c); });
  });
  cats.sort(); chains.sort();
  $('f-category').innerHTML = '<option value="">All categories</option>' + cats.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');
  $('f-chain').innerHTML = '<option value="">All chains</option>' + chains.map(function (c) { return '<option>' + esc(c) + '</option>'; }).join('');

  function renderBoard() {
    var q = $('q').value.trim().toLowerCase();
    var cat = $('f-category').value, ch = $('f-chain').value, set = $('f-set').value, ver = $('f-verdict').value;
    var list = rows.filter(function (r) {
      if (q && r.name.toLowerCase().indexOf(q) < 0 && r.slug.indexOf(q) < 0) return false;
      if (cat && r.category !== cat) return false;
      if (ch && r.chains.indexOf(ch) < 0) return false;
      if (set === 'watchlist' && !r.watchlist) return false;
      if (set === 'early' && r.watchlist) return false;
      if (ver && r.farm.verdict !== ver) return false;
      return true;
    });
    var sort = $('f-sort').value;
    var keyed = list.slice();
    if (sort === 'launch') keyed.sort(function (a, b) { return b.launch_value_usd - a.launch_value_usd; });
    else if (sort === 'tvl') keyed.sort(function (a, b) { return b.tvl_usd - a.tvl_usd; });
    else if (sort === 'odds') keyed.sort(function (a, b) { return b.launch_odds - a.launch_odds; });
    else if (sort === 'cheap') keyed.sort(function (a, b) { return a.farm.per_hour_usd - b.farm.per_hour_usd; });
    else keyed.sort(function (a, b) { return a.rank - b.rank; });
    $('row-count').textContent = 'Showing ' + keyed.length + ' of ' + rows.length + ' ranked protocols.';
    $('board-body').innerHTML = keyed.map(function (r) {
      var chg = r.change_7d === null ? '—' : '<span class="' + (r.change_7d >= 0 ? 'pos' : 'neg') + '">' + (r.change_7d >= 0 ? '+' : '') + r.change_7d.toFixed(1) + '%</span>';
      return '<tr class="rowlink" data-slug="' + esc(r.slug) + '"><td class="num">' + r.rank + '</td>' +
        '<td><span class="pname">' + esc(r.name) + '</span>' + (r.watchlist ? '<span class="wl">watchlist</span>' : '') + '</td>' +
        '<td>' + esc(r.category || '—') + '</td><td class="num">' + money(r.tvl_usd) + '</td><td class="num">' + chg + '</td>' +
        '<td class="num">' + ageLabel(r.age_days) + '</td><td class="num">' + money(r.launch_value_usd) + '</td>' +
        '<td class="num">' + pct(r.launch_odds, 0) + '</td><td class="num"><b>' + money(r.implied_value_usd) + '</b></td>' +
        '<td><span class="verdict ' + r.farm.verdict + '">' + r.farm.verdict + '</span><span class="perhour">$' + r.farm.per_hour_usd + '/hr · ' + r.farm.hours + 'h</span></td></tr>';
    }).join('');
    Array.prototype.forEach.call(document.querySelectorAll('tr.rowlink'), function (tr) {
      tr.addEventListener('click', function () { location.hash = '#/p/' + tr.getAttribute('data-slug'); });
    });
  }
  ['q', 'f-category', 'f-chain', 'f-set', 'f-verdict', 'f-sort'].forEach(function (id) {
    $(id).addEventListener('input', renderBoard);
    $(id).addEventListener('change', renderBoard);
  });

  $('live-body').innerHTML = R.live.map(function (p) {
    return '<tr><td><span class="pname">' + esc(p.name) + '</span></td><td>' + esc(p.symbol || '—') + '</td><td>' + esc(p.category || '—') + '</td>' +
      '<td class="num">' + money(p.tvl_usd) + '</td><td class="num">' + money(p.mcap_usd) + '</td><td class="num">' + p.ratio + '</td></tr>';
  }).join('');

  // ---------------------------------------------------------- detail view
  function multRow(label, v) {
    return v === null ? '' : '<tr><td>' + label + '</td><td class="num">× ' + v + '</td></tr>';
  }
  function renderDetail(slug) {
    var r = bySlug[slug];
    if (!r) { location.hash = ''; return; }
    var near = rows.filter(function (x) { return Math.abs(x.rank - r.rank) <= 2 && x.slug !== r.slug; });
    $('detail').innerHTML =
      '<section class="panel"><h2>' + esc(r.name) + (r.watchlist ? '<span class="wl">watchlist</span>' : '') + '</h2>' +
      '<p class="note">Rank #' + r.rank + ' of ' + rows.length + ' · ' + esc(r.category || 'uncategorised') + ' · on ' + r.chains.map(esc).join(', ') +
      ' · listed by DefiLlama ' + (r.listed_at || 'on an unrecorded date') + ' · records no token.</p>' +
      '<div class="statgrid">' +
      '<div class="stat"><div class="k">TVL</div><div class="v">' + money(r.tvl_usd) + '</div></div>' +
      '<div class="stat"><div class="k">7-day change</div><div class="v">' + (r.change_7d === null ? '—' : r.change_7d.toFixed(1) + '%') + '</div></div>' +
      '<div class="stat"><div class="k">Age, no token</div><div class="v">' + ageLabel(r.age_days) + '</div></div>' +
      '<div class="stat"><div class="k">Launch value</div><div class="v">' + money(r.launch_value_usd) + '</div></div>' +
      '<div class="stat"><div class="k">Launch odds</div><div class="v">' + pct(r.launch_odds, 1) + '</div></div>' +
      '<div class="stat"><div class="k">Expected value</div><div class="v">' + money(r.implied_value_usd) + '</div></div>' +
      '</div>' +
      '<h3>How this row was priced</h3><table class="derive">' +
      '<tr><td>Size curve on its TVL (fitted)</td><td class="num">' + money(r.model.size_value_usd) + '</td></tr>' +
      multRow('Category offset — ' + esc(r.category || '(none)'), r.model.category_mult) +
      multRow('Growth term (7-day TVL change)', r.model.growth_mult) +
      multRow('Age term (years listed, no token)', r.model.age_mult) +
      multRow('Breadth term (extra chains)', r.model.chains_mult) +
      '<tr class="total"><td>Launch value, if it issued today</td><td class="num">' + money(r.launch_value_usd) + '</td></tr>' +
      '<tr><td>Launch odds: age base ' + r.model.odds_age_base + ' × category factor ' + r.model.odds_category_factor + '</td><td class="num">' + pct(r.launch_odds, 1) + '</td></tr>' +
      '<tr class="total"><td>Expected value — the rank’s claim</td><td class="num">' + money(r.implied_value_usd) + '</td></tr></table>' +
      '<h3>The farm plan — verdict ' + r.farm.verdict + '</h3>' +
      '<p class="note">Capital $' + r.farm.capital_usd + ' · gas $' + r.farm.gas_usd + ' · lock-up $' + r.farm.lock_usd +
      ' · all-in $' + r.farm.total_usd + ' over ' + r.farm.hours + ' hours ($' + r.farm.per_hour_usd + '/hour) · hold ' + r.farm.hold_days +
      ' days · breaks even capturing ' + (r.farm.capture_pct < 0.01 ? '<0.01' : r.farm.capture_pct) + '% of the expected value.</p>' +
      '<ol class="steps">' + r.farm_steps.map(function (s) { return '<li>' + esc(s) + '</li>'; }).join('') + '</ol>' +
      '<h3>Nearby on the board</h3><div class="nearby">' +
      near.map(function (x) { return '<a href="#/p/' + esc(x.slug) + '">#' + x.rank + ' ' + esc(x.name) + ' · ' + money(x.implied_value_usd) + '</a>'; }).join('') +
      '</div></section>';
    $('view-board').hidden = true;
    $('view-detail').hidden = false;
    window.scrollTo(0, 0);
  }
  function route() {
    var m = location.hash.match(/^#\/p\/(.+)$/);
    if (m) renderDetail(decodeURIComponent(m[1]));
    else { $('view-detail').hidden = true; $('view-board').hidden = false; }
  }
  window.addEventListener('hashchange', route);
  renderBoard();
  route();
})();
