(() => {
  'use strict';

  const $ = (id) => document.getElementById(id);
  const state = {
    width: 8, multiplicand: 5, multiplier: 3, m: 5, negM: 0, A: 0, Q: 3, qMinus: 0,
    iteration: 0, history: [], log: [], running: false, timer: null
  };
  const els = {
    m: $('multiplicand'), q: $('multiplier'), width: $('bit-width'), error: $('input-error'),
    mPreview: $('m-preview'), qPreview: $('q-preview'), range: $('range-preview'),
    operation: $('current-operation'), q0: $('q0-bit'), qm: $('qminus-bit'),
    decisionIteration: $('decision-iteration'), progress: $('progress-bar'), marker: $('progress-marker'),
    progressLabel: $('progress-label'), log: $('operation-log'), logCount: $('log-count'),
    finalA: $('final-A'), finalQ: $('final-Q'), product: $('final-product'), result: $('decimal-result'),
    verification: $('verification'), badge: $('complete-badge'), speed: $('speed'), speedLabel: $('speed-label')
  };

  function minValue() { return -(2 ** (state.width - 1)); }
  function maxValue() { return (2 ** (state.width - 1)) - 1; }
  function mask() { return (2 ** state.width) - 1; }
  function toBits(value, width = state.width) {
    const mod = 2 ** width;
    return (value < 0 ? mod + value : value).toString(2).padStart(width, '0').slice(-width);
  }
  function signed(value, width = state.width) {
    const mod = 2 ** width;
    const normalized = ((value % mod) + mod) % mod;
    return normalized >= 2 ** (width - 1) ? normalized - mod : normalized;
  }
  function fmt(value) { return value > 0 ? `+${value}` : String(value); }

  function createBitCells(container, value, width = state.width) {
    const bits = toBits(value, width);
    container.innerHTML = '';
    [...bits].forEach((bit, index) => {
      const cell = document.createElement('span');
      cell.className = `bit-cell${index === 0 ? ' sign' : ''}`;
      cell.textContent = bit;
      cell.setAttribute('aria-label', `bit ${width - index}: ${bit}`);
      container.appendChild(cell);
    });
  }

  function validateInputs() {
    const m = Number(els.m.value), q = Number(els.q.value);
    if (!Number.isInteger(m) || !Number.isInteger(q)) return 'Enter whole numbers for both operands.';
    if (m < minValue() || m > maxValue() || q < minValue() || q > maxValue()) {
      return `Both operands must fit in ${state.width}-bit signed range (${minValue()} to ${maxValue()}).`;
    }
    return '';
  }

  function updatePreviews() {
    state.width = Number(els.width.value);
    els.range.textContent = `${minValue()} to +${maxValue()}`;
    const error = validateInputs();
    els.error.textContent = error;
    const m = Number(els.m.value), q = Number(els.q.value);
    els.mPreview.textContent = Number.isInteger(m) ? toBits(m) : '—';
    els.qPreview.textContent = Number.isInteger(q) ? toBits(q) : '—';
    return !error;
  }

  function snapshot() {
    return { A: state.A, Q: state.Q, qMinus: state.qMinus, iteration: state.iteration, log: state.log.slice() };
  }
  function restore(point) {
    Object.assign(state, point);
    render();
    renderLog();
  }

  function initialize() {
    stopAuto();
    if (!updatePreviews()) return false;
    state.multiplicand = Number(els.m.value);
    state.multiplier = Number(els.q.value);
    state.m = signed(state.multiplicand);
    state.negM = signed(-state.m);
    state.A = 0; state.Q = signed(state.multiplier); state.qMinus = 0; state.iteration = 0;
    state.history = [snapshot()]; state.log = [];
    render(); renderLog(); return true;
  }

  // One authentic Booth cycle: decide, operate modulo 2^n, then arithmetic-shift A:Q:Q-1.
  function executeStep() {
    if (state.iteration >= state.width) return false;
    state.history = state.history.slice(0, state.iteration + 1);
    const before = { A: state.A, Q: state.Q, qMinus: state.qMinus };
    const q0 = state.Q & 1;
    const pair = `${q0}${state.qMinus}`;
    let operation = 'NO OPERATION';
    if (pair === '01') { state.A = signed(state.A + state.m); operation = 'A + M'; }
    if (pair === '10') { state.A = signed(state.A + state.negM); operation = 'A − M'; }
    const afterOperation = state.A;
    const combined = ((state.A & mask()) * (2 ** (state.width + 1))) + ((state.Q & mask()) * 2) + state.qMinus;
    const shifted = Math.floor(combined / 2);
    const signExtension = afterOperation < 0 ? 2 ** (state.width * 2) : 0;
    const shiftedFull = shifted + signExtension;
    state.qMinus = (state.Q & 1);
    state.Q = signed((shiftedFull >> 1) & mask());
    state.A = signed((shiftedFull >> (state.width + 1)) & mask());
    state.iteration += 1;
    state.log.push({ iteration: state.iteration, pair, operation, beforeA: before.A, afterA: state.A, afterQ: state.Q, qMinus: state.qMinus });
    state.history.push(snapshot());
    render(); renderLog(); return true;
  }

  function render() {
    createBitCells($('register-A'), state.A);
    createBitCells($('register-Q'), state.Q);
    createBitCells($('register-M'), state.m);
    createBitCells($('register-negM'), state.negM);
    createBitCells($('register-Qminus'), state.qMinus, 1);
    $('decimal-A').textContent = fmt(state.A); $('decimal-Q').textContent = fmt(state.Q);
    $('decimal-M').textContent = fmt(state.m); $('decimal-negM').textContent = fmt(state.negM);
    $('decimal-Qminus').textContent = state.qMinus;
    els.mPreview.textContent = toBits(state.m); els.qPreview.textContent = toBits(state.multiplier);
    const q0 = state.Q & 1; els.q0.textContent = q0; els.qm.textContent = state.qMinus;
    const pair = `${q0}${state.qMinus}`;
    els.decisionIteration.textContent = state.iteration < state.width ? `ITERATION ${state.iteration + 1}` : 'COMPLETE';
    const descriptions = { '01': ['ADD M TO A', 'Q₀ and Q₋₁ are 01. Add the multiplicand M to accumulator A.'], '10': ['SUBTRACT M FROM A', 'Q₀ and Q₋₁ are 10. Subtract the multiplicand M from accumulator A.'], '00': ['NO ARITHMETIC OPERATION', 'Q₀ and Q₋₁ are 00. No addition or subtraction is required.'], '11': ['NO ARITHMETIC OPERATION', 'Q₀ and Q₋₁ are 11. No addition or subtraction is required.'] };
    const desc = descriptions[pair];
    els.operation.innerHTML = `<strong>${state.iteration >= state.width ? 'ALGORITHM COMPLETE' : desc[0]}</strong><p>${state.iteration >= state.width ? 'All iterations are complete. Inspect the final product below.' : `${desc[1]} Then perform an arithmetic right shift on A, Q and Q₋₁.`}</p>`;
    els.progress.style.width = `${(state.iteration / state.width) * 100}%`; els.marker.textContent = `${Math.round((state.iteration / state.width) * 100)}%`;
    els.progressLabel.textContent = `${state.iteration} / ${state.width} ITERATIONS`; els.logCount.textContent = `${state.log.length} CYCLES`;
    els.finalA.textContent = state.iteration === state.width ? toBits(state.A) : '—'; els.finalQ.textContent = state.iteration === state.width ? toBits(state.Q) : '—';
    const productBits = `${toBits(state.A)}${toBits(state.Q)}`;
    els.product.textContent = state.iteration === state.width ? productBits : '—';
    if (state.iteration === state.width) {
      const product = signed((state.A * 2 ** state.width) + (state.Q & mask()), state.width * 2);
      els.result.textContent = fmt(product); els.badge.textContent = 'COMPLETE'; els.badge.style.color = 'var(--green)';
      const expected = state.multiplicand * state.multiplier;
      els.verification.className = `verification ${product === expected ? 'success' : ''}`;
      els.verification.innerHTML = `<span class="verify-icon">${product === expected ? '✓' : '!'}</span><div><strong>${product === expected ? 'VERIFIED · MATCH' : 'CHECK REQUIRED'}</strong><small>Algorithm: ${product} · Ordinary: ${expected}</small></div>`;
    } else { els.result.textContent = '—'; els.badge.textContent = 'IN PROGRESS'; els.badge.style.color = 'var(--orange)'; }
    $('start').disabled = state.iteration > 0;
    $('previous').disabled = state.iteration === 0; $('next').disabled = state.iteration >= state.width;
    document.querySelectorAll('.register-row').forEach(row => row.classList.remove('active'));
    if (state.iteration < state.width) { $('register-A-row').classList.add('active'); $('register-Q-row').classList.add('active'); }
  }

  function renderLog() {
    els.log.innerHTML = state.log.length ? state.log.map((entry, index) => `<tr class="${index === state.log.length - 1 ? 'active-row' : ''}"><td>${String(entry.iteration).padStart(2, '0')}</td><td>${entry.pair}</td><td class="${entry.operation === 'A + M' ? 'op-add' : entry.operation === 'A − M' ? 'op-sub' : ''}">${entry.operation}</td><td>${toBits(entry.beforeA)}</td><td>${toBits(entry.afterA)}</td><td>${toBits(entry.afterQ)}</td><td>${entry.qMinus}</td></tr>`).join('') : '<tr class="empty-row"><td colspan="7">Start the simulation to populate the operation trace.</td></tr>';
  }

  function start() { if (state.iteration === 0) initialize(); }
  function next() { if (state.iteration < state.width) executeStep(); }
  function previous() { if (state.iteration > 0) restore(state.history[state.iteration - 1]); }
  function play() { if (state.iteration === 0 && !initialize()) return; stopAuto(); state.running = true; $('auto-play').disabled = true; $('pause').disabled = false; const tick = () => { if (!state.running || !executeStep() || state.iteration >= state.width) { stopAuto(); return; } state.timer = setTimeout(tick, 1800 - Number(els.speed.value)); }; tick(); }
  function stopAuto() { state.running = false; clearTimeout(state.timer); state.timer = null; $('auto-play').disabled = false; $('pause').disabled = true; }
  function reset() { stopAuto(); state.A = 0; state.Q = signed(Number(els.q.value) || 0); state.qMinus = 0; state.iteration = 0; state.log = []; state.history = []; updatePreviews(); render(); renderLog(); }

  $('start').addEventListener('click', start); $('next').addEventListener('click', next); $('previous').addEventListener('click', previous); $('auto-play').addEventListener('click', play); $('pause').addEventListener('click', stopAuto); $('reset').addEventListener('click', reset);
  $('load-sample').addEventListener('click', () => { els.m.value = -5; els.q.value = 3; els.width.value = 8; initialize(); });
  [els.m, els.q, els.width].forEach(input => input.addEventListener('input', () => { if (state.iteration === 0) { updatePreviews(); render(); } }));
  els.speed.addEventListener('input', () => { els.speedLabel.textContent = `${(Number(els.speed.value) / 800).toFixed(1)}×`; });
  state.m = 5; state.negM = -5; updatePreviews(); render(); renderLog();
})();
