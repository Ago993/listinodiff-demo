const assert=require("assert");
const fs=require("fs");
const path=require("path");
const core=require("../core.js");
const html=fs.readFileSync(path.join(__dirname,"../index.html"),"utf8");
const app=fs.readFileSync(path.join(__dirname,"../app.js"),"utf8");

const xss='<svg onload=alert(1)>';
const oldRows=core.parseCSV('sku,nome,prezzo\n=1+1,"'+xss+'",10\n');
const result=core.compare(oldRows,oldRows);
assert.equal(result.items[0].sku,"=1+1");
assert.equal(result.items[0].name,xss);

const exported=core.currentListCSV(result.items);
assert.ok(exported.includes("'=1+1"));
const roundtrip=core.compare(core.parseCSV(exported),core.parseCSV(exported));
assert.equal(roundtrip.items[0].sku,"=1+1");
assert.equal(roundtrip.items[0].name,xss);

assert.throws(()=>core.parseCSV("a,b\n"+"x".repeat(core.LIMITS.fieldChars+1)+",1"),/troppo lungo/i);
assert.ok(/Content-Security-Policy/.test(html));
assert.ok(/script-src 'self'/.test(html));
assert.ok(/object-src 'none'/.test(html));
assert.ok(!/innerHTML|insertAdjacentHTML|document\.write|\beval\s*\(|new Function/.test(app));
console.log("OK - ListinoDiff security tests passed");
