/* ============================================================
   QUIZ CUP — Homepage Script (script.js)
   Handles: quiz loading, form submission, CA copy, winners
   ============================================================ */

/* ---- Init Supabase ---- */
const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

/* ---- Global state ---- */
let currentQuiz = null;

/* ============================================================
   INIT — runs when page loads
============================================================ */
document.addEventListener('DOMContentLoaded', async () => {
  setupNavToggle();
  await Promise.all([
    loadSettings(),
    loadActiveQuiz(),
    loadRecentWinners()
  ]);
});

/* ============================================================
   NAVIGATION TOGGLE (mobile)
============================================================ */
function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    links.classList.toggle('open');
  });
}

/* ============================================================
   LOAD SETTINGS
   Populates CA, X handle, hides sections if disabled
============================================================ */
async function loadSettings() {
  try {
    const { data, error } = await db
      .from('settings')
      .select('*')
      .eq('id', 1)
      .single();

    if (error || !data) return;

    /* -- Contract Address -- */
    if (data.show_ca && data.contract_address) {
      document.getElementById('caAddress').textContent = data.contract_address;
      document.getElementById('footerCAAddress').textContent = data.contract_address;
      document.getElementById('caSection').classList.remove('hidden');
    } else {
      document.getElementById('caSection').classList.add('hidden');
      document.getElementById('footerCA').classList.add('hidden');
    }

    /* -- X handle -- */
    if (data.x_handle) {
      const xUrl = data.x_url || `https://x.com/${data.x_handle.replace('@', '')}`;
      document.getElementById('xHandle').textContent = data.x_handle;
      document.getElementById('xFollowBtn').href = xUrl;
      document.getElementById('footerXLink').href = xUrl;

      /* Nav X link */
      document.getElementById('navX').textContent = `𝕏 ${data.x_handle}`;
      document.getElementById('navX').href = xUrl;
      document.getElementById('navXLink').classList.remove('hidden');

      document.getElementById('xSection').classList.remove('hidden');
    } else {
      document.getElementById('xSection').classList.add('hidden');
    }

  } catch (err) {
    console.error('Settings load error:', err);
  }
}

/* ============================================================
   COPY CONTRACT ADDRESS
============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  const copyBtn = document.getElementById('caCopyBtn');
  if (copyBtn) {
    copyBtn.addEventListener('click', copyCA);
  }
});

async function copyCA() {
  const address = document.getElementById('caAddress').textContent;
  if (!address || address === 'Loading...') return;

  try {
    await navigator.clipboard.writeText(address);
    const btn  = document.getElementById('caCopyBtn');
    const icon = document.getElementById('caCopyIcon');
    const text = document.getElementById('caCopyText');
    btn.classList.add('copied');
    icon.textContent = '✓';
    text.textContent = 'Copied!';
    setTimeout(() => {
      btn.classList.remove('copied');
      icon.textContent = '⧉';
      text.textContent = 'Copy';
    }, 2000);
  } catch {
    /* Fallback for older browsers */
    const ta = document.createElement('textarea');
    ta.value = address;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
}

/* ============================================================
   LOAD ACTIVE QUIZ
============================================================ */
async function loadActiveQuiz() {
  const loading = document.getElementById('quizLoading');
  const empty   = document.getElementById('quizEmpty');
  const card    = document.getElementById('quizCard');
  const formDiv = document.getElementById('submissionForm');
  const noQuiz  = document.getElementById('formNoQuiz');

  try {
    const { data, error } = await db
      .from('quizzes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    loading.classList.add('hidden');

    if (error || !data) {
      empty.classList.remove('hidden');
      formDiv.classList.add('hidden');
      noQuiz.classList.remove('hidden');
      return;
    }

    currentQuiz = data;

    /* Populate quiz card */
    document.getElementById('quizTitle').textContent       = data.title || 'Current Quiz';
    document.getElementById('quizQuestion').textContent    = data.question;
    document.getElementById('quizDescription').textContent = data.description || '';

    document.getElementById('quizReward').textContent = data.reward
      ? `🏆 ${data.reward}`
      : '—';

    if (data.deadline) {
      const d = new Date(data.deadline);
      document.getElementById('quizDeadline').textContent = d.toLocaleString(undefined, {
        year: 'numeric', month: 'short', day: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } else {
      document.getElementById('quizDeadline').textContent = 'Open';
    }

    card.classList.remove('hidden');
    formDiv.classList.remove('hidden');
    noQuiz.classList.add('hidden');

  } catch (err) {
    console.error('Quiz load error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

/* ============================================================
   SUBMIT ANSWER
============================================================ */
async function submitAnswer() {
  const btn       = document.getElementById('submitBtn');
  const alertDiv  = document.getElementById('formAlert');
  const successEl = document.getElementById('submitSuccess');

  const username = document.getElementById('username').value.trim();
  const wallet   = document.getElementById('wallet').value.trim();
  const answer   = document.getElementById('answer').value.trim();

  /* Clear previous messages */
  alertDiv.innerHTML  = '';
  successEl.classList.add('hidden');

  /* Validation */
  if (!username) return showFormError('Please enter your username.');
  if (!wallet)   return showFormError('Please enter your Solana wallet address.');
  if (!answer)   return showFormError('Please write your answer.');
  if (!currentQuiz) return showFormError('No active quiz found. Please refresh the page.');

  btn.disabled = true;
  btn.textContent = 'Submitting...';

  try {
    /* Check for duplicate submission (same wallet + same quiz) */
    const { data: existing } = await db
      .from('submissions')
      .select('id')
      .eq('wallet', wallet.toLowerCase())
      .eq('quiz_id', currentQuiz.id)
      .maybeSingle();

    if (existing) {
      showFormError('This wallet address has already submitted an answer for this quiz.');
      btn.disabled = false;
      btn.textContent = '⚽ Submit Answer';
      return;
    }

    /* Insert submission */
    const { error } = await db.from('submissions').insert({
      quiz_id:  currentQuiz.id,
      username: username,
      wallet:   wallet.toLowerCase(),
      answer:   answer,
      status:   'pending'
    });

    if (error) throw error;

    /* Show success */
    successEl.classList.remove('hidden');
    document.getElementById('username').value = '';
    document.getElementById('wallet').value   = '';
    document.getElementById('answer').value   = '';

    /* Scroll to success message */
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    console.error('Submit error:', err);
    showFormError('Submission failed. Please try again. ' + (err.message || ''));
  } finally {
    btn.disabled = false;
    btn.textContent = '⚽ Submit Answer';
  }
}

function showFormError(msg) {
  const alertDiv = document.getElementById('formAlert');
  alertDiv.innerHTML = `<div class="alert alert-error">${msg}</div>`;
  alertDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ============================================================
   LOAD RECENT WINNERS
   Shows submissions where status = 'paid', ordered by date
============================================================ */
async function loadRecentWinners() {
  const loading = document.getElementById('winnersLoading');
  const table   = document.getElementById('winnersTable');
  const empty   = document.getElementById('winnersEmpty');
  const tbody   = document.getElementById('winnersBody');

  try {
    const { data, error } = await db
      .from('submissions')
      .select('username, quiz_id, status, tx_hash, created_at, quizzes(reward)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(20);

    loading.classList.add('hidden');

    if (error || !data || data.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.map((row, i) => {
      const reward = row.quizzes?.reward || '—';
      const tx     = row.tx_hash
        ? `<a
             href="https://solscan.io/tx/${row.tx_hash}"
             target="_blank"
             rel="noopener"
             class="tx-link"
             title="${row.tx_hash}"
           >${row.tx_hash.slice(0, 8)}…${row.tx_hash.slice(-4)}</a>`
        : '—';

      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.8rem">${i + 1}</td>
          <td><span class="winner-username">${escapeHtml(row.username)}</span></td>
          <td><span class="winner-reward">${escapeHtml(reward)}</span></td>
          <td>${tx}</td>
        </tr>
      `;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    console.error('Winners load error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

/* ============================================================
   UTILITY
============================================================ */
function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
