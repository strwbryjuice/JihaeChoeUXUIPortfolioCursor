/* "Setting own goal with own time frame" — Figma section 9:521.
   Builds on the shared navigation/state in js/app.js (window.proto). */
(function () {
  'use strict';

  var P = window.proto;
  var KB = window.protoKeyboard;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // The Figma calendars are drawn on Wednesday 5 August 2026 (the circled "today").
  // Pinning "today" keeps every calendar, summary and confirm screen identical to the frames.
  var TODAY = new Date(2026, 7, 5);
  var ADVANCE_DELAY = 280;   // tap → selected state → next screen (unselected/selected frame pairs)

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var SPELLED = { 1: 'One month', 3: 'Three months', 6: 'Six months', 12: 'One year' };
  var DEFAULT_NAME = 'Nintendo';   // the goal name used throughout the Figma Home and Penny frames

  function freshDraft() {
    return { category: null, name: '', method: null, amount: null, months: null, durationLabel: '', freq: null, startMode: null, start: null };
  }
  function st() { return P.getState(); }
  function draft() {
    var s = st();
    if (!s.goalDraft) s.goalDraft = freshDraft();
    return s.goalDraft;
  }

  /* ---------- Dates & money ---------- */
  function addMonths(date, n) {
    var y = date.getFullYear();
    var m = date.getMonth() + n;
    var last = new Date(y, m + 1, 0).getDate();
    return new Date(y, m, Math.min(date.getDate(), last));
  }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function daysBetween(a, b) { return Math.round((b - a) / 86400000); }
  function ordinal(n) {
    var s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return n + s;
  }
  var fmt = {
    headTarget: function (d) { return WDAY[d.getDay()] + ', ' + d.getDate() + ' ' + MON[d.getMonth()]; },          // "Mon, 17 Aug"
    headRegular: function (d) { return WDAY[d.getDay()] + ', ' + ordinal(d.getDate()) + ' ' + MON[d.getMonth()]; }, // "Tue, 18th Aug"
    sumTarget: function (d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' ,' + d.getFullYear(); },             // "18 Aug ,2027"
    sumRegular: function (d) { return d.getDate() + ' ' + MON[d.getMonth()] + ' , ' + d.getFullYear(); },           // "18 Aug , 2027"
    long: function (d) { return ordinal(d.getDate()) + ' ' + MONTH[d.getMonth()] + ', ' + d.getFullYear(); }       // "18th August, 2026"
  };
  function money(n) { return Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2); }
  function perLabel(n) { return n >= 1 ? String(Math.round(n)) : n.toFixed(2); }
  function parseAmount(text) {
    var v = parseFloat(String(text).replace(/[^0-9.]/g, ''));
    return isFinite(v) && v > 0 ? v : null;
  }

  // Number of saving periods between start and end (approximate until a start date is picked).
  function periods(freq, months, start) {
    var days = start ? daysBetween(start, addMonths(start, months)) : Math.round(months * 365 / 12);
    if (freq === 'daily') return Math.max(1, days);
    if (freq === 'weekly') return Math.max(1, Math.floor(days / 7));
    return months;
  }

  // Everything the summary, confirm and Home screens show, derived from the draft.
  function plan(d) {
    d = d || draft();
    var out = { end: d.start && d.months ? addMonths(d.start, d.months) : null };
    if (!d.amount || !d.months || !d.freq) return out;
    var n = periods(d.freq, d.months, d.start);
    if (d.method === 'regular') {
      out.per = d.amount;
      out.total = d.amount * n;
    } else {
      out.total = d.amount;
      out.per = d.amount / n;
      var pence = Math.floor(out.per * 100) / 100;              // every saving but the last
      out.last = Math.round((d.amount - pence * (n - 1)) * 100) / 100;
      out.uneven = Math.abs(out.last - pence) >= 0.01;
    }
    return out;
  }

  /* ---------- Shared bits ---------- */
  function selectOnly(list, el) { list.forEach(function (b) { b.classList.toggle('is-selected', b === el); }); }

  var advancing = false;
  function advance(to) {
    if (advancing) return;
    advancing = true;
    var from = P.current();
    setTimeout(function step() {
      if (P.isBusy()) { setTimeout(step, 40); return; }   // tapped while the screen was still sliding in
      advancing = false;
      if (P.current() === from) P.go(to);                 // skip if the user went back meanwhile
    }, ADVANCE_DELAY);
  }

  // Amount inputs show "£ 5000.00" like the Figma once you leave the field.
  function bindAmount(input, onChange) {
    input.addEventListener('focus', function () {
      var v = parseAmount(input.value);
      input.value = v ? '£ ' + money(v) : '';
    });
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1');
      input.value = raw ? '£ ' + raw : '';
      onChange(parseAmount(raw));
    });
    input.addEventListener('blur', function () {
      var v = parseAmount(input.value);
      input.value = v ? '£ ' + v.toFixed(2) : '';
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
  }

  /* ---------- Duration dropdown ---------- */
  function Dropdown(root, onPick) {
    var box = $('.g-dd-box', root);
    var text = $('.g-dd-text', root);
    var chev = $('.g-dd-chev', root);
    var panel = $('.g-dd-panel', root);
    var custom = $('.g-dd-input', root);
    var opts = $$('.g-dd-opt', root);
    var api = {};

    function setOpen(open) {
      root.classList.toggle('is-open', open);
      panel.hidden = !open;
      box.setAttribute('aria-expanded', String(open));
      chev.src = open ? 'assets/img/icon-dropdown-up.svg' : 'assets/img/icon-dropdown-down.svg';
    }
    api.close = function () { setOpen(false); };
    api.reset = function () {
      setOpen(false);
      root.classList.remove('is-filled');
      text.hidden = false;
      text.textContent = 'Select the duration';
      text.classList.add('is-placeholder');
      if (custom) { custom.hidden = true; custom.value = ''; }
      opts.forEach(function (o) { o.classList.remove('is-selected'); });
    };
    api.show = function (label) {
      root.classList.add('is-filled');
      text.hidden = false;
      text.textContent = label;
      text.classList.remove('is-placeholder');
      if (custom) custom.hidden = true;
    };
    api.select = function (months) {
      var match = opts.filter(function (o) { return parseInt(o.dataset.months, 10) === months; })[0];
      if (match) { selectOnly(opts, match); api.show(match.textContent); return; }
      if (custom && months) {
        selectOnly(opts, opts.filter(function (o) { return o.dataset.custom === 'type'; })[0]);
        root.classList.add('is-filled');
        text.hidden = true;
        custom.hidden = false;
        custom.value = String(months);
      }
    };

    box.addEventListener('click', function (e) {
      if (e.target === custom) return;
      setOpen(!root.classList.contains('is-open'));
    });
    box.addEventListener('keydown', function (e) {
      if (e.target === custom) return;
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setOpen(!root.classList.contains('is-open')); }
      if (e.key === 'Escape') setOpen(false);
    });
    opts.forEach(function (o) {
      o.addEventListener('click', function () {
        if (o.dataset.custom === 'date') {
          // "Set by date" has no follow-up screen in the Figma file.
          setOpen(false);
          return;
        }
        selectOnly(opts, o);
        setOpen(false);
        if (o.dataset.custom === 'type') {
          // "Type how many months": the field becomes a number input (same field style).
          root.classList.add('is-filled');
          text.hidden = true;
          custom.hidden = false;
          custom.focus();
          onPick(parseInt(custom.value, 10) || null, custom.value ? custom.value + ' month' : '');
          return;
        }
        api.show(o.textContent);
        onPick(parseInt(o.dataset.months, 10), o.textContent);
      });
    });
    if (custom) {
      custom.addEventListener('input', function () {
        custom.value = custom.value.replace(/[^0-9]/g, '').slice(0, 3);
        var n = parseInt(custom.value, 10);
        onPick(n > 0 ? n : null, n > 0 ? n + ' month' : '');
      });
      custom.addEventListener('keydown', function (e) { if (e.key === 'Enter') custom.blur(); });
    }
    return api;
  }

  /* ---------- Calendar ---------- */
  function Calendar(root, opts) {
    var view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    var selected = null;
    root.innerHTML =
      '<p class="g-cal-head">Select a start date</p>' +
      '<div class="g-cal-body">' +
        '<div class="g-cal-month">' +
          '<div class="g-cal-mlabel"><span></span><span class="g-cal-caret"><img src="assets/img/cal-month-caret.svg" alt=""></span></div>' +
          '<div class="g-cal-nav"><img src="assets/img/cal-nav-arrows.svg" alt="">' +
            '<button class="g-cal-prev" type="button" aria-label="Previous month"></button>' +
            '<button class="g-cal-next" type="button" aria-label="Next month"></button></div>' +
        '</div>' +
        '<div class="g-cal-grid">' +
          '<div class="g-cal-row">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (l) { return '<span class="g-cal-cell">' + l + '</span>'; }).join('') + '</div>' +
          '<div class="g-cal-weeks"></div>' +
        '</div>' +
      '</div>';
    var head = $('.g-cal-head', root);
    var label = $('.g-cal-mlabel span', root);
    var weeks = $('.g-cal-weeks', root);

    function render() {
      label.textContent = MONTH[view.getMonth()] + ' ' + view.getFullYear();
      head.textContent = selected ? opts.format(selected) : 'Select a start date';
      var first = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
      var count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
      var html = '';
      for (var r = 0; r < 6; r++) {
        html += '<div class="g-cal-row">';
        for (var c = 0; c < 7; c++) {
          var day = r * 7 + c - first + 1;
          if (day < 1 || day > count) { html += '<span class="g-cal-cell"></span>'; continue; }
          var date = new Date(view.getFullYear(), view.getMonth(), day);
          var cls = 'g-cal-cell' + (sameDay(date, TODAY) ? ' is-today' : '') + (sameDay(date, selected) ? ' is-selected' : '');
          html += '<button class="' + cls + '" type="button" data-day="' + day + '">' + day + '</button>';
        }
        html += '</div>';
      }
      weeks.innerHTML = html;
    }
    weeks.addEventListener('click', function (e) {
      var b = e.target.closest('[data-day]');
      if (!b) return;
      var date = new Date(view.getFullYear(), view.getMonth(), parseInt(b.dataset.day, 10));
      if (date < TODAY) return;   // a saving plan can't start in the past
      selected = date;
      render();
      opts.onSelect(date);
    });
    $('.g-cal-prev', root).addEventListener('click', function () {
      var prev = new Date(view.getFullYear(), view.getMonth() - 1, 1);
      if (prev < new Date(TODAY.getFullYear(), TODAY.getMonth(), 1)) return;
      view = prev;
      render();
    });
    $('.g-cal-next', root).addEventListener('click', function () {
      view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
      render();
    });
    render();
    return {
      set: function (date) {
        selected = date;
        if (date) view = new Date(date.getFullYear(), date.getMonth(), 1);
        render();
      }
    };
  }

  /* ---------- G2 · What is your goal about? ---------- */
  var cats = $$('.g-cat');
  cats.forEach(function (b) {
    b.addEventListener('click', function () {
      if (advancing) return;
      selectOnly(cats, b);
      draft().category = b.dataset.cat;
      advance('goal-name');
    });
  });

  /* ---------- G3 · Name the goal ---------- */
  var nameInput = $('#goalName');
  var nameNext = $('#goalNameNext');
  var chips = $$('section[data-screen="goal-name"] .g-chip');
  // Next is off (9:2113) until there's a name, then on (9:2214).
  function syncNameNext() { nameNext.disabled = !draft().name; }
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      if (advancing) return;
      selectOnly(chips, b);
      draft().name = b.dataset.name;
      syncNameNext();
      advance('goal-method');
    });
  });
  nameInput.addEventListener('input', function () {
    selectOnly(chips, null);
    draft().name = nameInput.value.trim();
    syncNameNext();
  });
  // Return only puts the keyboard away; Next moves on.
  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') nameInput.blur();
  });
  KB.bind(nameInput, 'letters', function () { nameInput.blur(); });

  /* ---------- G4 · How do you want to save? ---------- */
  var methods = $$('.g-method');
  methods.forEach(function (b) {
    b.addEventListener('click', function () {
      if (advancing) return;
      selectOnly(methods, b);
      var d = draft();
      if (d.method !== b.dataset.method) {
        // Switching branch starts that branch's form from scratch.
        d.amount = null; d.months = null; d.durationLabel = ''; d.freq = null; d.startMode = null; d.start = null;
        resetTarget();
        resetRegular();
      }
      d.method = b.dataset.method;
      advance(d.method === 'regular' ? 'regular-form' : 'target-form');
    });
  });

  /* ---------- G5a · Save for a target ---------- */
  var tAmount = $('#targetAmount');
  var tPlan = $('#targetPlan');
  var tPlanTitle = $('#targetPlanTitle');
  var tOpts = $$('#targetPlan .g-opt');
  var tStart = $('#targetStart');
  var tSummary = $('#targetSummary');
  var tNext = $('#targetNext');
  var tDuration = Dropdown($('#targetDuration'), function (months, label) {
    var d = draft();
    d.months = months;
    d.durationLabel = label;
    renderTarget();
  });
  var tCal = Calendar($('#targetCal'), {
    format: fmt.headTarget,
    onSelect: function (date) { draft().start = date; renderTarget(); }
  });
  bindAmount(tAmount, function (v) { draft().amount = v; renderTarget(); });
  KB.bind(tAmount, 'decimal');   // number pad slides up
  tOpts.forEach(function (b) {
    b.addEventListener('click', function () {
      selectOnly(tOpts, b);
      draft().freq = b.dataset.freq;
      renderTarget();
    });
  });

  function renderTarget() {
    var d = draft();
    var ready = d.amount && d.months;
    tPlan.hidden = !ready;
    if (ready) {
      tPlanTitle.textContent = 'To save £' + money(d.amount) + ' in ' + d.durationLabel;
      tOpts.forEach(function (b) {
        var f = b.dataset.freq;
        var per = d.amount / periods(f, d.months, d.start);
        b.textContent = f.charAt(0).toUpperCase() + f.slice(1) + ' £' + perLabel(per);
      });
    }
    tStart.hidden = !(ready && d.freq);
    var done = ready && d.freq && d.start;
    tSummary.hidden = !done;
    if (done) {
      var p = plan(d);
      $('#targetSummaryLine').textContent = (SPELLED[d.months] || d.durationLabel) + ' ' + d.freq + ' £' + perLabel(p.per) + ' saving will be end on';
      $('#targetSummaryDate').textContent = fmt.sumTarget(p.end);
    }
    tNext.disabled = !done;
  }
  function resetTarget() {
    tAmount.value = '';
    tDuration.reset();
    selectOnly(tOpts, null);
    tCal.set(null);
    $('section[data-screen="target-form"] .g-scroll').scrollTop = 0;
    renderTarget();
  }

  /* ---------- G5b · Save regularly ---------- */
  var rAmount = $('#regularAmount');
  var rFreq = $$('#regularFreq .g-opt');
  var rNext = $('#regularNext');
  var rDuration = Dropdown($('#regularDuration'), function (months, label) {
    var d = draft();
    d.months = months;
    d.durationLabel = label;
    renderRegular();
  });
  bindAmount(rAmount, function (v) { draft().amount = v; renderRegular(); });
  KB.bind(rAmount, 'decimal');
  KB.bind($('#regularDuration .g-dd-input'), 'number');   // "Type how many months"
  rFreq.forEach(function (b) {
    b.addEventListener('click', function () {
      selectOnly(rFreq, b);
      draft().freq = b.dataset.freq;
      renderRegular();
    });
  });
  function renderRegular() {
    var d = draft();
    rNext.disabled = !(d.amount && d.freq && d.months);
    renderStart();
  }

  /* ---------- G5c · When do you want to start saving? ---------- */
  var startOpts = $$('.g-start-opt');
  var rCalEl = $('#regularCal');
  var rSummary = $('#regularSummary');
  var rStartNext = $('#regularStartNext');
  var rCal = Calendar(rCalEl, {
    format: fmt.headRegular,
    onSelect: function (date) { draft().start = date; renderStart(); }
  });
  startOpts.forEach(function (b) {
    b.addEventListener('click', function () {
      var d = draft();
      selectOnly(startOpts, b);
      d.startMode = b.dataset.start;
      if (d.startMode === 'today') {
        d.start = TODAY;
      } else if (sameDay(d.start, TODAY)) {
        d.start = null;
      }
      rCal.set(d.startMode === 'pick' ? d.start : null);
      renderStart();
    });
  });
  function renderStart() {
    var d = draft();
    rCalEl.hidden = d.startMode !== 'pick';
    rStartNext.hidden = !d.startMode;
    var done = d.startMode && d.start && d.amount && d.freq && d.months;
    rSummary.hidden = !done;
    $('#startPage').classList.toggle('has-summary', !!done);
    if (done) {
      var p = plan(d);
      $('#regularSummaryLine').textContent = 'You will save £ ' + money(p.total) + ' on';
      $('#regularSummaryDate').textContent = fmt.sumRegular(p.end);
    }
    rStartNext.disabled = !done;
  }
  function resetRegular() {
    rAmount.value = '';
    rDuration.reset();
    selectOnly(rFreq, null);
    selectOnly(startOpts, null);
    rCal.set(null);
    $('section[data-screen="regular-form"] .g-scroll').scrollTop = 0;
    $('section[data-screen="regular-start"] .g-scroll').scrollTop = 0;
    renderRegular();
  }

  /* ---------- G6 · Confirm ---------- */
  // Confirm (and "all set") opened straight from the panel or a deep link before the plan is finished
  // show the values the Figma frames show. They are display-only: the forms are never pre-filled.
  function confirmDraft() {
    var d = draft();
    if (d.amount && d.months && d.freq && d.start) return d;
    var regular = d.method === 'regular';
    return {
      method: d.method || 'target',
      name: d.name || DEFAULT_NAME,
      amount: d.amount || (regular ? 10 : 5000),
      months: d.months || 12,
      durationLabel: d.durationLabel || (regular ? '12 month' : '1 year'),
      freq: d.freq || (regular ? 'weekly' : 'daily'),
      startMode: d.startMode || 'pick',
      start: d.start || new Date(2026, 7, 18)
    };
  }
  function renderConfirm() {
    var d = confirmDraft();
    var p = plan(d);
    $('#confirmAmount').textContent = '£ ' + p.total.toFixed(2);
    var perText = d.method === 'regular' ? money(p.per) : perLabel(p.per);
    $('#confirmDuration').textContent = d.durationLabel + ', ' + d.freq + ' £' + perText;
    var showInfo = d.method !== 'regular' && p.uneven;
    $('#confirmInfo').hidden = !showInfo;
    if (showInfo) {
      $('#confirmInfoText').textContent = 'Since it does not split perfectly, your last ' + d.freq +
        ' saving will be slightly different. Which will be £ ' + p.last.toFixed(2);
    }
    $('#confirmStart').textContent = fmt.long(d.start);
    $('#confirmEnd').textContent = fmt.long(p.end);
  }

  function startBlankGoal() {
    st().goalDraft = freshDraft();
    resetGoalUi();
  }
  function commitGoal() {
    var d = confirmDraft();
    var p = plan(d);
    st().goal = { name: d.name || DEFAULT_NAME, months: d.months, total: p.total, per: p.per, freq: d.freq };
    startBlankGoal();   // the plan is saved, so the forms start empty next time
  }
  P.action('goal-confirm', function () {
    if (P.isBusy()) return;
    commitGoal();
    P.go('goal-done');
  });
  // "All set" opened straight from the panel still ends on Home with a goal.
  P.action('goal-start', function () {
    if (P.isBusy()) return;
    if (!st().goal) commitGoal();
    P.go('home-goal');
  });

  /* ---------- G8 · Home with the new goal (9:2373) ---------- */
  // Home before a goal (1:512) is its own screen and always shows "Create goal".
  function renderHome() {
    var g = st().goal;
    if (!g) return;
    $('#homeGoalName').textContent = g.name;
    $('#homeGoalMonths').textContent = '1 / ' + g.months + ' month';
    $('#homeGoalAmount').textContent = '0/ ' + money(g.total) + ' £';
  }
  // Opened from the panel or a deep link before any goal exists: show the Figma goal.
  function demoGoal() {
    if (!st().goal) st().goal = { name: DEFAULT_NAME, months: 12, total: 5000, per: 9, freq: 'daily' };
  }
  // Home's "Create goal" card, the "+ Create Goal" button and the panel's first goal step start a blank goal.
  P.action('new-goal', function (el) {
    startBlankGoal();
    if (el && el.closest('#panelSteps')) P.jump('goal-intro');
    else P.go('goal-intro');
  });
  P.action('home-goal', function () { P.jump('home-goal'); });

  /* ---------- Penny check-in sheet ---------- */
  var sheet = $('#pennySheet');
  var overlay = $('#pennyOverlay');
  var pInput = $('#pennyInput');
  var pField = $('#pennyField');
  var pMsg = $('#pennyMsg');
  var pDouble = $('#pennyDouble');
  var pDelay = $('#pennyDelay');
  var keyboard = $('#iosKeyboard');
  var scenario = 'weekly';
  var pennyTimer = null;

  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // Layout per scenario, read from the frames (sheet coordinates).
  var SCENARIOS = {
    weekly: { kind: 'input', placeholder: 'Tell us your story here', field: 250, keyboard: 334, who: 102, msg: 136,
      text: function () { return 'What was the hardest thing this week to save? \nAnything else you wanted to buy instead of saving? '; } },
    success: { kind: 'input', placeholder: 'Tell us your tip here! Or even brag here!', field: 315, keyboard: 388, who: 104, msg: 138,
      html: function (g) { return 'WOWWWWWW!!!\nYou have been saving for ' + esc(g.name) + ' for 15 consecutive days! <em>I’m so proud of you!</em>\n\nCould you give me tips how to save well like you? '; } },
    missed: { kind: 'options', who: 102, msg: 136,
      text: function (g) { return 'Oh its ok for missing saving occasionally!\nWe can save double for tomorrow or delay our ' + g.name + ' saving plan for a day! '; } },
    many: { kind: 'input', placeholder: 'Tell us your story here', field: 312, keyboard: 377, who: 102, msg: 136,
      text: function () { return 'You are not alone, 80% of the teens in the UK answered that they are having hard time to save. \n\nCan I ask what tempted you or hindered you from saving?'; } }
  };

  function sheetHeight() {
    var s = SCENARIOS[scenario];
    return sheet.classList.contains('has-kb') ? s.keyboard + 293 : 523;
  }
  function setKeyboard(on) {
    var s = SCENARIOS[scenario];
    sheet.classList.toggle('has-kb', !!(on && s.keyboard));
    if (s.keyboard) keyboard.style.top = s.keyboard + 'px';
    sheet.style.height = sheetHeight() + 'px';
  }

  function openCheckin(name) {
    clearTimeout(pennyTimer);
    scenario = SCENARIOS[name] ? name : 'weekly';
    var s = SCENARIOS[scenario];
    var g = st().goal || { name: DEFAULT_NAME, per: 9 };
    sheet.dataset.kind = s.kind;
    sheet.classList.remove('is-celebrating', 'is-done', 'has-kb');
    $('#pennyTitle').textContent = 'Saving for ' + g.name + ' ';
    $('#pennyWho').style.top = s.who + 'px';
    $('#pennyMsgWrap').style.top = s.msg + 'px';
    if (s.html) pMsg.innerHTML = s.html(g);
    else pMsg.textContent = s.text(g);
    if (s.kind === 'input') {
      pField.style.top = s.field + 'px';
      pInput.placeholder = s.placeholder;
      pInput.value = '';
    } else {
      pDouble.textContent = 'Save for double (£' + perLabel((g.per || 9) * 2) + ') for tommrow';
      selectOnly([pDouble, pDelay], null);
    }
    sheet.style.height = '523px';
    overlay.classList.add('is-open');
    sheet.classList.add('is-open');
  }
  function closeCheckin() {
    clearTimeout(pennyTimer);
    if (document.activeElement === pInput) pInput.blur();
    setKeyboard(false);
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-open');
  }

  overlay.addEventListener('click', closeCheckin);
  sheet.addEventListener('click', function (e) {
    var t = e.target.closest('[data-penny]');
    if (!t) return;
    var act = t.dataset.penny;
    if (act === 'close') closeCheckin();
    if (act === 'double' && !sheet.classList.contains('is-done')) {
      // 9:2812 → 9:2889 (selected + sparkles) → 9:2921 (confirmation)
      selectOnly([pDouble, pDelay], pDouble);
      sheet.classList.add('is-celebrating');
      pennyTimer = setTimeout(function () {
        sheet.classList.remove('is-celebrating');
        sheet.classList.add('is-done');
        pMsg.textContent = 'Yessssss, lets save for double tommrow! \nThe important thing is to not give up saving!';
      }, 1100);
    }
    if (act === 'delay' && !sheet.classList.contains('is-done')) {
      // No follow-up frame in Figma: show the selected state, then close.
      selectOnly([pDouble, pDelay], pDelay);
      pennyTimer = setTimeout(closeCheckin, 600);
    }
  });
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheet.classList.contains('is-open')) closeCheckin();
  });

  // Text answer: the iOS keyboard from the Figma frames appears while typing on desktop.
  // On touch devices the phone's own keyboard is used instead.
  pInput.addEventListener('focus', function () { if (KB.enabled) setKeyboard(true); });
  pInput.addEventListener('blur', function () { setKeyboard(false); });
  pInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && pInput.value.trim()) closeCheckin();
  });

  // Clickable keys over the keyboard image (shared with the page keyboards in js/keyboard.js).
  KB.letterKeys(keyboard, function () { return pInput; }, function () {
    if (pInput.value.trim()) closeCheckin();
  });

  Object.keys(SCENARIOS).forEach(function (name) {
    P.action('checkin:' + name, function () {
      if (P.current() !== 'home-goal') P.jump('home-goal');
      openCheckin(name);
    });
  });
  // Tapping the goal card on Home (9:2373) opens Penny's weekly question.
  P.action('checkin', function () { openCheckin('weekly'); });

  /* ---------- Screen hooks ---------- */
  function resetGoalUi() {
    selectOnly(cats, null);
    selectOnly(chips, null);
    selectOnly(methods, null);
    nameInput.value = '';
    syncNameNext();
    resetTarget();
    resetRegular();
  }

  P.onEnter(function (id) {
    if (id !== 'home-goal') closeCheckin();
    if (id === 'home-goal') { demoGoal(); renderHome(); }
    if (id === 'goal-confirm') renderConfirm();
    if (id === 'regular-start') renderStart();
  });
  P.onReset(function () {
    st().goalDraft = freshDraft();
    st().goal = null;
    resetGoalUi();
    closeCheckin();
  });

  window.goalProto = { plan: plan, openCheckin: openCheckin, closeCheckin: closeCheckin, today: TODAY };
})();
