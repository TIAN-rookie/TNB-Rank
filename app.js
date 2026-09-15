const seedPlayers = [
  {id:1,name:'河牌猎手',tagline:'耐心等待，果断出击',color:'#a84640',joined:'2026-05-02'},
  {id:2,name:'Ace先生',tagline:'牌桌没有侥幸',color:'#315f59',joined:'2026-05-05'},
  {id:3,name:'小满',tagline:'稳中求胜',color:'#766248',joined:'2026-05-08'},
  {id:4,name:'北境之王',tagline:'读牌，也读人',color:'#365d76',joined:'2026-05-12'},
  {id:5,name:'Lucky.L',tagline:'好运只眷顾准备的人',color:'#89634d',joined:'2026-05-15'},
  {id:6,name:'老K',tagline:'牌龄十年，初心未变',color:'#69567b',joined:'2026-05-18'},
  {id:7,name:'River',tagline:'河牌才是开始',color:'#3f726d',joined:'2026-05-20'},
  {id:8,name:'苏打水',tagline:'保持清醒',color:'#8a5361',joined:'2026-05-23'}
];
const seedGames = [
  {id:1,date:'2026-08-03',event:'周末常规赛',scores:{1:420,2:180,3:60,4:-90,5:-130,6:-170,7:-210,8:-60}},
  {id:2,date:'2026-08-10',event:'周末常规赛',scores:{1:-220,2:380,3:150,4:90,5:-160,6:-80,7:-110,8:-50}},
  {id:3,date:'2026-08-17',event:'周末深筹赛',scores:{1:310,2:-120,3:-60,4:520,5:130,6:-280,7:-350,8:-150}},
  {id:4,date:'2026-08-24',event:'月度冠军赛',scores:{1:860,2:240,3:-180,4:-240,5:310,6:-420,7:-330,8:-240}},
  {id:5,date:'2026-08-31',event:'周末常规赛',scores:{1:-90,2:340,3:280,4:140,5:-220,6:-170,7:-130,8:-150}},
  {id:6,date:'2026-09-07',event:'周末常规赛',scores:{1:260,2:-210,3:440,4:-80,5:190,6:-230,7:-120,8:-250}}
];
const storeKey='wpt-rank-mvp-v1';
const APP_VERSION='v2026.09.16.3';
const defaultSeasons=[
  {code:'2026-S3',name:'2026 第 3 赛季',active:true},
  {code:'2026-S2',name:'2026 第 2 赛季',active:false},
  {code:'2026-S1',name:'2026 第 1 赛季',active:false}
];
let state=JSON.parse(localStorage.getItem(storeKey)||'null')||{players:seedPlayers,games:seedGames,seasons:defaultSeasons};
state.games=state.games.map(game=>({...game,season:game.season||'2026-S3'}));
state.seasons=state.seasons||defaultSeasons;
let expanded=false;
let activeSeason='2026-S3';
let pendingAvatar='';
let backend;
let cloudMode=false;
let identity={user:null,isAdmin:true};
const $=selector=>document.querySelector(selector);
const initials=name=>name.slice(0,2).toUpperCase();
const avatar=p=>`<span class="avatar" style="background:${p.color}">${p.avatar?`<img src="${p.avatar}" alt="${p.name} 的头像">`:initials(p.name)}</span>`;
const format=n=>new Intl.NumberFormat('zh-CN').format(n);
const save=()=>localStorage.setItem(storeKey,JSON.stringify(state));
const seasonGames=()=>activeSeason==='all'?state.games:state.games.filter(game=>game.season===activeSeason);
const seasonLabel=season=>season==='all'?'全部赛季':`${season.split('-')[0]} · ${season.split('S')[1]?'第 '+season.split('S')[1]+' 赛季':''}`;

function statsFor(player,games=seasonGames()){
  const played=games.filter(g=>g.scores[player.id]!==undefined);
  const points=played.reduce((sum,g)=>sum+Number(g.scores[player.id]),0);
  const wins=played.filter(g=>Number(g.scores[player.id])===Math.max(...Object.values(g.scores).map(Number))).length;
  return {...player,played:played.length,points,wins,attendance:games.length?Math.round(played.length/games.length*100):0,winRate:played.length?Math.round(wins/played.length*100):0};
}
function ranked(){return state.players.map(player=>statsFor(player)).sort((a,b)=>b.points-a.points)}
function render(){renderSeasonOptions();renderSummary();renderLeaderboard();renderChampion();renderRecords();renderPlayers();renderResultInputs();renderAccess()}
function renderSeasonOptions(){
  const select=$('#seasonFilter');
  const known=state.seasons.some(season=>season.code===activeSeason);
  if(!known&&activeSeason!=='all')activeSeason=state.seasons.find(season=>season.active)?.code||state.seasons[0]?.code||'all';
  select.innerHTML=state.seasons.map(season=>`<option value="${season.code}">${season.name.replace(' 第 ',' · S').replace(' 赛季','')}</option>`).join('')+'<option value="all">全部赛季</option>';
  select.value=activeSeason;
  const seasonSelect=$('#resultForm [name=season]');
  seasonSelect.innerHTML=state.seasons.map(season=>`<option value="${season.code}">${season.name.replace(' 第 ',' · S').replace(' 赛季','')}</option>`).join('');
  seasonSelect.value=activeSeason==='all'?(state.seasons.find(season=>season.active)?.code||state.seasons[0]?.code):activeSeason;
}
function renderAccess(){
  document.querySelectorAll('.admin-only').forEach(element=>element.hidden=cloudMode&&!identity.isAdmin);
  $('#authButton').hidden=!cloudMode;
  if(cloudMode)$('#authButton').textContent=identity.user?(identity.isAdmin?'退出管理':'退出登录'):'管理员登录';
}
function renderSummary(){
  const games=seasonGames();
  $('#totalPlayers').textContent=state.players.length;
  $('#totalGames').textContent=games.length;
  $('#totalPoints').textContent=format(games.reduce((sum,g)=>sum+Object.values(g.scores).reduce((a,b)=>a+Math.abs(Number(b)),0),0));
  $('#heroSeason').textContent=activeSeason==='all'?'ALL SEASONS · 生涯数据':`SEASON ${activeSeason.split('-')[0]} · 第 ${activeSeason.split('S')[1]} 赛季`;
}
function renderLeaderboard(){
  const term=$('#playerSearch').value.trim().toLowerCase();
  const all=ranked().filter(p=>p.played>0&&p.name.toLowerCase().includes(term));
  const shown=expanded||term?all:all.slice(0,6);
  $('#leaderboardBody').innerHTML=shown.map((p,i)=>`<tr><td><span class="rank ${i<3?'top':''}">${String(i+1).padStart(2,'0')}</span></td><td><div class="player-cell">${avatar(p)}<span>${p.name}</span></div></td><td><div class="bar-metric"><span>${p.attendance}%</span><span class="bar"><i style="width:${p.attendance}%"></i></span></div></td><td>${p.winRate}%</td><td>${p.played} 场</td><td class="right points">${p.points>=0?'+':''}${format(p.points)}</td></tr>`).join('')||'<tr><td class="empty-season" colspan="6">该赛季暂无选手数据</td></tr>';
  $('#tableCount').textContent=`共 ${all.length} 位选手`;
  $('#scoreColumn').textContent=activeSeason==='all'?'生涯总积分':'赛季总积分';
  $('#showAllBtn').textContent=expanded?'收起榜单 ↑':'查看完整榜单 ↓';
}
function renderChampion(){
  const p=ranked()[0];
  $('#championCard').innerHTML=p&&p.played?`<div class="champion-label"><span>CURRENT CHAMPION</span><span>♛</span></div><div class="portrait" style="background:${p.color}">${p.avatar?`<img src="${p.avatar}" alt="${p.name} 的头像">`:initials(p.name)}</div><h3>${p.name}</h3><p>${p.tagline||'本赛季领跑者'}</p><div class="champion-score"><strong>${format(p.points)}</strong><span>${activeSeason==='all'?'生涯':'赛季'}总积分</span></div><div class="champion-mini"><div><strong>${p.attendance}%</strong><span>出勤率</span></div><div><strong>${p.winRate}%</strong><span>胜率</span></div><div><strong>${p.played}</strong><span>参赛场次</span></div></div>`:'<div class="champion-label"><span>CURRENT CHAMPION</span><span>♛</span></div><p class="empty-record">该赛季尚未产生冠军</p>';
}
function renderRecords(){
  const entries=seasonGames().flatMap(g=>Object.entries(g.scores).map(([id,score])=>({player:state.players.find(p=>String(p.id)===String(id)),score:Number(score),date:g.date,event:g.event}))).filter(x=>x.player);
  const topThree=sorter=>[...entries].sort(sorter).slice(0,3);
  const item=(x,i)=>`<div class="record-item"><span class="medal">${['Ⅰ','Ⅱ','Ⅲ'][i]}</span><div class="record-person">${avatar(x.player)}<div><strong>${x.player.name}</strong><span>${x.date} · ${x.event}</span></div></div><div class="record-points"><strong>${x.score>0?'+':''}${format(x.score)}</strong><span>积分</span></div></div>`;
  $('#highRecords').innerHTML=topThree((a,b)=>b.score-a.score).map(item).join('')||'<div class="empty-record">该赛季暂无纪录</div>';
  $('#lowRecords').innerHTML=topThree((a,b)=>a.score-b.score).map(item).join('')||'<div class="empty-record">该赛季暂无纪录</div>';
}
function renderPlayers(){
  const career=state.players.map(player=>statsFor(player,state.games)).sort((a,b)=>b.points-a.points);
  $('#playerGrid').innerHTML=career.map((p,i)=>`<article class="player-card"><div class="player-card-head">${avatar(p)}<div><h3>${p.name}</h3><p>${p.tagline||`生涯排行榜第 ${i+1} 名`}</p></div></div><div class="total"><span>生涯总积分</span><strong>${p.points>=0?'+':''}${format(p.points)}</strong></div><div class="card-metrics"><div><span>出勤率</span><strong>${p.attendance}%</strong></div><div><span>胜率</span><strong>${p.winRate}%</strong></div><div><span>参赛</span><strong>${p.played} 场</strong></div></div></article>`).join('');
}
function renderResultInputs(){
  $('#resultInputs').innerHTML=state.players.map(p=>`<div class="result-row"><label><input type="checkbox" name="selected" value="${p.id}"> ${avatar(p)} ${p.name}</label><input type="number" name="score-${p.id}" placeholder="输入积分" step="10"></div>`).join('');
}
function toast(message){const el=$('#toast');el.textContent=message;el.classList.add('toast-show');setTimeout(()=>el.classList.remove('toast-show'),2400)}
function setConnection(text,type=''){$('#connectionBadge').textContent=`${text} · ${APP_VERSION}`;$('#connectionBadge').title=`TNB Rank ${APP_VERSION}`;$('#connectionBadge').className=`connection-badge ${type}`}
function compressAvatar(file){
  return new Promise((resolve,reject)=>{
    if(!file.type.startsWith('image/'))return reject(new Error('请选择图片文件'));
    if(file.size>5*1024*1024)return reject(new Error('头像不能超过 5 MB'));
    const reader=new FileReader();
    reader.onerror=()=>reject(new Error('头像读取失败'));
    reader.onload=()=>{const image=new Image();image.onerror=()=>reject(new Error('图片格式不支持'));image.onload=()=>{
      const size=Math.min(image.width,image.height);const left=(image.width-size)/2;const top=(image.height-size)/2;
      const canvas=document.createElement('canvas');canvas.width=320;canvas.height=320;
      canvas.getContext('2d').drawImage(image,left,top,size,size,0,0,320,320);
      resolve(canvas.toDataURL('image/jpeg',.82));
    };image.src=reader.result};reader.readAsDataURL(file);
  });
}
document.querySelectorAll('[data-open]').forEach(btn=>btn.addEventListener('click',()=>$('#'+btn.dataset.open).showModal()));
document.querySelectorAll('.close').forEach(btn=>btn.addEventListener('click',()=>{btn.closest('dialog').close();const error=btn.closest('dialog').querySelector('.form-error');if(error)error.hidden=true}));
document.querySelectorAll('dialog').forEach(d=>d.addEventListener('click',e=>{if(e.target===d)d.close()}));
$('#playerSearch').addEventListener('input',renderLeaderboard);
$('#showAllBtn').addEventListener('click',()=>{expanded=!expanded;renderLeaderboard()});
$('#seasonFilter').addEventListener('change',e=>{activeSeason=e.target.value;expanded=false;render();toast(`已切换至${seasonLabel(activeSeason)}`)});
$('#avatarInput').addEventListener('change',async e=>{
  const file=e.target.files[0];if(!file){pendingAvatar='';return}
  try{pendingAvatar=await compressAvatar(file);$('#avatarPreview').innerHTML=`<img src="${pendingAvatar}" alt="头像预览">`}catch(error){e.target.value='';pendingAvatar='';toast(error.message)}
});
$('#authButton').addEventListener('click',async e=>{
  if(!identity.user){$('#loginError').hidden=true;return $('#loginModal').showModal()}
  e.currentTarget.disabled=true;
  try{await backend.signOut();identity={user:null,isAdmin:false};renderAccess();toast('已退出管理后台')}catch(error){toast(error.message)}finally{e.currentTarget.disabled=false}
});
$('#loginForm').addEventListener('submit',async e=>{
  e.preventDefault();const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
  const errorBox=$('#loginError');errorBox.hidden=true;
  const data=new FormData(e.currentTarget);
  try{
    identity=await backend.signIn(data.get('email').trim(),data.get('password'));
    if(!identity.isAdmin){await backend.signOut();identity={user:null,isAdmin:false};throw new Error('该账号没有管理员权限')}
    e.currentTarget.reset();$('#loginModal').close();renderAccess();toast('管理员登录成功');
  }catch(error){errorBox.textContent=readableError(error);errorBox.hidden=false}finally{button.disabled=false}
});
$('#registerForm').addEventListener('submit',async e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);const name=data.get('name').trim();
  if(state.players.some(p=>p.name.toLowerCase()===name.toLowerCase()))return toast('该昵称已注册');
  const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
  try{
    await backend.addPlayer({name,tagline:data.get('tagline').trim(),color:data.get('color')},pendingAvatar);
    await reloadData();e.currentTarget.reset();pendingAvatar='';$('#avatarPreview').textContent='预览';$('#registerModal').close();toast(`欢迎 ${name} 加入俱乐部`);
  }catch(error){toast(readableError(error))}finally{button.disabled=false}
});
$('#resultForm').addEventListener('submit',async e=>{
  e.preventDefault();const data=new FormData(e.currentTarget);const selected=data.getAll('selected');
  if(selected.length<2)return toast('请至少选择两名参赛选手');
  const scores={};for(const id of selected){const raw=data.get(`score-${id}`);if(raw==='')return toast('请填写所有参赛选手的积分');scores[id]=Number(raw)}
  const button=e.currentTarget.querySelector('[type=submit]');button.disabled=true;
  try{
    await backend.addGame({date:data.get('date'),season:data.get('season'),event:data.get('event').trim(),scores});
    await reloadData();e.currentTarget.reset();$('#resultForm [name=date]').value=new Date().toISOString().slice(0,10);$('#adminModal').close();toast('赛果已录入，排行榜已更新');
  }catch(error){toast(readableError(error))}finally{button.disabled=false}
});

function readableError(error){
  if(!error)return '发生未知错误，请刷新后重试';
  if(error?.code==='23505')return '名称已存在，请更换后重试';
  if(error?.message?.includes('Invalid login'))return '邮箱或密码错误';
  if(error?.message?.toLowerCase().includes('email not confirmed'))return '邮箱尚未确认，请先在 Supabase 确认该用户';
  if(error?.message?.toLowerCase().includes('rate limit'))return '登录尝试过于频繁，请稍后再试';
  if(error?.message?.toLowerCase().includes('null is not'))return '账号资料读取失败，请刷新页面后重试';
  return error?.message||'操作失败，请稍后重试';
}
const localBackend={
  async load(){return state},
  async addPlayer(player,avatar){state.players.push({id:Date.now(),...player,avatar,joined:new Date().toISOString().slice(0,10)});save()},
  async addGame(game){state.games.push({id:Date.now(),...game});save()},
  async signOut(){},async signIn(){return identity}
};
async function reloadData(quiet=false){
  try{state=await backend.load();render();if(cloudMode)setConnection('云端实时','live')}
  catch(error){setConnection('同步失败','error');if(!quiet)toast(readableError(error));throw error}
}
async function initialize(){
  const config=window.TNB_CONFIG||{};
  cloudMode=Boolean(config.supabaseUrl&&config.supabaseAnonKey);
  if(!cloudMode){backend=localBackend;save();setConnection('本地演示');render();return}
  setConnection('正在连接…');
  try{
    const {createCloudBackend}=await import('./cloud-backend.js?v=20260916-3');
    backend=await createCloudBackend(config);identity=await backend.getIdentity();
    await reloadData();backend.subscribe(()=>reloadData(true));
    backend.onAuthChange(()=>setTimeout(async()=>{try{identity=await backend.getIdentity()}catch{identity={user:null,isAdmin:false}}renderAccess()},0));
  }catch(error){
    backend={
      async load(){throw new Error('云端暂时不可用')},async addPlayer(){throw new Error('云端暂时不可用')},
      async addGame(){throw new Error('云端暂时不可用')},async signIn(){throw new Error('云端暂时不可用')},async signOut(){}
    };
    cloudMode=true;identity={user:null,isAdmin:false};state={players:[],games:[],seasons:defaultSeasons};
    setConnection('云端连接失败','error');render();toast(`云端连接失败：${readableError(error)}`);
  }
}
$('#resultForm [name=date]').value=new Date().toISOString().slice(0,10);
initialize();
