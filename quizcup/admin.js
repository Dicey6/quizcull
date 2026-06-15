/* ============================================================
   QUIZ CUP — Admin Script (admin.js)
   Handles: login, submissions management, quiz editing, settings
   ============================================================ */

/* ---- Init Supabase ---- */
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ============================================================
   LOGIN
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  /* Allow pressing Enter in password field */
  const pwInput = document.getElementById('adminPassword');
  if (pwInput) {
    pwInput.addEventListener('keydown', e => {
      if (e.key === 'Enter') adminLogin();
    });
  }
});

function adminLogin() {
  const pw    = document.getElementById('adminPassword').value;
  const alert = document.getElementById('loginAlert');

  if (pw === CONFIG.ADMIN_PASSWORD) {
    document.getElementById('loginScreen').style.display  = 'none';
    document.getElementById('adminLayout').style.display  = 'flex';
    /* Load initial data */
    loadOverview();
    loadSubmissions();
    loadWinners();
    loadQuizForEdit();
    loadAllQuizzes();
    loadSettings();
  } else {
    alert.innerHTML = '<div class="alert alert-error">Incorrect password.</div>';
    document.getElementById('adminPassword').value = '';
  }
}

function adminLogout() {
  document.getElementById('adminLayout').style.display  = 'none';
  document.getElementById('loginScreen').style.display  = 'flex';
  document.getElementById('adminPassword').value = '';
}

/* ============================================================
   SIDEBAR NAVIGATION
============================================================ */
function showPage(name) {
  /* Hide all pages */
  document.querySelectorAll('.admin-page').forEach(p => p.classList.remove('active'));
  /* Deactivate all nav items */
  document.querySelectorAll('.admin-nav-item').forEach(n => n.classList.remove('active'));

  /* Show target page */
  const page = document.getElementById(`page-${name}`);
  if (page) page.classList.add('active');

  /* Activate nav item */
  const nav = document.getElementById(`nav-${name}`);
  if (nav) nav.classList.add('active');

  /* Lazy-load data for the page */
  if (name === 'overview')     loadOverview();
  if (name === 'submissions')  loadSubmissions();
  if (name === 'winners')      loadWinners();
  if (name === 'quiz')         { loadAllQuizzes(); }
  if (name === 'settings')     loadSettings();
}

/* ============================================================
   OVERVIEW PAGE
============================================================ */
async function loadOverview() {
  try {
    /* Fetch all submission counts */
    const { data: allSubs } = await db
      .from('submissions')
      .select('status');

    if (allSubs) {
      const total    = allSubs.length;
      const pending  = allSubs.filter(s => s.status === 'pending').length;
      const approved = allSubs.filter(s => s.status === 'approved').length;
      const paid     = allSubs.filter(s => s.status === 'paid').length;

      document.getElementById('statTotal').textContent    = total;
      document.getElementById('statPending').textContent  = pending;
      document.getElementById('statApproved').textContent = approved;
      document.getElementById('statPaid').textContent     = paid;
    }

    /* Fetch active quiz */
    const { data: quiz } = await db
      .from('quizzes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    const el = document.getElementById('overviewQuiz');
    if (!quiz) {
      el.innerHTML = '<p class="text-muted" style="font-size:0.875rem">No active quiz. Go to Quiz tab to create one.</p>';
      return;
    }

    const deadline = quiz.deadline
      ? new Date(quiz.deadline).toLocaleString(undefined, { year:'numeric', month:'short', day:'numeric', hour:'2-digit', minute:'2-digit' })
      : 'No deadline';

    el.innerHTML = `
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:16px">
        <div>
          <div class="stat-label">Title</div>
          <div style="margin-top:4px;font-weight:600">${escapeHtml(quiz.title)}</div>
        </div>
        <div>
          <div class="stat-label">Reward</div>
          <div style="margin-top:4px;color:var(--gold);font-weight:600">${escapeHtml(quiz.reward || '—')}</div>
        </div>
        <div>
          <div class="stat-label">Deadline</div>
          <div style="margin-top:4px;font-size:0.875rem">${deadline}</div>
        </div>
        <div>
          <div class="stat-label">Status</div>
          <div style="margin-top:4px"><span class="badge badge-active">🟢 Active</span></div>
        </div>
      </div>
      <p style="margin-top:16px;color:var(--text-muted);font-size:0.9rem">${escapeHtml(quiz.question)}</p>
    `;

  } catch (err) {
    console.error('Overview error:', err);
  }
}

/* ============================================================
   SUBMISSIONS PAGE
============================================================ */
async function loadSubmissions() {
  const loading  = document.getElementById('submissionsLoading');
  const tableDiv = document.getElementById('submissionsTable');
  const emptyDiv = document.getElementById('submissionsEmpty');
  const tbody    = document.getElementById('submissionsBody');

  if (!loading) return;

  loading.classList.remove('hidden');
  tableDiv.classList.add('hidden');
  emptyDiv.classList.add('hidden');

  try {
    const statusFilter = document.getElementById('filterStatus')?.value || '';
    const searchFilter = document.getElementById('filterSearch')?.value?.trim().toLowerCase() || '';

    let query = db
      .from('submissions')
      .select('*, quizzes(title, reward)')
      .order('created_at', { ascending: false })
      .limit(200);

    if (statusFilter) {
      query = query.eq('status', statusFilter);
    }

    const { data, error } = await query;

    loading.classList.add('hidden');
    if (error) throw error;

    /* Client-side search filter */
    const filtered = searchFilter
      ? data.filter(r =>
          r.username?.toLowerCase().includes(searchFilter) ||
          r.wallet?.toLowerCase().includes(searchFilter)
        )
      : data;

    if (!filtered || filtered.length === 0) {
      emptyDiv.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = filtered.map(row => {
      const date = row.created_at
        ? new Date(row.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
        : '—';

      const wallet = row.wallet
        ? `${row.wallet.slice(0,6)}…${row.wallet.slice(-4)}`
        : '—';

      const answerShort = row.answer
        ? (row.answer.length > 60 ? row.answer.slice(0, 60) + '…' : row.answer)
        : '';

      /* Action buttons depend on current status */
      let actions = '';
      if (row.status === 'pending') {
        actions = `
          <div class="admin-action-btns">
            <button class="btn btn-primary btn-sm" onclick="updateStatus(${row.id}, 'approved')">✓ Approve</button>
            <button class="btn btn-danger btn-sm" onclick="updateStatus(${row.id}, 'rejected')">✕ Reject</button>
          </div>`;
      } else if (row.status === 'approved') {
        actions = `
          <div class="admin-action-btns">
            <div class="tx-input-row">
              <input type="text" id="tx-${row.id}" placeholder="TX Hash" title="Paste TX hash then click Pay" />
              <button class="btn btn-gold btn-sm" onclick="markPaid(${row.id})">🏆 Pay</button>
            </div>
            <button class="btn btn-danger btn-sm" onclick="updateStatus(${row.id}, 'rejected')">✕ Reject</button>
          </div>`;
      } else if (row.status === 'paid') {
        actions = `<span style="color:var(--gold);font-size:0.8rem">✅ Paid</span>`;
      } else if (row.status === 'rejected') {
        actions = `
          <div class="admin-action-btns">
            <button class="btn btn-outline btn-sm" onclick="updateStatus(${row.id}, 'pending')">↺ Reset</button>
          </div>`;
      }

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.8rem;white-space:nowrap">${date}</td>
          <td style="font-weight:600">${escapeHtml(row.username)}</td>
          <td style="font-family:'Courier New',monospace;font-size:0.8rem;color:var(--text-muted)" title="${escapeHtml(row.wallet)}">${wallet}</td>
          <td>
            <div class="admin-answer-text" title="${escapeHtml(row.answer)}">${escapeHtml(answerShort)}</div>
            ${row.answer && row.answer.length > 60
              ? `<button class="expand-row" onclick="toggleAnswer(this)" data-full="${escapeHtml(row.answer)}">Show full ↓</button>`
              : ''}
          </td>
          <td><span class="badge badge-${row.status}">${statusLabel(row.status)}</span></td>
          <td>${actions}</td>
        </tr>
      `;
    }).join('');

    tableDiv.classList.remove('hidden');

  } catch (err) {
    console.error('Submissions load error:', err);
    loading.classList.add('hidden');
    document.getElementById('submissionsAlert').innerHTML =
      `<div class="alert alert-error">Failed to load submissions: ${err.message}</div>`;
  }
}

/* Toggle full answer text */
function toggleAnswer(btn) {
  const full = btn.getAttribute('data-full');
  const existing = btn.nextElementSibling;
  if (existing && existing.classList.contains('sub-answer-full')) {
    existing.remove();
    btn.textContent = 'Show full ↓';
  } else {
    const div = document.createElement('div');
    div.className = 'sub-answer-full';
    div.textContent = full;
    btn.insertAdjacentElement('afterend', div);
    btn.textContent = 'Hide ↑';
  }
}

/* ============================================================
   UPDATE SUBMISSION STATUS
============================================================ */
async function updateStatus(id, newStatus) {
  try {
    const { error } = await db
      .from('submissions')
      .update({ status: newStatus })
      .eq('id', id);

    if (error) throw error;

    showSubmissionsAlert(`✅ Submission ${newStatus}.`, 'success');
    loadSubmissions();
    loadOverview();
  } catch (err) {
    console.error('Update status error:', err);
    showSubmissionsAlert(`Failed: ${err.message}`, 'error');
  }
}

/* Mark a submission as paid with TX hash */
async function markPaid(id) {
  const txInput = document.getElementById(`tx-${id}`);
  const txHash  = txInput ? txInput.value.trim() : '';

  if (!txHash) {
    showSubmissionsAlert('Please enter the TX hash before marking as paid.', 'error');
    return;
  }

  try {
    const { error } = await db
      .from('submissions')
      .update({ status: 'paid', tx_hash: txHash })
      .eq('id', id);

    if (error) throw error;

    showSubmissionsAlert('🏆 Marked as paid!', 'success');
    loadSubmissions();
    loadOverview();
    loadWinners();
  } catch (err) {
    console.error('Mark paid error:', err);
    showSubmissionsAlert(`Failed: ${err.message}`, 'error');
  }
}

function showSubmissionsAlert(msg, type) {
  const el = document.getElementById('submissionsAlert');
  el.innerHTML = `<div class="alert alert-${type}">${msg}</div>`;
  setTimeout(() => { el.innerHTML = ''; }, 4000);
}

/* ============================================================
   WINNERS PAGE
============================================================ */
async function loadWinners() {
  const loading = document.getElementById('winnersLoading');
  const table   = document.getElementById('winnersTable');
  const empty   = document.getElementById('winnersEmpty');
  const tbody   = document.getElementById('winnersBody');

  if (!loading) return;

  loading.classList.remove('hidden');
  table.classList.add('hidden');
  empty.classList.add('hidden');

  try {
    const { data, error } = await db
      .from('submissions')
      .select('*, quizzes(title, reward)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false });

    loading.classList.add('hidden');
    if (error) throw error;

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.map(row => {
      const date = row.created_at
        ? new Date(row.created_at).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
        : '—';

      const wallet = row.wallet
        ? `${row.wallet.slice(0,6)}…${row.wallet.slice(-4)}`
        : '—';

      const txLink = row.tx_hash
        ? `<a href="https://solscan.io/tx/${row.tx_hash}" target="_blank" rel="noopener" class="tx-link">${row.tx_hash.slice(0,10)}…</a>`
        : '—';

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.8rem">${date}</td>
          <td style="font-weight:600;color:var(--gold)">${escapeHtml(row.username)}</td>
          <td style="font-family:'Courier New',monospace;font-size:0.8rem;color:var(--text-muted)"
              title="${escapeHtml(row.wallet)}">${wallet}</td>
          <td style="color:var(--accent);font-weight:600">${escapeHtml(row.quizzes?.reward || '—')}</td>
          <td>${txLink}</td>
        </tr>
      `;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    console.error('Winners load error:', err);
    loading.classList.add('hidden');
  }
}

/* ============================================================
   QUIZ MANAGEMENT
============================================================ */
async function loadQuizForEdit() {
  try {
    const { data, error } = await db
      .from('quizzes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error || !data) return;

    fillQuizForm(data);
  } catch (err) {
    console.error('Load quiz error:', err);
  }
}

async function loadAllQuizzes() {
  const loading = document.getElementById('allQuizzesLoading');
  const table   = document.getElementById('allQuizzesTable');
  const tbody   = document.getElementById('allQuizzesBody');

  if (!loading) return;

  loading.classList.remove('hidden');
  table.classList.add('hidden');

  try {
    const { data, error } = await db
      .from('quizzes')
      .select('*')
      .order('created_at', { ascending: false });

    loading.classList.add('hidden');
    if (error || !data) return;

    if (data.length === 0) {
      table.innerHTML = '<p class="text-muted" style="padding:20px 0;font-size:0.875rem">No quizzes yet.</p>';
      table.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.map(quiz => {
      const deadline = quiz.deadline
        ? new Date(quiz.deadline).toLocaleDateString(undefined, { month:'short', day:'numeric', year:'numeric' })
        : '—';

      return `
        <tr>
          <td style="font-weight:600">${escapeHtml(quiz.title)}</td>
          <td style="color:var(--gold)">${escapeHtml(quiz.reward || '—')}</td>
          <td style="color:var(--text-muted);font-size:0.85rem">${deadline}</td>
          <td><span class="badge badge-${quiz.status}">${quiz.status}</span></td>
          <td>
            <div class="admin-action-btns">
              <button class="btn btn-outline btn-sm" onclick="editQuiz(${quiz.id})">✏️ Edit</button>
              ${quiz.status === 'active'
                ? `<button class="btn btn-outline btn-sm" onclick="setQuizStatus(${quiz.id}, 'closed')">Close</button>`
                : `<button class="btn btn-primary btn-sm" onclick="setQuizStatus(${quiz.id}, 'active')">Activate</button>`
              }
            </div>
          </td>
        </tr>
      `;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    console.error('All quizzes load error:', err);
    loading.classList.add('hidden');
  }
}

function fillQuizForm(quiz) {
  document.getElementById('quizId').value          = quiz.id || '';
  document.getElementById('quizTitle').value        = quiz.title || '';
  document.getElementById('quizQuestion').value     = quiz.question || '';
  document.getElementById('quizDescription').value  = quiz.description || '';
  document.getElementById('quizReward').value       = quiz.reward || '';
  document.getElementById('quizStatus').value       = quiz.status || 'active';
  if (quiz.deadline) {
    /* Format for datetime-local input: YYYY-MM-DDTHH:MM */
    const d = new Date(quiz.deadline);
    const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000)
      .toISOString()
      .slice(0, 16);
    document.getElementById('quizDeadline').value = local;
  } else {
    document.getElementById('quizDeadline').value = '';
  }
}

async function editQuiz(id) {
  try {
    const { data, error } = await db.from('quizzes').select('*').eq('id', id).single();
    if (error || !data) return;
    fillQuizForm(data);
    /* Scroll to form */
    document.getElementById('quizTitle').scrollIntoView({ behavior: 'smooth', block: 'center' });
  } catch (err) {
    console.error('Edit quiz error:', err);
  }
}

async function setQuizStatus(id, newStatus) {
  try {
    /* If activating, close all other active quizzes first */
    if (newStatus === 'active') {
      await db.from('quizzes').update({ status: 'closed' }).eq('status', 'active');
    }
    const { error } = await db.from('quizzes').update({ status: newStatus }).eq('id', id);
    if (error) throw error;
    loadAllQuizzes();
    loadOverview();
  } catch (err) {
    console.error('Set quiz status error:', err);
  }
}

async function saveQuiz() {
  const id          = document.getElementById('quizId').value;
  const title       = document.getElementById('quizTitle').value.trim();
  const question    = document.getElementById('quizQuestion').value.trim();
  const description = document.getElementById('quizDescription').value.trim();
  const reward      = document.getElementById('quizReward').value.trim();
  const deadline    = document.getElementById('quizDeadline').value || null;
  const status      = document.getElementById('quizStatus').value;
  const alertDiv    = document.getElementById('quizAlert');

  alertDiv.innerHTML = '';

  if (!title)    return alertDiv.innerHTML = '<div class="alert alert-error">Title is required.</div>';
  if (!question) return alertDiv.innerHTML = '<div class="alert alert-error">Question is required.</div>';

  try {
    /* If new quiz is active, close all other active ones first */
    if (status === 'active') {
      await db.from('quizzes').update({ status: 'closed' }).eq('status', 'active');
    }

    const payload = { title, question, description, reward, deadline, status };

    let error;
    if (id) {
      /* Update existing */
      ({ error } = await db.from('quizzes').update(payload).eq('id', id));
    } else {
      /* Insert new */
      ({ error } = await db.from('quizzes').insert(payload));
    }

    if (error) throw error;

    alertDiv.innerHTML = '<div class="alert alert-success">✅ Quiz saved successfully.</div>';
    setTimeout(() => { alertDiv.innerHTML = ''; }, 4000);
    loadAllQuizzes();
    loadOverview();

  } catch (err) {
    console.error('Save quiz error:', err);
    alertDiv.innerHTML = `<div class="alert alert-error">Failed to save: ${err.message}</div>`;
  }
}

function clearQuizForm() {
  document.getElementById('quizId').value          = '';
  document.getElementById('quizTitle').value        = '';
  document.getElementById('quizQuestion').value     = '';
  document.getElementById('quizDescription').value  = '';
  document.getElementById('quizReward').value       = '';
  document.getElementById('quizDeadline').value     = '';
  document.getElementById('quizStatus').value       = 'active';
}

/* ============================================================
   SETTINGS
============================================================ */
async function loadSettings() {
  try {
    const { data, error } = await db
      .from('settings')
      .select('*')
      .eq('id', 1)
      .maybeSingle();

    if (error || !data) return;

    document.getElementById('settingCA').value        = data.contract_address || '';
    document.getElementById('settingShowCA').checked  = data.show_ca !== false;
    document.getElementById('settingXHandle').value   = data.x_handle || '';
    document.getElementById('settingXUrl').value      = data.x_url || '';
    document.getElementById('settingLogo').value      = data.logo || '';
    document.getElementById('settingBackground').value = data.background || '';

  } catch (err) {
    console.error('Load settings error:', err);
  }
}

async function saveSettings() {
  const alertDiv = document.getElementById('settingsAlert');
  alertDiv.innerHTML = '';

  const payload = {
    contract_address: document.getElementById('settingCA').value.trim(),
    show_ca:          document.getElementById('settingShowCA').checked,
    x_handle:         document.getElementById('settingXHandle').value.trim(),
    x_url:            document.getElementById('settingXUrl').value.trim(),
    logo:             document.getElementById('settingLogo').value.trim(),
    background:       document.getElementById('settingBackground').value.trim()
  };

  try {
    /* Upsert: update row id=1, or insert if it doesn't exist */
    const { error } = await db
      .from('settings')
      .upsert({ id: 1, ...payload });

    if (error) throw error;

    alertDiv.innerHTML = '<div class="alert alert-success">✅ Settings saved.</div>';
    setTimeout(() => { alertDiv.innerHTML = ''; }, 3000);

  } catch (err) {
    console.error('Save settings error:', err);
    alertDiv.innerHTML = `<div class="alert alert-error">Failed to save: ${err.message}</div>`;
  }
}

/* ============================================================
   UTILITIES
============================================================ */
function statusLabel(s) {
  const labels = {
    pending:  '⏳ Pending',
    approved: '✅ Approved',
    paid:     '🏆 Paid',
    rejected: '❌ Rejected'
  };
  return labels[s] || s;
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
