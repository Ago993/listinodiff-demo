const $=id=>document.getElementById(id);
let oldText="",newText="",lastResult=null;
const MAX_FILE_BYTES=5*1024*1024;

const labels={
  increased:"Aumento",
  decreased:"Ribasso",
  new:"Nuovo",
  removed:"Rimosso",
  unchanged:"Invariato"
};

function money(v){
  return v==null?"-":new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(v);
}
function pct(v){return v==null?"-":(v>0?"+":"")+v.toFixed(1)+"%";}
function delta(v){
  if(v==null) return "-";
  return (v>0?"+":"")+new Intl.NumberFormat("it-IT",{style:"currency",currency:"EUR"}).format(v);
}
function make(tag,text,className){
  const el=document.createElement(tag);
  if(text!==undefined&&text!==null) el.textContent=String(text);
  if(className) el.className=className;
  return el;
}
function refreshAnalyze(){ $("analyzeBtn").disabled=!(oldText&&newText); }
function showError(message){
  $("errorBox").textContent=message;
  $("errorBox").classList.remove("hidden");
}
function clearError(){
  $("errorBox").textContent="";
  $("errorBox").classList.add("hidden");
}

async function readTextFile(file){
  if(file.size>MAX_FILE_BYTES) throw new Error("File troppo grande. Limite: 5 MB.");
  const buffer=await file.arrayBuffer();
  try{
    return new TextDecoder("utf-8",{fatal:true}).decode(buffer);
  }catch{
    return new TextDecoder("windows-1252").decode(buffer);
  }
}

async function readFile(input,nameTarget,kind){
  const file=input.files[0];
  if(!file) return;
  try{
    const text=await readTextFile(file);
    if(kind==="old") oldText=text; else newText=text;
    $(nameTarget).textContent=file.name;
    clearError();
    refreshAnalyze();
  }catch(err){
    if(kind==="old") oldText=""; else newText="";
    $(nameTarget).textContent="Nessun file selezionato";
    refreshAnalyze();
    showError("Impossibile leggere il file: "+err.message);
  }
}

$("oldFile").addEventListener("change",e=>readFile(e.target,"oldName","old"));
$("newFile").addEventListener("change",e=>readFile(e.target,"newName","new"));

$("sampleBtn").addEventListener("click",async()=>{
  try{
    [oldText,newText]=await Promise.all([
      fetch("samples/old_prices.csv",{cache:"no-store"}).then(r=>{
        if(!r.ok) throw new Error("Vecchio listino demo non disponibile.");
        return r.text();
      }),
      fetch("samples/new_prices.csv",{cache:"no-store"}).then(r=>{
        if(!r.ok) throw new Error("Nuovo listino demo non disponibile.");
        return r.text();
      })
    ]);
    $("oldName").textContent="old_prices.csv (demo)";
    $("newName").textContent="new_prices.csv (demo)";
    clearError();
    refreshAnalyze();
    analyze();
  }catch(err){showError("Impossibile caricare i dati demo: "+err.message);}
});

$("analyzeBtn").addEventListener("click",analyze);
$("statusFilter").addEventListener("change",renderRows);
$("exportBtn").addEventListener("click",()=>{
  if(lastResult) downloadCSV(ListinoDiff.reportCSV(lastResult.items),"listinodiff-report.csv");
});
$("exportCurrentBtn").addEventListener("click",()=>{
  if(lastResult) downloadCSV(ListinoDiff.currentListCSV(lastResult.items),"listino-aggiornato.csv");
});

function downloadCSV(text,name){
  const blob=new Blob(["\uFEFF"+text],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob),a=document.createElement("a");
  a.href=url;a.download=name;a.click();URL.revokeObjectURL(url);
}

function analyze(){
  try{
    clearError();
    const oldRows=ListinoDiff.parseCSV(oldText);
    const newRows=ListinoDiff.parseCSV(newText);
    lastResult=ListinoDiff.compare(oldRows,newRows);
    renderSummary();
    $("statusFilter").value="all";
    renderRows();
    $("results").classList.remove("hidden");
    $("emptyState").classList.add("hidden");
    $("results").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(err){
    showError(err.message+" Formati supportati: CSV separati da virgola, punto e virgola o tab.");
  }
}

function renderSummary(){
  const s=lastResult.summary;
  const cards=[
    ["Articoli",s.total],
    ["Aumenti",s.increased],
    ["Ribassi",s.decreased],
    ["Nuovi",s.new],
    ["Rimossi",s.removed]
  ];
  const container=$("summary");
  container.replaceChildren();
  cards.forEach(([label,value])=>{
    const card=make("div",null,"metric");
    card.append(make("span",label),make("strong",value));
    container.append(card);
  });
}

function appendCell(row,text,className){
  const td=make("td",text,className);
  row.append(td);
}

function renderRows(){
  const filter=$("statusFilter").value;
  const rows=lastResult.items.filter(x=>filter==="all"||x.status===filter);
  const tbody=$("resultRows");
  tbody.replaceChildren();

  if(!rows.length){
    const tr=document.createElement("tr");
    const td=make("td","Nessun elemento per questo filtro.","empty");
    td.colSpan=7;tr.append(td);tbody.append(tr);
    return;
  }

  rows.forEach(x=>{
    const tr=document.createElement("tr");
    const cls=x.delta>0?"up":x.delta<0?"down":"";
    appendCell(tr,x.sku);
    appendCell(tr,x.name);
    appendCell(tr,money(x.oldPrice),"amount");
    appendCell(tr,money(x.newPrice),"amount");
    appendCell(tr,delta(x.delta),"delta "+cls);
    appendCell(tr,pct(x.pct),"delta "+cls);
    const statusTd=document.createElement("td");
    statusTd.append(make("span",labels[x.status],"badge "+x.status));
    tr.append(statusTd);
    tbody.append(tr);
  });
}

if(new URLSearchParams(location.search).get("demo")==="1") $("sampleBtn").click();
