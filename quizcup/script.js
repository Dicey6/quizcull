/* ============================================================
   QUIZ CUP — Homepage Script
   ============================================================ */

const { createClient } = supabase;
const db = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_KEY);

let currentQuiz    = null;
let countdownTimer = null;

/* ---- Init ---- */
document.addEventListener('DOMContentLoaded', async () => {
  setupNavToggle();
  setupScrollReveal();
  document.getElementById('caCopyBtn').addEventListener('click', copyCA);

  await Promise.all([
    loadSettings(),
    loadActiveQuiz()
  ]);
});

/* ---- Mobile nav ---- */
function setupNavToggle() {
  const toggle = document.getElementById('navToggle');
  const links  = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => links.classList.toggle('open'));
  links.querySelectorAll('a').forEach(a =>
    a.addEventListener('click', () => links.classList.remove('open'))
  );
}

/* ---- Scroll reveal (IntersectionObserver) ---- */
function setupScrollReveal() {
  const els = document.querySelectorAll('.reveal');
  if (!els.length) return;

  const observer = new IntersectionObserver(entries => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        e.target.classList.add('visible');
        observer.unobserve(e.target);
      }
    });
  }, { threshold: 0.12 });

  els.forEach(el => observer.observe(el));
}

/* ---- Load settings ---- */
async function loadSettings() {
  try {
    const { data } = await db.from('settings').select('*').eq('id', 1).single();
    if (!data) return;

    /* CA */
    if (data.show_ca && data.contract_address) {
      document.getElementById('caAddress').textContent      = data.contract_address;
      document.getElementById('footerCAAddress').textContent = data.contract_address;
      document.getElementById('caSection').classList.remove('hidden');
    } else {
      document.getElementById('caSection').classList.add('hidden');
      document.getElementById('footerCA').classList.add('hidden');
    }

    /* X */
    if (data.x_handle) {
      const xUrl = data.x_url || `https://x.com/${data.x_handle.replace('@', '')}`;
      document.getElementById('xHandle').textContent = `Follow @${data.x_handle.replace('@','')} on X`;
      document.getElementById('xFollowBtn').href     = xUrl;
      document.getElementById('footerXLink').href    = xUrl;
      document.getElementById('navX').textContent    = `𝕏 ${data.x_handle}`;
      document.getElementById('navX').href           = xUrl;
      document.getElementById('navXLink').classList.remove('hidden');
      document.getElementById('xBlock').classList.remove('hidden');
    }
  } catch (err) {
    console.error('Settings error:', err);
  }
}

/* ---- Copy CA ---- */
async function copyCA() {
  const address = document.getElementById('caAddress').textContent;
  if (!address || address === 'Loading...') return;

  try { await navigator.clipboard.writeText(address); }
  catch {
    const ta = document.createElement('textarea');
    ta.value = address; document.body.appendChild(ta);
    ta.select(); document.execCommand('copy');
    document.body.removeChild(ta);
  }

  const btn  = document.getElementById('caCopyBtn');
  const icon = document.getElementById('caCopyIcon');
  const text = document.getElementById('caCopyText');
  btn.classList.add('copied');
  btn.style.background = 'linear-gradient(135deg,#00a04c,#007a38)';
  icon.textContent = '✓';
  text.textContent = 'Copied!';
  setTimeout(() => {
    btn.classList.remove('copied');
    btn.style.background = '';
    icon.textContent = '⧉';
    text.textContent = 'Copy Contract Address';
  }, 2200);
}

/* ---- Load active quiz ---- */
async function loadActiveQuiz() {
  const loading = document.getElementById('quizLoading');
  const empty   = document.getElementById('quizEmpty');
  const card    = document.getElementById('quizCard');

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
      document.getElementById('countdownWrap').classList.add('hidden');
      return;
    }

    currentQuiz = data;

    document.getElementById('quizTitle').textContent       = data.title || 'Current Quiz';
    document.getElementById('quizQuestion').textContent    = data.question;
    document.getElementById('quizDescription').textContent = data.description || '';
    document.getElementById('quizReward').textContent      = data.reward || '—';

    if (data.deadline) {
      const d = new Date(data.deadline);
      document.getElementById('quizDeadline').textContent = d.toLocaleString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      startCountdown(data.deadline);
    } else {
      document.getElementById('quizDeadline').textContent = 'Open';
      document.getElementById('countdownWrap').classList.add('hidden');
    }

    card.classList.remove('hidden');
    /* Trigger reveal for the newly shown card */
    setTimeout(() => card.querySelector('.reveal') && setupScrollReveal(), 50);

  } catch (err) {
    console.error('Quiz load error:', err);
    loading.classList.add('hidden');
    empty.classList.remove('hidden');
  }
}

/* ---- Countdown timer ---- */
function startCountdown(deadline) {
  const wrap    = document.getElementById('countdownWrap');
  const daysEl  = document.getElementById('timerDays');
  const hrsEl   = document.getElementById('timerHrs');
  const minEl   = document.getElementById('timerMin');
  const secEl   = document.getElementById('timerSec');

  if (!wrap || !daysEl) return;
  wrap.classList.remove('hidden');

  if (countdownTimer) clearInterval(countdownTimer);

  function tick() {
    const now  = Date.now();
    const end  = new Date(deadline).getTime();
    const diff = end - now;

    if (diff <= 0) {
      clearInterval(countdownTimer);
      wrap.innerHTML = '<p class="timer-expired" style="text-align:center;padding:12px 0">⏰ Quiz has ended</p>';
      return;
    }

    const days = Math.floor(diff / 86400000);
    const hrs  = Math.floor((diff % 86400000) / 3600000);
    const min  = Math.floor((diff % 3600000)  / 60000);
    const sec  = Math.floor((diff % 60000)    / 1000);

    /* Animate digit when it changes */
    function setDigit(el, val) {
      const str = String(val).padStart(2, '0');
      if (el.textContent !== str) {
        el.style.animation = 'none';
        el.textContent = str;
        void el.offsetWidth; /* reflow */
        el.style.animation = 'countUp 0.25s ease';
      }
    }

    setDigit(daysEl, days);
    setDigit(hrsEl,  hrs);
    setDigit(minEl,  min);
    setDigit(secEl,  sec);
  }

  tick();
  countdownTimer = setInterval(tick, 1000);
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
  if (!currentQuiz) return showFormError('No active quiz. Please refresh.');

  btn.disabled    = true;
  btn.textContent = 'Submitting...';

  try {
    /* Duplicate check */
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

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
