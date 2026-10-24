(() => {
  'use strict';

  const INDICATORS = {
    'NY.GDP.MKTP.CD': { label: 'GDP', long: 'GDP（名目・current US$）', kind: 'money', scale: 'log', worldLabel: '世界GDP' },
    'NY.GDP.MKTP.KD.ZG': { label: '成長率', long: '実質GDP成長率', kind: 'percent', scale: 'diverge', worldLabel: '世界GDP成長率' },
    'NY.GDP.PCAP.CD': { label: '1人GDP', long: '1人あたりGDP（current US$）', kind: 'money', scale: 'log', worldLabel: '世界の1人GDP' },
    'SP.POP.TOTL': { label: '人口', long: '人口', kind: 'count', scale: 'log', worldLabel: '世界人口' },
    'FP.CPI.TOTL.ZG': { label: 'インフレ', long: '消費者物価上昇率', kind: 'percent', scale: 'diverge', worldLabel: '世界インフレ率' }
  };

  const EVENTS = [
    { year: 1973, title: '第一次オイルショック', text: '原油価格の急上昇が、多くの国でインフレと景気減速をもたらした時期。エネルギー依存と物価の関係を見る入口になります。' },
    { year: 1985, title: 'プラザ合意', text: '主要5か国が為替の不均衡是正をめざして協調した年。円高が進み、日本経済の構造変化を考える重要な節目です。' },
    { year: 1997, title: 'アジア通貨危機', text: 'タイを起点に通貨・金融不安がアジア各国へ波及。成長率の急変が地図上でも見えやすいイベントです。' },
    { year: 2001, title: '中国のWTO加盟', text: '中国がWTOに加盟。世界貿易への統合が一段と進み、その後の製造業・輸出・GDP拡大を見る上で重要な節目です。' },
    { year: 2008, title: '世界金融危機', text: '米国の金融危機が世界経済へ波及。2008〜2009年の成長率を再生すると、多くの国で同時に減速した様子を確認できます。' },
    { year: 2020, title: 'COVID-19ショック', text: 'パンデミックと行動制限により、世界の多くの国で経済活動が急減。成長率の大きな落ち込みと、その後の反発を比較できます。' },
    { year: 2022, title: 'インフレ再加速', text: 'エネルギー・食料・供給制約など複数要因が重なり、多くの国で物価上昇が加速。インフレ指標で地域差を比較できます。' }
  ];

  const JP_NAMES = {
    JPN:'日本', USA:'米国', CHN:'中国', IND:'インド', DEU:'ドイツ', GBR:'英国', FRA:'フランス', ITA:'イタリア', BRA:'ブラジル', CAN:'カナダ', KOR:'韓国', AUS:'オーストラリア', ESP:'スペイン', MEX:'メキシコ', IDN:'インドネシア', TUR:'トルコ', SAU:'サウジアラビア', CHE:'スイス', NLD:'オランダ', SWE:'スウェーデン', NOR:'ノルウェー', RUS:'ロシア', ZAF:'南アフリカ', ARG:'アルゼンチン', THA:'タイ', VNM:'ベトナム', SGP:'シンガポール', MYS:'マレーシア', PHL:'フィリピン', POL:'ポーランド', IRL:'アイルランド', ARE:'UAE', ISR:'イスラエル', EGY:'エジプト', NGA:'ナイジェリア', PAK:'パキスタン', BGD:'バングラデシュ', NZL:'ニュージーランド', BEL:'ベルギー', AUT:'オーストリア', DNK:'デンマーク', FIN:'フィンランド', PRT:'ポルトガル', GRC:'ギリシャ', CZE:'チェコ'
  };

  const state = {
    year: 2023,
    minYear: 1960,
    maxYear: 2024,
    indicator: 'NY.GDP.MKTP.CD',
    indicatorData: null,
    countryMeta: [],
    geo: null,
    selectedIso: 'JPN',
    compareA: 'JPN',
    compareB: 'USA',
    playTimer: null,
    sourceMode: 'loading',
    indicatorCache: new Map()
  };

  const $ = (id) => document.getElementById(id);
  const els = {
    sourceBadge:$('sourceBadge'), refreshBtn:$('refreshBtn'), yearOutput:$('yearOutput'), yearSlider:$('yearSlider'), yearTicks:$('yearTicks'),
    eventStrip:$('eventStrip'), prevYearBtn:$('prevYearBtn'), nextYearBtn:$('nextYearBtn'), playBtn:$('playBtn'), mapTitle:$('mapTitle'), mapStatus:$('mapStatus'),
    worldMap:$('worldMap'), mapHover:$('mapHover'), snapshotYear:$('snapshotYear'), snapshotLabel:$('snapshotLabel'), snapshotValue:$('snapshotValue'), countryCount:$('countryCount'),
    medianValue:$('medianValue'), rankingTitle:$('rankingTitle'), rankingList:$('rankingList'), countryFlag:$('countryFlag'), countryName:$('countryName'), countrySelect:$('countrySelect'),
    countryMetricLabel:$('countryMetricLabel'), countryMetricValue:$('countryMetricValue'), countryRank:$('countryRank'), countryDelta:$('countryDelta'), countryChart:$('countryChart'),
    compareA:$('compareA'), compareB:$('compareB'), compareChart:$('compareChart'), compareLegend:$('compareLegend'), historyTitle:$('historyTitle'), historyCard:$('historyCard'),
    jumpEventBtn:$('jumpEventBtn'), footerStatus:$('footerStatus'), legendMin:$('legendMin'), legendMax:$('legendMax')
  };

  function isoFlag(iso2) {
    if (!iso2 || iso2.length !== 2) return '🌐';
    return String.fromCodePoint(...iso2.toUpperCase().split('').map(c => 127397 + c.charCodeAt(0)));
  }

  function countryLabel(meta) {
    if (!meta) return '—';
    return JP_NAMES[meta.iso3] || meta.name || meta.iso3;
  }

  function formatValue(value, indicator = state.indicator, compact = true) {
    if (value == null || !Number.isFinite(Number(value))) return '—';
    const n = Number(value); const cfg = INDICATORS[indicator];
    if (cfg.kind === 'percent') return `${n >= 0 ? '+' : ''}${n.toFixed(Math.abs(n) >= 100 ? 0 : 1)}%`;
    if (cfg.kind === 'money') {
      const a = Math.abs(n);
      if (compact && a >= 1e12) return `$${(n/1e12).toFixed(a >= 1e14 ? 0 : 1)}T`;
      if (compact && a >= 1e9) return `$${(n/1e9).toFixed(1)}B`;
      if (compact && a >= 1e6) return `$${(n/1e6).toFixed(1)}M`;
      return `$${Math.round(n).toLocaleString('ja-JP')}`;
    }
    if (cfg.kind === 'count') {
      const a = Math.abs(n);
      if (compact && a >= 1e9) return `${(n/1e9).toFixed(2)}B`;
      if (compact && a >= 1e6) return `${(n/1e6).toFixed(1)}M`;
      return Math.round(n).toLocaleString('ja-JP');
    }
    return n.toLocaleString('ja-JP');
  }

  function valueAt(iso, year = state.year) {
    return state.indicatorData?.series?.[iso]?.[String(year)] ?? null;
  }

  function allValuesForYear(year = state.year) {
    if (!state.indicatorData?.series) return [];
    const out=[];
    for (const [iso, series] of Object.entries(state.indicatorData.series)) {
      const v=series[String(year)];
      if (v != null && Number.isFinite(Number(v))) out.push([iso, Number(v)]);
    }
    return out;
  }

  function getMeta(iso) { return state.countryMeta.find(c => c.iso3 === iso) || { iso3:iso, iso2:'', name:iso }; }

  function median(nums) {
    if (!nums.length) return null;
    const s=[...nums].sort((a,b)=>a-b); const m=Math.floor(s.length/2);
    return s.length%2 ? s[m] : (s[m-1]+s[m])/2;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos=(sorted.length-1)*q, base=Math.floor(pos), rest=pos-base;
    return sorted[base+1] !== undefined ? sorted[base] + rest*(sorted[base+1]-sorted[base]) : sorted[base];
  }

  function computeColorModel(values) {
    const cfg=INDICATORS[state.indicator];
    const nums=values.map(([,v])=>v).filter(Number.isFinite);
    if (!nums.length) return {color:()=> '#162238', min:null, max:null};
    if (cfg.scale==='diverge') {
      const cap=Math.max(3, quantile(nums.map(Math.abs).sort((a,b)=>a-b), .9));
      return {
        min:-cap, max:cap,
        color(v){
          if (v==null) return '#111a2b';
          const t=Math.max(-1,Math.min(1,v/cap));
          if (t<0) return mix('#ff8c8c','#1a2a42',1-Math.abs(t));
          return mix('#1a2a42','#76d6a0',t);
        }
      };
    }
    const positive=nums.filter(v=>v>0).map(Math.log10).sort((a,b)=>a-b);
    const lo=quantile(positive,.08), hi=quantile(positive,.92);
    return {
      min:10**lo, max:10**hi,
      color(v){
        if (!(v>0)) return '#111a2b';
        const t=Math.max(0,Math.min(1,(Math.log10(v)-lo)/(hi-lo || 1)));
        const stops=['#17263f','#214e63','#368a82','#8eb467','#f0c662'];
        const p=t*(stops.length-1), i=Math.min(stops.length-2,Math.floor(p)), f=p-i;
        return mix(stops[i],stops[i+1],f);
      }
    };
  }

  function mix(a,b,t) {
    const pa=a.slice(1).match(/.{2}/g).map(x=>parseInt(x,16)), pb=b.slice(1).match(/.{2}/g).map(x=>parseInt(x,16));
    const c=pa.map((v,i)=>Math.round(v+(pb[i]-v)*t).toString(16).padStart(2,'0')).join('');
    return '#'+c;
  }

  async function fetchJson(url, timeoutMs=18000) {
    const ctl=new AbortController(); const timer=setTimeout(()=>ctl.abort(), timeoutMs);
    try {
      const r=await fetch(url,{cache:'no-store',signal:ctl.signal});
      if(!r.ok) throw new Error(`${r.status} ${r.statusText}`);
      return await r.json();
    } finally { clearTimeout(timer); }
  }

  async function loadCountries(forceLive=false) {
    if (!forceLive) {
      try {
        const local=await fetchJson('data/countries.json', 5000);
        if (Array.isArray(local) && local.length>100) { state.sourceMode='cache'; return local; }
      } catch (_) {}
    }
    const raw=await fetchJson('https://api.worldbank.org/v2/country?format=json&per_page=400', 20000);
    const rows=raw?.[1] || [];
    return rows.filter(x => x?.region?.value && x.region.value !== 'Aggregates').map(x => ({
      iso3:x.id, iso2:x.iso2Code, name:x.name, region:x.region?.value || '', income:x.incomeLevel?.value || '', capital:x.capitalCity || ''
    }));
  }

  function normalizeIndicatorPayload(code, raw) {
    if (raw?.series) return raw;
    const rows=raw?.[1] || [];
    const series={}, aggregates={}; let maxYear=state.minYear;
    for (const r of rows) {
      const y=Number(r.date), v=r.value == null ? null : Number(r.value), iso=r.countryiso3code;
      if (!Number.isFinite(y) || v==null || !Number.isFinite(v) || !iso) continue;
      maxYear=Math.max(maxYear,y);
      const isCountry=state.countryMeta.some(c=>c.iso3===iso);
      const target=isCountry ? series : aggregates;
      if (!target[iso]) target[iso]={};
      target[iso][String(y)]=v;
    }
    return { indicator:{code,name:INDICATORS[code].long,source:'World Bank Indicators API'}, series, aggregates, latest_year:maxYear };
  }

  async function loadIndicator(code, forceLive=false) {
    if (!forceLive && state.indicatorCache.has(code)) return state.indicatorCache.get(code);
    let payload=null; let source='cache';
    if (!forceLive) {
      try { payload=await fetchJson(`data/${code}.json`, 5000); } catch (_) {}
    }
    if (!payload) {
      source='live';
      const url=`https://api.worldbank.org/v2/country/all/indicator/${encodeURIComponent(code)}?format=json&per_page=40000&date=1960:2026`;
      payload=await fetchJson(url, 25000);
    }
    const normalized=normalizeIndicatorPayload(code,payload);
    normalized._source=source;
    state.indicatorCache.set(code,normalized);
    return normalized;
  }

  async function loadDemoSnapshot(code) {
    const demo=await fetchJson('data/demo_snapshot.json',5000);
    const snap=demo?.indicators?.[code];
    if (!snap) throw new Error('この指標にはデモデータがありません');
    const series={}; for (const [iso,v] of Object.entries(snap)) series[iso]={'2017':v};
    return { indicator:{code,name:INDICATORS[code].long,source:demo.source}, series, aggregates:{}, latest_year:2017, _source:'demo' };
  }

  async function ensureIndicator(code, {forceLive=false}={}) {
    stopPlay();
    state.indicator=code;
    setLoading(true, `${INDICATORS[code].label}データを読み込み中…`);
    try {
      state.indicatorData=await loadIndicator(code, forceLive);
      state.sourceMode=state.indicatorData._source;
      const latest=Number(state.indicatorData.latest_year)||state.maxYear;
      state.maxYear=Math.max(state.minYear, Math.min(2026, latest));
      if (state.year>state.maxYear || state.year<state.minYear) state.year=state.maxYear;
      if (!hasAnyValue(state.year)) state.year=findNearestAvailableYear(state.year);
      updateYearControls();
      renderAll();
      updateSourceBadge();
    } catch (err) {
      console.warn('World Bank load failed',err);
      try {
        state.indicatorData=await loadDemoSnapshot(code);
        state.sourceMode='demo'; state.year=2017; state.maxYear=2017;
        updateYearControls(); renderAll(); updateSourceBadge();
        els.mapStatus.innerHTML='<span class="error-box">World Bank APIに接続できないため、2017年のデモスナップショットを表示しています。</span>';
      } catch (demoErr) {
        els.mapStatus.innerHTML=`<span class="error-box">データを取得できませんでした。ネット接続またはGitHub Actionsのキャッシュ生成を確認してください。</span>`;
        updateSourceBadge('error');
      }
    } finally { setLoading(false); }
  }

  function hasAnyValue(year){ return allValuesForYear(year).length>5; }
  function findNearestAvailableYear(target){
    for(let d=0; d<=70; d++){
      for(const y of [target-d,target+d]) if(y>=state.minYear && y<=state.maxYear && hasAnyValue(y)) return y;
    }
    return state.maxYear;
  }

  function updateSourceBadge(mode) {
    const m=mode||state.sourceMode;
    const labels={cache:'DATA: GitHub cache',live:'DATA: World Bank live',demo:'DATA: demo 2017',loading:'DATA: loading…',error:'DATA: unavailable'};
    els.sourceBadge.textContent=labels[m]||labels.loading;
    els.footerStatus.textContent=m==='demo' ? 'Demo snapshot — run GitHub Actions for full history' : 'GitHub Pages + World Bank Open Data';
  }

  function setLoading(isLoading, text='') {
    document.body.classList.toggle('loading-skeleton',false);
    if (text) els.mapStatus.textContent=text;
    els.refreshBtn.disabled=isLoading;
  }

  function updateYearControls() {
    els.yearSlider.min=String(state.minYear); els.yearSlider.max=String(state.maxYear); els.yearSlider.value=String(state.year); els.yearOutput.value=String(state.year);
    const ticks=[state.minYear,1980,2000,2020,state.maxYear].filter((v,i,a)=>v>=state.minYear&&v<=state.maxYear&&a.indexOf(v)===i).sort((a,b)=>a-b);
    els.yearTicks.innerHTML=ticks.map(y=>`<span>${y}</span>`).join('');
  }

  function renderAll() {
    renderIndicatorButtons(); renderEvents(); renderMap(); renderSnapshot(); renderRanking(); renderCountryPanel(); renderCompare(); renderHistory();
  }

  function renderIndicatorButtons() {
    document.querySelectorAll('.indicator-btn').forEach(b=>b.classList.toggle('active',b.dataset.indicator===state.indicator));
  }

  function renderEvents() {
    els.eventStrip.innerHTML='';
    for(const ev of EVENTS){
      const b=document.createElement('button'); b.type='button'; b.className='event-chip'+(ev.year===state.year?' active':''); b.textContent=`${ev.year} · ${ev.title}`;
      b.addEventListener('click',()=>setYear(ev.year)); els.eventStrip.appendChild(b);
    }
  }

  function project(lon,lat,w=1000,h=510){ return [(lon+180)/360*w,(90-lat)/180*h]; }
  function pathRing(ring){
    let d='', prevLon=null;
    ring.forEach(([lon,lat],i)=>{
      const [x,y]=project(lon,lat); const jump=prevLon!=null && Math.abs(lon-prevLon)>180;
      d += (i===0||jump?`M${x.toFixed(1)},${y.toFixed(1)}`:`L${x.toFixed(1)},${y.toFixed(1)}`);
      prevLon=lon;
    });
    return d+'Z';
  }
  function geometryPath(g){
    if(!g) return '';
    if(g.type==='Polygon') return g.coordinates.map(pathRing).join('');
    if(g.type==='MultiPolygon') return g.coordinates.flatMap(poly=>poly.map(pathRing)).join('');
    return '';
  }

  function renderMap(){
    if(!state.geo || !state.indicatorData) return;
    const vals=allValuesForYear(state.year), model=computeColorModel(vals);
    els.mapTitle.textContent=`${INDICATORS[state.indicator].long} — ${state.year}`;
    els.legendMin.textContent=model.min==null?'低':formatValue(model.min,state.indicator);
    els.legendMax.textContent=model.max==null?'高':formatValue(model.max,state.indicator);
    els.worldMap.innerHTML='';
    const frag=document.createDocumentFragment();
    let matched=0;
    for(const f of state.geo.features){
      const iso=f.properties.iso_a3, v=valueAt(iso); if(v!=null) matched++;
      const p=document.createElementNS('http://www.w3.org/2000/svg','path');
      p.setAttribute('d',geometryPath(f.geometry)); p.setAttribute('fill',model.color(v)); p.setAttribute('class','country-shape'+(iso===state.selectedIso?' selected':''));
      p.dataset.iso=iso; p.dataset.name=f.properties.name;
      const title=document.createElementNS('http://www.w3.org/2000/svg','title');
      title.textContent=`${countryLabel(getMeta(iso))}: ${formatValue(v)}`; p.appendChild(title);
      p.addEventListener('click',()=>selectCountry(iso));
      p.addEventListener('pointerenter',(e)=>showMapHover(e,iso,v)); p.addEventListener('pointermove',(e)=>showMapHover(e,iso,v)); p.addEventListener('pointerleave',()=>{els.mapHover.hidden=true;});
      frag.appendChild(p);
    }
    els.worldMap.appendChild(frag);
    els.mapStatus.textContent=`${state.year}年 · ${matched}地域を地図に反映`;
  }

  function showMapHover(e,iso,v){
    const meta=getMeta(iso); els.mapHover.hidden=false; els.mapHover.innerHTML=`<strong>${isoFlag(meta.iso2)} ${countryLabel(meta)}</strong><br>${INDICATORS[state.indicator].label}: ${formatValue(v)}`;
    const rect=e.currentTarget.ownerSVGElement.getBoundingClientRect(), parent=e.currentTarget.ownerSVGElement.parentElement.getBoundingClientRect();
    const x=Math.min(parent.width-170,Math.max(5,e.clientX-parent.left+12)), y=Math.max(5,e.clientY-parent.top-30);
    els.mapHover.style.left=`${x}px`; els.mapHover.style.top=`${y}px`;
  }

  function renderSnapshot(){
    const vals=allValuesForYear(state.year), nums=vals.map(([,v])=>v);
    els.snapshotYear.textContent=state.year; els.snapshotLabel.textContent=INDICATORS[state.indicator].worldLabel; els.countryCount.textContent=`${vals.length}か国`;
    const wld=state.indicatorData?.aggregates?.WLD?.[String(state.year)];
    let summary=wld;
    if(summary==null){
      if(['NY.GDP.MKTP.CD','SP.POP.TOTL'].includes(state.indicator)) summary=nums.reduce((a,b)=>a+b,0);
      else summary=median(nums);
    }
    els.snapshotValue.textContent=formatValue(summary); els.medianValue.textContent=formatValue(median(nums));
  }

  function rankingData(year=state.year){ return allValuesForYear(year).sort((a,b)=>b[1]-a[1]); }
  function renderRanking(){
    const list=rankingData().slice(0,10); els.rankingTitle.textContent=`${INDICATORS[state.indicator].label}ランキング`; els.rankingList.innerHTML='';
    list.forEach(([iso,v],idx)=>{
      const meta=getMeta(iso), li=document.createElement('li'); li.className='ranking-item';
      const btn=document.createElement('button'); btn.type='button'; btn.innerHTML=`<span class="rank-num">${idx+1}</span><span class="rank-name">${isoFlag(meta.iso2)} ${escapeHtml(countryLabel(meta))}</span>`;
      btn.addEventListener('click',()=>selectCountry(iso));
      const val=document.createElement('span'); val.className='rank-value'; val.textContent=formatValue(v);
      li.append(btn,val); els.rankingList.appendChild(li);
    });
  }

  function renderCountrySelects(){
    const countries=[...state.countryMeta].sort((a,b)=>countryLabel(a).localeCompare(countryLabel(b),'ja'));
    const html=countries.map(c=>`<option value="${c.iso3}">${isoFlag(c.iso2)} ${escapeHtml(countryLabel(c))}</option>`).join('');
    for(const sel of [els.countrySelect,els.compareA,els.compareB]) sel.innerHTML=html;
    if(countries.some(c=>c.iso3===state.selectedIso)) els.countrySelect.value=state.selectedIso;
    if(countries.some(c=>c.iso3===state.compareA)) els.compareA.value=state.compareA;
    if(countries.some(c=>c.iso3===state.compareB)) els.compareB.value=state.compareB;
  }

  function renderCountryPanel(){
    const meta=getMeta(state.selectedIso), v=valueAt(state.selectedIso), prev=valueAt(state.selectedIso,state.year-1);
    els.countryFlag.textContent=isoFlag(meta.iso2); els.countryName.textContent=countryLabel(meta); els.countryMetricLabel.textContent=INDICATORS[state.indicator].label; els.countryMetricValue.textContent=formatValue(v);
    const rank=rankingData().findIndex(([iso])=>iso===state.selectedIso); els.countryRank.textContent=rank>=0?`#${rank+1}`:'—';
    if(v!=null&&prev!=null){ const diff=v-prev; els.countryDelta.textContent=INDICATORS[state.indicator].kind==='percent'?`${diff>=0?'+':''}${diff.toFixed(1)}pt`:formatValue(diff); els.countryDelta.style.color=diff>=0?'var(--up)':'var(--down)'; }
    else { els.countryDelta.textContent='—'; els.countryDelta.style.color=''; }
    els.countrySelect.value=state.selectedIso; drawLineChart(els.countryChart,[{iso:state.selectedIso,cls:'chart-line-a'}],state.year);
  }

  function renderCompare(){
    els.compareA.value=state.compareA; els.compareB.value=state.compareB;
    drawLineChart(els.compareChart,[{iso:state.compareA,cls:'chart-line-a'},{iso:state.compareB,cls:'chart-line-b'}],state.year);
    const a=getMeta(state.compareA),b=getMeta(state.compareB); els.compareLegend.innerHTML=`<span>${isoFlag(a.iso2)} ${escapeHtml(countryLabel(a))}</span><span>${isoFlag(b.iso2)} ${escapeHtml(countryLabel(b))}</span>`;
  }

  function seriesPoints(iso){
    const s=state.indicatorData?.series?.[iso]||{}; return Object.entries(s).map(([y,v])=>[Number(y),Number(v)]).filter(([y,v])=>Number.isFinite(y)&&Number.isFinite(v)&&y>=state.minYear).sort((a,b)=>a[0]-b[0]);
  }

  function drawLineChart(svg, seriesDefs, markerYear){
    const W=820,H=250,p={l:58,r:16,t:18,b:32}; svg.innerHTML='';
    const series=seriesDefs.map(d=>({ ...d, points:seriesPoints(d.iso) })).filter(s=>s.points.length);
    const all=series.flatMap(s=>s.points.map(p=>p[1])); if(!all.length){ svg.innerHTML='<text x="410" y="125" text-anchor="middle" class="chart-axis-text">データなし</text>'; return; }
    let min=Math.min(...all),max=Math.max(...all); if(min===max){min-=1;max+=1;}
    if(INDICATORS[state.indicator].scale==='log' && min>0){ min=Math.log10(min); max=Math.log10(max); }
    const x=y=>p.l+(y-state.minYear)/(Math.max(state.maxYear,state.minYear+1)-state.minYear)*(W-p.l-p.r);
    const yy=v=>{ const z=(INDICATORS[state.indicator].scale==='log'&&v>0)?Math.log10(v):v; return p.t+(max-z)/(max-min)*(H-p.t-p.b); };
    for(let i=0;i<4;i++){
      const y=p.t+i*(H-p.t-p.b)/3; const line=svgEl('line',{x1:p.l,x2:W-p.r,y1:y,y2:y,class:'chart-grid'}); svg.appendChild(line);
      const raw=max-(max-min)*i/3; const val=INDICATORS[state.indicator].scale==='log'?10**raw:raw; const txt=svgEl('text',{x:p.l-8,y:y+4,'text-anchor':'end',class:'chart-axis-text'}); txt.textContent=formatValue(val,state.indicator); svg.appendChild(txt);
    }
    [state.minYear,1980,2000,2020,state.maxYear].filter((v,i,a)=>v>=state.minYear&&v<=state.maxYear&&a.indexOf(v)===i).forEach(yv=>{ const t=svgEl('text',{x:x(yv),y:H-9,'text-anchor':'middle',class:'chart-axis-text'}); t.textContent=yv; svg.appendChild(t); });
    const marker=svgEl('line',{x1:x(markerYear),x2:x(markerYear),y1:p.t,y2:H-p.b,class:'chart-year-marker'}); svg.appendChild(marker);
    for(const s of series){
      let d='',prevYear=null;
      for(const [year,val] of s.points){ if(year>state.maxYear) continue; const cmd=prevYear!=null&&year-prevYear<=2?'L':'M'; d+=`${cmd}${x(year).toFixed(1)},${yy(val).toFixed(1)}`; prevYear=year; }
      const path=svgEl('path',{d,class:s.cls}); svg.appendChild(path);
      const selected=s.points.find(([y])=>y===markerYear); if(selected){ const dot=svgEl('circle',{cx:x(selected[0]),cy:yy(selected[1]),r:4.5,class:'chart-dot',fill:s.cls==='chart-line-a'?'var(--accent)':'var(--accent-2)'}); svg.appendChild(dot); }
    }
  }

  function svgEl(name,attrs){ const el=document.createElementNS('http://www.w3.org/2000/svg',name); for(const[k,v]of Object.entries(attrs)) el.setAttribute(k,v); return el; }

  function renderHistory(){
    let ev=EVENTS.find(e=>e.year===state.year); if(!ev) ev=EVENTS.reduce((best,e)=>Math.abs(e.year-state.year)<Math.abs(best.year-state.year)?e:best,EVENTS[0]);
    const exact=ev.year===state.year; els.historyTitle.textContent=exact?`${state.year}年 — ${ev.title}`:`${state.year}年に近い経済史イベント`;
    els.historyCard.innerHTML=`<div class="history-year">${ev.year}</div><div><h3>${escapeHtml(ev.title)}</h3><p>${escapeHtml(ev.text)}</p>${exact?'':`<p class="map-note">現在表示中は${state.year}年。イベント年へ移動すると、その年のデータを確認できます。</p>`}</div>`;
  }

  function selectCountry(iso){
    if(!iso || iso==='-99') return; state.selectedIso=iso; els.countrySelect.value=iso; renderMap(); renderCountryPanel();
    document.querySelector('.country-panel')?.scrollIntoView({behavior:'smooth',block:'center'});
  }

  function setYear(y){
    const yy=Math.max(state.minYear,Math.min(state.maxYear,Number(y)||state.year)); state.year=yy; updateYearControls(); renderAll();
  }

  function startPlay(){
    if(state.playTimer) return stopPlay();
    els.playBtn.classList.add('running'); els.playBtn.innerHTML='<span aria-hidden="true">Ⅱ</span> 一時停止';
    state.playTimer=setInterval(()=>{
      let y=state.year+1; if(y>state.maxYear)y=state.minYear; setYear(y);
    },700);
  }
  function stopPlay(){ if(state.playTimer){ clearInterval(state.playTimer); state.playTimer=null; } els.playBtn.classList.remove('running'); els.playBtn.innerHTML='<span aria-hidden="true">▶</span> 時間を再生'; }

  function jumpNextEvent(){ const next=EVENTS.find(e=>e.year>state.year) || EVENTS[0]; setYear(next.year); }
  function escapeHtml(s){ return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c])); }

  async function init(forceLive=false){
    updateSourceBadge('loading');
    try {
      const [geo,countries]=await Promise.all([fetchJson('data/world.geojson',8000),loadCountries(forceLive)]);
      state.geo=geo; state.countryMeta=countries; renderCountrySelects();
      await ensureIndicator(state.indicator,{forceLive});
    } catch(err){
      console.error(err); els.mapStatus.innerHTML='<span class="error-box">初期化に失敗しました。GitHub Pages上で開いているか確認してください。</span>'; updateSourceBadge('error');
    }
  }

  document.querySelectorAll('.indicator-btn').forEach(btn=>btn.addEventListener('click',()=>ensureIndicator(btn.dataset.indicator)));
  els.yearSlider.addEventListener('input',e=>setYear(e.target.value));
  els.prevYearBtn.addEventListener('click',()=>setYear(state.year-1)); els.nextYearBtn.addEventListener('click',()=>setYear(state.year+1)); els.playBtn.addEventListener('click',startPlay);
  els.countrySelect.addEventListener('change',e=>{state.selectedIso=e.target.value; renderMap(); renderCountryPanel();});
  els.compareA.addEventListener('change',e=>{state.compareA=e.target.value; renderCompare();}); els.compareB.addEventListener('change',e=>{state.compareB=e.target.value; renderCompare();});
  els.jumpEventBtn.addEventListener('click',jumpNextEvent);
  els.refreshBtn.addEventListener('click',async()=>{ state.indicatorCache.clear(); try{ state.countryMeta=await loadCountries(true); renderCountrySelects(); }catch(_){} await ensureIndicator(state.indicator,{forceLive:true}); });
  window.addEventListener('pagehide',stopPlay);

  init();
})();
