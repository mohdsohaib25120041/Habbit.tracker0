/* GoalForce - new features (Smart features, Reports, Focus, Goals, Social, Templates, Pattern lock, Simple mode).
   Loaded AFTER the main scripts, so it shares their globals (appState, prefs, saveData, notify ...). */
(function () {
'use strict';
const FX = window.FX = { pages: {} };

/* ================= helpers ================= */
const q = (s, r) => (r || document).querySelector(s);
const qa = (s, r) => Array.from((r || document).querySelectorAll(s));
const byId = id => document.getElementById(id);
const E = s => escapeHtml(String(s == null ? '' : s));
const clamp = (n, a, b) => Math.min(b, Math.max(a, n));
const isObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const TODAY = () => getTodayStr();
const DAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const logFx = (where, e) => { try { logError('Feature error (' + where + '): ' + (e && e.message || e)); } catch (x) {} };
const safe = (where, fn) => function () { try { return fn.apply(this, arguments); } catch (e) { logFx(where, e); } };

function S() {
    const a = appState;
    if (!isObj(a.fx)) a.fx = {};
    const f = a.fx;
    ['bonus', 'missions', 'comeback', 'perm', 'social'].forEach(k => { if (!isObj(f[k])) f[k] = {}; });
    if (!Array.isArray(f.challenges)) f.challenges = [];
    f.simple = !!f.simple;
    if (!Array.isArray(a.focus)) a.focus = [];
    if (!Array.isArray(a.goals)) a.goals = [];
    if (!Array.isArray(a.distractions)) a.distractions = [];
    if (!isObj(a.energy)) a.energy = {};
    return f;
}
const lastDays = (n, end) => { end = end || TODAY(); const o = []; for (let i = n - 1; i >= 0; i--) o.push(dateAdd(end, -i)); return o; };
function dayStat(d) {
    const sched = schedHabits(d), done = sched.filter(h => h.history[d] === true).length;
    return { sched: sched.length, done, rest: isRestDay(d), pct: sched.length ? Math.round(done / sched.length * 100) : 0 };
}
const tasksDoneOn = d => (appState.tasks || []).reduce((n, t) => n + (t.done && t.done[d] === true ? 1 : 0), 0);
function waterOn(d) {
    const w = appState.water || {}, day = (w.days || {})[d];
    const ml = day && Array.isArray(day.entries) ? day.entries.reduce((a, e) => a + (Number(e.ml) || 0), 0) : 0;
    return { ml, goal: (day && day.goal) || w.goal || 2000 };
}
const focusMinsOn = d => S() && appState.focus.reduce((a, s) => a + (s && s.date === d ? (Number(s.mins) || 0) : 0), 0);
const focusMinsIn = days => days.reduce((a, d) => a + focusMinsOn(d), 0);
const ticksOn = d => appState.habits.reduce((n, h) => n + (h.history[d] === true ? 1 : 0), 0);
function rateOver(days) { try { return rateFor(days); } catch (e) { return 0; } }
const fmtMin = m => m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m`;
function viewerName() {
    const s = S().social;
    if (isObj(appState.profile) && appState.profile.name) return appState.profile.name;
    if (s && s.name) return s.name;
    try { if (typeof cloud !== 'undefined' && cloud.session && cloud.session.user && cloud.session.user.email) return cloud.session.user.email.split('@')[0]; } catch (e) {}
    try { const u = getActiveAuthUser(); if (u && (u.name || u.email)) return u.name || u.email.split('@')[0]; } catch (e) {}
    return 'Achiever';
}
function makePage(id, title, sub, extraHeader) {
    const main = q('main.main-content'); if (!main || byId('page-' + id)) return byId('page-' + id);
    const div = document.createElement('div');
    div.id = 'page-' + id; div.className = 'page-section';
    div.innerHTML = `<header class="top-header"><div><h1>${title}</h1><p>${sub}</p></div>${extraHeader || ''}</header><div id="fx-${id}-body"></div>`;
    main.appendChild(div);
    return div;
}
FX.go = function (id) {
    const nav = q(`.sidebar .nav-item[data-fxnav="${id}"]`);
    changePage(id, nav || null);
};

/* ================= Reality XP engine (bonus XP for real progress, no farming) ================= */
let inEval = false, evalTimer = null, dirty = false, changed = false;
const LBL = { perfect: 'Perfect day', water: 'Water goal reached', 'mission:comeback': 'Comeback step done' };
function labelFor(k) {
    if (LBL[k]) return LBL[k];
    if (k.startsWith('mission:')) return 'Mission done';
    if (k.startsWith('p:focus')) return 'Focus session';
    if (k.startsWith('p:goal')) return 'Goal reached';
    if (k.startsWith('p:week')) return 'Consistent week';
    return 'Bonus';
}
function addXp(n) {
    appState.totalXp = Math.max(0, (Number(appState.totalXp) || 0) + n);
    try { checkLevelUp(); } catch (e) {}
    try { updateUI(); } catch (e) {}
}
FX.awardPerm = function (key, xp, label) {
    const f = S(); if (f.perm[key]) return 0;
    if (appState.demo) return 0;
    f.perm[key] = xp;
    const d = TODAY(); f.bonus[d] = f.bonus[d] || {}; f.bonus[d]['p:' + key] = xp;
    addXp(xp);
    notify({ type: 'xp', title: `+${xp} Reality XP`, message: label || 'Real progress bonus' });
    const was = inEval; inEval = true; try { saveData(); } finally { inEval = was; }
    return xp;
};
function scheduleEval() { clearTimeout(evalTimer); evalTimer = setTimeout(evaluate, 80); }
function weekKey(d) { return 'w' + Math.floor(daysBetween('2024-01-01', d) / 7); }
function evaluate() {
    if (inEval || !appState) return;
    if (appState.demo) { renderDash(); return; }
    inEval = true;
    try {
        const d = TODAY(), f = S();
        const book = f.bonus[d] = f.bonus[d] || {};
        const elig = {};
        const sched = schedHabits(d);
        if (!isRestDay(d) && sched.length >= 2 && sched.every(h => h.history[d] === true)) elig.perfect = 10;
        todaysMissions().forEach(m => { if (missionDone(m, d)) elig['mission:' + m.id] = m.xp || 5; });
        const w = waterOn(d); if (w.goal > 0 && w.ml >= w.goal) elig.water = 5;
        let delta = 0; const got = [];
        changed = false;
        Object.keys(elig).forEach(k => { if (!(k in book)) { book[k] = elig[k]; delta += elig[k]; got.push(labelFor(k)); } });
        Object.keys(book).forEach(k => { if (!k.startsWith('p:') && !(k in elig)) { delta -= book[k]; delete book[k]; } });
        // consistent week: 80%+ over the last 7 days with at least 5 scheduled checks (paid once per week)
        const wk = 'week:' + weekKey(d);
        if (!f.perm[wk]) {
            const days = lastDays(7); let tot = 0;
            days.forEach(x => { if (!isRestDay(x)) tot += schedHabits(x).length; });
            if (tot >= 5 && rateOver(days) >= 80) { f.perm[wk] = 25; book['p:' + wk] = 25; delta += 25; got.push('Consistent week'); }
        }
        try { checkGoals(); } catch (e) { logFx('goals', e); }
        // tidy old ledger entries
        Object.keys(f.bonus).forEach(k => { if (daysBetween(k, d) > 60) delete f.bonus[k]; });
        Object.keys(f.missions).forEach(k => { if (daysBetween(k, d) > 30) delete f.missions[k]; });
        if (delta) {
            appState.totalXp = Math.max(0, (Number(appState.totalXp) || 0) + delta);
            try { checkLevelUp(); } catch (e) {}
            if (delta > 0) notify({ type: 'xp', title: `+${delta} Reality XP`, message: got.join(', ') });
            dirty = true; changed = true;
        }
        if (dirty) { dirty = false; saveData(); }
    } catch (e) { logFx('evaluate', e); }
    finally { inEval = false; }
    try { if (changed) updateUI(); else renderDash(); } catch (e) {}
    try { socialPushSoon(); } catch (e) {}
}

/* ================= Energy Mode ================= */
const getEnergy = () => Number((appState.energy || {})[TODAY()]) || 0;
function applyEnergyAttr() {
    const e = getEnergy(), h = document.documentElement;
    if (e) h.dataset.energy = String(e); else delete h.dataset.energy;
}
FX.setEnergy = function (v) {
    S(); appState.energy[TODAY()] = v;
    dirty = true; saveData();
    applyEnergyAttr();
    try { renderHabits(); } catch (e) {}
    try { renderHomeTasks(); } catch (e) {}
    renderEnergyNote(); renderDash();
    notify({ type: 'info', title: ({ 1: 'Low energy mode', 3: 'Medium energy', 5: 'High energy' })[v], message: v === 1 ? 'Showing easy habits and top-priority tasks first.' : v === 3 ? 'Hard habits are dimmed for now.' : 'Go for the hard stuff!' });
};
FX.toggleShowAll = function () { document.documentElement.classList.toggle('fx-showall'); renderEnergyNote(); };
function renderEnergyNote() {
    const box = byId('fxEnergyNote'); if (!box) return;
    const e = getEnergy();
    if (!e) { box.innerHTML = ''; return; }
    const all = document.documentElement.classList.contains('fx-showall');
    let msg;
    if (e === 1) { const n = qa('#habitList .habit-row[data-effort="hard"]').length; msg = n ? `${n} hard habit${n > 1 ? 's are' : ' is'} hidden. Start with the easy ones.` : 'Easy habits first today.'; }
    else if (e === 3) msg = 'Hard habits are dimmed. Do them if you feel good.';
    else msg = 'Great moment for your hardest habits.';
    box.innerHTML = `<div class="fx-energy-note"><span><b>${({ 1: 'Low', 3: 'Medium', 5: 'High' })[e]} energy:</b> ${msg}</span>${e === 1 ? `<span class="quick-chip" onclick="FX.toggleShowAll()">${all ? 'Apply energy filter' : 'Show everything'}</span>` : ''}</div>`;
}

/* ================= Comeback Mode ================= */
function comebackState() {
    const f = S(), d = TODAY(), c = f.comeback;
    if (c && c.date === d) return c;
    const active = getActiveDates();
    if (active.has(d)) return null;
    const past = Array.from(active).filter(x => x < d).sort();
    if (!past.length) return null;
    const last = past[past.length - 1];
    let missed = 0;
    for (let x = dateAdd(last, 1); x < d; x = dateAdd(x, 1)) if (!isOffDay(x)) missed++;
    if (missed < 1) return null;
    f.comeback = { date: d, missed, from: last }; dirty = true;
    return f.comeback;
}

/* ================= Adaptive Missions ================= */
const effRank = h => ({ easy: 0, normal: 1, hard: 2 })[h.effort || 'normal'];
function genMissions(d, e, cb) {
    const sched = schedHabits(d), pending = sched.filter(h => h.history[d] !== true), list = [];
    const goalMl = clamp(Number((appState.water || {}).goal) || 2000, 500, 10000);
    if (cb) {
        const pool = pending.length ? pending : sched;
        const pick = pool.slice().sort((a, b) => effRank(a) - effRank(b) || (a.target || 1) - (b.target || 1))[0];
        if (pick) list.push({ id: 'comeback', type: 'habit', habitId: pick.id, comeback: true, xp: 10, title: `One easy step: ${pick.name}`, sub: 'Just this one. It restarts your momentum.' });
        else list.push({ id: 'comeback', type: 'water', ml: 250, comeback: true, xp: 10, title: 'One easy step: drink a glass of water', sub: 'A tiny win to restart.' });
        list.push({ id: 'third', type: 'water', ml: Math.round(goalMl / 2 / 50) * 50, xp: 5, title: `Drink ${Math.round(goalMl / 2 / 50) * 50} ml of water`, sub: 'Optional - only if you feel like it' });
        return list;
    }
    const days14 = lastDays(14, dateAdd(d, -1));
    if (pending.length) {
        let pool = pending;
        if (e === 1) { const easy = pending.filter(h => effRank(h) <= 1); if (easy.length) pool = easy.slice().sort((a, b) => effRank(a) - effRank(b)); }
        const scored = pool.map(h => ({ h, r: (() => { try { return rateFor(days14, [h]); } catch (x) { return 0; } })() }))
            .sort((a, b) => (a.r - b.r) || (e === 5 ? effRank(b.h) - effRank(a.h) : effRank(a.h) - effRank(b.h)));
        const a = scored[0];
        list.push({ id: 'anchor', type: 'habit', habitId: a.h.id, xp: 5, title: `Do "${a.h.name}" today`, sub: e === 1 ? 'An easy win for a low-energy day.' : a.r < 50 ? `You did it ${a.r}% of the time lately. Let's lift it.` : 'Keep your rhythm going.' });
    }
    if (sched.length >= 2) {
        const past = lastDays(7, dateAdd(d, -1)).map(x => dayStat(x)).filter(s => s.sched > 0 && !s.rest);
        const avg = past.length ? past.reduce((a, s) => a + s.done, 0) / past.length : 1;
        let n = clamp(Math.round(avg) + 1, 1, sched.length);
        if (e === 1) n = Math.max(1, Math.ceil(n / 2)); else if (e === 5) n = Math.min(sched.length, n + 1);
        if (n >= 2) list.push({ id: 'count', type: 'count', n, xp: 5, title: `Complete ${n} habits today`, sub: `Your recent average is ${avg.toFixed(1)} a day.` });
    }
    const hi = (typeof getTasksDueToday === 'function' ? getTasksDueToday() : []).find(it => (it.task.prio || 2) === 1 && it.task.done[it.date] !== true);
    if (hi) list.push({ id: 'third', type: 'task', taskId: hi.task.id, tdate: hi.date, xp: 5, title: `Finish: ${hi.task.title}`, sub: 'Your top-priority task.' });
    else if (e === 1) { const ml = Math.round(goalMl / 2 / 50) * 50; list.push({ id: 'third', type: 'water', ml, xp: 5, title: `Drink ${ml} ml of water`, sub: 'Gentle and easy.' }); }
    else { const mins = e === 5 ? 25 : 15; list.push({ id: 'third', type: 'focus', mins, xp: 5, title: `Focus for ${mins} minutes`, sub: 'One distraction-free session.' }); }
    return list;
}
function missionDone(m, d) {
    d = d || TODAY();
    if (m.comeback) return m.type === 'water' ? waterOn(d).ml >= (m.ml || 250) : ticksOn(d) >= 1;
    if (m.type === 'habit') { const h = appState.habits.find(x => x.id === m.habitId); return !!h && h.history[d] === true; }
    if (m.type === 'count') return dayStat(d).done >= m.n;
    if (m.type === 'task') { const t = (appState.tasks || []).find(x => x.id === m.taskId); return !!t && t.done[m.tdate] === true; }
    if (m.type === 'water') return waterOn(d).ml >= m.ml;
    if (m.type === 'focus') return focusMinsOn(d) >= m.mins;
    return false;
}
function missionProgress(m, d) {
    if (m.type === 'count') return `${Math.min(dayStat(d).done, m.n)}/${m.n}`;
    if (m.type === 'water') return `${Math.min(waterOn(d).ml, m.ml)}/${m.ml} ml`;
    if (m.type === 'focus') return `${Math.min(focusMinsOn(d), m.mins)}/${m.mins} min`;
    return '';
}
function todaysMissions() {
    const f = S(), d = TODAY(), cb = comebackState();
    const e = cb ? 1 : (getEnergy() || 3), sig = e + '|' + (cb ? 1 : 0) + '|' + appState.habits.length;
    const st = f.missions[d];
    if (st && Array.isArray(st.list) && (st.sig === sig || st.list.some(m => missionDone(m, d)))) return st.list;
    f.missions[d] = { sig, list: genMissions(d, e, cb) }; dirty = true;
    return f.missions[d].list;
}
function missionAction(m, d, done) {
    if (m.type === 'water' && !done) return `<button class="btn-primary" style="padding:6px 12px;font-size:12px;" onclick="addWater(250)">+250 ml</button>`;
    if (m.type === 'focus' && !done) return `<button class="btn-primary" style="padding:6px 12px;font-size:12px;" onclick="FX.focusStart(${m.mins})">Start</button>`;
    return '';
}
FX.tickMission = function (i) {
    const m = todaysMissions()[i]; if (!m) return;
    if (m.type === 'habit') toggleHabit(m.habitId);
    else if (m.type === 'task') toggleTask(m.taskId, m.tdate);
};

/* ================= Smart Today panel (dashboard) ================= */
function ensureDashPanel() {
    if (byId('fxSmart')) return;
    const host = byId('bootBanners'); if (!host) return;
    const sec = document.createElement('section');
    sec.className = 'panel fx-smart'; sec.id = 'fxSmart'; sec.dataset.sec = 'smart';
    host.insertAdjacentElement('afterend', sec);
}
function renderDash() {
    try {
        ensureDashPanel();
        const box = byId('fxSmart'); if (!box) return;
        applyEnergyAttr();
        const d = TODAY(), e = getEnergy(), f = S(), cb = comebackState();
        const ms = todaysMissions();
        const todayXp = Object.values(f.bonus[d] || {}).reduce((a, b) => a + b, 0);
        const doneN = ms.filter(m => missionDone(m, d)).length;
        const eb = (v, l) => `<button data-e="${v}" class="${e === v ? 'on' : ''}" onclick="FX.setEnergy(${v})"><span class="dot"></span>${l}</button>`;
        const cbDone = cb && ticksOn(d) >= 1;
        const cbHtml = cb ? `<div class="fx-comeback ${cbDone ? 'done' : ''}"><div><b>${cbDone ? 'Welcome back! You did it.' : `Welcome back. You missed ${cb.missed} day${cb.missed > 1 ? 's' : ''}.`}</b><span class="fx-muted">${cbDone ? 'One small step is all it takes. Your comeback bonus is counted.' : 'No guilt. Do just one easy mission to restart your momentum.'}</span></div></div>` : '';
        const rows = ms.map((m, i) => {
            const done = missionDone(m, d), prog = missionProgress(m, d), clickable = m.type === 'habit' || m.type === 'task';
            return `<div class="fx-row"><div class="fx-chk ${done ? 'on' : ''}" ${clickable ? `style="cursor:pointer" onclick="FX.tickMission(${i})"` : ''}>${done ? '✓' : ''}</div>
                <div class="grow"><div class="t" ${done ? 'style="text-decoration:line-through;opacity:.7"' : ''}>${E(m.title)}</div><div class="s">${E(m.sub || '')}${prog ? ` &middot; ${prog}` : ''}</div></div>
                ${missionAction(m, d, done)}<div class="fx-xp">+${m.xp || 5} XP</div></div>`;
        }).join('');
        box.innerHTML = `<div class="panel-header" style="margin-bottom:12px;"><div><h2 class="panel-title">Smart Today</h2><span class="fx-muted">Missions that adapt to you &middot; ${doneN}/${ms.length} done</span></div>
            <button class="btn-primary" onclick="FX.focusStart(25)">Focus Mode</button></div>
            <div class="fx-energy"><span class="lbl">How is your energy?</span>${eb(1, 'Low')}${eb(3, 'Medium')}${eb(5, 'High')}</div>
            ${cbHtml}${rows || '<div class="fx-empty">Add a habit to get missions.</div>'}
            <div class="fx-realxp"><span>Reality XP today: <b>+${todayXp}</b> <span class="fx-muted">(bonus for real progress, not for tapping)</span></span><span class="quick-chip" style="margin:0" onclick="FX.go('reports')">See progress</span></div>`;
        renderEnergyNote();
    } catch (e) { logFx('renderDash', e); }
}
FX.renderDash = renderDash;

/* ================= Progress & Analytics: weekly report, monthly stats, streaks, insights ================= */
FX.rp = { week: 0, month: 0 };
function weekSummary(days) {
    let sched = 0, done = 0;
    const per = days.map(d => { const s = dayStat(d); if (!s.rest) { sched += s.sched; done += s.done; } return { d, pct: s.rest || !s.sched ? null : s.pct }; });
    const withData = per.filter(x => x.pct !== null).sort((a, b) => b.pct - a.pct);
    return {
        per, pct: sched ? Math.round(done / sched * 100) : 0, ticks: days.reduce((a, d) => a + ticksOn(d), 0),
        tasks: days.reduce((a, d) => a + tasksDoneOn(d), 0), focus: focusMinsIn(days),
        waterDays: days.filter(d => { const w = waterOn(d); return w.ml > 0 && w.ml >= w.goal; }).length, best: withData[0] || null
    };
}
const delta = (a, b, unit) => { const x = a - b; if (!x) return '<span class="d">same as before</span>'; return `<span class="d ${x > 0 ? 'fx-up' : 'fx-down'}">${x > 0 ? '▲' : '▼'} ${Math.abs(x)}${unit || ''} vs before</span>`; };
const tile = (k, v, d) => `<div class="fx-tile"><div class="k">${k}</div><div class="v">${v}</div>${d || ''}</div>`;

function habitStreaks(h) {
    const hist = h.history || {}, today = TODAY();
    const dates = Object.keys(hist).filter(k => hist[k] === true).sort();
    if (!dates.length) return { cur: 0, best: 0 };
    let cur = 0, d = hist[today] === true ? today : dateAdd(today, -1);
    for (let i = 0; i < 4000 && d >= dates[0]; i++) {
        if (!isScheduled(h, d) || isRestDay(d)) { d = dateAdd(d, -1); continue; }
        if (hist[d] === true) { cur++; d = dateAdd(d, -1); } else break;
    }
    let best = 0, run = 0, x = dates[0];
    for (let i = 0; i < 4000 && x <= today; i++) {
        if (isScheduled(h, x) && !isRestDay(x)) { if (hist[x] === true) { run++; best = Math.max(best, run); } else if (x !== today) run = 0; }
        x = dateAdd(x, 1);
    }
    return { cur, best: Math.max(best, cur) };
}

function buildInsights() {
    const out = [], today = TODAY();
    const add = (cls, ic, t, s) => out.push({ cls, ic, t, s });
    if (getActiveDates().size < 3) return [{ cls: '', ic: 'i', t: 'Insights are warming up', s: 'Tick your habits for at least 3 different days and your personal insights will appear here.' }];
    // best / worst weekday over 8 weeks
    const byDay = {}; lastDays(56).forEach(d => { if (isRestDay(d)) return; const s = dayStat(d); if (!s.sched) return; const w = weekdayOf(d); (byDay[w] = byDay[w] || { s: 0, d: 0, n: 0 }); byDay[w].s += s.sched; byDay[w].d += s.done; byDay[w].n++; });
    const wd = Object.keys(byDay).filter(w => byDay[w].n >= 3).map(w => ({ w: Number(w), r: Math.round(byDay[w].d / byDay[w].s * 100) })).sort((a, b) => b.r - a.r);
    if (wd.length >= 3 && wd[0].r - wd[wd.length - 1].r >= 15) {
        add('good', '★', `${DAY_NAMES[wd[0].w]} is your strongest day`, `You complete ${wd[0].r}% of habits on ${DAY_NAMES[wd[0].w]}s.`);
        add('warn', '!', `${DAY_NAMES[wd[wd.length - 1].w]} is your toughest day`, `Only ${wd[wd.length - 1].r}% on ${DAY_NAMES[wd[wd.length - 1].w]}s. Try easier habits or a lighter plan that day.`);
    }
    // weakest habit
    const d14 = lastDays(14);
    const hr = appState.habits.map(h => { let sc = 0; d14.forEach(d => { if (isScheduled(h, d) && !isRestDay(d)) sc++; }); return { h, sc, r: sc ? rateFor(d14, [h]) : null }; }).filter(x => x.sc >= 4).sort((a, b) => a.r - b.r);
    if (hr.length && hr[0].r < 50) add('warn', '!', `"${hr[0].h.name}" keeps slipping`, `Done ${hr[0].r}% of the time in 2 weeks. Set its effort to Easy or lower its target so it is easier to start.`);
    if (hr.length > 1 && hr[hr.length - 1].r >= 85) add('good', '✓', `"${hr[hr.length - 1].h.name}" is a solid habit`, `${hr[hr.length - 1].r}% in the last 2 weeks. Great base to stack a new habit on.`);
    // usual time
    try { const all = habitTimes().reduce((a, x) => a.concat(x.all), []); if (all.length >= 5) add('', '⏰', `You usually tick habits around ${fm(Math.round(all.reduce((a, b) => a + b, 0) / all.length))}`, 'Set your daily reminder near that time so it fits your real routine.'); } catch (e) {}
    // energy link
    const en = { lo: [], hi: [] }; Object.keys(appState.energy || {}).forEach(d => { const v = Number(appState.energy[d]), s = dayStat(d); if (!s.sched || d > today) return; if (v === 1) en.lo.push(s.pct); else if (v === 5) en.hi.push(s.pct); });
    const avg = a => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
    if (en.lo.length >= 2 && en.hi.length >= 2 && Math.abs(avg(en.hi) - avg(en.lo)) >= 15) add('', '⚡', 'Energy changes your results', `On high-energy days you finish ${avg(en.hi)}% vs ${avg(en.lo)}% on low-energy days. Plan hard habits for high-energy days.`);
    // water link
    const wy = [], wn = []; lastDays(30).forEach(d => { const s = dayStat(d), w = waterOn(d); if (!s.sched || s.rest || w.ml === 0) return; (w.ml >= w.goal ? wy : wn).push(s.pct); });
    if (wy.length >= 3 && wn.length >= 3 && avg(wy) - avg(wn) >= 10) add('good', '💧', 'Water days are better days', `You finish ${avg(wy)}% of habits when you hit your water goal vs ${avg(wn)}% when you do not.`);
    // momentum
    const a = weekSummary(lastDays(7)), b = weekSummary(lastDays(7, dateAdd(today, -7)));
    if (b.pct > 0 && a.pct - b.pct >= 10) add('good', '↗', 'Momentum is building', `Completion is up ${a.pct - b.pct} points compared to the previous 7 days.`);
    else if (b.pct > 0 && b.pct - a.pct >= 10) add('warn', '↘', 'Momentum dipped this week', `Completion is down ${b.pct - a.pct} points. Try Low energy mode or a comeback mission to reset.`);
    // streak risk
    const st = getCurrentStreak();
    if (st >= 3 && !getActiveDates().has(today) && new Date().getHours() >= 17) add('warn', '🔥', `Protect your ${st}-day streak`, 'You have not ticked anything yet today. One easy habit keeps it alive.');
    // focus
    const fm1 = focusMinsIn(lastDays(7)); if (fm1 > 0) add('', '◎', `${fmtMin(fm1)} of focus this week`, `Previous 7 days: ${fmtMin(focusMinsIn(lastDays(7, dateAdd(today, -7))))}.`);
    return out.slice(0, 7);
}

function renderReports() {
    const box = byId('fx-reports-body'); if (!box) return;
    const today = TODAY(), rp = FX.rp;
    // ----- weekly
    const end = dateAdd(today, -7 * rp.week), days = lastDays(7, end), cur = weekSummary(days), prev = weekSummary(lastDays(7, dateAdd(end, -7)));
    const bars = cur.per.map(x => `<div class="c"><span>${x.pct === null ? '-' : x.pct + '%'}</span><i style="height:${x.pct === null ? 3 : Math.max(3, x.pct)}%;${x.d === today ? 'background:var(--neon-purple)' : ''}"></i><span>${DAY_NAMES[weekdayOf(x.d)].slice(0, 2)}</span></div>`).join('');
    const weekHtml = `<div class="fx-sec"><h2 class="panel-title" style="margin-bottom:6px;">Weekly Report</h2>
        <div class="task-tabs" style="margin-bottom:14px;"><button class="tab-btn ${rp.week === 0 ? 'active' : ''}" onclick="FX.rpWeek(0)">Last 7 days</button><button class="tab-btn ${rp.week === 1 ? 'active' : ''}" onclick="FX.rpWeek(1)">Previous 7 days</button></div>
        <div class="fx-grid">${tile('Completion', cur.pct + '%', delta(cur.pct, prev.pct, ' pts'))}${tile('Habits ticked', cur.ticks, delta(cur.ticks, prev.ticks))}${tile('Tasks done', cur.tasks, delta(cur.tasks, prev.tasks))}${tile('Focus time', fmtMin(cur.focus), delta(cur.focus, prev.focus, ' min'))}${tile('Water goal days', cur.waterDays + '/7', delta(cur.waterDays, prev.waterDays))}${tile('Best day', cur.best ? DAY_NAMES[weekdayOf(cur.best.d)] + ' ' + cur.best.pct + '%' : '-', '')}</div>
        <div class="fx-bars">${bars}</div></div>`;
    // ----- monthly
    const base = new Date(); base.setDate(1); base.setMonth(base.getMonth() - rp.month);
    const y = base.getFullYear(), m = base.getMonth(), dim = new Date(y, m + 1, 0).getDate();
    const mDays = Array.from({ length: dim }, (_, i) => `${y}-${pad2(m + 1)}-${pad2(i + 1)}`), past = mDays.filter(d => d <= today);
    let perfect = 0, activeDays = 0, ticks = 0, tasks = 0, waterSum = 0, waterN = 0;
    past.forEach(d => { const s = dayStat(d); if (s.sched && !s.rest && s.done === s.sched) perfect++; const t = ticksOn(d); if (t) activeDays++; ticks += t; tasks += tasksDoneOn(d); const w = waterOn(d); if (w.ml) { waterSum += w.ml; waterN++; } });
    const hab = appState.habits.map(h => { let sc = 0; past.forEach(d => { if (isScheduled(h, d) && !isRestDay(d)) sc++; }); return { h, sc, r: sc ? rateFor(past, [h]) : null }; }).filter(x => x.sc >= 3).sort((a, b) => b.r - a.r);
    const heatCls = d => { if (d > today) return ''; const s = dayStat(d); if (s.rest || !s.sched) return ''; return s.pct >= 100 ? 'h4' : s.pct >= 70 ? 'h3' : s.pct >= 40 ? 'h2' : s.pct > 0 ? 'h1' : ''; };
    const lead = (new Date(y, m, 1).getDay() + 6) % 7;
    const heat = '<span style="background:none"></span>'.repeat(lead) + mDays.map(d => `<span class="${heatCls(d)} ${d === today ? 'today' : ''}" title="${d}">${Number(d.slice(8))}</span>`).join('');
    const monthName = new Date(y, m, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    const monthHtml = `<div class="fx-sec"><div class="panel-header" style="margin-bottom:10px;"><h2 class="panel-title">Monthly Stats <span class="fx-muted" style="font-size:13px;font-weight:500;">${monthName}</span></h2><div style="display:flex;gap:8px;"><button class="quick-chip" style="margin:0" onclick="FX.rpMonth(1)">&larr; Earlier</button><button class="quick-chip" style="margin:0;${rp.month === 0 ? 'opacity:.4;pointer-events:none' : ''}" onclick="FX.rpMonth(-1)">Later &rarr;</button></div></div>
        <div class="fx-grid">${tile('Completion', rateOver(past) + '%', '')}${tile('Perfect days', perfect, '')}${tile('Active days', activeDays + '/' + past.length, '')}${tile('Habits ticked', ticks, '')}${tile('Tasks done', tasks, '')}${tile('Focus time', fmtMin(focusMinsIn(past)), '')}${tile('Avg water', waterN ? Math.round(waterSum / waterN) + ' ml' : '-', '')}${tile('Best habit', hab[0] ? E(hab[0].h.name) : '-', hab[0] ? `<div class="d">${hab[0].r}% this month</div>` : '')}</div>
        <div class="fx-heat-head">${['Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa', 'Su'].map(x => `<span>${x}</span>`).join('')}</div><div class="fx-heat">${heat}</div>
        <div class="fx-note">Darker green = more of that day's habits completed.</div></div>`;
    // ----- streaks
    const st = appState.habits.map(h => ({ h, s: habitStreaks(h), r: (() => { try { return rateFor(lastDays(30), [h]); } catch (e) { return 0; } })() })).sort((a, b) => b.s.cur - a.s.cur || b.s.best - a.s.best);
    const streakHtml = `<div class="fx-sec"><h2 class="panel-title" style="margin-bottom:10px;">Habit Streaks</h2>${st.map(x => `<div class="fx-row"><div class="grow"><div class="t">${E(x.h.name)}</div><div class="s">Current <b>${x.s.cur}</b> day${x.s.cur === 1 ? '' : 's'} &middot; Best <b>${x.s.best}</b> &middot; 30-day rate ${x.r}%</div><div class="fx-bar" style="margin-top:8px;"><i style="width:${x.r}%"></i></div></div></div>`).join('') || '<div class="fx-empty">No habits yet.</div>'}</div>`;
    // ----- insights
    const ins = buildInsights();
    const insHtml = `<div class="fx-sec"><h2 class="panel-title" style="margin-bottom:4px;">Personal Insights</h2><div class="fx-note" style="margin:0 0 12px;">Smart insights worked out on your device from your own habit data. Nothing is sent anywhere.</div>${ins.map(i => `<div class="fx-insight ${i.cls}"><div class="ic">${i.ic}</div><div><div class="t">${E(i.t)}</div><div class="s">${E(i.s)}</div></div></div>`).join('')}</div>`;
    box.innerHTML = `<section class="panel">${insHtml}</section><section class="panel">${weekHtml}</section><section class="panel">${monthHtml}</section><section class="panel">${streakHtml}</section>`;
}
FX.rpWeek = v => { FX.rp.week = v; renderReports(); };
FX.rpMonth = d => { FX.rp.month = Math.max(0, FX.rp.month + d); renderReports(); };
FX.pages.reports = renderReports;

/* ================= Goals ================= */
const GOAL_TYPES = { streak: ['Reach a streak (days)', 'days'], xp: ['Reach total XP', 'XP'], habit: ['Do one habit N times', 'times'], ticks: ['Complete N habits in total', 'habits'], water: ['Hit water goal N days', 'days'], focus: ['Focus for N minutes', 'min'], custom: ['Custom counter', ''] };
function goalProgress(g) {
    const created = g.created || TODAY(), today = TODAY(), t = Math.max(1, Number(g.target) || 1);
    let cur = 0;
    if (g.type === 'streak') cur = Math.max(getCurrentStreak(), Number(g.peak) || 0);
    else if (g.type === 'xp') cur = Number(appState.totalXp) || 0;
    else if (g.type === 'habit') { const h = appState.habits.find(x => x.id === g.habitId); cur = h ? Object.keys(h.history).filter(k => h.history[k] === true && k >= created).length : 0; }
    else if (g.type === 'ticks') cur = appState.habits.reduce((n, h) => n + Object.keys(h.history).filter(k => h.history[k] === true && k >= created).length, 0);
    else if (g.type === 'water') { for (let d = created, i = 0; d <= today && i < 800; d = dateAdd(d, 1), i++) { const w = waterOn(d); if (w.ml > 0 && w.ml >= w.goal) cur++; } }
    else if (g.type === 'focus') cur = appState.focus.reduce((a, s) => a + (s && s.date >= created ? (Number(s.mins) || 0) : 0), 0);
    else cur = Number(g.val) || 0;
    if (g.type === 'streak' && cur > (Number(g.peak) || 0)) g.peak = cur;
    return { cur, t, pct: clamp(Math.round(cur / t * 100), 0, 100) };
}
function checkGoals() {
    S(); let any = false;
    appState.goals.forEach(g => {
        if (!g || g.doneOn) return;
        const p = goalProgress(g);
        if (p.cur >= p.t) { g.doneOn = TODAY(); any = true; dirty = true; FX.awardPerm('goal:' + g.id, 20, 'Goal reached: ' + (g.title || 'Goal')); notify({ type: 'level', title: 'Goal reached!', message: g.title || 'Goal', duration: 5500 }); }
    });
    return any;
}
function goalDefaultTitle(type, target, h) {
    if (type === 'streak') return `${target}-day streak`;
    if (type === 'xp') return `Reach ${target} XP`;
    if (type === 'habit') return `${h ? h.name : 'Habit'} x ${target}`;
    if (type === 'ticks') return `Complete ${target} habits`;
    if (type === 'water') return `Hit water goal ${target} days`;
    if (type === 'focus') return `${target} minutes of focus`;
    return `Goal: ${target}`;
}
function renderGoals() {
    const box = byId('fx-goals-body'); if (!box) return;
    S(); checkGoals();
    const gs = appState.goals.slice().sort((a, b) => (a.doneOn ? 1 : 0) - (b.doneOn ? 1 : 0) || String(a.deadline || '9999').localeCompare(String(b.deadline || '9999')));
    const rows = gs.map(g => {
        const p = goalProgress(g), done = !!g.doneOn, over = !done && g.deadline && g.deadline < TODAY();
        const left = g.deadline && !done ? (over ? `<span class="fx-down">overdue</span>` : `${daysBetween(TODAY(), g.deadline)} day(s) left`) : '';
        const unit = (GOAL_TYPES[g.type] || ['', ''])[1];
        return `<div class="fx-row fx-goal ${done ? 'done' : ''}"><div class="grow"><div class="t">${done ? '✓ ' : ''}${E(g.title)}</div>
            <div class="s">${Math.min(p.cur, p.t)} / ${p.t} ${unit}${left ? ' &middot; ' + left : ''}${done ? ' &middot; reached ' + E(g.doneOn) : ''}</div>
            <div class="fx-bar ${done ? 'green' : ''}" style="margin-top:8px;"><i style="width:${p.pct}%"></i></div></div>
            ${g.type === 'custom' && !done ? `<div class="task-row-actions"><button class="icon-btn" onclick="FX.goalBump('${E(g.id)}',-1)">-</button><button class="icon-btn" onclick="FX.goalBump('${E(g.id)}',1)">+</button></div>` : ''}
            <button class="icon-btn" title="Delete" onclick="FX.goalDel('${E(g.id)}')">${ICON_TRASH}</button></div>`;
    }).join('');
    const typeOpts = Object.keys(GOAL_TYPES).map(k => `<option value="${k}">${GOAL_TYPES[k][0]}</option>`).join('');
    const habOpts = appState.habits.map(h => `<option value="${E(h.id)}">${E(h.name)}</option>`).join('');
    box.innerHTML = `<section class="panel"><h2 class="panel-title" style="margin-bottom:4px;">Set a goal</h2><div class="fx-note" style="margin:0 0 14px;">Goals update by themselves from your habits, water and focus time. Reaching one gives <b>+20 Reality XP</b>.</div>
        <div class="fx-form"><div class="input-group"><label>Type</label><select id="fxGType" onchange="FX.goalTypeChange()">${typeOpts}</select></div>
        <div class="input-group" id="fxGHabitWrap" style="display:none"><label>Habit</label><select id="fxGHabit">${habOpts}</select></div>
        <div class="input-group"><label>Target</label><input type="number" id="fxGTarget" min="1" max="100000" value="7"></div>
        <div class="input-group"><label>Deadline (optional)</label><input type="date" id="fxGDeadline"></div>
        <div class="input-group"><label>Name (optional)</label><input type="text" id="fxGTitle" maxlength="60" placeholder="e.g. Gym 20 times"></div></div>
        <button class="btn-primary" onclick="FX.goalAdd()">Add goal</button></section>
        <section class="panel"><h2 class="panel-title" style="margin-bottom:12px;">Your goals</h2>${rows || '<div class="fx-empty">No goals yet. Add your first one above.</div>'}</section>`;
}
FX.goalTypeChange = function () { const t = byId('fxGType').value; byId('fxGHabitWrap').style.display = t === 'habit' ? '' : 'none'; };
FX.goalAdd = function () {
    S();
    const type = byId('fxGType').value, target = clamp(Math.floor(Number(byId('fxGTarget').value) || 0), 1, 100000);
    if (!GOAL_TYPES[type] || !target) return notify({ type: 'error', title: 'Enter a target number' });
    const hid = byId('fxGHabit').value, h = appState.habits.find(x => x.id === hid);
    if (type === 'habit' && !h) return notify({ type: 'error', title: 'Add a habit first' });
    const dl = byId('fxGDeadline').value;
    if (dl && !/^\d{4}-\d{2}-\d{2}$/.test(dl)) return notify({ type: 'error', title: 'Check the deadline date' });
    const title = (byId('fxGTitle').value || '').trim().slice(0, 60) || goalDefaultTitle(type, target, h);
    appState.goals.push({ id: 'g' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), type, target, habitId: type === 'habit' ? hid : '', deadline: dl || '', title, created: TODAY(), val: 0 });
    saveData(); renderGoals(); notify({ type: 'success', title: 'Goal added' });
};
FX.goalDel = function (id) { confirmDo('Delete this goal?', () => { appState.goals = appState.goals.filter(g => g.id !== id); saveData(); renderGoals(); }, 'Delete'); };
FX.goalBump = function (id, dlt) { const g = appState.goals.find(x => x.id === id); if (!g) return; g.val = Math.max(0, (Number(g.val) || 0) + dlt); saveData(); renderGoals(); };
FX.pages.goals = renderGoals;

/* ================= Focus Mode (block distractions, count times you leave, Reality XP) ================= */
const FOCUS_KEY = 'fxFocusRun';
let run = null, tickTimer = null, wakeLock = null, hiddenAt = 0, queued = [], lastDone = null;
const _notify = notify;
notify = function (o) { if (run && o && o.type !== 'error') { queued.push(o); return; } return _notify(o); };
FX.fmins = 25;

function persistRun() { try { if (run) localStorage.setItem(FOCUS_KEY, JSON.stringify(run)); else localStorage.removeItem(FOCUS_KEY); } catch (e) {} }
function focusOverlay() {
    let o = byId('fxFocus');
    if (!o) { o = document.createElement('div'); o.id = 'fxFocus'; document.body.appendChild(o); }
    return o;
}
function drawFocus() {
    const o = focusOverlay();
    if (run) {
        o.innerHTML = `<div class="fx-muted" style="font-size:14px;">Focus Mode &middot; distractions blocked</div><div style="font-size:20px;font-weight:700;max-width:320px;word-break:break-word;">${E(run.label)}</div>
            <div class="fx-focus-ring"><svg viewBox="0 0 240 240"><circle class="bg" cx="120" cy="120" r="110"/><circle class="fg" id="fxFRing" cx="120" cy="120" r="110"/></svg><div class="fx-focus-time" id="fxFTime">--:--</div></div>
            <div class="fx-quote">Notifications are paused and the menus are hidden. Stay with one thing.</div><div class="fx-muted" id="fxFLeaves"></div>
            <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center;"><button class="btn-primary" onclick="FX.focusStop(true)">Finish now</button><button class="btn-primary" style="background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.focusStop(false)">Cancel</button></div>`;
        tickFocus();
    } else if (lastDone) {
        o.innerHTML = `<div style="font-size:26px;font-weight:700;">${lastDone.mins >= 1 ? 'Session complete!' : 'Session cancelled'}</div>
            <div class="fx-muted" style="font-size:15px;">${lastDone.mins >= 1 ? `${lastDone.mins} minute${lastDone.mins > 1 ? 's' : ''} of focus on "${E(lastDone.label)}"` : 'Under 1 minute, so it was not counted.'}${lastDone.leaves ? `<br>You left the app ${lastDone.leaves} time${lastDone.leaves > 1 ? 's' : ''}.` : lastDone.mins >= 1 ? '<br>No distractions. Nice.' : ''}</div>
            ${lastDone.xp ? `<div class="fx-xp" style="font-size:18px;">+${lastDone.xp} Reality XP</div>` : ''}<button class="btn-primary" style="padding:12px 28px;" onclick="FX.focusClose()">Done</button>`;
    }
}
function tickFocus() {
    if (!run) return;
    const left = run.end - Date.now();
    if (left <= 0) return finishFocus(true);
    const s = Math.ceil(left / 1000), t = byId('fxFTime'), r = byId('fxFRing'), l = byId('fxFLeaves');
    if (t) t.textContent = `${pad2(Math.floor(s / 60))}:${pad2(s % 60)}`;
    if (r) r.style.strokeDashoffset = String(691 * (1 - left / (run.mins * 60000)));
    if (l) l.textContent = run.leaves ? `Times you left the app: ${run.leaves}` : '';
}
async function lockScreen() { try { if (navigator.wakeLock) wakeLock = await navigator.wakeLock.request('screen'); } catch (e) {} }
function unlockScreen() { try { if (wakeLock) wakeLock.release(); } catch (e) {} wakeLock = null; }
function enterFocus() {
    document.documentElement.classList.add('fx-focusing');
    focusOverlay().classList.add('show');
    drawFocus(); clearInterval(tickTimer); tickTimer = setInterval(tickFocus, 500); lockScreen();
}
FX.focusStart = function (mins, label) {
    if (run) { focusOverlay().classList.add('show'); return; }
    if (typeof isUserAuthenticated === 'function' && !isUserAuthenticated()) { enforceAuthGate(); return; }
    mins = clamp(Math.floor(Number(mins) || 25), 1, 180);
    const inp = byId('fxFocusLabel');
    label = String(label || (inp && inp.value) || 'Deep focus').trim().slice(0, 60) || 'Deep focus';
    run = { start: Date.now(), end: Date.now() + mins * 60000, mins, label, leaves: 0 };
    lastDone = null; persistRun(); enterFocus();
};
function finishFocus(full) {
    if (!run) return;
    const r = run; run = null; clearInterval(tickTimer); persistRun(); unlockScreen();
    const mins = full ? r.mins : Math.min(r.mins, Math.floor((Date.now() - r.start) / 60000));
    let xp = 0;
    if (mins >= 1) {
        S(); appState.focus.push({ date: TODAY(), at: Date.now(), mins, label: r.label, leaves: r.leaves || 0, full: !!full });
        if (appState.focus.length > 1000) appState.focus.splice(0, appState.focus.length - 1000);
        saveData();
        if (mins >= 5) {
            const used = Object.keys(S().bonus[TODAY()] || {}).filter(k => k.startsWith('p:focus')).reduce((a, k) => a + S().bonus[TODAY()][k], 0);
            const give = Math.min(Math.floor(mins / 5), Math.max(0, 10 - used));
            if (give > 0) xp = FX.awardPerm('focus:' + Date.now(), give, `${mins} min focus session`);
        }
        try { playSound('complete'); } catch (e) {}
        try { if (document.hidden && 'Notification' in window && Notification.permission === 'granted') new Notification('Focus session complete', { body: `${mins} minutes done. Nice work!` }); } catch (e) {}
    }
    lastDone = { mins, label: r.label, leaves: r.leaves || 0, xp };
    drawFocus(); evaluate();
}
FX.focusStop = function (finish) { if (!run) return; if (finish) finishFocus(false); else confirmDo('Cancel this focus session? It will not be counted.', () => { const r = run; run = null; clearInterval(tickTimer); persistRun(); unlockScreen(); FX.focusClose(); }, 'Cancel session'); };
FX.focusClose = function () {
    lastDone = null; focusOverlay().classList.remove('show'); document.documentElement.classList.remove('fx-focusing');
    const n = queued.splice(0).slice(-3); n.forEach(x => _notify(x));
    if (q('#page-focus.active')) renderFocusPage();
};
document.addEventListener('visibilitychange', () => {
    if (!run) return;
    if (document.hidden) hiddenAt = Date.now();
    else if (hiddenAt) {
        if (Date.now() - hiddenAt > 3000) { run.leaves = (run.leaves || 0) + 1; persistRun(); try { S(); appState.distractions.push({ date: TODAY(), at: Date.now(), src: 'focus' }); if (appState.distractions.length > 500) appState.distractions.shift(); dirty = true; } catch (e) {} lockScreen(); }
        hiddenAt = 0; tickFocus();
    }
});
window.addEventListener('beforeunload', e => { if (run) { e.preventDefault(); e.returnValue = ''; } });
function resumeFocus() {
    try {
        const r = JSON.parse(localStorage.getItem(FOCUS_KEY) || 'null');
        if (!r || !Number.isFinite(r.end) || !Number.isFinite(r.start) || !(r.mins > 0)) return;
        if (r.end > Date.now()) { run = { start: r.start, end: r.end, mins: clamp(r.mins, 1, 180), label: String(r.label || 'Deep focus').slice(0, 60), leaves: Number(r.leaves) || 0 }; enterFocus(); }
        else if (Date.now() - r.end < 6 * 3600 * 1000) { run = { start: r.start, end: r.end, mins: clamp(r.mins, 1, 180), label: String(r.label || 'Deep focus').slice(0, 60), leaves: Number(r.leaves) || 0 }; finishFocus(true); focusOverlay().classList.add('show'); document.documentElement.classList.add('fx-focusing'); }
        else localStorage.removeItem(FOCUS_KEY);
    } catch (e) { try { localStorage.removeItem(FOCUS_KEY); } catch (x) {} }
}
function renderFocusPage() {
    const box = byId('fx-focus-body'); if (!box) return;
    S(); const today = TODAY(), wk = lastDays(7), sessions = appState.focus.slice().reverse().slice(0, 8);
    const leaves = appState.distractions.filter(x => x && x.src === 'focus' && wk.includes(x.date)).length;
    box.innerHTML = `<section class="panel"><h2 class="panel-title" style="margin-bottom:4px;">Start a session</h2><div class="fx-note" style="margin:0 0 14px;">Focus Mode hides the menus, pauses notifications, keeps the screen awake and counts every time you leave the app. Sessions of 5+ minutes give a little Reality XP (max 10 a day).</div>
        <div class="fx-chips" style="margin-bottom:14px;">${[10, 15, 25, 45, 60].map(m => `<span class="quick-chip ${FX.fmins === m ? 'on' : ''}" onclick="FX.fmins=${m};FX.pages.focus()">${m} min</span>`).join('')}</div>
        <div class="fx-form"><div class="input-group"><label>Custom minutes</label><input type="number" id="fxFocusMins" min="1" max="180" value="${FX.fmins}" oninput="FX.fmins=Math.max(1,Math.min(180,Number(this.value)||25))"></div>
        <div class="input-group"><label>What will you focus on?</label><input type="text" id="fxFocusLabel" maxlength="60" placeholder="e.g. Study chapter 3"></div></div>
        <button class="btn-primary" style="padding:12px 26px;" onclick="FX.focusStart(FX.fmins)">Start focus</button></section>
        <section class="panel"><div class="fx-grid">${tile('Today', fmtMin(focusMinsOn(today)), '')}${tile('Last 7 days', fmtMin(focusMinsIn(wk)), '')}${tile('Sessions (total)', appState.focus.length, '')}${tile('Times you left (7d)', leaves, '')}</div>
        <h2 class="panel-title" style="margin-bottom:10px;">Recent sessions</h2>${sessions.map(s => `<div class="fx-row"><div class="grow"><div class="t">${E(s.label || 'Focus')}</div><div class="s">${E(s.date)} &middot; ${s.mins} min${s.leaves ? ` &middot; left app ${s.leaves}x` : ''}</div></div><div class="fx-xp">${s.full ? 'Full' : 'Early'}</div></div>`).join('') || '<div class="fx-empty">No sessions yet.</div>'}</section>`;
}
FX.pages.focus = renderFocusPage;

/* ================= Share Progress Card ================= */
function weekPctNow() { return rateOver(lastDays(7)); }
function shareText() {
    const lv = getLevelInfo(appState.totalXp).level;
    return `${viewerName()} is Level ${lv} (${getRank(lv)}) with a ${getCurrentStreak()}-day streak and ${weekPctNow()}% habit completion this week. Building better habits with GoalForce!`;
}
function rr(c, x, y, w, h, r) { c.beginPath(); c.moveTo(x + r, y); c.arcTo(x + w, y, x + w, y + h, r); c.arcTo(x + w, y + h, x, y + h, r); c.arcTo(x, y + h, x, y, r); c.arcTo(x, y, x + w, y, r); c.closePath(); }
function drawShareCard(cv) {
    const W = 1080, H = 1350; cv.width = W; cv.height = H;
    const c = cv.getContext('2d'), F = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#0a0a1a'); g.addColorStop(.55, '#14082b'); g.addColorStop(1, '#04101a');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    const glow = (x, y, r, col) => { const rg = c.createRadialGradient(x, y, 0, x, y, r); rg.addColorStop(0, col); rg.addColorStop(1, 'rgba(0,0,0,0)'); c.fillStyle = rg; c.fillRect(0, 0, W, H); };
    glow(150, 150, 520, 'rgba(0,240,255,.22)'); glow(950, 1150, 560, 'rgba(176,38,255,.25)');
    const info = getLevelInfo(appState.totalXp), streak = getCurrentStreak(), wp = weekPctNow();
    c.fillStyle = '#00f0ff'; c.font = `800 44px ${F}`; c.fillText('GoalForce', 80, 120);
    c.fillStyle = '#9a9aa8'; c.font = `500 28px ${F}`; c.fillText('My progress', 80, 165);
    c.fillStyle = '#fff'; c.font = `700 74px ${F}`;
    let nm = viewerName(); while (c.measureText(nm).width > 900 && nm.length > 3) nm = nm.slice(0, -2);
    c.fillText(nm, 80, 300);
    c.fillStyle = '#ffcc00'; c.font = `700 38px ${F}`; c.fillText(`Level ${info.level} · ${getRank(info.level)}`, 80, 356);
    const box = (x, y, w, h, label, val, col) => { rr(c, x, y, w, h, 34); c.fillStyle = 'rgba(255,255,255,.06)'; c.fill(); c.strokeStyle = 'rgba(255,255,255,.12)'; c.lineWidth = 2; c.stroke(); c.fillStyle = '#9a9aa8'; c.font = `500 28px ${F}`; c.fillText(label, x + 36, y + 62); c.fillStyle = col; c.font = `800 92px ${F}`; c.fillText(String(val), x + 36, y + 170); };
    box(80, 420, 450, 220, 'Day streak', streak, '#00ff88'); box(550, 420, 450, 220, 'This week', wp + '%', '#00f0ff');
    box(80, 664, 450, 220, 'Total XP', (Number(appState.totalXp) || 0).toLocaleString('en-US'), '#ffcc00'); box(550, 664, 450, 220, 'Habits ticked', appState.habits.reduce((n, h) => n + Object.values(h.history).filter(v => v === true).length, 0).toLocaleString('en-US'), '#b026ff');
    c.fillStyle = '#9a9aa8'; c.font = `500 28px ${F}`; c.fillText('Last 28 days', 80, 950);
    const days = lastDays(28), cs = 112, gp = 14;
    days.forEach((d, i) => {
        const col = i % 7, row = Math.floor(i / 7), s = dayStat(d);
        const a = s.rest || !s.sched ? 0.08 : s.pct >= 100 ? 1 : s.pct >= 70 ? .75 : s.pct >= 40 ? .5 : s.pct > 0 ? .3 : .08;
        rr(c, 80 + col * (cs + gp), 975 + row * (62 + 10), cs, 62, 16); c.fillStyle = a <= .08 ? 'rgba(255,255,255,.07)' : `rgba(0,255,136,${a})`; c.fill();
    });
    c.fillStyle = '#fff'; c.font = `700 36px ${F}`; c.fillText('Small steps. Big changes.', 80, 1290);
    c.fillStyle = '#9a9aa8'; c.font = `500 26px ${F}`; c.textAlign = 'right'; c.fillText(new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }), 1000, 1290); c.textAlign = 'left';
}
function cardBlob() { return new Promise(res => { const cv = byId('fxShareCanvas'); if (!cv) return res(null); try { cv.toBlob(b => res(b), 'image/png'); } catch (e) { res(null); } }); }
FX.shareCard = async function () {
    const blob = await cardBlob(), text = shareText();
    try {
        if (blob && navigator.canShare && navigator.canShare({ files: [new File([blob], 'goalforce-progress.png', { type: 'image/png' })] })) { await navigator.share({ files: [new File([blob], 'goalforce-progress.png', { type: 'image/png' })], text }); return; }
        if (navigator.share) { await navigator.share({ text }); return; }
    } catch (e) { if (e && e.name === 'AbortError') return; }
    FX.downloadCard();
};
FX.downloadCard = async function () {
    const blob = await cardBlob(); if (!blob) return notify({ type: 'error', title: 'Could not make the card' });
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `goalforce-progress-${TODAY()}.png`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
};
FX.copyShareText = async function () { try { await navigator.clipboard.writeText(shareText()); notify({ type: 'success', title: 'Copied' }); } catch (e) { notify({ type: 'error', title: 'Could not copy', message: shareText(), duration: 8000 }); } };

/* ================= Social: Share, Challenges, Leaderboard, Community ================= */
FX.st = { tab: 'share', lb: 'week', msg: '', rows: null, posts: null, standings: {}, busy: false };
const cloudOk = () => { try { return !!(CLOUD_ON && cloud && cloud.session && cloud.session.user && cloud.session.user.id); } catch (e) { return false; } };
const NAME_RE = /^[A-Za-z0-9][A-Za-z0-9 ._-]{1,23}$/;
const socialOn = () => { const s = S().social; return cloudOk() && !!s.optIn && NAME_RE.test(String(s.name || '')); };
const setupMsg = 'Social features are not set up yet. The app owner needs to run 3_social_setup.sql in Supabase (see SETUP_GUIDE.md).';
function sbErr(e) { return e && e.status === 404 ? setupMsg : (e && e.offline ? 'No internet connection.' : (e && e.message) || 'Something went wrong.'); }
function weekScore() {
    const days = lastDays(7), f = S();
    return days.reduce((a, d) => a + (ticksOn(d) + tasksDoneOn(d)) * 5 + Object.values(f.bonus[d] || {}).reduce((x, y) => x + y, 0), 0);
}
let pushTimer = null, lastSig = '';
function socialPushSoon() { if (!socialOn() || appState.demo) return; clearTimeout(pushTimer); pushTimer = setTimeout(socialPush, 15000); }
async function socialPush(force) {
    if (!socialOn() || appState.demo) return;
    const s = S().social, lv = getLevelInfo(appState.totalXp).level;
    const row = { user_id: cloud.session.user.id, display_name: s.name, xp: Math.max(0, Math.floor(Number(appState.totalXp) || 0)), level: lv, streak: getCurrentStreak(), week_score: weekScore(), public: true, updated_at: new Date().toISOString() };
    const sig = [row.display_name, row.xp, row.level, row.streak, row.week_score].join('|');
    if (!force && sig === lastSig) return;
    try {
        await cloudFetch('/rest/v1/social_profiles?on_conflict=user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: row });
        lastSig = sig;
        const mine = S().challenges.filter(c => c && c.id);
        for (const c of mine) await cloudFetch('/rest/v1/social_challenge_members?on_conflict=code,user_id', { method: 'POST', headers: { Prefer: 'resolution=merge-duplicates,return=minimal' }, body: { code: c.id, user_id: row.user_id, display_name: s.name, score: chScore(c).score, updated_at: row.updated_at } });
    } catch (e) { if (force) FX.st.msg = sbErr(e); }
}
FX.sTab = function (t) { FX.st.tab = t; FX.st.msg = ''; renderSocial(); if (t === 'leaderboard') loadLeaderboard(); };
FX.saveOptIn = async function () {
    const name = String(byId('fxSName').value || '').trim(), on = byId('fxSOpt').checked, s = S().social;
    if (on && !cloudOk()) { FX.st.msg = 'Log in to your account first (Settings > Account).'; return renderSocial(); }
    if (on && !NAME_RE.test(name)) { FX.st.msg = 'Display name: 2-24 letters, numbers, spaces, dot, dash or underscore.'; return renderSocial(); }
    s.name = on ? name : (s.name || ''); s.optIn = on; saveData();
    FX.st.msg = '';
    if (on) { await socialPush(true); FX.st.msg = FX.st.msg || 'Saved. You are visible on the leaderboard and community.'; }
    else if (cloudOk()) { try { await cloudFetch('/rest/v1/social_profiles?user_id=eq.' + encodeURIComponent(cloud.session.user.id), { method: 'DELETE' }); FX.st.msg = 'You are hidden. Your public profile was removed.'; } catch (e) { FX.st.msg = sbErr(e); } }
    renderSocial(); if (FX.st.tab === 'leaderboard') loadLeaderboard();
};
FX.deletePublic = function () {
    if (!cloudOk()) return;
    confirmDo('Delete your public profile, posts and challenge scores from the cloud?', async () => {
        const u = encodeURIComponent(cloud.session.user.id);
        try { for (const t of ['social_posts', 'social_challenge_members']) await cloudFetch(`/rest/v1/${t}?user_id=eq.${u}`, { method: 'DELETE' }); await cloudFetch(`/rest/v1/social_friends?or=(requester.eq.${u},addressee.eq.${u})`, { method: 'DELETE' }); await cloudFetch(`/rest/v1/social_profiles?user_id=eq.${u}`, { method: 'DELETE' }); const s = S().social; s.optIn = false; lastSig = ''; saveData(); FX.st.msg = 'All your public social data was deleted.'; }
        catch (e) { FX.st.msg = sbErr(e); }
        renderSocial();
    }, 'Delete');
};
function optInPanel() {
    const s = S().social, ok = cloudOk();
    return `<div class="fx-sec"><h3 class="fx-h3">Your public profile <span class="fx-muted" style="font-weight:400;">(optional, off by default)</span></h3>
        ${ok ? '' : '<div class="fx-note" style="margin:0 0 10px;">Log in with an account to use leaderboard, community and friend challenges.</div>'}
        <div class="fx-form"><div class="input-group"><label>Display name (not your email)</label><input type="text" id="fxSName" maxlength="24" value="${E(s.name || '')}" placeholder="e.g. Aman_01"></div></div>
        <label class="setting-desc" style="display:flex;gap:8px;align-items:center;margin-bottom:12px;cursor:pointer;"><input type="checkbox" id="fxSOpt" ${s.optIn ? 'checked' : ''}> Show my name, level, streak and XP to other members</label>
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-primary" onclick="FX.saveOptIn()">Save</button>${ok && s.optIn ? '<button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="FX.deletePublic()">Delete my public data</button>' : ''}</div></div>`;
}

/* ----- challenges (invite code works without any server) ----- */
const b64e = o => btoa(unescape(encodeURIComponent(JSON.stringify(o)))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
function b64d(s) { s = String(s).trim().replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; return JSON.parse(decodeURIComponent(escape(atob(s)))); }
function parseChallenge(raw) {
    try {
        let code = String(raw || '').trim();
        const m = code.match(/[?&]challenge=([^&#\s]+)/); if (m) code = decodeURIComponent(m[1]);
        const o = b64d(code);
        if (!o || !/^[a-z0-9]{4,12}$/.test(o.i || '') || ![7, 14, 21, 30].includes(Number(o.d)) || !/^\d{4}-\d{2}-\d{2}$/.test(o.s || '') || !['active', 'strong'].includes(o.m)) return null;
        return { id: o.i, title: String(o.t || 'Challenge').slice(0, 40), days: Number(o.d), start: o.s, metric: o.m, by: String(o.b || '').slice(0, 24), code };
    } catch (e) { return null; }
}
function chScore(c) {
    const today = TODAY(), dots = []; let score = 0;
    for (let i = 0; i < c.days; i++) {
        const d = dateAdd(c.start, i);
        if (d > today) { dots.push('f'); continue; }
        let ok;
        if (isRestDay(d)) ok = true;
        else if (c.metric === 'active') ok = ticksOn(d) >= 1;
        else { const s = dayStat(d); ok = s.sched > 0 && s.pct >= 80; }
        if (ok) score++;
        dots.push(d === today && !ok ? 'n' : ok ? 'ok' : 'miss');
    }
    return { score, dots };
}
const chLink = c => location.origin + location.pathname + '?challenge=' + c.code;
FX.chCreate = function () {
    const title = String(byId('fxCTitle').value || '').trim().slice(0, 40) || 'Habit challenge', days = Number(byId('fxCDays').value), metric = byId('fxCMetric').value;
    const id = Math.random().toString(36).slice(2, 8), start = TODAY(), by = viewerName().slice(0, 24);
    const code = b64e({ i: id, t: title, d: days, s: start, m: metric, b: by });
    S().challenges.push({ id, title, days, start, metric, by, code, mine: true }); saveData();
    FX.st.msg = 'Challenge created. Send the invite link to your friends.'; renderSocial(); socialPushSoon();
};
FX.chJoin = function (raw) {
    const c = parseChallenge(raw != null ? raw : byId('fxCCode').value);
    if (!c) { FX.st.msg = 'That invite code is not valid.'; return renderSocial(); }
    if (S().challenges.some(x => x.id === c.id)) { FX.st.msg = 'You already joined this challenge.'; return renderSocial(); }
    S().challenges.push({ id: c.id, title: c.title, days: c.days, start: c.start, metric: c.metric, by: c.by, code: c.code }); saveData();
    FX.st.msg = `Joined "${c.title}". Good luck!`; renderSocial(); socialPushSoon();
};
FX.chLeave = function (id) {
    confirmDo('Leave this challenge?', async () => {
        const f = S(); f.challenges = f.challenges.filter(c => c.id !== id); saveData();
        if (cloudOk()) { try { await cloudFetch(`/rest/v1/social_challenge_members?code=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(cloud.session.user.id)}`, { method: 'DELETE' }); } catch (e) {} }
        renderSocial();
    }, 'Leave');
};
FX.chShare = async function (id) {
    const c = S().challenges.find(x => x.id === id); if (!c) return;
    const text = `Join my "${c.title}" challenge on GoalForce (${c.days} days): ${chLink(c)}`;
    try { if (navigator.share) { await navigator.share({ title: 'GoalForce challenge', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); notify({ type: 'success', title: 'Invite link copied' }); } catch (e) { notify({ type: 'info', title: 'Copy this invite', message: text, duration: 12000 }); }
};
FX.chStandings = async function (id) {
    if (!socialOn()) { FX.st.msg = 'Turn on your public profile (above) to compare scores with friends.'; return renderSocial(); }
    try { await socialPush(true); FX.st.standings[id] = await cloudFetch(`/rest/v1/social_challenge_members?code=eq.${encodeURIComponent(id)}&select=display_name,score,user_id&order=score.desc&limit=30`); }
    catch (e) { FX.st.msg = sbErr(e); }
    renderSocial();
};
function challengesHtml() {
    const list = S().challenges, today = TODAY();
    const cards = list.map(c => {
        const sc = chScore(c), left = Math.max(0, daysBetween(today, dateAdd(c.start, c.days - 1)) + 1), st = FX.st.standings[c.id];
        return `<div class="fx-row" style="display:block;"><div style="display:flex;gap:10px;align-items:center;"><div class="grow"><div class="t">${E(c.title)}</div><div class="s">${c.days} days &middot; ${c.metric === 'active' ? 'at least 1 habit a day' : '80% of habits a day'}${c.by ? ' &middot; by ' + E(c.by) : ''} &middot; ${left ? left + ' day(s) left' : 'finished'}</div></div><div class="fx-xp">${sc.score}/${c.days}</div></div>
            <div class="fx-dots">${sc.dots.map(x => `<i class="${x === 'ok' ? 'ok' : x === 'miss' ? 'miss' : x === 'n' ? 'now' : ''}"></i>`).join('')}</div>
            ${st ? `<div style="margin-top:10px;">${st.length ? st.map((r, i) => `<div class="fx-lb-row ${cloudOk() && r.user_id === cloud.session.user.id ? 'me' : ''}"><div class="rk">${i + 1}</div><div class="nm">${E(r.display_name)}</div><div class="sc">${Number(r.score) || 0}/${c.days}</div></div>`).join('') : '<div class="fx-muted">No one has synced a score yet.</div>'}</div>` : ''}
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin-top:10px;"><span class="quick-chip" style="margin:0" onclick="FX.chShare('${c.id}')">Invite friends</span><span class="quick-chip" style="margin:0" onclick="FX.chStandings('${c.id}')">${st ? 'Refresh' : 'Friends'} scores</span><span class="quick-chip" style="margin:0;color:var(--neon-red);border-color:var(--neon-red);" onclick="FX.chLeave('${c.id}')">Leave</span></div></div>`;
    }).join('');
    return `<div class="fx-sec"><h3 class="fx-h3">Challenge friends</h3><div class="fx-note" style="margin:0 0 12px;">Create a challenge and send the invite link. Everyone keeps their own habits; the score is how many days you hit the target. Friend scores show up when members turn on their public profile.</div>
        <div class="fx-form"><div class="input-group"><label>Challenge name</label><input type="text" id="fxCTitle" maxlength="40" placeholder="e.g. 21-day glow up"></div>
        <div class="input-group"><label>Length</label><select id="fxCDays"><option value="7">7 days</option><option value="14">14 days</option><option value="21">21 days</option><option value="30">30 days</option></select></div>
        <div class="input-group"><label>A good day is</label><select id="fxCMetric"><option value="active">At least 1 habit</option><option value="strong">80% of habits</option></select></div></div>
        <button class="btn-primary" onclick="FX.chCreate()">Create challenge</button>
        <div class="fx-form" style="margin-top:18px;"><div class="input-group"><label>Got an invite? Paste link or code</label><input type="text" id="fxCCode" placeholder="Paste here"></div></div><button class="btn-primary" onclick="FX.chJoin()">Join</button></div>
        <div class="fx-sec"><h3 class="fx-h3">Your challenges</h3>${cards || '<div class="fx-empty">No challenges yet.</div>'}</div>`;
}

/* ----- leaderboard ----- */
async function loadLeaderboard() {
    const st = FX.st; st.rows = null; renderSocial();
    if (!cloudOk()) return;
    try { st.rows = await cloudFetch(`/rest/v1/social_profiles?public=eq.true&select=user_id,display_name,xp,level,streak,week_score&order=${st.lb === 'week' ? 'week_score' : 'xp'}.desc&limit=20`); }
    catch (e) { st.msg = sbErr(e); st.rows = []; }
    renderSocial();
}
FX.lbMode = m => { FX.st.lb = m; loadLeaderboard(); };
function leaderboardHtml() {
    const st = FX.st, me = cloudOk() ? cloud.session.user.id : '';
    let body;
    if (!cloudOk()) body = '<div class="fx-empty">Log in to see the leaderboard.</div>';
    else if (st.rows === null) body = '<div class="fx-empty">Loading...</div>';
    else body = st.rows.length ? st.rows.map((r, i) => `<div class="fx-lb-row ${r.user_id === me ? 'me' : ''}"><div class="rk">${i + 1}</div><div class="nm">${E(r.display_name)}<div class="fx-muted" style="font-size:11px;font-weight:400;">Level ${Number(r.level) || 1} &middot; ${Number(r.streak) || 0}-day streak</div></div><div class="sc">${st.lb === 'week' ? (Number(r.week_score) || 0) + ' pts' : (Number(r.xp) || 0).toLocaleString('en-US') + ' XP'}</div></div>`).join('') : '<div class="fx-empty">No one is on the leaderboard yet. Be the first!</div>';
    return `<div class="fx-sec"><h3 class="fx-h3">Leaderboard</h3><div class="task-tabs" style="margin-bottom:12px;"><button class="tab-btn ${st.lb === 'week' ? 'active' : ''}" onclick="FX.lbMode('week')">This week</button><button class="tab-btn ${st.lb === 'xp' ? 'active' : ''}" onclick="FX.lbMode('xp')">All-time XP</button></div>${body}
        <div class="fx-note">Weekly points = habits and tasks done in the last 7 days (5 each) plus Reality XP. Only members who turned on their public profile appear.</div></div>${optInPanel()}`;
}

function renderSocial() {
    const box = byId('fx-social-body'); if (!box) return;
    const st = FX.st, tabs = [['share', 'Share'], ['challenges', 'Challenges'], ['leaderboard', 'Leaderboard']];
    let inner = '';
    if (st.tab === 'share') inner = `<div class="fx-sec"><h3 class="fx-h3">Share your progress</h3><div class="fx-card-wrap"><canvas id="fxShareCanvas"></canvas><div style="flex:1;min-width:220px;"><div class="fx-note" style="margin:0 0 14px;">A picture of your level, streak and the last 28 days. Nothing private is on it, just your name and numbers.</div><div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-primary" onclick="FX.shareCard()">Share</button><button class="btn-primary" onclick="FX.downloadCard()">Download image</button><button class="btn-primary" onclick="FX.copyShareText()">Copy text</button></div></div></div></div>`;
    else if (st.tab === 'challenges') inner = challengesHtml() + optInPanel();
    else if (st.tab === 'leaderboard') inner = leaderboardHtml();
    box.innerHTML = `<section class="panel"><div class="task-tabs" style="margin-bottom:16px;">${tabs.map(([k, l]) => `<button class="tab-btn ${st.tab === k ? 'active' : ''}" onclick="FX.sTab('${k}')">${l}</button>`).join('')}</div>${st.msg ? `<div class="bd-banner warn" style="margin-bottom:14px;"><div class="bd-banner-text">${E(st.msg)}</div></div>` : ''}${inner}</section>`;
    try { renderCommunity(); } catch (e) {}
    if (st.tab === 'share') { const cv = byId('fxShareCanvas'); if (cv) { try { drawShareCard(cv); } catch (e) { logFx('card', e); } } }
}
FX.pages.social = function () { FX.st.msg = ''; renderSocial(); if (FX.st.tab === 'leaderboard') loadLeaderboard(); };

// open a challenge invite link (?challenge=CODE) once the person is logged in
function captureInvite() {
    try {
        const m = location.search.match(/[?&]challenge=([^&#\s]+)/);
        if (m) { localStorage.setItem('fxPendingChallenge', decodeURIComponent(m[1])); history.replaceState(null, '', location.pathname + location.hash); }
    } catch (e) {}
    let tries = 0;
    const t = setInterval(() => {
        tries++; let raw = null; try { raw = localStorage.getItem('fxPendingChallenge'); } catch (e) {}
        if (!raw || tries > 120) return clearInterval(t);
        if (typeof isUserAuthenticated === 'function' && !isUserAuthenticated()) return;
        clearInterval(t);
        try { localStorage.removeItem('fxPendingChallenge'); } catch (e) {}
        const c = parseChallenge(raw); if (!c || S().challenges.some(x => x.id === c.id)) return;
        confirmDo(`Join the "${c.title}" challenge (${c.days} days)${c.by ? ' from ' + c.by : ''}?`, () => { FX.st.tab = 'challenges'; FX.chJoin(raw); FX.go('social'); }, 'Join');
    }, 1500);
}

/* ================= Community page: post text + photo, like, report ================= */
FX.cm = { posts: null, likes: {}, mine: {}, photo: '', busy: false, reported: {} };
const JPG_RE = /^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/;
async function loadPosts() {
    const cm = FX.cm; cm.posts = null; renderCommunity();
    if (!cloudOk()) return;
    try {
        cm.posts = await cloudFetch('/rest/v1/social_posts?select=id,user_id,display_name,body,image,created_at&order=created_at.desc&limit=30');
        cm.likes = {}; cm.mine = {};
        if (cm.posts.length) {
            const ids = cm.posts.map(p => p.id).filter(i => /^[0-9a-f-]{36}$/i.test(i));
            const ls = await cloudFetch(`/rest/v1/social_likes?post_id=in.(${ids.join(',')})&select=post_id,user_id&limit=2000`).catch(() => []);
            (ls || []).forEach(l => { cm.likes[l.post_id] = (cm.likes[l.post_id] || 0) + 1; if (l.user_id === cloud.session.user.id) cm.mine[l.post_id] = true; });
        }
    } catch (e) { FX.st.msg = sbErr(e); cm.posts = []; }
    renderCommunity();
}
function renderCommunity() {
    const box = byId('fx-community-body'); if (!box) return;
    const cm = FX.cm, me = cloudOk() ? cloud.session.user.id : '', canPost = socialOn();
    let list;
    if (!cloudOk()) list = '<div class="fx-empty">Log in with your account to read and share posts.</div>';
    else if (cm.posts === null) list = '<div class="fx-empty">Loading...</div>';
    else list = cm.posts.length ? cm.posts.map(p => {
        const liked = !!cm.mine[p.id], n = cm.likes[p.id] || 0;
        return `<div class="fx-post"><div class="h"><b>${E(p.display_name)}</b><span>${E(ago(p.created_at))}</span></div>
            ${p.body ? `<div class="b">${E(p.body)}</div>` : ''}${p.image && JPG_RE.test(p.image) ? `<img class="fx-post-img" alt="Post photo" src="${p.image}">` : ''}
            <div class="fx-post-bar"><button class="fx-like ${liked ? 'on' : ''}" onclick="FX.cmLike('${E(p.id)}')">${liked ? '♥' : '♡'} ${n}</button>
            ${p.user_id === me ? `<a href="#" class="fx-post-act" style="color:var(--neon-red)" onclick="FX.cmDelete('${E(p.id)}');return false;">Delete</a>` : `<a href="#" class="fx-post-act" onclick="FX.cmReport('${E(p.id)}');return false;">Report</a>`}</div></div>`;
    }).join('') : '<div class="fx-empty">No posts yet. Be the first to share something!</div>';
    const wins = [`Hit a ${getCurrentStreak()}-day streak!`, `Reached Level ${getLevelInfo(appState.totalXp).level}!`, 'Finished all my habits today!'];
    box.innerHTML = `<section class="panel">
        ${FX.st.msg ? `<div class="bd-banner warn" style="margin-bottom:14px;"><div class="bd-banner-text">${E(FX.st.msg)}</div></div>` : ''}
        <h2 class="panel-title" style="margin-bottom:10px;">Create a post</h2>
        ${canPost ? '' : '<div class="fx-note" style="margin:0 0 10px;">To post, log in and turn on your public profile (below). Your email is never shown, only the display name you choose.</div>'}
        <div class="input-group"><textarea id="fxPost" rows="3" maxlength="200" placeholder="Share a win, a tip or a photo (max 200 characters)" ${canPost ? '' : 'disabled'}></textarea></div>
        ${cm.photo ? `<div class="fx-photo-prev"><img src="${cm.photo}" alt="Selected photo"><span class="quick-chip" onclick="FX.cmClearPhoto()">Remove photo</span></div>` : ''}
        <div class="fx-chips" style="margin-bottom:12px;">${wins.map(w => `<span class="quick-chip" onclick="FX.quickWin('${E(w)}')">${E(w)}</span>`).join('')}</div>
        <input type="file" id="fxPhotoFile" accept="image/*" style="display:none" onchange="FX.cmPhoto(this)">
        <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-primary" onclick="FX.cmPost()" ${canPost && !cm.busy ? '' : 'disabled'}>${cm.busy ? 'Posting...' : 'Post'}</button><button class="btn-primary" ${canPost ? '' : 'disabled'} onclick="byId('fxPhotoFile').click()">${cm.photo ? 'Change photo' : 'Add photo'}</button><button class="btn-primary" style="background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.pages.community()">Refresh</button></div>
        <div class="fx-note">Posts are public to all signed-in members. Be kind, no personal details, and only share photos you are happy for others to see. You can delete your own posts any time.</div></section>
        <section class="panel"><h2 class="panel-title" style="margin-bottom:12px;">Community feed</h2>${list}</section>
        <section class="panel">${optInPanel()}</section>`;
}
FX.quickWin = function (t) { const i = byId('fxPost'); if (i && !i.disabled) i.value = t; };
function ago(iso) { const s = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000); return s < 60 ? 'just now' : s < 3600 ? Math.floor(s / 60) + ' min ago' : s < 86400 ? Math.floor(s / 3600) + ' h ago' : Math.floor(s / 86400) + ' d ago'; }
FX.cmPhoto = function (inp) {
    const f = inp.files && inp.files[0]; inp.value = ''; if (!f) return;
    if (!/^image\//.test(f.type)) { FX.st.msg = 'Please choose an image file.'; return renderCommunity(); }
    if (f.size > 15 * 1024 * 1024) { FX.st.msg = 'That image is too large (max 15 MB).'; return renderCommunity(); }
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
        try {
            const k = Math.min(1, 800 / Math.max(img.width, img.height)), w = Math.max(1, Math.round(img.width * k)), h = Math.max(1, Math.round(img.height * k));
            const cv = document.createElement('canvas'); cv.width = w; cv.height = h; const c = cv.getContext('2d'); c.fillStyle = '#fff'; c.fillRect(0, 0, w, h); c.drawImage(img, 0, 0, w, h);
            let out = '', q1 = 0.75; while (q1 >= 0.35) { out = cv.toDataURL('image/jpeg', q1); if (out.length < 110000) break; q1 -= 0.1; }
            if (!JPG_RE.test(out) || out.length >= 110000) throw new Error('too big');
            FX.cm.photo = out; FX.st.msg = '';
        } catch (e) { FX.st.msg = 'Could not use that photo. Try a smaller one.'; }
        URL.revokeObjectURL(url); const t = (byId('fxPost') || {}).value; renderCommunity(); if (t && byId('fxPost')) byId('fxPost').value = t;
    };
    img.onerror = () => { URL.revokeObjectURL(url); FX.st.msg = 'Could not read that image.'; renderCommunity(); };
    img.src = url;
};
FX.cmClearPhoto = function () { const t = (byId('fxPost') || {}).value; FX.cm.photo = ''; renderCommunity(); if (t && byId('fxPost')) byId('fxPost').value = t; };
let lastPostAt = 0;
FX.cmPost = async function () {
    const cm = FX.cm, body = String((byId('fxPost') || {}).value || '').trim().slice(0, 200);
    if (!socialOn()) { FX.st.msg = 'Turn on your public profile first (below).'; return renderCommunity(); }
    if (!body && !cm.photo) { FX.st.msg = 'Write something or add a photo.'; return renderCommunity(); }
    if (Date.now() - lastPostAt < 20000) { FX.st.msg = 'Please wait a few seconds between posts.'; return renderCommunity(); }
    cm.busy = true; renderCommunity();
    try {
        const row = { user_id: cloud.session.user.id, display_name: S().social.name, body }; if (cm.photo) row.image = cm.photo;
        await cloudFetch('/rest/v1/social_posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: row });
        lastPostAt = Date.now(); cm.photo = ''; FX.st.msg = 'Posted!';
    } catch (e) { FX.st.msg = sbErr(e); }
    cm.busy = false; await loadPosts();
};
FX.cmDelete = function (id) { confirmDo('Delete your post?', async () => { try { await cloudFetch('/rest/v1/social_posts?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); FX.st.msg = 'Post deleted.'; } catch (e) { FX.st.msg = sbErr(e); } loadPosts(); }, 'Delete'); };
FX.cmLike = async function (id) {
    if (!cloudOk()) return;
    const cm = FX.cm, u = cloud.session.user.id, was = !!cm.mine[id];
    cm.mine[id] = !was; cm.likes[id] = Math.max(0, (cm.likes[id] || 0) + (was ? -1 : 1)); renderCommunity();
    try {
        if (was) await cloudFetch(`/rest/v1/social_likes?post_id=eq.${encodeURIComponent(id)}&user_id=eq.${encodeURIComponent(u)}`, { method: 'DELETE' });
        else await cloudFetch('/rest/v1/social_likes', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { post_id: id, user_id: u } });
    } catch (e) { cm.mine[id] = was; cm.likes[id] = Math.max(0, (cm.likes[id] || 0) + (was ? 1 : -1)); FX.st.msg = sbErr(e); renderCommunity(); }
};
FX.cmReport = function (id) {
    if (FX.cm.reported[id]) { FX.st.msg = 'You already reported this post. Thank you.'; return renderCommunity(); }
    confirmDo('Report this post as inappropriate? The app owner will review it.', async () => {
        try { await cloudFetch('/rest/v1/social_reports', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { post_id: id, user_id: cloud.session.user.id, reason: 'reported' } }); FX.cm.reported[id] = true; FX.st.msg = 'Thanks. The post was reported for review.'; }
        catch (e) { if (e && e.status === 409) { FX.cm.reported[id] = true; FX.st.msg = 'You already reported this post.'; } else FX.st.msg = sbErr(e); }
        renderCommunity();
    }, 'Report');
};
FX.pages.community = function () { FX.st.msg = ''; loadPosts(); };

/* ================= Friends: requests + friends-only leaderboard (competition) ================= */
FX.fr = { loaded: false, rels: [], profs: {}, metric: 'week', results: null, msg: '', busy: false };
const UUID_RE = /^[0-9a-f-]{36}$/i;
const frMe = () => cloud.session.user.id;
let frNotified = false;
function frSets() {
    const fr = FX.fr, me = cloudOk() ? frMe() : '';
    const friends = fr.rels.filter(r => r.status === 'accepted'), incoming = fr.rels.filter(r => r.status === 'pending' && r.addressee === me), outgoing = fr.rels.filter(r => r.status === 'pending' && r.requester === me);
    return { me, friends, incoming, outgoing, other: r => (r.requester === me ? r.addressee : r.requester) };
}
const frName = id => (FX.fr.profs[id] && FX.fr.profs[id].display_name) || 'Member';
function setFriendsBadge(n) {
    qa('[data-fxnav="friends"], [data-fxmore="friends"]').forEach(el => { const o = q('.fx-badge', el); if (o) o.remove(); if (n > 0) { const b = document.createElement('span'); b.className = 'fx-badge'; b.textContent = String(n); el.appendChild(b); } });
}
async function loadFriends() {
    const fr = FX.fr;
    if (!cloudOk()) { fr.loaded = true; fr.msg = ''; renderFriends(); return; }
    try {
        if (socialOn()) await socialPush(true);
        fr.rels = (await cloudFetch('/rest/v1/social_friends?select=id,requester,addressee,status,created_at&order=created_at.desc&limit=200')) || [];
        const me = frMe(), ids = new Set([me]); fr.rels.forEach(r => { ids.add(r.requester); ids.add(r.addressee); });
        const list = Array.from(ids).filter(i => UUID_RE.test(i));
        const ps = (await cloudFetch(`/rest/v1/social_profiles?user_id=in.(${list.join(',')})&select=user_id,display_name,xp,level,streak,week_score&limit=500`)) || [];
        fr.profs = {}; ps.forEach(p => { fr.profs[p.user_id] = p; });
        setFriendsBadge(frSets().incoming.length);
    } catch (e) { fr.msg = sbErr(e); fr.rels = []; }
    fr.loaded = true; renderFriends();
}
async function checkFriendBadge() {
    if (!socialOn()) return setFriendsBadge(0);
    try {
        const r = (await cloudFetch(`/rest/v1/social_friends?addressee=eq.${encodeURIComponent(frMe())}&status=eq.pending&select=id&limit=50`)) || [];
        setFriendsBadge(r.length);
        if (r.length && !frNotified) { frNotified = true; notify({ type: 'info', title: `${r.length} friend request${r.length > 1 ? 's' : ''}`, message: 'Open Friends to accept.' }); }
    } catch (e) {}
}
function frMetric(p, isMe) {
    const m = FX.fr.metric;
    if (m === 'week') return isMe ? weekScore() : (Number(p.week_score) || 0);
    if (m === 'xp') return isMe ? (Number(appState.totalXp) || 0) : (Number(p.xp) || 0);
    return isMe ? getCurrentStreak() : (Number(p.streak) || 0);
}
const frUnit = () => ({ week: 'pts', xp: 'XP', streak: 'days' })[FX.fr.metric];
const frFmt = v => `${v.toLocaleString('en-US')} ${frUnit()}`;
function frBoardHtml(S_) {
    const fr = FX.fr, rows = [];
    rows.push({ id: S_.me, name: viewerName(), v: frMetric({}, true), me: true, lv: getLevelInfo(appState.totalXp).level, st: getCurrentStreak() });
    S_.friends.forEach(r => { const id = S_.other(r), p = fr.profs[id]; if (p) rows.push({ id, name: p.display_name, v: frMetric(p, false), me: false, lv: Number(p.level) || 1, st: Number(p.streak) || 0 }); });
    rows.sort((a, b) => b.v - a.v || (a.me ? -1 : 1));
    const rank = rows.findIndex(r => r.me) + 1, lead = rows[0];
    let msg = '';
    if (rows.length < 2) msg = 'Add a friend to start competing.';
    else if (rank === 1) { const gap = rows[0].v - rows[1].v; msg = gap > 0 ? `You are leading! ${frFmt(gap)} ahead of ${rows[1].name}.` : `You are tied for the lead with ${rows[1].name}.`; }
    else msg = `You are #${rank}. ${frFmt(lead.v - rows[rank - 1].v)} behind ${lead.name}.`;
    const tabs = [['week', 'This week'], ['xp', 'All-time XP'], ['streak', 'Streak']];
    return `<section class="panel"><h2 class="panel-title" style="margin-bottom:10px;">Friends leaderboard</h2>
        <div class="task-tabs" style="margin-bottom:12px;">${tabs.map(([k, l]) => `<button class="tab-btn ${fr.metric === k ? 'active' : ''}" onclick="FX.frMetric('${k}')">${l}</button>`).join('')}</div>
        <div class="fx-lead-msg">${E(msg)}</div>
        ${rows.map((r, i) => `<div class="fx-lb-row ${r.me ? 'me' : ''}"><div class="rk">${i + 1}</div><div class="nm">${E(r.name)}${r.me ? ' (you)' : ''}${i === 0 && rows.length > 1 ? ' <span class="fx-leader">Leader</span>' : ''}<div class="fx-muted" style="font-size:11px;font-weight:400;">Level ${r.lv} &middot; ${r.st}-day streak</div></div><div class="sc">${frFmt(r.v)}</div></div>`).join('')}
        <div class="fx-note">Weekly points = habits and tasks done in the last 7 days (5 each) plus Reality XP. Scores update when each friend opens the app.</div></section>`;
}
function renderFriends() {
    const box = byId('fx-friends-body'); if (!box) return;
    const fr = FX.fr, S_ = frSets(), ok = cloudOk(), on = socialOn();
    if (!ok) { box.innerHTML = `<section class="panel"><div class="fx-empty">Log in with your account to add friends and compete.</div></section>`; return; }
    const banner = fr.msg ? `<div class="bd-banner warn" style="margin-bottom:14px;"><div class="bd-banner-text">${E(fr.msg)}</div></div>` : '';
    if (!on) { box.innerHTML = `<section class="panel">${banner}<h2 class="panel-title" style="margin-bottom:8px;">Turn on your public profile</h2><div class="fx-note" style="margin:0 0 12px;">Friends find you by your display name, and your level, streak and points are shown to your friends. Your email is never shown. You can turn it off any time.</div></section><section class="panel">${optInPanel()}</section>`; return; }
    const relOf = id => S_ && fr.rels.find(r => r.requester === id || r.addressee === id);
    const results = fr.results === null ? '' : (fr.results.length ? fr.results.map(r => { const rel = relOf(r.user_id); const st = !rel ? `<button class="btn-primary" style="padding:6px 12px;font-size:12px;" onclick="FX.frAdd('${E(r.user_id)}')">Add friend</button>` : rel.status === 'accepted' ? '<span class="fx-xp">Friends</span>' : rel.addressee === S_.me ? `<button class="btn-primary" style="padding:6px 12px;font-size:12px;" onclick="FX.frAccept('${E(rel.id)}')">Accept</button>` : '<span class="fx-muted">Request sent</span>'; return `<div class="fx-row"><div class="grow"><div class="t">${E(r.display_name)}</div><div class="s">Level ${Number(r.level) || 1} &middot; ${Number(r.streak) || 0}-day streak</div></div>${st}</div>`; }).join('') : '<div class="fx-empty">No one found with that name.</div>');
    const reqHtml = (S_.incoming.length || S_.outgoing.length) ? `<section class="panel"><h2 class="panel-title" style="margin-bottom:10px;">Requests</h2>
        ${S_.incoming.map(r => `<div class="fx-row"><div class="grow"><div class="t">${E(frName(r.requester))}</div><div class="s">wants to be your friend</div></div><button class="btn-primary" style="padding:6px 12px;font-size:12px;" onclick="FX.frAccept('${E(r.id)}')">Accept</button><button class="btn-primary" style="padding:6px 12px;font-size:12px;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.frRemove('${E(r.id)}',true)">Decline</button></div>`).join('')}
        ${S_.outgoing.map(r => `<div class="fx-row"><div class="grow"><div class="t">${E(frName(r.addressee))}</div><div class="s">request sent, waiting</div></div><button class="btn-primary" style="padding:6px 12px;font-size:12px;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.frRemove('${E(r.id)}',true)">Cancel</button></div>`).join('')}</section>` : '';
    const friendsHtml = S_.friends.length ? S_.friends.map(r => { const id = S_.other(r), p = fr.profs[id]; return `<div class="fx-row"><div class="grow"><div class="t">${E(frName(id))}</div><div class="s">${p ? `Level ${Number(p.level) || 1} &middot; ${Number(p.streak) || 0}-day streak` : 'Profile hidden'}</div></div><span class="quick-chip" style="margin:0;color:var(--neon-red);border-color:var(--neon-red);" onclick="FX.frRemove('${E(r.id)}',false)">Remove</span></div>`; }).join('') : '<div class="fx-empty">No friends yet. Search by name below or invite someone.</div>';
    box.innerHTML = `${banner}${frBoardHtml(S_)}${reqHtml}
        <section class="panel"><h2 class="panel-title" style="margin-bottom:10px;">Find friends</h2>
        <div class="fx-form" style="grid-template-columns:1fr auto;"><div class="input-group"><label>Search by display name</label><input type="text" id="fxFrQ" maxlength="24" placeholder="e.g. Riya" onkeydown="if(event.key==='Enter')FX.frSearch()"></div><button class="btn-primary" style="height:42px;" onclick="FX.frSearch()">Search</button></div>
        ${results}<div style="margin-top:12px;"><span class="quick-chip" onclick="FX.frInvite()">Invite someone who is not on GoalForce</span></div></section>
        <section class="panel"><h2 class="panel-title" style="margin-bottom:10px;">Your friends (${S_.friends.length})</h2>${friendsHtml}</section>`;
}
FX.frMetric = m => { FX.fr.metric = m; renderFriends(); };
FX.frSearch = async function () {
    const fr = FX.fr, raw = String((byId('fxFrQ') || {}).value || '').trim();
    if (!/^[A-Za-z0-9][A-Za-z0-9 ._-]{1,23}$/.test(raw)) { fr.msg = 'Type at least 2 letters or numbers (letters, numbers, space, dot, dash, underscore).'; fr.results = null; return renderFriends(); }
    fr.msg = '';
    try { const me = frMe(); fr.results = ((await cloudFetch(`/rest/v1/social_profiles?public=eq.true&display_name=ilike.${encodeURIComponent('*' + raw + '*')}&select=user_id,display_name,level,streak&limit=10`)) || []).filter(r => r.user_id !== me); }
    catch (e) { fr.msg = sbErr(e); fr.results = null; }
    renderFriends(); const i = byId('fxFrQ'); if (i) i.value = raw;
};
FX.frAdd = async function (uid) {
    const fr = FX.fr; if (!socialOn() || !UUID_RE.test(uid) || uid === frMe()) return;
    const me = frMe(), ex = fr.rels.find(r => (r.requester === uid && r.addressee === me) || (r.requester === me && r.addressee === uid));
    if (ex) { if (ex.status === 'accepted') fr.msg = 'You are already friends.'; else if (ex.addressee === me) return FX.frAccept(ex.id); else fr.msg = 'Request already sent.'; return renderFriends(); }
    try { await cloudFetch('/rest/v1/social_friends', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: { requester: me, addressee: uid } }); fr.msg = 'Friend request sent!'; }
    catch (e) { fr.msg = e && e.status === 409 ? 'A request already exists between you two.' : sbErr(e); }
    await loadFriends();
};
FX.frAccept = async function (id) {
    if (!/^[0-9a-f-]{36}$/i.test(id)) return;
    try { await cloudFetch('/rest/v1/social_friends?id=eq.' + encodeURIComponent(id), { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: { status: 'accepted' } }); FX.fr.msg = 'You are now friends. Let the competition begin!'; }
    catch (e) { FX.fr.msg = sbErr(e); }
    await loadFriends();
};
FX.frRemove = function (id, isRequest) {
    const run = async () => { try { await cloudFetch('/rest/v1/social_friends?id=eq.' + encodeURIComponent(id), { method: 'DELETE' }); FX.fr.msg = isRequest ? 'Request removed.' : 'Friend removed.'; } catch (e) { FX.fr.msg = sbErr(e); } await loadFriends(); };
    if (isRequest) run(); else confirmDo('Remove this friend? You will stop competing with them.', run, 'Remove');
};
FX.frInvite = async function () {
    const text = `Join me on GoalForce and let's compete on habits! ${location.origin + location.pathname}`;
    try { if (navigator.share) { await navigator.share({ title: 'GoalForce', text }); return; } } catch (e) { if (e && e.name === 'AbortError') return; }
    try { await navigator.clipboard.writeText(text); notify({ type: 'success', title: 'Invite copied' }); } catch (e) { notify({ type: 'info', title: 'Copy this invite', message: text, duration: 12000 }); }
};
FX.pages.friends = function () { FX.fr.msg = ''; FX.fr.results = null; if (!FX.fr.loaded) { renderFriends(); } loadFriends(); };

/* ================= Habit Templates ================= */
const PACKS = [
    { id: 'easy', name: 'Easy Start', desc: 'Three tiny habits. Perfect for a fresh start.', habits: [['Drink a glass of water', 'easy'], ['Make your bed', 'easy'], ['Walk for 5 minutes', 'easy']] },
    { id: 'morning', name: 'Morning Boost', desc: 'Start the day with energy and a plan.', habits: [['Wake up on time', 'normal'], ['Drink water after waking', 'easy'], ['Stretch for 10 minutes', 'easy'], ['Plan your day', 'easy'], ['No phone for the first 30 minutes', 'normal']] },
    { id: 'fitness', name: 'Fitness Basics', desc: 'Move more, eat well, recover.', habits: [['Workout', 'hard'], ['Walk 8,000 steps', 'normal'], ['Protein with every meal', 'normal'], ['Stretch before bed', 'easy'], ['Drink water (glasses)', 'normal', 8]] },
    { id: 'study', name: 'Study & Deep Work', desc: 'Build a steady learning routine.', habits: [['Deep work session (45 min)', 'hard'], ['Review your notes', 'normal'], ['Practice problems or coding', 'normal'], ['Read 10 pages', 'easy'], ["Plan tomorrow's tasks", 'easy']] },
    { id: 'mind', name: 'Calm Mind', desc: 'Less stress, better sleep.', habits: [['Meditate for 5 minutes', 'easy'], ['Write a note about your day', 'easy'], ['Write 3 things you are grateful for', 'easy'], ['Screens off 30 minutes before bed', 'normal'], ['Sleep 8 hours', 'normal']] },
    { id: 'food', name: 'Healthy Eating', desc: 'Simple food habits that stick.', habits: [['Eat a fruit or vegetable', 'easy'], ['No junk food', 'normal'], ['No sugary drinks', 'normal'], ['Cook one meal at home', 'normal']] },
    { id: 'detox', name: 'Digital Detox', desc: 'Take your attention back.', habits: [['Stay under your screen-time limit', 'hard'], ['No social media before noon', 'normal'], ['Phone-free meal', 'easy'], ['One hour fully offline', 'normal']] }
];
function addHabits(items) {
    let n = 0; const have = new Set(appState.habits.map(h => h.name.trim().toLowerCase())); let k = 0;
    items.forEach(([name, effort, target]) => {
        if (have.has(name.trim().toLowerCase())) return;
        have.add(name.trim().toLowerCase());
        appState.habits.push({ id: Date.now().toString() + (k++), name, xp: HABIT_XP, completed: false, history: {}, days: [], target: target || 1, color: '', counts: {}, effort: effort || 'normal' });
        n++;
    });
    if (n) { saveData(); try { renderHabits(); renderCalendar(); updateUI(); renderAnalyticsChart(); } catch (e) {} }
    return n;
}
FX.openTemplates = window.fxOpenTemplates = function () {
    let m = byId('fxTemplates');
    if (!m) {
        m = document.createElement('div'); m.className = 'modal-overlay'; m.id = 'fxTemplates'; m.style.zIndex = '3400';
        m.setAttribute('onclick', 'if (event.target === this) FX.tplClose()');
        m.innerHTML = '<div class="modal-content" style="max-height:90vh;overflow-y:auto;"><h2 style="margin-bottom:4px;">Habit Templates</h2><div class="fx-muted" style="margin-bottom:14px;">Pick a ready-made set. Tap a pack to choose habits. Ones you already have are skipped.</div><div id="fxTplBody"></div><div style="display:flex;gap:10px;margin-top:16px;"><button class="btn-primary" style="flex:1;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.tplClose()">Close</button><button class="btn-primary" style="flex:2;" onclick="FX.tplAdd()">Add selected</button></div></div>';
        document.body.appendChild(m);
    }
    byId('fxTplBody').innerHTML = PACKS.map((p, pi) => `<div class="fx-pack ${pi === 0 ? 'open' : ''}"><div class="hd" onclick="this.parentNode.classList.toggle('open')"><div><b>${E(p.name)}</b><br><span>${E(p.desc)}</span></div><span>${p.habits.length} habits</span></div><div class="items">${p.habits.map((h, i) => `<label><input type="checkbox" data-p="${pi}" data-i="${i}" ${pi === 0 ? 'checked' : ''}> ${E(h[0])}<em>${h[1]}${h[2] ? ' &middot; ' + h[2] + 'x' : ''}</em></label>`).join('')}</div></div>`).join('');
    m.classList.add('show');
};
FX.tplClose = () => { const m = byId('fxTemplates'); if (m) m.classList.remove('show'); };
FX.tplAdd = function () {
    const picked = qa('#fxTplBody input:checked').map(i => PACKS[Number(i.dataset.p)].habits[Number(i.dataset.i)]);
    if (!picked.length) return notify({ type: 'error', title: 'Pick at least one habit' });
    const n = addHabits(picked); FX.tplClose();
    notify({ type: n ? 'success' : 'info', title: n ? `${n} habit${n > 1 ? 's' : ''} added` : 'You already have these habits' });
};

/* ================= Onboarding (3 short steps) ================= */
FX.ob = { step: 0, pack: '' };
const untouchedSamples = () => appState.habits.length === defaultHabits.length && appState.habits.every((h, i) => h.name === defaultHabits[i].name && Object.keys(h.history || {}).length === 0);
function renderOnboarding() {
    const box = q('#welcomeModal .modal-content'); if (!box) return;
    const o = FX.ob, dots = `<div class="fx-ob-dots">${[0, 1, 2].map(i => `<i class="${i === o.step ? 'on' : ''}"></i>`).join('')}</div>`;
    let body;
    if (o.step === 0) body = `<h2 style="margin-bottom:6px;">Welcome to GoalForce</h2><div class="fx-muted">Plan &middot; Track &middot; Grow</div>
        <div class="fx-ob-list"><b>Small steps, big changes.</b><br>Build habits you can actually keep, with no pressure and no clutter.<br><br>Every habit or task gives <b>5 XP</b>. Real progress (perfect days, missions, focus time) earns bonus Reality XP.</div>`;
    else if (o.step === 1) body = `<h2 style="margin-bottom:6px;">What you get</h2><div class="fx-ob-list"><b>Habits &amp; Tasks</b> with days, priorities and due dates<br><b>Smart Today</b> missions that adapt to your energy<br><b>Comeback Mode</b> when you miss a few days<br><b>Water, Notes &amp; Achievements</b> built in<br><b>Progress reports</b>, streaks and personal insights<br><b>Focus Mode</b> to block distractions<br><b>Works offline</b> and syncs when you log in</div>`;
    else body = `<h2 style="margin-bottom:6px;">Pick a starter pack</h2><div class="fx-muted" style="margin-bottom:10px;">You can change everything later in Habits.</div><div style="text-align:left;">${[{ id: '', name: 'Keep the sample habits', desc: '' }].concat(PACKS).map(p => `<label class="fx-pack" style="display:flex;gap:10px;align-items:center;cursor:pointer;padding:10px 12px;"><input type="radio" name="fxObPack" value="${p.id}" ${o.pack === p.id ? 'checked' : ''} onchange="FX.ob.pack=this.value"><span><b style="font-size:14px;">${E(p.name)}</b>${p.desc ? `<br><span class="fx-muted" style="font-size:12px;">${E(p.desc)}</span>` : ''}</span></label>`).join('')}</div>`;
    const nav = o.step < 2
        ? `<div style="display:flex;gap:10px;margin-top:10px;">${o.step ? '<button class="btn-primary" style="flex:1;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.obGo(-1)">Back</button>' : ''}<button class="btn-primary" style="flex:2;padding:12px;" onclick="FX.obGo(1)">Next</button></div>`
        : `<div style="display:flex;gap:10px;margin-top:10px;"><button class="btn-primary" style="flex:1;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.obGo(-1)">Back</button><button class="btn-primary" style="flex:2;padding:12px;" onclick="FX.obFinish(false)">Start</button></div><button class="btn-primary" style="width:100%;padding:10px;margin-top:8px;background:transparent;border-color:var(--text-muted);color:var(--text-muted);" onclick="FX.obFinish(true)">Look around with demo data</button>`;
    box.innerHTML = `<div style="text-align:center;">${body}${dots}${nav}</div>`;
}
FX.obGo = d => { FX.ob.step = clamp(FX.ob.step + d, 0, 2); renderOnboarding(); };
FX.obFinish = function (demo) {
    if (!demo && FX.ob.pack) {
        const p = PACKS.find(x => x.id === FX.ob.pack);
        if (p) { if (untouchedSamples()) { appState.habits = []; } addHabits(p.habits); }
    }
    closeWelcome(!!demo);
};

/* ================= Pattern lock (uses the same hashed lock as the PIN) ================= */
function mountPad(host, onDone) {
    host.innerHTML = '<div class="fx-pad"><svg></svg></div>';
    const pad = q('.fx-pad', host), svg = q('svg', pad), pts = [];
    for (let i = 0; i < 9; i++) { const n = document.createElement('div'); n.className = 'n'; n.dataset.k = String(i + 1); n.style.left = (35 + (i % 3) * 70) + 'px'; n.style.top = (35 + Math.floor(i / 3) * 70) + 'px'; pad.appendChild(n); pts.push([35 + (i % 3) * 70, 35 + Math.floor(i / 3) * 70]); }
    let seq = [], drawing = false, cur = null;
    const paint = () => {
        const p = seq.map(k => pts[k - 1]);
        svg.innerHTML = (p.length > 1 ? `<polyline points="${p.map(a => a.join(',')).join(' ')}"/>` : '') + (drawing && cur && p.length ? `<line x1="${p[p.length - 1][0]}" y1="${p[p.length - 1][1]}" x2="${cur[0]}" y2="${cur[1]}"/>` : '');
        qa('.n', pad).forEach(n => n.classList.toggle('on', seq.includes(Number(n.dataset.k))));
    };
    const pos = e => { const r = pad.getBoundingClientRect(); return [(e.clientX - r.left) * 210 / r.width, (e.clientY - r.top) * 210 / r.height]; };
    const hit = p => { for (let i = 0; i < 9; i++) if (Math.hypot(p[0] - pts[i][0], p[1] - pts[i][1]) < 28 && !seq.includes(i + 1)) return i + 1; return 0; };
    pad.addEventListener('pointerdown', e => { e.preventDefault(); try { pad.setPointerCapture(e.pointerId); } catch (x) {} drawing = true; seq = []; cur = pos(e); const k = hit(cur); if (k) seq.push(k); paint(); });
    pad.addEventListener('pointermove', e => { if (!drawing) return; cur = pos(e); const k = hit(cur); if (k) seq.push(k); paint(); });
    const end = () => { if (!drawing) return; drawing = false; cur = null; const s = seq.join(''); paint(); setTimeout(() => { seq = []; paint(); }, 350); if (s.length) onDone(s); };
    pad.addEventListener('pointerup', end); pad.addEventListener('pointercancel', end);
    return { pad };
}
FX.mountPad = mountPad;
function lockUI() {
    const ov = byId('lockOverlay'); if (!ov) return;
    const mc = q('.modal-content', ov), pat = prefs.lockType === 'pattern' && !!prefs.pinHash;
    const ig = q('.input-group', mc), btn = q('button.btn-primary', mc);
    let host = byId('fxLockPad');
    if (pat) {
        if (ig) ig.style.display = 'none'; if (btn) btn.style.display = 'none';
        if (!host) { host = document.createElement('div'); host.id = 'fxLockPad'; mc.appendChild(host); mountPad(host, s => { byId('lockInput').value = s; unlockApp(); }); }
        const d = q('.setting-desc', mc); if (d) d.textContent = 'Draw your pattern to continue';
    } else {
        if (ig) ig.style.display = ''; if (btn) btn.style.display = ''; if (host) host.remove();
        const d = q('.setting-desc', mc); if (d) d.textContent = 'Enter your PIN to continue';
    }
}
let patStage = null;
FX.patStart = function (mode) {
    patStage = { mode, first: '' };
    const host = byId('fxPatHost'); if (!host) return;
    host.innerHTML = '<div class="fx-note" id="fxPatMsg" style="text-align:center;margin:0;"></div><div id="fxPatPad"></div><div style="text-align:center;"><span class="quick-chip" onclick="FX.patCancel()">Cancel</span></div>';
    const msg = byId('fxPatMsg');
    msg.textContent = mode === 'remove' ? 'Draw your current pattern to remove it' : 'Draw a new pattern (connect at least 4 dots)';
    mountPad(byId('fxPatPad'), async s => {
        if (mode === 'remove') {
            if (await hashPin(s) !== prefs.pinHash) { msg.textContent = 'Wrong pattern. Try again.'; return; }
            prefs.pinHash = ''; delete prefs.lockType; savePrefs(); lockUI(); patStage = null; renderPrefsPanels(); return notify({ type: 'info', title: 'Pattern lock removed' });
        }
        if (s.length < 4) { msg.textContent = 'Too short. Connect at least 4 dots.'; patStage.first = ''; return; }
        if (!patStage.first) { patStage.first = s; msg.textContent = 'Draw it again to confirm'; return; }
        if (patStage.first !== s) { patStage.first = ''; msg.textContent = 'Patterns did not match. Start again.'; return; }
        prefs.pinHash = await hashPin(s); prefs.lockType = 'pattern'; savePrefs(); lockUI(); patStage = null; renderPrefsPanels(); notify({ type: 'success', title: 'Pattern lock is on' });
    });
};
FX.patCancel = function () { patStage = null; renderPrefsPanels(); };

/* ================= Simple mode, offline status, settings additions ================= */
FX.setSimple = function (on) { S().simple = !!on; saveData(); applySimple(); renderDash(); };
function applySimple() { document.documentElement.classList.toggle('fx-simple', !!(appState.fx && appState.fx.simple)); }
function offlineHtml() {
    const sw = !!(navigator.serviceWorker && navigator.serviceWorker.controller), on = navigator.onLine !== false;
    return `<div class="setting-title" style="margin-top:22px;">Offline mode</div><div class="setting-desc" style="margin-bottom:6px;">${sw ? '<b style="color:var(--neon-green)">Ready.</b> GoalForce opens and saves without internet. Changes sync when you are back online.' : '<b style="color:var(--neon-yellow)">Almost ready.</b> Reload once while online (on https) so the app can store itself for offline use. Your data is already saved on this device.'} You are <b>${on ? 'online' : 'offline'}</b> right now.</div>`;
}
function enhancePrefs() {
    const pp = byId('prefsPanel'), sp = byId('securityPanel');
    if (pp && !byId('fxSimpleLine')) {
        const h = q('h2', pp);
        const html = `<div class="setting-line" id="fxSimpleLine" style="margin-bottom:14px;"><div><div class="setting-title">Simple mode</div><div class="setting-desc">Hides charts and extra sections and turns off animations. Just habits, tasks, water and notes.</div></div><label class="switch"><input type="checkbox" ${S().simple ? 'checked' : ''} onchange="FX.setSimple(this.checked)"><span class="switch-slider"></span></label></div>`;
        if (h) h.insertAdjacentHTML('afterend', html); else pp.insertAdjacentHTML('afterbegin', html);
    }
    if (sp && !byId('fxPatHost')) {
        const pat = prefs.lockType === 'pattern' && !!prefs.pinHash;
        sp.insertAdjacentHTML('beforeend', `<div class="setting-title" style="margin-top:22px;">Pattern lock</div><div class="setting-desc" style="margin-bottom:10px;">${pat ? 'Pattern lock is <b>on</b>.' : 'Unlock with a pattern instead of a PIN.' + (prefs.pinHash ? ' This replaces your PIN.' : '')} It keeps casual snoopers out - it is not strong encryption.</div><div id="fxPatHost"><span class="quick-chip" onclick="FX.patStart('${pat ? 'remove' : 'set'}')">${pat ? 'Remove pattern' : 'Set pattern lock'}</span></div>${offlineHtml()}`);
    }
}

/* ================= Profile (details + display picture) ================= */
const DP_RE = /^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/;
function PF() {
    if (!isObj(appState.profile)) appState.profile = {};
    const p = appState.profile;
    ['name', 'bio', 'birthday', 'gender', 'location', 'goal', 'dp'].forEach(k => { if (typeof p[k] !== 'string') p[k] = ''; });
    if (p.dp && (!DP_RE.test(p.dp) || p.dp.length > 300000)) p.dp = '';
    return p;
}
const authName = () => { try { const u = getActiveAuthUser(); return u ? (u.name || u.email.split('@')[0]) : ''; } catch (e) { return ''; } };
const profName = () => (PF().name || authName() || 'Achiever');
function applyAvatar() {
    const p = PF(), nm = profName();
    qa('.user-profile .avatar, .fx-pf-av').forEach(av => {
        if (p.dp) { av.style.backgroundImage = `url("${p.dp}")`; av.style.backgroundSize = 'cover'; av.style.backgroundPosition = 'center'; av.textContent = ''; }
        else { av.style.backgroundImage = ''; av.textContent = nm.charAt(0).toUpperCase(); }
    });
    const up = q('.user-profile'); if (up && !up.dataset.fxlink) { up.dataset.fxlink = '1'; up.style.cursor = 'pointer'; up.title = 'Open profile'; up.setAttribute('onclick', "FX.go('profile')"); }
}
function applyGreetingName() {
    const n = PF().name; if (!n) return;
    const h = new Date().getHours(), g = h < 12 ? 'Good Morning' : h < 18 ? 'Good Afternoon' : 'Good Evening', gt = byId('greetingText');
    if (gt) gt.innerText = `${g}, ${n}!`;
}
function memberSince() {
    try {
        const u = cloud && cloud.session && cloud.session.user;
        if (u && u.created_at) return new Date(u.created_at);
        const me = getActiveAuthUser(), acc = cloudLS.get('quantumLocalAccounts', {}); if (me && acc[me.email] && acc[me.email].createdAt) return new Date(acc[me.email].createdAt);
    } catch (e) {}
    const first = Object.keys(appState.habits.reduce((o, h) => Object.assign(o, h.history), {})).sort()[0];
    return first ? new Date(first + 'T00:00:00') : null;
}
const fmtDate = d => d ? d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '-';
function signInInfo() {
    let method = 'Local account (this device only)', last = null, cloudOn = false;
    try {
        const u = cloud && cloud.session && cloud.session.user;
        if (u) { cloudOn = true; const pr = (u.app_metadata && u.app_metadata.provider) || 'email'; method = pr === 'google' ? 'Google' : pr === 'apple' ? 'Apple' : 'Email & password'; if (u.last_sign_in_at) last = new Date(u.last_sign_in_at); }
        else { const s = cloudLS.get('quantumActiveSession', null); if (s && s.loginAt) last = new Date(s.loginAt); }
    } catch (e) {}
    return { method, last, cloudOn };
}
function perfectDayCount() {
    const first = Array.from(getActiveDates()).sort()[0]; if (!first) return 0;
    let n = 0; for (let d = first, i = 0; d <= TODAY() && i < 1500; d = dateAdd(d, 1), i++) { const s = dayStat(d); if (!s.rest && s.sched >= 1 && s.done === s.sched) n++; }
    return n;
}
function renderProfile() {
    const box = byId('fx-profile-body'); if (!box) return;
    const p = PF(), me = (() => { try { return getActiveAuthUser(); } catch (e) { return null; } })(), info = getLevelInfo(appState.totalXp), si = signInInfo();
    const tasksDone = (appState.tasks || []).reduce((n, t) => n + Object.values(t.done || {}).filter(v => v === true).length, 0);
    const focusAll = appState.focus.reduce((a, s) => a + (Number(s && s.mins) || 0), 0);
    const gOpt = ['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'].map(g => `<option value="${g}" ${p.gender === g ? 'selected' : ''}>${g || 'Select (optional)'}</option>`).join('');
    const row = (k, v) => `<div class="fx-row"><div class="grow"><div class="s">${k}</div><div class="t">${E(v)}</div></div></div>`;
    box.innerHTML = `
    <section class="panel"><div class="fx-pf-head">
        <div class="avatar fx-pf-av" id="fxPfAv" title="Change photo" onclick="byId('fxPfFile').click()"></div>
        <div style="flex:1;min-width:200px;"><div style="font-size:24px;font-weight:700;word-break:break-word;">${E(profName())}</div>
            <div class="fx-muted">${E(me ? me.email : 'Not logged in')}</div>
            <div class="fx-xp" style="margin:6px 0 12px;">Level ${info.level} &middot; ${E(getRank(info.level))}</div>
            <input type="file" id="fxPfFile" accept="image/*" style="display:none" onchange="FX.pfPhoto(this)">
            <div style="display:flex;gap:8px;flex-wrap:wrap;"><button class="btn-primary" onclick="byId('fxPfFile').click()">${p.dp ? 'Change photo' : 'Add photo'}</button>${p.dp ? '<button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="FX.pfRemovePhoto()">Remove</button>' : ''}</div></div></div>
        ${p.bio ? `<div class="fx-note" style="font-size:14px;margin-top:14px;color:var(--text-main);">${E(p.bio)}</div>` : ''}</section>
    <section class="panel"><h2 class="panel-title" style="margin-bottom:12px;">Your details</h2>
        <div class="fx-form"><div class="input-group"><label>Display name</label><input type="text" id="fxPfName" maxlength="30" value="${E(p.name)}" placeholder="${E(authName() || 'Your name')}"></div>
        <div class="input-group"><label>Birthday</label><input type="date" id="fxPfBday" value="${E(p.birthday)}"></div>
        <div class="input-group"><label>Gender</label><select id="fxPfGender">${gOpt}</select></div>
        <div class="input-group"><label>City / Country</label><input type="text" id="fxPfLoc" maxlength="40" value="${E(p.location)}" placeholder="e.g. Delhi, India"></div></div>
        <div class="fx-form" style="grid-template-columns:1fr;"><div class="input-group"><label>Main goal</label><input type="text" id="fxPfGoal" maxlength="80" value="${E(p.goal)}" placeholder="What do you want to improve?"></div>
        <div class="input-group"><label>Bio</label><textarea id="fxPfBio" rows="3" maxlength="140" placeholder="A line about you (max 140 characters)">${E(p.bio)}</textarea></div></div>
        <button class="btn-primary" onclick="FX.pfSave()">Save profile</button><div class="fx-note">Your profile is saved on this device and backed up with your account when cloud backup is on. It is private: only your name is ever shown publicly, and only if you turn on the social profile.</div></section>
    <section class="panel"><h2 class="panel-title" style="margin-bottom:12px;">Account</h2>
        ${row('Email', me ? me.email : '-')}${row('Sign-in method', si.method)}${row('Cloud backup', si.cloudOn ? 'On' : 'Off (data stays on this device)')}${row('Member since', fmtDate(memberSince()))}${row('Last login', si.last ? si.last.toLocaleString('en-US', { dateStyle: 'medium', timeStyle: 'short' }) : '-')}
        <div style="margin-top:12px;"><button class="btn-primary" style="background:transparent;border-color:var(--neon-red);color:var(--neon-red);" onclick="appMandatoryLogout()">Log out</button></div></section>
    <section class="panel"><h2 class="panel-title" style="margin-bottom:12px;">Your stats</h2><div class="fx-grid" style="margin-bottom:0;">
        ${tile('Total XP', (Number(appState.totalXp) || 0).toLocaleString('en-US'), `<div class="d">Level ${info.level}</div>`)}${tile('Current streak', getCurrentStreak() + ' days', '')}${tile('Best streak', getLongestStreak() + ' days', '')}${tile('Habits ticked', getTotalCompleted(), '')}${tile('Tasks done', tasksDone, '')}${tile('Perfect days', perfectDayCount(), '')}${tile('Active days', getActiveDates().size, '')}${tile('Achievements', Object.keys(appState.badges || {}).length, '')}${tile('Focus time', fmtMin(focusAll), '')}${tile('Habits', appState.habits.length, '')}</div></section>`;
    applyAvatar();
}
FX.pfSave = function () {
    const p = PF(), clean = (v, n) => String(v || '').replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);
    const bday = byId('fxPfBday').value;
    if (bday && (!/^\d{4}-\d{2}-\d{2}$/.test(bday) || bday > TODAY() || bday < '1900-01-01')) return notify({ type: 'error', title: 'Check your birthday date' });
    const g = byId('fxPfGender').value; if (!['', 'Female', 'Male', 'Non-binary', 'Prefer not to say'].includes(g)) return;
    p.name = clean(byId('fxPfName').value, 30); p.birthday = bday; p.gender = g; p.location = clean(byId('fxPfLoc').value, 40); p.goal = clean(byId('fxPfGoal').value, 80);
    p.bio = String(byId('fxPfBio').value || '').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').slice(0, 140).trim();
    saveData(); try { updateUserGreeting(); } catch (e) {} renderProfile(); notify({ type: 'success', title: 'Profile saved' });
};
FX.pfPhoto = function (inp) {
    const f = inp.files && inp.files[0]; inp.value = '';
    if (!f) return;
    if (!/^image\//.test(f.type)) return notify({ type: 'error', title: 'Please choose an image' });
    if (f.size > 12 * 1024 * 1024) return notify({ type: 'error', title: 'Image is too large', message: 'Choose one under 12 MB.' });
    const url = URL.createObjectURL(f), img = new Image();
    img.onload = () => {
        try {
            const s = Math.min(img.width, img.height), cv = document.createElement('canvas'); cv.width = cv.height = 256;
            const c = cv.getContext('2d'); c.fillStyle = '#000'; c.fillRect(0, 0, 256, 256);
            c.drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, 256, 256);
            const data = cv.toDataURL('image/jpeg', 0.82);
            if (!DP_RE.test(data)) throw new Error('bad image');
            PF().dp = data; saveData(); renderProfile(); notify({ type: 'success', title: 'Photo updated' });
        } catch (e) { notify({ type: 'error', title: 'Could not use that image' }); }
        URL.revokeObjectURL(url);
    };
    img.onerror = () => { URL.revokeObjectURL(url); notify({ type: 'error', title: 'Could not read that image' }); };
    img.src = url;
};
FX.pfRemovePhoto = function () { confirmDo('Remove your profile photo?', () => { PF().dp = ''; saveData(); renderProfile(); }, 'Remove'); };
FX.pages.profile = renderProfile;

/* ================= Monthly tracker: download as image ================= */
function drawTrackerImage() {
    const now = new Date(), y = now.getFullYear(), m = now.getMonth(), dim = new Date(y, m + 1, 0).getDate(), today = TODAY();
    const habits = appState.habits || [];
    const cs = getComputedStyle(document.documentElement), v = (n, d) => (cs.getPropertyValue(n).trim() || d);
    const C = { bg: v('--bg-base', '#000'), text: v('--text-main', '#fff'), mute: v('--text-muted', '#9a9a9a'), green: v('--neon-green', '#00ff88'), red: v('--neon-red', '#ff3366'), purple: v('--neon-purple', '#b026ff'), cyan: v('--neon-cyan', '#00f0ff') };
    const F = 'system-ui, -apple-system, "Segoe UI", sans-serif';
    const PAD = 36, NAMEW = 300, CELL = 40, GAP = 4, STATW = 150, HEAD = 120, ROW = 44;
    const W = PAD * 2 + NAMEW + dim * (CELL + GAP) + STATW, H = HEAD + 56 + habits.length * (ROW + GAP) + 110;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const c = cv.getContext('2d');
    c.fillStyle = C.bg; c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';
    const label = now.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
    c.fillStyle = C.text; c.font = `700 34px ${F}`; c.fillText(`Monthly Tracker - ${label}`, PAD, PAD + 18);
    c.fillStyle = C.mute; c.font = `500 18px ${F}`; c.fillText('GoalForce', PAD, PAD + 56);
    // legend
    const lg = [['Done', C.green, .85], ['Missed', C.red, .35], ['Rest / not scheduled', C.mute, .15]];
    let lx = W - PAD; c.textAlign = 'right';
    lg.slice().reverse().forEach(([t, col, a]) => { c.fillStyle = C.mute; c.font = `500 16px ${F}`; c.fillText(t, lx, PAD + 18); const tw = c.measureText(t).width; c.globalAlpha = a; c.fillStyle = col; rr(c, lx - tw - 24, PAD + 10, 16, 16, 4); c.fill(); c.globalAlpha = 1; lx -= tw + 24 + 18; });
    c.textAlign = 'left';
    const x0 = PAD + NAMEW, y0 = HEAD;
    // day headers
    const dow = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];
    for (let i = 1; i <= dim; i++) {
        const x = x0 + (i - 1) * (CELL + GAP), ds = `${y}-${pad2(m + 1)}-${pad2(i)}`, isT = ds === today;
        if (isT) { c.strokeStyle = C.purple; c.lineWidth = 2; rr(c, x, y0 - 6, CELL, 52, 8); c.stroke(); }
        c.textAlign = 'center'; c.fillStyle = C.mute; c.font = `500 13px ${F}`; c.fillText(dow[new Date(y, m, i).getDay()], x + CELL / 2, y0 + 8);
        c.fillStyle = isT ? C.purple : C.text; c.font = `700 17px ${F}`; c.fillText(String(i), x + CELL / 2, y0 + 30);
    }
    c.textAlign = 'left'; c.fillStyle = C.mute; c.font = `600 15px ${F}`; c.fillText('Habit', PAD, y0 + 20);
    c.textAlign = 'center'; c.fillText('Done', x0 + dim * (CELL + GAP) + 52, y0 + 20); c.fillText('Rate', x0 + dim * (CELL + GAP) + 112, y0 + 20); c.textAlign = 'left';
    // rows
    let tot = 0, dn = 0;
    habits.forEach((h, r) => {
        const y1 = y0 + 56 + r * (ROW + GAP);
        c.globalAlpha = .05; c.fillStyle = C.text; rr(c, PAD - 8, y1 - 2, W - PAD * 2 + 16, ROW + 4, 10); c.fill(); c.globalAlpha = 1;
        let nm = h.name; c.font = `600 18px ${F}`; while (c.measureText(nm).width > NAMEW - 20 && nm.length > 3) nm = nm.slice(0, -2); if (nm !== h.name) nm += '…';
        c.fillStyle = C.text; c.fillText(nm, PAD, y1 + ROW / 2);
        let done = 0, sched = 0;
        for (let i = 1; i <= dim; i++) {
            const ds = `${y}-${pad2(m + 1)}-${pad2(i)}`, x = x0 + (i - 1) * (CELL + GAP);
            const ok = h.history[ds] === true, rest = !ok && (isRestDay(ds) || !isScheduled(h, ds)), missed = !ok && !rest && ds < today;
            if (ok) done++; if ((ok || !rest) && ds <= today) sched++;
            if (ok) { c.globalAlpha = .85; c.fillStyle = C.green; rr(c, x, y1 + 2, CELL, ROW - 4, 8); c.fill(); c.globalAlpha = 1; c.strokeStyle = C.bg; c.lineWidth = 3; c.lineCap = 'round'; c.lineJoin = 'round'; c.beginPath(); c.moveTo(x + 11, y1 + ROW / 2); c.lineTo(x + 18, y1 + ROW / 2 + 7); c.lineTo(x + 30, y1 + ROW / 2 - 6); c.stroke(); }
            else if (missed) { c.globalAlpha = .3; c.fillStyle = C.red; rr(c, x, y1 + 2, CELL, ROW - 4, 8); c.fill(); c.globalAlpha = 1; }
            else { c.globalAlpha = rest ? .1 : .16; c.fillStyle = C.mute; rr(c, x, y1 + 2, CELL, ROW - 4, 8); c.fill(); c.globalAlpha = 1; }
            if (ds === today) { c.strokeStyle = C.purple; c.lineWidth = 2; rr(c, x, y1 + 2, CELL, ROW - 4, 8); c.stroke(); }
        }
        tot += sched; dn += Math.min(done, sched);
        const pct = sched ? Math.round(Math.min(done, sched) / sched * 100) : 0;
        c.textAlign = 'center'; c.fillStyle = C.text; c.font = `600 17px ${F}`; c.fillText(`${done}/${sched}`, x0 + dim * (CELL + GAP) + 52, y1 + ROW / 2);
        c.fillStyle = pct >= 80 ? C.green : pct >= 50 ? C.cyan : C.red; c.fillText(pct + '%', x0 + dim * (CELL + GAP) + 112, y1 + ROW / 2); c.textAlign = 'left';
    });
    // footer
    const fy = H - 70, overall = tot ? Math.round(dn / tot * 100) : 0;
    c.fillStyle = C.text; c.font = `700 22px ${F}`; c.fillText(`Overall completion: ${overall}%`, PAD, fy);
    c.fillStyle = C.mute; c.font = `500 17px ${F}`; c.fillText(`Current streak: ${getCurrentStreak()} days   |   Habits: ${habits.length}   |   Created ${now.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}`, PAD, fy + 32);
    return { cv, name: `goalforce-monthly-tracker-${y}-${pad2(m + 1)}.png` };
}
FX.downloadTracker = function () {
    if (!(appState.habits || []).length) return notify({ type: 'info', title: 'No habits yet', message: 'Add a habit first, then download your tracker.' });
    let img; try { img = drawTrackerImage(); } catch (e) { logFx('tracker', e); return notify({ type: 'error', title: 'Could not create the image' }); }
    img.cv.toBlob(async blob => {
        if (!blob) return notify({ type: 'error', title: 'Could not create the image' });
        try {
            const file = new File([blob], img.name, { type: 'image/png' });
            if (/Android|iPhone|iPad/i.test(navigator.userAgent) && navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Monthly Tracker' }); return; }
        } catch (e) { if (e && e.name === 'AbortError') return; }
        const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = img.name; document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(a.href), 4000);
        notify({ type: 'success', title: 'Tracker downloaded', message: img.name });
    }, 'image/png');
};

/* ================= Login: Google / Apple ================= */
window.fxOAuth = function (provider) {
    if (!['google', 'apple'].includes(provider)) return;
    let on = false; try { on = !!CLOUD_ON; } catch (e) {}
    if (!on) return setGateMsg('Cloud login is not set up yet. Please use email for now.', true);
    if (!navigator.onLine) return setGateMsg('You are offline. Connect to the internet to sign in.', true);
    setGateMsg('Opening ' + (provider === 'google' ? 'Google' : 'Apple') + '...', false);
    location.href = `${CLOUD.url}/auth/v1/authorize?provider=${provider}&redirect_to=${encodeURIComponent(location.origin + location.pathname)}`;
};

/* ================= Navigation + wiring ================= */
const NAV = [
    ['profile', 'Profile', '<circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/>', false],
    ['friends', 'Friends', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><path d="M19 8v6M16 11h6"/>', false],
    ['community', 'Community', '<path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 8.5 8.5 0 0 1-3.8-.9L3 21l1.9-5.2A8.4 8.4 0 0 1 12 3a8.5 8.5 0 0 1 9 8.5z"/>', false],
    ['reports', 'Progress', '<path d="M3 3v18h18"/><path d="M7 15l4-4 3 3 5-6"/>', false],
    ['focus', 'Focus', '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r="1"/>', true],
    ['goals', 'Goals', '<path d="M5 21V4"/><path d="M5 4h12l-2 4 2 4H5"/>', true],
    ['social', 'Share & Social', '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0"/><circle cx="17" cy="9" r="2.5"/><path d="M17 14.5a5 5 0 0 1 4.5 5"/>', true]
];
function buildNav() {
    const links = q('.sidebar .nav-links'), sheet = byId('moreSheet'), more = q('.mobile-nav-item[data-pages]:last-child');
    NAV.forEach(([id, label, icon, adv]) => {
        if (links && !q(`[data-fxnav="${id}"]`, links)) {
            const a = document.createElement('a'); a.href = '#'; a.className = 'nav-item' + (adv ? ' fx-adv-nav' : ''); a.dataset.fxnav = id;
            a.setAttribute('onclick', `changePage('${id}', this); return false;`);
            a.innerHTML = `<svg class="icon" viewBox="0 0 24 24">${icon}</svg>${label}`;
            links.appendChild(a);
        }
        if (sheet && !q(`[data-fxmore="${id}"]`, sheet)) {
            const d = document.createElement('div'); d.className = 'more-item' + (adv ? ' fx-adv' : ''); d.dataset.fxmore = id;
            d.setAttribute('onclick', `changePage('${id}', null)`);
            d.innerHTML = `<svg class="icon" viewBox="0 0 24 24">${icon}</svg>${label}`;
            const settings = q('.more-item[onclick*="settings"]', sheet);
            if (settings) sheet.insertBefore(d, settings); else sheet.appendChild(d);
        }
    });
    if (more) more.dataset.pages = (more.dataset.pages || '') + ',' + NAV.map(n => n[0]).join(',');
}
function buildPages() {
    makePage('profile', 'Profile', 'Your photo, details, account and stats');
    makePage('friends', 'Friends', 'Add friends and compete on the leaderboard');
    makePage('community', 'Community', 'Share wins and photos, cheer others on');
    makePage('reports', 'Progress', 'Weekly report, monthly stats, streaks and insights');
    makePage('focus', 'Focus Mode', 'Block distractions and get deep work done');
    makePage('goals', 'Goals', 'Set targets and watch them fill up');
    makePage('social', 'Share &amp; Social', 'Share progress, challenge friends, climb the leaderboard');
}
function wrap(name, after) {
    const orig = window[name]; if (typeof orig !== 'function') return;
    window[name] = function () { const r = orig.apply(this, arguments); try { after.apply(this, arguments); } catch (e) { logFx(name, e); } return r; };
}
wrap('updateUI', () => renderDash());
wrap('updateUserGreeting', () => { applyGreetingName(); applyAvatar(); });
wrap('saveData', () => { if (!inEval) scheduleEval(); });
wrap('renderHabits', () => renderEnergyNote());
wrap('renderHomeTasks', () => renderEnergyNote());
wrap('changePage', id => { if (FX.pages[id]) FX.pages[id](); });
wrap('renderPrefsPanels', () => enhancePrefs());
wrap('setGateMode', m => { const s = byId('gateSocial'), l = byId('gateForgotLink'); if (s) s.style.display = m === 'forgot' ? 'none' : ''; if (l) l.parentNode.style.display = m === 'login' ? '' : 'none'; });
wrap('enforceAuthGate', () => { // show the welcome steps after the first login (the gate hides them while logged out)
    try { if (isUserAuthenticated() && !localStorage.getItem('quantumWelcomed') && !localStorage.getItem('quantumDemoBackup') && getTotalCompleted() === 0) { renderOnboarding(); byId('welcomeModal').classList.add('show'); } } catch (e) {}
});
{ // lock type bookkeeping when the normal PIN is used
    const _sp = window.setPin, _rp = window.removePin;
    if (typeof _sp === 'function') window.setPin = async function () { await _sp.apply(this, arguments); if (prefs.pinHash && prefs.lockType === 'pattern' && /^\d{4,8}$/.test((byId('pinNew') || {}).value || '1234') === true) { /* keep */ } if (prefs.pinHash) { prefs.lockType = 'pin'; savePrefs(); lockUI(); } };
    if (typeof _rp === 'function') window.removePin = async function () { if (prefs.lockType === 'pattern') return notify({ type: 'info', title: 'Pattern lock is on', message: 'Use "Remove pattern" below to turn it off.' }); await _rp.apply(this, arguments); if (!prefs.pinHash) { delete prefs.lockType; savePrefs(); lockUI(); } };
}

function boot() {
    try {
        S();
        buildPages(); buildNav(); ensureDashPanel(); focusOverlay();
        applySimple(); applyEnergyAttr(); applyGreetingName(); applyAvatar(); renderOnboarding(); lockUI();
        try { applyPrefs(); } catch (e) {}
        resumeFocus(); captureInvite();
        evaluate(); renderDash();
        setTimeout(checkFriendBadge, 3500); setInterval(checkFriendBadge, 5 * 60 * 1000);
        window.addEventListener('online', () => { enhancePrefsRefresh(); socialPushSoon(); });
        window.addEventListener('offline', enhancePrefsRefresh);
        if (navigator.serviceWorker) navigator.serviceWorker.addEventListener('controllerchange', enhancePrefsRefresh);
        setInterval(() => { if (!document.hidden) { applyEnergyAttr(); const d = TODAY(); if (FX.lastDay !== d) { FX.lastDay = d; renderDash(); } } }, 30000);
        FX.lastDay = TODAY();
    } catch (e) { logFx('boot', e); }
}
function enhancePrefsRefresh() { if (q('#page-settings.active')) { try { renderPrefsPanels(); } catch (e) {} } }
window.addEventListener('load', () => setTimeout(boot, 0));
FX._test = { evaluate, todaysMissions, genMissions, comebackState, buildInsights, chScore, parseChallenge, habitStreaks, addHabits, PACKS, S, goalProgress };
})();
