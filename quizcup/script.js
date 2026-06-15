/* ============================================================
   QUIZ CUP — Homepage Script (script.js)
   ============================================================ */

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentQuiz = null;

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', async () => {
  setupNavToggle();
  document.getElementById('caCopyBtn').addEventListener('click', copyCA);
  await Promise.all([
    loadSettings(),
    loadActiveQuiz(),
    loadRecentWinners()
  ]);
});

/* ---- Mobile nav toggle ---- */
function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  /* Close when a link is tapped */
  links.querySelectorAll('a').forEach(a => {
    a.addEventListener('click', () => links.classList.remove('open'));
  });
}

/* ---- Load settings (CA, X handle) ---- */
async function loadSettings() {
  try {
    const { data } = await db.from('settings').select('*').eq('id', 1).single();
    if (!data) return;

    /* Contract Address */
    if (data.show_ca && data.contract_address) {
      document.getElementById('caAddress').textContent      = data.contract_address;
      document.getElementById('footerCAAddress').textContent = data.contract_address;
      document.getElementById('caSection').classList.remove('hidden');
    } else {
      document.getElementById('caSection').classList.add('hidden');
      document.getElementById('footerCA').classList.add('hidden');
    }

    /* X handle */
    if (data.x_handle) {
      const xUrl = data.x_url || `https://x.com/${data.x_handle.replace('@', '')}`;
      document.getElementById('xHandle').textContent    = data.x_handle;
      document.getElementById('xFollowBtn').href        = xUrl;
      document.getElementById('footerXLink').href       = xUrl;
      document.getElementById('navX').textContent       = `𝕏 ${data.x_handle}`;
      document.getElementById('navX').href              = xUrl;
      document.getElementById('navXLink').classList.remove('hidden');
      document.getElementById('xSection').classList.remove('hidden');
    } else {
      document.getElementById('xSection').classList.add('hidden');
    }
  } catch (err) {
    console.error('Settings error:', err);
  }
}

/* ---- Copy CA ---- */
async function copyCA() {
  const address = document.getElementById('caAddress').textContent;
  if (!address || address === 'Loading...') return;
  try {
    await navigator.clipboard.writeText(address);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = address;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
  }
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
}

/* ---- Load active quiz ---- */
async function loadActiveQuiz() {
  const loading  = document.getElementById('quizLoading');
  const empty    = document.getElementById('quizEmpty');
  const card     = document.getElementById('quizCard');

  try {
    const { data } = await db
      .from('quizzes')
      .select('*')
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    loading.classList.add('hidden');

    if (!data) {
      empty.classList.remove('hidden');
      return;
    }

    currentQuiz = data;

    document.getElementById('quizTitle').textContent       = data.title || 'Current Quiz';
    document.getElementById('quizQuestion').textContent    = data.question;
    document.getElementById('quizDescription').textContent = data.description || '';
    document.getElementById('quizReward').textContent      = data.reward ? `${data.reward}` : '—';

    if (data.deadline) {
      const d = new Date(data.deadline);
      document.getElementById('quizDeadline').textContent = d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
    } else {
      document.getElementById('quizDeadline').textContent = 'Open';
    }

    card.classList.remove('hidden');

  } catch (err) {
    console.error('Quiz load error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

/* ---- Submit answer ---- */
async function submitAnswer() {
  const btn       = document.getElementById('submitBtn');
  const alertDiv  = document.getElementById('formAlert');
  const successEl = document.getElementById('submitSuccess');

  const username = document.getElementById('username').value.trim();
  const wallet   = document.getElementById('wallet').value.trim();
  const answer   = document.getElementById('answer').value.trim();

  alertDiv.innerHTML = '';
  successEl.classList.add('hidden');

  if (!username) return showFormError('Please enter your username.');
  if (!wallet)   return showFormError('Please enter your wallet address.');
  if (!answer)   return showFormError('Please write your answer.');
  if (!currentQuiz) return showFormError('No active quiz found. Please refresh.');

  btn.disabled    = true;
  btn.textContent = 'Submitting...';

  try {
    /* Duplicate check: one wallet per quiz */
    const { data: existing } = await db
      .from('submissions')
      .select('id')
      .eq('wallet', wallet.toLowerCase())
      .eq('quiz_id', currentQuiz.id)
      .maybeSingle();

    if (existing) {
      showFormError('This wallet has already submitted for this quiz.');
      return;
    }

    const { error } = await db.from('submissions').insert({
      quiz_id:  currentQuiz.id,
      username: username,
      wallet:   wallet.toLowerCase(),
      answer:   answer,
      status:   'pending'
    });

    if (error) throw error;

    /* Clear and show success */
    document.getElementById('username').value = '';
    document.getElementById('wallet').value   = '';
    document.getElementById('answer').value   = '';
    successEl.classList.remove('hidden');
    successEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

  } catch (err) {
    showFormError('Submission failed. Please try again.');
    console.error('Submit error:', err);
  } finally {
    btn.disabled    = false;
    btn.textContent = '⚽ Submit Answer';
  }
}

function showFormError(msg) {
  const alertDiv = document.getElementById('formAlert');
  alertDiv.innerHTML = `<div class="alert alert-error">${msg}</div>`;
  alertDiv.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/* ---- Load recent winners ---- */
async function loadRecentWinners() {
  const loading = document.getElementById('winnersLoading');
  const table   = document.getElementById('winnersTable');
  const empty   = document.getElementById('winnersEmpty');
  const tbody   = document.getElementById('winnersBody');

  try {
    const { data } = await db
      .from('submissions')
      .select('username, status, tx_hash, created_at, quizzes(reward)')
      .eq('status', 'paid')
      .order('created_at', { ascending: false })
      .limit(20);

    loading.classList.add('hidden');

    if (!data || data.length === 0) {
      empty.classList.remove('hidden');
      return;
    }

    tbody.innerHTML = data.map((row, i) => {
      const reward = row.quizzes?.reward || '—';
      const tx     = row.tx_hash
        ? `<a href="https://solscan.io/tx/${row.tx_hash}" target="_blank" rel="noopener" class="tx-link">${row.tx_hash.slice(0,8)}…</a>`
        : '—';
      return `
        <tr>
          <td style="color:var(--text-muted);font-size:0.78rem">${i + 1}</td>
          <td><span class="winner-username">${escapeHtml(row.username)}</span></td>
          <td><span class="winner-reward">${escapeHtml(reward)}</span></td>
          <td>${tx}</td>
        </tr>`;
    }).join('');

    table.classList.remove('hidden');

  } catch (err) {
    console.error('Winners error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
