// v1.1 重构版测试：引擎数字 + 全部渲染路径完整性
// 注意：index.html 内脚本以 "use strict" 开头，strict eval 的声明不泄漏，
// 因此把导出语句追加到被 eval 的代码内部，经 __T 访问。
const fs = require("fs");
const html = fs.readFileSync(__dirname + "/index.html", "utf8");
let js = html.match(/<script>([\s\S]*)<\/script>/)[1];
js += `
;globalThis.__T = {
  calcLabor, calcBiz, calcVAT, judge, CASES,
  state,
  renderHome, renderQuiz, renderData, renderResult,
  startCase, startManual, backFromData, nextQ, prevQ, goHome,
  get qi(){ return qi; }, set qi(v){ qi = v; },
  get current(){ return current; }, set current(v){ current = v; }
};`;

// DOM 桩
const store = {};
global.document = { getElementById: id => ({ innerHTML: "", value: store[id] ?? "", style: {} }) };
global.window = { scrollTo(){}, print(){} };
global.location = {};

eval(js);
const T = global.__T;
const { calcLabor, calcBiz, calcVAT, judge, CASES, state } = T;
let qiGet = () => T.qi, curGet = () => T.current;

let fail = 0;
function eq(name, got, want){ const ok = got === want; if(!ok) fail++; console.log((ok?"PASS":"FAIL") + "  " + name + "  got=" + got + " want=" + want); }
function has(htmlStr, needle, name){
  const ok = htmlStr.includes(needle); if(!ok) fail++;
  console.log((ok?"PASS":"FAIL") + "  " + name + " 包含「" + needle.slice(0,26) + "」");
}

console.log("=== 1. 引擎数字（应与人工对账一致） ===");
eq("calcLabor(960000).tax", calcLabor(960000).tax, 161880);
eq("calcLabor(960000).net", calcLabor(960000).net, 768000);
eq("calcBiz(960000,360000).tax", calcBiz(960000,360000).tax, 72250);
eq("calcBiz(960000,360000).relief", calcBiz(960000,360000).relief, 72250);
eq("calcVAT(960000).vat", calcVAT(960000).vat, 0);
eq("calcVAT(1200000).vat", calcVAT(1200000).vat, 0);
eq("calcVAT(1500000).vat", calcVAT(1500000).vat, 14851);
eq("calcVAT(1500000).sur", calcVAT(1500000).sur, 891);
eq("designer labor", calcLabor(180000).tax, 5880);
eq("designer biz", calcBiz(180000,6000).tax, 12150);
eq("driver labor", calcLabor(144000).tax, 3000);
eq("multi biz", calcBiz(600000,250000).tax, 32250);
eq("multi labor", calcLabor(600000).tax, 73080);
eq("calcBiz(2000000,0).tax", calcBiz(2000000,0).tax, 317250);
eq("calcBiz(3000000,500000).tax", calcBiz(3000000,500000).tax, 492250);

console.log("=== 2. 判定引擎 ===");
eq("q1=是 → wage", judge({q1:"是"}), "wage");
eq("q2=是 → convenience", judge({q1:"否",q2:"是"}), "convenience");
eq("q3=是 → business", judge({q1:"否",q2:"否",q3:"是"}), "business");
eq("streamer → deFacto", judge(CASES[0].ans), "deFacto");
eq("designer → labor", judge(CASES[1].ans), "labor");
eq("driver → convenience", judge(CASES[2].ans), "convenience");
eq("multi → business", judge(CASES[3].ans), "business");
eq("2/5 经营倾向 → labor", judge({q1:"否",q2:"否",q3:"否",q4:"是",q5:"是",q6:"平台定价、按单计酬",q7:"否",q8:"单一平台/单一公会"}), "labor");
eq("3/5 经营倾向 → deFacto", judge({q1:"否",q2:"否",q3:"否",q4:"是",q5:"是",q6:"自主定价、自负盈亏",q7:"否",q8:"单一平台/单一公会"}), "deFacto");

console.log("=== 3. 渲染完整性（每个页面渲染不抛异常且含关键内容） ===");
function setupCase(id){
  const c = CASES.find(x=>x.id===id);
  state.caseId = id; state.ans = {...c.ans}; state.flags = [...c.flags];
  state.income = c.income; state.costs = c.costs; state.main = c.main;
}

has(T.renderHome(), "选择演示案例", "首页");
has(T.renderHome(), "startCase('streamer')", "首页案例入口");

setupCase("streamer"); T.qi = 0;
has(T.renderQuiz(), "第 1 / 8 题", "问询页进度");
has(T.renderQuiz(), "pick('q1'", "问询页选项");

T.qi = 7;
has(T.renderData(), "生成报告", "数据页");
has(T.renderData(), "in-income", "数据页输入框");

const expectKey = [
  ["streamer", "实质经营所得"],
  ["streamer", "89,630"],
  ["streamer", "直播提示"],
  ["designer", "劳务报酬所得"],
  ["designer", "两处以上所得提示"],
  ["driver", "豁免报送 ≠ 免税"],
  ["multi", "已登记主体经营 → 经营所得"],
  ["multi", "刷单流水"],
  ["multi", "一人多号"],
  ["multi", "分拆收入"]
];
for(const [id, key] of expectKey){
  setupCase(id);
  has(T.renderResult(), key, id + " 结果");
}
// 非直播案例不显示直播口径提示
setupCase("designer");
if(T.renderResult().includes("直播提示")){ fail++; console.log("FAIL  designer 不应包含「直播提示」"); }
else console.log("PASS  designer 不显示直播提示");

state.ans = {q1:"是"}; state.caseId = null;
has(T.renderResult(), "工资薪金所得", "wage 分支");

T.startManual();
has(T.renderQuiz(), "手动模式", "手动模式问询页");

console.log("=== 4. 状态机导航 ===");
// convenience 返回：data → quiz 应回 Q2（qi=1）
setupCase("driver");
eq("driver judge", judge(state.ans), "convenience");
T.backFromData();
eq("backFromData(convenience).qi", T.qi, 1);
eq("backFromData(convenience).current", T.current, "quiz");
// 从 Q2 点下一题 → 应再入 data
T.qi = 1; T.nextQ();
eq("nextQ from q2 → data", T.current, "data");
// 正常流程 data 返回 → quiz Q8
setupCase("streamer"); T.qi = 7; T.backFromData();
eq("backFromData(streamer).qi", T.qi, 7);
eq("backFromData(streamer).current", T.current, "quiz");
// startCase 路由：streamer 从首页进 → quiz
setupCase("streamer"); T.startCase("streamer");
eq("streamer startCase → quiz", T.current, "quiz");
// wage 分支：Q1 答「是」后点下一题 → 直接进 result
state.ans = {q1:"是"}; T.qi = 0; T.current = "quiz"; T.nextQ();
eq("wage nextQ → result", T.current, "result");
// 首页
T.goHome(); eq("goHome → home", T.current, "home");

console.log(fail === 0 ? "\nALL PASS ✅" : "\n" + fail + " FAILED ❌");
process.exit(fail === 0 ? 0 : 1);
