// ─────────────────────────────────────────────────────────────
//  푸린네 태교 다이어리 · 로직
// ─────────────────────────────────────────────────────────────
(function () {
  "use strict";
  var C = window.CONFIG, M = window.MESSAGES;
  var STORE_KEY = "purin-diary-v1";

  // ── 날짜 헬퍼 (로컬 타임존 기준) ──
  function pad(n){ return (n < 10 ? "0" : "") + n; }
  function iso(d){ return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate()); }
  function parse(s){ var a = s.split("-"); return new Date(+a[0], +a[1]-1, +a[2]); }
  function addDays(s, n){ var d = parse(s); d.setDate(d.getDate()+n); return iso(d); }
  function diffDays(a, b){ return Math.round((parse(b) - parse(a)) / 86400000); }
  function today(){ return iso(new Date()); }
  function fmtK(s){ var a = s.split("-"); return (+a[1]) + "월 " + (+a[2]) + "일"; }

  // ── 상태 ──
  function load(){
    try { return JSON.parse(localStorage.getItem(STORE_KEY)) || {}; }
    catch(e){ return {}; }
  }
  function save(){ localStorage.setItem(STORE_KEY, JSON.stringify(state)); }
  var state = load();
  if (!state.clears) state.clears = [];
  if (!state.unlocked) state.unlocked = [];
  if (!state.notes) state.notes = [];
  if (!state.firstOpen) { state.firstOpen = today(); save(); }

  function hasClear(d){ return state.clears.indexOf(d) !== -1; }

  // ── 메시지 저장소: Firebase(공유) 또는 localStorage(이 기기) ──
  var currentScreen = "home";
  var FC = window.FIREBASE_CONFIG;
  var useCloud = !!(FC && FC.apiKey);
  var notesCol = null;
  function initCloud(){
    try {
      firebase.initializeApp(FC);
      firebase.auth().signInAnonymously().catch(function(e){ console.warn("auth 실패", e); });
      notesCol = firebase.firestore().collection("notes");
      notesCol.orderBy("ts", "desc").onSnapshot(function(snap){
        state.notes = [];
        snap.forEach(function(doc){ var n = doc.data(); n.id = doc.id; state.notes.push(n); });
        if (currentScreen === "letters") renderNotes();
      }, function(err){ console.warn("동기화 실패", err); });
    } catch(e){
      console.warn("Firebase 초기화 실패 — 기기 저장 모드로 전환", e);
      useCloud = false;
    }
  }

  // ── 계산 ──
  function gaInfo(){
    var days = diffDays(C.lmpDate, today());
    if (days < 0) days = 0;
    return { days: days, w: Math.floor(days/7), d: days % 7 };
  }
  function milestoneDate(week){ return addDays(C.lmpDate, week*7); }

  function nextMilestone(){
    var t = today();
    for (var i=0; i<C.milestones.length; i++){
      if (diffDays(milestoneDate(C.milestones[i].week), t) < 0) return C.milestones[i];
    }
    return null;
  }
  function prevMilestoneDate(){
    var t = today(), prev = C.firstDay;
    for (var i=0; i<C.milestones.length; i++){
      var md = milestoneDate(C.milestones[i].week);
      if (diffDays(md, t) < 0) return prev;
      prev = md;
    }
    return prev;
  }

  function streak(){
    var t = today(), cur;
    if (hasClear(t)) cur = t;
    else if (hasClear(addDays(t,-1))) cur = addDays(t,-1);
    else return 0;
    var n = 0;
    while (hasClear(cur)) { n++; cur = addDays(cur,-1); }
    return n;
  }
  function longest(){
    var s = state.clears.slice().sort();
    var best = 0, run = 0, prev = null;
    for (var i=0;i<s.length;i++){
      if (prev && diffDays(prev, s[i]) === 1) run++; else run = 1;
      if (run > best) best = run;
      prev = s[i];
    }
    return best;
  }

  // 매일 달라지는 시스템 응원 (날짜 인덱스로 조합)
  function systemMsg(){
    var S = M.system, i = Math.abs(diffDays(C.firstDay, today()));
    return {
      label: S.labels[i % S.labels.length],
      line:  S.lines[i % S.lines.length],
      buff:  S.buffs[(i * 3) % S.buffs.length],
    };
  }

  // ── 캐릭터 SVG ──
  function nuoh(){ return '<svg viewBox="0 0 100 100" width="70" height="70"><ellipse cx="50" cy="60" rx="28" ry="33" fill="#85B7EB" stroke="#378ADD" stroke-width="3"/><path d="M34 30 q16 -14 32 0" fill="#85B7EB" stroke="#378ADD" stroke-width="3"/><circle cx="37" cy="44" r="3.4" fill="#12203f"/><circle cx="63" cy="44" r="3.4" fill="#12203f"/><path d="M35 55 q15 8 30 0" fill="none" stroke="#378ADD" stroke-width="2.5" stroke-linecap="round"/></svg>'; }
  function purin(size){ size = size || 78; return '<svg viewBox="0 0 100 100" width="'+size+'" height="'+size+'"><circle cx="50" cy="56" r="33" fill="#F4C0D1" stroke="#D4537E" stroke-width="3"/><path d="M29 32 L21 9 L43 27 Z" fill="#F4C0D1" stroke="#D4537E" stroke-width="3" stroke-linejoin="round"/><path d="M71 32 L79 9 L57 27 Z" fill="#F4C0D1" stroke="#D4537E" stroke-width="3" stroke-linejoin="round"/><path d="M41 33 q6 -9 13 -4" fill="none" stroke="#D4537E" stroke-width="3" stroke-linecap="round"/><circle cx="41" cy="53" r="6.5" fill="#12203f"/><circle cx="59" cy="53" r="6.5" fill="#12203f"/><circle cx="43" cy="50" r="2.2" fill="#fff"/><circle cx="61" cy="50" r="2.2" fill="#fff"/><circle cx="31" cy="63" r="4" fill="#ED93B1"/><circle cx="69" cy="63" r="4" fill="#ED93B1"/><path d="M46 66 q4 4 8 0" fill="none" stroke="#D4537E" stroke-width="2.5" stroke-linecap="round"/></svg>'; }
  function puupurin(scale){
    var s = 30 + Math.round(26 * scale);
    return '<svg viewBox="0 0 60 60" width="'+s+'" height="'+s+'"><ellipse cx="30" cy="37" rx="19" ry="17" fill="#F4C0D1" stroke="#D4537E" stroke-width="2.5"/><path d="M22 21 q6 -10 12 -3" fill="none" stroke="#D4537E" stroke-width="2.5" stroke-linecap="round"/><circle cx="24" cy="37" r="3.6" fill="#12203f"/><circle cx="36" cy="37" r="3.6" fill="#12203f"/><path d="M26 45 q4 3 8 0" fill="none" stroke="#D4537E" stroke-width="2" stroke-linecap="round"/></svg>';
  }

  // ── 렌더 ──
  function babyScale(){
    var g = gaInfo().days, a = 24*7, b = 40*7;
    return Math.max(0, Math.min(1, (g - a) / (b - a)));
  }

  function renderScene(){
    var sw = document.getElementById("stars"), html = "";
    var pos = [[16,24],[30,70],[20,130],[44,200],[14,250],[58,40],[70,300],[36,180],[26,330]];
    for (var i=0;i<pos.length;i++){
      var sz = (i%3===0)?3:2;
      html += '<span style="top:'+pos[i][0]+'px;left:'+pos[i][1]+'px;width:'+sz+'px;height:'+sz+'px;animation-delay:'+(i*0.3)+'s"></span>';
    }
    sw.innerHTML = html;

    var reached37 = diffDays(milestoneDate(37), today()) >= 0;
    var babyHtml = reached37 ? purin(52) : puupurin(babyScale());
    document.getElementById("chars").innerHTML =
      '<span class="float">'+nuoh()+'</span>' +
      '<span class="float b" style="margin-bottom:6px">'+babyHtml+'</span>' +
      '<span class="float c">'+purin(80)+'</span>';
  }

  function renderHome(){
    var ga = gaInfo();
    document.getElementById("heroGa").textContent = "임신 " + ga.w + "주 " + ga.d + "일";
    var dDue = diffDays(today(), C.dueDate);
    var d37 = diffDays(today(), milestoneDate(37));
    var sub = (d37 > 0) ? ("만삭까지 D-" + d37 + " · 예정일 " + fmtK(C.dueDate))
                        : ("예정일까지 D-" + Math.max(dDue,0) + " · " + fmtK(C.dueDate));
    document.getElementById("heroSub").textContent = sub;

    var nm = nextMilestone();
    var pl = document.getElementById("progLabel"), pc = document.getElementById("progCount");
    if (nm){
      var start = prevMilestoneDate(), end = milestoneDate(nm.week);
      var total = diffDays(start, end), done = diffDays(start, today());
      if (done > total) done = total; if (done < 0) done = 0;
      pl.textContent = "다음 목표 · " + nm.week + "주 " + nm.title;
      pc.textContent = done + " / " + total + "일";
      document.getElementById("barFill").style.width = (total? Math.round(done/total*100):100) + "%";
    } else {
      pl.textContent = "모든 고비 통과 · 만삭 도달";
      pc.textContent = "축하해요";
      document.getElementById("barFill").style.width = "100%";
    }

    document.getElementById("streakNum").textContent = streak();

    var t = today(), btn = document.getElementById("clearBtn"), lbl = document.getElementById("clearLabel");
    if (hasClear(t)){
      btn.classList.add("done"); lbl.textContent = "오늘 클리어 완료 ✓"; btn.disabled = true;
    } else {
      btn.classList.remove("done"); lbl.textContent = "오늘도 무사히 하루 클리어"; btn.disabled = false;
    }

    var y = addDays(t,-1);
    document.getElementById("catchupBtn").hidden = hasClear(y) || diffDays(C.firstDay, y) < 0;

    // 매일 다른 시스템 응원
    var sys = systemMsg();
    document.getElementById("sysLabel").textContent = sys.label;
    document.getElementById("sysBuff").textContent = sys.buff;
    document.getElementById("sysLine").textContent = sys.line;

    // 누오의 편지
    var msg = M.daily[t];
    if (!msg){
      var idx = Math.abs(diffDays(C.firstDay, t)) % M.fallback.length;
      msg = M.fallback[idx];
    }
    document.getElementById("letterBody").textContent = msg;

    renderScene();
  }

  function renderDex(){
    document.getElementById("stats").innerHTML =
      stat(state.clears.length, "함께한 날") +
      stat(streak(), "연속 기록") +
      stat(longest(), "최장 기록");

    var html = "";
    for (var i=0;i<C.milestones.length;i++){
      var m = C.milestones[i], md = milestoneDate(m.week);
      var un = state.unlocked.indexOf(m.week) !== -1;
      html += '<div class="badge ' + (un?"unlocked":"locked") + '">' +
        '<div class="medal">' + (un ? m.week+"주" : "🔒") + '</div>' +
        '<div><div class="bt">' + m.week + '주 · ' + m.title + '</div>' +
        '<div class="bd">' + m.desc + '</div></div>' +
        '<div class="bdate">' + (un ? "달성" : fmtK(md)) + '</div></div>';
    }
    document.getElementById("badges").innerHTML = html;
  }
  function stat(n,l){ return '<div class="stat"><div class="n">'+n+'</div><div class="l">'+l+'</div></div>'; }

  function esc(s){ return s.replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;"); }

  // 엄마·아빠가 주고받은 메시지
  function renderNotes(){
    var box = document.getElementById("notesList");
    if (!state.notes.length){
      box.innerHTML = '<div class="notes-empty">아직 남긴 메시지가 없어요. 첫 마디를 남겨보세요.</div>';
      return;
    }
    var arr = state.notes.slice().sort(function(a,b){ return b.ts - a.ts; });
    var html = "";
    for (var i=0;i<arr.length;i++){
      var n = arr[i];
      var who = n.a === "mom" ? "엄마 푸린" : "아빠 누오";
      html += '<div class="note">' +
        '<div class="note-top">' +
          '<span class="note-badge ' + n.a + '">' + who + '</span>' +
          '<span class="note-date">' + fmtK(n.d) + '</span>' +
          '<button class="note-del" data-id="' + n.id + '" aria-label="삭제">×</button>' +
        '</div>' +
        '<div class="note-text">' + esc(n.t) + '</div></div>';
    }
    box.innerHTML = html;
    var dels = box.querySelectorAll(".note-del");
    for (var j=0;j<dels.length;j++){
      dels[j].onclick = function(){
        var id = this.getAttribute("data-id");
        if (!confirm("이 메시지를 지울까요?")) return;
        removeNote(id);
      };
    }
  }
  function removeNote(id){
    if (useCloud && notesCol){ notesCol.doc(id).delete(); return; }
    state.notes = state.notes.filter(function(x){ return String(x.id) !== String(id); });
    save(); renderNotes();
  }

  function renderArchive(){
    var t = today(), list = document.getElementById("letterList"), html = "";
    var keys = Object.keys(M.daily).filter(function(k){ return diffDays(k, t) >= 0; }).sort().reverse();
    if (!keys.length){ list.innerHTML = '<div class="notes-empty">아직 도착한 편지가 없어요.</div>'; return; }
    for (var i=0;i<keys.length;i++){
      var k = keys[i], txt = esc(M.daily[k]);
      html += '<div class="li">' +
        '<div class="lidate">' + fmtK(k) + '</div>' +
        '<div class="lipreview">' + txt + '</div>' +
        '<div class="litext">' + txt + '</div></div>';
    }
    list.innerHTML = html;
    var items = list.querySelectorAll(".li");
    for (var j=0;j<items.length;j++){
      items[j].onclick = function(){ this.classList.toggle("open"); };
    }
  }

  function renderLetters(){ renderNotes(); renderArchive(); }

  // ── 별가루 ──
  function burst(){
    var box = document.getElementById("confetti"), glyphs = ["★","✦","♡","✧"];
    for (var i=0;i<44;i++){
      var p = document.createElement("span");
      p.className = "p"; p.textContent = glyphs[i % glyphs.length];
      p.style.left = Math.random()*100 + "vw";
      p.style.color = (i%2) ? "#f7b955" : "#F4C0D1";
      p.style.fontSize = (12 + Math.random()*14) + "px";
      p.style.animationDuration = (1.6 + Math.random()*1.4) + "s";
      p.style.animationDelay = (Math.random()*0.4) + "s";
      box.appendChild(p);
      (function(el){ setTimeout(function(){ el.remove(); }, 3200); })(p);
    }
  }

  // ── 마일스톤 이벤트 ──
  var queue = [];
  function checkMilestones(){
    var t = today();
    for (var i=0;i<C.milestones.length;i++){
      var m = C.milestones[i];
      if (diffDays(milestoneDate(m.week), t) >= 0 && state.unlocked.indexOf(m.week) === -1){
        queue.push(m);
      }
    }
    showNext();
  }
  function showNext(){
    if (!queue.length) return;
    var m = queue.shift();
    var reached37 = m.week >= 37;
    document.getElementById("modalChar").innerHTML = reached37 ? purin(96) : puupurin(1);
    document.getElementById("modalBadge").textContent = m.week + "주";
    document.getElementById("modalTitle").textContent = m.title;
    document.getElementById("modalDesc").textContent = m.desc;
    document.getElementById("modalLetter").textContent = M.milestones[m.week] || "";
    document.getElementById("modal").hidden = false;
    burst();
    if (state.unlocked.indexOf(m.week) === -1){ state.unlocked.push(m.week); save(); }
  }
  document.getElementById("modalClose").onclick = function(){
    document.getElementById("modal").hidden = true;
    if (queue.length) setTimeout(showNext, 300);
    else renderHome();
  };

  // ── 액션 ──
  function doClear(dateStr){
    if (hasClear(dateStr)) return;
    state.clears.push(dateStr); save();
    burst();
    renderHome();
  }
  document.getElementById("clearBtn").onclick = function(){ doClear(today()); };
  document.getElementById("catchupBtn").onclick = function(){ doClear(addDays(today(),-1)); };

  // 메시지 작성
  var noteAuthor = "dad";
  var segs = document.querySelectorAll(".aseg");
  for (var s=0;s<segs.length;s++){
    segs[s].onclick = function(){
      noteAuthor = this.getAttribute("data-author");
      for (var k=0;k<segs.length;k++) segs[k].classList.toggle("active", segs[k]===this);
    }.bind(segs[s]);
  }
  document.getElementById("saveNote").onclick = function(){
    var el = document.getElementById("noteInput"), txt = el.value.trim();
    if (!txt) { el.focus(); return; }
    var note = { ts: new Date().getTime(), d: today(), a: noteAuthor, t: txt };
    el.value = "";
    if (useCloud && notesCol){
      notesCol.add(note); // 실시간 리스너가 화면을 갱신합니다
    } else {
      note.id = note.ts;
      state.notes.push(note); save(); renderNotes();
    }
  };

  // ── 탭 전환 ──
  var tabs = document.querySelectorAll(".tab");
  for (var i=0;i<tabs.length;i++){
    tabs[i].onclick = function(){
      var go = this.getAttribute("data-go");
      currentScreen = go;
      for (var j=0;j<tabs.length;j++) tabs[j].classList.toggle("active", tabs[j]===this);
      var screens = document.querySelectorAll(".screen");
      for (var k=0;k<screens.length;k++) screens[k].classList.toggle("active", screens[k].getAttribute("data-screen")===go);
      if (go==="dex") renderDex();
      if (go==="letters") renderLetters();
      window.scrollTo(0,0);
    }.bind(tabs[i]);
  }

  // ── 시작 ──
  var hint = document.getElementById("composeHint");
  if (useCloud){
    if (hint) hint.textContent = "두 분 모두에게 공유돼요";
    initCloud();
  } else {
    if (hint) hint.textContent = "이 기기에 저장돼요";
    for (var q=0;q<state.notes.length;q++){ if (state.notes[q].id == null) state.notes[q].id = state.notes[q].ts; }
  }

  function start(){ renderHome(); checkMilestones(); }
  var appEl = document.getElementById("app");
  function unlockApp(){ appEl.classList.remove("pre"); document.getElementById("gate").hidden = true; start(); }
  // 순수 JS SHA-256 (브라우저 crypto 기능에 의존하지 않음 — 앱 내 브라우저에서도 동작)
  function utf8Bytes(str){ return unescape(encodeURIComponent(str)); } // 각 문자가 UTF-8 바이트(0-255)
  function sha256Hex(ascii){
    function rr(x,n){ return (x>>>n)|(x<<(32-n)); }
    var maxWord = Math.pow(2,32), result = "", words = [], asciiBitLength = ascii.length*8;
    var hash = sha256Hex.h = sha256Hex.h || [], k = sha256Hex.k = sha256Hex.k || [];
    var pc = k.length, comp = {};
    for (var cand = 2; pc < 64; cand++){
      if (!comp[cand]){
        for (var i = 0; i < 313; i += cand){ comp[i] = cand; }
        hash[pc] = (Math.pow(cand,0.5)*maxWord)|0;
        k[pc++] = (Math.pow(cand,1/3)*maxWord)|0;
      }
    }
    ascii += "\x80";
    while (ascii.length % 64 - 56) ascii += "\x00";
    for (var i = 0; i < ascii.length; i++){
      var j = ascii.charCodeAt(i);
      if (j >> 8) return null;
      words[i>>2] |= j << ((3-i)%4)*8;
    }
    words[words.length] = (asciiBitLength/maxWord)|0;
    words[words.length] = asciiBitLength;
    for (var jj = 0; jj < words.length;){
      var w = words.slice(jj, jj += 16), oldHash = hash;
      hash = hash.slice(0,8);
      for (var i = 0; i < 64; i++){
        var w15 = w[i-15], w2 = w[i-2], a = hash[0], e = hash[4];
        var t1 = hash[7] + (rr(e,6)^rr(e,11)^rr(e,25)) + ((e&hash[5])^(~e&hash[6])) + k[i] +
          (w[i] = (i<16) ? w[i] : (w[i-16] + (rr(w15,7)^rr(w15,18)^(w15>>>3)) + w[i-7] + (rr(w2,17)^rr(w2,19)^(w2>>>10)))|0);
        var t2 = (rr(a,2)^rr(a,13)^rr(a,22)) + ((a&hash[1])^(a&hash[2])^(hash[1]&hash[2]));
        hash = [(t1+t2)|0].concat(hash);
        hash[4] = (hash[4]+t1)|0;
      }
      for (var i = 0; i < 8; i++){ hash[i] = (hash[i]+oldHash[i])|0; }
    }
    for (var i = 0; i < 8; i++){
      for (var j = 3; j+1; j--){
        var b = (hash[i]>>(j*8))&255;
        result += ((b<16)?0:"") + b.toString(16);
      }
    }
    return result;
  }
  function hashPassword(str){ return sha256Hex(utf8Bytes(str)); }

  if (C.gateHash && localStorage.getItem("purin-gate-ok") !== C.gateHash){
    document.getElementById("gate").hidden = false;
    var gi = document.getElementById("gateInput"),
        gb = document.getElementById("gateBtn"),
        ge = document.getElementById("gateErr");
    var tryGate = function(){
      var raw = gi.value, val = raw.trim();
      if (val.normalize) val = val.normalize("NFC");
      var h;
      try { h = hashPassword(val); }
      catch(err){ ge.textContent = "오류: " + err.message; return; }
      if (h === C.gateHash){ localStorage.setItem("purin-gate-ok", C.gateHash); unlockApp(); }
      else { ge.textContent = "암호가 달라요 (길이 " + val.length + " · " + (h ? h.slice(0,8) : "??") + ")"; gi.focus(); }
    };
    gb.onclick = tryGate;
    gi.addEventListener("keydown", function(e){ if (e.key === "Enter") tryGate(); });
    var gs = document.getElementById("gateShow");
    if (gs) gs.addEventListener("change", function(){ gi.type = gs.checked ? "text" : "password"; });
    gi.focus();
  } else {
    unlockApp();
  }
})();
