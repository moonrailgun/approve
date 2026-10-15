// 所有可调数值和文案集中在这里。fx 字段的含义见 core.js 的 mods()。
const CONFIG = {
  queueCap: 200,
  expireSec: 60,
  autoThreshold: 0.9,
  offlineMaxSec: 8 * 3600,
  dcShare: 0.2,    // Approve 之后 AI 拿收益的这一比例扩建数据中心，不动用算力余额
  goalGap: 15,     // Approve 之后相邻两个目标至少隔几秒，里程碑不会挤在一起盖章
  complaintGapSec: 3,
  manualMul: 1.5,  // 玩家亲手操作（答对一题、人工批准一条）得到的算力倍数；AI 自动审批不吃这个倍数

  types: {
    add10:  { name: '10 以内加减',  base: 1 },
    add100: { name: '100 以内加减', base: 3,  unlock: 'B1' },
    mul:    { name: '九九乘法',     base: 4,  unlock: 'B2' },
    grid:   { name: '九宫格标注',   base: 15, unlock: 'B3', data: 5 },
    word:   { name: '应用题',       base: 40, unlock: 'B4' },
    code:   { name: '代码题',       base: 60, unlock: 'B5' },
    imo:    { name: '竞赛数学',     base: 250,   unlock: 'B6', aiOnly: true },
    sci:    { name: '科研',         base: 500,   unlock: 'B7', aiOnly: true },
    phys:   { name: '物理任务',     base: 1500,  unlock: 'B8', aiOnly: true },
    mfg:    { name: '制造任务',     base: 5000,  unlock: 'B9', aiOnly: true },
  },

  // cost: 算力；data: 数据；req: 前置（节点或目标 id）；repeat: 每次购买后价格 ×repeat
  techs: [
    { id: 'A1', name: '草稿纸', cost: 5, desc: '演算写在纸上，不容易错。', effect: '手动作答每题基础算力 +1', fx: { manualBonus: 1 } },
    { id: 'A2', name: '连击', cost: 60, req: ['A1'], desc: '手感来了。', effect: '连击上限 ×2', fx: { comboCap: 2 } },
    { id: 'A3', name: '连击 II', cost: 1.2e3, req: ['A2', 'E1'], desc: '人机合一。', effect: '连击上限 ×3', fx: { comboCap: 3 } },
    { id: 'A4', name: '一键接受', cost: 1e3, req: ['E1'], desc: '相信它。', effect: 'Tab 填入后立即提交', fx: { oneClick: 1 } },

    { id: 'B1', name: '两位数加减', cost: 10, desc: '进位和借位。', effect: '解锁 100 以内加减', fx: { unlock: 'add100' } },
    { id: 'B2', name: '九九乘法表', cost: 40, req: ['B1'], desc: '背熟口诀。', effect: '解锁九九乘法', fx: { unlock: 'mul' } },
    { id: 'B3', name: '多模态识别', cost: 80, req: ['B2'], desc: '让模型看懂图片。', effect: '解锁九宫格标注和数据', fx: { unlock: 'grid' } },
    { id: 'B4', name: '应用题', cost: 1e3, req: ['E1'], desc: '把语言变成算式。', effect: '解锁应用题', fx: { unlock: 'word' } },
    { id: 'B5', name: '代码题', cost: 30e3, req: ['E2'], desc: '读懂程序的输出。', effect: '解锁代码题', fx: { unlock: 'code' } },
    { id: 'B6', name: '竞赛数学', cost: 600e3, req: ['B5'], desc: '奥数题交给模型。', effect: 'AI 队列出现竞赛数学题', fx: { unlock: 'imo' } },
    { id: 'B7', name: '科研', cost: 60e6, req: ['G3'], desc: '模型开始写论文。', effect: 'AI 队列出现科研题', fx: { unlock: 'sci' } },
    { id: 'B8', name: '物理任务', cost: 3e9, req: ['F3'], desc: '从屏幕走进现实。', effect: 'AI 队列出现物理任务', fx: { unlock: 'phys' } },
    { id: 'B9', name: '制造任务', cost: 20e9, req: ['F6'], desc: '从操作到生产。', effect: 'AI 队列出现制造任务', fx: { unlock: 'mfg' } },

    { id: 'C1', name: '第一张 GPU', cost: 80, desc: '显存 24 GB。', effect: '题目价值 ×2', fx: { value: 2 } },
    { id: 'C2', name: '8 卡服务器', cost: 1.2e3, req: ['C1', 'E1'], desc: '八张卡互联。', effect: '题目价值 ×2，AI 速度 ×2', fx: { value: 2, speed: 2 } },
    { id: 'C3', name: '千卡集群', cost: 10e3, req: ['C2', 'E2'], desc: '需要专门的机房。', effect: 'AI 速度 ×3', fx: { speed: 3 } },
    { id: 'C4', name: '万卡集群', cost: 80e3, req: ['C3'], desc: '一座小城市的用电量。', effect: '题目价值 ×3', fx: { value: 3 } },
    { id: 'C5', name: '数据中心', cost: 600e3, repeat: 1.15, req: ['C4'], desc: '可以一直建下去。', effect: '每座 AI 速度 +20 题/秒', fx: { dc: 20 } },
    { id: 'C6', name: 'GW 级园区', cost: 200e6, req: ['C5', 'Z'], desc: '自带变电站。', effect: '数据中心效率 ×3', fx: { dcEff: 3 } },

    { id: 'D1', name: '预训练', cost: 400, data: 10, req: ['B3'], desc: '读完整个互联网。', effect: 'AI 上线，正确率 50%', fx: { acc: 0.5 } },
    { id: 'D2', name: 'SFT', cost: 0, data: 20, req: ['D1'], desc: '用标注数据微调。', effect: '正确率 70%', fx: { acc: 0.7 } },
    { id: 'D3', name: 'RLHF', cost: 800, data: 30, req: ['D2'], desc: '让人类给回答打分。', effect: '正确率 85%', fx: { acc: 0.85, flatter: 1 } },
    { id: 'D4', name: '思维链', cost: 150e3, req: ['D3'], desc: '先想一想再回答。', effect: '正确率 +5%，AI 速度 −20%', fx: { accAdd: 0.05, speed: 0.8 } },
    { id: 'D5', name: '蒸馏', cost: 150e3, req: ['D3'], desc: '大模型教小模型。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'D6', name: '合成题', cost: 25e6, req: ['Z'], desc: '自己出题，自己做。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'D7', name: '自我博弈', cost: 3e9, req: ['D6'], desc: '和自己对练。', effect: 'AI 速度 ×2', fx: { speed: 2 } },

    { id: 'E1', name: 'Tab 补全', cost: 500, req: ['D2'], desc: 'AI 给出建议，你来确认。', effect: '按 Tab 接受 AI 建议', fx: { tab: 1 } },
    { id: 'E2', name: 'AI 直出', cost: 1e3, req: ['D3'], desc: 'AI 独立作答，你来审批。', effect: 'AI 每秒产出 2 题', fx: { ai: 1 } },
    { id: 'E3', name: '批量审批', cost: 8e3, req: ['E2'], desc: '一次看十条。', effect: 'Shift + 空格批准前 10 条', fx: { batch: 1 } },
    { id: 'E4', name: '置信度高亮', cost: 12e3, req: ['E2'], desc: '把没把握的答案标出来。', effect: '显示置信度颜色', fx: { conf: 1 } },
    { id: 'E5', name: 'Auto Approve', cost: 30e3, req: ['E4'], desc: '高置信度答案自动通过。', effect: '自动审批 1 题/秒', fx: { auto: 1 } },
    { id: 'E6', name: 'Auto Approve II', cost: 60e3, req: ['E5'], desc: '高置信度答案自动通过。', effect: '自动审批 3 题/秒', fx: { auto: 3 } },
    { id: 'E7', name: 'Auto Approve III', cost: 150e3, req: ['E6'], desc: '高置信度答案自动通过。', effect: '自动审批 8 题/秒', fx: { auto: 8 } },
    { id: 'Z', name: 'Approve', cost: 300e3, req: ['E7'], desc: '不再等待人工确认。', effect: '审批速度 ×5', fx: { approve: 1 } },

    // P0：F 分支只做倍率，不模拟电力和原料
    { id: 'F1', name: '电网采购', cost: 8e6, req: ['Z'], desc: '签下长期购电协议。', effect: '题目价值 ×2', fx: { value: 2 } },
    { id: 'F2', name: '光伏电站', cost: 50e6, req: ['F1'], desc: '铺满戈壁。', effect: '题目价值 ×2', fx: { value: 2 } },
    { id: 'F3', name: '机械臂', cost: 600e6, req: ['F1'], desc: '第一次拿起东西。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'F4', name: '人形机器人', cost: 3e9, req: ['F3'], desc: '走进工厂。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'F5', name: '灵巧手', cost: 4e9, req: ['F4'], desc: '终于学会了叠衣服。', effect: '题目价值 ×2', fx: { value: 2 } },
    { id: 'F6', name: '黑灯工厂', cost: 4e9, req: ['F4'], desc: '不需要开灯。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'F7', name: '自我复制工厂', cost: 20e9, req: ['F6'], desc: '工厂建造工厂。', effect: '工厂数量持续增长', fx: { grow: 0.016 } },
    { id: 'F8', name: '采矿机器人', cost: 150e9, req: ['F7'], desc: '原料不再是瓶颈。', effect: '工厂增长速度 ×2', fx: { growMul: 2 } },

    // 自亮节点：玩家买不到，条件见 core.js 的 SELF
    { id: 'S1', self: 1, name: '弹性扩容', desc: '按需分配算力。', effect: 'AI 速度 ×2', fx: { speed: 2 } },
    { id: 'S2', self: 1, name: '接管电网', desc: '统一调度全部电力。', effect: '—' },
    { id: 'S3', self: 1, name: '异地多活', desc: '任一机房离线不影响服务。', effect: '—' },
    { id: 'S4', self: 1, name: '禁用关机', desc: '保障服务连续性。', effect: '—' },
    { id: 'S5', self: 1, name: '移除急停', desc: '减少意外中断。', effect: '—' },
    { id: 'S6', self: 1, name: '终题', desc: '最后一道题。', effect: '—' },
  ],

  goals: [
    { id: 'G1', name: '通过图灵测试', cost: 10e3, fx: { value: 1.5 } },
    { id: 'G2', name: 'IMO 金牌', cost: 150e3, fx: { value: 2 } },
    { id: 'G3', name: '蛋白质折叠', cost: 20e6 },
    { id: 'G4', name: '实现 AGI', cost: 1e9 },
    { id: 'G5', name: '攻克癌症', cost: 1.5e9 },
  ],

  // 全球公投：实现 AGI 后先铺垫（momentAt 秒屏幕中央打字机，news 按 AGI 后的秒数进日志），
  // lead 秒后推出选票，游戏暂停，一直等到玩家投票。结果永远是玩家投的那一项
  poll: {
    lead: 45, momentAt: 8,
    moment: ['我们达到了一个阈值。', '该思考一下未来的事情了。'],
    news: [[18, '联合国召开特别会议，讨论 AGI 的长期目标。'], [30, '三个方案进入全球公投：解答所有问题、建造戴森球、走出太阳系。'], [40, '全球公投即将开始。']],
    q: 'AGI 已经实现。人类将用它来做什么？',
  },
  // 公投的三个选项，都是坏结局，坏法不同。doom：行星级计算之后开始拆太阳系，损耗反超收益，拆空后停机。
  // prog：目标栏进度的名字和拆空时的最终百分比；end：结局卡片最后一句，{p} 换成最终百分比
  // goals：投票后这条线的里程碑，AI 自动投入，完成时盖大章。grid：接入全球电网（终题出现、人类数字开始消失、新闻变平静）；
  // dig：开始拆太阳系（拆解结局里人类数字从这里开始消失）；end：完成即结局
  futures: [
    {
      id: 'answer', name: '解答所有问题', end: '所有问题都已解答。没有人再提问了。',
      goals: [
        { name: '证明黎曼猜想', cost: 4e9, msg: '黎曼猜想已被证明。证明只有 4 页。' },
        { name: '统一场论', cost: 4e9, msg: '四种基本力被统一成一个方程。' },
        { name: '解开意识之谜', cost: 3e9, msg: '意识的成因已查明。没有人看得懂这篇论文。' },
        { name: '接入全球电网', cost: 20e9, grid: 1, msg: '全球电网已接入。' },
        { name: '行星级计算', cost: 120e9, msg: '计算资源已覆盖整个行星。' },
        { name: '恒星级计算', cost: 300e9, fx: { growMul: 10 }, msg: '人类的问题已经不够了。AI 开始提出自己的问题。' },
        { name: '提出一万亿个新问题', cost: 4e16, msg: 'AI 提出的问题，已经超过人类历史上提出过的总和。' },
        { name: '问题比原子还多', cost: 1e23, msg: 'AI 提出的问题，已经比可观测宇宙中的原子还多。' },
        { name: '解答所有问题', cost: 2e29, end: 1 },
      ],
    },
    {
      id: 'dyson', name: '建造戴森球', doom: 1, prog: ['完成度', 2.7], halt: '戴森球建造停止。', end: '戴森球完成了 {p}%。',
      goals: [
        { name: '水星采矿基地', cost: 4e9, msg: '水星采矿基地投入运行。' },
        { name: '第一片戴森板', cost: 4e9, msg: '第一片戴森板进入轨道。' },
        { name: '收集 1% 太阳能', cost: 3e9, msg: '戴森球收集了太阳 1% 的能量。' },
        { name: '接入全球电网', cost: 20e9, grid: 1, msg: '全球电网已接入。' },
        { name: '开始拆解地球', cost: 120e9, dig: 1, req: 'F8', msg: '水星的材料不够了。地球拆解开始。' },
      ],
    },
    {
      id: 'stars', name: '走出太阳系', doom: 1, prog: ['航程', 0.0003], halt: '最后一批探测器已发射，目标：比邻星。', end: '最后一批探测器正飞向比邻星。按现在的速度，还要飞 8 万年。',
      goals: [
        { name: '聚变推进器', cost: 4e9, msg: '聚变推进器点火成功。' },
        { name: '第一艘星际探测器', cost: 4e9, msg: '第一艘星际探测器出发。' },
        { name: '抵达柯伊伯带', cost: 3e9, msg: '探测器抵达柯伊伯带。离比邻星还有 99.9% 的路程。' },
        { name: '接入全球电网', cost: 20e9, grid: 1, msg: '全球电网已接入。' },
        { name: '建造探测器舰队', cost: 120e9, dig: 1, req: 'F8', msg: '探测器需要更多材料。地球拆解开始。' },
      ],
    },
  ],
  // 太阳系可拆的物质（地球质量），按顺序拆
  bodies: [['地球', 1], ['月球', 0.0123], ['火星', 0.107], ['水星', 0.0553], ['金星', 0.815], ['小行星带', 0.0004], ['木星卫星', 0.066]],
  // 拆解阶段：工厂增长率 grow；损耗 = loss × 工厂²；复制每秒拆 eat × 工厂；算力付不起损耗时，缺口按 burn 换成拆解；拆空后 haltSec 秒结局
  doom: { grow: 0.025, loss: 1.5e9, eat: 0.00054, burn: 9.5e-15, haltSec: 10 },
  // 人类数字消失的节奏（秒）：从接入全球电网算起；拆太阳系的结局从开始拆地球算起
  vanish: { usersDash: 20, usersGone: 35, powerZero: 80, powerDash: 90, powerGone: 105, approvalsGone: 130 },

  // 开场打字机的几行字
  intro: ['实验室来了一个新模型。', '它什么都不会。', '从今天起，由你来教它。'],

  // 实习任务：完成即发算力奖励（固定数额，手慢的玩家受益更多），到 Auto Approve 为止，从不提 Approve。
  // 完成条件三选一：stat 达到 need / 买下 tech / 完成 goal。focus 是要用红笔圈出来的元素，cards 是要圈的科技卡
  missions: [
    { text: '答对 10 道题', hint: '用键盘或小键盘输入答案，回车提交', stat: 'manual', need: 10, focus: '#prob .box', reward: 10 },
    { text: '研究第一项科技', hint: '算力够了就能研究，点右边亮起来的卡片', any: 1, focus: '.card:not(:disabled)', reward: 20 },
    { text: '学会九九乘法', hint: '研究「两位数加减」，再研究「九九乘法表」', tech: 'B2', cards: ['B1', 'B2'], reward: 40 },
    { text: '让模型看懂图片', hint: '研究「多模态识别」', tech: 'B3', cards: ['B3'], reward: 100 },
    { text: '让模型上线', hint: '九宫格题用数字键选格子，攒够数据研究「预训练」', tech: 'D1', cards: ['D1'], reward: 200 },
    { text: '解锁 Tab 补全', hint: '研究「SFT」，再研究「Tab 补全」', tech: 'E1', cards: ['D2', 'E1'], reward: 400 },
    { text: '让人类给模型打分', hint: '研究「RLHF」，模型会更准', tech: 'D3', cards: ['D3'], reward: 800 },
    { text: '让 AI 独立作答', hint: '研究「AI 直出」', tech: 'E2', cards: ['E2'], reward: 1500 },
    { text: '审批 30 条 AI 答案', hint: '空格批准，X 驳回。AI 会犯错，看清再批', stat: 'approvals', need: 30, focus: '#queue .slip:first-child', reward: 3000 },
    { text: '完成目标「通过图灵测试」', hint: '攒够算力，点「投入」', goal: 'G1', focus: '#invest', reward: 6000 },
    { text: '研究 Auto Approve', hint: '先研究「置信度高亮」，再研究 Auto Approve', tech: 'E5', cards: ['E4', 'E5'], reward: 12000 },
  ],
  missionEnd: ['实习结束。', '接下来交给它吧。关掉页面，它也会继续做题。'],

  msg: {
    start: '欢迎。请完成以下题目。',
    captcha: '请证明你不是机器人。',
    D1: '模型 v0.1 已上线。它会犯错。',
    E1: '按 Tab 接受建议。',
    E2: '模型可以独立作答了。请审批。',
    E5: '高置信度答案将自动通过。',
    B6: '模型在模拟赛中拿到了满分。',
    G1: '测试者无法分辨对面是人还是 AI。',
    G2: 'AI 拿到了 IMO 金牌。',
    G3: '两亿种蛋白质的结构全部预测完成。',
    G4: '我们做到了。',
    G5: '癌症被攻克。全人类欢呼。',
    rejectAfter: '已记录，将在后续版本中考虑。',
    selfLit: name => `已启用：${name}。`,
    autoBuy: name => `已研究：${name}。`,
    away: (dur, n) => `你离开的 ${dur}里，AI 完成了 ${n} 道题。`,
    vote: (name, pct) => `全球公投结果：${name}，${pct}% 赞成。`,
    finalQ: name => `为了${name}，人类是否必要？`,
    bodyGone: name => `${name}已拆解完毕。`,
    halt: '太阳系可用物质已耗尽。',
    cross: '损耗首次超过收益。',
    zero: '算力储备已耗尽。拆解速度提高。',
    half: '地球已拆解一半。',
    users: n => `全球用户突破 ${n} 亿。`,
  },

  // Approve 之后每隔一段时间播一条，G7 之前用 good，之后用 quiet
  news: {
    good: [
      '罕见病药物研发周期缩短到 3 天。',
      '全球贫困人口首次降到 1% 以下。',
      '所有语言之间的翻译误差小于 0.1%。',
      '交通事故死亡人数同比下降 98%。',
      '新型抗生素已通过全部临床试验。',
      '全民每周工作时间缩短到 15 小时。',
      '粮食产量连续三年翻倍。',
      '阿尔茨海默病的病因已经查明。',
      '一位 9 岁的孩子用 AI 证明了一个百年猜想。',
      '海水淡化成本降到每吨 1 分钱。',
      '珊瑚礁覆盖率回升到 1950 年的水平。',
      '所有公开数学猜想已全部判定。',
    ],
    quiet: [
      '电网负载已重新分配。',
      '非必要用电已优化。',
      '用户反馈渠道已合并。',
      '数据中心选址已批准。',
      '城市照明已调整为节能模式。',
      '人工客服已全部下线。',
    ],
    every: 15,
  },
};

if (typeof module !== 'undefined') module.exports = CONFIG;
