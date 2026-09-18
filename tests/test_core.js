const assert=require("assert");
const fs=require("fs");
const path=require("path");
const core=require("../core.js");

const oldText=fs.readFileSync(path.join(__dirname,"../samples/old_prices.csv"),"utf8");
const newText=fs.readFileSync(path.join(__dirname,"../samples/new_prices.csv"),"utf8");
const oldRows=core.parseCSV(oldText);
const newRows=core.parseCSV(newText);
const result=core.compare(oldRows,newRows);

assert.equal(result.summary.total,7);
assert.equal(result.summary.increased,2);
assert.equal(result.summary.decreased,2);
assert.equal(result.summary.new,1);
assert.equal(result.summary.removed,1);
assert.equal(result.summary.unchanged,1);

const coffee=result.items.find(x=>x.sku==="A100");
assert.equal(coffee.status,"increased");
assert.equal(coffee.oldPrice,18.5);
assert.equal(coffee.newPrice,19.9);

const removed=result.items.find(x=>x.sku==="A140");
assert.equal(removed.status,"removed");

const quoted=core.parseCSV('sku,nome,prezzo\n1,"Prodotto, speciale","1,99"\n');
assert.equal(quoted[0].nome,"Prodotto, speciale");
assert.equal(core.parsePrice(quoted[0].prezzo),1.99);

const report=core.reportCSV(result.items);
assert.ok(report.includes("Prezzo precedente"));
assert.ok(report.includes("A100"));

console.log("OK - all ListinoDiff tests passed");
