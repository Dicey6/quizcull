# Quiz Cup

**Answer. Get Approved. Earn.**

A Solana meme coin quiz website. Users submit answers to quizzes, admin reviews and approves manually, rewards are distributed manually.

---

## File Structure

```
quizcup/
├── index.html       ← Homepage (quiz, form, winners)
├── status.html      ← Users check their submission status
├── admin.html       ← Admin dashboard (password protected)
├── styles.css       ← All styles (one file)
├── script.js        ← Homepage logic
├── status.js        ← Status page logic
├── admin.js         ← Admin panel logic
├── config.js        ← ← EDIT THIS FIRST
└── assets/
    ├── logo.png
    └── background.jpg
```

---

## Step 1 — Supabase Setup

Create a free project at [supabase.com](https://supabase.com), then run this SQL in the **SQL Editor**:

```sql
-- Settings table (one row only)
CREATE TABLE settings (
  id               SERIAL PRIMARY KEY,
  contract_address TEXT    DEFAULT '',
  show_ca          BOOLEAN DEFAULT true,
  x_handle         TEXT    DEFAULT '',
  x_url            TEXT    DEFAULT '',
  logo             TEXT    DEFAULT '',
  background       TEXT    DEFAULT ''
);

-- Insert the single settings row
INSERT INTO settings (id, contract_address, show_ca) VALUES (1, '', true);

-- Quizzes table
CREATE TABLE quizzes (
  id          SERIAL PRIMARY KEY,
  title       TEXT      NOT NULL,
  question    TEXT      NOT NULL,
  description TEXT      DEFAULT '',
  reward      TEXT      DEFAULT '',
  deadline    TIMESTAMP,
  status      TEXT      DEFAULT 'active',
  created_at  TIMESTAMP DEFAULT NOW()
);

-- Submissions table
CREATE TABLE submissions (
  id         SERIAL PRIMARY KEY,
  quiz_id    INTEGER   REFERENCES quizzes(id),
  username   TEXT      NOT NULL,
  wallet     TEXT      NOT NULL,
  answer     TEXT      NOT NULL,
  status     TEXT      DEFAULT 'pending',
  tx_hash    TEXT      DEFAULT '',
  created_at TIMESTAMP DEFAULT NOW()
);
```

### Row Level Security (RLS)

In **Supabase → Authentication → Policies**, enable RLS on all three tables, then add these policies:

**`settings` table:**
- Allow `SELECT` for `anon` — so the homepage can read CA and X settings.
- Allow `UPDATE` / `INSERT` for `anon` — needed for admin panel to save settings via the browser. *(Restrict by IP or add a server function if you need tighter security later.)*

**`quizzes` table:**
- Allow `SELECT` for `anon` — users see the active quiz.
- Allow `INSERT`, `UPDATE` for `anon` — admin panel manages quizzes.

**`submissions` table:**
- Allow `SELECT` for `anon` — status page reads submissions.
- Allow `INSERT` for `anon` — users submit answers.
- Allow `UPDATE` for `anon` — admin marks status/tx hash.

> **Shortcut for now:** In Supabase → Table Editor, you can also just turn off RLS entirely on all three tables while testing. Turn it back on before going public.

---

## Step 2 — Configure `config.js`

Open `config.js` and fill in your values:

```js
const CONFIG = {
  SUPABASE_URL:   'https://xxxxxxxxxxxx.supabase.co',
  SUPABASE_KEY:   'eyJhbGciOi...your anon key...',
  ADMIN_PASSWORD: 'choose-a-strong-password'
};
```

- **SUPABASE_URL** and **SUPABASE_KEY** are in Supabase → Settings → API.
- The anon/public key is safe to use in the browser for this project.
- **Change ADMIN_PASSWORD** before going live.

---

## Step 3 — Test Locally

Open `index.html` in a browser. Because the site uses the Supabase JS CDN (no build step needed), it works by just opening the files.

> If your browser blocks `file://` requests, use VS Code Live Server or `npx serve quizcup`.

---

## Step 4 — Deploy to Vercel via GitHub

1. Push the `quizcup/` folder to a GitHub repository.
2. Go to [vercel.com](https://vercel.com) → New Project → Import your repo.
3. Set **Root Directory** to `quizcup` (so Vercel serves from that folder).
4. No build command needed — it's plain HTML.
5. Click Deploy.

Your site will be live at `your-project.vercel.app`.

---

## Admin Panel

Access at `/admin.html`. Password is set in `config.js`.

**Features:**
- Overview — submission stats + active quiz summary
- Submissions — approve / reject / mark paid with TX hash
- Winners — all paid submissions
- Quiz — create or edit quizzes
- Settings — contract address, X handle, logo/background overrides

**Workflow:**
1. Create a quiz in the Admin → Quiz tab.
2. Users submit answers on the homepage.
3. Go to Submissions → review answers → click Approve or Reject.
4. For approved submissions, paste the TX hash and click Pay.
5. Status updates automatically on the user-facing status page.

---

## Notes

- One active quiz at a time. Activating a new quiz auto-closes the previous one.
- One submission per wallet per quiz. Duplicate wallets are rejected on the frontend.
- Wallets are stored lowercase for consistent deduplication.
- No automatic payments — all rewards are manual.
- This is not a gambling site. Rewards are discretionary.
