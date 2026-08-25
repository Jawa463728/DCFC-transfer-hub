import fs from "node:fs/promises";
import path from "node:path";

const DATA_PATH=path.resolve("data/news.json");
const MAX_STORIES=180;
const MAX_AGE_DAYS=21;
const TARGET_WINDOW_DAYS=10;

const SEARCHES=[
  {edition:"gb",hl:"en-GB",gl:"GB",ceid:"GB:en",q:'"Derby County" (transfer OR signing OR signs OR target OR bid OR loan OR linked)'},
  {edition:"gb",hl:"en-GB",gl:"GB",ceid:"GB:en",q:'"Derby County" transfer'},
  {edition:"us",hl:"en-US",gl:"US",ceid:"US:en",q:'"Derby County" transfer'},
  {edition:"fr",hl:"fr",gl:"FR",ceid:"FR:fr",q:'"Derby County" (transfert OR mercato)'},
  {edition:"es",hl:"es",gl:"ES",ceid:"ES:es",q:'"Derby County" (fichaje OR traspaso OR mercado)'},
  {edition:"it",hl:"it",gl:"IT",ceid:"IT:it",q:'"Derby County" (mercato OR trasferimento)'},
  {edition:"de",hl:"de",gl:"DE",ceid:"DE:de",q:'"Derby County" (Transfer OR Wechsel)'},
  {edition:"nl",hl:"nl",gl:"NL",ceid:"NL:nl",q:'"Derby County" transfer'},
  {edition:"pt",hl:"pt-PT",gl:"PT",ceid:"PT:pt-150",q:'"Derby County" (transferência OR mercado)'},
  {edition:"pl",hl:"pl",gl:"PL",ceid:"PL:pl",q:'"Derby County" (transfer OR transfery)'},
  {edition:"tr",hl:"tr",gl:"TR",ceid:"TR:tr",q:'"Derby County" (transfer OR imza)'}
];

const SOURCE_RULES=[
  [/Derby County|dcfc\.co\.uk/i,99],[/EFL|English Football League/i,96],
  [/BBC Sport|BBC/i,94],[/Sky Sports/i,93],[/The Athletic/i,92],[/The Guardian/i,89],
  [/Reuters/i,95],[/PA Media|Press Association/i,92],[/Derbyshire Live|Derby Telegraph/i,87],
  [/talkSPORT/i,80],[/ESPN/i,86],[/FourFourTwo/i,78],[/TEAMtalk/i,64],
  [/Football League World/i,61],[/GiveMeSport/i,60],[/CaughtOffside/i,54],
  [/Football Insider/i,53],[/Transfer Tavern/i,46],[/Sports Mole/i,55],[/OneFootball/i,57],
  [/Yahoo Sports/i,70],[/Express & Star/i,80],[/BirminghamLive|Birmingham Mail/i,79],
  [/Leicester Mercury|Leicestershire Live/i,79],[/Nottingham Post|Nottinghamshire Live/i,78],
  [/Yorkshire Post|Yorkshire Evening Post/i,78],[/The72/i,66]
];

const TRANSFER_TERMS=["transfer","sign","signing","signed","target","bid","offer","loan","linked","interest","deal","move","fee","medical","contract","free agent","deadline","swoop","pursuit","transfert","mercato","fichaje","traspaso","mercado","trasferimento","wechsel","transfery","transferência","imza"];
const STRONG_TERMS=["has signed","have signed","signs","signed","completes","complete signing","announces","official","joins","has joined","have joined","confirmed","agreed a deal","agreement reached","medical","set to sign","close to signing","closing in","advanced talks","deal agreed"];
const MEDIUM_TERMS=["bid","offer","talks","negotiations","pursuit","target","wants","keen on","interested in","interest","approach","shortlist","considering"];
const WEAK_TERMS=["linked","eyeing","could","may","might","rumour","rumor","tipped","urged","should sign","suggested","speculation","plotting"];

const NON_PLAYER_PHRASES=new Set([
  "Derby County","The Rams","Sky Sports","BBC Sport","Derby Telegraph","Derbyshire Live",
  "Transfer Window","Championship Club","Premier League","League One","League Two",
  "EFL Championship","United Kingdom","Google News"
]);

function decodeXml(str=""){
  return str.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g,"$1").replace(/&amp;/g,"&").replace(/&quot;/g,'"')
    .replace(/&#39;|&apos;/g,"'").replace(/&lt;/g,"<").replace(/&gt;/g,">")
    .replace(/&#(\d+);/g,(_,n)=>String.fromCharCode(Number(n))).replace(/<[^>]+>/g," ")
    .replace(/\s+/g," ").trim();
}
function tag(block,name){const m=block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)<\\/${name}>`,"i"));return m?decodeXml(m[1]):""}
function sourceFromItem(block,title){const m=block.match(/<source(?:\s[^>]*)?>([\s\S]*?)<\/source>/i);if(m)return decodeXml(m[1]);const parts=title.split(" - ");return parts.length>1?parts.at(-1).trim():"Unknown source"}
function reputationFor(source,link=""){const hay=`${source} ${link}`;for(const [pattern,score] of SOURCE_RULES){if(pattern.test(hay))return score}return 48}
function likelihoodFor({title,description,reputation}){
  const text=`${title} ${description}`.toLowerCase();let score=Math.round(reputation*.64+12);
  if(STRONG_TERMS.some(t=>text.includes(t)))score+=22;else if(MEDIUM_TERMS.some(t=>text.includes(t)))score+=8;
  if(WEAK_TERMS.some(t=>text.includes(t)))score-=11;if(/according to|reports? in|reportedly/.test(text))score-=4;
  if(/exclusive/.test(text)&&reputation>=75)score+=4;if(/derby county (have|has) (signed|completed)|derby county announce/.test(text))score=Math.max(score,96);
  return Math.max(20,Math.min(99,score));
}
function getStatus(text,reputation){const t=text.toLowerCase();if(reputation>=95&&/signed|signing|joins|joined|complete|confirmed|announce/.test(t))return"confirmed";if(/derby county (have|has) (signed|completed|confirmed)|official/.test(t)&&reputation>=85)return"confirmed";return"rumour"}
function ratingLabel(likelihood){if(likelihood>=90)return"Very strong";if(likelihood>=75)return"Strong";if(likelihood>=55)return"Watch";return"Speculative"}
function normaliseTitle(t=""){return t.toLowerCase().replace(/\s+-\s+[^-]{2,50}$/,"").replace(/[^a-z0-9]+/g," ").trim()}
function relevant(title,description){const text=`${title} ${description}`.toLowerCase();return(text.includes("derby county")||/\bthe rams\b/.test(text))&&TRANSFER_TERMS.some(t=>text.includes(t))}

function cleanCandidate(name){
  return name.replace(/[’']/g,"'").replace(/\s+/g," ").trim().replace(/^[^A-Za-zÀ-ÿ]+|[^A-Za-zÀ-ÿ' -]+$/g,"");
}

// Lightweight proper-name extractor tuned for football headlines.
// Avoids needing a paid AI/NLP API.
function extractPlayers(title,description){
  const text=`${title}. ${description}`.replace(/\s+-\s+[^.]{2,50}$/," ");
  const candidates=new Set();

  // 2-4 capitalised words, including common apostrophes/hyphens and accented characters.
  const re=/\b([A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+(?:\s+(?:[A-ZÀ-ÖØ-Ý][a-zà-öø-ÿ'’-]+)){1,3})\b/g;
  for(const m of text.matchAll(re)){
    let name=cleanCandidate(m[1]);
    if(!name||NON_PLAYER_PHRASES.has(name))continue;
    if(/\b(Derby|County|Rams|Transfer|Championship|Premier|League|Football|Club|United|City|Town|Live|News|Sports|January|Summer|Deadline)\b/i.test(name))continue;
    if(name.split(" ").length<2)continue;
    candidates.add(name);
  }

  // Prefer names appearing near transfer verbs.
  const ranked=[...candidates].map(name=>{
    const idx=text.toLowerCase().indexOf(name.toLowerCase());
    const around=idx>=0?text.slice(Math.max(0,idx-80),idx+name.length+80).toLowerCase():"";
    let weight=0;
    if(TRANSFER_TERMS.some(t=>around.includes(t)))weight+=3;
    if(title.toLowerCase().includes(name.toLowerCase()))weight+=3;
    if(/midfielder|striker|forward|winger|defender|goalkeeper|keeper|player|star|ace/.test(around))weight+=2;
    return {name,weight};
  }).filter(x=>x.weight>=3).sort((a,b)=>b.weight-a.weight);

  return ranked.slice(0,3).map(x=>x.name);
}

async function getFeed(search){
  const params=new URLSearchParams({q:search.q,hl:search.hl,gl:search.gl,ceid:search.ceid});
  const url=`https://news.google.com/rss/search?${params}`;
  const res=await fetch(url,{headers:{"User-Agent":"Mozilla/5.0 RamsTransferHub/2.0","Accept":"application/rss+xml, application/xml, text/xml"}});
  if(!res.ok)throw new Error(`${search.edition}: HTTP ${res.status}`);return await res.text();
}
function parseFeed(xml,edition){
  const blocks=xml.match(/<item>[\s\S]*?<\/item>/gi)||[];
  return blocks.map(block=>{
    const title=tag(block,"title"),description=tag(block,"description"),link=tag(block,"link"),pubDate=tag(block,"pubDate");
    const source=sourceFromItem(block,title),reputation=reputationFor(source,link),likelihood=likelihoodFor({title,description,reputation});
    const text=`${title} ${description}`;
    return{
      id:Buffer.from(`${normaliseTitle(title)}|${source}`).toString("base64url").slice(0,42),
      title,description,link,source,published:new Date(pubDate||Date.now()).toISOString(),
      reputation,likelihood,ratingLabel:ratingLabel(likelihood),status:getStatus(text,reputation),
      edition,overseas:edition!=="gb"&&edition!=="us",players:extractPlayers(title,description)
    };
  }).filter(x=>x.title&&x.link&&relevant(x.title,x.description));
}
async function readExisting(){try{return JSON.parse(await fs.readFile(DATA_PATH,"utf8"))}catch{return{stories:[],targets:[]}}}

function targetStatus(score,lastMention,signed){
  if(signed)return"Signed";
  const hoursOld=(Date.now()-new Date(lastMention).getTime())/3600000;
  if(hoursOld>72)return"Fading";
  if(score>=82)return"Hot";
  if(score>=70)return"Strong";
  if(score>=56)return"Developing";
  return"Watch";
}

function buildTargets(stories,previousTargets=[]){
  const cutoff=Date.now()-TARGET_WINDOW_DAYS*86400000;
  const previousMap=new Map(previousTargets.map(t=>[t.name.toLowerCase(),t]));
  const map=new Map();

  for(const story of stories){
    if(new Date(story.published).getTime()<cutoff)continue;
    for(const player of story.players||[]){
      const key=player.toLowerCase();
      if(!map.has(key))map.set(key,{name:player,stories:[],sources:new Map()});
      const bucket=map.get(key);
      bucket.stories.push(story);
      const existing=bucket.sources.get(story.source);
      if(!existing||story.reputation>existing.reputation)bucket.sources.set(story.source,story);
    }
  }

  return [...map.values()].map(bucket=>{
    const unique=[...bucket.sources.values()];
    const independentReports=unique.length;
    const best=unique.sort((a,b)=>b.reputation-a.reputation)[0];
    const lastMention=bucket.stories.map(s=>s.published).sort((a,b)=>new Date(b)-new Date(a))[0];
    const maxLikelihood=Math.max(...bucket.stories.map(s=>s.likelihood));
    const avgTopReputation=Math.round(unique.slice(0,4).reduce((a,s)=>a+s.reputation,0)/Math.max(1,unique.slice(0,4).length));

    const newestHours=Math.max(0,(Date.now()-new Date(lastMention).getTime())/3600000);
    const recencyBoost=Math.max(0,18-Math.min(18,newestHours/4));
    const sourceBreadth=Math.min(28, independentReports*7);
    const quality=Math.min(30,avgTopReputation*.30);
    const storyStrength=Math.min(24,maxLikelihood*.24);
    let score=Math.round(sourceBreadth+quality+storyStrength+recencyBoost);

    // Require corroboration for extreme scores unless official/elite.
    if(independentReports===1&&best.reputation<90)score=Math.min(score,68);
    score=Math.max(25,Math.min(99,score));

    const signed=bucket.stories.some(s=>s.status==="confirmed"&&/signed|signing|joins|joined|complete|announce/i.test(`${s.title} ${s.description}`));
    const prev=previousMap.get(bucket.name.toLowerCase());
    const firstSeen=prev?.firstSeen||new Date().toISOString();
    const isNew=(Date.now()-new Date(firstSeen).getTime())<12*3600000;

    return{
      name:bucket.name,score,status:targetStatus(score,lastMention,signed),
      independentReports,totalStories:bucket.stories.length,bestSource:best?.source||"",
      bestSourceScore:best?.reputation||0,maxLikelihood,lastMention,firstSeen,isNew
    };
  }).filter(t=>t.independentReports>=1)
    .sort((a,b)=>b.score-a.score||b.independentReports-a.independentReports||new Date(b.lastMention)-new Date(a.lastMention))
    .slice(0,20);
}

const existing=await readExisting();
const incoming=[];
for(const search of SEARCHES){
  try{const xml=await getFeed(search);const items=parseFeed(xml,search.edition);incoming.push(...items);console.log(`${search.edition}: ${items.length} relevant stories`)}
  catch(err){console.warn(`Feed failed: ${err.message}`)}
}

const byKey=new Map();
for(const story of [...incoming,...(existing.stories||[])]){
  const key=normaliseTitle(story.title);if(!key)continue;
  if(!story.players)story.players=extractPlayers(story.title,story.description||"");
  const prev=byKey.get(key);
  if(!prev||story.reputation>prev.reputation||story.likelihood>prev.likelihood)byKey.set(key,story);
}
const cutoff=Date.now()-MAX_AGE_DAYS*86400000;
const stories=[...byKey.values()].filter(x=>new Date(x.published).getTime()>=cutoff)
  .sort((a,b)=>new Date(b.published)-new Date(a.published)).slice(0,MAX_STORIES);

const targets=buildTargets(stories,existing.targets||[]);
const payload={
  updatedAt:new Date().toISOString(),
  deadline:"2026-09-01T23:00:00+01:00",
  scanIntervalMinutes:5,storyCount:stories.length,targetCount:targets.length,targets,stories
};
await fs.writeFile(DATA_PATH,JSON.stringify(payload,null,2)+"\n");
console.log(`Saved ${stories.length} stories and ${targets.length} targets`);
