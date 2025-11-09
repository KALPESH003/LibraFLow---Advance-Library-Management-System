/* Advanced Library Management — Vanilla JS
   Features:
   - Roles: member / librarian / admin (controls available features)
   - Catalog: add/edit/delete books
   - Borrow / Return with due dates & overdue detection
   - Reservations queue per book
   - Persistent localStorage
   - TaskQueue for multitasking simulation (concurrency-limited)
   - Activity log + toasts + UI animations
*/

document.addEventListener('DOMContentLoaded', () => {
  /* -------------------------
     Utilities & Persistence
     -------------------------*/
  const uid = (prefix='id') => `${prefix}-${Math.random().toString(36).slice(2,9)}`;

  const store = {
    load(k, fallback) {
      try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch(e){ return fallback; }
    },
    save(k, v) { localStorage.setItem(k, JSON.stringify(v)); }
  };

  /* -------------------------
     Core Data Models
     -------------------------*/
  let books = store.load('lm_books', [
    { id:'b1', title:'Clean Code', author:'R. C. Martin', tags:['programming','software'], copies:2, borrowed:[], reservations:[] },
    { id:'b2', title:'You Don\'t Know JS', author:'K. Simpson', tags:['javascript'], copies:3, borrowed:[], reservations:[] }
  ]);
  let members = store.load('lm_members', [
    { id:'mem-1', name:'Alice' }, { id:'mem-2', name:'Bob' }
  ]);
  let logs = store.load('lm_logs', []);
  let role = 'member';

  /* -------------------------
     Task Queue (multitasking manager)
     - concurrency limit
     - queue tasks (functions returning promises)
     -------------------------*/
  class TaskQueue {
    constructor(concurrency = 2) {
      this.queue = [];
      this.running = 0;
      this.concurrency = concurrency;
      this.onChange = ()=>{};
    }
    setConcurrency(n){ this.concurrency = Math.max(1, Math.floor(n)); this._flush(); this.onChange(); }
    add(taskFn, label='task') {
      return new Promise((resolve,reject) => {
        this.queue.push({taskFn,label,resolve,reject});
        this._flush();
        this.onChange();
      });
    }
    clear() {
      this.queue = [];
      this.onChange();
    }
    _flush() {
      while(this.running < this.concurrency && this.queue.length) {
        const item = this.queue.shift();
        this.running++;
        this.onChange();
        item.taskFn().then(res => {
          item.resolve(res);
        }).catch(err => item.reject(err)).finally(()=>{
          this.running--;
          this._flush();
          this.onChange();
        });
      }
    }
    stats(){ return { queued:this.queue.length, running:this.running, concurrency:this.concurrency } }
  }

  const queue = new TaskQueue(parseInt(document.getElementById('concurrencyInput').value || 2));
  queue.onChange = updateTaskProgressUI;

  /* -------------------------
     DOM refs
     -------------------------*/
  const roleSelect = document.getElementById('roleSelect');
  const addBookBtn = document.getElementById('addBookBtn');
  const modal = document.getElementById('modal');
  const modalTitle = document.getElementById('modalTitle');
  const bookForm = document.getElementById('bookForm');
  const bookTitle = document.getElementById('bookTitle');
  const bookAuthor = document.getElementById('bookAuthor');
  const bookTags = document.getElementById('bookTags');
  const bookCopies = document.getElementById('bookCopies');
  const modalCancel = document.getElementById('modalCancel');

  const bookList = document.getElementById('bookList');
  const opBookSelect = document.getElementById('opBookSelect');
  const resBookSelect = document.getElementById('resBookSelect');

  const memberListEl = document.getElementById('memberList');
  const newMemberName = document.getElementById('newMemberName');
  const addMemberBtn = document.getElementById('addMemberBtn');

  const borrowBtn = document.getElementById('borrowBtn');
  const returnBtn = document.getElementById('returnBtn');
  const reserveBtn = document.getElementById('reserveBtn');
  const memberIdInput = document.getElementById('memberIdInput');
  const resMemberId = document.getElementById('resMemberId');

  const activityLog = document.getElementById('activityLog');
  const clearLog = document.getElementById('clearLog');

  const toastContainer = document.getElementById('toastContainer');

  const searchBox = document.getElementById('searchBox');
  const taskBar = document.getElementById('taskBar');
  const concurrencyInput = document.getElementById('concurrencyInput');
  const syncBtn = document.getElementById('syncBtn');
  const clearQueueBtn = document.getElementById('clearQueueBtn');

  /* -------------------------
     Helper UI functions
     -------------------------*/
  function toast(msg, type='info', ttl=3000) {
    const el = document.createElement('div');
    el.className = 'toast';
    el.textContent = msg;
    toastContainer.appendChild(el);
    setTimeout(()=> el.classList.add('dismiss'), 2000);
    setTimeout(()=> el.remove(), ttl);
  }

  function logActivity(text) {
    const t = new Date().toLocaleString();
    logs.unshift({id:uid('log'), t, text});
    if (logs.length>200) logs.pop();
    store.save('lm_logs', logs);
    renderLog();
  }

  function persistAll(){
    store.save('lm_books', books);
    store.save('lm_members', members);
  }

  /* -------------------------
     Simulated API helpers (wrap real actions in a promise that resolves after a delay)
     Supports optimistic UI and avoids race conditions via TaskQueue.
     -------------------------*/
  const API = {
    delay(ms=600) { return new Promise(r => setTimeout(r, ms)); },
    async perform(actionFn, label) {
      // Add to queue, queue runs actionFn which should return a promise
      return queue.add(async () => {
        // simulate variable network latency
        await API.delay(250 + Math.random()*700);
        return actionFn();
      }, label);
    }
  };

  /* -------------------------
     Business actions
     -------------------------*/
  function findBookById(id){ return books.find(b=>b.id===id) }
  function renderSelectors(){
    opBookSelect.innerHTML = '';
    resBookSelect.innerHTML = '';
    const frag1 = document.createDocumentFragment();
    books.forEach(b=>{
      const opt = document.createElement('option'); opt.value=b.id;
      opt.textContent = `${b.title} — available ${Math.max(0,b.copies - b.borrowed.length)}/${b.copies}`;
      frag1.appendChild(opt);
    });
    opBookSelect.appendChild(frag1.cloneNode(true));
    resBookSelect.appendChild(frag1);
  }

  function renderBooks(filter='') {
    bookList.innerHTML = '';
    const q = filter.trim().toLowerCase();
    const filtered = books.filter(b => !q || (b.title+b.author+(b.tags||[]).join(' ')).toLowerCase().includes(q));
    filtered.forEach(b=>{
      const li = document.createElement('li');
      li.className = 'book-item';
      li.innerHTML = `
        <div class="book-meta">
          <div class="book-cover">${(b.title||'').slice(0,1).toUpperCase()}</div>
          <div>
            <div class="book-title">${escapeHtml(b.title)}</div>
            <div class="book-author">${escapeHtml(b.author)}</div>
            <div class="book-tags">${(b.tags||[]).join(', ')}</div>
          </div>
        </div>
        <div class="book-actions">
          <div style="text-align:right;color:var(--muted);font-size:0.9rem">
            <div>Available: ${Math.max(0,b.copies - b.borrowed.length)} / ${b.copies}</div>
            <div>Reserved: ${b.reservations.length}</div>
          </div>
          <div>
            <button class="btn" data-edit="${b.id}">Edit</button>
            <button class="btn warn" data-delete="${b.id}">Delete</button>
          </div>
        </div>
      `;
      bookList.appendChild(li);
    });
  }

  function renderMembers(){
    memberListEl.innerHTML='';
    members.forEach(m=>{
      const li = document.createElement('li');
      li.textContent = `${m.name} (${m.id})`;
      memberListEl.appendChild(li);
    });
  }

  function renderLog(){
    activityLog.innerHTML = '';
    logs.slice(0,100).forEach(l=>{
      const li = document.createElement('li');
      li.textContent = `[${l.t}] ${l.text}`;
      activityLog.appendChild(li);
    });
  }

  function escapeHtml(s=''){ return s.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;') }

  /* -------------------------
     CRUD operations (wrapped with API.perform)
     -------------------------*/
  async function addBook(data){
    return API.perform(()=> {
      const b = { id: uid('bk'), title:data.title, author:data.author, tags:data.tags||[], copies:Math.max(1,parseInt(data.copies||1)), borrowed:[], reservations:[] };
      books.unshift(b);
      persistAll();
      logActivity(`Book added: "${b.title}" by ${b.author}`);
      return b;
    }, 'add-book');
  }

  async function editBook(id, data){
    return API.perform(()=> {
      const b = findBookById(id);
      if(!b) throw new Error('Book not found');
      b.title = data.title; b.author = data.author; b.tags = data.tags; b.copies = Math.max(1, parseInt(data.copies||1));
      // ensure borrowed doesn't exceed copies
      if(b.borrowed.length > b.copies) b.borrowed = b.borrowed.slice(0, b.copies);
      persistAll();
      logActivity(`Book edited: "${b.title}"`);
      return b;
    }, 'edit-book');
  }

  async function deleteBook(id){
    return API.perform(()=> {
      const idx = books.findIndex(x=>x.id===id);
      if(idx===-1) throw new Error('Not found');
      const [b] = books.splice(idx,1);
      persistAll();
      logActivity(`Book deleted: "${b.title}"`);
      return b;
    }, 'delete-book');
  }

  async function addMember(name){
    return API.perform(()=> {
      const m = { id: uid('mem'), name };
      members.push(m);
      persistAll();
      logActivity(`New member: ${m.name} (${m.id})`);
      return m;
    }, 'add-member');
  }

  async function borrowBook(memberId, bookId){
    return API.perform(()=> {
      const m = members.find(x=>x.id===memberId); if(!m) throw new Error('Member not found');
      const b = findBookById(bookId); if(!b) throw new Error('Book not found');
      const available = b.copies - b.borrowed.length;
      if(available <= 0) throw new Error('No copies available — please reserve.');
      // create borrow record with due date (14 days)
      const due = new Date(Date.now() + 14*24*60*60*1000).toISOString().slice(0,10);
      b.borrowed.push({ memberId:m.id, borrowedAt: new Date().toISOString(), dueDate: due });
      persistAll();
      logActivity(`${m.name} borrowed "${b.title}" (due ${due})`);
      return {b,m};
    }, 'borrow-book');
  }

  async function returnBook(memberId, bookId){
    return API.perform(()=> {
      const b = findBookById(bookId); if(!b) throw new Error('Book not found');
      const ix = b.borrowed.findIndex(rec => rec.memberId === memberId);
      if(ix === -1) throw new Error('This member has not borrowed this book');
      b.borrowed.splice(ix,1);
      // if there are reservations, automatically assign to first reserver
      if(b.reservations.length){
        const next = b.reservations.shift();
        b.borrowed.push({ memberId: next.memberId, borrowedAt: new Date().toISOString(), dueDate: new Date(Date.now()+14*24*60*60*1000).toISOString().slice(0,10) });
        logActivity(`Auto-assigned "${b.title}" to reserver ${next.name} (${next.memberId})`);
      }
      persistAll();
      logActivity(`Book returned: "${b.title}" by ${memberId}`);
      return b;
    }, 'return-book');
  }

  async function reserveBook(memberId, bookId){
    return API.perform(()=> {
      const m = members.find(x=>x.id===memberId); if(!m) throw new Error('Member not found');
      const b = findBookById(bookId); if(!b) throw new Error('Book not found');
      if(b.reservations.find(r=>r.memberId===memberId)) throw new Error('Already reserved');
      b.reservations.push({ memberId:m.id, name:m.name, reservedAt: new Date().toISOString() });
      persistAll();
      logActivity(`${m.name} reserved "${b.title}"`);
      return b;
    }, 'reserve-book');
  }

  /* -------------------------
     UI wiring & events
     -------------------------*/
  function updateTaskProgressUI(){
    const s = queue.stats();
    const total = s.queued + s.running || 1;
    const pct = Math.round((s.running / (s.concurrency || 1)) * 100);
    const completion = Math.min(100, Math.round(( (s.running) / (s.concurrency + s.queued) ) * 100));
    // We show running proportion of concurrency
    taskBar.style.width = `${pct}%`;
  }

  function openAddBookModal(editId=null){
    modal.classList.remove('hidden');
    modal.setAttribute('aria-hidden','false');
    if(editId){
      modalTitle.textContent = 'Edit Book';
      const b = findBookById(editId);
      bookTitle.value = b.title; bookAuthor.value = b.author; bookTags.value = (b.tags||[]).join(', '); bookCopies.value = b.copies;
      bookForm.dataset.edit = editId;
    } else {
      modalTitle.textContent = 'Add Book';
      bookForm.dataset.edit = '';
      bookTitle.value = bookAuthor.value = bookTags.value = '';
      bookCopies.value = 1;
    }
  }

  function closeModal(){
    modal.classList.add('hidden');
    modal.setAttribute('aria-hidden','true');
    delete bookForm.dataset.edit;
  }

  bookForm.addEventListener('submit', async (e)=>{
    e.preventDefault();
    const data = { title: bookTitle.value.trim(), author: bookAuthor.value.trim(), tags: bookTags.value.split(',').map(s=>s.trim()).filter(Boolean), copies: parseInt(bookCopies.value,10) };
    try{
      if(bookForm.dataset.edit){
        await editBook(bookForm.dataset.edit, data);
        toast('Book updated');
      } else {
        await addBook(data);
        toast('Book added');
      }
      closeModal();
      renderAll();
    } catch(err){
      toast(err.message || 'Error', 'error');
    }
  });

  modalCancel.addEventListener('click', closeModal);
  addBookBtn.addEventListener('click', ()=> openAddBookModal(null));

  // Delegated actions for book list (edit/delete)
  bookList.addEventListener('click', (e)=>{
    const editId = e.target.getAttribute('data-edit');
    const delId = e.target.getAttribute('data-delete');
    if(editId){
      // Only librarian/admin can edit
      if(['librarian','admin'].includes(role)) openAddBookModal(editId);
      else toast('Permission denied');
    } else if(delId){
      if(!['admin'].includes(role)) { toast('Only admin can delete'); return; }
      deleteBook(delId).then(()=>{ toast('Book deleted'); renderAll();}).catch(err=>toast(err.message));
    }
  });

  addMemberBtn.addEventListener('click', async ()=>{
    const name = newMemberName.value.trim();
    if(!name) return toast('Enter a name');
    try{ await addMember(name); newMemberName.value=''; renderAll(); toast('Member added'); } catch(err){ toast(err.message) }
  });

  borrowBtn.addEventListener('click', async ()=>{
    const mem = memberIdInput.value.trim(); const bookId = opBookSelect.value;
    if(!mem || !bookId) return toast('Enter member and book');
    try{ await borrowBook(mem, bookId); toast('Borrowed'); renderAll(); } catch(err){ toast(err.message) }
  });

  returnBtn.addEventListener('click', async ()=>{
    const mem = memberIdInput.value.trim(); const bookId = opBookSelect.value;
    if(!mem || !bookId) return toast('Enter member and book');
    try{ await returnBook(mem, bookId); toast('Returned'); renderAll(); } catch(err){ toast(err.message) }
  });

  reserveBtn.addEventListener('click', async ()=>{
    const mem = resMemberId.value.trim(); const bookId = resBookSelect.value;
    if(!mem || !bookId) return toast('Enter member and book');
    try{ await reserveBook(mem, bookId); toast('Reserved'); renderAll(); } catch(err){ toast(err.message) }
  });

  // Search
  searchBox.addEventListener('input', ()=> renderBooks(searchBox.value));

  // Task queue controls
  concurrencyInput.addEventListener('change', ()=> { queue.setConcurrency(parseInt(concurrencyInput.value||2)); });
  clearQueueBtn.addEventListener('click', ()=> { queue.clear(); updateTaskProgressUI(); toast('Queue cleared'); });

  // Sync simulation (forces minor re-render and simulates syncing)
  syncBtn.addEventListener('click', async ()=>{
    toast('Sync started');
    // enqueue a simulated sync task
    await queue.add(async ()=> { await API.delay(800 + Math.random()*1000); logActivity('Data synced with server (simulated)'); persistAll(); renderAll(); }, 'sync');
    toast('Sync complete');
  });

  clearLog.addEventListener('click', ()=> { logs = []; store.save('lm_logs', logs); renderLog(); toast('Log cleared'); });

  // Role switch
  roleSelect.addEventListener('change', ()=> {
    role = roleSelect.value;
    applyRolePermissions();
    toast(`Role: ${role}`);
  });

  function applyRolePermissions(){
    // Simple permission toggles
    const canEdit = ['librarian','admin'].includes(role);
    addBookBtn.disabled = !canEdit;
    document.querySelectorAll('[data-edit]').forEach(b=> b.disabled = !canEdit);
    // delete only admin
    document.querySelectorAll('[data-delete]').forEach(b=> b.disabled = (role!=='admin'));
  }

  /* -------------------------
     Overdue checker — runs every minute (simulate)
     -------------------------*/
  function checkOverdues(){
    const today = new Date().toISOString().slice(0,10);
    books.forEach(b=>{
      b.borrowed.forEach(rec=>{
        if(rec.dueDate < today){
          const mem = members.find(m=>m.id===rec.memberId);
          logActivity(`Overdue: "${b.title}" by ${mem ? mem.name : rec.memberId}`);
          toast(`Overdue detected: ${b.title}`, 'warn');
        }
      });
    });
  }
  setInterval(checkOverdues, 60*1000);

  /* -------------------------
     Rendering and initial load
     -------------------------*/
  function renderAll(){
    renderBooks(searchBox.value);
    renderSelectors();
    renderMembers();
    renderLog();
    persistAll();
    updateTaskProgressUI();
    applyRolePermissions();
  }

  // initial
  renderAll();

  // helper: clicking outside modal closes it
  modal.addEventListener('click', (e)=> { if(e.target===modal) closeModal(); });

  // expose some debug utilities in window for ease of demo
  window._LM = { books, members, logs, queue };

});
