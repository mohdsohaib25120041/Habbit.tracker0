/* ============================================================
   GoalForce Advanced Features — Self-Injecting Module
   Adds: Missions, Comeback, Reality XP, Energy, Focus,
         Insights, Goals, Share, Challenges, Leaderboard,
         Templates, Weekly Review, Community
   HOW TO USE:
     1. Save this whole file as "advanced-features.js"
     2. In index.html, add this BEFORE </body>:
        <script src="advanced-features.js"></script>
     3. Done. Nothing else to edit.
   ============================================================ */
(function () {
'use strict';

/* ===================== CSS ===================== */
var CSS = '' +
'.adv-grid{display:grid;gap:16px}' +
'.adv-grid-2{grid-template-columns:1fr 1fr}' +
'@media(max-width:640px){.adv-grid-2{grid-template-columns:1fr}}' +
'.mission-header{display:flex;justify-content:space-between;font-size:12px;color:var(--text-muted);margin-bottom:10px}' +
'.mission-xp-total{color:var(--neon-yellow);font-weight:600}' +
'.mission-card{display:flex;align-items:center;gap:12px;padding:12px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);margin-bottom:8px}' +
'.mission-card.completed{opacity:0.55}' +
'.mission-icon{width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:rgba(255,204,0,0.12);color:var(--neon-yellow);font-size:18px;font-weight:700;flex-shrink:0}' +
'.mission-body{flex:1;min-width:0}' +
'.mission-title{font-weight:600;font-size:14px}' +
'.mission-desc{font-size:12px;color:var(--text-muted);margin-top:2px}' +
'.mission-xp{font-size:12px;font-weight:700;color:var(--neon-yellow)}' +
'.mission-claim{padding:6px 12px;font-size:12px}' +
'.energy-title{font-weight:600;font-size:15px;margin-bottom:4px}' +
'.energy-buttons{display:grid;grid-template-columns:repeat(5,1fr);gap:6px}' +
'.energy-btn{padding:8px 4px;border-radius:10px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);cursor:pointer;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all 0.2s}' +
'.energy-btn:hover{border-color:var(--neon-cyan)}' +
'.energy-btn.active{border-color:var(--neon-cyan);background:rgba(0,240,255,0.1);box-shadow:0 0 12px rgba(0,240,255,0.2)}' +
'.energy-icon{font-size:20px}' +
'.energy-label{font-size:9px;color:var(--text-muted);text-align:center}' +
'.energy-btn.active .energy-label{color:var(--neon-cyan)}' +
'.focus-presets{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}' +
'.focus-preset{padding:12px;border-radius:12px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);cursor:pointer;font-weight:600;font-size:14px;display:flex;flex-direction:column;align-items:center;gap:3px;transition:all 0.2s;color:var(--text-main)}' +
'.focus-preset:hover{border-color:var(--neon-cyan);background:rgba(0,240,255,0.08)}' +
'.focus-preset span{font-size:10px;color:var(--text-muted);font-weight:400}' +
'.focus-stats{margin-top:10px;font-size:12px;color:var(--text-muted);text-align:center}' +
'.focus-active{display:flex;flex-direction:column;align-items:center}' +
'.focus-timer{position:relative;display:flex;align-items:center;justify-content:center}' +
'.focus-time-text{position:absolute;font-size:32px;font-weight:700;color:var(--neon-cyan)}' +
'.template-grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(150px,1fr));gap:12px}' +
'.template-card{padding:14px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);text-align:center;display:flex;flex-direction:column;gap:6px}' +
'.template-icon{font-size:30px}' +
'.template-name{font-weight:600;font-size:14px}' +
'.template-desc{font-size:11px;color:var(--text-muted)}' +
'.template-habits{display:flex;flex-direction:column;gap:2px;font-size:10px;color:var(--text-muted);margin:6px 0;text-align:left}' +
'.template-habits span::before{content:"\\2022 ";color:var(--neon-cyan)}' +
'.challenge-card{display:flex;align-items:flex-start;gap:12px;padding:14px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);margin-bottom:10px}' +
'.challenge-emoji{font-size:30px;flex-shrink:0}' +
'.challenge-body{flex:1;min-width:0}' +
'.challenge-title{font-weight:600;font-size:15px}' +
'.challenge-desc{font-size:12px;color:var(--text-muted);margin-top:2px}' +
'.challenge-bar,.goal-bar{height:8px;border-radius:10px;background:rgba(var(--tint),0.1);overflow:hidden;margin-top:8px}' +
'.challenge-bar>div,.goal-bar>div{height:100%;background:linear-gradient(90deg,var(--neon-cyan),var(--neon-purple));border-radius:10px;transition:width 0.4s}' +
'.challenge-progress-text,.goal-progress-text{font-size:11px;color:var(--text-muted);margin-top:4px}' +
'.leaderboard-list{display:flex;flex-direction:column;gap:6px}' +
'.leaderboard-row{display:flex;align-items:center;gap:12px;padding:10px 12px;border-radius:12px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color)}' +
'.leaderboard-row.you{border-color:var(--neon-cyan);background:rgba(0,240,255,0.08)}' +
'.leaderboard-rank{width:28px;font-weight:700;font-size:16px;color:var(--text-muted);text-align:center;flex-shrink:0}' +
'.leaderboard-rank.rank-1{color:#ffd700}' +
'.leaderboard-rank.rank-2{color:#c0c0c0}' +
'.leaderboard-rank.rank-3{color:#cd7f32}' +
'.leaderboard-avatar{width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,var(--neon-purple),var(--neon-cyan));display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0}' +
'.leaderboard-info{flex:1;min-width:0}' +
'.leaderboard-name{font-weight:600;font-size:14px}' +
'.leaderboard-sub{font-size:11px;color:var(--text-muted)}' +
'.leaderboard-xp{font-weight:700;color:var(--neon-yellow);font-size:15px}' +
'.insight-card{display:flex;gap:12px;padding:12px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);margin-bottom:8px;align-items:flex-start}' +
'.insight-icon{font-size:24px;flex-shrink:0}' +
'.insight-title{font-weight:600;font-size:14px;margin-bottom:2px}' +
'.insight-text{font-size:12px;color:var(--text-muted)}' +
'.goal-card{display:flex;gap:12px;padding:14px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);margin-bottom:10px;align-items:center}' +
'.goal-title{font-weight:600;font-size:15px}' +
'.goal-desc{font-size:12px;color:var(--text-muted);margin-top:2px}' +
'.review-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:12px}' +
'.review-stat{padding:16px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);text-align:center}' +
'.review-label{font-size:12px;color:var(--text-muted);margin-bottom:6px}' +
'.review-value{font-size:28px;font-weight:700;color:var(--neon-cyan)}' +
'.review-sub{font-size:11px;color:var(--text-muted);margin-top:4px}' +
'.community-card{display:flex;gap:12px;padding:14px;border-radius:14px;background:rgba(var(--tint),0.03);border:1px solid var(--border-color);margin-bottom:10px}' +
'.community-avatar{width:44px;height:44px;border-radius:50%;background:linear-gradient(135deg,var(--neon-purple),var(--neon-cyan));display:flex;align-items:center;justify-content:center;font-weight:700;color:#fff;flex-shrink:0;font-size:18px}' +
'.community-body{flex:1;min-width:0}' +
'.community-name{font-weight:600;font-size:14px}' +
'.community-time{font-size:11px;color:var(--text-muted);margin-left:6px}' +
'.community-text{font-size:13px;margin-top:4px;line-height:1.4}' +
'.community-actions{display:flex;gap:14px;margin-top:8px;font-size:12px;color:var(--text-muted)}' +
'.community-actions span{cursor:pointer;display:flex;align-items:center;gap:4px}' +
'.community-actions span:hover{color:var(--neon-cyan)}' +
'.community-input{display:flex;gap:8px;margin-bottom:14px}' +
'.community-input input{flex:1;padding:10px 12px;border-radius:10px;background:rgba(var(--tint),0.05);border:1px solid var(--border-color);color:var(--text-main);font-family:var(--app-font);font-size:14px;outline:none}' +
'.community-input input:focus{border-color:var(--neon-cyan)}' +
'.community-empty{padding:20px;text-align:center;color:var(--text-muted);font-size:13px}';

/* ===================== INJECT CSS ===================== */
function injectCSS() {
    if (document.getElementById('advCSS')) return;
    var s = document.createElement('style');
    s.id = 'advCSS';
    s.textContent = CSS;
    document.head.appendChild(s);
}

/* ===================== SAFE HELPERS (do not crash if globals missing) ===================== */
function safe(fn, label) {
    try { return fn(); } catch (e) { console.warn('[advanced-features] ' + (label || '') + ':', e); return null; }
}
function G() { return (typeof window.appState !== 'undefined') ? window.appState : null; }
function today() { return (typeof getTodayStr === 'function') ? getTodayStr() : new Date().toISOString().slice(0,10); }
function esc(s) { return (typeof escapeHtml === 'function') ? escapeHtml(String(s || '')) : String(s || '').replace(/[&<>"']/g, function (c) { return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
function getHabits() { var a = G(); return (a && Array.isArray(a.habits)) ? a.habits : []; }
function getTodayHabits() {
    if (typeof schedHabits === 'function') return safe(function(){ return schedHabits(today()); }) || [];
    return getHabits().filter(function(h){ return !h.days || h.days.length === 0 || (h.days || []).indexOf(new Date().getDay()) >= 0; });
}
function getStreak() { return (typeof getCurrentStreak === 'function') ? (safe(getCurrentStreak) || 0) : 0; }
function getTotalDone() { return (typeof getTotalCompleted === 'function') ? (safe(getTotalCompleted) || 0) : 0; }
function getPerfect() { return (typeof getPerfectDays === 'function') ? (safe(getPerfectDays) || 0) : 0; }
function getLevelInfoSafe(xp) { return (typeof getLevelInfo === 'function') ? (safe(function(){ return getLevelInfo(xp); }) || {level:1,percent:0,end:1000}) : {level:1,percent:0,end:1000}; }
function getXP() { var a = G(); return a ? (Number(a.totalXp) || 0) : 0; }
function saveState() { safe(function(){ if (typeof saveData === 'function') saveData(); }, 'saveData'); }
function refreshUI() { safe(function(){ if (typeof updateUI === 'function') updateUI(); }, 'updateUI'); }
function toast(opts) { safe(function(){ if (typeof notify === 'function') notify(opts); else console.log(opts.title, opts.message); }, 'notify'); }
function addXP(amount) { var a = G(); if (!a) return; a.totalXp = (Number(a.totalXp) || 0) + amount; if (!a.realityXp) a.realityXp = { total: 0, log: [] }; a.realityXp.total += amount; }
function checkLevel() { safe(function(){ if (typeof checkLevelUp === 'function') checkLevelUp(); }, 'checkLevelUp'); }
function playSnd(name) { safe(function(){ if (typeof playSound === 'function') playSound(name); }, 'playSound'); }
function confetti(n) { safe(function(){ if (typeof spawnConfetti === 'function') spawnConfetti(n || 30); }, 'confetti'); }
function weekNames(i) { var W = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat']; return W[i] || ''; }
function dayOf(str) { var p = str.split('-').map(Number); return new Date(p[0], p[1]-1, p[2]).getDay(); }
function addDays(str, n) { var p = str.split('-').map(Number); var d = new Date(p[0], p[1]-1, p[2]+n); return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0'); }
function isRest(d) { return safe(function(){ return typeof isRestDay === 'function' && isRestDay(d); }) === true; }
function waterStat() { return safe(function(){ return typeof waterStats === 'function' ? waterStats() : { pct: 0, left: 2000 }; }) || { pct: 0, left: 2000 }; }
function fmt(ml) { return (ml || 0) + ' ml'; }

/* ===================== FEATURE 1: ADAPTIVE MISSIONS ===================== */
function generateMissions() {
    var a = G(); if (!a) return [];
    var t = today();
    if (a.missions && a.missions.date === t && Array.isArray(a.missions.list)) return a.missions.list;
    var list = [];
    var habits = getTodayHabits();
    var energy = (a.energy && a.energy[t]) || 3;

    var easiest = habits.filter(function (h) { return !h.completed; }).sort(function (x, y) { return (x.target || 1) - (y.target || 1); })[0];
    if (easiest) list.push({ id: 'm-easy-' + easiest.id, xp: 10, completed: false, title: 'Quick win: ' + easiest.name, description: 'Start with the easiest habit' });

    var streak = getStreak(), remaining = habits.filter(function (h) { return !h.completed; }).length;
    if (streak > 0 && remaining > 0) list.push({ id: 'm-streak-' + t, xp: 15, completed: false, title: 'Protect your ' + streak + '-day streak', description: 'Complete ' + Math.min(remaining, 3) + ' more habit' + (Math.min(remaining,3) === 1 ? '' : 's') });

    if (energy <= 2) list.push({ id: 'm-energy-' + t, xp: 5, completed: false, title: 'Low-energy mission', description: 'Just do 1 small habit today' });
    else if (energy >= 4) list.push({ id: 'm-energy-' + t, xp: 25, completed: false, title: 'High-energy power move', description: 'Complete all habits today' });

    var ws = waterStat();
    if (ws.pct < 100) list.push({ id: 'm-water-' + t, xp: 10, completed: false, title: 'Hydration mission', description: 'Drink ' + Math.min(500, ws.left) + ' ml more water' });

    var hasNote = Object.keys(a.journal || {}).length > 0;
    if (!hasNote) list.push({ id: 'm-note-' + t, xp: 5, completed: false, title: 'Write a quick note', description: 'How was your day?' });

    a.missions = { date: t, list: list };
    saveState();
    return list;
}

function renderMissions() {
    var box = document.getElementById('missionsBox'); if (!box) return;
    var list = generateMissions();
    if (!list.length) { box.innerHTML = '<div class="task-empty">No missions right now. Add some habits to get personalized missions!</div>'; return; }
    var done = list.filter(function (m) { return m.completed; }).length;
    var avail = list.filter(function (m) { return !m.completed; }).reduce(function (s, m) { return s + m.xp; }, 0);
    box.innerHTML = '<div class="mission-header"><span>' + done + '/' + list.length + ' done</span>' +
        '<span class="mission-xp-total">+' + avail + ' XP available</span></div>' +
        list.map(function (m) {
            return '<div class="mission-card ' + (m.completed ? 'completed' : '') + '">' +
                '<div class="mission-icon">' + (m.completed ? '✓' : '⚡') + '</div>' +
                '<div class="mission-body"><div class="mission-title">' + esc(m.title) + '</div>' +
                '<div class="mission-desc">' + esc(m.description) + '</div></div>' +
                '<div class="mission-xp">+' + m.xp + ' XP</div>' +
                (m.completed ? '' : '<button class="btn-primary mission-claim" onclick="__advClaimMission(\'' + m.id + '\')">Done</button>') +
            '</div>';
        }).join('');
}

window.__advClaimMission = function (id) {
    var a = G(); if (!a || !a.missions) return;
    var m = a.missions.list.find(function (x) { return x.id === id; });
    if (!m || m.completed) return;
    m.completed = true;
    addXP(m.xp);
    checkLevel(); saveState(); renderMissions(); refreshUI();
    toast({ type: 'xp', title: 'Mission complete!', message: '+' + m.xp + ' XP' });
};

/* ===================== FEATURE 2: COMEBACK MODE ===================== */
function checkComeback() {
    var a = G(); if (!a) return;
    if (!a.comeback) a.comeback = { active: false, missions: [], startedAt: null };
    var t = today(), missed = 0;
    for (var i = 1; i <= 7; i++) {
        var d = addDays(t, -i);
        if (isRest(d)) continue;
        var habits = getHabits();
        var sched = habits.filter(function (h) { return !h.days || h.days.length === 0 || h.days.indexOf(dayOf(d)) >= 0; });
        var done = sched.filter(function (h) { return h.history[d] === true; }).length;
        if (sched.length > 0 && done === 0) missed++;
    }
    var banner = document.getElementById('comebackBannerDash');
    if (!banner) return;
    if (missed >= 2 && !a.comeback.active) {
        banner.style.display = 'block';
        banner.innerHTML = '<div class="bd-banner warn" style="margin-bottom:16px;">' +
            '<div class="bd-banner-icon"><svg class="icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div>' +
            '<div style="flex:1;"><div class="bd-banner-title">Welcome back!</div>' +
            '<div class="bd-banner-text">You missed ' + missed + ' day' + (missed === 1 ? '' : 's') + '. Let\'s take it easy — start small.</div></div>' +
            '<button class="btn-primary" onclick="__advStartComeback()">Start Comeback</button></div>';
    } else {
        banner.style.display = 'none';
    }
}

window.__advStartComeback = function () {
    var a = G(); if (!a) return;
    if (!a.comeback) a.comeback = { active: false, missions: [], startedAt: null };
    a.comeback.active = true;
    a.comeback.startedAt = today();
    a.comeback.missions = [
        { id: 'cb-1', title: 'Tick just ONE habit today', xp: 10, completed: false },
        { id: 'cb-2', title: 'Write a 1-sentence note', xp: 5, completed: false },
        { id: 'cb-3', title: 'Drink 1 glass of water', xp: 5, completed: false }
    ];
    saveState(); renderComeback(); checkComeback();
    toast({ type: 'success', title: 'Comeback mode activated', message: 'Small steps, big changes.' });
};

window.__advCompleteComeback = function (id) {
    var a = G(); if (!a || !a.comeback) return;
    var m = a.comeback.missions.find(function (x) { return x.id === id; });
    if (!m || m.completed) return;
    m.completed = true;
    addXP(m.xp);
    checkLevel(); saveState(); renderComeback(); refreshUI();
    if (a.comeback.missions.every(function (x) { return x.completed; })) {
        setTimeout(function () {
            a.comeback.active = false;
            saveState(); renderComeback(); checkComeback();
            toast({ type: 'level', title: 'Welcome back!', message: 'Your normal routine is back on.', duration: 6000 });
        }, 800);
    }
};

function renderComeback() {
    var box = document.getElementById('comebackModeBox'); if (!box) return;
    var a = G();
    if (!a || !a.comeback || !a.comeback.active) { box.innerHTML = ''; box.style.display = 'none'; return; }
    box.style.display = 'block';
    box.innerHTML = '<div class="bd-banner good" style="margin-bottom:12px;">' +
        '<div class="bd-banner-icon"><svg class="icon" viewBox="0 0 24 24"><path d="M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z"/></svg></div>' +
        '<div style="flex:1;"><div class="bd-banner-title">Comeback Mode Active</div><div class="bd-banner-text">Just do these small things. No pressure.</div></div></div>' +
        a.comeback.missions.map(function (m) {
            return '<div class="mission-card ' + (m.completed ? 'completed' : '') + '">' +
                '<div class="mission-icon">' + (m.completed ? '✓' : '🌱') + '</div>' +
                '<div class="mission-body"><div class="mission-title">' + esc(m.title) + '</div></div>' +
                '<div class="mission-xp">+' + m.xp + ' XP</div>' +
                (m.completed ? '' : '<button class="btn-primary" onclick="__advCompleteComeback(\'' + m.id + '\')">Done</button>') +
            '</div>';
        }).join('');
}

/* ===================== FEATURE 3: ENERGY MODE ===================== */
window.__advSetEnergy = function (n) {
    var a = G(); if (!a) return;
    if (!a.energy) a.energy = {};
    a.energy[today()] = Math.max(1, Math.min(5, Math.floor(n)));
    saveState(); renderEnergy(); renderMissions(); refreshUI();
};

function renderEnergy() {
    var box = document.getElementById('energyModeBox'); if (!box) return;
    var a = G(); if (!a) return;
    var energy = (a.energy && a.energy[today()]) || 3;
    var icons = ['😴', '😐', '🙂', '😊', '🔥'];
    var labels = ['Exhausted', 'Low', 'Okay', 'Good', 'Energized'];
    var html = '<div class="energy-title">How\'s your energy today?</div>' +
        '<div class="setting-desc" style="margin-bottom:10px;">Missions adapt to you.</div>' +
        '<div class="energy-buttons">';
    for (var n = 1; n <= 5; n++) {
        html += '<button class="energy-btn ' + (energy === n ? 'active' : '') + '" onclick="__advSetEnergy(' + n + ')">' +
            '<span class="energy-icon">' + icons[n-1] + '</span>' +
            '<span class="energy-label">' + labels[n-1] + '</span></button>';
    }
    html += '</div>';
    box.innerHTML = html;
}

/* ===================== FEATURE 4: FOCUS MODE ===================== */
var focusTimer = null, focusState = { active: false, secondsLeft: 0, total: 0, distractions: [] };

window.__advStartFocus = function (minutes) {
    if (focusState.active) return;
    focusState = { active: true, secondsLeft: minutes * 60, total: minutes * 60, distractions: [] };
    renderFocus();
    focusTimer = setInterval(tickFocus, 1000);
    toast({ type: 'info', title: 'Focus started', message: minutes + ' min deep work' });
};
function tickFocus() {
    if (!focusState.active) return;
    focusState.secondsLeft--;
    if (focusState.secondsLeft <= 0) completeFocus();
    else renderFocus();
}
function completeFocus() {
    if (!focusState.active) return;
    clearInterval(focusTimer); focusTimer = null;
    var mins = Math.round(focusState.total / 60), xp = mins * 2;
    var a = G(); if (a) {
        if (!a.focus) a.focus = [];
        a.focus.push({ id: 'focus-' + Date.now(), date: today(), minutes: mins, distractions: focusState.distractions.slice() });
        addXP(xp); checkLevel(); saveState();
    }
    focusState.active = false;
    renderFocus(); refreshUI();
    playSnd('complete'); confetti(30);
    toast({ type: 'level', title: 'Focus complete!', message: mins + ' min, +' + xp + ' XP', duration: 5000 });
}
window.__advStopFocus = function () {
    if (!focusState.active) return;
    if (!confirm('End focus session early?')) return;
    clearInterval(focusTimer); focusTimer = null;
    var elapsed = Math.round((focusState.total - focusState.secondsLeft) / 60);
    if (elapsed > 0) {
        var a = G(); if (a) {
            if (!a.focus) a.focus = [];
            a.focus.push({ id: 'focus-' + Date.now(), date: today(), minutes: elapsed, distractions: focusState.distractions.slice() });
            addXP(Math.floor(elapsed * 2 * 0.5)); checkLevel(); saveState();
        }
    }
    focusState.active = false;
    renderFocus(); refreshUI();
};
window.__advLogDistraction = function () {
    if (!focusState.active) return;
    focusState.distractions.push({ at: Math.round((focusState.total - focusState.secondsLeft) / 60) });
    toast({ type: 'info', title: 'Distraction logged', message: 'Stay focused.', duration: 3000 });
};

function renderFocus() {
    var box = document.getElementById('focusModeBox'); if (!box) return;
    if (!focusState.active) {
        var a = G();
        var sessions = (a && a.focus || []).filter(function (s) { return s.date === today(); });
        var mins = sessions.reduce(function (s, x) { return s + (x.minutes || 0); }, 0);
        box.innerHTML = '<div class="energy-title">Focus Mode</div>' +
            '<div class="setting-desc" style="margin-bottom:12px;">Deep work. 2 XP per minute.</div>' +
            '<div class="focus-presets">' +
                '<button class="focus-preset" onclick="__advStartFocus(25)">25 min<span>Standard</span></button>' +
                '<button class="focus-preset" onclick="__advStartFocus(50)">50 min<span>Deep</span></button>' +
                '<button class="focus-preset" onclick="__advStartFocus(15)">15 min<span>Quick</span></button>' +
                '<button class="focus-preset" onclick="__advStartFocus(90)">90 min<span>Flow</span></button>' +
            '</div>' +
            (sessions.length ? '<div class="focus-stats">Today: ' + sessions.length + ' session' + (sessions.length === 1 ? '' : 's') + ', ' + mins + ' min</div>' : '');
        return;
    }
    var m = Math.floor(focusState.secondsLeft / 60), s = focusState.secondsLeft % 60;
    var pct = 1 - (focusState.secondsLeft / focusState.total);
    var C = 2 * Math.PI * 90;
    box.innerHTML = '<div class="focus-active">' +
        '<div class="focus-timer">' +
        '<svg viewBox="0 0 200 200" style="width:160px;height:160px;">' +
        '<circle cx="100" cy="100" r="90" fill="none" stroke="rgba(255,255,255,0.1)" stroke-width="8"/>' +
        '<circle cx="100" cy="100" r="90" fill="none" stroke="var(--neon-cyan)" stroke-width="8" stroke-linecap="round" stroke-dasharray="' + C + '" stroke-dashoffset="' + (C * (1 - pct)) + '" transform="rotate(-90 100 100)"/>' +
        '</svg><div class="focus-time-text">' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0') + '</div></div>' +
        '<div style="display:flex;gap:8px;justify-content:center;margin-top:12px;">' +
        '<button class="btn-primary" onclick="__advLogDistraction()">Log distraction</button>' +
        '<button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="__advStopFocus()">Stop</button>' +
        '</div></div>';
}

/* ===================== FEATURE 5: HABIT TEMPLATES ===================== */
var TEMPLATES = {
    morning: { name: 'Morning Routine', icon: '☀️', habits: [
        { name: 'Wake up at 6 AM', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Drink water', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Make bed', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Meditate 5 min', target: 1, days: [1,2,3,4,5,6,0] }
    ]},
    fitness: { name: 'Fitness Starter', icon: '💪', habits: [
        { name: 'Workout 30 min', target: 1, days: [1,3,5] },
        { name: '10,000 steps', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Eat protein', target: 3, days: [1,2,3,4,5,6,0] },
        { name: '8 hours sleep', target: 1, days: [1,2,3,4,5,6,0] }
    ]},
    study: { name: 'Study & Learn', icon: '📚', habits: [
        { name: 'Read 10 pages', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Study 1 hour', target: 1, days: [1,2,3,4,5] },
        { name: 'Review notes', target: 1, days: [1,2,3,4,5] }
    ]},
    mindfulness: { name: 'Mindfulness', icon: '🧘', habits: [
        { name: 'Meditate 10 min', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Gratitude journal', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'Deep breathing', target: 2, days: [1,2,3,4,5,6,0] }
    ]},
    productivity: { name: 'Productivity Pro', icon: '🚀', habits: [
        { name: 'Plan the day', target: 1, days: [1,2,3,4,5] },
        { name: 'Deep work 2 hours', target: 1, days: [1,2,3,4,5] },
        { name: 'Review goals', target: 1, days: [0] }
    ]},
    wellness: { name: 'Health & Wellness', icon: '🌿', habits: [
        { name: 'Drink 2L water', target: 8, days: [1,2,3,4,5,6,0] },
        { name: 'Walk 30 min', target: 1, days: [1,2,3,4,5,6,0] },
        { name: 'No junk food', target: 1, days: [1,2,3,4,5,6,0] }
    ]}
};

window.__advOpenTemplates = function () {
    if (typeof openModal !== 'function') return;
    openModal('<h2 style="margin-bottom:14px;">Habit Templates</h2>' +
        '<div class="setting-desc" style="margin-bottom:14px;">Pick a pack — adds multiple habits at once.</div>' +
        '<div id="tplBox"></div>' +
        '<button class="btn-primary" style="width:100%;margin-top:14px;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="if(typeof closeModal===\'function\')closeModal()">Close</button>');
    renderTemplates();
};

function renderTemplates() {
    var box = document.getElementById('tplBox'); if (!box) return;
    box.innerHTML = '<div class="template-grid">' +
        Object.keys(TEMPLATES).map(function (id) {
            var t = TEMPLATES[id];
            return '<div class="template-card">' +
                '<div class="template-icon">' + t.icon + '</div>' +
                '<div class="template-name">' + t.name + '</div>' +
                '<div class="template-desc">' + t.habits.length + ' habits</div>' +
                '<div class="template-habits">' + t.habits.slice(0, 3).map(function (h) { return '<span>' + esc(h.name) + '</span>'; }).join('') + '</div>' +
                '<button class="btn-primary" onclick="__advApplyTemplate(\'' + id + '\')">Add</button></div>';
        }).join('') + '</div>';
}

window.__advApplyTemplate = function (id) {
    var t = TEMPLATES[id]; if (!t) return;
    var a = G(); if (!a) return;
    if (!Array.isArray(a.habits)) a.habits = [];
    var added = 0;
    t.habits.forEach(function (h) {
        if (a.habits.some(function (x) { return x.name.toLowerCase() === h.name.toLowerCase(); })) return;
        a.habits.push({
            id: Date.now().toString(36) + Math.random().toString(36).slice(2, 5),
            name: h.name, xp: 5, completed: false, history: {},
            days: h.days || [], target: h.target || 1, color: '', counts: {}
        });
        added++;
    });
    saveState();
    if (typeof renderHabits === 'function') safe(renderHabits);
    if (typeof renderCalendar === 'function') safe(renderCalendar);
    refreshUI();
    renderTemplates();
    toast({ type: 'success', title: 'Template applied!', message: 'Added ' + added + ' habit' + (added === 1 ? '' : 's') });
};

/* ===================== FEATURE 6: SHARE PROGRESS CARD ===================== */
function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

function buildShareCanvas() {
    var lv = getLevelInfoSafe(getXP());
    var streak = getStreak(), totalDone = getTotalDone();
    var th = getTodayHabits(), td = th.filter(function (h) { return h.completed; }).length;
    var perfect = getPerfect();
    var a = G();
    var badges = Object.keys((a && a.badges) || {}).length;

    var c = document.createElement('canvas');
    c.width = 1080; c.height = 1920;
    var ctx = c.getContext('2d');
    var g = ctx.createLinearGradient(0, 0, 1080, 1920);
    g.addColorStop(0, '#0a0e1a'); g.addColorStop(0.5, '#1a0e2e'); g.addColorStop(1, '#0a1a2e');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 1080, 1920);
    ctx.fillStyle = 'rgba(0,240,255,0.08)';
    for (var x = 40; x < 1080; x += 60) for (var y = 40; y < 1920; y += 60) {
        ctx.beginPath(); ctx.arc(x, y, 2, 0, Math.PI * 2); ctx.fill();
    }
    ctx.fillStyle = '#00f0ff'; ctx.font = 'bold 90px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('GoalForce', 540, 200);
    ctx.fillStyle = 'rgba(255,255,255,0.6)'; ctx.font = '40px system-ui,sans-serif';
    ctx.fillText('My Progress Today', 540, 270);
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '32px system-ui,sans-serif';
    ctx.fillText(new Date().toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric',year:'numeric'}), 540, 340);

    var stats = [
        { l: 'LEVEL', v: lv.level, c: '#00f0ff' },
        { l: 'STREAK', v: streak + ' days', c: '#00ff88' },
        { l: 'TOTAL XP', v: getXP(), c: '#ffcc00' },
        { l: 'HABITS DONE', v: totalDone, c: '#b026ff' },
        { l: 'TODAY', v: td + '/' + th.length, c: '#00f0ff' },
        { l: 'PERFECT DAYS', v: perfect, c: '#00ff88' }
    ];
    var sy = 480, cw = 460, ch = 190, gap = 40;
    stats.forEach(function (s, i) {
        var col = i % 2, row = Math.floor(i / 2);
        var sx = 100 + col * (cw + gap), y = sy + row * (ch + gap);
        ctx.fillStyle = 'rgba(255,255,255,0.05)'; roundRect(ctx, sx, y, cw, ch, 24); ctx.fill();
        ctx.strokeStyle = s.c + '44'; ctx.lineWidth = 2; roundRect(ctx, sx, y, cw, ch, 24); ctx.stroke();
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = 'bold 28px system-ui,sans-serif'; ctx.textAlign = 'left';
        ctx.fillText(s.l, sx + 40, y + 65);
        ctx.fillStyle = s.c; ctx.font = 'bold 68px system-ui,sans-serif';
        ctx.fillText(String(s.v), sx + 40, y + 150);
    });
    ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '36px system-ui,sans-serif'; ctx.textAlign = 'center';
    ctx.fillText('🏆 ' + badges + ' Badges Unlocked', 540, sy + 3 * (ch + gap) + 60);
    ctx.fillStyle = 'rgba(255,255,255,0.4)'; ctx.font = '32px system-ui,sans-serif';
    ctx.fillText('Small steps... Big changes!', 540, 1750);
    ctx.fillStyle = 'rgba(0,240,255,0.6)'; ctx.font = 'bold 28px system-ui,sans-serif';
    ctx.fillText('GoalForce Habit Tracker', 540, 1810);
    return c;
}

window.__advShare = function () {
    var canvas = buildShareCanvas();
    canvas.toBlob(function (blob) {
        var file = new File([blob], 'goalforce-progress.png', { type: 'image/png' });
        if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
            navigator.share({ files: [file], title: 'My GoalForce Progress', text: 'Check out my habits!' })
                .then(function () { toast({ type: 'success', title: 'Shared!' }); })
                .catch(function (e) { if (e.name !== 'AbortError') downloadCanvas(canvas); });
        } else {
            downloadCanvas(canvas);
        }
    });
};
function downloadCanvas(canvas) {
    var a = document.createElement('a');
    a.download = 'goalforce-' + today() + '.png';
    a.href = canvas.toDataURL('image/png');
    a.click();
    toast({ type: 'success', title: 'Downloaded!', message: 'Share with friends.' });
}

/* ===================== FEATURE 7: CHALLENGES ===================== */
window.__advOpenChallenge = function () {
    if (typeof openModal !== 'function') return;
    openModal('<h2>New Challenge</h2>' +
        '<div class="input-group"><label>Title</label><input type="text" id="chT" maxlength="60" placeholder="e.g. 7-Day Reading"></div>' +
        '<div class="input-group"><label>Description (optional)</label><input type="text" id="chD" maxlength="120"></div>' +
        '<div class="input-group"><label>How many days?</label><input type="number" id="chN" min="1" max="365" value="7"></div>' +
        '<div class="input-group"><label>Emoji</label><input type="text" id="chE" maxlength="2" value="🎯"></div>' +
        '<div style="display:flex;gap:10px;margin-top:20px;">' +
        '<button class="btn-primary" style="flex:1;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="if(typeof closeModal===\'function\')closeModal()">Cancel</button>' +
        '<button class="btn-primary" style="flex:2;" onclick="__advCreateChallenge()">Create</button></div>');
};

window.__advCreateChallenge = function () {
    var title = document.getElementById('chT').value.trim();
    if (!title) return toast({ type: 'error', title: 'Enter a title' });
    var a = G(); if (!a) return;
    if (!a.challenges) a.challenges = [];
    a.challenges.push({
        id: 'ch-' + Date.now(), title: title,
        description: document.getElementById('chD').value.trim(),
        target: parseInt(document.getElementById('chN').value, 10) || 7,
        emoji: document.getElementById('chE').value || '🎯',
        progress: 0, active: true, createdAt: today()
    });
    saveState();
    if (typeof closeModal === 'function') closeModal();
    renderChallenges();
    toast({ type: 'success', title: 'Challenge created!' });
};

window.__advProgressChallenge = function (i) {
    var a = G(); if (!a || !a.challenges) return;
    var active = a.challenges.filter(function (c) { return c.active; });
    var c = active[i]; if (!c) return;
    c.progress = (c.progress || 0) + 1;
    addXP(5); checkLevel();
    if (c.progress >= c.target) {
        c.active = false; c.completedAt = today();
        addXP(50);
        confetti(50); playSnd('fanfare');
        toast({ type: 'level', title: 'Challenge complete!', message: '+50 XP - ' + c.title, duration: 6000 });
    }
    saveState(); renderChallenges(); refreshUI();
};

window.__advDeleteChallenge = function (i) {
    var a = G(); if (!a || !a.challenges) return;
    var active = a.challenges.filter(function (c) { return c.active; });
    var c = active[i]; if (!c) return;
    if (typeof confirmDo === 'function') {
        confirmDo('Cancel this challenge?', function () { c.active = false; saveState(); renderChallenges(); }, 'Cancel');
    } else { c.active = false; saveState(); renderChallenges(); }
};

function renderChallenges() {
    var box = document.getElementById('challengesBox'); if (!box) return;
    var a = G(); if (!a) return;
    if (!a.challenges) a.challenges = [];
    var active = a.challenges.filter(function (c) { return c.active; });
    var past = a.challenges.filter(function (c) { return !c.active; });
    box.innerHTML = '<div style="margin-bottom:14px;"><button class="btn-primary" onclick="__advOpenChallenge()">+ New Challenge</button></div>' +
        (active.length ? '<h3 style="margin:18px 0 10px;">Active</h3>' + active.map(function (c, i) { return renderChallenge(c, i, true); }).join('') : '<div class="task-empty">No active challenges. Create one!</div>') +
        (past.length ? '<h3 style="margin:18px 0 10px;">Completed</h3>' + past.map(function (c, i) { return renderChallenge(c, i, false); }).join('') : '');
}
function renderChallenge(c, i, active) {
    var pct = Math.min(100, Math.round(((c.progress || 0) / (c.target || 7)) * 100));
    return '<div class="challenge-card">' +
        '<div class="challenge-emoji">' + (c.emoji || '🎯') + '</div>' +
        '<div class="challenge-body">' +
        '<div class="challenge-title">' + esc(c.title) + '</div>' +
        (c.description ? '<div class="challenge-desc">' + esc(c.description) + '</div>' : '') +
        '<div class="challenge-bar"><div style="width:' + pct + '%;"></div></div>' +
        '<div class="challenge-progress-text">' + (c.progress || 0) + '/' + c.target + ' • ' + pct + '%</div>' +
        (active ? '<div style="display:flex;gap:8px;margin-top:8px;">' +
            '<button class="btn-primary" onclick="__advProgressChallenge(' + i + ')">+1 Progress</button>' +
            '<button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="__advDeleteChallenge(' + i + ')">Cancel</button></div>' : '') +
        '</div></div>';
}

/* ===================== FEATURE 8: LEADERBOARD ===================== */
var DEMO_LB = [
    { name: 'Alex M.', xp: 4750, streak: 45, level: 12 },
    { name: 'Sam K.', xp: 3200, streak: 28, level: 9 },
    { name: 'Jordan P.', xp: 2800, streak: 21, level: 8 },
    { name: 'Casey L.', xp: 1900, streak: 14, level: 6 },
    { name: 'Riley T.', xp: 1500, streak: 10, level: 5 },
    { name: 'Morgan S.', xp: 900, streak: 7, level: 4 },
    { name: 'Taylor R.', xp: 600, streak: 4, level: 3 }
];

function renderLeaderboard() {
    var box = document.getElementById('leaderboardBox'); if (!box) return;
    var user = (typeof getActiveAuthUser === 'function') ? safe(getActiveAuthUser) : null;
    var name = user ? (user.name || (user.email || '').split('@')[0]) : 'You';
    var lv = getLevelInfoSafe(getXP());
    var rows = DEMO_LB.concat([{
        name: name + ' (You)', xp: getXP(), streak: getStreak(), level: lv.level, you: true
    }]).sort(function (a, b) { return b.xp - a.xp; });
    box.innerHTML = '<div class="setting-desc" style="margin-bottom:12px;padding:10px;background:rgba(var(--tint),0.04);border-radius:10px;">' +
        '<b>Demo Leaderboard:</b> Real leaderboards need a backend. Sample users shown here so you can preview the UI.</div>' +
        '<div class="leaderboard-list">' + rows.map(function (e, i) {
            return '<div class="leaderboard-row ' + (e.you ? 'you' : '') + '">' +
                '<div class="leaderboard-rank rank-' + (i + 1) + '">' + (i + 1) + '</div>' +
                '<div class="leaderboard-avatar">' + (e.name || '?').charAt(0) + '</div>' +
                '<div class="leaderboard-info"><div class="leaderboard-name">' + esc(e.name) + '</div>' +
                '<div class="leaderboard-sub">Level ' + e.level + ' • ' + e.streak + 'd streak</div></div>' +
                '<div class="leaderboard-xp">' + e.xp.toLocaleString('en-US') + '</div></div>';
        }).join('') + '</div>';
}

/* ===================== FEATURE 9: PERSONAL INSIGHTS ===================== */
function renderInsights() {
    var box = document.getElementById('insightsBox'); if (!box) return;
    var habits = getHabits();
    if (!habits.length) { box.innerHTML = '<div class="task-empty">Add habits to see insights.</div>'; return; }
    var out = [];

    var dayStats = [0,0,0,0,0,0,0];
    habits.forEach(function (h) {
        Object.keys(h.history || {}).forEach(function (d) {
            if (h.history[d] === true) dayStats[dayOf(d)]++;
        });
    });
    var best = dayStats.map(function (v, i) { return [i, v]; }).sort(function (a, b) { return b[1] - a[1]; })[0];
    if (best && best[1] > 0) out.push({ i: '📅', t: 'Best day: ' + weekNames(best[0]), d: 'You complete most habits on ' + weekNames(best[0]) + 's.' });

    var counts = habits.map(function (h) { return { h: h, n: Object.keys(h.history || {}).filter(function (k) { return h.history[k] === true; }).length }; }).sort(function (a, b) { return b.n - a.n; });
    if (counts[0] && counts[0].n > 0) out.push({ i: '🏆', t: 'Most consistent: ' + counts[0].h.name, d: 'Done ' + counts[0].n + ' times.' });
    if (counts.length > 1) {
        var w = counts[counts.length - 1];
        if (w.n < 5) out.push({ i: '💡', t: 'Needs attention: ' + w.h.name, d: 'Only ' + w.n + ' completions. Make it easier?' });
    }
    if (getStreak() >= 7) out.push({ i: '🔥', t: getStreak() + '-day streak!', d: 'Amazing consistency.' });
    var a = G();
    var fs = (a && a.focus || []).length;
    if (fs > 0) {
        var mins = (a.focus || []).reduce(function (s, x) { return s + (x.minutes || 0); }, 0);
        out.push({ i: '🎯', t: fs + ' focus session' + (fs === 1 ? '' : 's'), d: mins + ' min total.' });
    }
    var energyKeys = Object.keys((a && a.energy) || {}).filter(function (d) { return d.slice(0, 10) >= addDays(today(), -30); });
    if (energyKeys.length >= 3) {
        var avg = energyKeys.reduce(function (s, k) { return s + a.energy[k]; }, 0) / energyKeys.length;
        out.push({ i: '⚡', t: 'Average energy', d: avg.toFixed(1) + '/5 over ' + energyKeys.length + ' days.' });
    }
    box.innerHTML = out.length ? out.map(function (o) {
        return '<div class="insight-card"><div class="insight-icon">' + o.i + '</div>' +
            '<div><div class="insight-title">' + esc(o.t) + '</div>' +
            '<div class="insight-text">' + esc(o.d) + '</div></div></div>';
    }).join('') : '<div class="task-empty">Use the app for a few days to see insights.</div>';
}

/* ===================== FEATURE 10: GOALS ===================== */
window.__advOpenGoal = function () {
    if (typeof openModal !== 'function') return;
    openModal('<h2>New Goal</h2>' +
        '<div class="input-group"><label>Title</label><input type="text" id="goT" maxlength="80" placeholder="e.g. Read 12 books"></div>' +
        '<div class="input-group"><label>Description (optional)</label><input type="text" id="goD" maxlength="160"></div>' +
        '<div class="input-group"><label>Target</label><input type="number" id="goN" min="1" value="10"></div>' +
        '<div class="input-group"><label>Deadline (optional)</label><input type="date" id="goDate"></div>' +
        '<div style="display:flex;gap:10px;margin-top:20px;">' +
        '<button class="btn-primary" style="flex:1;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="if(typeof closeModal===\'function\')closeModal()">Cancel</button>' +
        '<button class="btn-primary" style="flex:2;" onclick="__advCreateGoal()">Create</button></div>');
};

window.__advCreateGoal = function () {
    var title = document.getElementById('goT').value.trim();
    if (!title) return toast({ type: 'error', title: 'Enter a title' });
    var a = G(); if (!a) return;
    if (!a.goals) a.goals = [];
    a.goals.push({
        id: 'goal-' + Date.now(), title: title,
        description: document.getElementById('goD').value.trim(),
        target: parseInt(document.getElementById('goN').value, 10) || 10,
        progress: 0, due: document.getElementById('goDate').value || null,
        createdAt: today(), completed: false
    });
    saveState();
    if (typeof closeModal === 'function') closeModal();
    renderGoals();
    toast({ type: 'success', title: 'Goal created!' });
};

window.__advProgressGoal = function (id) {
    var a = G(); if (!a || !a.goals) return;
    var g = a.goals.find(function (x) { return x.id === id; }); if (!g) return;
    g.progress = (g.progress || 0) + 1;
    addXP(5); checkLevel();
    if (g.progress >= g.target && !g.completed) {
        g.completed = true;
        addXP(100);
        confetti(60); playSnd('fanfare');
        toast({ type: 'level', title: 'Goal achieved!', message: '+100 XP - ' + g.title, duration: 6000 });
    }
    saveState(); renderGoals(); refreshUI();
};

window.__advDeleteGoal = function (id) {
    if (typeof confirmDo === 'function') {
        confirmDo('Delete this goal?', function () {
            var a = G(); if (!a) return;
            a.goals = (a.goals || []).filter(function (g) { return g.id !== id; });
            saveState(); renderGoals();
        }, 'Delete');
    }
};

function renderGoals() {
    var box = document.getElementById('goalsBox'); if (!box) return;
    var a = G(); if (!a) return;
    if (!a.goals) a.goals = [];
    var active = a.goals.filter(function (g) { return !g.completed; });
    var done = a.goals.filter(function (g) { return g.completed; });
    box.innerHTML = '<div style="margin-bottom:14px;"><button class="btn-primary" onclick="__advOpenGoal()">+ New Goal</button></div>' +
        (active.length ? active.map(function (g) { return renderGoal(g, true); }).join('') : '<div class="task-empty">No active goals. Set one!</div>') +
        (done.length ? '<h3 style="margin:18px 0 10px;">Completed</h3>' + done.map(function (g) { return renderGoal(g, false); }).join('') : '');
}
function renderGoal(g, active) {
    var pct = g.target ? Math.min(100, Math.round((g.progress / g.target) * 100)) : 0;
    return '<div class="goal-card"><div style="flex:1;">' +
        '<div class="goal-title">' + esc(g.title) + '</div>' +
        (g.description ? '<div class="goal-desc">' + esc(g.description) + '</div>' : '') +
        '<div class="goal-bar"><div style="width:' + pct + '%;"></div></div>' +
        '<div class="goal-progress-text">' + (g.progress || 0) + '/' + g.target + ' • ' + pct + '%' +
        (g.due ? ' • Due ' + g.due : '') + '</div></div>' +
        (active ? '<div style="display:flex;gap:6px;flex-direction:column;">' +
            '<button class="btn-primary" onclick="__advProgressGoal(\'' + g.id + '\')">+1</button>' +
            '<button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="__advDeleteGoal(\'' + g.id + '\')">✕</button></div>' : '') +
        '</div>';
}

/* ===================== FEATURE 11: WEEKLY REVIEW ===================== */
function renderWeekly() {
    var box = document.getElementById('weeklyReviewBox'); if (!box) return;
    var t = today(), done = 0, possible = 0;
    for (var i = 6; i >= 0; i--) {
        var d = addDays(t, -i);
        if (isRest(d)) continue;
        var habits = getHabits();
        var sched = habits.filter(function (h) { return !h.days || h.days.length === 0 || h.days.indexOf(dayOf(d)) >= 0; });
        possible += sched.length;
        done += sched.filter(function (h) { return h.history[d] === true; }).length;
    }
    var pct = possible ? Math.round((done / possible) * 100) : 0;
    var a = G();
    var badges = Object.keys((a && a.badges) || {}).length;
    box.innerHTML = '<div class="review-grid">' +
        '<div class="review-stat"><div class="review-label">Week completion</div><div class="review-value">' + pct + '%</div><div class="review-sub">' + done + '/' + possible + ' habits</div></div>' +
        '<div class="review-stat"><div class="review-label">Streak</div><div class="review-value">' + getStreak() + '</div><div class="review-sub">days in a row</div></div>' +
        '<div class="review-stat"><div class="review-label">Total XP</div><div class="review-value">' + getXP().toLocaleString('en-US') + '</div><div class="review-sub">all time</div></div>' +
        '<div class="review-stat"><div class="review-label">Badges</div><div class="review-value">' + badges + '</div><div class="review-sub">unlocked</div></div>' +
        '</div>';
}

/* ===================== FEATURE 12: COMMUNITY (local) ===================== */
window.__advAddCommunityPost = function () {
    var inp = document.getElementById('commInput'); if (!inp) return;
    var txt = inp.value.trim(); if (!txt) return;
    var a = G(); if (!a) return;
    if (!a.community) a.community = [];
    var user = (typeof getActiveAuthUser === 'function') ? safe(getActiveAuthUser) : null;
    var name = user ? (user.name || (user.email || '').split('@')[0]) : 'You';
    a.community.unshift({ id: 'post-' + Date.now(), name: name, text: txt, at: new Date().toISOString(), likes: 0, liked: false });
    a.community = a.community.slice(0, 50);
    inp.value = '';
    saveState(); renderCommunity();
    toast({ type: 'success', title: 'Posted!' });
};
window.__advLikePost = function (id) {
    var a = G(); if (!a || !a.community) return;
    var p = a.community.find(function (x) { return x.id === id; }); if (!p) return;
    if (p.liked) { p.likes = Math.max(0, (p.likes || 0) - 1); p.liked = false; }
    else { p.likes = (p.likes || 0) + 1; p.liked = true; }
    saveState(); renderCommunity();
};
window.__advDeletePost = function (id) {
    var a = G(); if (!a) return;
    a.community = (a.community || []).filter(function (p) { return p.id !== id; });
    saveState(); renderCommunity();
};
function renderCommunity() {
    var box = document.getElementById('communityBox'); if (!box) return;
    var a = G(); if (!a) return;
    if (!a.community) a.community = [];
    box.innerHTML =
        '<div class="community-input">' +
            '<input id="commInput" placeholder="Share a win, tip or motivation..." maxlength="280" onkeydown="if(event.key===\'Enter\')__advAddCommunityPost()">' +
            '<button class="btn-primary" onclick="__advAddCommunityPost()">Post</button>' +
        '</div>' +
        (a.community.length ? a.community.map(function (p) {
            var mins = Math.round((Date.now() - new Date(p.at).getTime()) / 60000);
            var ago = mins < 60 ? mins + 'm' : (mins < 1440 ? Math.round(mins/60) + 'h' : Math.round(mins/1440) + 'd');
            return '<div class="community-card">' +
                '<div class="community-avatar">' + (p.name || '?').charAt(0).toUpperCase() + '</div>' +
                '<div class="community-body">' +
                    '<div><span class="community-name">' + esc(p.name) + '</span><span class="community-time">' + ago + '</span></div>' +
                    '<div class="community-text">' + esc(p.text) + '</div>' +
                    '<div class="community-actions">' +
                        '<span onclick="__advLikePost(\'' + p.id + '\')">' + (p.liked ? '❤️' : '🤍') + ' ' + (p.likes || 0) + '</span>' +
                        '<span onclick="__advDeletePost(\'' + p.id + '\')" style="color:var(--neon-red);">Delete</span>' +
                    '</div>' +
                '</div>' +
            '</div>';
        }).join('') : '<div class="community-empty">No posts yet. Be the first to share something!</div>');
}

/* ===================== INJECT HTML SECTIONS ===================== */
function injectHTML() {
    injectCSS();

    /* Sidebar nav */
    var navLinks = document.querySelector('.sidebar .nav-links');
    if (navLinks && !document.getElementById('advNavGrow')) {
        var g = document.createElement('a');
        g.href = '#'; g.className = 'nav-item'; g.id = 'advNavGrow';
        g.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>Grow';
        g.onclick = function (e) { e.preventDefault(); if (typeof changePage === 'function') changePage('grow', g); return false; };
        navLinks.appendChild(g);

        var s = document.createElement('a');
        s.href = '#'; s.className = 'nav-item'; s.id = 'advNavSocial';
        s.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-4-4h-1"/></svg>Social';
        s.onclick = function (e) { e.preventDefault(); if (typeof changePage === 'function') changePage('social', s); return false; };
        navLinks.appendChild(s);
    }

    /* Mobile "More" sheet */
    var moreSheet = document.getElementById('moreSheet');
    if (moreSheet && !document.getElementById('advMoreGrow')) {
        var logoutItem = moreSheet.querySelector('.more-item[style*="neon-red"]');
        var mg = document.createElement('div');
        mg.className = 'more-item'; mg.id = 'advMoreGrow';
        mg.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>Grow';
        mg.onclick = function () { if (typeof closeMore === 'function') closeMore(); if (typeof changePage === 'function') changePage('grow', null); };
        var ms = document.createElement('div');
        ms.className = 'more-item'; ms.id = 'advMoreSocial';
        ms.innerHTML = '<svg class="icon" viewBox="0 0 24 24"><circle cx="9" cy="7" r="4"/><path d="M3 21v-2a4 4 0 0 1 4-4h4a4 4 0 0 1 4 4v2"/><circle cx="17" cy="7" r="4"/><path d="M21 21v-2a4 4 0 0 0-4-4h-1"/></svg>Social';
        ms.onclick = function () { if (typeof closeMore === 'function') closeMore(); if (typeof changePage === 'function') changePage('social', null); };
        if (logoutItem) {
            moreSheet.insertBefore(mg, logoutItem);
            moreSheet.insertBefore(ms, logoutItem);
        } else {
            moreSheet.appendChild(mg); moreSheet.appendChild(ms);
        }
    }

    /* Page sections */
    var main = document.querySelector('main.main-content');
    if (main && !document.getElementById('page-grow')) {
        var grow = document.createElement('div');
        grow.id = 'page-grow'; grow.className = 'page-section';
        grow.innerHTML = '<header class="top-header"><div><h1>Grow</h1><p>Your progress, insights and goals</p></div>' +
            '<button class="btn-primary" onclick="__advShare()">📤 Share Progress</button></header>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Weekly Review</h2><div id="weeklyReviewBox"></div></section>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Personal Insights</h2><div id="insightsBox"></div></section>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Your Goals</h2><div id="goalsBox"></div></section>';
        main.appendChild(grow);

        var social = document.createElement('div');
        social.id = 'page-social'; social.className = 'page-section';
        social.innerHTML = '<header class="top-header"><div><h1>Social</h1><p>Share, challenge, compete</p></div></header>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Share Your Progress</h2>' +
            '<div class="setting-desc" style="margin-bottom:14px;">Generate a shareable image with your stats, level, streak and badges.</div>' +
            '<button class="btn-primary" style="width:100%;padding:14px;" onclick="__advShare()">📤 Generate & Share Card</button></section>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Challenges</h2><div id="challengesBox"></div></section>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Leaderboard</h2><div id="leaderboardBox"></div></section>' +
            '<section class="panel"><h2 class="panel-title" style="margin-bottom:14px;">Community</h2><div id="communityBox"></div></section>';
        main.appendChild(social);
    }

    /* Dashboard cards */
    var dash = document.getElementById('page-dashboard');
    if (dash && !document.getElementById('comebackBannerDash')) {
        var anchor = document.getElementById('bootBanners') || dash.querySelector('.top-header');
        if (anchor) {
            var cb = document.createElement('div');
            cb.id = 'comebackBannerDash'; cb.style.display = 'none'; cb.style.marginBottom = '16px';
            anchor.parentNode.insertBefore(cb, anchor.nextSibling);

            var row = document.createElement('div');
            row.className = 'adv-grid adv-grid-2';
            row.style.marginBottom = '16px';
            row.innerHTML = '<section class="panel" id="energyModeBox" style="padding:18px;"></section>' +
                '<section class="panel" id="focusModeBox" style="padding:18px;"></section>';
            cb.parentNode.insertBefore(row, cb.nextSibling);

            var m = document.createElement('section');
            m.className = 'panel'; m.style.marginBottom = '16px';
            m.innerHTML = '<h2 class="panel-title" style="margin-bottom:12px;">Today\'s Missions</h2><div id="missionsBox"></div>';
            row.parentNode.insertBefore(m, row.nextSibling);

            var cm = document.createElement('section');
            cm.className = 'panel'; cm.id = 'comebackModeBox'; cm.style.marginBottom = '16px'; cm.style.display = 'none';
            m.parentNode.insertBefore(cm, m.nextSibling);
        }
    }

    /* Templates button on Habits page */
    var habitsHdr = document.querySelector('#page-habits .panel-header');
    if (habitsHdr && !document.getElementById('advTplBtn')) {
        var addBtn = habitsHdr.querySelector('.btn-primary');
        if (addBtn) {
            var tb = document.createElement('button');
            tb.id = 'advTplBtn'; tb.className = 'btn-primary';
            tb.style.marginLeft = '8px';
            tb.style.background = 'transparent';
            tb.style.borderColor = 'var(--neon-purple)';
            tb.style.color = 'var(--neon-purple)';
            tb.textContent = '📦 Templates';
            tb.onclick = function () { window.__advOpenTemplates(); };
            addBtn.parentNode.insertBefore(tb, addBtn.nextSibling);
        }
    }
}

/* ===================== RENDERERS ===================== */
function renderDashboardExtras() {
    safe(renderMissions, 'missions');
    safe(renderEnergy, 'energy');
    safe(renderFocus, 'focus');
    safe(renderComeback, 'comeback');
    safe(checkComeback, 'checkComeback');
}
function renderGrowPage() {
    safe(renderWeekly, 'weekly');
    safe(renderInsights, 'insights');
    safe(renderGoals, 'goals');
}
function renderSocialPage() {
    safe(renderChallenges, 'challenges');
    safe(renderLeaderboard, 'lb');
    safe(renderCommunity, 'community');
}

/* ===================== HOOK INTO EXISTING ===================== */
function hook() {
    if (typeof window.updateUI !== 'function' || typeof window.changePage !== 'function') {
        setTimeout(hook, 150); return;
    }
    var _u = window.updateUI;
    window.updateUI = function () {
        _u.apply(this, arguments);
        var d = document.getElementById('page-dashboard');
        if (d && d.classList.contains('active')) renderDashboardExtras();
        var g = document.getElementById('page-grow');
        if (g && g.classList.contains('active')) renderGrowPage();
        var s = document.getElementById('page-social');
        if (s && s.classList.contains('active')) renderSocialPage();
    };
    var _c = window.changePage;
    window.changePage = function (pageId, el) {
        _c(pageId, el);
        if (pageId === 'dashboard') renderDashboardExtras();
        if (pageId === 'grow') renderGrowPage();
        if (pageId === 'social') renderSocialPage();
    };
}

/* ===================== INIT ===================== */
function init() {
    var a = G();
    if (!a) { setTimeout(init, 150); return; }
    if (!a.missions) a.missions = { date: '', list: [] };
    if (!a.comeback) a.comeback = { active: false, missions: [], startedAt: null };
    if (!a.realityXp) a.realityXp = { total: 0, log: [] };
    if (!a.challenges) a.challenges = [];
    if (!a.focus) a.focus = [];
    if (!a.goals) a.goals = [];
    if (!a.community) a.community = [];
    hook();
    setTimeout(renderDashboardExtras, 300);
}

function boot() {
    injectHTML();
    setTimeout(init, 200);
}

if (document.readyState === 'complete' || document.readyState === 'interactive') {
    setTimeout(boot, 200);
} else {
    window.addEventListener('load', function () { setTimeout(boot, 200); });
}

})();