(function(root,factory){
  const api=factory();
  if(typeof module==="object" && module.exports) module.exports=api;
  else root.ListinoDiff=api;
})(typeof self!=="undefined"?self:this,function(){
  function norm(value){
    return String(value??"").trim().toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g,"");
  }

  function parseCSV(text){
    const rows=[]; let row=[]; let field=""; let quoted=false;
    const s=String(text).replace(/^\uFEFF/,"");
    for(let i=0;i<s.length;i++){
      const ch=s[i], next=s[i+1];
      if(ch==='"'){
        if(quoted && next==='"'){field+='"';i++;}
        else quoted=!quoted;
      }else if(ch==="," && !quoted){row.push(field);field="";}
      else if((ch==="\n" || ch==="\r") && !quoted){
        if(ch==="\r" && next==="\n") i++;
        row.push(field); field="";
        if(row.some(v=>String(v).trim()!=="")) rows.push(row);
        row=[];
      }else field+=ch;
    }
    row.push(field);
    if(row.some(v=>String(v).trim()!=="")) rows.push(row);
    if(rows.length<2) throw new Error("Il CSV non contiene righe dati.");
    const headers=rows[0].map(h=>String(h).trim());
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
    const comma=s.lastIndexOf(","), dot=s.lastIndexOf(".");
    if(comma>=0 && dot>=0){
      if(comma>dot) s=s.replace(/\./g,"").replace(",",".");
      else s=s.replace(/,/g,"");
    }else if(comma>=0) s=s.replace(",",".");
    return Number(s);
  }

  function schema(rows){
    const headers=Object.keys(rows[0]||{});
    const sku=detectColumn(headers,["sku","codice","codice articolo","id","product id"]);
    const name=detectColumn(headers,["nome","prodotto","descrizione","articolo","name","product"]);
    const price=detectColumn(headers,["prezzo","costo","price","unit price","prezzo unitario"]);
    if(!sku || !price) throw new Error("Servono almeno una colonna SKU/codice e una colonna prezzo/costo.");
    return {sku,name,price};
  }

  function compare(oldRows,newRows){
    const a=schema(oldRows), b=schema(newRows);
    const oldMap=new Map(oldRows.map(r=>[String(r[a.sku]).trim(),r]));
    const newMap=new Map(newRows.map(r=>[String(r[b.sku]).trim(),r]));
    const keys=[...new Set([...oldMap.keys(),...newMap.keys()])].filter(Boolean).sort();
    const items=keys.map(sku=>{
      const o=oldMap.get(sku), n=newMap.get(sku);
      const oldPrice=o?parsePrice(o[a.price]):NaN;
      const newPrice=n?parsePrice(n[b.price]):NaN;
      if(o && Number.isNaN(oldPrice)) throw new Error("Prezzo non valido nel vecchio listino per SKU "+sku);
      if(n && Number.isNaN(newPrice)) throw new Error("Prezzo non valido nel nuovo listino per SKU "+sku);
      let status="unchanged";
      if(!o) status="new";
      else if(!n) status="removed";
      else if(newPrice>oldPrice) status="increased";
      else if(newPrice<oldPrice) status="decreased";
      const delta=o&&n?newPrice-oldPrice:null;
      const pct=o&&n&&oldPrice!==0?(delta/oldPrice)*100:null;
      return {
        sku,
        name:String((n&&n[b.name])||(o&&o[a.name])||""),
        oldPrice:o?oldPrice:null,
        newPrice:n?newPrice:null,
        delta,pct,status
      };
    });
    const summary={total:items.length,increased:0,decreased:0,new:0,removed:0,unchanged:0};
    items.forEach(x=>summary[x.status]++);
    return {items,summary};
  }

  function escapeCsv(value){
    const s=String(value??"");
    return /[",\n]/.test(s)?'"'+s.replace(/"/g,'""')+'"':s;
  }

  function reportCSV(items){
    const head=["SKU","Prodotto","Prezzo precedente","Prezzo nuovo","Delta","Delta %","Stato"];
    const rows=items.map(x=>[
      x.sku,x.name,
      x.oldPrice==null?"":x.oldPrice.toFixed(2),
      x.newPrice==null?"":x.newPrice.toFixed(2),
      x.delta==null?"":x.delta.toFixed(2),
      x.pct==null?"":x.pct.toFixed(2),
      x.status
    ]);
    return [head,...rows].map(r=>r.map(escapeCsv).join(",")).join("\n");
  }

  return {parseCSV,parsePrice,compare,reportCSV};
});