const DEADLINE = new Date("2026-09-01T23:00:00+01:00");
let allStories = [];
let allTargets = [];
let currentFilter = "all";
let playerFilter = null;

function pad(n){ return String(n).padStart(2,"0"); }

function updateCountdown(){
  const now = new Date();
  let diff = DEADLINE - now;
  if(diff <= 0){
    document.getElementById("countdown").innerHTML = "<strong style='font-size:24px'>WINDOW CLOSED</strong>";
    return;
  }
  const days = Math.floor(diff / 86400000); diff %= 86400000;
  const hours = Math.floor(diff / 3600000); diff %= 3600000;
  const minutes = Math.floor(diff / 60000); diff %= 60000;
  const seconds = Math.floor(diff / 1000);
  document.getElementById("days").textContent = pad(days);
  document.getElementById("hours").textContent = pad(hours);
  document.getElementById("minutes").textContent = pad(minutes);
  document.getElementById("seconds").textContent = pad(seconds);
}
setInterval(updateCountdown,1000);
updateCountdown();

function timeAgo(dateString){
  const d = new Date(dateString);
  const secs = Math.max(0,Math.floor((Date.now()-d.getTime())/1000));
  if(secs<60)return `${secs}s ago`;
  if(secs<3600)return `${Math.floor(secs/60)}m ago`;
  if(secs<86400)return `${Math.floor(secs/3600)}h ago`;
  if(secs<604800)return `${Math.floor(secs/86400)}d ago`;
  return d.toLocaleDateString("en-GB",{day:"numeric",month:"short"});
}
function scoreClass(score){if(score>=90)return"elite";if(score>=75)return"good";if(score>=55)return"mid";return"low"}
function escapeHtml(str=""){return String(str).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[c]))}
function heatClass(status=""){return "heat-"+status.toLowerCase().replace(/\s+/g,"-")}

function matchesFilter(s){
  if(playerFilter && !(s.players||[]).some(p=>p.toLowerCase()===playerFilter.toLowerCase())) return false;
  if(currentFilter==="all")return true;
  if(currentFilter==="confirmed")return s.status==="confirmed";
  if(currentFilter==="strong")return s.likelihood>=75||s.reputation>=85;
  if(currentFilter==="rumour")return s.status!=="confirmed";
  if(currentFilter==="overseas")return !!s.overseas;
  return true;
}

function selectPlayer(name){
  playerFilter = name;
  document.getElementById("playerFilterName").textContent=name;
  document.getElementById("playerFilterBar").classList.remove("hidden");
  renderFeed();
  document.querySelector(".controls").scrollIntoView({behavior:"smooth",block:"start"});
}

function renderTargets(){
  const hero = document.getElementById("targetsHero");
  const body = document.getElementById("targetTableBody");
  if(!allTargets.length){
    hero.innerHTML=`<div class="loading-card">No clear player targets have been identified yet. The next scan will keep looking.</div>`;
    body.innerHTML=`<tr><td colspan="7">No ranked targets yet.</td></tr>`;
    return;
  }

  hero.innerHTML=allTargets.slice(0,4).map((t,i)=>`
    <article class="target-card" data-player="${escapeHtml(t.name)}">
      <div class="target-rank">#${i+1} TARGET</div>
      <div class="target-name">${escapeHtml(t.name)}</div>
      <div>
        <span class="heat-badge ${heatClass(t.status)}">${escapeHtml(t.status.toUpperCase())}</span>
        ${t.isNew?`<span class="new-badge">NEW NAME</span>`:""}
      </div>
      <div class="target-meta">${t.independentReports} independent ${t.independentReports===1?"report":"reports"} · ${timeAgo(t.lastMention)}</div>
      <div class="target-score-big">${t.score}<span>/100</span></div>
      <div class="target-bar"><span style="width:${Math.min(100,t.score)}%"></span></div>
    </article>
  `).join("");

  body.innerHTML=allTargets.slice(0,12).map((t,i)=>`
    <tr data-player="${escapeHtml(t.name)}">
      <td class="rank-cell">${i+1}</td>
      <td class="player-cell">${escapeHtml(t.name)} ${t.isNew?`<span class="new-badge">NEW</span>`:""}</td>
      <td><span class="heat-badge ${heatClass(t.status)}">${escapeHtml(t.status)}</span></td>
      <td>${t.independentReports}</td>
      <td>${escapeHtml(t.bestSource||"—")}</td>
      <td>${timeAgo(t.lastMention)}</td>
      <td class="score-cell">${t.score}<span class="mini-meter"><span style="width:${Math.min(100,t.score)}%"></span></span></td>
    </tr>
  `).join("");

  document.querySelectorAll("[data-player]").forEach(el=>{
    el.addEventListener("click",()=>selectPlayer(el.dataset.player));
  });
}

function renderFeed(){
  const sort=document.getElementById("sort").value;
  const stories=allStories.filter(matchesFilter).sort((a,b)=>{
    if(sort==="likelihood")return b.likelihood-a.likelihood||new Date(b.published)-new Date(a.published);
    if(sort==="reputation")return b.reputation-a.reputation||new Date(b.published)-new Date(a.published);
    return new Date(b.published)-new Date(a.published);
  });
  document.getElementById("storyCount").textContent=`${stories.length} ${stories.length===1?"story":"stories"}`;
  const feed=document.getElementById("newsFeed");
  if(!stories.length){
    feed.innerHTML=`<div class="empty">No stories match this view yet.</div>`;
    return;
  }
  feed.innerHTML=stories.map(s=>`
    <article class="story">
      <div class="story-main">
        <div class="story-meta">
          <span class="source-name">${escapeHtml(s.source||"Unknown source")}</span>
          ${s.status==="confirmed"?`<span class="confirmed-badge">CONFIRMED</span>`:""}
          ${s.overseas?`<span class="overseas-badge">OVERSEAS · ${escapeHtml((s.edition||"").toUpperCase())}</span>`:""}
          ${(s.players||[]).slice(0,2).map(p=>`<span class="player-badge">${escapeHtml(p)}</span>`).join("")}
        </div>
        <a class="story-title" href="${escapeHtml(s.link)}" target="_blank" rel="noopener noreferrer">${escapeHtml(s.title)}</a>
        ${s.description?`<p class="story-desc">${escapeHtml(s.description)}</p>`:""}
        <div class="story-time">${timeAgo(s.published)} · ${escapeHtml(s.ratingLabel||"Rumour")}</div>
      </div>
      <div class="scores">
        <div class="score ${scoreClass(s.reputation)}"><small>SOURCE</small><strong>${s.reputation}</strong></div>
        <div class="score ${scoreClass(s.likelihood)}"><small>LIKELY</small><strong>${s.likelihood}</strong></div>
      </div>
    </article>
  `).join("");
}
function render(){renderTargets();renderFeed()}

async function loadNews(){
  try{
    const res=await fetch(`data/news.json?v=${Date.now()}`,{cache:"no-store"});
    if(!res.ok)throw new Error("News file not ready");
    const data=await res.json();
    allStories=data.stories||[];
    allTargets=data.targets||[];
    const updated=data.updatedAt?new Date(data.updatedAt):null;
    document.getElementById("lastUpdated").textContent=updated&&!isNaN(updated)?timeAgo(updated):"Waiting for first scan";
    const tickerStories=allStories.slice(0,8);
    document.getElementById("ticker").textContent=tickerStories.length?tickerStories.map(x=>`${x.source}: ${x.title}`).join("   •   "):"No transfer stories yet — the next scan will check again.";
    render();
  }catch(err){
    document.getElementById("lastUpdated").textContent="Waiting for updater";
    document.getElementById("newsFeed").innerHTML=`<div class="empty">The live feed has not been generated yet. Run the GitHub Action once, then it will update automatically.</div>`;
  }
}

document.querySelectorAll(".tab").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".tab").forEach(x=>x.classList.remove("active"));
    btn.classList.add("active");currentFilter=btn.dataset.filter;renderFeed();
  });
});
document.getElementById("sort").addEventListener("change",renderFeed);
document.getElementById("clearPlayerFilter").addEventListener("click",()=>{
  playerFilter=null;
  document.getElementById("playerFilterBar").classList.add("hidden");
  renderFeed();
});

loadNews();
setInterval(loadNews,60_000);
