const CATEGORIES = ["Makan","Transportasi","Kuota","Hiburan","Patungan","Pendidikan","Belanja","Lainnya"];
const COLORS = ["#287a5b","#ffa500","#ff0000","#90d5ff","#8a2be2","#828282","#660033","#000080"];
const $ = id => document.getElementById(id);
const today = new Date();
const monthNow = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}`;
let transactions = JSON.parse(localStorage.getItem("kp_transactions") || "[]");
let budgets = JSON.parse(localStorage.getItem("kp_budgets") || "{}");
let goal = JSON.parse(localStorage.getItem("kp_goal") || "null");
$("monthFilter").value = monthNow;
$("transactionDate").value = today.toISOString().slice(0,10);

function rupiah(value){return new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(value||0)}
function save(){localStorage.setItem("kp_transactions",JSON.stringify(transactions));localStorage.setItem("kp_budgets",JSON.stringify(budgets));localStorage.setItem("kp_goal",JSON.stringify(goal))}
function selectedMonth(){return $("monthFilter").value || monthNow}
function monthTransactions(){return transactions.filter(t=>t.date.slice(0,7)===selectedMonth())}
function fillCategories(){
  $("transactionCategory").innerHTML=CATEGORIES.map(c=>`<option>${c}</option>`).join("");
  $("budgetCategory").innerHTML=CATEGORIES.map(c=>`<option>${c}</option>`).join("");
}
function totals(){
  const rows=monthTransactions(), income=rows.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0), expense=rows.filter(t=>t.type==="expense").reduce((s,t)=>s+t.amount,0);
  const balance=income-expense;
  const [year,month]=selectedMonth().split("-").map(Number);
  const days=new Date(year,month,0).getDate(), day=Math.min(today.getDate(),days);
  const remainingDays=Math.max(1,days-day+1);
  $("totalIncome").textContent=rupiah(income);$("totalExpense").textContent=rupiah(expense);$("balance").textContent=rupiah(balance);
  $("balanceCaption").textContent=balance<0?"Pengeluaran melebihi pemasukan":"Pemasukan dikurangi pengeluaran";
  $("dailyLimit").textContent=rupiah(Math.max(0,balance)/remainingDays);
  return {income,expense,balance,rows};
}
function renderTransactions(rows){
  $("transactionRows").innerHTML=rows.slice().sort((a,b)=>b.date.localeCompare(a.date)).map(t=>`<tr><td>${new Date(t.date+"T00:00:00").toLocaleDateString("id-ID",{day:"2-digit",month:"short",year:"numeric"})}</td><td>${escapeHtml(t.note|| (t.type==="income"?"Pemasukan":"Pengeluaran"))}</td><td>${t.category}</td><td class="${t.type==="income"?"amount-in":"amount-out"}">${t.type==="income"?"+":"−"}${rupiah(t.amount)}</td><td><button class="delete-btn" data-delete="${t.id}" aria-label="Hapus transaksi">×</button></td></tr>`).join("");
  $("emptyTransactions").style.display=rows.length?"none":"block";
}
function renderBudgets(rows){
  const spent={};rows.filter(t=>t.type==="expense").forEach(t=>spent[t.category]=(spent[t.category]||0)+t.amount);
  $("budgetList").innerHTML=CATEGORIES.filter(c=>budgets[c]>0).map(c=>{
    const amount=budgets[c], used=spent[c]||0, pct=Math.min(100,used/amount*100), state=pct>=100?"danger":pct>=80?"warning":"";
    const status=pct>=100?"Anggaran terlampaui":pct>=80?"Waspada, sudah mencapai lebih dari 80%":"Masih dalam batas anggaran";
    return `<div class="budget-item ${state}"><div class="budget-top"><strong>${c}</strong><span>${rupiah(used)} / ${rupiah(amount)}</span></div><div class="progress"><span style="width:${pct}%"></span></div><div class="budget-status">${status}</div></div>`;
  }).join("") || '<p class="empty-state">Belum ada jatah anggaran. Tambahkan anggaran kategori di atas.</p>';
}
function drawCharts(rows){
  const spent=CATEGORIES.map(c=>rows.filter(t=>t.type==="expense"&&t.category===c).reduce((s,t)=>s+t.amount,0));
  const canvas=$("categoryChart"),ctx=canvas.getContext("2d"),w=canvas.width=canvas.clientWidth*devicePixelRatio,h=canvas.height=230*devicePixelRatio;ctx.clearRect(0,0,w,h);
  const total=spent.reduce((a,b)=>a+b,0);let start=-Math.PI/2;const cx=w/2,cy=h/2,r=Math.min(w*.27,h*.38),inner=r*.58;
  if(total===0){ctx.fillStyle="#91a29a";ctx.font=`${13*devicePixelRatio}px Arial`;ctx.textAlign="center";ctx.fillText("Belum ada data pengeluaran",cx,cy);$("chartLegend").innerHTML="";}else{
    spent.forEach((v,i)=>{if(!v)return;const end=start+v/total*Math.PI*2;ctx.beginPath();ctx.arc(cx,cy,r,start,end);ctx.arc(cx,cy,inner,end,start,true);ctx.closePath();ctx.fillStyle=COLORS[i];ctx.fill();start=end});
    ctx.fillStyle="#20312d";ctx.textAlign="center";ctx.font=`bold ${15*devicePixelRatio}px Arial`;ctx.fillText(rupiah(total),cx,cy);
    $("chartLegend").innerHTML=CATEGORIES.map((c,i)=>spent[i]?`<span><i style="background:${COLORS[i]}"></i>${c}</span>`:"").join("");
  }
  const bar=$("comparisonChart"),bctx=bar.getContext("2d"),bw=bar.width=bar.clientWidth*devicePixelRatio,bh=230*devicePixelRatio;bctx.clearRect(0,0,bw,bh);
  const inc=rows.filter(t=>t.type==="income").reduce((s,t)=>s+t.amount,0),exp=total,max=Math.max(inc,exp,1),base=bh-35*devicePixelRatio,top=20*devicePixelRatio,barW=Math.min(75*devicePixelRatio,bw*.22),gap=55*devicePixelRatio;
  [[inc,"#287a5b","Pemasukan"],[exp,"#ff0000","Pengeluaran"]].forEach((item,i)=>{const x=bw/2-gap/2-barW+i*(barW+gap),height=(item[0]/max)*(base-top);bctx.fillStyle=item[1];bctx.fillRect(x,base-height,barW,height);bctx.fillStyle="#53645e";bctx.font=`${11*devicePixelRatio}px Arial`;bctx.textAlign="center";bctx.fillText(item[2],x+barW/2,base+19*devicePixelRatio);bctx.fillText(shortMoney(item[0]),x+barW/2,Math.max(top-4,base-height-8*devicePixelRatio))});
}
function shortMoney(n){return n>=1000000?(n/1000000).toFixed(1)+" jt":n>=1000?Math.round(n/1000)+" rb":String(n)}
function renderGoal(){
  if(!goal){$("goalDisplay").innerHTML='<p class="empty-state">Belum ada target tabungan.</p>';return}
  const pct=Math.min(100,goal.saved/goal.amount*100),left=Math.max(0,goal.amount-goal.saved);
  $("goalDisplay").innerHTML=`<h4>${escapeHtml(goal.name)}</h4><p>Tabungan: <strong>${rupiah(goal.saved)}</strong> dari ${rupiah(goal.amount)}</p><div class="goal-progress"><span style="width:${pct}%"></span></div><p>${pct.toFixed(1)}% tercapai • ${left?`Kurang ${rupiah(left)}`:"Target berhasil dicapai!"}</p><button class="text-btn" id="deleteGoal">Hapus target</button>`;
  $("deleteGoal").addEventListener("click",()=>{goal=null;save();renderGoal()});
}
function render(){
  const data=totals();renderTransactions(data.rows);renderBudgets(data.rows);drawCharts(data.rows);renderGoal();
}
function escapeHtml(str){return String(str).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[ch]))}
$("transactionType").addEventListener("change",()=>{const isIncome=$("transactionType").value==="income";$("transactionCategory").innerHTML=isIncome?'<option>Uang saku</option><option>Beasiswa</option><option>Hadiah</option><option>Lainnya</option>':CATEGORIES.map(c=>`<option>${c}</option>`).join("")});
$("transactionForm").addEventListener("submit",e=>{
  e.preventDefault();const amount=Number($("transactionAmount").value);if(amount<=0)return;
  transactions.push({id:Date.now().toString(),date:$("transactionDate").value,type:$("transactionType").value,category:$("transactionCategory").value,amount,note:$("transactionNote").value.trim()});
  save();e.target.reset();$("transactionDate").value=today.toISOString().slice(0,10);$("transactionType").value="expense";fillCategories();render();
});
$("budgetForm").addEventListener("submit",e=>{e.preventDefault();budgets[$("budgetCategory").value]=Number($("budgetAmount").value);save();e.target.reset();render()});
$("goalForm").addEventListener("submit",e=>{e.preventDefault();goal={name:$("goalName").value.trim(),amount:Number($("goalAmount").value),saved:Number($("goalSaved").value)||0};save();e.target.reset();renderGoal()});
$("transactionRows").addEventListener("click",e=>{const id=e.target.dataset.delete;if(!id)return;transactions=transactions.filter(t=>t.id!==id);save();render()});
$("clearMonth").addEventListener("click",()=>{if(!confirm("Hapus semua transaksi pada bulan yang dipilih?"))return;transactions=transactions.filter(t=>t.date.slice(0,7)!==selectedMonth());save();render()});
$("monthFilter").addEventListener("change",render);
window.addEventListener("resize",()=>drawCharts(monthTransactions()));
fillCategories();render();
