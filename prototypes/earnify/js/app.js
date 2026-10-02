/* Earnify prototype — navigation, state and interactions shared by every flow.
   Flow-specific logic for "setting own goal" lives in js/goal.js. */
(function () {
  'use strict';

  var $ = function (sel) { return document.querySelector(sel); };
  var $$ = function (sel) { return Array.prototype.slice.call(document.querySelectorAll(sel)); };

  // Screen order follows the left-to-right frame order in Figma section 1:1968.
  var ONBOARDING = [
    { id: 'splash', label: 'Welcome' },
    { id: 'email', label: 'Enter your email' },
    { id: 'check-email', label: 'Check your email' },
    { id: 'journey-1', label: 'Journey · Who we are' },
    { id: 'intro-1', label: 'Learning about money' },
    { id: 'intro-2', label: 'Discuss investment plan' },
    { id: 'intro-3', label: 'Set multiple saving goals', branch: '“skip” → step 9' },
    { id: 'intro-4', label: 'Build healthy spending habit', branch: '“skip” → step 9' },
    { id: 'journey-2', label: 'Journey · Set up your account' },
    { id: 'name', label: 'What is your name?' },
    { id: 'birthday', label: 'When is your birthday?' },
    { id: 'journey-3', label: 'Journey · Link your bank' },
    { id: 'link-intro', label: 'Securely link your bank' },
    { id: 'banks', label: 'Link your bank account', branch: 'Bank of America → terms sheet' },
    { id: 'consent', label: 'Bank consent', branch: '“Cancel” → step 14' },
    { id: 'accounts', label: 'Which account?' },
    { id: 'linked', label: 'Booom! Bank linked' },
    { id: 'after-90', label: 'What happens after 90 days?' },
    { id: 'congrats', label: 'Congratulation!' },
    { id: 'home', label: 'Home' }   // Figma 1:512
  ];
  // Figma section 9:521. It starts on Home before a goal (1:512) and ends on Home with the goal (9:2373).
  var GOAL = [
    { id: 'home', label: 'Home (no goal yet)' },
    { id: 'goal-intro', label: 'Let’s set your first goal', action: 'new-goal' },   // starts a blank goal
    { id: 'goal-about', label: 'What is your goal about?' },
    { id: 'goal-name', label: 'Name your goal' },
    { id: 'goal-method', label: 'How do you want to save?', branch: 'two branches ↓' },
    { id: 'target-form', label: 'Save for a target' },
    { id: 'regular-form', label: 'Save regularly' },
    { id: 'regular-start', label: 'When to start saving' },
    { id: 'goal-confirm', label: 'Confirm your saving plan' },
    { id: 'goal-done', label: 'Saving plan all set!' },
    { id: 'home-goal', label: 'Home with the new goal', action: 'home-goal' }
  ];
  var CHECKINS = [
    { label: 'Weekly question', action: 'checkin:weekly' },
    { label: 'Successful (15-day streak)', action: 'checkin:success' },
    { label: 'Missed 2–3 times', action: 'checkin:missed' },
    { label: 'Missed many days', action: 'checkin:many' }
  ];
  // Figma section 24:4493. Home's "Budget" tab opens it; it ends on the Budget tab with the new budget (24:5902).
  var BUDGET = [
    { id: 'budget', label: 'Budget (no budgeting yet)' },
    { id: 'budget-name', label: 'What is your budgeting about?', action: 'budget-new' },   // starts a blank budget
    { id: 'budget-setup', label: 'Monthly cycle & limit', branch: '“Set by date” → calendar' },
    { id: 'budget-confirm', label: 'Please confirm your budgeting' },
    { id: 'budget-list', label: 'Budget with your budgeting' }
  ];
  // Figma section 30:7101. Any "Invest" tab opens it; it ends on the Pocket after investing (30:8644).
  var INVEST = [
    { id: 'invest', label: 'Invest · Pocket (nothing yet)' },
    { id: 'invest-buy', label: 'Buy' },
    { id: 'invest-stock', label: 'Step Agentic' },
    { id: 'invest-cart', label: 'My Cart' },
    { id: 'invest-verify', label: 'Verify your identify' },
    { id: 'invest-scan', label: 'Scan your driver license', branch: 'plays by itself' },
    { id: 'invest-ready', label: 'Ready for a money talk' },
    { id: 'invest-talk', label: 'Let’s check (1/5) · Penny', action: 'invest-talk-new' },
    { id: 'invest-choose', label: 'Which commodity will you buy?' },
    { id: 'invest-amount', label: 'How much to invest', action: 'invest-amount-demo' },
    { id: 'invest-pocket', label: 'Pocket after investing', action: 'invest-pocket-demo' }
  ];
  // Figma section 30:9824. Home's "Invest with Gaurdian" card opens the hub; it ends on the shared Insight / Spending.
  var GUARDIAN = [
    { id: 'guardian', label: 'With Guardian (Invest tab)' },
    { id: 'guardian-intro', label: 'Spending with guardians together' },
    { id: 'guardian-who', label: 'Who are you teaming up with?' },
    { id: 'guardian-sent', label: 'Sharing invitation is sent', branch: 'answers by itself' },
    { id: 'guardian-yes', label: 'Mom says YES' },
    { id: 'guardian-budgets', label: 'What budgeting do you want to share?' },
    { id: 'guardian-confirm', label: 'Please confirm your sharing challenge' },
    { id: 'guardian-boom', label: 'Boom! You are sharing spending' },
    { id: 'guardian-insight', label: 'Insight' },
    { id: 'guardian-spending', label: 'Spending', branch: 'transactions, then Mom’s reactions, arrive by themselves' }
  ];
  var GUARDIAN_VIEWS = [
    { label: 'Spending · with Mom’s reactions', action: 'guardian-demo-spending' },
    { label: 'Category · Transport', action: 'guardian-demo-category' },
    { label: 'By dates · date picker open', action: 'guardian-demo-dates' }
  ];
  // The routes in the prototype panel. Each opens as an accordion listing its steps.
  var ROUTES = [
    { key: 'onboarding', title: 'Onboarding', groups: [{ steps: ONBOARDING }] },
    { key: 'goal', title: 'Setting own goal with own time frame',
      groups: [{ steps: GOAL }, { title: 'Penny check-ins (on Home)', steps: CHECKINS, plain: true }] },
    { key: 'budget', title: 'Budgeting', groups: [{ steps: BUDGET }] },
    { key: 'invest', title: 'Invest after long conversation', groups: [{ steps: INVEST }] },
    { key: 'guardian', title: 'Spending with guardian',
      groups: [{ steps: GUARDIAN }, { title: 'Spending page states', steps: GUARDIAN_VIEWS, plain: true }] }
  ];
  var IDS = ONBOARDING.map(function (s) { return s.id; });
  // Screens inside the goal flow (between the two Home versions).
  var GOAL_IDS = GOAL.map(function (s) { return s.id; }).filter(function (id) { return id !== 'home' && id !== 'home-goal'; });
  var BUDGET_IDS = BUDGET.map(function (s) { return s.id; });
  var BUDGET_PATH = BUDGET_IDS.filter(function (id) { return id !== 'budget-list'; });
  var INVEST_IDS = INVEST.map(function (s) { return s.id; });
  var INVEST_PATH = INVEST_IDS.filter(function (id) { return id !== 'invest-pocket'; });
  var GUARDIAN_IDS = GUARDIAN.map(function (s) { return s.id; });
  var GUARDIAN_PAGES = ['guardian-insight', 'guardian-spending'];   // back from these goes to the hub
  var GUARDIAN_PATH = GUARDIAN_IDS.filter(function (id) { return GUARDIAN_PAGES.indexOf(id) < 0; });

  var MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var FIRST_YEAR = 1900;
  var LAST_YEAR = new Date().getFullYear();
  var DEFAULT_DOB = { m: 10, d: 30, y: 1994 };   // Figma 1:1009 shows Nov 30 1994
  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
  var DURATION = 420;

  var device = $('#device');
  var wrap = $('#deviceWrap');
  var panel = $('.panel');
  var screens = {};
  $$('.screen').forEach(function (el) { screens[el.dataset.screen] = el; });

  var state;
  var stack = [];
  var current = null;
  var busy = false;

  function freshState() {
    return {
      email: '',
      first: '',
      middle: '',
      last: '',
      dob: { m: DEFAULT_DOB.m, d: DEFAULT_DOB.d, y: DEFAULT_DOB.y },
      dobTouched: false,
      accounts: { checking: false, saving: false },
      goalDraft: null,   // filled in by js/goal.js
      goal: null,
      budgetDraft: null, // filled in by js/budget.js
      budgets: []
    };
  }

  /* ---------- Hooks used by js/goal.js ---------- */
  var enterHooks = [];
  var resetHooks = [];
  var actions = {};

  // Back-stack for a screen reached by a jump (panel, deep link): the screens a user would have passed.
  function stackFor(id) {
    var i = IDS.indexOf(id);
    if (i >= 0 && id !== 'home') return IDS.slice(0, i + 1);
    var j = GOAL_IDS.indexOf(id);
    if (j >= 0) {
      var method = (id === 'regular-form' || id === 'regular-start') ? 'regular'
        : id === 'target-form' ? 'target'
        : (state.goalDraft && state.goalDraft.method) || 'target';
      var path = ['home'].concat(GOAL_IDS.filter(function (s) {
        if (method === 'regular') return s !== 'target-form';
        return s !== 'regular-form' && s !== 'regular-start';
      }));
      var k = path.indexOf(id);
      return path.slice(0, (k >= 0 ? k : path.length - 1) + 1);
    }
    var b = BUDGET_PATH.indexOf(id);
    if (b >= 0) return BUDGET_PATH.slice(0, b + 1);
    var v = INVEST_PATH.indexOf(id);
    if (v >= 0) {
      // The scan replaces itself with "ready", so the screens after it don't step back into it.
      var scan = INVEST_PATH.indexOf('invest-scan');
      return INVEST_PATH.slice(0, v + 1).filter(function (s, i) { return v <= scan || i !== scan; });
    }
    var w = GUARDIAN_PATH.indexOf(id);
    if (w >= 0) {
      // The invitation screen replaces itself with the answer, so later screens don't step back into it.
      var sent = GUARDIAN_PATH.indexOf('guardian-sent');
      return GUARDIAN_PATH.slice(0, w + 1).filter(function (s, i) { return w <= sent || i !== sent; });
    }
    if (GUARDIAN_PAGES.indexOf(id) >= 0) return ['guardian', id];
    return id === 'home' ? IDS.slice() : [id];
  }

  /* ---------- Scaling: keep the 375 x 812 frame proportions ---------- */
  var fixedScale = parseFloat(new URLSearchParams(location.search).get('scale'));

  function scale() { return window.__protoScale || 1; }

  function fit() {
    var vw = window.innerWidth;
    var vh = window.innerHeight;
    var s;
    if (fixedScale > 0) s = fixedScale;
    else if (vw < 760) s = Math.min(vw / 375, vh / 812);
    else s = Math.min((vh - 48) / 812, (vw - 96 - 248 - 48) / 375, 1.25);
    wrap.style.width = 375 * s + 'px';
    wrap.style.height = 812 * s + 'px';
    panel.style.height = 812 * s + 'px';   // panel starts level with the phone and doesn't move when a route opens
    device.style.transform = 'scale(' + s + ')';
    window.__protoScale = s;
  }

  /* ---------- Navigation ---------- */
  function activateOnly(id) {
    Object.keys(screens).forEach(function (key) {
      screens[key].classList.toggle('is-active', key === id);
    });
  }

  function setCurrent(id) {
    current = id;
    device.dataset.screen = id;
    try { history.replaceState(null, '', '#' + id); } catch (e) { /* file:// in some browsers */ }
    if (id === 'home' || id === 'home-goal') {
      $$('.home-greeting').forEach(function (el) { el.textContent = 'Good morning , ' + (state.first || 'Mark'); });
    }
    enterHooks.forEach(function (fn) { fn(id); });
    updatePanel();
  }

  var slideTimer = null;
  var slideEls = [];

  function finishSlide() {
    clearTimeout(slideTimer);
    slideTimer = null;
    slideEls.forEach(function (el) {
      el.style.transition = '';
      el.style.transform = '';
      el.style.zIndex = '';
    });
    slideEls = [];
    busy = false;
  }

  function slide(fromEl, toEl, push) {
    var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!fromEl || fromEl === toEl || reduce) {
      activateOnly(current);
      return;
    }
    busy = true;
    slideEls = [fromEl, toEl];
    toEl.classList.add('is-active');
    [fromEl, toEl].forEach(function (el) { el.style.transition = 'none'; });
    toEl.style.transform = push ? 'translateX(100%)' : 'translateX(-30%)';
    fromEl.style.transform = 'translateX(0)';
    toEl.style.zIndex = push ? '2' : '1';
    fromEl.style.zIndex = push ? '1' : '2';
    void toEl.offsetWidth;
    var t = 'transform ' + DURATION + 'ms cubic-bezier(0.2, 0.8, 0.2, 1)';
    toEl.style.transition = t;
    fromEl.style.transition = t;
    toEl.style.transform = 'translateX(0)';
    fromEl.style.transform = push ? 'translateX(-30%)' : 'translateX(100%)';
    slideTimer = setTimeout(function () {
      fromEl.classList.remove('is-active');
      finishSlide();
    }, DURATION + 20);
  }

  function go(id) {
    if (busy || !screens[id] || id === current) return;
    closeSheet();
    var from = screens[current];
    stack.push(id);
    setCurrent(id);
    slide(from, screens[id], true);
  }

  // Like go, but the new screen takes the current one's place in the back stack.
  function replace(id) {
    if (busy || !screens[id] || id === current) return;
    closeSheet();
    var from = screens[current];
    stack[stack.length - 1] = id;
    setCurrent(id);
    slide(from, screens[id], true);
  }

  // Like go, but the back stack becomes the one a jump would give (Boom → Insight, whose back goes to the hub).
  function goFresh(id) {
    if (busy || !screens[id] || id === current) return;
    closeSheet();
    var from = screens[current];
    stack = stackFor(id);
    setCurrent(id);
    slide(from, screens[id], true);
  }

  function back() {
    if (busy) return;
    if (sheetOpen) { closeSheet(); return; }
    var prev;
    if (stack.length > 1) {
      stack.pop();
      prev = stack[stack.length - 1];
    } else {
      var path = stackFor(current);
      if (path.length < 2) return;
      prev = path[path.length - 2];
      stack = path.slice(0, -1);
    }
    var from = screens[current];
    setCurrent(prev);
    slide(from, screens[prev], false);
  }

  function jump(id) {
    if (!screens[id]) return;
    finishSlide();
    closeSheet();
    stack = stackFor(id);
    setCurrent(id);
    activateOnly(id);
  }

  device.addEventListener('click', function (e) {
    var t = e.target.closest('[data-go], [data-back], [data-action]');
    if (!t || !device.contains(t) || t.disabled) return;
    if (t.hasAttribute('data-back')) { back(); return; }
    if (t.dataset.go) { go(t.dataset.go); return; }
    switch (t.dataset.action) {
      case 'open-sheet':
        openSheet();
        break;
      case 'accounts-next':
        // The Figma CTA is always blue; it continues once an account is checked (1:1233 → 1:1277).
        if (state.accounts.checking || state.accounts.saving) go('linked');
        break;
      default:
        if (actions[t.dataset.action]) actions[t.dataset.action](t);
    }
  });

  /* ---------- Terms sheet (1:679 overlay + 1:745 sheet) ---------- */
  var overlay = $('#sheetOverlay');
  var sheet = $('#sheet');
  var sheetOpen = false;

  function openSheet() {
    if (busy) return;
    sheetOpen = true;
    overlay.classList.add('is-open');
    sheet.classList.add('is-open');
  }
  function closeSheet() {
    sheetOpen = false;
    overlay.classList.remove('is-open');
    sheet.classList.remove('is-open');
  }
  overlay.addEventListener('click', closeSheet);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && sheetOpen) closeSheet();
  });

  /* ---------- Email ---------- */
  var emailInput = $('#email');
  var emailNext = $('#emailNext');
  emailInput.addEventListener('input', function () {
    state.email = emailInput.value.trim();
    emailNext.disabled = !EMAIL_RE.test(state.email);
  });
  emailInput.addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !emailNext.disabled) {
      emailInput.blur();
      go('check-email');
    }
  });

  /* ---------- Name ---------- */
  var nameFields = [$('#firstName'), $('#middleName'), $('#lastName')];
  var nameNext = $('#nameNext');
  function syncName() {
    state.first = nameFields[0].value.trim();
    state.middle = nameFields[1].value.trim();
    state.last = nameFields[2].value.trim();
    nameNext.disabled = !(state.first && state.last);   // middle name is optional
  }
  nameFields.forEach(function (input, i) {
    input.addEventListener('input', syncName);
    input.addEventListener('keydown', function (e) {
      if (e.key !== 'Enter') return;
      e.preventDefault();
      if (i < nameFields.length - 1) nameFields[i + 1].focus();
      else if (!nameNext.disabled) { input.blur(); go('birthday'); }
    });
  });

  /* ---------- Birthday wheel ---------- */
  var dobNext = $('#dobNext');
  var picker = $('#dobPicker');
  var dayLabels = [];
  var yearLabels = [];
  for (var d = 1; d <= 31; d++) dayLabels.push(String(d));
  for (var y = FIRST_YEAR; y <= LAST_YEAR; y++) yearLabels.push(String(y));

  // Column centres from Figma 1:1009: month ≈ x 95, day ≈ x 145, year ≈ x 259.
  var monthCol = new WheelColumn(picker, {
    labels: MONTHS, index: DEFAULT_DOB.m, loop: true,
    left: 20, width: 100, centerX: 95.2, skew: 0,
    ariaLabel: 'Month', getScale: scale, onChange: onDobChange
  });
  var dayCol = new WheelColumn(picker, {
    labels: dayLabels, index: DEFAULT_DOB.d - 1, loop: true,
    left: 120, width: 80, centerX: 145.4, skew: 1, tracking: -0.0429,
    ariaLabel: 'Day', getScale: scale, onChange: onDobChange
  });
  var yearCol = new WheelColumn(picker, {
    labels: yearLabels, index: DEFAULT_DOB.y - FIRST_YEAR, loop: false,
    left: 200, width: 155, centerX: 259, skew: -1,
    ariaLabel: 'Year', getScale: scale, onChange: onDobChange
  });

  function onDobChange(col, user) {
    var m = monthCol.index();
    var day = dayCol.index() + 1;
    var year = FIRST_YEAR + yearCol.index();
    var maxDay = new Date(year, m + 1, 0).getDate();
    if (day > maxDay) {
      // Like UIDatePicker: roll an impossible day (e.g. Feb 30) back to the last valid one.
      dayCol.stepBy(maxDay - day);
      return;
    }
    var changed = m !== state.dob.m || day !== state.dob.d || year !== state.dob.y;
    state.dob = { m: m, d: day, y: year };
    if (changed && user) state.dobTouched = true;
    dobNext.disabled = !state.dobTouched;
  }

  /* ---------- Bank list search ---------- */
  var bankSearch = $('#bankSearch');
  var bankRows = $$('#bankList .bank');
  bankSearch.addEventListener('input', function () {
    var q = bankSearch.value.trim().toLowerCase();
    bankRows.forEach(function (row) {
      row.hidden = !!q && row.dataset.bank.toLowerCase().indexOf(q) === -1;
    });
  });

  /* ---------- Which account (multi-select) ---------- */
  var accountBoxes = $$('[data-account]');
  accountBoxes.forEach(function (box) {
    box.addEventListener('click', function () {
      var key = box.dataset.account;
      state.accounts[key] = !state.accounts[key];
      box.setAttribute('aria-checked', String(state.accounts[key]));
    });
  });

  /* ---------- Prototype panel: route accordions ---------- */
  var panelList = $('#panelSteps');
  var routeEls = {};
  var followedRoute = null;

  function stepList(group) {
    var ol = document.createElement('ol');
    ol.className = 'panel-steps' + (group.plain ? ' panel-steps--plain' : '');
    group.steps.forEach(function (step) {
      var li = document.createElement('li');
      var b = document.createElement('button');
      b.type = 'button';
      b.textContent = step.label;
      if (step.id) b.dataset.jump = step.id;
      if (step.action) b.dataset.panelAction = step.action;
      li.appendChild(b);
      if (step.branch) {
        var note = document.createElement('div');
        note.className = 'panel-branch';
        note.textContent = step.branch;
        li.appendChild(note);
      }
      ol.appendChild(li);
    });
    return ol;
  }
  ROUTES.forEach(function (route) {
    var routeEl = document.createElement('section');
    routeEl.className = 'route';
    routeEl.dataset.route = route.key;
    var head = document.createElement('button');
    head.type = 'button';
    head.className = 'route-head';
    head.id = 'route-' + route.key + '-head';
    head.setAttribute('aria-controls', 'route-' + route.key);
    head.setAttribute('aria-expanded', 'false');
    head.innerHTML = '<span class="route-title"></span><span class="route-count"></span><span class="route-chev" aria-hidden="true"></span>';
    head.querySelector('.route-title').textContent = route.title;
    head.querySelector('.route-count').textContent = route.groups[0].steps.length + ' steps';
    var body = document.createElement('div');
    body.className = 'route-body';
    body.id = 'route-' + route.key;
    body.setAttribute('role', 'region');
    body.setAttribute('aria-labelledby', head.id);
    var inner = document.createElement('div');
    inner.className = 'route-inner';
    route.groups.forEach(function (group) {
      if (group.title) {
        var sub = document.createElement('div');
        sub.className = 'route-sub';
        sub.textContent = group.title;
        inner.appendChild(sub);
      }
      inner.appendChild(stepList(group));
    });
    body.appendChild(inner);
    routeEl.appendChild(head);
    routeEl.appendChild(body);
    panelList.appendChild(routeEl);
    routeEls[route.key] = routeEl;
  });

  // Accordion: at most one route is open (key null closes them all).
  function openRoute(key) {
    Object.keys(routeEls).forEach(function (k) {
      routeEls[k].classList.toggle('is-open', k === key);
      routeEls[k].querySelector('.route-head').setAttribute('aria-expanded', String(k === key));
    });
  }
  function openRouteKey() {
    return Object.keys(routeEls).filter(function (k) { return routeEls[k].classList.contains('is-open'); })[0] || null;
  }
  // Home before a goal ends onboarding and starts the goal route, so it doesn't switch the open one.
  // Welcome doesn't either: the panel starts closed and Onboarding opens once "Start" moves on.
  function routeOf(id) {
    if (id === 'home' || id === 'splash') return null;
    if (id === 'home-goal' || GOAL_IDS.indexOf(id) >= 0) return 'goal';
    if (BUDGET_IDS.indexOf(id) >= 0) return 'budget';
    if (INVEST_IDS.indexOf(id) >= 0) return 'invest';
    if (GUARDIAN_IDS.indexOf(id) >= 0) return 'guardian';
    return IDS.indexOf(id) >= 0 ? 'onboarding' : null;
  }
  panelList.addEventListener('click', function (e) {
    var head = e.target.closest('.route-head');
    if (head) {
      var key = head.parentNode.dataset.route;
      openRoute(routeEls[key].classList.contains('is-open') ? null : key);
      updatePanel();
      return;
    }
    var b = e.target.closest('button');
    if (!b) return;
    var act = b.dataset.panelAction;
    if (act && actions[act]) { actions[act](b); return; }
    if (b.dataset.jump) jump(b.dataset.jump);
  });
  function updatePanel() {
    // When the prototype moves into the other route (e.g. Home → Create goal), open that route.
    var r = routeOf(current);
    if (r && r !== followedRoute) {
      openRoute(r);
      followedRoute = r;
    }
    var homeRoute = openRouteKey() || 'onboarding';   // Home (1:512) is listed in both routes
    $$('#panelSteps [data-jump]').forEach(function (b) {
      var on = b.dataset.jump === current;
      if (on && current === 'home') on = b.closest('.route').dataset.route === homeRoute;
      if (on) b.setAttribute('aria-current', 'step');
      else b.removeAttribute('aria-current');
    });
  }

  function restart() {
    state = freshState();
    emailInput.value = '';
    nameFields.forEach(function (input) { input.value = ''; });
    emailNext.disabled = true;
    nameNext.disabled = true;
    dobNext.disabled = true;
    monthCol.setIndex(DEFAULT_DOB.m);
    dayCol.setIndex(DEFAULT_DOB.d - 1);
    yearCol.setIndex(DEFAULT_DOB.y - FIRST_YEAR);
    accountBoxes.forEach(function (box) { box.setAttribute('aria-checked', 'false'); });
    bankSearch.value = '';
    bankRows.forEach(function (row) { row.hidden = false; });
    $('#homeScroll').scrollTop = 0;
    $('#homeGoalScroll').scrollTop = 0;
    $('#consentScroll').scrollTop = 0;
    resetHooks.forEach(function (fn) { fn(); });
    followedRoute = null;   // back to the closed panel; Onboarding opens again after "Start"
    openRoute(null);
    jump('splash');
  }
  $('#restartBtn').addEventListener('click', restart);

  /* ---------- Boot ---------- */
  state = freshState();
  fit();
  window.addEventListener('resize', fit);
  // Wait until every flow script has registered its hooks before showing the first screen.
  document.addEventListener('DOMContentLoaded', function () {
    resetHooks.forEach(function (fn) { fn(); });
    var start = decodeURIComponent((location.hash || '').slice(1));
    jump(screens[start] ? start : 'splash');
  });
  // Deep links: editing the URL hash (e.g. #birthday) jumps straight to that screen.
  window.addEventListener('hashchange', function () {
    var id = decodeURIComponent(location.hash.slice(1));
    if (screens[id] && id !== current) jump(id);
  });

  // Shared API for js/goal.js, and handy for demos and QA from the browser console.
  window.proto = {
    go: go,
    replace: replace,
    goFresh: goFresh,
    back: back,
    jump: jump,
    restart: restart,
    getState: function () { return state; },
    current: function () { return current; },
    isBusy: function () { return busy; },
    scale: scale,
    onEnter: function (fn) { enterHooks.push(fn); },
    onReset: function (fn) { resetHooks.push(fn); },
    action: function (name, fn) { actions[name] = fn; },
    refreshPanel: function () { updatePanel(); }
  };
})();
