/* On-screen iOS keyboards, used when the prototype is viewed with a mouse.
   - Letters: the keyboard from the Figma file (iPhone Keyboard (Text), 9:2888) with clickable keys.
   - Numbers (goal flow): the iOS number pad, drawn in index.html to match 9:2888.
   - Phone pad (budgeting): the Figma "iPhone keyboard (Numeric)" 24:5340, built in index.html.
   On phones and tablets the device's own keyboard appears instead, so nothing here is switched on. */
(function () {
  'use strict';

  var P = window.proto;
  var device = document.getElementById('device');
  var enabled = !!(window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches);
  var HEIGHT = 293;   // 9:2888

  // Type at the end of the field, then let the field's own input handler react (formatting, validation).
  function changed(input) {
    input.dispatchEvent(new Event('input', { bubbles: true }));
    var end = input.value.length;
    try { input.setSelectionRange(end, end); } catch (e) { /* field without a caret */ }
  }
  function insert(input, text) { input.value += text; changed(input); }
  function backspace(input) { input.value = input.value.slice(0, -1); changed(input); }

  // Clickable keys laid over the letter keyboard image (rects measured from 9:2888).
  var LETTER_KEYS = [];
  'QWERTYUIOP'.split('').forEach(function (k, i) { LETTER_KEYS.push({ k: k, x: 2 + 37 * i, y: 8, w: 37, h: 44 }); });
  'ASDFGHJKL'.split('').forEach(function (k, i) { LETTER_KEYS.push({ k: k, x: 19 + 38 * i, y: 62, w: 38, h: 44 }); });
  'ZXCVBNM'.split('').forEach(function (k, i) { LETTER_KEYS.push({ k: k, x: 55 + 38 * i, y: 116, w: 38, h: 43 }); });
  LETTER_KEYS.push({ k: 'shift', x: 3, y: 116, w: 42, h: 43 });
  LETTER_KEYS.push({ k: 'delete', x: 330, y: 116, w: 42, h: 42 });
  LETTER_KEYS.push({ k: ' ', x: 96, y: 172, w: 182, h: 43 });
  LETTER_KEYS.push({ k: 'return', x: 285, y: 172, w: 87, h: 43 });

  // Taps anywhere on a keyboard (keys or the gaps between them) leave the field focused, as on iOS.
  function keepFocus(el) {
    el.addEventListener('pointerdown', function (e) { e.preventDefault(); });
  }

  function letterKeys(container, getInput, onReturn) {
    var shift = true;
    keepFocus(container);
    LETTER_KEYS.forEach(function (key) {
      var b = document.createElement('button');
      b.type = 'button';
      b.tabIndex = -1;
      b.className = 'kb-key';
      b.setAttribute('aria-label', key.k === ' ' ? 'space' : key.k);
      b.style.cssText = 'left:' + key.x + 'px;top:' + key.y + 'px;width:' + key.w + 'px;height:' + key.h + 'px';
      b.addEventListener('click', function () {
        var input = getInput();
        if (!input) return;
        if (key.k === 'shift') { shift = !shift; return; }
        if (key.k === 'delete') { backspace(input); return; }
        if (key.k === 'return') { onReturn(input); return; }
        if (key.k === ' ') { insert(input, ' '); return; }
        var auto = !input.value || /[.!?]\s$/.test(input.value);   // iOS capitalises the start of a sentence
        insert(input, shift || auto ? key.k : key.k.toLowerCase());
        shift = false;
      });
      container.appendChild(b);
    });
  }

  /* ---------- Page keyboards: slide up from the bottom while a bound field has focus ---------- */
  var pads = {
    letters: document.getElementById('pageLetters'),
    numbers: document.getElementById('pageNumbers'),
    phone: document.getElementById('pagePhonePad')
  };
  var current = null;   // { input, pad, onReturn, scroller }

  function fieldFor(pad) { return current && current.pad === pad ? current.input : null; }

  letterKeys(pads.letters, function () { return fieldFor(pads.letters); }, function (input) {
    if (current && current.onReturn) current.onReturn(input);
    else input.blur();
  });
  [pads.numbers, pads.phone].forEach(function (pad) {
    keepFocus(pad);
    pad.addEventListener('click', function (e) {
      var b = e.target.closest('button[data-k]');
      var input = fieldFor(pad);
      if (!b || !input) return;
      if (b.dataset.k === 'del') backspace(input);
      else insert(input, b.dataset.k);
    });
  });

  function open(input, kind, onReturn) {
    close();
    var pad = pads[kind === 'letters' || kind === 'phone' ? kind : 'numbers'];
    pads.numbers.classList.toggle('is-integer', kind === 'number');   // no decimal point for whole numbers
    current = { input: input, pad: pad, onReturn: onReturn, scroller: null };
    pad.classList.add('is-open');
    keepVisible();
  }
  function close() {
    if (!current) return;
    current.pad.classList.remove('is-open');
    if (current.scroller) current.scroller.style.paddingBottom = '';
    current = null;
  }
  // Like iOS, scroll the screen so the keyboard doesn't cover the field.
  function keepVisible() {
    var scroller = current.input.closest('.scroll');
    if (!scroller) return;
    var top = device.getBoundingClientRect().top;
    var bottom = (current.input.getBoundingClientRect().bottom - top) / P.scale();
    var height = current.pad.offsetHeight || HEIGHT;
    var limit = 812 - height - 12;
    if (bottom <= limit) return;
    scroller.style.paddingBottom = height + 'px';
    current.scroller = scroller;
    scroller.scrollTo({ top: scroller.scrollTop + bottom - limit, behavior: 'smooth' });
  }

  // kind: 'letters', 'decimal' (amounts), 'number' (whole numbers) or 'phone' (the Figma number pad 24:5340).
  // onReturn: the letter keyboard's return key.
  function bind(input, kind, onReturn) {
    if (!enabled) return;
    input.addEventListener('focus', function () { open(input, kind, onReturn); });
    input.addEventListener('blur', function () { if (current && current.input === input) close(); });
  }

  // Changing screen takes the keyboard down with it.
  P.onEnter(function () {
    if (current && document.activeElement === current.input) current.input.blur();
    close();
  });

  window.protoKeyboard = { enabled: enabled, letterKeys: letterKeys, bind: bind, close: close };
})();
