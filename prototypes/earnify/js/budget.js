/* "Budgeting" — Figma section 24:4493.
   Builds on the shared navigation/state in js/app.js (window.proto). */
(function () {
  'use strict';

  var P = window.proto;
  var KB = window.protoKeyboard;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  // Same pinned "today" as the goal flow: the budgeting calendar (24:5504) also circles Wednesday 5 August 2026.
  var TODAY = (window.goalProto && window.goalProto.today) || new Date(2026, 7, 5);
  var ADVANCE_DELAY = 280;   // tap → selected state → next step

  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  var WDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  var CYCLES = { '1st': '1st day of the month', '15th': '15th day of the month', last: 'Last day of the month' };

  // Budget cards in 24:5902. The first two are demo data; the third is the new budget ("Traveling" as drawn).
  var DEMO = [
    { name: 'My Transport', icon: '🚌', color: '#ffd864', monthly: 40, weekly: 10 },
    { name: 'Education', icon: '📖', color: '#04c0d1', monthly: 40, weekly: 10 }
  ];
  var FIGMA_NEW = { name: 'Traveling', icon: '✈️', color: '#ffaef0', monthly: 40, weekly: 10 };
  // What Confirm (24:6029) shows for anything missing when it's opened from the panel.
  var FIGMA_CONFIRM = { name: 'Travel', amount: 200, repeated: true, cycle: '1st', start: new Date(2026, 0, 1) };

  function freshDraft() {
    return { name: '', icon: null, cycle: null, date: null, amount: null, repeated: false };
  }
  function st() { return P.getState(); }
  function draft() {
    var s = st();
    if (!s.budgetDraft) s.budgetDraft = freshDraft();
    return s.budgetDraft;
  }

  /* ---------- Formatting ---------- */
  function ordinal(n) {
    var s = n % 100 >= 11 && n % 100 <= 13 ? 'th' : ({ 1: 'st', 2: 'nd', 3: 'rd' }[n % 10] || 'th');
    return n + s;
  }
  function money(n) { return Math.abs(n - Math.round(n)) < 0.005 ? String(Math.round(n)) : n.toFixed(2); }
  function weekly(amount) { return amount / 4; }   // £200 a month → £50 a week (24:5383)
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function sameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
  function selectOnly(list, el) { list.forEach(function (b) { b.classList.toggle('is-selected', b === el); }); }

  function cycleSet(d) { return d.cycle === 'date' ? !!d.date : !!d.cycle; }
  function endLabel(d) { return d.cycle === 'date' ? ordinal(d.date.getDate()) + ' day of the month' : CYCLES[d.cycle]; }
  // A preset cycle starts the budgeting month that contains today; "Set by date" starts on the picked day.
  function startDate(d) {
    if (d.cycle === 'date') return d.date;
    function on(y, m) {
      if (d.cycle === '1st') return new Date(y, m, 1);
      if (d.cycle === '15th') return new Date(y, m, 15);
      return new Date(y, m + 1, 0);
    }
    var s = on(TODAY.getFullYear(), TODAY.getMonth());
    return s > TODAY ? on(TODAY.getFullYear(), TODAY.getMonth() - 1) : s;
  }

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

  /* ---------- B1 · What is your budgeting about? ---------- */
  var nameInput = $('#budgetName');
  var nameNext = $('#budgetNameNext');
  var chips = $$('[data-bname]');
  // Next is off (as in 9:2113) until there's a name, then on (9:2214).
  function syncNameNext() { nameNext.disabled = !draft().name; }
  chips.forEach(function (b) {
    b.addEventListener('click', function () {
      if (advancing) return;
      selectOnly(chips, b);
      draft().name = b.dataset.bname;
      draft().icon = $('.g-chip-emoji', b).textContent;
      syncNameNext();
      advance('budget-setup');
    });
  });
  nameInput.addEventListener('input', function () {
    selectOnly(chips, null);
    draft().name = nameInput.value.trim();
    draft().icon = null;
    syncNameNext();
  });
  // Return only puts the keyboard away; Next moves on.
  nameInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') nameInput.blur();
  });
  KB.bind(nameInput, 'letters', function () { nameInput.blur(); });

  /* ---------- B2 · Cycle and monthly limit ---------- */
  var page = $('#budgetPage');
  var cycleEl = $('#budgetCycle');
  var box = $('.b-dd-box', cycleEl);
  var boxText = $('.b-dd-text', cycleEl);
  var chev = $('.b-dd-chev', cycleEl);
  var panel = $('.b-dd-panel', cycleEl);
  var opts = $$('.b-dd-opt', cycleEl);
  var when = $('#budgetWhen');
  var amountGroup = $('#budgetAmountGroup');
  var amountInput = $('#budgetAmount');
  var amountCard = $('#budgetAmountCard');
  var amountAlt = $('#budgetAmountAlt');
  var guide = $('#budgetGuide');
  var repeatRow = $('#budgetRepeat');
  var repeatSwitch = $('#budgetRepeatSwitch');
  var next = $('#budgetNext');

  var listOpen = false;
  var monthsOpen = false;
  var amountFocused = false;
  var view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);   // calendar month on show

  function renderSetup() {
    var d = draft();
    var dateMode = d.cycle === 'date';
    var label = d.cycle && !dateMode ? CYCLES[d.cycle] : '';
    // "Set by date" keeps the field drawn open with its placeholder while the calendar shows (24:5504 → 24:5605).
    cycleEl.classList.toggle('is-open', listOpen || dateMode);
    box.setAttribute('aria-expanded', String(listOpen));
    chev.src = listOpen || dateMode ? 'assets/img/icon-dropdown-up.svg' : 'assets/img/icon-dropdown-down.svg';
    boxText.classList.toggle('is-placeholder', !label);
    boxText.firstElementChild.textContent = label || 'Select the duration';
    panel.hidden = !listOpen;
    opts.forEach(function (o) { o.classList.toggle('is-selected', o.dataset.cycle === d.cycle); });

    when.hidden = !dateMode;
    when.classList.toggle('is-covered', listOpen);   // the list opens over the calendar
    $('#budgetCal').hidden = monthsOpen;
    $('#budgetMonths').hidden = !monthsOpen;
    page.classList.toggle('is-date', dateMode);
    page.classList.toggle('has-date', dateMode && !!d.date);

    // The limit field: grey "I can only use up to" (24:5383), or the white card under the calendar (24:5605).
    amountGroup.hidden = dateMode;
    amountCard.hidden = !(dateMode && d.date);
    // The weekly guide and the repeat switch appear once the amount is entered and the keyboard is put away
    // (24:5353 typing → 24:5383).
    var showGuide = d.amount > 0 && !amountFocused && (!dateMode || !!d.date);
    guide.hidden = !showGuide;
    repeatRow.hidden = !showGuide;
    if (d.amount) $('#budgetGuideValue').textContent = '£ ' + money(weekly(d.amount));
    repeatSwitch.setAttribute('aria-checked', String(!!d.repeated));
    next.disabled = !(cycleSet(d) && d.amount > 0);
  }

  function setList(open) {
    listOpen = open;
    if (open && document.activeElement && document.activeElement.blur) document.activeElement.blur();
    renderSetup();
  }
  box.addEventListener('click', function () { setList(!listOpen); });
  box.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setList(!listOpen); }
    if (e.key === 'Escape') setList(false);
  });
  // A tap anywhere else closes the list without changing the choice.
  document.addEventListener('click', function (e) {
    if (listOpen && !box.contains(e.target) && !panel.contains(e.target)) setList(false);
  });
  opts.forEach(function (o) {
    o.addEventListener('click', function () {
      var d = draft();
      var cycle = o.dataset.cycle;
      if (cycle !== d.cycle) {
        d.cycle = cycle;
        d.date = null;
        monthsOpen = false;
        view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
        renderCal();
      }
      setList(false);
    });
  });

  /* Calendar (24:5504 without a date; 24:5605 with the date header) */
  var calEl = $('#budgetCal');
  calEl.innerHTML =
    '<p class="g-cal-head" hidden></p>' +
    '<div class="g-cal-body">' +
      '<div class="g-cal-month">' +
        '<button class="g-cal-mlabel" type="button" aria-label="Choose a month"><span></span><span class="g-cal-caret"><img src="assets/img/cal-month-caret-ink.svg" alt=""></span></button>' +
        '<div class="g-cal-nav"><img src="assets/img/cal-nav-arrows-ink.svg" alt="">' +
          '<button class="g-cal-prev" type="button" aria-label="Previous month"></button>' +
          '<button class="g-cal-next" type="button" aria-label="Next month"></button></div>' +
      '</div>' +
      '<div class="g-cal-grid">' +
        '<div class="g-cal-row">' + ['S', 'M', 'T', 'W', 'T', 'F', 'S'].map(function (l) { return '<span class="g-cal-cell">' + l + '</span>'; }).join('') + '</div>' +
        '<div class="g-cal-weeks"></div>' +
      '</div>' +
    '</div>';
  var calHead = $('.g-cal-head', calEl);
  var calLabel = $('.g-cal-mlabel span', calEl);
  var calCaret = $('.g-cal-caret img', calEl);
  var calNav = $('.g-cal-nav img', calEl);
  var calWeeks = $('.g-cal-weeks', calEl);

  function renderCal() {
    var d = draft();
    var picked = d.cycle === 'date' ? d.date : null;
    calEl.classList.toggle('has-head', !!picked);
    calHead.hidden = !picked;
    calHead.textContent = picked ? WDAY[picked.getDay()] + ', ' + picked.getDate() + ' ' + MON[picked.getMonth()] : '';   // "Mon, 17 Jan"
    // The two Figma calendar states use slightly different ink: #191919 without the header, black with it.
    calCaret.src = picked ? 'assets/img/cal-month-caret-grey.svg' : 'assets/img/cal-month-caret-ink.svg';
    calNav.src = picked ? 'assets/img/cal-nav-arrows.svg' : 'assets/img/cal-nav-arrows-ink.svg';
    calLabel.textContent = MONTH[view.getMonth()] + ' ' + view.getFullYear();
    var first = new Date(view.getFullYear(), view.getMonth(), 1).getDay();
    var count = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
    var html = '';
    for (var r = 0; r < 6; r++) {
      html += '<div class="g-cal-row">';
      for (var c = 0; c < 7; c++) {
        var day = r * 7 + c - first + 1;
        if (day < 1 || day > count) { html += '<span class="g-cal-cell"></span>'; continue; }
        var date = new Date(view.getFullYear(), view.getMonth(), day);
        var cls = 'g-cal-cell' + (sameDay(date, TODAY) ? ' is-today' : '') + (sameDay(date, picked) ? ' is-selected' : '');
        html += '<button class="' + cls + '" type="button" data-day="' + day + '">' + day + '</button>';
      }
      html += '</div>';
    }
    calWeeks.innerHTML = html;
  }
  // Any day can be picked: it sets the day the budgeting month starts and ends on.
  calWeeks.addEventListener('click', function (e) {
    var b = e.target.closest('[data-day]');
    if (!b) return;
    draft().date = new Date(view.getFullYear(), view.getMonth(), parseInt(b.dataset.day, 10));
    renderCal();
    renderSetup();
  });
  $('.g-cal-prev', calEl).addEventListener('click', function () {
    view = new Date(view.getFullYear(), view.getMonth() - 1, 1);
    renderCal();
  });
  $('.g-cal-next', calEl).addEventListener('click', function () {
    view = new Date(view.getFullYear(), view.getMonth() + 1, 1);
    renderCal();
  });

  /* Month picker: tap "August 2026 ▾" (24:5530) → pick a month (24:5555) → that month's days (24:5580) */
  var monthsEl = $('#budgetMonths');
  var pickYear = view.getFullYear();
  var picking = false;
  var rows = '';
  for (var mr = 0; mr < 4; mr++) {
    rows += '<div class="b-mp-row">';
    for (var mc = 0; mc < 3; mc++) rows += '<button class="b-mp-slot" type="button" data-month="' + (mr * 3 + mc) + '">' + MON[mr * 3 + mc] + '</button>';
    rows += '</div>';
  }
  monthsEl.innerHTML =
    '<div class="b-mp-head">' +
      '<button class="b-mp-prev" type="button" aria-label="Previous year"><img src="assets/img/icon-angle-left.svg" alt=""></button>' +
      '<p class="b-mp-year"></p>' +
      '<button class="b-mp-next" type="button" aria-label="Next year"><img src="assets/img/icon-angle-right.svg" alt=""></button>' +
    '</div>' +
    '<div class="b-mp-grid">' + rows + '</div>';
  var slots = $$('.b-mp-slot', monthsEl);

  function renderMonths() { $('.b-mp-year', monthsEl).textContent = pickYear; }
  $('.g-cal-mlabel', calEl).addEventListener('click', function () {
    pickYear = view.getFullYear();
    picking = false;
    selectOnly(slots, null);   // 24:5530: nothing highlighted yet
    renderMonths();
    monthsOpen = true;
    renderSetup();
  });
  $('.b-mp-prev', monthsEl).addEventListener('click', function () { pickYear--; renderMonths(); });
  $('.b-mp-next', monthsEl).addEventListener('click', function () { pickYear++; renderMonths(); });
  slots.forEach(function (b) {
    b.addEventListener('click', function () {
      if (picking) return;
      picking = true;
      selectOnly(slots, b);
      setTimeout(function () {
        picking = false;
        if (!monthsOpen) return;
        view = new Date(pickYear, parseInt(b.dataset.month, 10), 1);
        monthsOpen = false;
        renderCal();
        renderSetup();
      }, ADVANCE_DELAY);
    });
  });

  /* Amount: whole pounds typed on the Figma number pad (24:5322 → 24:5353); shown as "£ 200" */
  var measure = document.createElement('span');
  measure.className = 'b-box-measure';
  measure.setAttribute('aria-hidden', 'true');
  amountAlt.parentNode.appendChild(measure);
  function fitAlt() {
    // The white card's "£ 50" box is 80 px wide in Figma; longer amounts widen it so "monthly" moves along.
    measure.textContent = amountAlt.value || amountAlt.placeholder;
    amountAlt.style.width = Math.max(80, Math.ceil(measure.getBoundingClientRect().width / P.scale()) + 2) + 'px';
  }
  function showAmount(input, focused) {
    var a = draft().amount;
    input.value = focused ? '£ ' + (a || '') : (a ? '£ ' + a : '');
    if (input === amountAlt) fitAlt();
  }
  [amountInput, amountAlt].forEach(function (input) {
    input.addEventListener('focus', function () {
      amountFocused = true;
      showAmount(input, true);
      renderSetup();
    });
    input.addEventListener('input', function () {
      var raw = input.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 6);
      input.value = '£ ' + raw;
      if (input === amountAlt) fitAlt();
      draft().amount = raw ? parseInt(raw, 10) : null;
      renderSetup();
    });
    input.addEventListener('blur', function () {
      amountFocused = false;
      showAmount(amountInput, false);
      showAmount(amountAlt, false);
      renderSetup();
    });
    input.addEventListener('keydown', function (e) { if (e.key === 'Enter') input.blur(); });
    KB.bind(input, 'phone');
  });

  repeatSwitch.addEventListener('click', function () {
    draft().repeated = !draft().repeated;
    renderSetup();
  });

  function resetSetup() {
    listOpen = false;
    monthsOpen = false;
    amountFocused = false;
    view = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
    showAmount(amountInput, false);
    showAmount(amountAlt, false);
    $('#budgetSetupScroll').scrollTop = 0;
    renderCal();
    renderSetup();
  }

  /* ---------- B3 · Confirm ---------- */
  // Opened from the panel before the form is finished, Confirm fills the gaps with the 24:6029 values.
  // They are display-only: the form is never pre-filled.
  function confirmDraft() {
    var d = draft();
    var done = cycleSet(d) && d.amount > 0;
    return {
      name: d.name || FIGMA_CONFIRM.name,
      icon: d.icon,
      amount: d.amount || FIGMA_CONFIRM.amount,
      repeated: done ? d.repeated : FIGMA_CONFIRM.repeated,
      start: cycleSet(d) ? startDate(d) : FIGMA_CONFIRM.start,
      end: cycleSet(d) ? endLabel(d) : CYCLES[FIGMA_CONFIRM.cycle]
    };
  }
  function renderConfirm() {
    var c = confirmDraft();
    $('#budgetConfirmTitle').textContent = 'Please confirm your  ' + c.name + ' budgeting';   // double space as drawn
    $('#budgetConfirmAmount').textContent = '£ ' + money(c.amount);
    $('#budgetConfirmWeekly').textContent = '£ ' + money(weekly(c.amount));
    $('#budgetConfirmRepeat').textContent = c.repeated ? 'Repeated' : 'Not repeated';
    $('#budgetConfirmStart').textContent = c.start.getDate() + ' ' + MONTH[c.start.getMonth()] + ', ' + c.start.getFullYear();
    $('#budgetConfirmEnd').textContent = c.end;
  }

  var showNewest = false;
  P.action('budget-confirm', function () {
    if (P.isBusy()) return;
    var c = confirmDraft();
    st().budgets.push({ name: c.name, icon: c.icon || FIGMA_NEW.icon, color: FIGMA_NEW.color, monthly: c.amount, weekly: weekly(c.amount) });
    startBlankBudget();   // the budget is saved, so the form starts empty next time
    showNewest = true;
    P.go('budget-list');
  });

  /* ---------- B4 · Budget tab with budgets ---------- */
  function card(b) {
    return '<div class="b-card">' +
      '<div class="b-card-top">' +
        '<span class="b-card-ico" style="background:' + b.color + '">' + esc(b.icon) + '</span>' +
        '<div class="b-card-info">' +
          '<p class="b-card-name">' + esc(b.name) + '</p>' +
          '<div class="b-card-row">' +
            '<p class="b-card-spent">£ 20 spent</p>' +
            '<div class="b-card-limits">' +
              '<p class="b-card-month"><span>1.75 / ' + money(b.monthly) + ' £ </span><span>Monthly</span></p>' +
              '<p class="b-card-week"><span>1.75 / ' + money(b.weekly) + ' £ </span><span>Weekly Suggestion</span></p>' +
            '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      '<div class="b-card-bar"><i style="background:' + b.color + '"></i></div>' +
    '</div>';
  }
  function renderList() {
    var mine = st().budgets.length ? st().budgets : [FIGMA_NEW];
    $('#budgetList').innerHTML = DEMO.concat(mine).map(card).join('');
    var scroller = $('#budgetListScroll');
    scroller.scrollTop = showNewest ? scroller.scrollHeight : 0;
    showNewest = false;
  }

  /* ---------- Entry points ---------- */
  function startBlankBudget() {
    st().budgetDraft = freshDraft();
    selectOnly(chips, null);
    nameInput.value = '';
    syncNameNext();
    resetSetup();
  }
  // "Create new budgeting" (24:5838), "Create New Budget" (24:5902) and the panel's name step start a blank budget.
  P.action('budget-new', function (el) {
    startBlankBudget();
    if (el && el.closest('#panelSteps')) P.jump('budget-name');
    else P.go('budget-name');
  });
  // Tab bar: Home's "Budget" tab and the budget screens' "Home" tab switch without a slide, as iOS tabs do.
  P.action('tab-budget', function () {
    if (!P.isBusy()) P.jump(st().budgets.length ? 'budget-list' : 'budget');
  });
  P.action('tab-home', function () {
    if (!P.isBusy()) P.jump(st().goal ? 'home-goal' : 'home');
  });

  P.onEnter(function (id) {
    if (id !== 'budget-setup') listOpen = false;
    if (id === 'budget-setup') renderSetup();
    if (id === 'budget-confirm') renderConfirm();
    if (id === 'budget-list') renderList();
  });
  P.onReset(function () {
    st().budgets = [];
    startBlankBudget();
  });

  window.budgetProto = { draft: draft, confirmDraft: confirmDraft, startDate: startDate };
})();
