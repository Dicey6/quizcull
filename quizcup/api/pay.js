/* ============================================================
   QUIZ CUP — Vercel Serverless Function: /api/pay
   Signs and broadcasts a SOL transfer on Solana mainnet.
   Called by the admin panel after manually approving a submission.
   ============================================================ */

const {
  Connection,
  Keypair,
  LAMPORTS_PER_SOL,
  PublicKey,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} = require('@solana/web3.js');
const { createClient } = require('@supabase/supabase-js');
const bs58 = require('bs58');

module.exports = async function handler(req, res) {
  /* CORS — admin panel is on the same origin but be explicit */
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  /* ---- Auth check ---- */
  const token = (req.headers.authorization || '').replace('Bearer ', '').trim();
  if (!token || token !== process.env.ADMIN_API_SECRET) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { submissionId } = req.body || {};
  if (!submissionId) {
    return res.status(400).json({ error: 'submissionId is required' });
  }

  /* ---- Supabase (anon key is fine — RLS is disabled) ---- */
  const db = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
  );

  /* ---- Fetch submission + quiz reward amount ---- */
  const { data: submission, error: fetchErr } = await db
    .from('submissions')
    .select('id, status, wallet, username, quizzes(reward_sol)')
    .eq('id', submissionId)
    .single();

  if (fetchErr || !submission) {
    return res.status(404).json({ error: 'Submission not found' });
  }
  if (submission.status !== 'approved') {
    return res.status(400).json({
      error: `Submission is "${submission.status}" — must be "approved" first`,
    });
  }
  if (!submission.wallet) {
    return res.status(400).json({ error: 'Submission has no wallet address' });
  }

  const rewardSol = parseFloat(submission.quizzes?.reward_sol);
  if (!rewardSol || isNaN(rewardSol) || rewardSol <= 0) {
    return res.status(400).json({
      error: 'Quiz has no reward_sol amount set. Edit the quiz in admin and add the SOL amount.',
    });
  }

  /* ---- Lock to "processing" to prevent double-send ---- */
  const { error: lockErr } = await db
    .from('submissions')
    .update({ status: 'processing' })
    .eq('id', submissionId)
    .eq('status', 'approved'); /* only succeeds if still "approved" */

  if (lockErr) {
    return res.status(500).json({ error: 'Could not lock submission — it may already be processing' });
  }

  try {
    /* ---- Build keypair from private key ---- */
    const rawKey = (process.env.SOLANA_PRIVATE_KEY || '').trim();
    if (!rawKey) throw new Error('SOLANA_PRIVATE_KEY env var not set in Vercel');

    const secretKey = bs58.decode(rawKey);
    const senderKeypair = Keypair.fromSecretKey(secretKey);

    /* ---- Connect to Solana ---- */
    const rpcEndpoint =
      process.env.SOLANA_RPC || 'https://api.mainnet-beta.solana.com';
    const connection = new Connection(rpcEndpoint, 'confirmed');

    /* ---- Build & send transfer transaction ---- */
    const lamports = Math.round(rewardSol * LAMPORTS_PER_SOL);
    const recipientPubkey = new PublicKey(submission.wallet);

    const tx = new Transaction().add(
      SystemProgram.transfer({
        fromPubkey: senderKeypair.publicKey,
        toPubkey: recipientPubkey,
        lamports,
      })
    );

    const txSig = await sendAndConfirmTransaction(
      connection,
      tx,
      [senderKeypair],
      { commitment: 'confirmed' }
    );

    /* ---- Mark as paid ---- */
    await db
      .from('submissions')
      .update({ status: 'paid', tx_hash: txSig })
      .eq('id', submissionId);

    return res.status(200).json({
      success: true,
      txHash: txSig,
      amount: rewardSol,
      recipient: submission.wallet,
    });

  } catch (err) {
    /* Roll back to "approved" so admin can retry */
    await db
      .from('submissions')
      .update({ status: 'approved' })
      .eq('id', submissionId);

    console.error('Pay error:', err);
    return res.status(500).json({ error: err.message || 'Transaction failed' });
  }
};
