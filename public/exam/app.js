/* ==========================================================================
   app.js — ตรรกะของแอพทำข้อสอบ
   • สุ่มข้อสอบ 60 ข้อ (ปรนัย 40 / จับคู่คำ 10 / เติมคำ 10) จากคลังบทที่ 4-8
   • เฉลยทันทีเมื่อกดตอบแต่ละข้อ
   • เก็บประวัติคะแนนทุกรอบไว้ใน localStorage
   ========================================================================== */
(function () {
  'use strict';

  var EXAM = window.EXAM;

  /* --------------------------- ค่าคงที่ของข้อสอบ --------------------------- */
  var N_MC = 40;          // ปรนัย 40 ข้อ
  var N_MATCH_SETS = 2;   // จับคู่ 2 ชุด × 5 ข้อ = 10 ข้อ
  var N_FILL = 10;        // เติมคำ 10 ข้อ
  var TOTAL = N_MC + N_MATCH_SETS * 5 + N_FILL;

  /* สัดส่วนข้อวิเคราะห์ในตอนปรนัย ตามโหมดที่ผู้ใช้เลือก */
  var MIX_RATIO = { recall: 0, balanced: 0.6, analysis: 1 };

  var KEY_HISTORY = 'examApp.history.v1';
  var KEY_SESSION = 'examApp.session.v1';
  var KEY_THEME = 'examApp.theme.v1';
  var KEY_PREFS = 'examApp.prefs.v1';

  var CHOICE_KEYS = ['ก', 'ข', 'ค', 'ง', 'จ'];

  /* ------------------------------ ตัวช่วยทั่วไป ------------------------------ */
  var $ = function (id) { return document.getElementById(id); };

  function el(tag, className, text) {
    var node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  function shuffle(list) {
    var a = list.slice();
    for (var i = a.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function pick(list, n) { return shuffle(list).slice(0, n); }

  function pad2(n) { return (n < 10 ? '0' : '') + n; }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = sec % 60;
    if (m >= 60) return Math.floor(m / 60) + ':' + pad2(m % 60) + ':' + pad2(s);
    return pad2(m) + ':' + pad2(s);
  }

  function fmtDate(ts) {
    var d = new Date(ts);
    var months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    return d.getDate() + ' ' + months[d.getMonth()] + ' ' + (d.getFullYear() + 543) +
      ' · ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
  }

  /** ทำให้คำตอบเติมคำเทียบกันได้ — ตัดช่องว่าง เครื่องหมาย และตัวพิมพ์เล็กใหญ่ */
  function normalize(text) {
    return String(text == null ? '' : text)
      .trim()
      .toLowerCase()
      .replace(/[\s\u00a0\u200b]+/g, '')
      .replace(/[.,!?;:"'`\u2018\u2019\u201c\u201d()[\]{}\-\u2013\u2014_]/g, '');
  }

  function storageGet(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (e) { return fallback; }
  }

  function storageSet(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch (e) { return false; }
  }

  function storageDel(key) {
    try { localStorage.removeItem(key); } catch (e) { /* ไม่มีอะไรต้องทำ */ }
  }

  var toastTimer = null;
  function toast(message) {
    var node = $('toast');
    node.textContent = message;
    node.hidden = false;
    clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { node.hidden = true; }, 2400);
  }

  function chapterById(id) {
    for (var i = 0; i < EXAM.chapters.length; i++) {
      if (EXAM.chapters[i].id === id) return EXAM.chapters[i];
    }
    return null;
  }

  function chapterLabel(id) {
    var c = chapterById(id);
    return c ? 'บทที่ ' + c.no : id;
  }

  function chapterTitle(id) {
    var c = chapterById(id);
    return c ? 'บทที่ ' + c.no + ' ' + c.title : id;
  }

  /* ------------------------------ สถานะของแอพ ------------------------------ */
  var state = {
    screen: 'home',
    subject: null,      // รหัสวิชาที่เลือกอยู่
    selected: {},       // { รหัสวิชา: [รหัสบทที่เลือก] }
    prefs: { instant: true, shuffleChoices: true, timer: true, mix: 'balanced' },
    quiz: null,         // ข้อสอบรอบปัจจุบัน
    lastResult: null,   // ผลรอบล่าสุด (ใช้ในหน้าสรุป/ทบทวน)
    reviewFilter: 'all',
    historyFilter: 'all',
    tick: null
  };

  function subjectById(id) {
    for (var i = 0; i < EXAM.subjects.length; i++) {
      if (EXAM.subjects[i].id === id) return EXAM.subjects[i];
    }
    return null;
  }

  function subjectLabel(id) {
    var s = subjectById(id);
    return s ? s.short : 'ไม่ทราบวิชา';
  }

  function chaptersOf(subjectId) {
    return EXAM.chapters.filter(function (c) { return c.subject === subjectId; });
  }

  /** บทที่ผู้ใช้เลือกไว้ของวิชาปัจจุบัน (ยังไม่เคยเลือก = เลือกทุกบท) */
  function selectedChapters(subjectId) {
    if (!state.selected[subjectId]) {
      state.selected[subjectId] = chaptersOf(subjectId).map(function (c) { return c.id; });
    }
    return state.selected[subjectId];
  }

  /* ================================ ธีม ================================ */
  function applyTheme(mode) {
    document.documentElement.setAttribute('data-theme', mode);
    storageSet(KEY_THEME, mode);
  }

  function initTheme() {
    applyTheme(storageGet(KEY_THEME, 'auto'));
    $('themeBtn').addEventListener('click', function () {
      var order = ['auto', 'light', 'dark'];
      var now = document.documentElement.getAttribute('data-theme') || 'auto';
      var next = order[(order.indexOf(now) + 1) % order.length];
      applyTheme(next);
      toast(next === 'auto' ? 'ธีม: ตามระบบ' : next === 'light' ? 'ธีม: สว่าง' : 'ธีม: มืด');
    });
  }

  /* ============================ การสลับหน้าจอ ============================ */
  function show(screen) {
    state.screen = screen;
    ['home', 'quiz', 'result', 'review', 'history'].forEach(function (name) {
      $('screen-' + name).hidden = (name !== screen);
    });
    $('quizProgress').hidden = (screen !== 'quiz');
    window.scrollTo({ top: 0, behavior: 'auto' });
  }

  /* ========================== การสุ่มชุดข้อสอบ ========================== */

  /**
   * กระจายจำนวนข้อให้ทุกบทที่เลือกอย่างเท่าเทียม แล้วเติมส่วนที่ขาด
   * จากบทที่ยังมีข้อเหลือ (กรณีบางบทมีข้อไม่พอ)
   */
  function drawSpread(pool, chapterIds, total) {
    var byChapter = {};
    chapterIds.forEach(function (id) { byChapter[id] = []; });
    pool.forEach(function (q) { if (byChapter[q.ch]) byChapter[q.ch].push(q); });

    var quota = {};
    var base = Math.floor(total / chapterIds.length);
    chapterIds.forEach(function (id) { quota[id] = base; });
    shuffle(chapterIds).slice(0, total % chapterIds.length)
      .forEach(function (id) { quota[id] += 1; });

    var drawn = [];
    var leftovers = [];
    chapterIds.forEach(function (id) {
      var available = shuffle(byChapter[id]);
      drawn = drawn.concat(available.slice(0, quota[id]));
      leftovers = leftovers.concat(available.slice(quota[id]));
    });

    if (drawn.length < total) drawn = drawn.concat(shuffle(leftovers).slice(0, total - drawn.length));
    return shuffle(drawn).slice(0, total);
  }

  /** สุ่มชุดจับคู่ โดยพยายามไม่ให้ซ้ำบทกัน */
  function drawMatchSets(subjectId, chapterIds, count) {
    var pool = EXAM.matchSets.filter(function (s) {
      return s.subject === subjectId && chapterIds.indexOf(s.ch) !== -1;
    });
    var byChapter = {};
    shuffle(pool).forEach(function (s) {
      if (!byChapter[s.ch]) byChapter[s.ch] = [];
      byChapter[s.ch].push(s);
    });
    var chosen = [];
    var order = shuffle(Object.keys(byChapter));
    for (var round = 0; chosen.length < count && round < 10; round++) {
      for (var i = 0; i < order.length && chosen.length < count; i++) {
        var bucket = byChapter[order[i]];
        if (bucket.length) chosen.push(bucket.shift());
      }
    }
    return chosen;
  }

  /**
   * สุ่มข้อปรนัยตามสัดส่วนข้อวิเคราะห์ที่ผู้ใช้เลือก
   * ถ้าคลังฝั่งใดมีไม่พอ จะดึงจากอีกฝั่งมาเติมให้ครบ
   */
  function drawMC(pool, chapterIds, total, mix) {
    var analysisPool = pool.filter(function (q) { return q.type === 'analysis'; });
    var recallPool = pool.filter(function (q) { return q.type !== 'analysis'; });

    var wantAnalysis = Math.min(Math.round(total * MIX_RATIO[mix]), analysisPool.length);
    var wantRecall = Math.min(total - wantAnalysis, recallPool.length);
    // ฝั่งใดขาด ให้อีกฝั่งเติมเต็มจนครบจำนวนที่ต้องการ
    wantAnalysis = Math.min(total - wantRecall, analysisPool.length);

    var picked = drawSpread(analysisPool, chapterIds, wantAnalysis)
      .concat(drawSpread(recallPool, chapterIds, wantRecall));
    return shuffle(picked);
  }

  function buildQuiz(subjectId, chapterIds) {
    var inScope = function (q) {
      return q.subject === subjectId && chapterIds.indexOf(q.ch) !== -1;
    };
    var mcPool = EXAM.mc.filter(inScope);
    var fillPool = EXAM.fill.filter(inScope);

    var mcItems = drawMC(mcPool, chapterIds, Math.min(N_MC, mcPool.length), state.prefs.mix).map(function (q) {
      var order = state.prefs.shuffleChoices
        ? shuffle(q.choices.map(function (_, i) { return i; }))
        : q.choices.map(function (_, i) { return i; });
      return {
        kind: 'mc',
        id: q.id,
        ch: q.ch,
        type: q.type,
        q: q.q,
        choices: order.map(function (i) { return q.choices[i]; }),
        answer: order.indexOf(q.answer),
        explain: q.explain,
        ref: q.ref,
        picked: null,
        done: false
      };
    });

    var matchItems = drawMatchSets(subjectId, chapterIds, N_MATCH_SETS).map(function (s) {
      return {
        kind: 'match',
        id: s.id,
        ch: s.ch,
        title: s.title,
        items: s.items.map(function (it) { return { q: it.q, answer: it.answer }; }),
        pool: shuffle(s.items.map(function (it) { return it.answer; })),
        filled: [null, null, null, null, null],
        ref: s.ref,
        done: false
      };
    });

    var fillItems = drawSpread(fillPool, chapterIds, Math.min(N_FILL, fillPool.length)).map(function (q) {
      return {
        kind: 'fill',
        id: q.id,
        ch: q.ch,
        q: q.q,
        accept: q.accept,
        hint: q.hint,
        explain: q.explain,
        ref: q.ref,
        typed: '',
        correct: false,
        done: false
      };
    });

    return {
      startedAt: Date.now(),
      elapsed: 0,
      subject: subjectId,
      chapters: chapterIds.slice(),
      prefs: {
        instant: state.prefs.instant,
        shuffleChoices: state.prefs.shuffleChoices,
        timer: state.prefs.timer,
        mix: state.prefs.mix
      },
      steps: mcItems.concat(matchItems, fillItems),
      index: 0
    };
  }

  /* --------------------------- การนับคะแนนของแต่ละก้าว --------------------------- */
  function stepPoints(step) {
    if (step.kind === 'mc') return step.picked === step.answer ? 1 : 0;
    if (step.kind === 'fill') return step.correct ? 1 : 0;
    return step.items.reduce(function (sum, item, i) {
      return sum + (step.filled[i] === item.answer ? 1 : 0);
    }, 0);
  }

  function stepMax(step) { return step.kind === 'match' ? step.items.length : 1; }

  function quizScore(quiz) {
    return quiz.steps.reduce(function (sum, s) { return sum + (s.done ? stepPoints(s) : 0); }, 0);
  }

  function questionNumber(quiz, index) {
    var n = 0;
    for (var i = 0; i < index; i++) n += stepMax(quiz.steps[i]);
    return n + 1;
  }

  function quizTotal(quiz) {
    return quiz.steps.reduce(function (sum, s) { return sum + stepMax(s); }, 0);
  }

  /* ============================== หน้าแรก ============================== */
  function renderSubjectCards() {
    var host = $('subjectCards');
    host.textContent = '';
    EXAM.subjects.forEach(function (subj) {
      var total = EXAM.count(subj.id);
      var card = el('button', 'subject-card');
      card.type = 'button';
      card.setAttribute('aria-pressed', state.subject === subj.id ? 'true' : 'false');
      card.appendChild(el('span', 'subject-icon', subj.icon || '📘'));
      var body = el('div', 'subject-body');
      body.appendChild(el('b', null, subj.name));
      body.appendChild(el('small', null, subj.note + ' · คลัง ' + (total.mc + total.fill + total.matchSets * 5) + ' ข้อ'));
      card.appendChild(body);
      card.addEventListener('click', function () {
        state.subject = subj.id;
        savePrefs();
        renderHome();
      });
      host.appendChild(card);
    });
  }

  function renderHome() {
    if (!state.subject) state.subject = EXAM.subjects[0].id;
    var subjectId = state.subject;
    var subject = subjectById(subjectId);
    $('brandSub').textContent = subject.short + ' · ' + subject.note;

    renderSubjectCards();

    /* สถิติของวิชาที่เลือก */
    var history = storageGet(KEY_HISTORY, []).filter(function (r) { return r.subject === subjectId; });
    var stats = $('homeStats');
    stats.textContent = '';
    var best = history.reduce(function (m, r) { return Math.max(m, r.percent); }, 0);
    var avg = history.length
      ? Math.round(history.reduce(function (s2, r) { return s2 + r.percent; }, 0) / history.length)
      : 0;
    [
      [history.length, 'รอบที่ทำแล้ว'],
      [history.length ? avg + '%' : '—', 'คะแนนเฉลี่ย'],
      [history.length ? best + '%' : '—', 'คะแนนสูงสุด']
    ].forEach(function (pair) {
      var box = el('div', 'stat');
      box.appendChild(el('b', null, String(pair[0])));
      box.appendChild(el('span', null, pair[1]));
      stats.appendChild(box);
    });

    /* ชิปเลือกบทของวิชานี้ */
    var chosen = selectedChapters(subjectId);
    var grid = $('chapterChips');
    grid.textContent = '';
    chaptersOf(subjectId).forEach(function (c) {
      var n = EXAM.count(subjectId, [c.id]);
      var chip = el('button', 'chip');
      chip.type = 'button';
      chip.setAttribute('aria-pressed', chosen.indexOf(c.id) !== -1 ? 'true' : 'false');
      chip.appendChild(el('span', 'chip-check', '✓'));
      var body = el('div', 'chip-body');
      body.appendChild(el('b', null, 'บทที่ ' + c.no + ' ' + c.title));
      body.appendChild(el('small', null,
        'ปรนัย ' + n.mc + ' (วิเคราะห์ ' + n.analysis + ') · เติมคำ ' + n.fill + ' · จับคู่ ' + n.matchSets + ' ชุด'));
      chip.appendChild(body);
      chip.addEventListener('click', function () {
        var list = selectedChapters(subjectId);
        var at = list.indexOf(c.id);
        if (at === -1) list.push(c.id); else list.splice(at, 1);
        savePrefs();
        renderHome();
      });
      grid.appendChild(chip);
    });

    /* สรุปคลังข้อสอบ + ปุ่มเริ่ม */
    var n = EXAM.count(subjectId, chosen);
    var startBtn = $('startBtn');
    var note = $('bankNote');
    if (!chosen.length) {
      note.textContent = 'ยังไม่ได้เลือกบท — เลือกอย่างน้อย 1 บทเพื่อเริ่มทำข้อสอบ';
      startBtn.disabled = true;
      startBtn.textContent = 'เลือกบทก่อนเริ่มทำข้อสอบ';
    } else {
      var willMc = Math.min(N_MC, n.mc);
      var willFill = Math.min(N_FILL, n.fill);
      var willMatch = Math.min(N_MATCH_SETS, n.matchSets) * 5;
      var total = willMc + willFill + willMatch;
      note.textContent = 'คลังของบทที่เลือก: ปรนัย ' + n.mc + ' ข้อ (วิเคราะห์ ' + n.analysis +
        ' / ความจำ ' + n.recall + ') · เติมคำ ' + n.fill + ' ข้อ · จับคู่ ' + n.matchSets + ' ชุด' +
        (total < TOTAL ? ' — รอบนี้จะได้ ' + total + ' ข้อ (คลังของบทที่เลือกมีไม่พอ ' + TOTAL + ' ข้อ)' : '');
      startBtn.disabled = false;
      startBtn.textContent = 'เริ่มทำข้อสอบ ' + total + ' ข้อ';
    }

    /* คำอธิบายสัดส่วนข้อวิเคราะห์ */
    var wantAnalysis = Math.min(Math.round(N_MC * MIX_RATIO[state.prefs.mix]), n.analysis);
    var wantRecall = Math.min(Math.min(N_MC, n.mc) - wantAnalysis, n.recall);
    wantAnalysis = Math.min(Math.min(N_MC, n.mc) - wantRecall, n.analysis);
    $('mixNote').textContent = chosen.length
      ? 'ตอนปรนัยรอบนี้: ข้อวิเคราะห์ ' + wantAnalysis + ' ข้อ · ข้อความจำ ' + wantRecall + ' ข้อ'
      : '';
    var mixButtons = $('mixSeg').querySelectorAll('.seg-btn');
    for (var i = 0; i < mixButtons.length; i++) {
      mixButtons[i].classList.toggle('is-active', mixButtons[i].dataset.mix === state.prefs.mix);
    }

    /* ข้อสอบที่ค้างไว้ */
    var saved = storageGet(KEY_SESSION, null);
    var resumeCard = $('resumeCard');
    if (saved && saved.steps && saved.index < saved.steps.length) {
      resumeCard.hidden = false;
      $('resumeInfo').textContent = 'วิชา' + subjectLabel(saved.subject) + ' · ทำค้างไว้เมื่อ ' +
        fmtDate(saved.startedAt) + ' — ถึงข้อ ' + questionNumber(saved, saved.index) +
        ' จาก ' + quizTotal(saved) + ' ข้อ';
    } else {
      resumeCard.hidden = true;
    }

    $('optInstant').checked = state.prefs.instant;
    $('optShuffleChoices').checked = state.prefs.shuffleChoices;
    $('optTimer').checked = state.prefs.timer;
  }

  function savePrefs() {
    storageSet(KEY_PREFS, { subject: state.subject, selected: state.selected, prefs: state.prefs });
  }

  /* ============================== นาฬิกาจับเวลา ============================== */
  function startTicking() {
    stopTicking();
    if (!state.quiz || !state.quiz.prefs.timer) return;
    state.tick = setInterval(function () {
      state.quiz.elapsed += 1;
      $('liveTimer').textContent = fmtTime(state.quiz.elapsed);
    }, 1000);
  }

  function stopTicking() {
    if (state.tick) { clearInterval(state.tick); state.tick = null; }
  }

  /* =============================== หน้าข้อสอบ =============================== */
  function updateProgress() {
    var quiz = state.quiz;
    var total = quizTotal(quiz);
    var answered = questionNumber(quiz, quiz.index) - 1;
    $('progressFill').style.width = Math.round((answered / total) * 100) + '%';
    $('progressLabel').textContent = 'ข้อ ' + Math.min(questionNumber(quiz, quiz.index), total) + ' / ' + total;
    $('liveScore').textContent = quiz.prefs.instant ? 'คะแนน ' + quizScore(quiz) : 'โหมดไม่เฉลยทันที';
    $('liveTimer').textContent = quiz.prefs.timer ? fmtTime(quiz.elapsed) : '—';
  }

  function sectionOf(step) {
    if (step.kind === 'mc') return 'ตอนที่ 1 · ปรนัย (เลือกคำตอบที่ถูกที่สุด)';
    if (step.kind === 'match') return 'ตอนที่ 2 · จับคู่คำลงช่องว่าง';
    return 'ตอนที่ 3 · เติมคำในช่องว่าง';
  }

  function questionMeta(step, quiz) {
    var meta = el('div', 'q-meta');
    meta.appendChild(el('span', 'tag', chapterLabel(step.ch)));
    if (step.kind === 'match') {
      var from = questionNumber(quiz, quiz.index);
      meta.appendChild(el('span', 'tag', 'ข้อ ' + from + '–' + (from + step.items.length - 1)));
      meta.appendChild(el('span', 'tag', step.items.length + ' คะแนน'));
    } else {
      meta.appendChild(el('span', 'tag', 'ข้อ ' + questionNumber(quiz, quiz.index)));
    }
    if (step.kind === 'mc' && step.type === 'analysis') {
      meta.appendChild(el('span', 'tag tag-analysis', '🔍 วิเคราะห์'));
    }
    return meta;
  }

  /** แทรกข้อความโจทย์ที่มี ____ ให้เป็นช่องว่างที่อ่านง่าย */
  function questionText(text) {
    var node = el('div', 'q-text');
    String(text).split('____').forEach(function (chunk, i) {
      if (i > 0) node.appendChild(el('span', 'blank', ' ______ '));
      node.appendChild(document.createTextNode(chunk));
    });
    return node;
  }

  function feedbackBox(kind, headText, bodyText, refText) {
    var box = el('div', 'feedback ' + kind);
    box.setAttribute('role', 'status');
    var head = el('div', 'feedback-head');
    head.appendChild(document.createTextNode(
      (kind === 'ok' ? '✅ ' : kind === 'bad' ? '❌ ' : '◐ ') + headText
    ));
    box.appendChild(head);
    if (bodyText) box.appendChild(el('div', 'feedback-body', bodyText));
    if (refText) box.appendChild(el('div', 'feedback-ref', '📖 ที่มา: ' + refText));
    return box;
  }

  function renderStep() {
    var quiz = state.quiz;
    var step = quiz.steps[quiz.index];
    var host = $('questionHost');
    host.textContent = '';
    $('sectionBadge').textContent = sectionOf(step);

    var card = el('div', 'q-card');
    card.appendChild(questionMeta(step, quiz));

    if (step.kind === 'mc') renderMC(card, step);
    else if (step.kind === 'fill') renderFill(card, step);
    else renderMatch(card, step);

    host.appendChild(card);
    updateProgress();

    var next = $('nextBtn');
    var isLast = quiz.index === quiz.steps.length - 1;
    next.textContent = isLast ? 'ดูผลคะแนน' : 'ข้อถัดไป';
    next.disabled = !step.done;
  }

  /* ------------------------------- ปรนัย ------------------------------- */
  function renderMC(card, step) {
    card.appendChild(questionText(step.q));

    var list = el('div', 'choices');
    step.choices.forEach(function (text, i) {
      var btn = el('button', 'choice');
      btn.type = 'button';
      btn.appendChild(el('span', 'choice-key', CHOICE_KEYS[i] || String(i + 1)));
      btn.appendChild(el('span', 'choice-text', text));
      btn.addEventListener('click', function () { answerMC(step, i); });
      list.appendChild(btn);
    });
    card.appendChild(list);

    var hint = el('div', 'kbd-hint', 'คีย์ลัด: กด 1–' + step.choices.length + ' เพื่อตอบ · กด Enter เพื่อไปข้อถัดไป');
    card.appendChild(hint);

    if (step.done) paintMC(step);
  }

  function paintMC(step) {
    var buttons = $('questionHost').querySelectorAll('.choice');
    var instant = state.quiz.prefs.instant;
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.remove('is-picked', 'is-correct', 'is-wrong');
      buttons[i].disabled = instant;               // โหมดไม่เฉลยทันที: ยังเปลี่ยนคำตอบได้
      buttons[i].setAttribute('aria-pressed', i === step.picked ? 'true' : 'false');
      if (!instant) {
        if (i === step.picked) buttons[i].classList.add('is-picked');
      } else if (i === step.answer) {
        buttons[i].classList.add('is-correct');
      } else if (i === step.picked) {
        buttons[i].classList.add('is-wrong');
      }
    }
    if (!instant) return;
    var ok = step.picked === step.answer;
    var card = $('questionHost').querySelector('.q-card');
    if (card.querySelector('.feedback')) return;
    card.appendChild(feedbackBox(
      ok ? 'ok' : 'bad',
      ok ? 'ถูกต้อง!' : 'ยังไม่ถูก — คำตอบที่ถูกคือ ' + (CHOICE_KEYS[step.answer] || '') + '. ' + step.choices[step.answer],
      step.explain,
      step.ref
    ));
  }

  function answerMC(step, index) {
    if (step.done && state.quiz.prefs.instant) return;
    step.picked = index;
    step.done = true;
    paintMC(step);
    afterAnswer();
  }

  /* ------------------------------ เติมคำ ------------------------------ */
  function renderFill(card, step) {
    card.appendChild(questionText(step.q));

    var form = el('form', 'fill-form');
    form.setAttribute('novalidate', 'novalidate');

    var input = el('input', 'fill-input');
    input.type = 'text';
    input.placeholder = 'พิมพ์คำตอบลงในช่องนี้';
    input.autocomplete = 'off';
    input.autocapitalize = 'off';
    input.spellcheck = false;
    input.value = step.typed || '';
    input.disabled = step.done;
    form.appendChild(input);

    if (step.hint) form.appendChild(el('div', 'hint', '💡 ใบ้: ' + step.hint));

    var submit = el('button', 'btn btn-primary', 'ตรวจคำตอบ');
    submit.type = 'submit';
    submit.disabled = step.done;
    form.appendChild(submit);

    form.addEventListener('submit', function (ev) {
      ev.preventDefault();
      if (step.done) return;
      if (!input.value.trim()) { input.focus(); toast('กรุณาพิมพ์คำตอบก่อนกดตรวจ'); return; }
      step.typed = input.value;
      step.correct = step.accept.some(function (a) { return normalize(a) === normalize(step.typed); });
      step.done = true;
      input.disabled = true;
      submit.disabled = true;
      if (state.quiz.prefs.instant) {
        input.classList.add(step.correct ? 'is-correct' : 'is-wrong');
        card.appendChild(feedbackBox(
          step.correct ? 'ok' : 'bad',
          step.correct ? 'ถูกต้อง!' : 'ยังไม่ถูก — คำตอบที่ถูกคือ "' + step.accept[0] + '"',
          step.explain,
          step.ref
        ));
      }
      afterAnswer();
    });

    card.appendChild(form);

    if (step.done) {
      if (state.quiz.prefs.instant) input.classList.add(step.correct ? 'is-correct' : 'is-wrong');
    } else {
      setTimeout(function () { input.focus({ preventScroll: true }); }, 60);
    }
  }

  /* ----------------------------- จับคู่คำ ----------------------------- */
  function renderMatch(card, step) {
    card.appendChild(el('div', 'q-text', step.title));
    card.appendChild(el('p', 'match-help',
      'แตะคำในกล่องด้านล่าง แล้วแตะช่องว่างที่ต้องการ (หรือแตะช่องว่างก่อนก็ได้) — ใช้คำละ 1 ครั้ง ครบ 5 ข้อแล้วกด "ตรวจคำตอบ"'));

    var activeSlot = { index: step.filled.indexOf(null) };

    var pool = el('div', 'word-pool');
    var list = el('div', 'match-list');
    var checkBtn = el('button', 'btn btn-primary', 'ตรวจคำตอบ');
    checkBtn.type = 'button';
    var clearBtn = el('button', 'btn btn-ghost', 'ล้างคำตอบ');
    clearBtn.type = 'button';

    function wordUsed(word) { return step.filled.indexOf(word) !== -1; }

    function paint() {
      pool.textContent = '';
      step.pool.forEach(function (word) {
        var chip = el('button', 'word' + (wordUsed(word) ? ' is-used' : ''), word);
        chip.type = 'button';
        chip.disabled = step.done;
        chip.addEventListener('click', function () {
          if (step.done) return;
          if (wordUsed(word)) {                       // แตะคำที่ใช้แล้ว = ดึงกลับ
            step.filled[step.filled.indexOf(word)] = null;
          } else {
            var slot = activeSlot.index;
            if (slot == null || slot < 0 || step.filled[slot] != null) slot = step.filled.indexOf(null);
            if (slot === -1) { toast('ช่องว่างเต็มแล้ว — แตะช่องที่ต้องการแก้ก่อน'); return; }
            step.filled[slot] = word;
            activeSlot.index = step.filled.indexOf(null);
          }
          paint();
        });
        pool.appendChild(chip);
      });

      list.textContent = '';
      step.items.forEach(function (item, i) {
        var row = el('div', 'match-item');
        if (!step.done && activeSlot.index === i) row.classList.add('is-active');
        if (step.done && state.quiz.prefs.instant) {
          row.classList.add(step.filled[i] === item.answer ? 'is-correct' : 'is-wrong');
        }
        row.appendChild(el('span', 'match-no', String(i + 1)));

        var body = el('div', 'match-body');
        var q = el('div', 'match-q');
        String(item.q).split('____').forEach(function (chunk, k) {
          if (k > 0) {
            var slot = el('button', 'slot' + (step.filled[i] ? ' is-filled' : ''), step.filled[i] || 'เลือกคำ');
            slot.type = 'button';
            slot.disabled = step.done;
            slot.addEventListener('click', function () {
              if (step.done) return;
              if (step.filled[i]) step.filled[i] = null;
              activeSlot.index = i;
              paint();
            });
            q.appendChild(slot);
          }
          q.appendChild(document.createTextNode(chunk));
        });
        body.appendChild(q);

        if (step.done && state.quiz.prefs.instant && step.filled[i] !== item.answer) {
          var ans = el('div', 'match-answer');
          ans.appendChild(document.createTextNode('เฉลย: '));
          ans.appendChild(el('b', null, item.answer));
          body.appendChild(ans);
        }
        row.appendChild(body);
        list.appendChild(row);
      });

      var filledCount = step.filled.filter(function (w) { return w != null; }).length;
      checkBtn.disabled = step.done || filledCount < step.items.length;
      checkBtn.textContent = step.done ? 'ตรวจแล้ว'
        : filledCount < step.items.length ? 'ตรวจคำตอบ (เติมแล้ว ' + filledCount + '/' + step.items.length + ')'
          : 'ตรวจคำตอบ';
      clearBtn.disabled = step.done || filledCount === 0;
    }

    checkBtn.addEventListener('click', function () {
      if (step.done) return;
      step.done = true;
      paint();
      if (state.quiz.prefs.instant) {
        var got = stepPoints(step);
        card.appendChild(feedbackBox(
          got === step.items.length ? 'ok' : got === 0 ? 'bad' : 'partial',
          'ได้ ' + got + ' จาก ' + step.items.length + ' คะแนน',
          got === step.items.length ? 'จับคู่ถูกทุกข้อ' : 'ข้อที่ยังไม่ถูกมีเฉลยกำกับไว้ใต้ข้อนั้นแล้ว',
          step.ref
        ));
      }
      afterAnswer();
    });

    clearBtn.addEventListener('click', function () {
      if (step.done) return;
      step.filled = step.items.map(function () { return null; });
      activeSlot.index = 0;
      paint();
    });

    card.appendChild(pool);
    card.appendChild(list);
    var row = el('div', 'btn-row');
    row.appendChild(clearBtn);
    row.appendChild(checkBtn);
    card.appendChild(row);
    paint();
  }

  /* --------------------------- หลังตอบแต่ละข้อ --------------------------- */
  function afterAnswer() {
    updateProgress();
    $('nextBtn').disabled = false;
    saveSession();
  }

  function goNext() {
    var quiz = state.quiz;
    if (quiz.index >= quiz.steps.length - 1) { finishQuiz(); return; }
    quiz.index += 1;
    saveSession();
    renderStep();
  }

  function saveSession() {
    if (state.quiz) storageSet(KEY_SESSION, state.quiz);
  }

  /* ============================== จบข้อสอบ ============================== */
  function finishQuiz() {
    var quiz = state.quiz;
    stopTicking();
    storageDel(KEY_SESSION);

    var total = quizTotal(quiz);
    var score = quizScore(quiz);
    var percent = total ? Math.round((score / total) * 100) : 0;

    var bySection = { mc: { got: 0, max: 0 }, match: { got: 0, max: 0 }, fill: { got: 0, max: 0 } };
    var byType = { analysis: { got: 0, max: 0 }, recall: { got: 0, max: 0 } };
    var byChapter = {};
    quiz.steps.forEach(function (step) {
      var got = stepPoints(step), max = stepMax(step);
      bySection[step.kind].got += got;
      bySection[step.kind].max += max;
      if (step.kind === 'mc') {
        var bucket = step.type === 'analysis' ? byType.analysis : byType.recall;
        bucket.got += got;
        bucket.max += max;
      }
      if (!byChapter[step.ch]) byChapter[step.ch] = { got: 0, max: 0 };
      byChapter[step.ch].got += got;
      byChapter[step.ch].max += max;
    });

    var result = {
      at: Date.now(),
      subject: quiz.subject,
      score: score,
      total: total,
      percent: percent,
      seconds: quiz.elapsed,
      chapters: quiz.chapters.slice(),
      bySection: bySection,
      byType: byType,
      byChapter: byChapter,
      steps: quiz.steps
    };

    state.lastResult = result;

    var history = storageGet(KEY_HISTORY, []);
    history.unshift({
      at: result.at,
      subject: quiz.subject,
      score: score,
      total: total,
      percent: percent,
      seconds: quiz.elapsed,
      chapters: result.chapters,
      bySection: bySection,
      byType: byType,
      byChapter: byChapter
    });
    if (history.length > 200) history.length = 200;
    if (!storageSet(KEY_HISTORY, history)) toast('บันทึกประวัติไม่สำเร็จ (พื้นที่เก็บข้อมูลเต็ม)');

    state.quiz = null;
    renderResult(result);
    show('result');
  }

  function gradeOf(percent) {
    if (percent >= 80) return { text: 'ยอดเยี่ยม (A)', cls: 'g-ok' };
    if (percent >= 70) return { text: 'ดี (B)', cls: 'g-ok' };
    if (percent >= 60) return { text: 'พอใช้ (C)', cls: '' };
    if (percent >= 50) return { text: 'ต้องทบทวน (D)', cls: '' };
    return { text: 'ต้องอ่านเพิ่ม (F)', cls: 'g-bad' };
  }

  function barRow(label, got, max) {
    var row = el('div', 'bar-row');
    row.appendChild(el('span', 'bar-label', label));
    var pct = max ? Math.round((got / max) * 100) : 0;
    row.appendChild(el('span', 'bar-value', got + '/' + max + ' · ' + pct + '%'));
    var track = el('div', 'bar-track');
    var fill = el('span', 'bar-fill' + (pct >= 70 ? ' ok' : pct < 50 ? ' bad' : ''));
    fill.style.width = pct + '%';
    track.appendChild(fill);
    row.appendChild(track);
    return row;
  }

  function renderResult(result) {
    var host = $('resultHost');
    host.textContent = '';

    var hero = el('div', 'score-hero');
    var big = el('div', 'score-big');
    big.appendChild(document.createTextNode(String(result.score)));
    var totalSpan = el('span', 'score-total', ' / ' + result.total);
    big.appendChild(totalSpan);
    hero.appendChild(big);
    hero.appendChild(el('div', 'score-total', 'คิดเป็น ' + result.percent + '%'));
    var g = gradeOf(result.percent);
    hero.appendChild(el('div', 'grade ' + g.cls, g.text));
    hero.appendChild(el('div', 'score-meta',
      'วิชา' + subjectLabel(result.subject) +
      ' · ใช้เวลา ' + (result.seconds ? fmtTime(result.seconds) : 'ไม่ได้จับเวลา') +
      ' · ' + fmtDate(result.at)));
    host.appendChild(hero);

    var sec = el('div', 'card');
    sec.appendChild(el('h2', 'card-title', 'คะแนนแยกตามตอน'));
    var secList = el('div', 'bar-list');
    secList.appendChild(barRow('ตอนที่ 1 · ปรนัย', result.bySection.mc.got, result.bySection.mc.max));
    secList.appendChild(barRow('ตอนที่ 2 · จับคู่คำลงช่องว่าง', result.bySection.match.got, result.bySection.match.max));
    secList.appendChild(barRow('ตอนที่ 3 · เติมคำ', result.bySection.fill.got, result.bySection.fill.max));
    sec.appendChild(secList);
    host.appendChild(sec);

    if (result.byType && (result.byType.analysis.max || result.byType.recall.max)) {
      var typeCard = el('div', 'card');
      typeCard.appendChild(el('h2', 'card-title', 'คะแนนตอนปรนัย แยกตามลักษณะข้อสอบ'));
      var typeList = el('div', 'bar-list');
      if (result.byType.recall.max) {
        typeList.appendChild(barRow('ข้อความจำ (นิยาม ตัวเลข องค์ประกอบ)', result.byType.recall.got, result.byType.recall.max));
      }
      if (result.byType.analysis.max) {
        typeList.appendChild(barRow('ข้อวิเคราะห์ (ยกสถานการณ์มาให้ตัดสิน)', result.byType.analysis.got, result.byType.analysis.max));
      }
      typeCard.appendChild(typeList);
      var a = result.byType.analysis, r = result.byType.recall;
      if (a.max && r.max) {
        var aPct = a.got / a.max, rPct = r.got / r.max;
        typeCard.appendChild(el('p', 'muted',
          Math.abs(aPct - rPct) < 0.1
            ? '📌 ทำได้พอ ๆ กันทั้งสองแบบ'
            : aPct < rPct
              ? '📌 ข้อวิเคราะห์ยังอ่อนกว่าข้อความจำ — ลองอ่านคำเฉลยของข้อที่ผิดว่าโจทย์ชี้ไปที่แนวคิดใด'
              : '📌 ข้อความจำยังอ่อนกว่าข้อวิเคราะห์ — ลองทบทวนตัวเลขและองค์ประกอบของแต่ละกรอบแนวคิด'));
      }
      host.appendChild(typeCard);
    }

    var chap = el('div', 'card');
    chap.appendChild(el('h2', 'card-title', 'คะแนนแยกตามบท'));
    var chapList = el('div', 'bar-list');
    chaptersOf(result.subject).forEach(function (c) {
      var data = result.byChapter[c.id];
      if (!data) return;
      chapList.appendChild(barRow('บทที่ ' + c.no + ' ' + c.title, data.got, data.max));
    });
    chap.appendChild(chapList);

    var weakest = null;
    chaptersOf(result.subject).forEach(function (c) {
      var d = result.byChapter[c.id];
      if (!d || !d.max) return;
      var p = d.got / d.max;
      if (!weakest || p < weakest.p) weakest = { c: c, p: p };
    });
    if (weakest && weakest.p < 0.7) {
      chap.appendChild(el('p', 'muted',
        '📌 ควรกลับไปทบทวน บทที่ ' + weakest.c.no + ' ' + weakest.c.title + ' มากที่สุด'));
    }
    host.appendChild(chap);

    var actions = el('div', 'btn-row');
    var reviewBtn = el('button', 'btn btn-primary', 'ทบทวนคำตอบทั้งหมด');
    reviewBtn.type = 'button';
    reviewBtn.addEventListener('click', function () { state.reviewFilter = 'all'; syncFilterButtons(); renderReview(); show('review'); });

    var againBtn = el('button', 'btn', 'สุ่มชุดใหม่ ทำอีกครั้ง');
    againBtn.type = 'button';
    againBtn.addEventListener('click', function () { startQuiz(result.subject, result.chapters); });

    var homeBtn = el('button', 'btn btn-ghost', 'กลับหน้าแรก');
    homeBtn.type = 'button';
    homeBtn.addEventListener('click', function () { renderHome(); show('home'); });

    actions.appendChild(reviewBtn);
    actions.appendChild(againBtn);
    actions.appendChild(homeBtn);
    host.appendChild(actions);
  }

  /* ============================= ทบทวนคำตอบ ============================= */
  function reviewRows(result) {
    var rows = [];
    result.steps.forEach(function (step) {
      if (step.kind === 'mc') {
        rows.push({
          right: step.picked === step.answer,
          ch: step.ch,
          q: step.q,
          mine: step.picked == null ? 'ไม่ได้ตอบ' : step.choices[step.picked],
          correct: step.choices[step.answer],
          explain: step.explain,
          ref: step.ref
        });
      } else if (step.kind === 'fill') {
        rows.push({
          right: step.correct,
          ch: step.ch,
          q: step.q.replace(/____/g, '______'),
          mine: step.typed || 'ไม่ได้ตอบ',
          correct: step.accept[0],
          explain: step.explain,
          ref: step.ref
        });
      } else {
        step.items.forEach(function (item, i) {
          rows.push({
            right: step.filled[i] === item.answer,
            ch: step.ch,
            q: '[' + step.title + '] ' + item.q.replace(/____/g, '______'),
            mine: step.filled[i] || 'ไม่ได้ตอบ',
            correct: item.answer,
            explain: '',
            ref: step.ref
          });
        });
      }
    });
    return rows;
  }

  function renderReview() {
    var result = state.lastResult;
    var host = $('reviewHost');
    host.textContent = '';
    if (!result) { host.appendChild(el('div', 'empty', 'ยังไม่มีผลสอบให้ทบทวน')); return; }

    var rows = reviewRows(result).filter(function (r) {
      return state.reviewFilter === 'all' || (state.reviewFilter === 'right' ? r.right : !r.right);
    });

    if (!rows.length) {
      host.appendChild(el('div', 'empty',
        state.reviewFilter === 'wrong' ? '🎉 ไม่มีข้อที่ตอบผิดเลย' : 'ไม่มีข้อในหมวดนี้'));
      return;
    }

    rows.forEach(function (r, i) {
      var item = el('div', 'review-item' + (r.right ? ' is-right' : ''));
      var head = el('div', 'review-q', (i + 1) + '. ' + r.q);
      item.appendChild(head);

      var mine = el('div', 'review-line');
      mine.appendChild(el('span', 'lbl', 'คำตอบของคุณ: '));
      mine.appendChild(el('span', r.right ? 'yes' : 'no', r.mine));
      item.appendChild(mine);

      if (!r.right) {
        var right = el('div', 'review-line');
        right.appendChild(el('span', 'lbl', 'คำตอบที่ถูก: '));
        right.appendChild(el('span', 'yes', r.correct));
        item.appendChild(right);
      }

      if (r.explain) item.appendChild(el('div', 'review-explain', r.explain));
      if (r.ref) item.appendChild(el('div', 'review-explain', '📖 ' + r.ref + ' · ' + chapterLabel(r.ch)));
      host.appendChild(item);
    });
  }

  function syncFilterButtons() {
    var buttons = $('reviewFilter').querySelectorAll('.seg-btn');
    for (var i = 0; i < buttons.length; i++) {
      buttons[i].classList.toggle('is-active', buttons[i].dataset.filter === state.reviewFilter);
    }
  }

  /* ============================= ประวัติคะแนน ============================= */
  function renderHistoryFilter() {
    var host = $('historyFilter');
    host.textContent = '';
    var options = [{ id: 'all', label: 'ทุกวิชา' }].concat(
      EXAM.subjects.map(function (s2) { return { id: s2.id, label: s2.short }; })
    );
    options.forEach(function (opt) {
      var btn = el('button', 'seg-btn' + (state.historyFilter === opt.id ? ' is-active' : ''), opt.label);
      btn.type = 'button';
      btn.addEventListener('click', function () {
        state.historyFilter = opt.id;
        renderHistory();
      });
      host.appendChild(btn);
    });
  }

  function renderHistory() {
    renderHistoryFilter();
    var host = $('historyHost');
    host.textContent = '';
    var history = storageGet(KEY_HISTORY, []).filter(function (r) {
      return state.historyFilter === 'all' || r.subject === state.historyFilter;
    });

    if (!history.length) {
      host.appendChild(el('div', 'empty', state.historyFilter === 'all'
        ? 'ยังไม่มีประวัติ — ทำข้อสอบสักรอบแล้วคะแนนจะถูกบันทึกไว้ที่นี่'
        : 'ยังไม่มีประวัติของวิชานี้'));
      return;
    }

    var best = history.reduce(function (m, r) { return Math.max(m, r.percent); }, 0);
    var avg = Math.round(history.reduce(function (s, r) { return s + r.percent; }, 0) / history.length);
    var last5 = history.slice(0, 5);
    var avg5 = Math.round(last5.reduce(function (s, r) { return s + r.percent; }, 0) / last5.length);

    var stats = el('div', 'stat-row');
    [[history.length, 'รอบทั้งหมด'], [avg + '%', 'เฉลี่ยทุกรอบ'], [best + '%', 'สูงสุด']].forEach(function (p) {
      var box = el('div', 'stat');
      box.appendChild(el('b', null, String(p[0])));
      box.appendChild(el('span', null, p[1]));
      stats.appendChild(box);
    });
    host.appendChild(stats);

    var chartCard = el('div', 'card');
    chartCard.appendChild(el('h2', 'card-title', 'แนวโน้มคะแนน (เรียงจากเก่าไปใหม่)'));
    var spark = el('div', 'spark');
    history.slice(0, 30).reverse().forEach(function (r) {
      var bar = el('div', 'spark-bar');
      bar.style.height = Math.max(6, Math.round(r.percent * 0.8)) + '%';
      bar.title = fmtDate(r.at) + ' — ' + r.score + '/' + r.total + ' (' + r.percent + '%)';
      spark.appendChild(bar);
    });
    chartCard.appendChild(spark);
    chartCard.appendChild(el('p', 'muted', 'ค่าเฉลี่ย 5 รอบล่าสุด: ' + avg5 + '%'));
    host.appendChild(chartCard);

    history.forEach(function (record) {
      var row = el('div', 'history-item');
      var badge = el('div', 'history-score' + (record.percent >= 70 ? ' ok' : record.percent < 50 ? ' bad' : ''),
        record.percent + '%');
      row.appendChild(badge);
      row.appendChild(el('div', 'history-when', fmtDate(record.at)));

      var subjectChapters = record.subject ? chaptersOf(record.subject).length : 0;
      var chapterText = record.chapters && subjectChapters && record.chapters.length === subjectChapters
        ? 'ทุกบท'
        : (record.chapters || []).map(function (id) { return chapterLabel(id).replace('บทที่ ', 'บท '); }).join(', ');
      var typeText = record.byType && record.byType.analysis.max
        ? ' · วิเคราะห์ ' + record.byType.analysis.got + '/' + record.byType.analysis.max
        : '';

      var parts = record.bySection
        ? ' · ปรนัย ' + record.bySection.mc.got + '/' + record.bySection.mc.max +
          ' · จับคู่ ' + record.bySection.match.got + '/' + record.bySection.match.max +
          ' · เติมคำ ' + record.bySection.fill.got + '/' + record.bySection.fill.max
        : '';

      row.appendChild(el('div', 'history-sub',
        (record.subject ? 'วิชา' + subjectLabel(record.subject) + ' · ' : '') +
        record.score + '/' + record.total + ' คะแนน · ' + (record.seconds ? fmtTime(record.seconds) : 'ไม่จับเวลา') +
        ' · ' + chapterText + parts + typeText));

      var del = el('button', 'history-del', '🗑');
      del.type = 'button';
      del.title = 'ลบรอบนี้';
      del.addEventListener('click', function () {
        // กรองด้วย timestamp ไม่ใช่ index เพราะรายการที่แสดงอาจถูกกรองตามวิชาไว้แล้ว
        var kept = storageGet(KEY_HISTORY, []).filter(function (r) { return r.at !== record.at; });
        storageSet(KEY_HISTORY, kept);
        renderHistory();
        toast('ลบแล้ว');
      });
      row.appendChild(del);
      host.appendChild(row);
    });
  }

  /* ============================== เริ่ม / ออก ============================== */
  function startQuiz(subjectId, chapterIds) {
    var subject = subjectId || state.subject;
    var ids = (chapterIds && chapterIds.length ? chapterIds : selectedChapters(subject))
      .filter(function (id) {
        var c = chapterById(id);
        return c && c.subject === subject;
      });
    if (!ids.length) { toast('เลือกบทอย่างน้อย 1 บทก่อน'); return; }

    state.quiz = buildQuiz(subject, ids);
    if (!state.quiz.steps.length) { toast('คลังข้อสอบของบทที่เลือกว่างเปล่า'); return; }
    saveSession();
    show('quiz');
    renderStep();
    startTicking();
  }

  function resumeQuiz(saved) {
    state.quiz = saved;
    show('quiz');
    renderStep();
    startTicking();
  }

  function quitQuiz() {
    if (!confirm('ออกจากข้อสอบตอนนี้? ข้อสอบจะถูกเก็บไว้ให้ทำต่อภายหลัง')) return;
    stopTicking();
    saveSession();
    state.quiz = null;
    renderHome();
    show('home');
  }

  /* ============================ นำเข้า / ส่งออก ============================ */
  function exportHistory() {
    var history = storageGet(KEY_HISTORY, []);
    if (!history.length) { toast('ยังไม่มีประวัติให้บันทึก'); return; }
    var blob = new Blob([JSON.stringify({ app: 'exam-sales-ch4-8', version: 1, history: history }, null, 2)],
      { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ประวัติคะแนนข้อสอบ-' + new Date().toISOString().slice(0, 10) + '.json';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  function importHistory(file) {
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        var incoming = Array.isArray(data) ? data : data.history;
        if (!Array.isArray(incoming)) throw new Error('รูปแบบไฟล์ไม่ถูกต้อง');
        var current = storageGet(KEY_HISTORY, []);
        var seen = {};
        current.forEach(function (r) { seen[r.at] = true; });
        var added = 0;
        incoming.forEach(function (r) {
          if (r && typeof r.at === 'number' && !seen[r.at]) { current.push(r); seen[r.at] = true; added++; }
        });
        current.sort(function (a, b) { return b.at - a.at; });
        storageSet(KEY_HISTORY, current);
        renderHistory();
        toast('นำเข้าเพิ่ม ' + added + ' รอบ');
      } catch (err) {
        toast('อ่านไฟล์ไม่สำเร็จ: ' + err.message);
      }
    };
    reader.readAsText(file);
  }

  /* ============================== คีย์ลัดเดสก์ท็อป ============================== */
  function onKeydown(ev) {
    if (state.screen !== 'quiz' || !state.quiz) return;
    var tag = (ev.target && ev.target.tagName) || '';
    if (tag === 'INPUT' || tag === 'TEXTAREA') return;

    var step = state.quiz.steps[state.quiz.index];
    if (ev.key === 'Enter' && !$('nextBtn').disabled) { ev.preventDefault(); goNext(); return; }
    if (step.kind === 'mc' && !step.done) {
      var n = parseInt(ev.key, 10);
      if (n >= 1 && n <= step.choices.length) { ev.preventDefault(); answerMC(step, n - 1); }
    }
  }

  /* ================================ เริ่มต้น ================================ */
  function init() {
    var problems = EXAM.validate();
    if (problems.length) console.warn('พบปัญหาในคลังข้อสอบ:', problems);

    var saved = storageGet(KEY_PREFS, null);
    state.subject = (saved && subjectById(saved.subject)) ? saved.subject : EXAM.subjects[0].id;
    if (saved && saved.selected && typeof saved.selected === 'object' && !Array.isArray(saved.selected)) {
      EXAM.subjects.forEach(function (subj) {
        var list = saved.selected[subj.id];
        if (Array.isArray(list)) {
          state.selected[subj.id] = list.filter(function (id) {
            var c = chapterById(id);
            return c && c.subject === subj.id;
          });
        }
      });
    }
    if (saved && saved.prefs) {
      state.prefs.instant = saved.prefs.instant !== false;
      state.prefs.shuffleChoices = saved.prefs.shuffleChoices !== false;
      state.prefs.timer = saved.prefs.timer !== false;
      if (MIX_RATIO[saved.prefs.mix] !== undefined) state.prefs.mix = saved.prefs.mix;
    }

    initTheme();

    $('brandBtn').addEventListener('click', function () {
      if (state.screen === 'quiz') { toast('กด "ออกจากข้อสอบ" ด้านล่างก่อน'); return; }
      renderHome(); show('home');
    });
    $('historyBtn').addEventListener('click', function () {
      if (state.screen === 'quiz') { toast('กด "ออกจากข้อสอบ" ด้านล่างก่อน'); return; }
      renderHistory(); show('history');
    });
    $('clearHistoryBtn').textContent = 'ล้างประวัติทั้งหมด';

    $('startBtn').addEventListener('click', function () { startQuiz(state.subject); });
    $('selectAllBtn').addEventListener('click', function () {
      state.selected[state.subject] = chaptersOf(state.subject).map(function (c) { return c.id; });
      savePrefs(); renderHome();
    });
    $('clearAllBtn').addEventListener('click', function () {
      state.selected[state.subject] = []; savePrefs(); renderHome();
    });
    $('mixSeg').addEventListener('click', function (ev) {
      var btn = ev.target.closest('.seg-btn');
      if (!btn) return;
      state.prefs.mix = btn.dataset.mix;
      savePrefs();
      renderHome();
    });

    ['optInstant', 'optShuffleChoices', 'optTimer'].forEach(function (id) {
      $(id).addEventListener('change', function () {
        state.prefs.instant = $('optInstant').checked;
        state.prefs.shuffleChoices = $('optShuffleChoices').checked;
        state.prefs.timer = $('optTimer').checked;
        savePrefs();
      });
    });

    $('resumeBtn').addEventListener('click', function () {
      var session = storageGet(KEY_SESSION, null);
      if (session && session.steps) resumeQuiz(session);
      else { toast('ไม่พบข้อสอบที่ค้างไว้'); renderHome(); }
    });
    $('discardBtn').addEventListener('click', function () {
      storageDel(KEY_SESSION); renderHome(); toast('ลบข้อสอบที่ค้างไว้แล้ว');
    });

    $('nextBtn').addEventListener('click', goNext);
    $('quitBtn').addEventListener('click', quitQuiz);

    $('reviewFilter').addEventListener('click', function (ev) {
      var btn = ev.target.closest('.seg-btn');
      if (!btn) return;
      state.reviewFilter = btn.dataset.filter;
      syncFilterButtons();
      renderReview();
    });
    $('reviewBackBtn').addEventListener('click', function () { show('result'); });

    $('historyHomeBtn').addEventListener('click', function () { renderHome(); show('home'); });
    $('exportBtn').addEventListener('click', exportHistory);
    $('importBtn').addEventListener('click', function () { $('importFile').click(); });
    $('importFile').addEventListener('change', function (ev) {
      if (ev.target.files && ev.target.files[0]) importHistory(ev.target.files[0]);
      ev.target.value = '';
    });
    $('clearHistoryBtn').addEventListener('click', function () {
      if (!confirm('ล้างประวัติคะแนนทั้งหมด? การกระทำนี้ย้อนกลับไม่ได้')) return;
      storageDel(KEY_HISTORY);
      renderHistory();
      toast('ล้างประวัติแล้ว');
    });

    document.addEventListener('keydown', onKeydown);
    window.addEventListener('beforeunload', function () { if (state.quiz) saveSession(); });

    renderHome();
    show('home');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
