/* "Spending with guardian" flow — Figma section 30:9824.
   Uses the shared API in js/app.js (window.proto). Home's "Invest with Gaurdian" card opens the hub (30:11908). */
(function () {
  'use strict';

  var P = window.proto;
  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var SENT_MS = 2600;      // "Sharing invitation is sent" until the answer arrives
  var TX_MS = 1800;        // the first shared transactions arrive on the Spending page …
  var REACT_MS = 2400;     // … and Mom reacts to them a moment later (30:10046 → 30:10239)
  var FIGMA_BUDGETS = ['Eat out', 'Transportation', 'Education'];   // picked in 30:11608, listed in 30:11659
  var TODAY = { y: 2026, m: 7, d: 5 };                              // the ringed day in 30:11031
  var MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September',
    'October', 'November', 'December'];

  // Transactions as drawn in the Spending frames. kind: 'bold' 20 px emoji, 'big' 25 px, 'pad' 25 px pushed 7 px down.
  var TX = {
    tfl: { name: 'TFL', time: '12:20 PM Today', timeW: 75, cat: 'Transportation', emoji: '🚌', bg: '#04d180', kind: 'bold' },
    sb1: { name: 'Starbucks', time: '12:20 PM   Yesterday', timeW: 92, cat: 'Food', emoji: '🥤', bg: '#ff8b8b', kind: 'big' },
    sb2: { name: 'Starbucks', time: '12:20 PM   Yesterday', timeW: 92, cat: 'Food', emoji: '‍🎓', bg: '#b0ffa1', kind: 'pad' },
    sb3: { name: 'Starbucks', time: '5:20 PM   Yesterday', timeW: 92, cat: 'Food', emoji: '‍🎓', bg: '#b0ffa1', kind: 'pad' },
    zara: { name: 'Zara', time: '12:20 PM   Yesterday', timeW: 92, cat: 'Shopping', emoji: '‍🛍️', bg: '#ffd864', kind: 'pad' }
  };
  var LISTS = {
    spending: ['tfl', 'sb1', 'sb2'],                 // 30:10046
    category: ['tfl', 'tfl-2', 'tfl-3', 'tfl-4'],    // 30:10534 (Transport)
    dates: ['tfl', 'sb1', 'sb3', 'zara']             // 30:10841
  };
  var MOM_REACTS = { tfl: { emoji: true, share: true }, sb1: { like: true } };   // 30:10239

  var g;
  function fresh() {
    return {
      pick: null,          // the person ticked on "Who are you teaming up with?"
      person: null,        // … once confirmed
      budgets: [],
      hasTx: false,
      momReacted: false,
      reacts: {},
      view: 'spending',
      calOpen: false,
      cal: { y: TODAY.y, m: TODAY.m },
      picked: null
    };
  }

  function person() { return g.person || 'Mom'; }
  function isParent() { return person() === 'Mom' || person() === 'Dad'; }

  /* ---------- Names in the copy follow the person you picked (Figma shows Mom) ---------- */
  function applyPerson() {
    var n = person();
    $('#guardianSentBody').textContent = 'Let’s wait if ' + n + ' also wants to do spending sharing challenge';
    $('#guardianYesTitle').textContent = n + ' says YES';
    $('#guardianYesBody').textContent = 'Now it is time to set up how much you wish to share you spending with ' + n;
    $('#guardianBudgetsTitle').textContent = 'What budgeting do you want to share with ' + n + '?';
    $('#guardianAsk').textContent = 'Ask if ' + n + ' is ok with the plan';
    $('#guardianNextTo').textContent = n === 'Mom' ? 'She is next to me she is ok'
      : n === 'Dad' ? 'He is next to me he is ok'
      : n + ' is next to me and is ok';
    $('#guardianBoomTitle').textContent = 'Boom! You are sharing spending with ' + (isParent() ? 'your ' : '') + n + ' from now on!';
  }

  /* ---------- G2 · Who are you teaming up with? ---------- */
  var people = $$('#guardianPeople .gd-person');
  var whoNext = $('#guardianWhoNext');

  function syncPeople() {
    people.forEach(function (b) {
      var on = b.dataset.person === g.pick;
      b.setAttribute('aria-checked', String(on));
      b.querySelector('img').src = 'assets/img/checkbox-' + (on ? 'on' : 'off') + '.svg';
    });
    whoNext.disabled = !g.pick;
  }
  people.forEach(function (b) {
    b.addEventListener('click', function () {
      g.pick = g.pick === b.dataset.person ? null : b.dataset.person;
      syncPeople();
    });
  });
  P.action('guardian-who-next', function () {
    if (!g.pick) return;
    g.person = g.pick;
    applyPerson();
    P.go('guardian-sent');
  });

  /* ---------- G5 · Budgets to share ---------- */
  var chips = $$('#guardianPicks .gd-chip[data-budget]');
  var allChip = $('#guardianAll');
  var budgetsNext = $('#guardianBudgetsNext');

  function syncChips() {
    chips.forEach(function (c) { c.setAttribute('aria-pressed', String(g.budgets.indexOf(c.dataset.budget) >= 0)); });
    allChip.setAttribute('aria-pressed', String(g.budgets.length === chips.length));
    budgetsNext.disabled = !g.budgets.length;
  }
  function budgetOrder(list) {
    return chips.map(function (c) { return c.dataset.budget; }).filter(function (b) { return list.indexOf(b) >= 0; });
  }
  chips.forEach(function (c) {
    c.addEventListener('click', function () {
      var b = c.dataset.budget;
      var i = g.budgets.indexOf(b);
      if (i >= 0) g.budgets.splice(i, 1);
      else g.budgets = budgetOrder(g.budgets.concat(b));
      syncChips();
    });
  });
  allChip.addEventListener('click', function () {
    g.budgets = g.budgets.length === chips.length ? [] : chips.map(function (c) { return c.dataset.budget; });
    syncChips();
  });

  /* ---------- G6 · Confirm ---------- */
  function renderSummary() {
    var list = $('#guardianSumList');
    list.innerHTML = '';
    (g.budgets.length ? g.budgets : FIGMA_BUDGETS).forEach(function (b) {
      var p = document.createElement('p');
      p.textContent = b;
      list.appendChild(p);
    });
    list.scrollTop = 0;
  }

  /* ---------- G7 → G8 · Insight, Spending ---------- */
  P.action('guardian-insight-start', function () { P.goFresh('guardian-insight'); });
  P.action('guardian-tab-spending', function () { if (!P.isBusy()) P.jump('guardian-spending'); });
  P.action('guardian-tab-insight', function () { if (!P.isBusy()) P.jump('guardian-insight'); });

  /* ---------- G9 · Spending ---------- */
  var spendScroll = $('#guardianSpendScroll');
  var spendPage = $('#guardianSpendPage');
  var views = $$('.gs-view');
  var panes = $$('.gs-pane');
  var dateBtn = $('#guardianDateBtn');
  var cal = $('#guardianCal');
  var dateTx = $('#guardianDateTx');

  function reactsOf(key) { return g.reacts[key] || (g.reacts[key] = {}); }

  function reactionHtml(key, r) {
    var on = !!reactsOf(key)[r];
    var label = { like: 'Like', emoji: 'React', share: 'Share' }[r];
    var inner;
    if (!on) inner = '<img src="assets/img/gsp-' + r + '.svg" alt="">';
    else if (r === 'like') inner = '<img src="assets/img/gsp-like-on.svg" alt=""><span class="gs-r-n">1</span>';
    else inner = '<span class="gs-r-in"><img src="assets/img/gsp-' + r + '-sm.svg" alt=""><span class="gs-r-n">1</span></span>';
    return '<button class="gs-r gs-r--' + r + (on ? ' is-on' : '') + '" type="button" data-key="' + key + '" data-r="' + r +
      '" aria-pressed="' + on + '" aria-label="' + label + '">' + inner + '</button>';
  }

  function txHtml(key, i, list) {
    var t = TX[key.replace(/-\d$/, '')];
    var ico = t.kind === 'pad'
      ? '<span class="gs-tx-pt"><b>' + t.emoji + '</b></span>'
      : '<b' + (t.kind === 'big' ? ' class="is-big"' : '') + '>' + t.emoji + '</b>';
    // Category (30:10534): the cards after the first have 16 px top padding and sit 4 px further apart.
    var cardPad = list === 'category' && i > 0 ? ' style="padding-top:16px"' : '';
    var gap = list === 'category' && i === 0 ? ' style="margin-bottom:4px"' : '';
    return '<div class="gs-tx"' + gap + '>' +
      '<div class="gs-tx-pad"><div class="gs-tx-card"' + cardPad + '>' +
        '<span class="gs-tx-ico" style="background:' + t.bg + '">' + ico + '</span>' +
        '<span class="gs-tx-body"><span class="gs-tx-row">' +
          '<span class="gs-tx-left"><span class="gs-tx-name">' + t.name + '</span>' +
            '<span class="gs-tx-time" style="width:' + t.timeW + 'px">' + t.time + '</span>' +
            '<span class="gs-tx-cat">' + t.cat + '</span></span>' +
          '<span class="gs-tx-amt">£ 3.10</span>' +
        '</span></span>' +
      '</div></div>' +
      '<div class="gs-react">' + reactionHtml(key, 'like') + reactionHtml(key, 'emoji') + reactionHtml(key, 'share') + '</div>' +
    '</div>';
  }

  function renderLists() {
    $$('.gs-list').forEach(function (el) {
      var list = el.dataset.list;
      if (!g.hasTx) {
        // 30:10439 / 30:10752 / 30:11336. The Category card sits 6 px lower than the list would.
        el.innerHTML = '<div class="gs-empty"' + (list === 'category' ? ' style="margin-top:6px"' : '') +
          '><p>No transaction at the moment</p></div>';
        return;
      }
      el.innerHTML = LISTS[list].map(function (key, i) { return txHtml(key, i, list); }).join('');
    });
    fitPage();
  }

  // The page scrolls under the tab bar when the list is longer than the frame.
  function fitPage() {
    var pane = $('.gs-pane[data-pane="' + g.view + '"]');
    var sec = pane.querySelector('.gs-tx-sec');
    spendPage.style.height = Math.max(729, sec.offsetTop + sec.offsetHeight + 8) + 'px';
  }

  function showView(v) {
    g.view = v;
    views.forEach(function (b) {
      var on = b.dataset.view === v;
      b.classList.toggle('is-on', on);
      b.setAttribute('aria-selected', String(on));
    });
    panes.forEach(function (p) { p.hidden = p.dataset.pane !== v; });
    spendScroll.scrollTop = 0;
    fitPage();
  }
  views.forEach(function (b) {
    b.addEventListener('click', function () { if (b.dataset.view !== g.view) showView(b.dataset.view); });
  });

  spendPage.addEventListener('click', function (e) {
    var r = e.target.closest('.gs-r');
    if (!r) return;
    var rs = reactsOf(r.dataset.key);
    rs[r.dataset.r] = !rs[r.dataset.r];
    var top = spendScroll.scrollTop;
    renderLists();
    spendScroll.scrollTop = top;
  });

  /* Sideways rows. Touch and trackpads scroll them natively; with a mouse they're dragged. The Budgeting View
     cards move one card per swipe; the Category row scrolls freely. */
  var budgetRow = $('.gs-budgets');
  var catRow = $('.gs-cats');

  function cardStops(row) {
    var max = row.scrollWidth - row.clientWidth;
    return $$('.gs-budget', row).map(function (c) { return Math.min(max, Math.max(0, c.offsetLeft - 20)); });
  }
  function nearest(stops, x) {
    var best = 0;
    stops.forEach(function (s, i) { if (Math.abs(s - x) < Math.abs(stops[best] - x)) best = i; });
    return best;
  }
  // After a drag: on to the next card in the swipe's direction, or back if the drag was short.
  function settle(row, x0, dx) {
    var stops = cardStops(row);
    var i = nearest(stops, x0);
    if (dx < -40) i = Math.min(stops.length - 1, i + 1);
    else if (dx > 40) i = Math.max(0, i - 1);
    else i = nearest(stops, row.scrollLeft);
    var done = false;
    function finish() {
      if (done) return;
      done = true;
      row.removeEventListener('scrollend', finish);
      row.classList.remove('is-dragging');   // snapping back on, already at a card
    }
    row.addEventListener('scrollend', finish);
    setTimeout(finish, 700);
    row.scrollTo({ left: stops[i], behavior: 'smooth' });
    if (Math.abs(row.scrollLeft - stops[i]) < 1) finish();
  }
  function dragRow(row, snap) {
    var d = null;
    row.addEventListener('pointerdown', function (e) {
      if (e.pointerType !== 'mouse' || e.button !== 0) return;
      d = { id: e.pointerId, x0: e.clientX, l0: row.scrollLeft };
      try { row.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      row.classList.add('is-dragging');
      e.preventDefault();
    });
    row.addEventListener('pointermove', function (e) {
      if (!d || e.pointerId !== d.id) return;
      row.scrollLeft = d.l0 - (e.clientX - d.x0) / P.scale();
    });
    function end(e) {
      if (!d || e.pointerId !== d.id) return;
      var dx = (e.clientX - d.x0) / P.scale();
      var l0 = d.l0;
      d = null;
      if (snap) settle(row, l0, dx);
      else row.classList.remove('is-dragging');
    }
    row.addEventListener('pointerup', end);
    row.addEventListener('pointercancel', end);
  }
  dragRow(budgetRow, true);
  dragRow(catRow, false);

  /* Category emoji. A text emoji is placed by the browser's font metrics, and Safari puts these off-centre in
     their circles. So each one is drawn into a canvas, cropped to its visible pixels and centred as an image;
     that looks the same in every browser. */
  function pixelEmoji(el) {
    var text = el.textContent;
    var cs = getComputedStyle(el);
    var size = parseFloat(cs.fontSize);
    var k = 4;                                     // drawn at 4x so it stays sharp when the device scales up
    var box = Math.ceil(size * 2.5 * k);
    var c = document.createElement('canvas');
    c.width = c.height = box;
    var g = c.getContext('2d');
    g.font = (size * k) + 'px ' + cs.fontFamily;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(text, box / 2, box / 2);
    var px = g.getImageData(0, 0, box, box).data;
    var x0 = box, y0 = box, x1 = -1, y1 = -1;
    for (var y = 0; y < box; y++) {
      for (var x = 0; x < box; x++) {
        if (px[(y * box + x) * 4 + 3] > 8) {
          if (x < x0) x0 = x;
          if (x > x1) x1 = x;
          if (y < y0) y0 = y;
          if (y > y1) y1 = y;
        }
      }
    }
    if (x1 < 0) return;                            // nothing drawn (no emoji font): keep the text emoji
    var w = x1 - x0 + 1;
    var h = y1 - y0 + 1;
    var out = document.createElement('canvas');
    out.width = w;
    out.height = h;
    out.getContext('2d').drawImage(c, x0, y0, w, h, 0, 0, w, h);
    out.className = 'gs-cat-glyph';
    out.style.width = (w / k) + 'px';
    out.style.height = (h / k) + 'px';
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', text);
    el.textContent = '';
    el.appendChild(out);
  }
  $$('.gs-cat-emoji').forEach(pixelEmoji);

  /* By dates: dropdown and date picker */
  function sameDay(a, b) { return a && b && a.y === b.y && a.m === b.m && a.d === b.d; }
  function dateLabel() {
    if (g.calOpen) return 'Select the date';
    if (!g.picked || sameDay(g.picked, TODAY)) return 'Today';
    return g.picked.d + ' ' + MONTHS[g.picked.m] + ' ' + g.picked.y;
  }
  function renderCal() {
    $('#guardianCalMonth').textContent = MONTHS[g.cal.m] + ' ' + g.cal.y;
    var first = new Date(g.cal.y, g.cal.m, 1).getDay();
    var days = new Date(g.cal.y, g.cal.m + 1, 0).getDate();
    var html = '';
    for (var cell = 0; cell < first + days; cell += 7) {
      html += '<div class="gs-cal-row">';
      for (var k = 0; k < 7; k++) {
        var d = cell + k - first + 1;
        if (d < 1 || d > days) { html += '<span></span>'; continue; }
        var day = { y: g.cal.y, m: g.cal.m, d: d };
        var cls = (sameDay(day, TODAY) ? ' is-today' : '') + (sameDay(day, g.picked) ? ' is-picked' : '');
        html += '<button type="button" class="' + cls.trim() + '" data-day="' + d + '" aria-pressed="' +
          sameDay(day, g.picked) + '">' + d + '</button>';
      }
      html += '</div>';
    }
    $('#guardianCalWeeks').innerHTML = html;
  }
  function syncDates() {
    dateBtn.setAttribute('aria-expanded', String(g.calOpen));
    cal.hidden = !g.calOpen;
    $('#guardianDateLabel').textContent = dateLabel();
    dateTx.style.top = (g.calOpen ? 607 : 298) + 'px';   // 30:11031 / 30:10841
    if (g.calOpen) renderCal();
    fitPage();
  }
  dateBtn.addEventListener('click', function () { g.calOpen = !g.calOpen; syncDates(); });
  cal.addEventListener('click', function (e) {
    var nav = e.target.closest('[data-cal]');
    if (nav) {
      var m = g.cal.m + Number(nav.dataset.cal);
      g.cal = { y: g.cal.y + Math.floor(m / 12), m: (m + 12) % 12 };
      renderCal();
      return;
    }
    var b = e.target.closest('[data-day]');
    if (b) {
      g.picked = { y: g.cal.y, m: g.cal.m, d: Number(b.dataset.day) };
      renderCal();
    }
  });

  /* Shared transactions arrive, then Mom's reactions (only while the Spending page is open) */
  var timers = [];
  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function momReacts() {
    g.momReacted = true;
    Object.keys(MOM_REACTS).forEach(function (key) {
      var rs = reactsOf(key);
      Object.keys(MOM_REACTS[key]).forEach(function (r) { rs[r] = true; });
    });
  }
  function scheduleArrivals() {
    var at = 0;
    if (!g.hasTx) {
      at = TX_MS;
      timers.push(setTimeout(function () { g.hasTx = true; renderLists(); }, at));
    }
    if (!g.momReacted) {
      timers.push(setTimeout(function () {
        var top = spendScroll.scrollTop;
        momReacts();
        renderLists();
        spendScroll.scrollTop = top;
      }, at + REACT_MS));
    }
  }

  /* ---------- Enter / reset ---------- */
  P.onEnter(function (id) {
    clearTimers();
    if (id === 'guardian-who') syncPeople();
    if (id === 'guardian-sent') {
      timers.push(setTimeout(function () { if (P.current() === 'guardian-sent') P.replace('guardian-yes'); }, SENT_MS));
    }
    if (id === 'guardian-confirm') renderSummary();
    if (id === 'guardian-spending') {
      renderLists();
      syncDates();
      showView(g.view);
      scheduleArrivals();
    }
  });

  // Panel shortcuts to the later Spending states
  function demo(view, open) {
    g.hasTx = true;
    if (!g.momReacted) momReacts();
    g.view = view;
    g.calOpen = !!open;
    if (open) { g.cal = { y: TODAY.y, m: TODAY.m }; g.picked = { y: 2026, m: 7, d: 13 }; }   // 30:11031
    P.jump('guardian-spending');
  }
  P.action('guardian-demo-spending', function () { demo('spending'); });
  P.action('guardian-demo-category', function () { demo('category'); });
  P.action('guardian-demo-dates', function () { demo('dates', true); });

  P.onReset(function () {
    clearTimers();
    g = fresh();
    applyPerson();
    syncPeople();
    syncChips();
    renderSummary();
    $('#guardianInsightScroll').scrollTop = 0;
    budgetRow.scrollLeft = 0;
    catRow.scrollLeft = 0;
    renderLists();
    syncDates();
    showView('spending');
  });
})();
