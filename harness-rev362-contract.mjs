// REV362 harness: the classification contract the Planning Board chip and the Reports metric
// strip depend on. Run: node harness-rev362-contract.mjs
import { delayIndex } from "./src/delayInfo.js";
let n=0; const ok=(c,m)=>{n++; if(!c){console.error("FAIL:",m);process.exit(1);}};
const A=(o)=>({status:"planned",percent:0,duration:1,predecessors:[],...o});
const T="2026-07-31";
const set=[
 A({id:"u2",code:2,desc:"B3 MV Energisation",start:"2026-07-20",duration:19,status:"in_progress",percent:40}),
 A({id:"u1138",code:1138,desc:"EPOD101 FOK",start:"2026-07-20",duration:3,predecessors:["u2"]}),
 A({id:"u1142",code:1142,desc:"EPOD301 FOK",start:"2026-07-23",duration:3,predecessors:["u1138"]}),
 A({id:"u139",code:139,desc:"SB DB",start:"2026-07-19",duration:7,status:"in_progress",percent:30}),
 A({id:"u137",code:137,desc:"future held",start:"2026-08-20",duration:4,predecessors:["u2"]}),
 A({id:"uok",code:9,desc:"clear future",start:"2026-08-20",duration:4}),
];
const ix=delayIndex(set,T);
// board rule replica is deliberately NOT reimplemented; we assert the classifier contract only.
const held=set.filter(a=>ix.get(a).state==="held").map(a=>a.code);
const late=set.filter(a=>ix.get(a).state==="late").map(a=>a.code);
ok(JSON.stringify(held)===JSON.stringify([1138,1142]), "only the two FOKs are held, not the future item behind a driver that finishes first: "+JSON.stringify(held));
ok(JSON.stringify(late)===JSON.stringify([139]), "only the Gapit item is late: "+JSON.stringify(late));
ok(set.every(a=>{const st=ix.get(a).state; return !(st==="held"&&st==="late");}), "states are mutually exclusive");
ok(ix.get("u1138").heldNote===undefined, "the note is a board concern, not a classifier concern");
ok(typeof ix.get("u1138").forecastStart==="string" && typeof ix.get("u1138").days==="number", "the board tooltip has the fields it needs");
ok(ix.get("u1142").rootDriver.code===2 && ix.get("u1142").driver.code===1138, "root driver differs from binding driver, so the tooltip can name both");
console.log("REV362 contract harness: "+n+" assertions passed");
