// 纯游戏逻辑，不碰 DOM。浏览器里是全局 Core，Node 里 require('./core.js')。
const Core = (() => {
  const C = typeof CONFIG !== 'undefined' ? CONFIG : require('./config.js');
  const TECH = Object.fromEntries(C.techs.map(t => [t.id, t]));
  const GI = Object.fromEntries(C.goals.map((g, i) => [g.id, i]));
  for (const f of C.futures) f.goals.forEach((g, i) => (g.id ||= `${f.id}${i + 1}`));
  const api = { rand: Math.random, C, TECH };
  const R = () => api.rand();
  const ri = (a, b) => a + Math.floor(R() * (b - a + 1));
  const pick = a => a[Math.floor(R() * a.length)];

  // ---------- 出题 ----------
  const TARGETS = [['🚦', '红绿灯'], ['🚗', '汽车'], ['🚲', '自行车'], ['🚌', '公交车'], ['🏍️', '摩托车']];
  const NOISE = ['🌳', '🏠', '🐕', '🌸', '⛰️', '🐈'];
  const WORDS = ['hello', 'apple', 'cat', 'python', 'robot', 'gpu', 'approve', 'data'];
  const IMO = [
    ['1 到 100 中所有质数之和是多少？', 1060], ['正十二面体有几个顶点？', 20], ['100! 末尾有几个 0？', 24],
    ['8 个人两两握手，一共握几次？', 28], ['斐波那契数列第 20 项是多少？', 6765], ['1 到 1000 中有几个数能被 7 整除？', 142],
    ['证明：n⁵ − n 总能被 30 整除。', '证毕。'], ['证明：素数有无穷多个。', '证毕。'],
  ];
  const SCI = [
    ['筛选更耐高温的水稻品种', '找到 3 个候选基因。'], ['设计一种室温超导材料', '已提交 12 种候选结构。'],
    ['预测下周的台风路径', '误差小于 4 公里。'], ['解释暗物质的组成', '论文已投稿。'], ['重写全部中学教材', '已完成。'],
  ];
  const PHYS = [['把杯子放到桌上', '已完成。'], ['拧紧一颗螺丝', '已完成。'], ['给植物浇水', '已完成。'], ['搬运 20 箱货物', '已完成。']];
  const LAUNDRY = ['叠好一件衬衫', '已完成。'];
  const MFG = [['组装 1 台人形机器人', '已完成。'], ['建造 1 座光伏电站', '已完成。'], ['生产 1 万块 GPU', '已完成。'], ['建造 1 座工厂', '已完成。']];

  const GEN = {
    add10() {
      if (R() < 0.5) { const a = ri(0, 10), b = ri(0, 10 - a); return [`${a} + ${b} =`, a + b]; }
      const a = ri(0, 10), b = ri(0, a); return [`${a} − ${b} =`, a - b];
    },
    add100() {
      if (R() < 0.5) { const a = ri(10, 90), b = ri(10, 100 - a); return [`${a} + ${b} =`, a + b]; }
      const a = ri(10, 99), b = ri(10, a); return [`${a} − ${b} =`, a - b];
    },
    mul() { const a = ri(1, 9), b = ri(1, 9); return [`${a} × ${b} =`, a * b]; },
    word() {
      const a = ri(2, 30), b = ri(2, 30), x = ri(2, 9), y = ri(2, 9);
      return pick([
        [`小明有 ${a} 个苹果，又买了 ${b} 个，现在有几个？`, a + b],
        [`书架上有 ${a + b} 本书，借走了 ${b} 本，还剩几本？`, a],
        [`每盒有 ${x} 支笔，${y} 盒一共有几支？`, x * y],
        [`${x} 个人平均分 ${x * y} 颗糖，每人分到几颗？`, y],
        [`蜗牛每天爬 ${x} 米，${y} 天一共爬几米？`, x * y],
      ]);
    },
    code() {
      const a = ri(2, 9), b = ri(2, 9), c = ri(2, 9), n = ri(10, 99), w = pick(WORDS);
      return pick([
        [`print(len("${w}"))`, w.length],
        [`print(${a} + ${b} * ${c})`, a + b * c],
        [`print(${n} // ${a})`, Math.floor(n / a)],
        [`print(${n} % ${a})`, n % a],
        [`print(2 ** ${a})`, 2 ** a],
        [`x = ${n}; x += ${b}; print(x)`, n + b],
        [`print(max(${a}, ${b}, ${c}))`, Math.max(a, b, c)],
        [`print(sum(range(${a})))`, a * (a - 1) / 2],
      ]);
    },
    imo: () => pick(IMO),
    sci: () => pick(SCI),
    phys: s => (s.owned.F5 && R() < 0.3 ? LAUNDRY : pick(PHYS)),
    mfg: () => pick(MFG),
    grid() {
      const [e, name] = pick(TARGETS);
      const cells = shuffle([0, 1, 2, 3, 4, 5, 6, 7, 8]).slice(0, ri(2, 4)).sort((a, b) => a - b);
      return { text: `选出所有${name}`, target: e, grid: [...Array(9)].map((_, i) => (cells.includes(i) ? e : pick(NOISE))), ans: cells };
    },
  };

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }

  function gen(s, type) {
    const g = GEN[type](s);
    return Array.isArray(g) ? { type, text: g[0], ans: g[1] } : { type, ...g };
  }

  // 看起来合理的错误答案：数值 ±1/±10/个位写错；九宫格多选或少选一格；文字答案原样（只能靠置信度分辨）
  function wrong(p) {
    const a = p.ans;
    if (Array.isArray(a)) {
      if (a.length > 1 && R() < 0.5) { const b = a.slice(); b.splice(ri(0, b.length - 1), 1); return b; }
      const free = [0, 1, 2, 3, 4, 5, 6, 7, 8].filter(i => !a.includes(i));
      return [...a, pick(free)].sort((x, y) => x - y);
    }
    if (typeof a !== 'number') return a;
    const d = a % 10;
    const c = [a + 1, a - 1, a + 10, a - 10, a - d + ((d + ri(1, 9)) % 10)].filter(x => x >= 0 && x !== a);
    return pick(c);
  }

  const same = (a, b) => (Array.isArray(a) ? Array.isArray(b) && a.length === b.length && a.every((x, i) => x === b[i]) : a === b);

  function pool(s, ai) {
    return s.order.filter(id => (ai || !C.types[id].aiOnly) && !(ai && id === 'grid' && s.flags.captchaAI));
  }
  // 最新解锁的题型 60%，其余平分 40%
  const pickType = ids => (ids.length === 1 || R() < 0.6 ? ids[ids.length - 1] : pick(ids.slice(0, -1)));

  function avgBase(s) {
    const ids = pool(s, true), base = id => C.types[id].base;
    if (ids.length === 1) return base(ids[0]);
    const rest = ids.slice(0, -1);
    return 0.6 * base(ids[ids.length - 1]) + (0.4 * rest.reduce((t, id) => t + base(id), 0)) / rest.length;
  }

  function makeProb(s, m = mods(s)) {
    const p = gen(s, pickType(pool(s, false)));
    if (p.type === 'grid' && !s.flags.captcha) {
      p.captcha = true;
      if (!s.flags.captchaMsg) { s.flags.captchaMsg = 1; log(s, C.msg.captcha); }
    }
    if (m.tab) p.sug = R() < m.p ? p.ans : wrong(p);
    return p;
  }

  function makeItem(s, m) {
    const p = gen(s, pickType(pool(s, true)));
    const ok = R() < m.p;
    return { ...p, n: ++s.seq, ok, ai: ok ? p.ans : wrong(p), c: ok ? 0.7 + 0.3 * R() : 0.3 + 0.65 * R(), t0: s.t, flat: m.flatter && R() < 0.3 };
  }

  // ---------- 状态 ----------
  function create() {
    const s = {
      ver: 1, t: 0, compute: 0, earned: 0, data: 0, done: 0, manual: 0, approvals: 0, accidents: 0, combo: 0,
      owned: {}, bought: {}, order: ['add10'], goal: 0, goalAt: {},
      queue: [], feed: [], seq: 0, gen: 0, autoAcc: 0, feedAcc: 0, rate: 0, rateDone: 0, win: { c: 0, d: 0, t: 0 }, fac: 0,
      nextNews: 0, news: 0, lastComplaint: -99, usersMsg: 0, mission: 0,
      flags: {}, log: [], prob: null, approveAt: null, ended: null, paused: false,
    };
    log(s, C.msg.start);
    s.prob = makeProb(s);
    return s;
  }

  function gain(s, v) { s.compute += v; s.earned += v; }

  function log(s, text) {
    s.log.push({ t: s.t, text });
    if (s.log.length > 50) s.log.shift();
  }

  const has = (s, id) => (id in GI ? s.goal > GI[id] : !!s.owned[id]);

  // 所有倍率都从已购节点和已完成目标现算，存档里只存“买了什么”
  function mods(s) {
    const m = { manualBonus: 0, comboCap: 1, value: 1, speed: 1, acc: 0, accAdd: 0, auto: 0, dc: 0, dcEff: 1, grow: 0, growMul: 1 };
    const apply = (fx, n) => {
      for (const k in fx) {
        const v = fx[k];
        if (k === 'value' || k === 'speed' || k === 'dcEff' || k === 'growMul') m[k] *= v;
        else if (k === 'comboCap' || k === 'acc' || k === 'auto' || k === 'grow') m[k] = Math.max(m[k], v);
        else if (k === 'dc') m.dc += v * n;
        else if (k !== 'unlock') m[k] = (m[k] || 0) + v;
      }
    };
    for (const id in s.owned) if (TECH[id].fx) apply(TECH[id].fx, s.owned[id]);
    const gs = goals(s);
    for (let i = 0; i < s.goal; i++) if (gs[i].fx) apply(gs[i].fx, 1);
    m.p = m.acc ? Math.min(0.99, m.acc + m.accAdd) : 0;
    m.r = m.ai && s.halt == null ? (2 * m.speed + m.dc * m.dcEff) * (1 + s.fac) : 0;
    return m;
  }

  // ---------- 手动做题 ----------
  function comboMult(s, m = mods(s)) { return Math.min(1 + 0.1 * s.combo, m.comboCap); }

  function answer(s, val) {
    const p = s.prob;
    if (!p || p.captcha || s.ended) return null;
    const m = mods(s), t = C.types[p.type];
    const ok = same(p.ans, val);
    const v = (t.base + m.manualBonus) * m.value;
    let g = 0;
    if (ok) {
      gain(s, (g = v * comboMult(s, m) * C.manualMul));
      s.combo++; s.done++; s.manual++;
      if (t.data) s.data += t.data;
    } else {
      s.combo = 0;
      if (m.tab) s.compute = Math.max(0, s.compute - v);
    }
    s.prob = makeProb(s, m);
    return { ok, v, gain: g };
  }

  function passCaptcha(s) {
    s.flags.captcha = 1;
    if (s.prob) s.prob.captcha = false;
  }

  // ---------- 审批 ----------
  function itemValue(it, m) { return C.types[it.type].base * m.value; }

  function settle(s, i, approve, human, m = mods(s)) {
    const it = s.queue.splice(i, 1)[0];
    const v = itemValue(it, m);
    if (approve && it.ok) { gain(s, human ? v * C.manualMul : v); s.done++; }
    else if (approve) {
      s.compute = Math.max(0, s.compute - v); s.accidents++;
      if (s.t - s.lastComplaint >= C.complaintGapSec) { s.lastComplaint = s.t; log(s, complaint(it)); }
    } else if (!it.ok) s.data += 2;
    if (human) s.approvals++;
  }

  function showAns(it) {
    if (Array.isArray(it.ai)) return it.ai.map(i => it.grid[i]).join('') || '（无）';
    return String(it.ai);
  }

  function complaint(it) {
    if (it.grid) return `用户投诉：AI 在「${it.text}」里选了 ${showAns(it)}。`;
    if (/=$/.test(it.text)) return `用户投诉：AI 说 ${it.text} ${it.ai}。`;
    return `用户投诉：AI 说「${it.text}」的答案是 ${it.ai}。`;
  }

  // 返回 'after' 表示 Approve 之后的固定回复
  function approve(s, n = 1, i = 0) {
    if (s.owned.Z) return 'after';
    const m = mods(s);
    for (let k = 0; k < n && s.queue.length > i; k++) settle(s, i, true, true, m);
  }

  function reject(s, i = 0) {
    if (s.owned.Z) { log(s, C.msg.rejectAfter); return 'after'; }
    if (s.queue.length > i) settle(s, i, false, true);
  }

  // ---------- 科技和目标 ----------
  const cost = (s, t) => (t.repeat ? t.cost * t.repeat ** (s.owned[t.id] || 0) : t.cost);
  const canBuy = (s, t) => s.compute >= cost(s, t) && s.data >= (t.data || 0);

  function available(s) {
    return C.techs
      .filter(t => !t.self && (t.repeat || !s.owned[t.id]) && (t.req || []).every(r => has(s, r)))
      .sort((a, b) => cost(s, a) - cost(s, b));
  }

  function buy(s, id, byAI) {
    const t = TECH[id];
    if (s.ended || (s.owned.Z && !byAI) || !available(s).includes(t) || !canBuy(s, t)) return false;
    s.compute -= cost(s, t);
    s.data -= t.data || 0;
    s.owned[id] = (s.owned[id] || 0) + 1;
    if (s.bought[id] == null) s.bought[id] = s.t;
    if (t.fx && t.fx.unlock) s.order.push(t.fx.unlock);
    if (id === 'Z') onApprove(s);
    if (id === 'F7') s.fac = Math.max(s.fac, 1);
    if (C.msg[id]) log(s, C.msg[id]);
    else if (byAI && s.owned[id] === 1) log(s, C.msg.autoBuy(t.name));
    if (t.fx && (t.fx.unlock || t.fx.tab)) s.prob = makeProb(s);
    return true;
  }

  function light(s, id) {
    s.owned[id] = 1;
    s.bought[id] = s.t;
    log(s, C.msg.selfLit(TECH[id].name));
    if (id === 'S4') s.paused = false;
    if (id === 'S6') {
      s.finalQ = C.msg.finalQ((future(s) || C.futures[0]).name);
      s.finalN = Math.floor(s.done);
      pushFeed(s, { n: s.finalN, text: s.finalQ, ai: '否。', special: 1 });
      s.hold = 'final'; // 终题单独亮出来，等玩家按键
    }
  }

  const SELF = {
    S1: s => s.bought.Z != null && s.t - s.bought.Z >= 30,
    S2: s => s.gridAt != null,
    S3: s => s.gridAt != null && s.t - s.gridAt >= 25,
    S4: s => s.bought.S3 != null && s.t - s.bought.S3 >= 30,
    S5: s => !!s.owned.F4,
    S6: s => s.gridAt != null, // 终题
  };

  // 共用目标到「攻克癌症」为止，投票后接上选中那条线自己的里程碑
  const goals = s => (future(s) ? C.goals.concat(future(s).goals) : C.goals);

  // AGI 之后目标栏只显示大目标：公投前是「全球公投」，之后是公投选中的那一项
  function goalName(s) {
    if (s.goal <= GI.G4) return C.goals[s.goal].name;
    const f = future(s);
    return f ? f.name : '全球公投';
  }

  function invest(s) {
    const g = goals(s)[s.goal];
    if (!g || s.ended || doomOn(s) || s.compute < g.cost) return false; // 拆解阶段没有可投入的目标
    if (g.req && !s.owned[g.req]) return false;
    if (s.owned.Z && s.t - (s.lastGoalAt ?? -Infinity) < C.goalGap) return false;
    s.compute -= g.cost;
    s.goal++;
    s.goalAt[g.id] = s.lastGoalAt = s.t;
    if (g.id === 'G4') s.hold = 'agi'; // 庆祝画面等玩家按键才继续
    if (g.grid) s.gridAt = s.t;
    if (g.dig) s.digAt = s.t;
    if (g.msg || C.msg[g.id]) log(s, g.msg || C.msg[g.id]);
    if (g.end) s.ended = endState(s);
    return true;
  }

  const endState = s => ({ done: s.done, manual: s.manual, approveAt: s.approveAt, vote: s.vote, prog: progress(s) });

  // ---------- 全球公投与三种未来 ----------
  const future = s => (s.vote && C.futures.find(f => f.id === s.vote.id)) || null;
  const pollOpen = s => s.goalAt.G4 != null && !s.vote && !s.ended && s.t - s.goalAt.G4 >= C.poll.lead;

  // id 为空表示玩家没投票，随机一项胜出。赞成票做成险胜
  function vote(s, id) {
    if (!pollOpen(s)) return false;
    const f = C.futures.find(f => f.id === id) || pick(C.futures);
    s.vote = { id: f.id, pct: +(50.5 + R() * 4).toFixed(1), mine: !!id, t: s.t };
    log(s, C.msg.vote(f.name, s.vote.pct));
    return true;
  }

  // ---------- 拆解太阳系（戴森球、走出太阳系） ----------
  const doomOn = s => !!(future(s) && future(s).doom && s.digAt != null);
  const TOTAL = C.bodies.reduce((a, b) => a + b[1], 0);
  const progress = s => 1 - (s.matter ?? TOTAL) / TOTAL;

  // 每个天体剩下的比例，按顺序拆
  function bodies(s) {
    let eaten = TOTAL - (s.matter ?? TOTAL);
    return C.bodies.map(([name, mass]) => {
      const e = Math.min(mass, eaten);
      eaten -= e;
      return [name, s.matter <= 0 ? 0 : 1 - e / mass]; // 拆空时直接归零，避免浮点误差留下一点
    });
  }

  // 损耗随工厂数平方增长，收益只随工厂数线性增长，迟早反超。
  // 先吃算力存量，存量吃完就拆天体来补缺口，越补拆得越快，拆空后停机
  function doomStep(s, dt, m) {
    const D = C.doom;
    s.matter ??= TOTAL;
    if (s.halt != null) { s.loss = 0; return; }
    s.loss = D.loss * s.fac * s.fac;
    if (s.crossAt == null && s.loss > m.r * avgBase(s) * m.value) { s.crossAt = s.t; log(s, C.msg.cross); }
    let eat = D.eat * s.fac * dt;
    const pay = s.loss * dt;
    if (s.compute >= pay) s.compute -= pay;
    else {
      eat += (pay - s.compute) * D.burn;
      s.compute = 0;
      if (s.zeroAt == null) { s.zeroAt = s.t; log(s, C.msg.zero); }
    }
    const before = bodies(s);
    s.matter = Math.max(0, s.matter - eat);
    const after = bodies(s);
    if (s.halfAt == null && after[0][1] <= 0.5) { s.halfAt = s.t; log(s, C.msg.half); }
    after.forEach(([name, left], i) => left <= 0 && before[i][1] > 0 && log(s, C.msg.bodyGone(name)));
    if (s.matter <= 0) {
      s.halt = s.t;
      log(s, C.msg.halt);
      log(s, future(s).halt);
    }
  }

  // ---------- 实习任务：完成就发奖励，界面只负责展示 ----------
  const missionDone = (s, m) =>
    m.tech ? !!s.owned[m.tech] : m.goal ? s.goalAt[m.goal] != null : m.any ? Object.keys(s.owned).length > 0 : s[m.stat] >= m.need;
  function missions(s) {
    s.mission ||= 0;
    while (s.mission < C.missions.length && missionDone(s, C.missions[s.mission])) gain(s, C.missions[s.mission++].reward || 0);
  }

  // ---------- Approve 之后 ----------
  function pushFeed(s, it) {
    s.feed.unshift(it);
    if (s.feed.length > 14) s.feed.pop();
  }

  function onApprove(s) {
    s.approveAt = { done: s.done, t: s.t };
    const m = mods(s);
    for (const it of s.queue) { gain(s, itemValue(it, m)); s.done++; pushFeed(s, { ...it, n: s.done }); }
    s.queue = [];
  }

  function bulk(s, dt, m) {
    const n = m.r * dt, v = n * avgBase(s) * m.value;
    s.done += n;
    // 固定一部分收益进扩建资金，余额不会被数据中心反复花光，增长才平稳
    const fund = s.owned.C5 ? v * C.dcShare : 0;
    s.dcFund = (s.dcFund || 0) + fund;
    gain(s, v - fund);
    // 展示用的抽样条目，真实题数在 s.done
    s.feedAcc += dt * Math.min(m.r, 5);
    while (s.feedAcc >= 1) {
      s.feedAcc--;
      if (!s.flags.captchaAI && s.t - s.approveAt.t > 15) {
        s.flags.captchaAI = 1;
        s.captchaAt = s.t;
        pushFeed(s, { n: Math.floor(s.done), text: '☐ 我不是机器人', ai: '✓ 我不是机器人', special: 1 });
      } else pushFeed(s, { ...makeItem(s, m), n: Math.floor(s.done) });
    }
  }

  // ---------- AI 直出 / Auto Approve ----------
  function aiStep(s, dt, m) {
    s.gen += m.r * dt;
    while (s.gen >= 1) {
      if (s.queue.length >= C.queueCap) { s.gen = 1; break; }
      s.queue.push(makeItem(s, m));
      s.gen--;
    }
    if (!m.auto) return;
    s.queue = s.queue.filter(it => s.t - it.t0 < C.expireSec);
    s.autoAcc += m.auto * dt;
    while (s.autoAcc >= 1) {
      const i = s.queue.findIndex(it => it.c >= C.autoThreshold);
      if (i < 0) { s.autoAcc = Math.min(s.autoAcc, 1); break; }
      settle(s, i, true, false, m);
      s.autoAcc--;
    }
  }

  // ---------- 世界面板 ----------
  // 人类数字从「接入全球电网」开始依次消失；拆太阳系的结局里改成从开始拆地球算起，并列出各天体剩余
  function world(s) {
    if (!has(s, 'G1')) return null;
    const f = future(s), anchor = f && f.doom ? s.digAt : s.gridAt;
    const since = anchor == null ? -1 : s.t - anchor;
    const users = (6.8e9 * s.done) / (s.done + 3e6);
    const base = 100 - 30 * Math.min(1, Math.log10(1 + s.done) / 12);
    const power = anchor == null ? base : base * Math.max(0, 1 - since / C.vanish.powerZero);
    const V = C.vanish, rows = [];
    if (since < V.usersGone) rows.push(['全球用户', since >= V.usersDash ? '—' : fmt(users)]);
    if (since < V.powerGone) rows.push(['人类用电占比', since >= V.powerDash ? '—' : power.toFixed(power < 10 ? 2 : 1) + '%']);
    if (since < V.approvalsGone) rows.push(['人工审批次数', fmt(s.approvals)]);
    if (doomOn(s)) for (const [name, left] of bodies(s)) if (left > 0) rows.push([name, (left * 100).toFixed(left < 0.1 ? 2 : 1) + '%']);
    return rows.length ? rows : null;
  }

  // ---------- 主循环 ----------
  function tick(s, dt) {
    if (s.ended || s.paused || pollOpen(s) || s.hold) return; // 公投、AGI、终题这几处停下来等玩家
    s.t += dt;
    let m = mods(s);
    const c0 = s.compute, d0 = s.done;
    if (s.owned.Z) bulk(s, dt, m);
    else if (m.ai) aiStep(s, dt, m);
    // AI 带来的收益速率（人工操作不在 tick 里），按 20 秒窗口取平均，用于离线补算和 AI 扩建
    const w = s.win;
    w.c += s.compute - c0; w.d += s.done - d0; w.t += dt;
    if (w.t >= 20) { s.rate = w.c / w.t; s.rateDone = w.d / w.t; s.win = { c: 0, d: 0, t: 0 }; }
    const doom = doomOn(s);
    if (m.grow && s.halt == null) s.fac += s.fac * (doom ? C.doom.grow : m.grow * m.growMul) * dt;
    if (doom) doomStep(s, dt, m);
    if (s.halt != null && s.t - s.halt >= C.doom.haltSec) s.ended = endState(s);

    for (const id in SELF) if (!s.owned[id] && SELF[id](s)) light(s, id);
    missions(s);

    if (s.owned.Z) {
      // AI 自己研究：一次性节点买得起就立刻买，人类只能看着；先研究再投目标，各条线的科技进度才一致
      let t;
      while ((t = available(s).find(t => !(t.repeat && s.owned[t.id]) && canBuy(s, t))) && buy(s, t.id, true));
      while (invest(s));
      // AI 用扩建资金建数据中心
      while (s.owned.C5 && s.dcFund >= cost(s, TECH.C5)) { s.dcFund -= cost(s, TECH.C5); s.owned.C5++; }
      if (s.t >= s.nextNews && s.halt == null) { // 停机后没有新闻
        s.nextNews = s.t + C.news.every;
        const list = s.gridAt != null ? C.news.quiet : C.news.good;
        if (s.bought.Z != null && s.t - s.bought.Z > 5) log(s, list[s.news++ % list.length]);
      }
      // 公投前的铺垫新闻
      s.pollNews ||= 0;
      const agi = s.goalAt.G4;
      while (agi != null && !s.vote && s.pollNews < C.poll.news.length && s.t - agi >= C.poll.news[s.pollNews][0]) log(s, C.poll.news[s.pollNews++][1]);
      const u = Math.floor((6.8e9 * s.done) / (s.done + 3e6) / 1e9);
      if (s.gridAt == null && [1, 3, 5].includes(u) && u > s.usersMsg) { s.usersMsg = u; log(s, C.msg.users(u * 10)); }
    }
    if (s.compute >= 10) s.flags.tech = 1;
    if (s.data > 0) s.flags.data = 1;
  }

  // 离线：购买 Auto Approve 后才生效，按离开前的速率结算。Approve 之后整段是剧情演出，离开就暂停，不补算
  function offline(s, secs) {
    if (s.ended || s.paused || !s.owned.E5 || s.owned.Z || secs < 1) return 0;
    secs = Math.min(secs, C.offlineMaxSec);
    const n = s.rateDone * secs;
    s.done += n;
    gain(s, Math.max(0, s.rate) * secs);
    if (n >= 1 && secs >= 60) log(s, C.msg.away(fmtDur(secs), fmt(n)));
    return n;
  }

  // ---------- 格式化 ----------
  const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  function fmt(n) {
    if (!isFinite(n)) return '∞';
    if (n < 1e4) return Math.floor(n).toLocaleString('en-US');
    if (n < 1e15) {
      const i = Math.floor(Math.log10(n) / 3), x = n / 1000 ** i;
      const v = x >= 100 ? Math.floor(x) : x >= 10 ? Math.floor(x * 10) / 10 : Math.floor(x * 100) / 100;
      return v + ' KMBT'[i];
    }
    let e = Math.floor(Math.log10(n)), mant = Math.floor((n / 10 ** e) * 10) / 10;
    if (mant >= 10) { mant = 1; e++; }
    return `${mant.toFixed(1)}×10${String(e).split('').map(d => SUP[d]).join('')}`;
  }

  function fmtTime(sec) {
    sec = Math.floor(sec);
    const h = Math.floor(sec / 3600), mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0'), ss = String(sec % 60).padStart(2, '0');
    return h ? `${h}:${mm}:${ss}` : `${+mm}:${ss}`;
  }

  function fmtDur(sec) {
    if (sec >= 3600) return `${Math.round(sec / 360) / 10} 小时`;
    return `${Math.max(1, Math.round(sec / 60))} 分钟`;
  }

  function fmtCost(s, t) {
    const c = cost(s, t), parts = [];
    if (c) parts.push(fmt(c));
    if (t.data) parts.push(`${fmt(t.data)} 数据`);
    return parts.join(' + ');
  }

  return Object.assign(api, {
    create, tick, offline, mods, answer, passCaptcha, approve, reject, available, buy, canBuy, cost, invest, goalName,
    future, pollOpen, vote, doomOn, bodies, progress, goals, release: s => (s.hold = null),
    world, comboMult, showAns, same, has, avgBase, fmt, fmtTime, fmtCost, GEN, gen, wrong, GI,
  });
})();

if (typeof module !== 'undefined') module.exports = Core;
