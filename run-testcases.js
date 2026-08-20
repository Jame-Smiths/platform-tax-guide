// AI 生成测试用例套件（竞赛加分项：AI 用于质量保障的留痕）
// 覆盖策略：税率表档位边界 + 政策临界点（月10万/200万减半）+ 判定阈值全扫描 + 状态机回归 + 异常输入健壮性
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
js += `
;globalThis.__T = {
  calcLabor, calcBiz, calcVAT, judge, CASES, state,
  renderQuiz, renderResult, startCase, startManual, backFromData, nextQ, goResult, goHome,
  get qi(){ return qi; }, set qi(v){ qi = v; },
  get current(){ return current; }, set current(v){ current = v; }
};`;

const store = {};
global.document = { getElementById: id => ({ innerHTML: "", value: store[id] ?? "", style: {}, disabled: false }) };
global.window = { scrollTo(){}, print(){} };

eval(js);
const T = global.__T;
const { calcLabor, calcBiz, calcVAT, judge, CASES, state } = T;

/* ---------- 用例定义 ---------- */
const OPP = { q4:"否", q5:"否", q6:"平台定价、按单计酬", q7:"否", q8:"单一平台/单一公会" };
const LEAN = { q4:"是", q5:"是", q6:"自主定价、自负盈亏", q7:"是", q8:"多个平台、面向市场" };
function mix(n){
  const a = { q1:"否", q2:"否", q3:"否", ...OPP };
  ["q4","q5","q6","q7","q8"].slice(0, n).forEach(k => a[k] = LEAN[k]);
  return a;
}
function setupCase(id){
  const c = CASES.find(x => x.id === id);
  state.caseId = id; state.ans = { ...c.ans }; state.flags = [ ...c.flags ];
  state.income = c.income; state.costs = c.costs; state.main = c.main;
}

const TCs = [
  /* === A 劳务报酬路径：起扣点 + 七档税率边界 === */
  { id:"A-01", cat:"个税·劳务", desc:"收入 75,000 → 减除费用后恰为 60,000 起扣点", run:()=>calcLabor(75000).tax, want:0 },
  { id:"A-02", cat:"个税·劳务", desc:"收入 76,000 → 应税所得 800（3% 档起步）", run:()=>calcLabor(76000).tax, want:24 },
  { id:"A-03", cat:"个税·劳务", desc:"应税所得恰 36,000（3% 档上限）", run:()=>calcLabor(120000).tax, want:1080 },
  { id:"A-04", cat:"个税·劳务", desc:"应税所得 36,080（跨入 10% 档）", run:()=>calcLabor(120100).tax, want:1088 },
  { id:"A-05", cat:"个税·劳务", desc:"应税所得恰 144,000（10% 档上限）", run:()=>calcLabor(255000).tax, want:11880 },
  { id:"A-06", cat:"个税·劳务", desc:"应税所得 144,800（跨入 20% 档）", run:()=>calcLabor(256000).tax, want:12040 },
  { id:"A-07", cat:"个税·劳务", desc:"应税所得恰 300,000（20% 档上限）", run:()=>calcLabor(450000).tax, want:43080 },
  { id:"A-08", cat:"个税·劳务", desc:"应税所得恰 420,000（25% 档上限）", run:()=>calcLabor(600000).tax, want:73080 },
  { id:"A-09", cat:"个税·劳务", desc:"应税所得恰 660,000（30% 档上限）", run:()=>calcLabor(900000).tax, want:145080 },
  { id:"A-10", cat:"个税·劳务", desc:"应税所得恰 960,000（35% 档上限）", run:()=>calcLabor(1275000).tax, want:250080 },
  { id:"A-11", cat:"个税·劳务", desc:"应税所得 960,002（跨入 45% 档）", run:()=>calcLabor(1275002).tax, want:250081 },
  { id:"A-12", cat:"个税·劳务", desc:"收入 60,000 以下 → 应税所得为 0", run:()=>calcLabor(60000).tax, want:0 },
  { id:"A-13", cat:"健壮性", desc:"收入 0 → 不崩溃、税额 0", run:()=>calcLabor(0).tax, want:0 },
  { id:"A-14", cat:"健壮性", desc:"负数收入 → 应税所得钳制为 0", run:()=>calcLabor(-5000).tax, want:0 },

  /* === B 经营所得：五档边界 + 200 万减半临界 === */
  { id:"B-01", cat:"个税·经营", desc:"应税所得恰 30,000（5% 档上限，减半后 750）", run:()=>calcBiz(30000,0).tax, want:750 },
  { id:"B-02", cat:"个税·经营", desc:"应税所得恰 90,000（10% 档上限，减半后 3,750）", run:()=>calcBiz(90000,0).tax, want:3750 },
  { id:"B-03", cat:"个税·经营", desc:"应税所得恰 300,000（20% 档上限，减半后 24,750）", run:()=>calcBiz(300000,0).tax, want:24750 },
  { id:"B-04", cat:"个税·经营", desc:"应税所得恰 500,000（30% 档上限，减半后 54,750）", run:()=>calcBiz(500000,0).tax, want:54750 },
  { id:"B-05", cat:"个税·经营", desc:"应税所得恰 2,000,000（减半优惠全额适用临界）", run:()=>calcBiz(2000000,0).tax, want:317250 },
  { id:"B-06", cat:"个税·经营", desc:"应税所得 2,100,000（超出部分不减半）", run:()=>calcBiz(2100000,0).tax, want:352250 },
  { id:"B-07", cat:"个税·经营", desc:"应税所得 2,500,000（减半仅作用于前 200 万）", run:()=>calcBiz(2500000,0).tax, want:492250 },
  { id:"B-08", cat:"健壮性", desc:"成本大于收入 → 应税所得为 0", run:()=>calcBiz(50000,80000).tax, want:0 },
  { id:"B-09", cat:"个税·经营", desc:"小额经营 10,000 → 500×减半=250", run:()=>calcBiz(10000,0).tax, want:250 },

  /* === C 增值税与附加：月 10 万临界（含本数） === */
  { id:"C-01", cat:"增值税", desc:"年收入 1,200,000 → 月均恰 100,000，含本数免征", run:()=>calcVAT(1200000).vat, want:0 },
  { id:"C-02", cat:"增值税", desc:"年收入 1,200,001 → 月均超 10 万，按 1% 计征", run:()=>calcVAT(1200001).vat, want:11881 },
  { id:"C-03", cat:"增值税", desc:"附加税费 = 增值税 × 12% × 50%（六税两费减半）", run:()=>calcVAT(1200001).sur, want:713 },
  { id:"C-04", cat:"增值税", desc:"年收入 1,500,000 → 增值税 14,851（1% 征收率）", run:()=>calcVAT(1500000).vat, want:14851 },
  { id:"C-05", cat:"增值税", desc:"年收入 1,439,988 → 月均 119,999，增值税 14,257", run:()=>calcVAT(1439988).vat, want:14257 },

  /* === D 判定引擎：三个分流 + 阈值 0–5 项全扫描 === */
  { id:"D-01", cat:"判定·分流", desc:"Q1 是 → 工资薪金", run:()=>judge({ q1:"是" }), want:"wage" },
  { id:"D-02", cat:"判定·分流", desc:"Q2 是 → 便民劳务", run:()=>judge({ q1:"否", q2:"是" }), want:"convenience" },
  { id:"D-03", cat:"判定·分流", desc:"Q3 是 → 已登记经营所得", run:()=>judge({ q1:"否", q2:"否", q3:"是" }), want:"business" },
  { id:"D-04", cat:"判定·阈值", desc:"经营倾向 0/5 → 劳务报酬", run:()=>judge(mix(0)), want:"labor" },
  { id:"D-05", cat:"判定·阈值", desc:"经营倾向 1/5 → 劳务报酬", run:()=>judge(mix(1)), want:"labor" },
  { id:"D-06", cat:"判定·阈值", desc:"经营倾向 2/5 → 劳务报酬", run:()=>judge(mix(2)), want:"labor" },
  { id:"D-07", cat:"判定·阈值", desc:"经营倾向 3/5 → 实质经营所得（阈值线上）", run:()=>judge(mix(3)), want:"deFacto" },
  { id:"D-08", cat:"判定·阈值", desc:"经营倾向 5/5 → 实质经营所得", run:()=>judge(mix(5)), want:"deFacto" },
  { id:"D-09", cat:"健壮性", desc:"答案不完整（只答 Q1Q2）→ 不崩溃，判劳务", run:()=>judge({ q1:"否", q2:"否" }), want:"labor" },

  /* === E 状态机与流程回归 === */
  { id:"E-01", cat:"流程", desc:"主播案例：startCase → 问询页第 1 题", run:()=>{ setupCase("streamer"); T.startCase("streamer"); return T.current; }, want:"quiz" },
  { id:"E-02", cat:"流程", desc:"主播案例：连点 8 次下一题 → 数据页", run:()=>{ setupCase("streamer"); T.startCase("streamer"); for(let i=0;i<8;i++) T.nextQ(); return T.current; }, want:"data" },
  { id:"E-03", cat:"流程", desc:"主播案例：数据页生成报告 → 结果页含差额 89,630", run:()=>{
    setupCase("streamer"); T.startCase("streamer"); for(let i=0;i<8;i++) T.nextQ();
    store["in-income"]="960000"; store["in-costs"]="360000"; store["in-main"]="0";
    T.goResult(); return T.renderResult().includes("89,630") ? "result" : "missing";
  }, want:"result" },
  { id:"E-04", cat:"流程", desc:"便民劳务返回机制：数据页 → 回 Q2 → 再下一题 → 回数据页（无死循环）", run:()=>{
    setupCase("driver"); T.startCase("driver");
    T.backFromData(); const qi1 = T.qi;
    T.nextQ(); return qi1 + "→" + T.current;
  }, want:"1→data" },
  { id:"E-05", cat:"流程", desc:"收入为 0：生成报告被拦截，停留在数据页", run:()=>{
    setupCase("streamer"); T.startCase("streamer"); for(let i=0;i<8;i++) T.nextQ();
    store["in-income"]="0"; store["in-costs"]="0"; store["in-main"]="0";
    T.goResult(); return T.current;
  }, want:"data" },
  { id:"E-06", cat:"流程", desc:"四案例判定与预置答案一致", run:()=>{
    const got = CASES.map(c => judge(c.ans)).join(",");
    return got;
  }, want:"deFacto,labor,convenience,business" }
];

/* ---------- 执行 ---------- */
let pass = 0, fail = 0;
for(const tc of TCs){
  let got, ok;
  try { got = tc.run(); ok = got === tc.want; }
  catch(e){ got = "异常: " + e.message; ok = false; }
  if(ok) pass++; else fail++;
  console.log((ok ? "PASS" : "FAIL") + "  " + tc.id + "  " + tc.desc + "  →  got=" + got + (ok ? "" : "  want=" + tc.want));
}
console.log("\n" + TCs.length + " 项用例：" + pass + " 通过 / " + fail + " 失败");
process.exit(fail === 0 ? 0 : 1);
