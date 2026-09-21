/* ==========================================================================
   bank.js — คลังข้อสอบกลาง (ลงทะเบียนบทเรียน + ตรวจความถูกต้องของข้อมูล)
   โหลดเป็น classic script ก่อนไฟล์ data-*.js ทุกไฟล์
   ใช้ได้ทั้งเปิดจากไฟล์ตรง ๆ (file://) และเสิร์ฟผ่านเว็บ
   ========================================================================== */
(function () {
  'use strict';

  var EXAM = {
    chapters: [],   // [{ id, no, title, en }]
    mc: [],         // ปรนัย  { id, ch, q, choices[], answer, explain, ref }
    fill: [],       // เติมคำ { id, ch, q, accept[], hint, explain, ref }
    matchSets: []   // จับคู่  { id, ch, title, items:[{ q, answer }], explain, ref }
  };

  /**
   * ลงทะเบียนข้อสอบของหนึ่งบท — เติม ch ให้ทุกข้ออัตโนมัติ
   * @param {{id:string,no:number,title:string,en:string}} meta
   * @param {{mc?:Array,fill?:Array,matchSets?:Array}} data
   */
  function addChapter(meta, data) {
    EXAM.chapters.push(meta);
    (data.mc || []).forEach(function (q) { q.ch = meta.id; EXAM.mc.push(q); });
    (data.fill || []).forEach(function (q) { q.ch = meta.id; EXAM.fill.push(q); });
    (data.matchSets || []).forEach(function (s) { s.ch = meta.id; EXAM.matchSets.push(s); });
  }

  /** ตรวจคลังข้อสอบ คืนรายการปัญหาที่พบ (ควรว่างเปล่า) */
  function validate() {
    var problems = [];
    var seen = Object.create(null);

    function id(item, kind) {
      if (!item.id) { problems.push(kind + ': ไม่มี id'); return; }
      if (seen[item.id]) problems.push('id ซ้ำ: ' + item.id);
      seen[item.id] = true;
    }

    EXAM.mc.forEach(function (q) {
      id(q, 'ปรนัย');
      if (!Array.isArray(q.choices) || q.choices.length < 2) problems.push(q.id + ': ตัวเลือกไม่ครบ');
      if (typeof q.answer !== 'number' || q.answer < 0 || q.answer >= q.choices.length) problems.push(q.id + ': answer อยู่นอกช่วง');
      if (new Set(q.choices).size !== q.choices.length) problems.push(q.id + ': ตัวเลือกซ้ำกัน');
      if (!q.explain) problems.push(q.id + ': ไม่มีคำเฉลย');
    });

    EXAM.fill.forEach(function (q) {
      id(q, 'เติมคำ');
      if (!Array.isArray(q.accept) || !q.accept.length) problems.push(q.id + ': ไม่มีคำตอบที่ยอมรับ');
      if (q.q.indexOf('____') === -1) problems.push(q.id + ': โจทย์ไม่มีช่องว่าง ____');
      if (!q.explain) problems.push(q.id + ': ไม่มีคำเฉลย');
    });

    EXAM.matchSets.forEach(function (s) {
      id(s, 'จับคู่');
      if (!Array.isArray(s.items) || s.items.length !== 5) problems.push(s.id + ': ต้องมี 5 ข้อต่อชุด');
      var words = (s.items || []).map(function (it) { return it.answer; });
      if (new Set(words).size !== words.length) problems.push(s.id + ': คำตอบในชุดซ้ำกัน');
    });

    return problems;
  }

  EXAM.addChapter = addChapter;
  EXAM.validate = validate;
  window.EXAM = EXAM;
  window.addChapter = addChapter;
})();
