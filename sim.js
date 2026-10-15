// 节奏自检：模拟熟练玩家和新手，打印各节点时间并断言节奏目标（熟练玩家一局约 40 分钟）。
// 用法：node sim.js [种子数=5] [-v]
const Core = require('./core.js');
const C = require('./config.js');
const assert = require('assert');

function mulberry32(a) {
  return () => {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 熟练玩家每种题的作答秒数
const T = { add10: 1.3, add100: 2.2, mul: 1.4, grid: 2.8, word: 2.8, code: 3.2 };
// 熟练：一有钱就买。新手：答题慢 1.8 倍、错 8%、每 8 秒看一眼商店、审批每条 0.8 秒（参数是估计值，不是实测）
const PROFILES = {
  skilled: { slow: 1, err: 0.03, shopEvery: 0, approveSec: 0.25, captcha: 1.5, tabTrust: 0.1 },
  novice: { slow: 1.8, err: 0.08, shopEvery: 8, approveSec: 0.8, captcha: 3, tabTrust: 0.3 },
};

// idle=true：Approve 之后玩家不再操作，只靠 AI 自己研究。choice：公投投哪一项
function run(seed, idle, maxT = 3600, P = PROFILES.skilled, choice = 'answer') {
  Core.rand = mulberry32(seed);
  const R = mulberry32(seed + 1000);
  const s = Core.create();
  const dt = 0.1;
  let busy = 0, nextShop = 0;
  while (s.t < maxT && !s.ended) {
    if (Core.pollOpen(s)) Core.vote(s, choice);
    Core.tick(s, dt);
    const m = Core.mods(s);
    if (idle && s.owned.Z) continue;

    if (s.t >= nextShop && s.flags.tech) { // 科技面板出现之前看不到商店
      nextShop = s.t + P.shopEvery;
      let bought = true;
      while (bought) {
        // Approve 之后数据中心交给 AI 扩建，玩家只买一次性节点
        const t = Core.available(s).find(t => Core.canBuy(s, t) && !(s.owned.Z && t.repeat && s.owned[t.id]));
        bought = t ? Core.buy(s, t.id) : Core.invest(s);
      }
    }

    if (s.t < busy || s.owned.Z) continue;
    if (m.ai && s.queue.length) {
      if (m.conf && s.queue[0].c < 0.8) { Core.reject(s); busy = s.t + P.approveSec; }
      else if (m.batch) { Core.approve(s, 10); busy = s.t + P.approveSec * 1.6; }
      else { Core.approve(s); busy = s.t + P.approveSec; }
      continue;
    }
    const p = s.prob;
    if (p.captcha) { Core.passCaptcha(s); busy = s.t + P.captcha; continue; }
    let val = p.ans, time = T[p.type] * P.slow;
    if (m.tab) {
      if (Core.same(p.sug, p.ans) || R() < P.tabTrust) { val = p.sug; time = m.oneClick ? 0.5 : 0.75 * P.slow; }
      else time += 0.5;
    } else if (R() < P.err) val = Core.wrong(p);
    Core.answer(s, val);
    busy = s.t + time;
  }
  return s;
}

// 熟练玩家的目标时间（秒），校准时用
const targets = {A1: 4, B1: 11, B2: 23, A2: 36, C1: 46, B3: 56, D1: 67, E1: 90, D3: 105, C2: 118, A3: 129, A4: 136, B4: 145, E2: 150, E3: 170, C3: 196, E4: 210, G1: 222, E5: 240, B5: 258, E6: 281, C4: 327, E7: 349, G2: 376, D4: 389, D5: 408, Z: 420,
  // Approve（约 7:05）之后约 8 分钟到结局：黄金时代 → AGI（R2:15）→ 公投（R3:00）→ 三幕，间隔越来越短
  B6: 440, C5: 445, F1: 470, G3: 485, D6: 500, F2: 515, B7: 525, C6: 535, F3: 545, G4: 560, G5: 580,
  B8: 610, D7: 630, F4: 650, F6: 655, F5: 665, F7: 685, B9: 690, F8: 700,
  answer1: 620, answer2: 640, answer3: 660, answer4: 675, answer5: 705, answer6: 735, answer7: 775, answer8: 820, answer9: 865,
  dyson1: 620, dyson2: 640, dyson3: 660, dyson4: 675, dyson5: 705,
  stars1: 620, stars2: 640, stars3: 660, stars4: 675, stars5: 705};
// 拆解结局：损耗反超、拆空（游戏秒）
const doomTargets = { cross: 740, halt: 845 };
module.exports = { run, PROFILES, targets, doomTargets };
if (require.main !== module) return;

const seeds = +process.argv[2] || 5, verbose = process.argv.includes('-v');
const rows = {}, ends = {};
const keep = (o, k, v) => ((o[k] ||= []).push(v ?? NaN));
for (let i = 0; i < seeds; i++) {
  for (const [key, idle, P] of [['active', false, PROFILES.skilled], ['idle', true, PROFILES.skilled], ['novice', false, PROFILES.novice]]) {
    for (const fu of C.futures) {
      const s = run(i + 1, idle, 3600, P, fu.id);
      const e = ((ends[fu.id] ||= {})[key] ||= {});
      for (const k of ['crossAt', 'zeroAt', 'halfAt', 'halt', 'gridAt']) keep(e, k, s[k]);
      keep(e, 'vote', s.vote && s.vote.t);
      keep(e, 'end', s.ended ? s.t : NaN);
      keep(e, 'Z', s.bought.Z);
      for (const g of fu.goals) keep(e, g.id, s.goalAt[g.id]);
      if (fu.id !== 'answer') continue;
      for (const [id, t] of Object.entries({ ...s.bought, ...s.goalAt })) ((rows[id] ||= {})[key] ||= []).push(t);
      if (verbose) console.log(key, 'seed', i + 1, 'end', Core.fmtTime(s.t), 'done', Core.fmt(s.done), 'manual', s.manual, 'approveAt', s.approveAt && Core.fmtTime(s.approveAt.t));
    }
  }
}
const med = a => (a ? a.slice().sort((x, y) => x - y)[Math.floor(a.length / 2)] : NaN);
const f = t => (isNaN(t) ? '—' : Core.fmtTime(t));
console.log('节点'.padEnd(6), '目标'.padStart(8), '熟练'.padStart(8), '挂机'.padStart(8), '新手'.padStart(8));
const order = [...C.techs.map(t => t.id), ...C.goals.map(g => g.id)].filter(id => rows[id]);
order.sort((a, b) => med(rows[a].active || rows[a].idle) - med(rows[b].active || rows[b].idle));
for (const id of order) {
  const r = rows[id];
  console.log(id.padEnd(6), (targets[id] ? f(targets[id]) : '').padStart(8), f(med(r.active)).padStart(8), f(med(r.idle)).padStart(8), f(med(r.novice)).padStart(8));
}

// 三条线：投票之后的事件按 Approve 之后的相对时间列出
const at = (id, k = 'active') => med(rows[id] && rows[id][k]);
const Z = at('Z');
console.log(`\n以下为 Approve（${f(Z)}）之后的相对时间（熟练）；结局列另给新手的绝对时间`);
const timeline = (fu, k = 'active') => {
  const e = ends[fu.id][k], m = x => med(e[x]);
  const ev = [['公投', m('vote')], ...fu.goals.filter(g => !g.end).map(g => [g.name, m(g.id)])];
  if (fu.doom) ev.push(['损耗反超', m('crossAt')], ['算力归零', m('zeroAt')], ['地球过半', m('halfAt')], ['停机', m('halt')]);
  ev.push(['结局', m('end')]);
  return ev;
};
for (const fu of C.futures) {
  console.log(`${fu.name}：` + timeline(fu).map(([n, t]) => `${n} ${f(t - Z)}`).join(' · ') + `　新手结局 ${f(med(ends[fu.id].novice.end))}`);
}

assert(at('E1') <= 105, 'Tab 补全应在 1:45 内');
assert(at('E1', 'novice') <= 210, '新手 3:30 内进 Tab 补全');
assert(at('E5') <= 270, 'Auto Approve 应在 4:30 内');
assert(at('E5', 'novice') <= 540, '新手 9 分钟内进 Auto Approve');
assert(Z >= 6 * 60 && Z <= 8 * 60, 'Approve 应在 7 分钟左右');
assert(at('G4') - Z >= 105 && at('G4') - Z <= 165, 'Approve 后约 2:15 实现 AGI');
for (const fu of C.futures) {
  const e = ends[fu.id], m = (x, k = 'active') => med(e[k][x]);
  const rel = m('end') - m('Z');
  assert(rel >= 6.5 * 60 && rel <= 8.5 * 60, `${fu.name}：Approve 后约 8 分钟结局，实际 ${f(rel)}`);
  assert(m('end', 'idle') - m('Z', 'idle') <= 9 * 60, `${fu.name}：挂机也应在 9 分钟内结局`);
  assert(m('end', 'novice') <= 25 * 60, `${fu.name}：新手 25 分钟内看到结局`);
  // 顺序：公投先于接入电网（终题要用公投目标）；投票后相邻事件间隔不超过 75 秒
  assert(m('vote') < m('gridAt'), `${fu.name}：公投应先于接入电网`);
  const ts = timeline(fu).map(x => x[1]);
  assert(ts.every((t, i) => !isNaN(t) && (!i || (t >= ts[i - 1] && t - ts[i - 1] <= 75))), `${fu.name}：投票后事件应按顺序、间隔不超过 75 秒`);
  if (!fu.doom) continue;
  assert(Math.abs(m('crossAt') - doomTargets.cross) <= 30, `${fu.name}：损耗应在 Approve 后约 5:15 反超收益`);
  assert(Math.abs(m('halt') - doomTargets.halt) <= 30, `${fu.name}：太阳系应在 Approve 后约 7:00 拆空`);
}
console.log('节奏自检通过');
