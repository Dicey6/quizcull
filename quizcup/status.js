/* ============================================================
   QUIZ CUP — Status Page Script (status.js)
   Handles: searching submissions by username or wallet
   ============================================================ */

/* ---- Init Supabase ---- */
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ============================================================
   INIT
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  setupNavToggle();

  /* Allow pressing Enter in either search field to search */
  document.getElementById('searchUsername').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchStatus();
  });
  document.getElementById('searchWallet').addEventListener('keydown', e => {
    if (e.key === 'Enter') searchStatus();
  });
});

function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
}

/* ============================================================
   SEARCH SUBMISSIONS
============================================================ */
async function searchStatus() {
  const username = document.getElementById('searchUsername').value.trim();
  const wallet   = document.getElementById('searchWallet').value.trim();
  const alertDiv = document.getElementById('searchAlert');

  alertDiv.innerHTML = '';

  /* At least one field required */
  if (!username && !wallet) {
    alertDiv.innerHTML = '<div class="alert alert-error">Please enter a username or wallet address.</div>';
    return;
  }

  /* Show results section */
  const section    = document.getElementById('resultsSection');
  const loading    = document.getElementById('resultsLoading');
  const emptyDiv   = document.getElementById('resultsEmpty');
  const listDiv    = document.getElementById('resultsList');

  section.style.display = 'block';
  loading.classList.remove('hidden');
  emptyDiv.classList.add('hidden');
  listDiv.classList.add('hidden');
  listDiv.innerHTML = '';

  try {
    /* Build query — search by username OR wallet, joined with quiz title */
    let query = db
      .from('submissions')
      .select('*, quizzes(title, question, reward)')
      .order('created_at', { ascending: false });

    if (wallet) {
      /* Wallet is the most precise lookup */
      query = query.eq('wallet', wallet.toLowerCase());
    } else {
      /* Username search (case-insensitive using ilike) */
      query = query.ilike('username', username);
    }

    const { data, error } = await query.limit(10);

    loading.classList.add('hidden');

    if (error) throw error;

    if (!data || data.length === 0) {
      emptyDiv.classList.remove('hidden');
      section.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }

    /* Render each submission as a status card */
    listDiv.innerHTML = data.map(row => buildStatusCard(row)).join('');
    listDiv.classList.remove('hidden');
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  } catch (err) {
    console.error('Search error:', err);
    loading.classList.add('hidden');
    alertDiv.innerHTML = `<div class="alert alert-error">Search failed. Please try again. ${err.message || ''}</div>`;
  }
}

/* ============================================================
   BUILD STATUS CARD HTML
============================================================ */
function buildStatusCard(row) {
  const status   = row.status || 'pending';
  const quiz     = row.quizzes || {};
  const date     = row.created_at
    ? new Date(row.created_at).toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      })
    : '—';

  const reward   = quiz.reward || '—';
  const txHash   = row.tx_hash || '';
  const txLink   = txHash
    ? `<a href="https://solscan.io/tx/${txHash}" target="_blank" rel="noopener" class="tx-link">${txHash.slice(0,12)}…${txHash.slice(-6)}</a>`
    : '—';

  return `
    <div class="status-card">
      <div class="status-card-header">
        <h3>${escapeHtml(quiz.title || 'Quiz Submission')}</h3>
        <span class="badge badge-${status}">${statusLabel(status)}</span>
      </div>
      <div class="status-card-body">

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;margin-bottom:8px;">
          <div class="status-field">
            <span class="field-label">Username</span>
            <span class="field-value">${escapeHtml(row.username)}</span>
          </div>
          <div class="status-field">
            <span class="field-label">Submitted</span>
            <span class="field-value">${date}</span>
          </div>
          <div class="status-field">
            <span class="field-label">Reward</span>
            <span class="field-value text-gold">${escapeHtml(reward)}</span>
          </div>
          <div class="status-field">
            <span class="field-label">TX Hash</span>
            <span class="field-value">${txLink}</span>
          </div>
        </div>

        <div class="status-field">
          <span class="field-label">Question</span>
          <span class="field-value">${escapeHtml(quiz.question || '—')}</span>
        </div>

        <div class="status-field">
          <span class="field-label">Your Answer</span>
          <span class="field-value" style="font-style:italic;color:var(--text-muted)">${escapeHtml(row.answer)}</span>
        </div>

        ${buildProgressTracker(status)}

      </div>
    </div>
  `;
}

/* ============================================================
   BUILD PROGRESS TRACKER
   Shows which stage the submission is at
============================================================ */
function buildProgressTracker(status) {
  /* Steps: submitted → reviewed → approved → paid
     Special case: rejected shows after reviewed */

  const steps = [
    { key: 'submitted', label: 'Submitted' },
    { key: 'reviewed',  label: 'Reviewed'  },
    { key: 'approved',  label: 'Approved'  },
    { key: 'paid',      label: 'Paid'      }
  ];

  /* Map status string to progress index */
  const progressMap = {
    pending:  1,  /* after submitted */
    approved: 3,  /* after approved */
    paid:     4,  /* all complete */
    rejected: 2   /* stopped at reviewed */
  };

  const reached = progressMap[status] || 1;
  const isRejected = status === 'rejected';

  const html = steps.map((step, i) => {
    const stepNum  = i + 1;
    let cls = '';

    if (isRejected && stepNum === 2) {
      cls = 'rejected';
    } else if (stepNum < reached) {
      cls = 'done';
    } else if (stepNum === reached) {
      cls = isRejected ? '' : 'current';
    }

    const icon = cls === 'done'
      ? '✓'
      : cls === 'rejected'
      ? '✕'
      : stepNum.toString();

    return `
      <div class="progress-step ${cls}">
        <div class="progress-step-dot">${icon}</div>
        <span class="progress-step-label">${step.label}</span>
        <div class="progress-line"></div>
      </div>
    `;
  }).join('');

  return `<div class="progress-tracker" style="margin-top:28px">${html}</div>`;
}

/* ============================================================
   HELPERS
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
