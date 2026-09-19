const assert=require("assert");
const fs=require("fs");
const path=require("path");
const core=require("../core.js");

const oldText=fs.readFileSync(path.join(__dirname,"../samples/old_prices.csv"),"utf8");
const newText=fs.readFileSync(path.join(__dirname,"../samples/new_prices.csv"),"utf8");
const result=core.compare(core.parseCSV(oldText),core.parseCSV(newText));
assert.equal(result.summary.total,7);
assert.equal(result.summary.increased,2);
assert.equal(result.summary.decreased,2);
assert.equal(result.summary.new,1);
assert.equal(result.summary.removed,1);
assert.equal(result.summary.unchanged,1);

const coffee=result.items.find(x=>x.sku==="A100");
assert.equal(coffee.oldPrice,18.5);
assert.equal(coffee.newPrice,19.9);

const semicolon=core.parseCSV('sku;nome;prezzo\nA1;Prodotto A;12,50\nA2;Prodotto B;9,90\n');
assert.equal(core.parsePrice(semicolon[0].prezzo),12.5);

const report=core.reportCSV(result.items);
let reportRejected=false;
try{core.compare(core.parseCSV(report),core.parseCSV(report));}catch(err){reportRejected=/report di confronto/.test(err.message);}
assert.equal(reportRejected,true);

const current=core.currentListCSV(result.items);
const reimported=core.parseCSV(current);
assert.equal(reimported.length,6);
assert.equal(core.compare(reimported,reimported).summary.unchanged,6);

const formulaSku="=1+1";
const formulaName='@SUM(1,1)';
const hostileItems=[{sku:formulaSku,name:formulaName,oldPrice:1,newPrice:2,delta:1,pct:100,status:"increased"}];
const protectedList=core.currentListCSV(hostileItems);
assert.ok(protectedList.includes("'=1+1"));
assert.ok(protectedList.includes("'@SUM"));
const protectedRows=core.parseCSV(protectedList);
const restored=core.compare(protectedRows,protectedRows);
assert.equal(restored.items[0].sku,formulaSku);
assert.equal(restored.items[0].name,formulaName);

const htmlPayload='<svg onload=alert(1)>';
const xssOld=core.parseCSV('sku,nome,prezzo\nX1,"'+htmlPayload+'",1\n');
const xssNew=core.parseCSV('sku,nome,prezzo\nX1,"'+htmlPayload+'",2\n');
assert.equal(core.compare(xssOld,xssNew).items[0].name,htmlPayload);

assert.throws(()=>core.parseCSV("x".repeat(core.LIMITS.csvChars+1)),/troppo grande/);
assert.ok(Number.isNaN(core.parsePrice("1e9999")));

const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const app=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");
assert.ok(/Content-Security-Policy/.test(html));
assert.ok(/script-src 'self'/.test(html));
assert.ok(/object-src 'none'/.test(html));
assert.ok(!/\.innerHTML\s*=/.test(app),"Dynamic data must not be rendered through innerHTML");

console.log("OK - ListinoDiff security and data tests passed");
