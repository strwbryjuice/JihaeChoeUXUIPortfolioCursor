/* iOS-style wheel column for the birthday screen.
   The row geometry is measured from the Figma picker (frames 1:1009 and 1:1054):
   each row's distance from the selected row maps to a vertical offset, a font size,
   an opacity and a small skew that fakes the cylinder perspective. */
(function () {
  'use strict';

  var ROW_Y = [0, 37.7, 66.6, 89.6, 103.4];            // px from the centre line
  var ROW_SIZE = [26.92, 22.31, 17.69, 13.85, 6.15];   // SF Pro Text Regular, px
  var ROW_SKEW = [0, 2.6, 5.4, 7.8, 14];               // deg
  var ROW_SCALE_Y = [1, 1, 0.99, 0.99, 0.96];
  var BASE_SIZE = 26.92;
  var CENTER_Y = 108.16;   // selected row centre inside the picker box (405.16 - 297)
  var PITCH = 36;          // drag distance (Figma px) that moves one row
  var HALF = 5;            // rows rendered on each side of the centre

  function lerp(arr, a) {
    var n = arr.length - 1;
    if (a >= n) return arr[n] + (arr[n] - arr[n - 1]) * (a - n);
    var i = Math.floor(a);
    return arr[i] + (arr[i + 1] - arr[i]) * (a - i);
  }
  function mod(a, n) { return ((a % n) + n) % n; }
  function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

  /**
   * opts: labels, index, loop, left, width, centerX, skew (1 = lean like the day
   * column, -1 = like the year column, 0 = none), tracking (em), ariaLabel,
   * getScale(), onChange(column, userInitiated)
   */
  function WheelColumn(host, opts) {
    this.labels = opts.labels;
    this.n = opts.labels.length;
    this.loop = !!opts.loop;
    this.skew = opts.skew || 0;
    this.offset = opts.index;
    this.getScale = opts.getScale || function () { return 1; };
    this.onChange = opts.onChange || function () {};
    this.raf = null;
    this.drag = null;

    var el = this.el = document.createElement('div');
    el.className = 'wheel-col';
    el.style.left = opts.left + 'px';
    el.style.width = opts.width + 'px';
    el.tabIndex = 0;
    el.setAttribute('role', 'spinbutton');
    el.setAttribute('aria-label', opts.ariaLabel || '');

    this.rows = [];
    for (var k = -HALF; k <= HALF; k++) {
      var row = document.createElement('span');
      row.className = 'wheel-item';
      row.style.left = (opts.centerX - opts.left) + 'px';
      row.style.top = CENTER_Y + 'px';
      if (opts.tracking) row.style.letterSpacing = opts.tracking + 'em';
      el.appendChild(row);
      this.rows.push(row);
    }
    host.appendChild(el);
    this._bind();
    this.render();
    this._aria();
  }

  WheelColumn.prototype.index = function () {
    var r = Math.round(this.offset);
    return this.loop ? mod(r, this.n) : clamp(r, 0, this.n - 1);
  };

  WheelColumn.prototype.render = function () {
    var base = Math.round(this.offset);
    for (var k = -HALF; k <= HALF; k++) {
      var row = this.rows[k + HALF];
      var idx = base + k;
      var d = idx - this.offset;
      var a = Math.abs(d);
      if (a > 4.6 || (!this.loop && (idx < 0 || idx >= this.n))) {
        row.style.display = 'none';
        continue;
      }
      var label = this.labels[this.loop ? mod(idx, this.n) : idx];
      if (row.textContent !== label) row.textContent = label;

      var sign = d < 0 ? -1 : 1;
      var capped = Math.min(a, 4);
      var y = sign * lerp(ROW_Y, a);
      var size = a <= 4 ? lerp(ROW_SIZE, a) : ROW_SIZE[4] * (1 - (a - 4) / 0.6);
      var s = Math.max(size, 0.01) / BASE_SIZE;
      var sy = lerp(ROW_SCALE_Y, capped);
      var skew = this.skew ? -sign * this.skew * lerp(ROW_SKEW, capped) : 0;
      var opacity = a <= 1 ? 1 - 0.65 * a : (a <= 4 ? 0.35 : 0.35 * (1 - (a - 4) / 0.6));

      row.style.display = '';
      row.style.opacity = opacity.toFixed(3);
      row.style.transform = 'translate(-50%, -50%) translateY(' + y.toFixed(2) + 'px) skewX(' +
        skew.toFixed(2) + 'deg) scale(' + s.toFixed(4) + ', ' + (s * sy).toFixed(4) + ')';
    }
  };

  WheelColumn.prototype.animateTo = function (target, user) {
    var self = this;
    if (!this.loop) target = clamp(target, 0, this.n - 1);
    this._stop();
    this.target = target;
    var from = this.offset;
    var dist = Math.abs(target - from);
    if (dist < 0.001) {
      this.offset = target;
      this._settle(user);
      return;
    }
    var duration = clamp(160 + dist * 70, 220, 900);
    var t0 = performance.now();
    function finish() {
      if (self.raf) cancelAnimationFrame(self.raf);
      clearTimeout(self.settleTimer);
      self.raf = null;
      self.offset = target;
      self._settle(user);
    }
    function step(now) {
      var p = Math.min(1, (now - t0) / duration);
      var eased = 1 - Math.pow(1 - p, 3);
      self.offset = from + (target - from) * eased;
      self.render();
      if (p < 1) self.raf = requestAnimationFrame(step);
      else finish();
    }
    this.raf = requestAnimationFrame(step);
    // Settle even when animation frames are throttled (background tabs, some embedded views).
    this.settleTimer = setTimeout(finish, duration + 80);
  };

  WheelColumn.prototype.stepBy = function (delta) {
    this.animateTo(Math.round(this.offset) + delta, false);
  };

  WheelColumn.prototype.setIndex = function (i) {
    this._stop();
    this.offset = i;
    this.render();
    this._aria();
  };

  WheelColumn.prototype._stop = function () {
    if (this.raf) cancelAnimationFrame(this.raf);
    this.raf = null;
    clearTimeout(this.wheelTimer);
    clearTimeout(this.settleTimer);
  };

  WheelColumn.prototype._settle = function (user) {
    if (this.loop) this.offset = mod(Math.round(this.offset), this.n);
    this.render();
    this._aria();
    this.onChange(this, !!user);
  };

  WheelColumn.prototype._aria = function () {
    var i = this.index();
    this.el.setAttribute('aria-valuenow', String(i));
    this.el.setAttribute('aria-valuetext', this.labels[i]);
  };

  WheelColumn.prototype._bind = function () {
    var self = this;
    var el = this.el;

    el.addEventListener('pointerdown', function (e) {
      if (e.button !== 0) return;
      self._stop();
      self.drag = { id: e.pointerId, y0: e.clientY, o0: self.offset, moved: false, samples: [{ t: e.timeStamp, o: self.offset }] };
      try { el.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
      el.focus({ preventScroll: true });
      e.preventDefault();
    });

    el.addEventListener('pointermove', function (e) {
      var dr = self.drag;
      if (!dr || e.pointerId !== dr.id) return;
      var dy = (e.clientY - dr.y0) / self.getScale();
      if (Math.abs(dy) > 4) dr.moved = true;
      var o = dr.o0 - dy / PITCH;
      if (!self.loop) {
        var max = self.n - 1;
        if (o < 0) o *= 0.35;
        else if (o > max) o = max + (o - max) * 0.35;
      }
      self.offset = o;
      dr.samples.push({ t: e.timeStamp, o: o });
      if (dr.samples.length > 12) dr.samples.shift();
      self.render();
    });

    function end(e) {
      var dr = self.drag;
      if (!dr || e.pointerId !== dr.id) return;
      self.drag = null;
      if (!dr.moved) {
        // Tap: bring the tapped row to the centre, like UIPickerView.
        var rect = el.getBoundingClientRect();
        var local = (e.clientY - rect.top) / self.getScale() - CENTER_Y;
        var best = 0;
        var bestDist = Infinity;
        for (var k = -4; k <= 4; k++) {
          var yy = (k < 0 ? -1 : 1) * lerp(ROW_Y, Math.abs(k));
          if (Math.abs(yy - local) < bestDist) { bestDist = Math.abs(yy - local); best = k; }
        }
        self.animateTo(Math.round(self.offset) + best, true);
        return;
      }
      var s = dr.samples;
      var last = s[s.length - 1];
      var first = s[0];
      for (var i = s.length - 1; i >= 0; i--) {
        if (e.timeStamp - s[i].t > 100) { first = s[i]; break; }
      }
      var dt = last.t - first.t;
      var velocity = dt > 0 ? (last.o - first.o) / dt : 0;  // rows per ms
      self.animateTo(Math.round(self.offset + velocity * 220), true);
    }
    el.addEventListener('pointerup', end);
    el.addEventListener('pointercancel', end);

    el.addEventListener('wheel', function (e) {
      e.preventDefault();
      self._stop();
      var dy = e.deltaMode === 1 ? e.deltaY * 16 : e.deltaY;
      var o = self.offset + dy / 80;
      if (!self.loop) o = clamp(o, -0.3, self.n - 0.7);
      self.offset = o;
      self.render();
      self.wheelTimer = setTimeout(function () {
        self.animateTo(Math.round(self.offset), true);
      }, 140);
    }, { passive: false });

    el.addEventListener('keydown', function (e) {
      var step = { ArrowUp: -1, ArrowDown: 1, PageUp: -5, PageDown: 5 }[e.key];
      if (!step) return;
      e.preventDefault();
      // Repeated presses keep stepping from where the wheel is heading, not where it is.
      var from = self.raf ? self.target : Math.round(self.offset);
      self.animateTo(from + step, true);
    });
  };

  window.WheelColumn = WheelColumn;
})();
