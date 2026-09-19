(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports) module.exports=api;
  else root.ListinoDiff=api;
})(typeof self!=="undefined"?self:this,function(){
  const LIMITS={csvChars:5_000_000,csvRows:10_000,csvColumns:100,fieldChars:10_000};

  function norm(value){
    return String(value??"").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }

  function protectSpreadsheetText(value){
    const s=String(value??"");
    return /^\s*[=+\-@]/.test(s)?"'"+s:s;
  }

  function unprotectSpreadsheetText(value){
    const s=String(value??"");
    return /^'\s*[=+\-@]/.test(s)?s.slice(1):s;
  }

  function detectDelimiter(text){
    const line=String(text).replace(/^\uFEFF/,"").split(/\r?\n/).find(x=>x.trim())||"";
    const counts={",":0,";":0,"\t":0};
    let quoted=false;
    for(let i=0;i<line.length;i++){
      const ch=line[i];
      if(ch==='"') quoted=!quoted;
      else if(!quoted && Object.prototype.hasOwnProperty.call(counts,ch)) counts[ch]++;
    }
    return Object.entries(counts).sort((a,b)=>b[1]-a[1])[0][0];
  }

  function parseCSV(text){
    const s=String(text).replace(/^\uFEFF/,"");
    if(s.length>LIMITS.csvChars) throw new Error("CSV troppo grande.");
    const rows=[];let row=[];let field="";let quoted=false;
    const delimiter=detectDelimiter(s);
    function pushField(){
      if(field.length>LIMITS.fieldChars) throw new Error("Campo CSV troppo lungo.");
      row.push(field);field="";
      if(row.length>LIMITS.csvColumns) throw new Error("Troppe colonne nel CSV.");
    }
    function pushRow(){
      if(row.some(v=>String(v).trim()!=="")) rows.push(row);
      row=[];
      if(rows.length>LIMITS.csvRows+1) throw new Error("Troppe righe nel CSV.");
    }
    for(let i=0;i<s.length;i++){
      const ch=s[i],next=s[i+1];
      if(ch==='"'){
        if(quoted&&next==='"'){field+='"';i++;}
        else quoted=!quoted;
      }else if(ch===delimiter&&!quoted){pushField();}
      else if((ch==="\n"||ch==="\r")&&!quoted){
        if(ch==="\r"&&next==="\n") i++;
        pushField();pushRow();
      }else{
        field+=ch;
        if(field.length>LIMITS.fieldChars) throw new Error("Campo CSV troppo lungo.");
      }
    }
    pushField();pushRow();
    if(rows.length<2) throw new Error("Il CSV non contiene righe dati.");
    const headers=rows[0].map(h=>String(h).trim());
    if(headers.length<2) throw new Error("Separatore CSV non riconosciuto.");
    return rows.slice(1).map(r=>{
      const obj={};
      headers.forEach((h,i)=>obj[h]=String(r[i]??"").trim());
      return obj;
    });
  }

  function detectColumn(headers,candidates){
    const normalized=headers.map(h=>norm(h));
    for(const candidate of candidates){
      const idx=normalized.indexOf(norm(candidate));
      if(idx>=0) return headers[idx];
    }
    return null;
  }

  function parsePrice(value){
    let s=String(value??"").trim().replace(/[€$£\s]/g,"");
    if(!s) return NaN;
    const comma=s.lastIndexOf(","),dot=s.lastIndexOf(".");
    if(comma>=0&&dot>=0){
      if(comma>dot) s=s.replace(/\./g,"").replace(",",".");
      else s=s.replace(/,/g,"");
    }else if(comma>=0) s=s.replace(",",".");
    const n=Number(s);
    return Number.isFinite(n)?n:NaN;
  }

  function schema(rows){
    const headers=Object.keys(rows[0]||{});
    const sku=detectColumn(headers,["sku","codice","codice articolo","codice prodotto","id","product id"]);
    const name=detectColumn(headers,["nome","prodotto","descrizione","articolo","name","product"]);
    const reportOld=detectColumn(headers,["prezzo precedente"]);
    const reportNew=detectColumn(headers,["prezzo nuovo"]);
    const reportStatus=detectColumn(headers,["stato"]);
    if(reportOld&&reportNew&&reportStatus){
      throw new Error("Questo file e un report di confronto. Usa 'Esporta listino' per ottenere un CSV reimportabile.");
    }
    const price=detectColumn(headers,["prezzo","costo","price","unit price","prezzo unitario"]);
    if(!sku||!price) throw new Error("Servono almeno una colonna SKU/codice e una colonna prezzo/costo.");
    return {sku,name,price};
  }

  function compare(oldRows,newRows){
    const a=schema(oldRows),b=schema(newRows);
    const oldMap=new Map(oldRows.map(r=>[unprotectSpreadsheetText(r[a.sku]).trim(),r]));
    const newMap=new Map(newRows.map(r=>[unprotectSpreadsheetText(r[b.sku]).trim(),r]));
    const keys=[...new Set([...oldMap.keys(),...newMap.keys()])].filter(Boolean).sort();
    const items=keys.map(sku=>{
      const o=oldMap.get(sku),n=newMap.get(sku);
      const oldPrice=o?parsePrice(o[a.price]):NaN;
      const newPrice=n?parsePrice(n[b.price]):NaN;
      if(o&&Number.isNaN(oldPrice)) throw new Error("Prezzo non valido nel vecchio listino per SKU "+sku+".");
      if(n&&Number.isNaN(newPrice)) throw new Error("Prezzo non valido nel nuovo listino per SKU "+sku+".");
      let status="unchanged";
      if(!o) status="new";
      else if(!n) status="removed";
      else if(newPrice>oldPrice) status="increased";
      else if(newPrice<oldPrice) status="decreased";
      const delta=o&&n?newPrice-oldPrice:null;
      const pct=o&&n&&oldPrice!==0?(delta/oldPrice)*100:null;
      const rawName=(n&&b.name&&n[b.name])||(o&&a.name&&o[a.name])||"";
      const name=unprotectSpreadsheetText(rawName);
      if(name.length>LIMITS.fieldChars) throw new Error("Nome prodotto troppo lungo per SKU "+sku+".");
      return {sku,name,oldPrice:o?oldPrice:null,newPrice:n?newPrice:null,delta,pct,status};
    });
    const summary={total:items.length,increased:0,decreased:0,new:0,removed:0,unchanged:0};
    items.forEach(x=>summary[x.status]++);
    return {items,summary};
  }

  function escapeCsv(value){
    const s=String(value??"");
    return /[",;\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }

  function reportCSV(items){
    const head=["SKU","Prodotto","Prezzo precedente","Prezzo nuovo","Delta","Delta %","Stato"];
    const rows=items.map(x=>[
      protectSpreadsheetText(x.sku),
      protectSpreadsheetText(x.name),
      x.oldPrice==null?"":x.oldPrice.toFixed(2),
      x.newPrice==null?"":x.newPrice.toFixed(2),
      x.delta==null?"":x.delta.toFixed(2),
      x.pct==null?"":x.pct.toFixed(2),
      x.status
    ]);
    return [head,...rows].map(r=>r.map(escapeCsv).join(",")).join("\n");
  }

  function currentListCSV(items){
    const head=["sku","nome","prezzo"];
    const rows=items
      .filter(x=>x.newPrice!=null&&x.status!=="removed")
      .map(x=>[protectSpreadsheetText(x.sku),protectSpreadsheetText(x.name),x.newPrice.toFixed(2)]);
    return [head,...rows].map(r=>r.map(escapeCsv).join(",")).join("\n");
  }

  return {
    LIMITS,parseCSV,parsePrice,compare,reportCSV,currentListCSV,
    protectSpreadsheetText,unprotectSpreadsheetText
  };
});