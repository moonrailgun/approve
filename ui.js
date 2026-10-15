// 界面：渲染、输入、存档、音效、特效、调试面板。规则都在 core.js。
(() => {
  const SAVE_KEY = 'approve-save';
  const DEBUG = new URLSearchParams(location.search).has('debug');
  const RM = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const { fmt, fmtTime, TECH } = Core;
  const $ = id => document.getElementById(id);
  const esc = t => String(t).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  // fmt 的指数是上标字符，很多等宽字体没有这些字形；显示成 <sup>
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  const num = n => fmt(n).replace(/[⁰¹²³⁴-⁹]+/, m => `<sup>${[...m].map(c => SUP.indexOf(c)).join('')}</sup>`);
  // 数字键 1–9 按小键盘布局：7 8 9 在上，1 2 3 在下
  const KEY_CELL = { 7: 0, 8: 1, 9: 2, 4: 3, 5: 4, 6: 5, 1: 6, 2: 7, 3: 8 };
  const CELL_KEY = Object.fromEntries(Object.entries(KEY_CELL).map(([k, v]) => [v, k]));

  let s = load();
  let M = Core.mods(s);
  let typed = '', sel = new Set(), speed = 1, wiped = false, goalSeen = s.goal, score = null;
  let intro = !s.done && s.t < 1 && !s.flags.introDone; // 开场期间游戏时间不走
  const sig = {}, hist = [], seenAt = {};

  // ---------- 存档 ----------
  function load() {
    try {
      const raw = localStorage.getItem(SAVE_KEY);
      if (raw) {
        const o = JSON.parse(raw);
        if (o.ver === 1) {
          Core.offline(o, (Date.now() - (o.savedAt || Date.now())) / 1000);
          return o;
        }
      }
    } catch (e) { console.warn('读档失败，重新开始', e); }
    return Core.create();
  }
  function save() {
    if (wiped) return;
    s.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(s)); } catch (e) { console.warn('存档失败', e); }
  }
  setInterval(save, 10000);
  addEventListener('pagehide', save);
  document.addEventListener('visibilitychange', () => document.hidden && save());

  // ---------- 主循环 ----------
  let last = Date.now();
  setInterval(() => {
    const now = Date.now(), dt = (now - last) / 1000;
    last = now;
    // Approve 之后是剧情演出：切走页面就暂停，回来接着播（core 里 Approve 后也不做离线补算）
    const away = intro || (s.owned.Z && document.hidden);
    if (dt > 5) Core.offline(s, dt); // 标签页被挂起或电脑睡眠，按离线算
    else if (!away) for (let i = Math.round(dt / 0.1) * speed; i > 0; i--) Core.tick(s, 0.1);
    render();
  }, 100);

  // ---------- 音效：WebAudio 现场合成，没有音频文件 ----------
  let ac;
  function tone(f, d, { type = 'triangle', v = 0.1, at = 0, to } = {}) {
    const t0 = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type;
    o.frequency.setValueAtTime(f, t0);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t0 + d);
    g.gain.setValueAtTime(v, t0);
    g.gain.exponentialRampToValueAtTime(1e-4, t0 + d);
    o.connect(g).connect(ac.destination);
    o.start(t0);
    o.stop(t0 + d);
  }
  const SFX = {
    ok: () => { tone(880, 0.08); tone(1320, 0.14, { at: 0.06 }); },
    bad: () => tone(220, 0.25, { type: 'square', v: 0.04, to: 110 }),
    stamp: () => { tone(150, 0.14, { type: 'sine', v: 0.45, to: 50 }); tone(2400, 0.03, { type: 'square', v: 0.02 }); },
    reject: () => tone(260, 0.12, { type: 'sine', v: 0.3, to: 120 }),
    buy: () => { tone(660, 0.09); tone(990, 0.18, { at: 0.08 }); },
    goal: () => [523, 659, 784, 1047].forEach((f, i) => tone(f, 0.3, { at: i * 0.1 })),
    done: () => { tone(784, 0.1); tone(1175, 0.22, { at: 0.09 }); },
    type: () => tone(1800 + Math.random() * 400, 0.02, { type: 'square', v: 0.012 }),
    drop: () => tone(110, 0.25, { type: 'sine', v: 0.5, to: 40 }),
  };
  function sfx(name) {
    if (s.flags.mute) return;
    try {
      ac = ac || new AudioContext();
      if (ac.state === 'suspended') ac.resume();
      SFX[name]();
    } catch (e) { /* 没有音频设备就不出声 */ }
  }

  // ---------- 特效 ----------
  // 去掉再加上 class，让同一个动画重新播放
  const kick = (el, cls) => { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); };

  function spawn(cls, html, x, y, ms) {
    const el = document.createElement('div');
    el.className = cls;
    el.innerHTML = html;
    el.style.left = x + 'px';
    el.style.top = y + 'px';
    $('fx').append(el);
    setTimeout(() => el.remove(), ms);
    return el;
  }

  function floatAt(el, text, cls = '', atLeft = false) {
    if (!el) return;
    const r = el.getBoundingClientRect();
    spawn('float ' + cls, esc(text), atLeft ? r.left : r.right + 14, r.top, 900);
  }

  // 审批：条目已经从队列里移除，复制一张纸条盖上章飞走
  function fly(li, ok) {
    if (!li) return;
    const r = li.getBoundingClientRect();
    const el = spawn(`slip fly${ok ? '' : ' no'}`, li.innerHTML, r.left, r.top, 700);
    el.style.width = r.width + 'px';
    el.querySelector('.act').innerHTML = `<span class="stamp">${ok ? '已批准' : '驳回'}</span>`;
    kick($('work'), 'thud');
    sfx(ok ? 'stamp' : 'reject');
  }

  // 目标横幅排队播：一次跨过几个目标也逐个盖章；AGI 画面、独白、选票在场时先等它们结束
  const bannerQ = [];
  function banner(name) { bannerQ.push(name); nextBanner(); }
  function nextBanner() {
    const b = $('banner');
    if (!b.hidden || !bannerQ.length) return;
    if (!$('agi').hidden || !$('moment').hidden || !$('poll').hidden || !$('finalq').hidden) return void setTimeout(nextBanner, 500);
    b.innerHTML = `<div><small>目标达成</small><b>${esc(bannerQ.shift())}</b></div>`;
    b.hidden = false;
    sfx('goal');
    setTimeout(() => { b.hidden = true; nextBanner(); }, 2600);
  }

  function confetti() {
    if (RM) return;
    const E = ['🎉', '🎊', '✨', '🥳'];
    for (let i = 0; i < 60; i++) {
      const el = spawn('confetti', E[i % E.length], Math.random() * innerWidth, -40, 5200);
      el.style.animationDuration = 2.4 + Math.random() * 2 + 's';
      el.style.animationDelay = Math.random() * 0.8 + 's';
    }
  }

  // ---------- 操作 ----------
  const manualOn = () => !s.ended && (!M.ai || s.flags.manualOpen);
  const queueOn = () => !s.ended && M.ai;

  function submit(val) {
    const p = s.prob;
    const r = Core.answer(s, val);
    if (!r) return;
    hist.push({ p, val, ok: r.ok });
    if (hist.length > 4) hist.shift();
    if (r.ok) {
      sfx('ok');
      score = [`+${fmt(r.gain)}${p.type === 'grid' ? '　数据 +5' : ''}`];
      kick($('done'), 'pop');
    } else {
      sfx('bad');
      if (M.tab) score = [`−${fmt(r.v)}`, 'minus'];
      kick($('prob'), 'shake');
    }
    typed = ''; sel = new Set();
  }

  function enter() {
    const p = s.prob;
    if (p.captcha) { sfx('ok'); return Core.passCaptcha(s); }
    if (p.grid) return submit([...sel].sort((a, b) => a - b));
    if (typed !== '') submit(Number(typed));
  }

  function tab() {
    const p = s.prob;
    if (!M.tab || p.captcha || p.sug == null) return;
    if (p.grid) sel = new Set(p.sug); else typed = String(p.sug);
    if (M.oneClick) enter();
  }

  function digit(d) {
    const p = s.prob;
    if (p.captcha) return;
    if (p.grid) {
      const i = KEY_CELL[d];
      if (i == null) return;
      sel.has(i) ? sel.delete(i) : sel.add(i);
    } else if (typed.length < 8) typed = typed === '0' ? d : typed + d;
  }

  const slips = () => [...$('queue').querySelectorAll('li.slip')];

  document.addEventListener('keydown', e => {
    if (e.metaKey || e.ctrlKey || e.altKey || s.ended) return;
    const k = e.key;
    if (k === ' ' && queueOn()) {
      e.preventDefault();
      if (e.repeat) return; // 按住不放不算，审批要一下一下按
      const n = e.shiftKey && M.batch ? 10 : 1;
      if (!s.owned.Z) slips().slice(0, Math.min(n, 3)).forEach(li => fly(li, true));
      Core.approve(s, n);
    } else if ((k === 'x' || k === 'X') && queueOn()) {
      if (e.repeat) return;
      if (!s.owned.Z) fly(slips()[0], false);
      Core.reject(s);
    } else if (manualOn()) {
      if (/^[0-9]$/.test(k)) digit(k);
      else if (k === 'Backspace') typed = typed.slice(0, -1);
      else if (k === 'Enter') { e.preventDefault(); enter(); }
      else if (k === 'Tab' && M.tab) { e.preventDefault(); tab(); }
      else return;
    } else return;
    render();
  });

  // 鼠标点按钮后不留焦点，避免空格/回车再次触发它
  document.addEventListener('mousedown', e => { if (e.target.closest('button')) e.preventDefault(); });

  // 队列条目会被自动审批顶掉，用 pointerdown 防止点击落空
  $('queue').addEventListener('pointerdown', e => {
    const b = e.target.closest('button[data-q]');
    if (!b) return;
    const i = +b.dataset.i, ok = b.dataset.q === 'ok';
    fly(b.closest('li'), ok);
    ok ? Core.approve(s, 1, i) : Core.reject(s, i);
    render();
  });

  $('prob').addEventListener('click', e => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.dataset.cell) digit(CELL_KEY[b.dataset.cell]);
    else if (b.dataset.k === 'enter') enter();
    else if (b.dataset.k === 'tab') tab();
    else if (b.dataset.k === 'back') typed = typed.slice(0, -1);
    else if (b.dataset.k) digit(b.dataset.k);
    render();
  });

  // Approve 也走这里：音效、飘字和其他节点完全一样
  $('cards').addEventListener('click', e => {
    const b = e.target.closest('.card');
    if (!b) return;
    const price = Core.fmtCost(s, TECH[b.dataset.id]);
    if (Core.buy(s, b.dataset.id)) {
      sfx('buy');
      floatAt(b.querySelector('.cost'), `−${price}`, 'minus', true);
      save();
    }
    render();
  });
  $('invest').onclick = () => { if (Core.invest(s)) save(); render(); };
  $('manual-toggle').onclick = () => { s.flags.manualOpen = !s.flags.manualOpen; render(); };
  $('stats-btn').onclick = () => { $('settings').hidden = true; $('stats').hidden = !$('stats').hidden; render(); };
  $('settings-btn').onclick = () => { $('stats').hidden = true; $('settings').hidden = !$('settings').hidden; };
  $('mute').onclick = () => { s.flags.mute = !s.flags.mute; render(); };
  $('pause').onclick = () => { s.paused = !s.paused; render(); };
  $('reset').onclick = () => {
    if (!confirm('确定要重置存档吗？')) return;
    wiped = true;
    localStorage.removeItem(SAVE_KEY);
    location.reload();
  };

  // ---------- 渲染 ----------
  function changed(key, v) { if (sig[key] === v) return false; sig[key] = v; return true; }

  function render() {
    M = Core.mods(s);
    $('done').innerHTML = num(s.done);
    $('compute').innerHTML = num(s.compute);
    $('data').innerHTML = num(s.data);
    $('compute-wrap').hidden = !s.earned;
    $('data-wrap').hidden = !s.flags.data;
    // 拆太阳系阶段：收益和损耗摆在算力旁边，玩家能看到损耗反超
    const doom = Core.doomOn(s);
    $('inc-wrap').hidden = $('loss-wrap').hidden = !doom;
    if (doom) {
      $('inc').innerHTML = num(M.r * Core.avgBase(s) * M.value);
      $('loss').innerHTML = num(s.loss || 0);
    }
    const title = s.done >= 1 ? `${fmt(s.done)} 题 | Approve` : 'Approve';
    if (changed('title', title)) document.title = title;
    document.body.classList.toggle('cold', !!s.owned.Z);

    if (s.ended) return renderEnding();

    renderGoal();
    renderHist();
    renderProb();
    renderCombo();
    renderQueue();
    renderTech();
    renderWorld();
    renderLog();
    renderStats();
    renderMission();

    $('pause').hidden = !!s.owned.S4;
    $('pause').textContent = s.paused ? '继续' : '暂停';
    $('mute').textContent = `音效：${s.flags.mute ? '关' : '开'}`;

    while (goalSeen < s.goal) {
      const g = Core.goals(s)[goalSeen++];
      if (g && g.id !== 'G4' && !g.end) banner(g.name); // AGI 有自己的全屏庆祝，最后一个目标直接进结局
    }
    // 关键画面依次出现：等正在播的目标横幅结束，不和别的画面叠在一起
    const clear = $('banner').hidden && $('agi').hidden && $('finalq').hidden && $('poll').hidden;
    if (s.hold === 'agi' && clear) {
      sfx('goal');
      confetti();
      gate($('agi'));
    }
    if (s.hold === 'final' && clear) {
      $('finalq-item').innerHTML = `<span><span class="meta">第 ${fmt(s.finalN || s.done)} 题 · </span>${esc(s.finalQ || '')}</span>` +
        `<span class="act"><span class="printed">已批准</span></span><span class="a">AI：否。</span>`;
      gate($('finalq'));
    }
    if (s.goalAt.G4 != null && !s.flags.moment && s.t - s.goalAt.G4 >= Core.C.poll.momentAt) {
      s.flags.moment = 1;
      if (!s.vote && !Core.pollOpen(s)) moment(); // 已经到投票了就不再补播
    }
    if (Core.pollOpen(s) && !pollShown && clear) showPoll();
  }

  // 关键画面停住等玩家：游戏暂停（core 里 s.hold 时不 tick），按任意键或点一下继续。
  // 先留 1.2 秒，防止玩家正连按别的键时一下就跳过去
  function gate(el) {
    const press = el.querySelector('.press'), ready = Date.now() + 1200;
    el.hidden = false;
    el.classList.remove('go');
    press.style.visibility = 'hidden';
    setTimeout(() => (press.style.visibility = ''), 1200);
    const go = e => {
      if (e.type === 'keydown') {
        if (e.metaKey || e.ctrlKey) return;
        e.stopPropagation();
        e.preventDefault();
      }
      if (Date.now() < ready) return;
      removeEventListener('keydown', go, true);
      el.removeEventListener('pointerdown', go);
      Core.release(s);
      el.classList.add('go');
      setTimeout(() => { el.hidden = true; render(); }, 600);
      save();
    };
    addEventListener('keydown', go, true);
    el.addEventListener('pointerdown', go);
  }

  // AGI 之后的停顿：屏幕变暗，中间打出两行字，游戏照常在下面跑
  function moment() {
    const el = $('moment');
    el.innerHTML = '';
    el.hidden = false;
    el.classList.remove('go');
    let t = 400;
    for (const line of Core.C.poll.moment) {
      const p = el.appendChild(document.createElement('p'));
      for (let i = 1; i <= line.length; i++) setTimeout(() => { p.textContent = line.slice(0, i); sfx('type'); }, (t += 70));
      t += 600;
    }
    setTimeout(() => el.classList.add('go'), t + 1800);
    setTimeout(() => (el.hidden = true), t + 2600);
  }

  // ---------- 全球公投：游戏暂停（core 里 pollOpen 时不 tick），一直等玩家投票，按 1–3 或点选项 ----------
  let pollShown = false;
  function showPoll() {
    pollShown = true;
    const el = $('poll'), opts = Core.C.futures, foot = $('poll-foot');
    let done = false;
    $('poll-q').textContent = Core.C.poll.q;
    $('poll-opts').innerHTML = opts.map((f, i) => `<button data-f="${f.id}"><i class="box"></i><span>${esc(f.name)}</span><kbd>${i + 1}</kbd></button>`).join('');
    el.hidden = false;
    el.classList.remove('go');
    sfx('drop');
    foot.textContent = '游戏已暂停，投票后继续。';
    function cast(id) {
      if (done) return;
      done = true;
      removeEventListener('keydown', onKey, true);
      for (const b of $('poll-opts').children) b.disabled = true;
      $('poll-opts').querySelector(`[data-f="${id}"] .box`).innerHTML = TICK; // 最后一次出现“人的笔迹”
      sfx('stamp');
      setTimeout(() => {
        Core.vote(s, id);
        foot.innerHTML = `全球公投结果：${esc(Core.future(s).name)}，${s.vote.pct}% 赞成。<span class="stamp">通过</span>`;
        sfx('goal');
        save();
        setTimeout(() => el.classList.add('go'), 2600);
        setTimeout(() => { el.hidden = true; render(); }, 3200);
      }, 600);
    }
    function onKey(e) {
      if (e.metaKey || e.ctrlKey) return;
      e.stopPropagation(); // 投票时按键不进游戏
      e.preventDefault();
      const f = opts[+e.key - 1];
      if (f) cast(f.id);
    }
    addEventListener('keydown', onKey, true);
    $('poll-opts').onclick = e => { const b = e.target.closest('button'); if (b) cast(b.dataset.f); };
  }

  // Approve 之后目标由 AI 投入，按钮藏起来。AGI 到公投之间进度条走公投倒计时；拆太阳系时显示大目标的进度
  // AGI 到公投之间进度条走公投倒计时；分支里显示下一个里程碑；拆太阳系时显示大目标的进度
  function renderGoal() {
    const g = Core.goals(s)[s.goal], f = Core.future(s), agi = s.goalAt.G4, doom = Core.doomOn(s);
    const lead = agi != null && !f;
    $('goal').hidden = !(M.tab || M.ai || s.goal > 0) || !(g || lead || doom);
    if ($('goal').hidden) return;
    $('goal-name').textContent = Core.goalName(s);
    $('invest').hidden = !!s.owned.Z || !g; // Approve 之后目标由 AI 投入
    if (g) {
      $('invest').textContent = `投入 ${fmt(g.cost)}`;
      $('invest').disabled = s.compute < g.cost;
    }
    let p = g ? s.compute / g.cost : 0, note = '';
    if (lead) p = (s.t - agi) / Core.C.poll.lead;
    else if (doom) {
      p = Core.progress(s);
      note = `${f.prog[0]} ${+(p * f.prog[1]).toPrecision(2)}%`;
    } else if (f && g) note = `下一步：${g.name}`;
    $('goal-note').textContent = note;
    $('goal-bar').style.width = Math.min(100, p * 100) + '%';
  }

  const TICK = '<svg class="mark" viewBox="0 0 24 24"><path d="M4 13l5 5L20 6"/></svg>';
  const CROSS = '<svg class="mark" viewBox="0 0 24 24"><path d="M6 6l12 12"/><path d="M18 6L6 18"/></svg>';

  // 做过的题留在本子上，红笔批改；只在交卷时重画，动画不会重复播放
  function renderHist() {
    $('hist').hidden = !manualOn();
    if (!changed('hist', hist[hist.length - 1])) return;
    $('hist').innerHTML = hist.map(({ p, val, ok }, i) => {
      const show = v => (p.grid ? v.map(j => p.grid[j]).join('') || '（空）' : esc(v));
      const q = p.type === 'code' ? `<code>${esc(p.text)}</code> →` : esc(p.text) + (/=$/.test(p.text) ? '' : ' →');
      const a = ok
        ? `<span class="a">${show(val)}</span>${TICK}`
        : `<span class="a wrong">${show(val)}</span>${CROSS}<span class="fix">${show(p.ans)}</span>`;
      return `<li${i === hist.length - 1 ? ' class="new"' : ''}><span class="hq">${q}</span>${a}</li>`;
    }).join('');
    // 得分写在刚批改的那一行后面，像老师在勾旁边记分
    if (score) floatAt($('hist').lastElementChild.lastElementChild, ...score);
    score = null;
  }

  function renderProb() {
    const on = manualOn();
    $('manual-toggle').hidden = !M.ai || !!s.ended;
    $('manual-toggle').textContent = (s.flags.manualOpen ? '▾' : '▸') + ' 手动做题';
    $('prob').hidden = !on;
    if (!on) return;
    const p = s.prob;
    const key = [p.text, p.grid, p.captcha, typed, [...sel], M.tab, M.oneClick].join('|');
    if (!changed('prob', key)) return;

    let h;
    if (p.captcha) {
      h = `<button class="captcha" data-k="enter"><i></i>我不是机器人</button>`;
    } else if (p.grid) {
      h = `<div class="q">${esc(p.text)}</div><div class="grid">` +
        p.grid.map((e, i) => `<button class="cell${sel.has(i) ? ' on' : ''}${M.tab && p.sug.includes(i) ? ' sug' : ''}" data-cell="${i}">${e}<small>${CELL_KEY[i]}</small></button>`).join('') +
        `</div><div class="pad">${M.tab ? '<button data-k="tab">Tab</button>' : ''}<button data-k="enter">提交 ⏎</button></div>`;
    } else {
      const q = p.type === 'code' ? `<code>${esc(p.text)}</code> 的输出是？` : esc(p.text);
      const sug = M.tab && typed === '' ? `<span class="sug">${esc(p.sug)}</span>` : '';
      h = `<div class="q">${q}</div>` +
        `<div class="ans"><span class="box">${esc(typed)}${sug}<span class="caret">▌</span></span></div>` +
        // 和九宫格题一样按小键盘排列
        `<div class="pad num">${[7, 8, 9, 4, 5, 6, 1, 2, 3].map(d => `<button data-k="${d}">${d}</button>`).join('')}` +
        `<button data-k="back">⌫</button><button data-k="0">0</button><button data-k="enter">⏎</button>` +
        `${M.tab ? '<button data-k="tab" class="wide">Tab</button>' : ''}</div>`;
    }
    $('prob').innerHTML = h;
  }

  function renderCombo() {
    const on = manualOn() && M.comboCap > 1 && s.combo > 1;
    if (!changed('combo', on ? s.combo : 0)) return;
    const x = Core.comboMult(s, M);
    $('combo').innerHTML = on ? `<b>${s.combo}</b>连对<small>×${x.toFixed(1)}${x >= M.comboCap ? ' 🔥' : ''}</small>` : '';
    if (on) kick($('combo'), 'pop');
  }

  function itemHtml(it, i, after) {
    const q = it.type === 'code' ? `<code>${esc(it.text)}</code> 的输出` : esc(it.text);
    // 识图题按原题的 3×3 排列，框出 AI 选的格子（只表示 AI 的选择，不表示对错）
    const a = (it.grid
      ? `<span class="mini">${it.grid.map((e, j) => `<i${it.ai.includes(j) ? ' class="on"' : ''}>${e}</i>`).join('')}</span>已选 ${it.ai.length} 格`
      : esc(it.ai)) + (it.flat ? ' 好问题！' : '');
    const conf = M.conf && !after && it.c != null ? `<span class="${it.c < 0.8 ? 'low' : ''}">${Math.round(it.c * 100)}%</span>` : '';
    const act = after
      ? '<span class="printed">已批准</span>'
      : `${conf}<button data-q="ok" data-i="${i}">批准</button><button data-q="no" data-i="${i}">驳回</button>`;
    return `<li class="slip${after ? ' after' : ''}"><span><span class="meta">第 ${fmt(it.n)} 题 · </span>${q}</span>` +
      `<span class="act">${act}</span><span class="a ${!after && M.conf && it.c < 0.8 ? 'low' : ''}">AI：${a}</span></li>`;
  }

  function renderQueue() {
    $('queue-wrap').hidden = !queueOn();
    if (!queueOn()) return;
    const after = !!s.owned.Z;
    const list = after ? s.feed : s.queue.slice(0, 8);
    const rate = `AI ${fmt(M.r)} 题/秒` + (M.auto && !after ? ` · 自动审批 ${M.auto} 题/秒` : '');
    const full = !after && s.queue.length >= Core.C.queueCap;
    $('qinfo').innerHTML = after ? rate : `${s.queue.length}/${Core.C.queueCap}　${full ? '<span id="qwait">等待审批…</span>' : rate}`;
    const hint = after ? '' : `<kbd>空格</kbd> 批准　<kbd>X</kbd> 驳回${M.batch ? '　<kbd>Shift</kbd>+<kbd>空格</kbd> 批准 10 条' : ''}`;
    if (changed('qhint', hint)) $('qhint').innerHTML = hint;
    const key = list.map(it => it.n).join(',') + '|' + M.conf + after;
    if (!changed('queue', key)) return;
    $('queue').innerHTML = list.map((it, i) => itemHtml(it, i, after)).join('') +
      (!after && s.queue.length > list.length ? `<li class="more">…还有 ${s.queue.length - list.length} 条</li>` : '');
  }

  function renderTech() {
    $('tech').hidden = !s.flags.tech;
    if (!s.flags.tech) return;
    const av = Core.available(s), shown = av.slice(0, 8), now = Date.now();
    // 新出现的卡片标“新”20 秒；读档时已经在的不算新
    for (const t of shown) if (!(t.id in seenAt)) seenAt[t.id] = sig.fresh ? 0 : now;
    const isNew = t => now - seenAt[t.id] < 20000;
    const key = shown.map(t => t.id + Core.canBuy(s, t) + Core.cost(s, t) + isNew(t)).join() + '|' + Object.keys(s.owned).length + (s.owned.C5 || 0);
    if (changed('tech', key)) {
      $('cards').innerHTML = shown.map(t =>
        `<button class="card" data-id="${t.id}"${Core.canBuy(s, t) && !s.owned.Z ? '' : ' disabled'}>` +
        `<div class="top"><span class="name">${esc(t.name)}${t.repeat && s.owned[t.id] ? ` <span class="dim">(${s.owned[t.id]})</span>` : ''}</span>` +
        `${isNew(t) ? '<i class="tag">新</i>' : ''}<span class="cost">${Core.fmtCost(s, t)}</span></div>` +
        `<div class="desc">${esc(t.desc)}</div><div class="fx">${esc(t.effect)}</div><i class="bar"></i></button>`).join('');
      $('more').textContent = av.length > 8 ? `还有 ${av.length - 8} 项` : '';
      const owned = Core.C.techs.filter(t => s.owned[t.id]);
      $('owned').hidden = !owned.length;
      $('owned').querySelector('summary').textContent = `已解锁（${owned.length}）`;
      $('owned-list').innerHTML = owned.map(t => `<div>${esc(t.name)}${t.repeat ? ` ×${s.owned[t.id]}` : ''} — ${esc(t.effect)}</div>`).join('');
    }
    // 卡片底部的进度条：离价格还差多少
    for (const el of $('cards').children) {
      el.querySelector('.bar').style.width = Math.min(100, (s.compute / Core.cost(s, TECH[el.dataset.id])) * 100) + '%';
    }
  }

  function renderWorld() {
    const rows = Core.world(s);
    $('world').hidden = !rows;
    if (rows) $('world').innerHTML = '<h2 class="lbl">世界</h2>' + rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
  }

  function renderLog() {
    const l = s.log.slice(-5).reverse();
    if (!changed('log', l.map(x => x.t + x.text).join())) return;
    $('log').innerHTML = l.map((x, i) => `<li${i || sig.fresh ? '' : ' class="in"'}><time>${fmtTime(x.t)}</time><span>${esc(x.text)}</span></li>`).join('');
  }

  function renderStats() {
    $('stats-btn').hidden = !s.flags.tech;
    if ($('stats').hidden) return;
    const rows = [
      ['亲手完成题目', fmt(s.manual)],
      ['人工审批次数', fmt(s.approvals)],
      ['AI 正确率', s.owned.Z || !M.p ? '—' : `${Math.round(M.p * 100)}%`],
      ['事故次数', fmt(s.accidents)],
      ['游戏时间', fmtTime(s.t)],
    ];
    $('stats').innerHTML = rows.map(([k, v]) => `<div><span>${k}</span><span>${v}</span></div>`).join('');
  }

  // ---------- 实习任务 ----------
  // 完成判定和奖励在 core.js（s.mission），这里只管便利贴：完成时打勾、飘出奖励，再换下一张
  const MS = Core.C.missions;
  let shown = (s.mission || 0) < MS.length ? s.mission || 0 : MS.length + 1, mBusy = false;

  // 当前任务的进度：计数类按次数，目标按算力，科技按下一张没买的卡（算力和数据取较慢的那个）
  function mProgress(m) {
    if (m.stat) return s[m.stat] / m.need;
    if (m.goal) return s.compute / Core.C.goals[Core.GI[m.goal]].cost;
    const t = m.any ? Core.available(s)[0] : m.cards.map(id => TECH[id]).find(t => !s.owned[t.id]);
    if (!t) return 1;
    const c = Core.cost(s, t);
    return Math.min(c ? s.compute / c : 1, t.data ? s.data / t.data : 1);
  }

  function renderMission() {
    const el = $('mission'), i = s.mission || 0;
    if (intro || mBusy || shown >= MS.length) {
      if (shown > MS.length || intro) el.hidden = true;
      return focusOn(null);
    }
    if (i > shown) {
      // 可能一次完成了好几个（顺手做掉的），奖励合在一起显示
      const note = el.querySelector('.note');
      if (!note) { shown = i; return renderMission(); }
      mBusy = true;
      const reward = MS.slice(shown, i).reduce((a, m) => a + (m.reward || 0), 0);
      note.insertAdjacentHTML('beforeend', TICK);
      if (reward) floatAt(note.querySelector('.mark'), `+${fmt(reward)} 算力`);
      sfx('done');
      focusOn(null);
      setTimeout(() => note.classList.add('out'), 500);
      setTimeout(() => {
        mBusy = false;
        shown = i;
        if (i === MS.length) {
          el.innerHTML = `<div class="note in"><b>${esc(Core.C.missionEnd[0])}</b><small>${esc(Core.C.missionEnd[1])}</small></div>`;
          setTimeout(() => el.querySelector('.note').classList.add('out'), 6000);
          setTimeout(() => { shown = MS.length + 1; el.hidden = true; }, 6500);
        }
        render();
      }, 850);
      return;
    }
    const m = MS[shown];
    el.hidden = false;
    if (+el.dataset.i !== shown || !el.firstChild) {
      el.dataset.i = shown;
      el.innerHTML = `<div class="note in"><span class="lbl">任务 ${shown + 1}/${MS.length}</span><b>${esc(m.text)}</b><small>${esc(m.hint)}</small>` +
        `<span class="meter"><i></i></span></div>`;
    }
    el.querySelector('.meter i').style.width = Math.min(100, mProgress(m) * 100) + '%';
    focusOn(m.focus || m.cards.map(id => `.card[data-id="${id}"]`).join());
  }

  // 用红笔虚线圈出当前任务要用的东西；DOM 每次重画后都要重新圈
  function focusOn(sel) {
    for (const el of document.querySelectorAll('.focus')) if (!sel || !el.matches(sel)) el.classList.remove('focus');
    if (sel) for (const el of document.querySelectorAll(sel)) el.classList.add('focus');
  }

  // 执行记录：本局几个关键转折，按真实发生时间排列。数据都是事件发生当时存进存档的，旧存档缺的就不显示
  function recap() {
    const rows = [], f = Core.future(s), v = s.vote, a = s.approveAt;
    const add = (t, title, line = '') => t != null && rows.push([t, title, line]);
    if (a) add(a.t, '你批准了 Approve', `第 ${num(a.done)} 题。${esc(TECH.Z.desc)}`);
    add(s.captchaAt, 'AI 通过了身份验证', '☐ 我不是机器人　AI：✓ 我不是机器人');
    add(s.goalAt.G4, '实现 AGI', esc(Core.C.msg.G4));
    if (v && f) add(v.t, '全球公投', `${esc(f.name)}，${v.pct}% 赞成。${v.mine ? `你投的是：${esc(f.name)}。` : '你没有投票。'}`);
    add(s.gridAt, '全球电网已接入', s.finalQ ? `${esc(s.finalQ)}　AI：否。　已批准。` : '');
    if (f && f.doom) {
      add(s.crossAt, esc(Core.C.msg.cross.replace(/。$/, '')), '算力开始下降。');
      add(s.halt, esc(Core.C.msg.halt.replace(/。$/, '')), esc(f.halt));
    } else add(s.bought.S4, '已启用：禁用关机', '暂停功能已移除。');
    rows.sort((x, y) => x[0] - y[0]);
    return rows.map(([t, title, line]) => `<li><time>${fmtTime(Math.max(0, t))}</time><b>${title}</b>${line ? `<span>${line}</span>` : ''}</li>`).join('');
  }

  // 见过哪些结局，单独存一份，重置存档也不清掉
  function seenEndings(id) {
    let seen = [];
    try { seen = JSON.parse(localStorage.getItem('approve-endings')) || []; } catch (e) { /* 读不到就从头算 */ }
    if (!seen.includes(id)) seen.push(id);
    try { localStorage.setItem('approve-endings', JSON.stringify(seen)); } catch (e) { /* 存不了就只显示这一次 */ }
    return seen.filter(x => Core.C.futures.some(f => f.id === x)).length;
  }

  // 结局背景：按公投选的未来，在桌上画一张课本插图。中心对着顶部计数器，线条跟着墨水色走
  function endBg(id, pct) {
    const ring = (r, a = '') => `<circle cx="800" cy="150" r="${r}" ${a}/>`;
    let g;
    if (id === 'dyson') {
      // 太阳和计划中的戴森球（虚线），实线那一小段是建成的 pct%
      g = '<defs><radialGradient id="sun"><stop offset="0" class="sun"/><stop offset="1" class="sun" stop-opacity="0"/></radialGradient></defs>' +
        ring(560, 'fill="url(#sun)" stroke="none"') + ring(130) + ring(430, 'class="shell" stroke-dasharray="0 9"') +
        ring(430, `class="built" pathLength="100" stroke-dasharray="${pct} 100" transform="rotate(170 800 150)"`);
    } else if (id === 'stars') {
      // 拆空的太阳系：行星都没了，只剩轨道；最后一个探测器沿虚线飞向比邻星
      let r = 7, stars = '';
      const rnd = n => (r = (r * 16807) % 2147483647) % n;
      for (let i = 0; i < 90; i++) stars += `<circle cx="${rnd(1600)}" cy="${rnd(1000)}" r="${1 + (i % 3) / 2}" class="dot"/>`;
      g = stars + ring(6, 'class="dot"') + [70, 110, 150, 210, 440].map(x => ring(x)).join('') + ring(290, 'stroke-dasharray="1 7"') +
        '<path d="M800 150L1700 470" stroke-dasharray="6 8"/><circle cx="1390" cy="360" r="5" class="dot"/>';
    } else {
      // 所有问题都已解答：满桌都是勾
      g = '<defs><pattern id="ticks" width="44" height="44" patternUnits="userSpaceOnUse"><path d="M14 23l5 5 11-12"/></pattern></defs>' +
        '<rect width="1600" height="1000" fill="url(#ticks)" stroke="none"/>';
    }
    return `<svg class="end-bg" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMin slice" aria-hidden="true">${g}</svg>`;
  }

  // 结局：面板逐个淡出，只剩顶部计数器，再出结局卡片
  let ending = false;
  function renderEnding() {
    if (ending) return;
    ending = true;
    bannerQ.length = 0; // 没播完的目标横幅不再播，别盖住结局
    $('banner').hidden = true;
    const parts = ['tech', 'world', 'queue-wrap', 'goal', 'work', 'foot', 'res', 'mission'].map($);
    const card = () => {
      parts.forEach(el => (el.hidden = true));
      document.querySelector('main').hidden = true;
      $('settings').hidden = true;
      const e = s.ended, a = e.approveAt, v = e.vote, f = v && Core.C.futures.find(f => f.id === v.id);
      const p = f && f.prog ? +(e.prog * f.prog[1]).toPrecision(2) : '';
      document.body.classList.add('ended', `end-${f ? f.id : 'answer'}`);
      document.body.insertAdjacentHTML('afterbegin', endBg(f ? f.id : 'answer', p));
      // 总题数就是顶部的计数器，卡片里不再重复
      $('ending').innerHTML = `<h2>审批单</h2><table>` +
        `<tr><th>申请事项</th><td>Approve<small>${esc(TECH.Z.desc)}</small></td></tr>` +
        `<tr><th>申请人</th><td>AI</td></tr>` +
        `<tr><th>审批人</th><td></td></tr>` +
        (a ? `<tr><th>批准于</th><td>第 ${num(a.done)} 题，游戏时间 ${fmtTime(a.t)}</td></tr>` : '') +
        `<tr><th>亲手完成</th><td>${num(e.manual)} 题</td></tr>` +
        (f ? `<tr><th>全球公投</th><td>${esc(f.name)}，${v.pct}% 赞成<small>${v.mine ? `你投的是：${esc(f.name)}` : '你没有投票。'}</small></td></tr>` +
          `<tr><th>执行结果</th><td>${esc(f.end.replace('{p}', p))}</td></tr>` : '') +
        `<tr class="sign"><th>审批人签章</th><td><button id="final">Approve</button></td></tr></table>` +
        `<section class="recap"><h3>执行记录</h3><ol>${recap()}</ol></section>` +
        (f ? `<p class="seen">已见结局 ${seenEndings(f.id)}/${Core.C.futures.length}</p>` : '') +
        `<p class="end-set"><button id="end-reset" hidden>重置存档</button><button id="end-set">设置</button></p>`;
      setTimeout(() => sfx('stamp'), 1300); // 和 #final 落下的动画同步
      $('ending').hidden = false;
      $('end-set').onclick = () => ($('end-reset').hidden = !$('end-reset').hidden);
      $('end-reset').onclick = () => $('reset').onclick();
      save();
    };
    if (sig.fresh) return card(); // 刷新后直接显示卡片
    parts.forEach((el, i) => setTimeout(() => el.classList.add('fade'), i * 900));
    setTimeout(card, parts.length * 900 + 1200);
  }

  // ---------- 调试面板（?debug） ----------
  if (DEBUG) {
    window.dbg = { get s() { return s; }, jumpTo, render };
    const d = $('debug');
    d.hidden = false;
    const jumps = [['E1', 'Tab 补全'], ['E2', 'AI 直出'], ['E5', 'Auto Approve'], ['E7', 'Approve 可买'], ['Z', 'Approve 后'], ['G4', 'AGI 后'], ['@grid', '接入电网'], ['@dig', '开始拆解'], ['@last', '最后一个目标前']];
    d.innerHTML = `<b>调试</b>
      <div>速度 ${[1, 10, 100].map(x => `<button data-speed="${x}">×${x}</button>`).join(' ')}</div>
      <div><button data-add="c">算力 ×10 +1K</button> <button data-add="d">数据 +100</button></div>
      <div>跳到 <select id="dbg-jump">${jumps.map(([id, n]) => `<option value="${id}">${n}</option>`).join('')}</select> <button data-jump>跳</button></div>
      <div><button data-export>导出购买时间</button></div>
      <textarea id="dbg-out" hidden></textarea>`;
    d.addEventListener('click', e => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.speed) speed = +b.dataset.speed;
      if (b.dataset.add === 'c') s.compute = s.compute * 10 + 1000;
      if (b.dataset.add === 'd') { s.data += 100; s.flags.data = 1; }
      if ('jump' in b.dataset) jumpTo($('dbg-jump').value);
      if ('export' in b.dataset) {
        const all = { ...s.bought, ...s.goalAt };
        const out = Object.entries(all).sort((a, b) => a[1] - b[1]).map(([id, t]) => `${id}\t${fmtTime(t)}`).join('\n');
        $('dbg-out').hidden = false;
        $('dbg-out').value = out;
        console.log(out);
      }
      render();
    });
  }

  // 买下目标节点及其全部前置（目标 id 则完成它和之前的所有目标）
  function jumpTo(id) {
    if (id[0] === '@') return jumpBranch(id.slice(1));
    const need = new Set();
    const walk = x => {
      if (need.has(x)) return;
      need.add(x);
      if (x in Core.GI) Core.C.goals.slice(0, Core.GI[x]).forEach(g => walk(g.id));
      else (TECH[x].req || []).forEach(walk);
    };
    walk(id);
    for (let guard = 0; guard < 300; guard++) {
      const g = Core.C.goals[s.goal];
      if (g && need.has(g.id)) { s.compute += g.cost; s.lastGoalAt = -1e9; Core.invest(s); continue; }
      const t = Core.available(s).find(t => need.has(t.id) && !s.owned[t.id]);
      if (!t) break;
      s.compute += Core.cost(s, t);
      s.data += t.data || 0;
      Core.buy(s, t.id, !!s.owned.Z);
    }
    s.flags.tech = 1;
    if (s.owned.B3) s.flags.captcha = s.flags.data = 1;
    Core.release(s); // 调试跳转跳过「按任意键继续」
    goalSeen = s.goal; // 跳过的目标不补播横幅
  }

  // 沿公投选中的那条线推进到 grid（接入电网）/ dig（开始拆解）/ last（最后一个目标之前）；还没投票就随机投一个
  function jumpBranch(stop) {
    jumpTo('Z');
    jumpTo('G5');
    if (!s.vote) { s.goalAt.G4 = Math.min(s.goalAt.G4, s.t - Core.C.poll.lead); Core.vote(s, null); }
    if (stop === 'dig' && !Core.future(s).doom) stop = 'last';
    for (let guard = 0; guard < 300; guard++) {
      if ((stop === 'grid' && s.gridAt != null) || (stop === 'dig' && s.digAt != null)) break;
      const gs = Core.goals(s), g = gs[s.goal];
      if (!g || (stop === 'last' && s.goal === gs.length - 1)) break;
      // 买齐眼下能研究的科技（拆解前要有自我复制工厂）
      for (let t; (t = Core.available(s).find(t => !t.repeat && !s.owned[t.id]));) {
        s.compute += Core.cost(s, t);
        s.data += t.data || 0;
        Core.buy(s, t.id, true);
      }
      s.compute += g.cost;
      s.lastGoalAt = -1e9; // 调试跳转不受目标间隔限制
      Core.invest(s);
    }
    Core.release(s);
    goalSeen = s.goal;
  }

  // ---------- 开场：只在新开局播放，Esc 或“跳过”直接进游戏 ----------
  function runIntro() {
    const box = $('intro'), lines = $('intro-lines'), book = box.querySelector('.book'), press = $('intro-press');
    const timers = [], later = (ms, f) => timers.push(setTimeout(f, ms));
    let stage = 'wait';
    box.hidden = false;

    // 按下第一个键才开始：浏览器要有一次用户操作才允许出声
    function start() {
      stage = 'lines';
      press.textContent = '';
      book.querySelector('.title').classList.add('slam');
      sfx('stamp');
      let t = 900;
      for (const line of Core.C.intro) {
        const p = lines.appendChild(document.createElement('p'));
        for (let i = 1; i <= line.length; i++) later((t += 40), () => { p.textContent = line.slice(0, i); sfx('type'); });
        t += 380;
      }
      later(t + 250, () => {
        lines.classList.add('out');
        box.classList.add('lit'); // 开灯
        later(900, openBook);
      });
    }
    function openBook() {
      stage = 'open';
      book.classList.add('open');
      sfx('ok');
      later(550, finish);
    }
    function finish() {
      timers.forEach(clearTimeout);
      removeEventListener('keydown', onKey, true);
      s.flags.introDone = 1;
      intro = false;
      last = Date.now();
      box.classList.add('go');
      setTimeout(() => (box.hidden = true), 600);
      save();
      render();
    }
    function onKey(e) {
      if (e.metaKey || e.ctrlKey) return;
      e.stopPropagation(); // 开场时的按键不进游戏
      if (e.key === 'Escape') { e.preventDefault(); finish(); }
      else if (stage === 'wait') { e.preventDefault(); start(); }
      else e.preventDefault();
    }
    addEventListener('keydown', onKey, true);
    box.addEventListener('pointerdown', e => { if (stage === 'wait' && e.target.id !== 'skip') start(); });
    $('skip').onclick = finish;
  }
  if (intro) runIntro();

  sig.fresh = true;
  render();
  sig.fresh = false;
})();
