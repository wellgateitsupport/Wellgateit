/* ==========================================================================
   bank.js — คลังข้อสอบกลาง (ลงทะเบียนวิชา/บทเรียน + ตรวจความถูกต้องของข้อมูล)
   โหลดเป็น classic script ก่อนไฟล์ใน data/ ทุกไฟล์
   ใช้ได้ทั้งเปิดจากไฟล์ตรง ๆ (file://) และเสิร์ฟผ่านเว็บ

   ชนิดของข้อปรนัย (field `type`)
     'analysis' — ข้อวิเคราะห์: ยกสถานการณ์/ตัวอย่างมาแล้วถามว่าเข้าข่ายแบบใด
     'recall'   — ข้อความจำ: ถามนิยาม ตัวเลข หรือองค์ประกอบตรง ๆ (ค่าเริ่มต้น)
   ========================================================================== */
(function () {
  'use strict';

  var CHOICES_PER_QUESTION = 5;   // ข้อปรนัยต้องมี 5 ตัวเลือกเสมอ
  var ITEMS_PER_MATCH_SET = 5;    // ชุดจับคู่ต้องมี 5 ข้อเสมอ

  var EXAM = {
    subjects: [],   // [{ id, name, en, short, teacher, note }]
    chapters: [],   // [{ id, subject, no, title, en }]
    mc: [],         // ปรนัย  { id, subject, ch, type, q, choices[5], answer, explain, ref }
    fill: [],       // เติมคำ { id, subject, ch, q, accept[], hint, explain, ref }
    matchSets: [],  // จับคู่  { id, subject, ch, title, items:[{ q, answer }]×5, ref }
    CHOICES_PER_QUESTION: CHOICES_PER_QUESTION,
    ITEMS_PER_MATCH_SET: ITEMS_PER_MATCH_SET
  };

  /** ลงทะเบียนวิชา — ต้องเรียกก่อน addChapter ของวิชานั้น */
  function addSubject(meta) {
    EXAM.subjects.push(meta);
  }

  /**
   * ลงทะเบียนข้อสอบของหนึ่งบท — เติม subject/ch/type ให้ทุกข้ออัตโนมัติ
   * @param {{id:string,subject:string,no:number,title:string,en:string}} meta
   * @param {{mc?:Array,fill?:Array,matchSets?:Array}} data
   */
  function addChapter(meta, data) {
    EXAM.chapters.push(meta);
    (data.mc || []).forEach(function (q) {
      q.subject = meta.subject;
      q.ch = meta.id;
      if (!q.type) q.type = 'recall';
      EXAM.mc.push(q);
    });
    (data.fill || []).forEach(function (q) {
      q.subject = meta.subject;
      q.ch = meta.id;
      EXAM.fill.push(q);
    });
    (data.matchSets || []).forEach(function (s) {
      s.subject = meta.subject;
      s.ch = meta.id;
      EXAM.matchSets.push(s);
    });
  }

  /**
   * เพิ่มข้อสอบเข้าบทที่ลงทะเบียนไว้แล้ว — ใช้เก็บข้อวิเคราะห์ไว้คนละไฟล์กับข้อความจำ
   * @param {string} chapterId รหัสบท เช่น 'sales-ch04'
   * @param {{mc?:Array,fill?:Array,matchSets?:Array}} data
   */
  function addQuestions(chapterId, data) {
    var chapter = null;
    EXAM.chapters.forEach(function (c) { if (c.id === chapterId) chapter = c; });
    if (!chapter) throw new Error('addQuestions: ไม่พบบท ' + chapterId);
    (data.mc || []).forEach(function (q) {
      q.subject = chapter.subject; q.ch = chapter.id;
      if (!q.type) q.type = 'recall';
      EXAM.mc.push(q);
    });
    (data.fill || []).forEach(function (q) {
      q.subject = chapter.subject; q.ch = chapter.id; EXAM.fill.push(q);
    });
    (data.matchSets || []).forEach(function (s) {
      s.subject = chapter.subject; s.ch = chapter.id; EXAM.matchSets.push(s);
    });
  }

  /** ตรวจคลังข้อสอบ คืนรายการปัญหาที่พบ (ควรว่างเปล่า) */
  function validate() {
    var problems = [];
    var seen = Object.create(null);
    var subjectIds = Object.create(null);
    var chapterIds = Object.create(null);

    EXAM.subjects.forEach(function (s) {
      if (subjectIds[s.id]) problems.push('วิชาซ้ำ: ' + s.id);
      subjectIds[s.id] = true;
    });

    EXAM.chapters.forEach(function (c) {
      if (chapterIds[c.id]) problems.push('บทซ้ำ: ' + c.id);
      chapterIds[c.id] = true;
      if (!subjectIds[c.subject]) problems.push(c.id + ': อ้างวิชาที่ไม่มีอยู่ (' + c.subject + ')');
    });

    function checkId(item, kind) {
      if (!item.id) { problems.push(kind + ': ไม่มี id'); return; }
      if (seen[item.id]) problems.push('id ซ้ำ: ' + item.id);
      seen[item.id] = true;
    }

    EXAM.mc.forEach(function (q) {
      checkId(q, 'ปรนัย');
      if (!Array.isArray(q.choices) || q.choices.length !== CHOICES_PER_QUESTION) {
        problems.push(q.id + ': ต้องมี ' + CHOICES_PER_QUESTION + ' ตัวเลือก (พบ ' +
          (Array.isArray(q.choices) ? q.choices.length : 0) + ')');
      }
      if (typeof q.answer !== 'number' || !q.choices || q.answer < 0 || q.answer >= q.choices.length) {
        problems.push(q.id + ': answer อยู่นอกช่วง');
      }
      if (q.choices && new Set(q.choices).size !== q.choices.length) problems.push(q.id + ': ตัวเลือกซ้ำกัน');
      if (q.type !== 'analysis' && q.type !== 'recall') problems.push(q.id + ': type ไม่ถูกต้อง (' + q.type + ')');
      if (!q.explain) problems.push(q.id + ': ไม่มีคำเฉลย');
    });

    EXAM.fill.forEach(function (q) {
      checkId(q, 'เติมคำ');
      if (!Array.isArray(q.accept) || !q.accept.length) problems.push(q.id + ': ไม่มีคำตอบที่ยอมรับ');
      if (q.q.indexOf('____') === -1) problems.push(q.id + ': โจทย์ไม่มีช่องว่าง ____');
      if (!q.explain) problems.push(q.id + ': ไม่มีคำเฉลย');
    });

    EXAM.matchSets.forEach(function (s) {
      checkId(s, 'จับคู่');
      if (!Array.isArray(s.items) || s.items.length !== ITEMS_PER_MATCH_SET) {
        problems.push(s.id + ': ต้องมี ' + ITEMS_PER_MATCH_SET + ' ข้อต่อชุด');
      }
      var words = (s.items || []).map(function (it) { return it.answer; });
      if (new Set(words).size !== words.length) problems.push(s.id + ': คำตอบในชุดซ้ำกัน');
      (s.items || []).forEach(function (it, i) {
        if (String(it.q).indexOf('____') === -1) problems.push(s.id + ' ข้อ ' + (i + 1) + ': ไม่มีช่องว่าง ____');
      });
    });

    return problems;
  }

  /** นับคลังข้อสอบของวิชาหนึ่ง (หรือของบทที่เลือก) */
  function count(subjectId, chapterIds) {
    function inScope(item) {
      if (item.subject !== subjectId) return false;
      return !chapterIds || chapterIds.indexOf(item.ch) !== -1;
    }
    var mc = EXAM.mc.filter(inScope);
    return {
      mc: mc.length,
      analysis: mc.filter(function (q) { return q.type === 'analysis'; }).length,
      recall: mc.filter(function (q) { return q.type === 'recall'; }).length,
      fill: EXAM.fill.filter(inScope).length,
      matchSets: EXAM.matchSets.filter(inScope).length
    };
  }

  EXAM.addSubject = addSubject;
  EXAM.addChapter = addChapter;
  EXAM.addQuestions = addQuestions;
  EXAM.validate = validate;
  EXAM.count = count;
  window.EXAM = EXAM;
  window.addSubject = addSubject;
  window.addChapter = addChapter;
  window.addQuestions = addQuestions;
})();
