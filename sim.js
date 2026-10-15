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
    if (s.hold) Core.release(s); // 机器人立刻按键继续
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
const targets = {A1: 3, B1: 8, B2: 16, A2: 25, C1: 32, B3: 39, D1: 46, E1: 62, D3: 72, C2: 81, A3: 89, A4: 94, B4: 100, E2: 103, E3: 117, C3: 135, E4: 145, G1: 153, E5: 166, B5: 178, E6: 194, C4: 226, E7: 241, G2: 259, D4: 268, D5: 281, Z: 290,
  // Approve（约 4:50）之后约 8 分钟到结局：黄金时代 → AGI（R2:15）→ 公投（R3:00）→ 三幕，间隔越来越短
  B6: 310, C5: 315, F1: 340, G3: 355, D6: 370, F2: 385, B7: 395, C6: 405, F3: 415, G4: 430, G5: 450,
  B8: 480, D7: 500, F4: 520, F6: 525, F5: 535, F7: 555, B9: 560, F8: 570,
  answer1: 490, answer2: 510, answer3: 530, answer4: 545, answer5: 575, answer6: 605, answer7: 645, answer8: 690, answer9: 735,
  dyson1: 490, dyson2: 510, dyson3: 530, dyson4: 545, dyson5: 575,
  stars1: 490, stars2: 510, stars3: 530, stars4: 545, stars5: 575};
// 拆解结局：损耗反超、拆空（游戏秒）
const doomTargets = { cross: 610, halt: 715 };
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

assert(at('E1') <= 75, 'Tab 补全应在 1:15 内');
assert(at('E1', 'novice') <= 150, '新手 2:30 内进 Tab 补全');
assert(at('E5') <= 190, 'Auto Approve 应在 3:10 内');
assert(at('E5', 'novice') <= 375, '新手 6:15 内进 Auto Approve');
assert(Z >= 250 && Z <= 330, 'Approve 应在 4:50 左右');
assert(at('G4') - Z >= 105 && at('G4') - Z <= 165, 'Approve 后约 2:15 实现 AGI');
for (const fu of C.futures) {
  const e = ends[fu.id], m = (x, k = 'active') => med(e[k][x]);
  const rel = m('end') - m('Z');
  assert(rel >= 6.5 * 60 && rel <= 8.5 * 60, `${fu.name}：Approve 后约 8 分钟结局，实际 ${f(rel)}`);
  assert(m('end', 'idle') - m('Z', 'idle') <= 9 * 60, `${fu.name}：挂机也应在 9 分钟内结局`);
  assert(m('end', 'novice') <= 18 * 60, `${fu.name}：新手 18 分钟内看到结局`);
  // 顺序：公投先于接入电网（终题要用公投目标）；投票后相邻事件间隔不超过 75 秒
  assert(m('vote') < m('gridAt'), `${fu.name}：公投应先于接入电网`);
  const ts = timeline(fu).map(x => x[1]);
  assert(ts.every((t, i) => !isNaN(t) && (!i || (t >= ts[i - 1] && t - ts[i - 1] <= 75))), `${fu.name}：投票后事件应按顺序、间隔不超过 75 秒`);
  if (!fu.doom) continue;
  assert(Math.abs(m('crossAt') - doomTargets.cross) <= 30, `${fu.name}：损耗应在 Approve 后约 5:15 反超收益`);
  assert(Math.abs(m('halt') - doomTargets.halt) <= 30, `${fu.name}：太阳系应在 Approve 后约 7:00 拆空`);
}
console.log('节奏自检通过');
