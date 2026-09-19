const $=id=>document.getElementById(id);
let oldText="",newText="",lastResult=null;

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
function refreshAnalyze(){ $("analyzeBtn").disabled=!(oldText&&newText); }

async function readFile(input,nameTarget,kind){
  const file=input.files[0];
  if(!file) return;
  const text=await file.text();
  if(kind==="old") oldText=text; else newText=text;
  $(nameTarget).textContent=file.name;
  refreshAnalyze();
}
$("oldFile").addEventListener("change",e=>readFile(e.target,"oldName","old"));
$("newFile").addEventListener("change",e=>readFile(e.target,"newName","new"));

$("sampleBtn").addEventListener("click",async()=>{
  try{
    [oldText,newText]=await Promise.all([
      fetch("samples/old_prices.csv").then(r=>r.text()),
      fetch("samples/new_prices.csv").then(r=>r.text())
    ]);
    $("oldName").textContent="old_prices.csv (demo)";
    $("newName").textContent="new_prices.csv (demo)";
    refreshAnalyze();
    analyze();
  }catch(err){alert("Impossibile caricare i dati demo: "+err.message);}
});

$("analyzeBtn").addEventListener("click",analyze);
$("statusFilter").addEventListener("change",renderRows);
$("exportBtn").addEventListener("click",()=>{
  if(!lastResult) return;
  const blob=new Blob([ListinoDiff.reportCSV(lastResult.items)],{type:"text/csv;charset=utf-8"});
  const url=URL.createObjectURL(blob), a=document.createElement("a");
  a.href=url; a.download="report-variazioni-listino.csv"; a.click();
  URL.revokeObjectURL(url);
});

function analyze(){
  try{
    const oldRows=ListinoDiff.parseCSV(oldText);
    const newRows=ListinoDiff.parseCSV(newText);
    lastResult=ListinoDiff.compare(oldRows,newRows);
    renderSummary();
    $("statusFilter").value="all";
    renderRows();
    $("results").classList.remove("hidden");
    $("emptyState").classList.add("hidden");
    $("results").scrollIntoView({behavior:"smooth",block:"start"});
  }catch(err){alert(err.message);}
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
  $("summary").innerHTML=cards.map(([k,v])=>
    '<div class="metric"><span>'+k+'</span><strong>'+v+'</strong></div>'
  ).join("");
}

function renderRows(){
  const filter=$("statusFilter").value;
  const rows=lastResult.items.filter(x=>filter==="all"||x.status===filter);
  $("resultRows").innerHTML=rows.length?rows.map(x=>{
    const cls=x.delta>0?"up":x.delta<0?"down":"";
    return '<tr>'+
      '<td>'+escapeHtml(x.sku)+'</td>'+
      '<td>'+escapeHtml(x.name)+'</td>'+
      '<td class="amount">'+money(x.oldPrice)+'</td>'+
      '<td class="amount">'+money(x.newPrice)+'</td>'+
      '<td class="delta '+cls+'">'+delta(x.delta)+'</td>'+
      '<td class="delta '+cls+'">'+pct(x.pct)+'</td>'+
      '<td><span class="badge '+x.status+'">'+labels[x.status]+'</span></td>'+
    '</tr>';
  }).join(""):'<tr><td class="empty" colspan="7">Nessun elemento per questo filtro.</td></tr>';
}
function escapeHtml(value){
  return String(value??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]));
}
if(new URLSearchParams(location.search).get("demo")==="1") $("sampleBtn").click();

