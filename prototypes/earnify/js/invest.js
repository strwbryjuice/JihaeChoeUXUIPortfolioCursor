/* "Invest after long conversation" — Figma section 30:7101.
   Builds on the shared navigation/state in js/app.js (window.proto). */
(function () {
  'use strict';

  var P = window.proto;
  var KB = window.protoKeyboard;
  var $ = function (sel, root) { return (root || document).querySelector(sel); };
  var $$ = function (sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); };

  var ADVANCE_DELAY = 280;   // tap → selected state → next step
  var BALANCE = 600;         // "Account 9809 Balance : £600" (30:8609)

  // The commodities in My Cart (30:7318). Names, tickers and logo crops follow each frame:
  // the cart and the pick list say "Eagerious / Step Agentic", the amount screen "Eagerse / Step Agent".
  var ITEMS = {
    step: { name: 'Step Agentic', tick: 'APPL', short: 'Step Agent', shortTick: 'STAT', x: 211.851, y: 488.147 },
    allhub: { name: 'All Hub', tick: 'AH', short: 'All Hub', shortTick: 'AH', x: 201.43, y: 536.078 },
    ford: { name: 'Ford', tick: 'FR11', short: 'Ford', shortTick: 'FR11', x: 90.134, y: 501.469, w: 284.558, h: 646.516 },
    tempo: { name: 'Tempo', tick: 'TMP', short: 'Tempo', shortTick: 'TMP', x: 149.044, y: 396.61 },
    eager: { name: 'Eagerious', tick: 'EGR', short: 'Eagerse', shortTick: 'EGR', x: 212.52, y: 395.938 }
  };
  var CHOOSE_ORDER = ['eager', 'step', 'allhub', 'ford', 'tempo'];   // 30:7149
  var DEMO_PICKS = ['eager', 'step'];                                // what 30:7149 / 30:8609 show

  // The country list as drawn in 30:7427 starts "Afgahanistan, Albania, Algeria, Angola, Austria, Azerbaijan, Bahamas".
  var COUNTRIES = ['Afgahanistan', 'Albania', 'Algeria', 'Angola', 'Austria', 'Azerbaijan', 'Bahamas', 'Bahrain', 'Bangladesh',
    'Barbados', 'Belarus', 'Belgium', 'Belize', 'Benin', 'Bhutan', 'Bolivia', 'Bosnia and Herzegovina', 'Botswana', 'Brazil',
    'Brunei', 'Bulgaria', 'Burkina Faso', 'Burundi', 'Cambodia', 'Cameroon', 'Canada', 'Cape Verde', 'Central African Republic',
    'Chad', 'Chile', 'China', 'Colombia', 'Comoros', 'Congo', 'Costa Rica', 'Croatia', 'Cuba', 'Cyprus', 'Czech Republic',
    'Denmark', 'Djibouti', 'Dominica', 'Dominican Republic', 'Ecuador', 'Egypt', 'El Salvador', 'Equatorial Guinea', 'Eritrea',
    'Estonia', 'Eswatini', 'Ethiopia', 'Fiji', 'Finland', 'France', 'Gabon', 'Gambia', 'Georgia', 'Germany', 'Ghana', 'Greece',
    'Grenada', 'Guatemala', 'Guinea', 'Guinea-Bissau', 'Guyana', 'Haiti', 'Honduras', 'Hungary', 'Iceland', 'India', 'Indonesia',
    'Iran', 'Iraq', 'Ireland', 'Israel', 'Italy', 'Ivory Coast', 'Jamaica', 'Japan', 'Jordan', 'Kazakhstan', 'Kenya', 'Kiribati',
    'Kosovo', 'Kuwait', 'Kyrgyzstan', 'Laos', 'Latvia', 'Lebanon', 'Lesotho', 'Liberia', 'Libya', 'Liechtenstein', 'Lithuania',
    'Luxembourg', 'Madagascar', 'Malawi', 'Malaysia', 'Maldives', 'Mali', 'Malta', 'Marshall Islands', 'Mauritania', 'Mauritius',
    'Mexico', 'Micronesia', 'Moldova', 'Monaco', 'Mongolia', 'Montenegro', 'Morocco', 'Mozambique', 'Myanmar', 'Namibia', 'Nauru',
    'Nepal', 'Netherlands', 'New Zealand', 'Nicaragua', 'Niger', 'Nigeria', 'North Korea', 'North Macedonia', 'Norway', 'Oman',
    'Pakistan', 'Palau', 'Panama', 'Papua New Guinea', 'Paraguay', 'Peru', 'Philippines', 'Poland', 'Portugal', 'Qatar', 'Romania',
    'Russia', 'Rwanda', 'Saint Kitts and Nevis', 'Saint Lucia', 'Saint Vincent and the Grenadines', 'Samoa', 'San Marino',
    'Sao Tome and Principe', 'Saudi Arabia', 'Senegal', 'Serbia', 'Seychelles', 'Sierra Leone', 'Singapore', 'Slovakia', 'Slovenia',
    'Solomon Islands', 'Somalia', 'South Africa', 'South Korea', 'South Sudan', 'Spain', 'Sri Lanka', 'Sudan', 'Suriname', 'Sweden',
    'Switzerland', 'Syria', 'Taiwan', 'Tajikistan', 'Tanzania', 'Thailand', 'Timor-Leste', 'Togo', 'Tonga', 'Trinidad and Tobago',
    'Tunisia', 'Turkey', 'Turkmenistan', 'Tuvalu', 'Uganda', 'Ukraine', 'United Arab Emirates', 'United Kingdom',
    'United States of America', 'Uruguay', 'Uzbekistan', 'Vanuatu', 'Vatican City', 'Venezuela', 'Vietnam', 'Yemen', 'Zambia',
    'Zimbabwe'];

  function fresh() {
    return { cart: {}, country: '', doc: '', verified: false, picks: [], chosen: null, amounts: {}, idx: 0, invested: false };
  }
  function st() { return P.getState(); }
  function inv() {
    var s = st();
    if (!s.invest) s.invest = fresh();
    return s.invest;
  }
  function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function selectOnly(list, el) { list.forEach(function (b) { b.classList.toggle('is-selected', b === el); }); }
  function logo(key, size) {
    var it = ITEMS[key];
    var k = size / 40;   // the 40 px crops scale up exactly to the 44 px ones
    var w = (it.w || 277.615) * k, h = (it.h || 630.741) * k;
    return '<span class="i-logo i-logo--' + size + '" style="background-size:' + w.toFixed(3) + 'px ' + h.toFixed(3) + 'px;' +
      'background-position:-' + (it.x * k).toFixed(3) + 'px -' + (it.y * k).toFixed(3) + 'px"></span>';
  }

  /* ---------- Tabs: Invest tab, Pocekt | Buy ---------- */
  function pocketScreen() { return inv().invested ? 'invest-pocket' : 'invest'; }
  P.action('tab-invest', function () { if (!P.isBusy()) P.jump(pocketScreen()); });
  P.action('invest-pocket', function () {
    if (!P.isBusy() && P.current() !== pocketScreen()) P.jump(pocketScreen());
  });
  P.action('invest-buy', function () {
    if (!P.isBusy() && P.current() !== 'invest-buy') P.jump('invest-buy');
  });

  /* ---------- My Cart (30:7318) ---------- */
  var cartItems = $$('.i-cart-item[data-pick]');
  var talkBtn = $('#investTalk');
  function renderCart() {
    var n = 0;
    cartItems.forEach(function (b) {
      var on = !!inv().cart[b.dataset.pick];
      b.setAttribute('aria-checked', String(on));
      if (on) n++;
    });
    $('#investCartCount').textContent = n + ' Items / ' + cartItems.length + ' items';
    talkBtn.disabled = !n;
  }
  cartItems.forEach(function (b) {
    b.addEventListener('click', function () {
      inv().cart[b.dataset.pick] = !inv().cart[b.dataset.pick];
      renderCart();
    });
  });
  // Verifying is a one-off ("You only need to do this once"): afterwards the cart goes straight to the money talk.
  P.action('invest-talk', function () {
    if (P.isBusy()) return;
    inv().chosen = null;
    P.go(inv().verified ? 'invest-ready' : 'invest-verify');
  });

  /* ---------- Verify your identify (30:7392 …) ---------- */
  function Dropdown(root, opts) {
    var box = $('.i-dd-box', root);
    var text = $('.i-dd-text', root);
    var chev = $('.i-dd-chev', root);
    var panel = $('.i-dd-panel', root);
    var picking = false;
    var api = {};
    api.isOpen = function () { return root.classList.contains('is-open'); };
    api.setOpen = function (open) {
      root.classList.toggle('is-open', open);
      panel.hidden = !open;
      box.setAttribute('aria-expanded', String(open));
      chev.src = open ? 'assets/img/icon-dropdown-up.svg' : 'assets/img/icon-dropdown-down.svg';
      if (opts.onToggle) opts.onToggle(open);
    };
    api.show = function (value) {
      root.classList.toggle('is-set', !!value);
      text.classList.toggle('is-placeholder', !value);
      text.textContent = value || opts.placeholder;
    };
    api.pick = function (btn) {
      if (picking) return;
      picking = true;
      selectOnly($$('.i-dd-opt', panel), btn);
      if (opts.onTap) opts.onTap(btn.dataset.value);
      setTimeout(function () {
        picking = false;
        api.setOpen(false);
        opts.onPick(btn.dataset.value);
      }, ADVANCE_DELAY);
    };
    api.contains = function (el) { return root.contains(el); };
    box.addEventListener('click', function () { api.setOpen(!api.isOpen()); });
    box.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); api.setOpen(!api.isOpen()); }
      if (e.key === 'Escape') api.setOpen(false);
    });
    panel.addEventListener('click', function (e) {
      var b = e.target.closest('.i-dd-opt');
      if (b) api.pick(b);
    });
    return api;
  }

  var countrySearch = $('#investCountrySearch');
  var countryList = $('#investCountryList');
  var verifyNext = $('#investVerifyNext');
  function renderCountries() {
    var q = countrySearch.value.trim().toLowerCase();
    var names = COUNTRIES.filter(function (c) { return !q || c.toLowerCase().indexOf(q) === 0; });
    countryList.innerHTML = names.length
      ? names.map(function (c) {
        return '<button class="i-dd-opt" type="button" role="option" data-value="' + esc(c) + '"' + (c === inv().country ? ' aria-selected="true"' : '') + '>' + esc(c) + '</button>';
      }).join('')
      : '<p class="i-dd-empty">No country found</p>';
  }
  var country = Dropdown($('.i-dd--country'), {
    placeholder: 'Select  your country',
    onToggle: function (open) {
      if (open) { doc && doc.setOpen(false); countrySearch.value = ''; renderCountries(); countryList.scrollTop = 0; }
      else if (document.activeElement === countrySearch) countrySearch.blur();
    },
    onPick: function (v) { inv().country = v; renderVerify(); }
  });
  var doc = Dropdown($('.i-dd--doc'), {
    placeholder: 'Select  an option',
    onToggle: function (open) {
      if (open) { country.setOpen(false); selectOnly($$('.i-dd--doc .i-dd-opt'), null); }
    },
    // Next turns on as soon as a type is tapped, while the list is still open (30:7944).
    onTap: function (v) { inv().doc = v; verifyNext.disabled = !inv().country; },
    onPick: function (v) { inv().doc = v; renderVerify(); }
  });
  countrySearch.addEventListener('input', renderCountries);
  // Tapping a country leaves the keyboard up until the list closes (30:7684 → 30:7857).
  countryList.addEventListener('mousedown', function (e) { e.preventDefault(); });
  countrySearch.addEventListener('keydown', function (e) { if (e.key === 'Enter') countrySearch.blur(); });
  KB.bind(countrySearch, 'letters', function () { countrySearch.blur(); });
  function renderVerify() {
    country.show(inv().country);
    doc.show(inv().doc);
    verifyNext.disabled = !(inv().country && inv().doc);
  }
  // A tap anywhere else closes an open list.
  document.addEventListener('click', function (e) {
    if (P.current() !== 'invest-verify') return;
    if (country.isOpen() && !country.contains(e.target) && !e.target.closest('.vkb')) country.setOpen(false);
    if (doc.isOpen() && !doc.contains(e.target)) doc.setOpen(false);
  });

  /* ---------- Scan (30:7997 → 30:8031 → 30:8065), plays by itself ---------- */
  var scan = $('section[data-screen="invest-scan"]');
  var scanMsg = $('#investScanMsg');
  var SCAN = {
    framing: 'Please go back to get full picture of your ID',
    perfect: 'Perfect',
    checking: 'Wait  for a moment'
  };
  var scanTimers = [];
  function scanState(name) { scan.dataset.state = name; scanMsg.textContent = SCAN[name]; }
  function stopScan() { scanTimers.forEach(clearTimeout); scanTimers = []; }
  function runScan() {
    stopScan();
    scanState('framing');
    scanTimers.push(setTimeout(function () { scanState('perfect'); }, 1800));
    scanTimers.push(setTimeout(function () { scanState('checking'); }, 3100));
    scanTimers.push(setTimeout(function () {
      inv().verified = true;
      if (P.current() === 'invest-scan') P.replace('invest-ready');
    }, 5000));
  }

  /* ---------- Money talk with Penny (30:8104 → 30:8187 → 30:8284) ---------- */
  // Penny asks five questions, one at a time ("Let's check (1/5)" … "(5/5)"). Only after all five are answered does
  // she offer to move on to buying (30:8284).
  var chat = $('#investChat');
  var log = $('#investChatLog');
  var form = $('#investReplyForm');
  var reply = $('#investReply');
  var talkTitle = $('.i-talk-title');
  var talkTimers = [];
  var QUESTIONS = [
    'Does this company have an amount of debt it can handle on its own?',
    'What is this company’s biggest selling point?',
    'Do you know any other businesses this company runs that aren’t well known? If you do, tell me. If not, let’s google it together.',
    'What is this company’s revenue model?',
    'Why do you think this company will grow even more in three years?'
  ];
  var asked = 0;      // questions Penny has asked so far
  var waiting = false; // Penny is "searching" before her next message
  function penny(html) {
    return '<div class="i-msg"><p class="i-who"><img src="assets/img/penny-avatar.svg" alt=""><span>Penny</span></p>' + html + '</div>';
  }
  function addToLog(html) {
    log.insertAdjacentHTML('beforeend', html);
    log.scrollTop = log.scrollHeight;
  }
  function ask(i) {
    asked = i + 1;
    talkTitle.textContent = 'Let’s check (' + asked + '/' + QUESTIONS.length + ')';
    addToLog(penny('<p class="i-text">' + QUESTIONS[i] + '</p>'));
  }
  function resetTalk() {
    talkTimers.forEach(clearTimeout);
    talkTimers = [];
    waiting = false;
    log.innerHTML = '';
    ask(0);
    log.scrollTop = 0;
    reply.value = '';
    form.classList.remove('has-text');
  }
  function send() {
    var text = reply.value.trim();
    if (!text || waiting) return;
    reply.value = '';
    form.classList.remove('has-text');
    reply.blur();
    var old = $('.i-opts', log);
    if (old) old.remove();
    addToLog('<div class="i-me"><p>' + esc(text) + '</p></div>');
    waiting = true;
    talkTimers.push(setTimeout(function () {
      addToLog(penny('<p class="i-note">Searching on Eagerse and others ...</p>'));
    }, 500));
    talkTimers.push(setTimeout(function () {
      waiting = false;
      var note = log.lastElementChild;
      if (note && $('.i-note', note)) note.remove();
      if (asked < QUESTIONS.length) { ask(asked); return; }
      addToLog(penny('<p class="i-text i-text--wide">Seems like you studied a lot, maybe <em>do you want to go next question </em>before purchasing the commodity? </p>') +
        '<div class="i-opts"><button type="button" data-talk="later" style="width:147px">No, not ready</button>' +
        '<button type="button" data-talk="next" style="width:148px">Let’s go next</button></div>');
    }, 2300));
  }
  form.addEventListener('submit', function (e) { e.preventDefault(); send(); });
  reply.addEventListener('input', function () { form.classList.toggle('has-text', !!reply.value.trim()); });
  KB.bind(reply, 'letters', send);
  reply.addEventListener('focus', function () {
    if (!KB.enabled) return;
    chat.classList.add('is-typing');
    setTimeout(function () { log.scrollTop = log.scrollHeight; }, 320);   // keep the latest message in view
  });
  reply.addEventListener('blur', function () { chat.classList.remove('is-typing'); });
  log.addEventListener('click', function (e) {
    var b = e.target.closest('[data-talk]');
    if (!b || P.isBusy()) return;
    if (b.dataset.talk === 'next') P.go('invest-choose');
    else reply.focus();   // "No, not ready": keep talking with Penny
  });
  P.action('invest-talk-new', function () { resetTalk(); P.jump('invest-talk'); });

  /* ---------- After your study, now what commodity will you buy? (30:7149) ---------- */
  var pickList = $('#investPickList');
  var chooseNext = $('#investChooseNext');
  pickList.innerHTML = CHOOSE_ORDER.map(function (key) {
    var it = ITEMS[key];
    return '<button class="i-pick" type="button" role="checkbox" aria-checked="false" data-pick="' + key + '">' +
      '<img class="cb cb-off" src="assets/img/checkbox-off.svg" alt=""><img class="cb cb-on" src="assets/img/checkbox-on.svg" alt="">' +
      '<span class="i-cart-row"><span class="i-cart-name" style="width:' + (key === 'eager' ? 170 : key === 'step' || key === 'allhub' ? 178 : 169) + 'px">' +
      '<span>' + it.name + '</span><span>' + it.tick + '</span></span>' + logo(key, 40) + '</span></button>';
  }).join('');
  var picks = $$('.i-pick', pickList);
  // The list starts with what you ticked in My Cart.
  function renderChoose() {
    var chosen = inv().chosen || inv().cart;
    picks.forEach(function (b) { b.setAttribute('aria-checked', String(!!chosen[b.dataset.pick])); });
    chooseNext.disabled = !picks.some(function (b) { return b.getAttribute('aria-checked') === 'true'; });
  }
  picks.forEach(function (b) {
    b.addEventListener('click', function () {
      var chosen = inv().chosen || (inv().chosen = Object.assign({}, inv().cart));
      chosen[b.dataset.pick] = !chosen[b.dataset.pick];
      renderChoose();
    });
  });
  P.action('invest-choose-next', function () {
    if (P.isBusy()) return;
    var d = inv();
    d.picks = picks.filter(function (b) { return b.getAttribute('aria-checked') === 'true'; }).map(function (b) { return b.dataset.pick; });
    d.amounts = {};
    d.idx = 0;
    P.go('invest-amount');
  });

  /* ---------- How much do you want to invest on …? (30:8609) ---------- */
  var amount = $('#investAmount');
  var amountNext = $('#investAmountNext');
  function spentBefore() {
    var d = inv(), sum = 0;
    for (var i = 0; i < d.idx; i++) sum += d.amounts[d.picks[i]] || 0;
    return sum;
  }
  function renderAmount() {
    var d = inv();
    if (!d.picks.length) d.picks = DEMO_PICKS.slice();
    var key = d.picks[d.idx];
    $('#investAmountTitle').innerHTML = 'How much do you want to invest<br>on ' + esc(ITEMS[key].short) + '?';
    $('#investAmountPicks').innerHTML = d.picks.map(function (k, i) {
      return '<div class="i-co' + (i === d.idx ? ' is-current' : '') + '">' + logo(k, 44) +
        '<span class="i-co-text"><span>' + ITEMS[k].short + '</span><span>' + ITEMS[k].shortTick + '</span></span></div>';
    }).join('');
    $('#investBalance').textContent = 'Account 9809 Balance : £' + (BALANCE - spentBefore());
    showAmount(document.activeElement === amount);
    syncAmountNext();
  }
  function showAmount(focused) {
    var a = inv().amounts[inv().picks[inv().idx]];
    amount.value = focused ? '£ ' + (a || '') : (a ? '£ ' + a : '');
  }
  // Next turns on for a whole-pound amount that fits the remaining balance.
  function syncAmountNext() {
    var a = inv().amounts[inv().picks[inv().idx]];
    amountNext.disabled = !(a > 0 && a <= BALANCE - spentBefore());
  }
  amount.addEventListener('focus', function () { showAmount(true); });
  amount.addEventListener('input', function () {
    var raw = amount.value.replace(/[^0-9]/g, '').replace(/^0+/, '').slice(0, 6);
    amount.value = '£ ' + raw;
    inv().amounts[inv().picks[inv().idx]] = raw ? parseInt(raw, 10) : 0;
    syncAmountNext();
  });
  amount.addEventListener('blur', function () { showAmount(false); });
  amount.addEventListener('keydown', function (e) { if (e.key === 'Enter') amount.blur(); });
  KB.bind(amount, 'phone');
  function focusAmount() {
    setTimeout(function () { if (P.current() === 'invest-amount' && KB.enabled) amount.focus(); }, 450);
  }
  P.action('invest-amount-next', function () {
    if (P.isBusy()) return;
    var d = inv();
    if (d.idx < d.picks.length - 1) {
      d.idx++;
      amount.blur();
      renderAmount();
      focusAmount();
      return;
    }
    amount.blur();
    d.invested = true;
    P.go('invest-pocket');
  });
  P.action('invest-amount-back', function () {
    if (P.isBusy()) return;
    var d = inv();
    if (d.idx > 0) {
      d.idx--;
      amount.blur();
      renderAmount();
      focusAmount();
    } else P.back();
  });
  P.action('invest-amount-demo', function () {
    var d = inv();
    if (!d.picks.length) d.picks = DEMO_PICKS.slice();
    d.idx = 0;
    P.jump('invest-amount');
  });

  /* ---------- Pocket (30:8644 / 30:8749) ---------- */
  var tech = $('[data-cat="tech"]');
  var techItems = $('#investTechItems');
  function setTech(open) {
    tech.setAttribute('aria-expanded', String(open));
    techItems.hidden = !open;
    $('.i-cat-end img', tech).src = open ? 'assets/img/pocket-chev-open.svg' : 'assets/img/icon-chevron.svg';
  }
  tech.addEventListener('click', function () { setTech(tech.getAttribute('aria-expanded') !== 'true'); });
  P.action('invest-pocket-demo', function () { inv().invested = true; P.jump('invest-pocket'); });

  /* ---------- Screen hooks ---------- */
  var previous = null;
  P.onEnter(function (id) {
    if (id !== 'invest-scan') stopScan();
    if (id !== 'invest-verify') { country.setOpen(false); doc.setOpen(false); }
    if (id === 'invest-cart') renderCart();
    if (id === 'invest-verify') renderVerify();
    if (id === 'invest-scan') runScan();
    if (id === 'invest-talk' && previous === 'invest-ready') resetTalk();
    if (id === 'invest-choose') renderChoose();
    if (id === 'invest-amount') { renderAmount(); focusAmount(); }
    if (id === 'invest-pocket' && previous !== 'invest-pocket') { setTech(false); $('#investPocketScroll').scrollTop = 0; }
    previous = id;
  });
  P.onReset(function () {
    st().invest = fresh();
    renderCart();
    renderVerify();
    resetTalk();
    setTech(false);
    stopScan();
    scanState('framing');
  });

  window.investProto = { state: inv, countries: COUNTRIES };
})();
