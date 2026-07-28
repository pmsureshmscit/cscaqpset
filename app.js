(function(){
"use strict";

const RAW = JSON.parse(document.getElementById('qp-data').textContent);

const SUBJECTS = {
  cs_tm: { label: "12th Computer Science — Tamil Medium", lang:"ta", short:"12th Comp. Science (TM)", chapters: RAW.cs_tm },
  cs_em: { label: "12th Computer Science — English Medium", lang:"en", short:"12th Computer Science (EM)", chapters: RAW.cs_em },
  ca_tm: { label: "12th Computer Applications — Tamil Medium", lang:"ta", short:"12th Comp. Applications (TM)", chapters: RAW.ca_tm },
  ca_em: { label: "12th Computer Applications — English Medium", lang:"en", short:"12th Computer Applications (EM)", chapters: RAW.ca_em },
};

const SCHEMES = {
  25: { mcqCount:5, two:{show:4, answer:3}, three:{show:4, answer:3}, five:{items:1} },
  50: { mcqCount:10, two:{show:7, answer:5}, three:{show:7, answer:5}, five:{items:3} },
  70: { mcqCount:15, two:{show:8, answer:6}, three:{show:8, answer:6}, five:{items:5} },
};

const I18N = {
  en: {
    part1: "Part – I", instr1: "Answer all the questions. Choose the correct option.",
    part2: "Part – II", instr2: (n,m)=>`Answer any ${m} of the following ${n} questions.`,
    part3: "Part – III", instr3: (n,m)=>`Answer any ${m} of the following ${n} questions.`,
    part4: "Part – IV", instr4: "Answer all the following questions, choosing either (a) or (b) in each.",
    or: "OR", timeDefault:"3:00 Hrs", marksLabel:"Marks", timeLabel:"Time",
    noQuestions:"Not enough questions were available in the selected chapters for this section — showing all that could be found.",
  },
  ta: {
    part1: "பகுதி – I", instr1: "அனைத்து வினாக்களுக்கும் விடையளிக்கவும். சரியான விடையைத் தேர்ந்தெடுக்கவும்.",
    part2: "பகுதி – II", instr2: (n,m)=>`கொடுக்கப்பட்ட ${n} வினாக்களில் ஏதேனும் ${m}-ற்கு விடையளிக்கவும்.`,
    part3: "பகுதி – III", instr3: (n,m)=>`கொடுக்கப்பட்ட ${n} வினாக்களில் ஏதேனும் ${m}-ற்கு விடையளிக்கவும்.`,
    part4: "பகுதி – IV", instr4: "அனைத்து வினாக்களுக்கும் (அ) அல்லது (ஆ) ஏதேனும் ஒன்றைத் தேர்ந்தெடுத்து விடையளிக்கவும்.",
    or: "அல்லது", timeDefault:"3:00 மணி நேரம்", marksLabel:"மதிப்பெண்கள்", timeLabel:"நேரம்",
    noQuestions:"தேர்ந்தெடுக்கப்பட்ட பாடங்களில் இந்தப் பகுதிக்கு போதுமான வினாக்கள் இல்லை — கிடைத்தவை அனைத்தும் காட்டப்பட்டுள்ளன.",
  }
};

// ---------------- state ----------------
const state = {
  subjectKey: null,
  selectedChapters: new Set(),
  marks: null,
  title: "",
  school: "",
  time: "",
  date: "",
  lastPaper: null,
};

// ---------------- helpers ----------------
function shuffle(arr){
  const a = arr.slice();
  for(let i=a.length-1;i>0;i--){
    const j = Math.floor(Math.random()*(i+1));
    [a[i],a[j]] = [a[j],a[i]];
  }
  return a;
}

function pool(chapterIds, subject, field){
  const out = [];
  chapterIds.forEach(id=>{
    const ch = subject.chapters.find(c=>c.id===id);
    if(ch && ch[field]) ch[field].forEach((q,i)=>out.push({
      text: q.replace(/\*/g,'').replace(/[ \t]+/g,' ').trim(),
      chId: ch.id,
      num: i+1,
    }));
  });
  return out;
}

function getChapterQuestion(subject, chId, field, num){
  const ch = subject.chapters.find(c=>c.id===chId);
  if(!ch || !ch[field]) return null;
  const raw = ch[field][num-1];
  if(raw === undefined) return null;
  return raw.replace(/\*/g,'').replace(/[ \t]+/g,' ').trim();
}

function showScreen(id){
  document.querySelectorAll('.screen').forEach(s=>s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  const stepMap = {'screen-login':1,'screen-chapters':2,'screen-marks':3,'screen-paper':4};
  document.querySelectorAll('.step').forEach(st=>{
    const n = parseInt(st.dataset.step,10);
    st.classList.remove('current','done');
    if(n === stepMap[id]) st.classList.add('current');
    else if(n < stepMap[id]) st.classList.add('done');
  });
  window.scrollTo({top:0, behavior:'smooth'});
}

// ---------------- screen 1: subject ----------------
function subjectSummary(key){
  const s = SUBJECTS[key];
  if(!s.chapters || s.chapters.length===0){
    return "No question data loaded yet for this subject — please supply the source file.";
  }
  const totalQ = s.chapters.reduce((sum,c)=> sum + c.mcq.length + c.q2.length + c.q3.length + c.q5.length, 0);
  return `${s.chapters.length} chapters · ${totalQ} book-back questions ready`;
}

Object.keys(SUBJECTS).forEach(key=>{
  const el = document.getElementById('desc-'+key);
  if(el) el.textContent = subjectSummary(key);
});

document.querySelectorAll('.subject-btn').forEach(btn=>{
  btn.addEventListener('click', ()=>{
    const key = btn.dataset.subject;
    const subj = SUBJECTS[key];
    if(!subj.chapters || subj.chapters.length===0){
      alert("This subject's question bank isn't available yet. The uploaded source file for this subject had no readable question text, so this app can't build papers for it until a working file is provided.");
      return;
    }
    state.subjectKey = key;
    state.selectedChapters = new Set();
    renderChapters();
    document.getElementById('chapters-heading').textContent =
      "Select chapters — " + subj.short;
    showScreen('screen-chapters');
  });
});

// ---------------- screen 2: chapters ----------------
function renderChapters(){
  const subj = SUBJECTS[state.subjectKey];
  const list = document.getElementById('chapter-list');
  list.innerHTML = '';
  subj.chapters.forEach(ch=>{
    const first = ch.mcq[0] || ch.q2[0] || ch.q3[0] || ch.q5[0] || '';
    const preview = first.replace(/\n/g,' ').slice(0,70) + (first.length>70 ? '…' : '');
    const heading = ch.title ? `Ch. ${ch.id} — ${titleCase(ch.title)}` : `Chapter ${ch.id}`;
    const item = document.createElement('label');
    item.className = 'chapter-item';
    item.innerHTML = `
      <input type="checkbox" data-id="${ch.id}">
      <div class="lbl">
        <b>${heading}</b>
        <span>${preview || 'No preview text available'}</span>
        <div class="counts">1m:${ch.mcq.length} · 2m:${ch.q2.length} · 3m:${ch.q3.length} · 5m:${ch.q5.length}</div>
      </div>`;
    const cb = item.querySelector('input');
    cb.addEventListener('change', ()=>{
      if(cb.checked){ state.selectedChapters.add(ch.id); item.classList.add('checked'); }
      else { state.selectedChapters.delete(ch.id); item.classList.remove('checked'); }
      updateContinueState();
    });
    list.appendChild(item);
  });
  updateContinueState();
}

const KNOWN_ACRONYMS = new Set(['PHP','DNS','EDI','DTP','HTML','XML','SQL','URL','USB','LAN','WAN','IP','TCP','HTTP','HTTPS','CSS','MYSQL','JPEG','GIF','PNG','RTF','PDF','CSV','API','JSON','IPV4','IPV6','CD','DVD','USB','ATM','PIN','OTP','EFT','POS']);
function titleCase(s){
  return s.replace(/\w[\w'-]*/g, word=>{
    if(KNOWN_ACRONYMS.has(word.toUpperCase())) return word.toUpperCase();
    return word[0].toUpperCase() + word.slice(1).toLowerCase();
  });
}

function updateContinueState(){
  const btn = document.getElementById('to-marks');
  btn.disabled = state.selectedChapters.size === 0;
  btn.style.opacity = state.selectedChapters.size === 0 ? .5 : 1;
}

document.getElementById('btn-select-all').addEventListener('click', ()=>{
  document.querySelectorAll('#chapter-list input[type=checkbox]').forEach(cb=>{
    cb.checked = true;
    cb.dispatchEvent(new Event('change'));
  });
});
document.getElementById('btn-select-none').addEventListener('click', ()=>{
  document.querySelectorAll('#chapter-list input[type=checkbox]').forEach(cb=>{
    cb.checked = false;
    cb.dispatchEvent(new Event('change'));
  });
});
document.getElementById('back-to-login').addEventListener('click', ()=> showScreen('screen-login'));
document.getElementById('to-marks').addEventListener('click', ()=>{
  document.getElementById('chapters-chosen-chip').textContent = state.selectedChapters.size + ' chapters selected';
  showScreen('screen-marks');
});

// ---------------- screen 3: marks + title ----------------
document.querySelectorAll('.marks-card').forEach(card=>{
  card.addEventListener('click', ()=>{
    document.querySelectorAll('.marks-card').forEach(c=>c.classList.remove('selected'));
    card.classList.add('selected');
    state.marks = parseInt(card.dataset.marks,10);
    checkMarksReady();
  });
});
function checkMarksReady(){
  const btn = document.getElementById('to-generate');
  const ready = !!state.marks;
  btn.disabled = !ready;
  btn.style.opacity = ready ? 1 : .5;
}
document.getElementById('back-to-chapters').addEventListener('click', ()=> showScreen('screen-chapters'));
document.getElementById('to-generate').addEventListener('click', ()=>{
  state.title = document.getElementById('exam-title').value.trim();
  state.school = document.getElementById('exam-school').value.trim();
  state.time = document.getElementById('exam-time').value.trim();
  state.date = document.getElementById('exam-date').value.trim();
  generatePaper();
  showScreen('screen-paper');
});

// ---------------- paper generation ----------------
function buildSection(rawPool, needed, opts){
  // opts: {choiceShow, choiceAnswer} for sections with "answer M of N"
  const shuffled = shuffle(rawPool);
  const limited = shuffled.slice(0, needed);
  const shortBy = needed - limited.length;
  return { list: limited, shortBy };
}

function generatePaper(){
  const subj = SUBJECTS[state.subjectKey];
  const scheme = SCHEMES[state.marks];
  const t = I18N[subj.lang];
  const ids = Array.from(state.selectedChapters);

  const mcqPool = pool(ids, subj, 'mcq');
  const q2Pool = pool(ids, subj, 'q2');
  const q3Pool = pool(ids, subj, 'q3');
  const q5Pool = pool(ids, subj, 'q5');

  const mcqSel = buildSection(mcqPool, scheme.mcqCount);
  const q2Sel = buildSection(q2Pool, scheme.two.show);
  const q3Sel = buildSection(q3Pool, scheme.three.show);
  const q5NeededRaw = scheme.five.items * 2;
  const q5Sel = buildSection(q5Pool, q5NeededRaw);

  const shortages = [];
  if(mcqSel.shortBy>0) shortages.push(`Part I: ${mcqSel.shortBy} fewer MCQs than required`);
  if(q2Sel.shortBy>0) shortages.push(`Part II: ${q2Sel.shortBy} fewer questions than required`);
  if(q3Sel.shortBy>0) shortages.push(`Part III: ${q3Sel.shortBy} fewer questions than required`);
  if(q5Sel.shortBy>0) shortages.push(`Part IV: ${Math.ceil(q5Sel.shortBy/2)} fewer choice-pairs than required`);

  state.lastPaper = { mcqSel, q2Sel, q3Sel, q5Sel, scheme, t, subj, shortages };
  renderPaper();
}

function esc(s){
  const d = document.createElement('div');
  d.textContent = s;
  return d.innerHTML;
}

// Split a raw MCQ question into its stem + 4 options, regardless of how the
// source document wrapped lines. Renders options in a wrapping grid so short
// options sit side-by-side and long ones stack on their own lines.
const MARKER_SRC = '\\(A\\)|\\(B\\)|\\(C\\)|\\(D\\)|அ\\)|ஆ\\)|இ\\)|ஈ\\)|\\ba\\)|\\bb\\)|\\bc\\)|\\bd\\)';
function splitMCQ(raw){
  const re = new RegExp(MARKER_SRC);
  const firstIdx = raw.search(re);
  if(firstIdx === -1){
    return { stem: raw, options: [] };
  }
  const stem = raw.slice(0, firstIdx).trim();
  const rest = raw.slice(firstIdx);
  const lookahead = new RegExp('(?=' + MARKER_SRC + ')', 'g');
  const parts = rest.split(lookahead)
    .map(s=>s.replace(/\s+/g,' ').trim())
    .filter(Boolean);
  return { stem, options: parts };
}
function renderMCQItem(raw){
  const { stem, options } = splitMCQ(raw);
  if(options.length === 0){
    return `<div class="mcq-stem">${esc(raw)}</div>`;
  }
  const maxLen = Math.max(...options.map(o=>o.length));
  const stacked = maxLen > 22;
  const cls = 'mcq-options' + (stacked ? ' stacked' : '');
  const optsHtml = options.map(o=>`<span class="opt-item">${esc(o)}</span>`).join('');
  return `<div class="mcq-stem">${esc(stem)}</div><div class="${cls}">${optsHtml}</div>`;
}

// Dynamically shrink (or grow, up to a sensible max) the paper's font-size so
// that 25-mark papers land on one A4 page and 50/70-mark papers land on two,
// regardless of how long the randomly-picked questions happen to be.
const MM_TO_PX = 96/25.4;
const PAGE_MARGIN_MM = 6;
const A4_W_MM = 210, A4_H_MM = 297;
const PAGE_CONTENT_W = (A4_W_MM - PAGE_MARGIN_MM*2) * MM_TO_PX;
const PAGE_CONTENT_H = (A4_H_MM - PAGE_MARGIN_MM*2) * MM_TO_PX;

function measureHeightAtFont(html, fontPx){
  let clone = document.getElementById('__fit_clone__');
  if(!clone){
    clone = document.createElement('div');
    clone.id = '__fit_clone__';
    clone.style.position = 'fixed';
    clone.style.left = '-99999px';
    clone.style.top = '0';
    clone.style.width = PAGE_CONTENT_W + 'px';
    clone.className = 'paper-sheet';
    clone.style.border = 'none';
    clone.style.padding = '0';
    document.body.appendChild(clone);
  }
  clone.style.fontSize = fontPx + 'px';
  clone.innerHTML = html;
  return clone.scrollHeight;
}

function fitToPages(sheetEl, html, targetPages){
  const SAFETY = 0.90; // buffer against clone-vs-real-print rounding differences
  const budget = targetPages * PAGE_CONTENT_H * SAFETY;
  const maxFont = 13.5, minFont = 9.5;
  let lo = minFont, hi = maxFont, best = minFont;
  for(let i=0;i<9;i++){
    const mid = (lo+hi)/2;
    const h = measureHeightAtFont(html, mid);
    if(h <= budget){
      best = mid;
      lo = mid;
    } else {
      hi = mid;
    }
  }
  sheetEl.style.fontSize = best.toFixed(2) + 'px';
}

function editBtnHtml(field, idx){
  return `<button type="button" class="edit-btn" data-field="${field}" data-idx="${idx}">✎ Edit</button>`;
}

function renderPaper(){
  const { mcqSel, q2Sel, q3Sel, q5Sel, scheme, t, subj, shortages } = state.lastPaper;
  const warnArea = document.getElementById('warn-area');
  warnArea.innerHTML = shortages.length
    ? `<div class="warn-banner"><b>Heads up:</b> ${t.noQuestions}<br>${shortages.map(esc).join('<br>')}<br>Tip: select more chapters to fill every section fully.</div>`
    : '';

  const sheet = document.getElementById('paper-sheet');
  sheet.className = 'paper-sheet marks-' + state.marks;
  let html = '';

  html += `<div class="ph-title">${esc(state.title || 'Question Paper')}</div>`;
  if(state.school) html += `<div class="ph-sub">${esc(state.school)}</div>`;
  html += `<div class="ph-sub">${esc(subj.label)} — Std. 12</div>`;
  html += `<div class="ph-meta">
      <span>${t.timeLabel}: ${esc(state.time || t.timeDefault)}</span>
      <span>${state.date ? esc(state.date) : ''}</span>
      <span>${t.marksLabel}: ${state.marks}</span>
    </div>`;

  // PART I - MCQ
  html += `<div class="part part1">`;
  html += `<div class="part-head">${t.part1}<span class="marks-tag">(${scheme.mcqCount} × 1 = ${scheme.mcqCount})</span></div>`;
  html += `<div class="part-instr">${t.instr1}</div>`;
  html += `<ol class="qlist">`;
  mcqSel.list.forEach((q,idx)=>{ html += `<li>${renderMCQItem(q.text)}${editBtnHtml('mcq',idx)}</li>`; });
  html += `</ol></div>`;

  // PART II
  const twoTotal = scheme.two.answer;
  html += `<div class="part part2">`;
  html += `<div class="part-head">${t.part2}<span class="marks-tag">(${twoTotal} × 2 = ${twoTotal*2})</span></div>`;
  html += `<div class="part-instr">${t.instr2(q2Sel.list.length, scheme.two.answer)}</div>`;
  html += `<ol class="qlist">`;
  q2Sel.list.forEach((q,idx)=>{ html += `<li>${esc(q.text)}${editBtnHtml('q2',idx)}</li>`; });
  html += `</ol></div>`;

  // PART III
  const threeTotal = scheme.three.answer;
  html += `<div class="part part3">`;
  html += `<div class="part-head">${t.part3}<span class="marks-tag">(${threeTotal} × 3 = ${threeTotal*3})</span></div>`;
  html += `<div class="part-instr">${t.instr3(q3Sel.list.length, scheme.three.answer)}</div>`;
  html += `<ol class="qlist">`;
  q3Sel.list.forEach((q,idx)=>{ html += `<li>${esc(q.text)}${editBtnHtml('q3',idx)}</li>`; });
  html += `</ol></div>`;

  // PART IV - choice pairs
  const fiveItems = scheme.five.items;
  html += `<div class="part part4">`;
  html += `<div class="part-head">${t.part4}<span class="marks-tag">(${fiveItems} × 5 = ${fiveItems*5})</span></div>`;
  html += `<div class="part-instr">${t.instr4}</div>`;
  for(let i=0;i<fiveItems;i++){
    const aIdx = i*2, bIdx = i*2+1;
    const a = q5Sel.list[aIdx], b = q5Sel.list[bIdx];
    const num = i+1;
    html += `<div class="choice-q">`;
    html += `<div class="qn-block"><span class="qn-label">${num}. (a)</span> ${a?esc(a.text):'<span style="color:#b33">— not enough questions available —</span>'}${editBtnHtml('q5',aIdx)}</div>`;
    html += `<div class="or">${t.or}</div>`;
    html += `<div class="qn-block"><span class="qn-label">(b)</span> ${b?esc(b.text):'<span style="color:#b33">— not enough questions available —</span>'}${editBtnHtml('q5',bIdx)}</div>`;
    html += `</div>`;
  }
  html += `</div>`;

  sheet.innerHTML = html;
  const targetPages = state.marks === 25 ? 1 : 2;
  fitToPages(sheet, html, targetPages);
}

document.getElementById('btn-regenerate').addEventListener('click', ()=>{
  generatePaper();
});
document.getElementById('btn-print').addEventListener('click', ()=>{
  window.print();
});
document.getElementById('back-to-marks').addEventListener('click', ()=> showScreen('screen-marks'));

function resetAll(){
  state.subjectKey = null;
  state.selectedChapters = new Set();
  state.marks = null;
  state.title = ''; state.school=''; state.time=''; state.date='';
  state.lastPaper = null;
  document.getElementById('exam-title').value = '';
  document.getElementById('exam-school').value = '';
  document.getElementById('exam-time').value = '';
  document.getElementById('exam-date').value = '';
  document.querySelectorAll('.marks-card').forEach(c=>c.classList.remove('selected'));
  showScreen('screen-login');
}

document.getElementById('btn-reset').addEventListener('click', ()=>{
  if(!confirm('Reset everything and start over?')) return;
  resetAll();
});

document.getElementById('btn-home').addEventListener('click', ()=>{
  const hasProgress = state.subjectKey || state.lastPaper;
  if(hasProgress && !confirm('Go back to the home screen? Your current subject, chapters, and any generated paper will be cleared.')) return;
  resetAll();
});

// ---------------- edit-question modal ----------------
const FIELD_KEY = { mcq:'mcqSel', q2:'q2Sel', q3:'q3Sel', q5:'q5Sel' };
const editState = { field:null, idx:null };

const editOverlay = document.getElementById('edit-modal-overlay');

function openEditModal(field, idx){
  editState.field = field;
  editState.idx = idx;
  const subj = state.lastPaper.subj;
  const current = state.lastPaper[FIELD_KEY[field]].list[idx];

  const infoEl = document.getElementById('edit-current-info');
  if(current && current.chId){
    infoEl.textContent = `Currently: Chapter ${current.chId}, question ${current.num} of this section.`;
  } else if(current && current.custom){
    infoEl.textContent = `Currently: a custom question you wrote.`;
  } else {
    infoEl.textContent = `Currently: empty (not enough questions were available).`;
  }

  // populate chapter dropdown
  const chSel = document.getElementById('edit-chapter-select');
  chSel.innerHTML = subj.chapters.map(ch=>{
    const label = ch.title ? `Ch. ${ch.id} — ${titleCase(ch.title)}` : `Chapter ${ch.id}`;
    return `<option value="${ch.id}">${label}</option>`;
  }).join('');
  if(current && current.chId) chSel.value = String(current.chId);

  refreshQnumOptions();
  chSel.onchange = refreshQnumOptions;
  document.getElementById('edit-qnum-select').onchange = updatePickPreview;

  document.getElementById('edit-custom-text').value = current ? current.text : '';

  editOverlay.classList.remove('hidden');
}

function refreshQnumOptions(){
  const subj = state.lastPaper.subj;
  const chId = parseInt(document.getElementById('edit-chapter-select').value, 10);
  const ch = subj.chapters.find(c=>c.id===chId);
  const count = ch ? (ch[editState.field] || []).length : 0;
  const qSel = document.getElementById('edit-qnum-select');
  const current = state.lastPaper[FIELD_KEY[editState.field]].list[editState.idx];
  let opts = [];
  for(let i=1;i<=count;i++) opts.push(`<option value="${i}">Q${i}</option>`);
  qSel.innerHTML = opts.join('') || '<option value="">No questions in this chapter</option>';
  if(current && current.chId === chId && current.num) qSel.value = String(current.num);
  updatePickPreview();
}

function updatePickPreview(){
  const subj = state.lastPaper.subj;
  const chId = parseInt(document.getElementById('edit-chapter-select').value, 10);
  const num = parseInt(document.getElementById('edit-qnum-select').value, 10);
  const preview = document.getElementById('edit-preview');
  const text = getChapterQuestion(subj, chId, editState.field, num);
  preview.textContent = text || 'Select a chapter and question number to preview it here.';
}

function closeEditModal(){
  editOverlay.classList.add('hidden');
}

document.getElementById('edit-modal-close').addEventListener('click', closeEditModal);
editOverlay.addEventListener('click', (e)=>{ if(e.target === editOverlay) closeEditModal(); });

document.getElementById('edit-use-picked').addEventListener('click', ()=>{
  const subj = state.lastPaper.subj;
  const chId = parseInt(document.getElementById('edit-chapter-select').value, 10);
  const num = parseInt(document.getElementById('edit-qnum-select').value, 10);
  const text = getChapterQuestion(subj, chId, editState.field, num);
  if(!text){ alert('Please choose a valid chapter and question number.'); return; }
  state.lastPaper[FIELD_KEY[editState.field]].list[editState.idx] = { text, chId, num };
  closeEditModal();
  renderPaper();
});

document.getElementById('edit-use-custom').addEventListener('click', ()=>{
  const text = document.getElementById('edit-custom-text').value.trim();
  if(!text){ alert('Please type the question text first.'); return; }
  state.lastPaper[FIELD_KEY[editState.field]].list[editState.idx] = { text, chId:null, num:null, custom:true };
  closeEditModal();
  renderPaper();
});

// event delegation: edit buttons are re-created on every render
document.getElementById('paper-sheet').addEventListener('click', (e)=>{
  const btn = e.target.closest('.edit-btn');
  if(!btn) return;
  openEditModal(btn.dataset.field, parseInt(btn.dataset.idx, 10));
});

})();
