import { useState, useRef } from "react";
import { isSupabaseConfigured, saveWorkshopResponse } from "./lib/supabase";

// ─── DATA ─────────────────────────────────────────────────────────────────────

const SCAM_QUESTIONS = [
  {
    id: "A",
    label: "BANK SMS",
    message: "MAY8ANK: Your acct suspended. Click: bit.ly/mbbverify now!",
    channel: "SMS",
    answer: "SCAM",
    explanation: "The sender name 'MAY8ANK' is spoofed — not the real Maybank. The link uses bit.ly to hide the destination. Legitimate banks never ask you to click SMS links to unsuspend accounts.",
    flags: ["Spoofed sender name", "Shortened URL hides destination", "Urgency + threat of suspension"],
  },
  {
    id: "B",
    label: "SHOPEE NOTIFICATION",
    message: "Your order #SG8821 has been shipped! Estimated arrival: 2–3 days.",
    channel: "App Notification",
    answer: "LEGIT",
    explanation: "This is a standard order tracking update. No link to click, no personal data requested, no urgency language. It matches exactly what you'd expect from a purchase you made.",
    flags: ["No suspicious link", "No personal data requested", "Matches expected behaviour"],
  },
  {
    id: "C",
    label: "WHATSAPP MESSAGE",
    message: '"Hey it\'s me, I lost my phone. Can you transfer RM200 to this number? 012-XXXXXXX"',
    channel: "WhatsApp",
    answer: "SCAM",
    explanation: "Classic account hijacking pattern. Your contact's account was compromised. The request combines urgency, a new number, and money — without any way to verify it's really them. Always call their real number first.",
    flags: ["New unknown number", "Urgency + money request", "No verification possible"],
  },
  {
    id: "D",
    label: "EMAIL LOGIN PAGE",
    message: "Your PayPal account requires verification. Login here: paypa1-secure.net/verify",
    channel: "Email",
    answer: "SCAM",
    explanation: "'paypa1' uses the number 1 instead of the letter l — a classic lookalike domain. The real domain is paypal.com. Never enter credentials on a URL you received unsolicited.",
    flags: ["Fake lookalike domain (paypa1 ≠ paypal)", "Unsolicited credential request", "External link not from paypal.com"],
  },
];

const SCENARIOS = [
  {
    id: "A",
    risk: "HIGH",
    title: "The Bank Officer Call",
    story: "You receive a WhatsApp call from someone claiming to be your bank. The caller knows your full name, IC number, and last 4 digits of your card. He says your account has been flagged for fraud and you must transfer funds to a 'safe account' immediately.",
    scamType: "Macau Scam / Vishing",
    triggers: ["Authority", "Fear", "Urgency", "Secrecy"],
    correctAction: "HANG UP. Call your bank directly using the number on the back of your card. No legitimate bank will ask you to transfer to a 'safe account'.",
  },
  {
    id: "B",
    risk: "MEDIUM",
    title: "The Crypto Investment DM",
    story: "An Instagram DM from someone you met at a conference. They say there is a crypto investment returning 300% monthly. They show you screenshots of their earnings and a live dashboard of trades.",
    scamType: "Pig Butchering / Investment Fraud",
    triggers: ["Greed", "Social Proof", "Trust / Rapport"],
    correctAction: "Do NOT invest. Verify the platform at sc.com.my/investor-alert. No legitimate investment guarantees 300% monthly returns. The 'dashboard' is fabricated.",
  },
  {
    id: "C",
    risk: "HIGH",
    title: "Mum at the Police Station",
    story: "Your mother calls, crying, saying she is at the police station. She is not allowed to speak to family. A 'police officer' then takes the phone, asking you to transfer RM5,000 bail while keeping it confidential.",
    scamType: "Macau Scam + AI Voice Clone",
    triggers: ["Fear", "Love / Loyalty", "Authority", "Secrecy"],
    correctAction: "Do NOT transfer. Call your mother's number directly. Use your family codeword if you have one. Real police do not call for bail money — this is always a scam.",
  },
  {
    id: "D",
    risk: "HIGH",
    title: "LHDN Tax Refund Email",
    story: "An email from LHDN says your tax refund of RM1,200 is ready. Click the link to verify your details and choose your bank. The URL starts with: lhdn-refund.my/verify",
    scamType: "Phishing (Email)",
    triggers: ["Greed", "Authority", "Urgency"],
    correctAction: "Do NOT click. The real LHDN domain is hasil.gov.my. Log in directly at ezhasil.hasil.gov.my to check your refund status. Never follow email links to government portals.",
  },
];

const PLEDGE_ITEMS = [
  { id: 1, text: "Enable 2FA on my email and banking apps", category: "Account Security" },
  { id: 2, text: "Create and use a passphrase instead of a simple password", category: "Account Security" },
  { id: 3, text: "Review and revoke unnecessary app permissions on my phone", category: "Mobile Security" },
  { id: 4, text: "Establish a family emergency codeword", category: "AI Threat Defence" },
  { id: 5, text: "Apply STOP → CHECK → REPORT to every suspicious message", category: "Response Framework" },
  { id: 6, text: "Lock down my social media privacy settings this week", category: "Social Media" },
  { id: 7, text: "Share what I learned today with at least one family member", category: "Community Protection" },
];

const PHONE_AUDIT = [
  { id: "p1", section: "App Permissions", text: "Camera access — only granted to apps that need it (camera, video call apps)" },
  { id: "p2", section: "App Permissions", text: "Microphone access — not granted to games, utilities, or apps that have no voice function" },
  { id: "p3", section: "App Permissions", text: "SMS access — only granted to banking apps and messaging apps (never to games or utilities)" },
  { id: "p4", section: "App Permissions", text: "Location — set to 'While Using' for most apps, not 'Always'" },
  { id: "p5", section: "Unknown Apps", text: "No APK files installed from WhatsApp, Telegram, or SMS links" },
  { id: "p6", section: "Unknown Apps", text: "All installed apps came from Google Play or Apple App Store" },
  { id: "p7", section: "Unknown Apps", text: "No apps you don't recognise or haven't used in the last 3 months" },
  { id: "p8", section: "System Security", text: "Operating system is updated to the latest version" },
  { id: "p9", section: "System Security", text: "Screen lock is enabled (PIN, fingerprint, or Face ID)" },
  { id: "p10", section: "System Security", text: "Find My Phone / Find My Device is enabled" },
];

function createInitialWorkshopState() {
  return {
    sessionId: crypto.randomUUID(),
    participantName: "",
    startedAt: new Date().toISOString(),
    completedAt: null,
    scamOrLegit: null,
    scenarios: null,
    passphrase: null,
    phoneAudit: null,
    stopCheckReport: null,
    pledge: null,
  };
}

function buildWorkshopRow(data) {
  return {
    session_id: data.sessionId,
    participant_name: data.participantName || null,
    started_at: data.startedAt,
    completed_at: data.completedAt || new Date().toISOString(),
    scam_or_legit_score: data.scamOrLegit?.score ?? null,
    scam_or_legit: data.scamOrLegit ?? {},
    scenarios_score: data.scenarios?.score ?? null,
    scenarios: data.scenarios ?? {},
    passphrase: data.passphrase ?? {},
    phone_audit: data.phoneAudit ?? {},
    stop_check_report_score: data.stopCheckReport?.score ?? null,
    stop_check_report: data.stopCheckReport ?? {},
    pledge: data.pledge ?? {},
    metadata: {
      source: "cybersecurity-workshop",
      recorded_in_browser: true,
    },
  };
}

// ─── STYLES ───────────────────────────────────────────────────────────────────

const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Serif+Display:ital@0;1&display=swap');

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  :root {
    --navy: #1B3A6B;
    --navy-dark: #0F2444;
    --navy-mid: #1E3F72;
    --red: #B31B1B;
    --red-light: #FEE2E2;
    --teal: #0E7490;
    --teal-light: #CFFAFE;
    --amber: #B45309;
    --amber-light: #FEF3C7;
    --green: #065F46;
    --green-light: #D1FAE5;
    --white: #FFFFFF;
    --off: #F5F6F8;
    --slate: #334155;
    --muted: #64748B;
    --line: #E2E8F0;
    --shadow: 0 4px 24px rgba(15,36,68,0.10);
    --shadow-lg: 0 8px 40px rgba(15,36,68,0.16);
    --r: 14px;
    --r-sm: 8px;
  }

  html { font-size: 16px; -webkit-text-size-adjust: 100%; }

  body {
    font-family: 'DM Sans', sans-serif;
    background: var(--off);
    color: var(--slate);
    min-height: 100vh;
    overflow-x: hidden;
  }

  /* ── Header ── */
  .app-header {
    background: var(--navy-dark);
    padding: 20px 20px 0;
    position: sticky; top: 0; z-index: 100;
  }
  .app-header-inner {
    display: flex; align-items: center; gap: 12px;
    padding-bottom: 16px;
  }
  .app-logo {
    width: 38px; height: 38px; background: var(--red);
    border-radius: 8px; display: flex; align-items: center;
    justify-content: center; font-size: 18px; flex-shrink: 0;
  }
  .app-title { color: white; font-weight: 700; font-size: 15px; line-height: 1.2; }
  .app-sub { color: #9BB4D4; font-size: 12px; }

  /* Progress steps */
  .progress-bar {
    display: flex; gap: 4px; padding-bottom: 0;
    overflow-x: auto; scrollbar-width: none;
  }
  .progress-bar::-webkit-scrollbar { display: none; }
  .prog-step {
    flex: 1; min-width: 28px; height: 4px;
    background: rgba(255,255,255,0.15);
    border-radius: 2px; transition: background 0.3s;
  }
  .prog-step.done { background: var(--teal); }
  .prog-step.active { background: white; }

  /* ── Screen ── */
  .screen {
    padding: 20px 16px 100px;
    max-width: 540px; margin: 0 auto;
    animation: fadeUp 0.35s ease;
  }
  @keyframes fadeUp {
    from { opacity: 0; transform: translateY(12px); }
    to   { opacity: 1; transform: translateY(0); }
  }

  /* ── Cards ── */
  .card {
    background: white; border-radius: var(--r);
    box-shadow: var(--shadow); padding: 20px;
    margin-bottom: 16px;
  }
  .card-navy {
    background: var(--navy-dark); color: white;
    border-radius: var(--r); padding: 24px 20px; margin-bottom: 16px;
  }

  /* ── Screen title ── */
  .screen-tag {
    display: inline-block;
    background: var(--navy); color: white;
    font-size: 10px; font-weight: 700; letter-spacing: 1.5px;
    padding: 4px 10px; border-radius: 20px; text-transform: uppercase;
    margin-bottom: 10px;
  }
  .screen-title {
    font-family: 'DM Serif Display', serif;
    font-size: 26px; color: var(--navy-dark);
    line-height: 1.2; margin-bottom: 6px;
  }
  .screen-desc {
    color: var(--muted); font-size: 14px; line-height: 1.6;
    margin-bottom: 20px;
  }

  /* ── Message bubble ── */
  .msg-bubble {
    background: var(--off); border-radius: 12px;
    padding: 14px 16px; margin: 12px 0;
    border-left: 4px solid var(--line);
    font-size: 14.5px; line-height: 1.55; color: var(--slate);
    font-family: 'DM Sans', sans-serif;
  }
  .msg-channel {
    font-size: 11px; font-weight: 600; color: var(--muted);
    text-transform: uppercase; letter-spacing: 0.8px;
    margin-bottom: 6px;
  }

  /* ── Vote buttons ── */
  .vote-row { display: flex; gap: 12px; margin-top: 16px; }
  .vote-btn {
    flex: 1; padding: 14px 8px; border: none; border-radius: var(--r-sm);
    font-family: 'DM Sans', sans-serif; font-weight: 700;
    font-size: 15px; cursor: pointer; transition: all 0.18s;
    letter-spacing: 0.5px;
  }
  .vote-scam { background: var(--red-light); color: var(--red); }
  .vote-legit { background: var(--green-light); color: var(--green); }
  .vote-btn:active { transform: scale(0.97); }
  .vote-btn.selected-scam { background: var(--red); color: white; }
  .vote-btn.selected-legit { background: var(--green); color: white; }
  .vote-btn.disabled { opacity: 0.45; pointer-events: none; }

  /* ── Reveal box ── */
  .reveal {
    margin-top: 16px; padding: 16px;
    border-radius: var(--r-sm); animation: fadeUp 0.3s ease;
  }
  .reveal-correct { background: var(--green-light); border: 1px solid #A7F3D0; }
  .reveal-wrong   { background: var(--red-light);   border: 1px solid #FECACA; }
  .reveal-verdict {
    font-weight: 700; font-size: 15px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 8px;
  }
  .reveal-explanation { font-size: 13.5px; line-height: 1.6; color: var(--slate); }
  .flags { margin-top: 10px; display: flex; flex-wrap: wrap; gap: 6px; }
  .flag-chip {
    background: white; border: 1px solid var(--line);
    border-radius: 20px; padding: 3px 10px;
    font-size: 12px; color: var(--muted);
  }

  /* ── Progress counter ── */
  .q-counter {
    font-size: 12px; color: var(--muted); font-weight: 600;
    text-transform: uppercase; letter-spacing: 0.8px; margin-bottom: 6px;
  }

  /* ── Next button ── */
  .btn-primary {
    width: 100%; padding: 16px; border: none;
    background: var(--navy); color: white;
    font-family: 'DM Sans', sans-serif; font-weight: 700;
    font-size: 15px; border-radius: var(--r-sm);
    cursor: pointer; transition: all 0.18s;
    margin-top: 8px; letter-spacing: 0.3px;
  }
  .btn-primary:hover { background: var(--navy-mid); }
  .btn-primary:active { transform: scale(0.98); }
  .btn-primary:disabled { opacity: 0.4; pointer-events: none; }
  .btn-secondary {
    width: 100%; padding: 14px; border: 2px solid var(--navy);
    background: transparent; color: var(--navy);
    font-family: 'DM Sans', sans-serif; font-weight: 700;
    font-size: 15px; border-radius: var(--r-sm);
    cursor: pointer; margin-top: 8px;
  }

  /* ── Scenario card ── */
  .scenario-card {
    background: white; border-radius: var(--r);
    box-shadow: var(--shadow); overflow: hidden; margin-bottom: 16px;
  }
  .scenario-header {
    padding: 14px 18px; display: flex;
    align-items: center; gap: 12px;
  }
  .scenario-letter {
    width: 40px; height: 40px; border-radius: 8px;
    display: flex; align-items: center; justify-content: center;
    font-weight: 800; font-size: 18px; color: white; flex-shrink: 0;
  }
  .risk-badge {
    font-size: 10px; font-weight: 700; letter-spacing: 1px;
    padding: 3px 8px; border-radius: 20px; text-transform: uppercase;
  }
  .risk-high { background: var(--red-light); color: var(--red); }
  .risk-medium { background: var(--amber-light); color: var(--amber); }
  .scenario-body { padding: 0 18px 18px; }
  .scenario-story {
    font-size: 14px; line-height: 1.65; color: var(--slate);
    padding: 14px; background: var(--off); border-radius: 10px;
    margin-bottom: 14px;
  }
  .answer-option {
    border: 2px solid var(--line); border-radius: var(--r-sm);
    padding: 12px 14px; margin-bottom: 8px; cursor: pointer;
    transition: all 0.18s; font-size: 14px; color: var(--slate);
    display: flex; align-items: center; gap: 10px;
  }
  .answer-option:hover { border-color: var(--navy); }
  .answer-option.selected { border-color: var(--navy); background: #EFF6FF; }
  .answer-option.correct-reveal { border-color: var(--green); background: var(--green-light); }
  .answer-option.wrong-reveal { border-color: var(--red); background: var(--red-light); }
  .option-dot {
    width: 20px; height: 20px; border-radius: 50%;
    border: 2px solid var(--line); flex-shrink: 0;
    transition: all 0.18s;
  }
  .answer-option.selected .option-dot { background: var(--navy); border-color: var(--navy); }

  /* ── Passphrase ── */
  .strength-bar-wrap {
    height: 8px; background: var(--line);
    border-radius: 4px; overflow: hidden; margin: 10px 0 4px;
  }
  .strength-bar {
    height: 100%; border-radius: 4px; transition: width 0.4s, background 0.4s;
  }
  .passphrase-input {
    width: 100%; padding: 14px; border: 2px solid var(--line);
    border-radius: var(--r-sm); font-family: 'DM Sans', sans-serif;
    font-size: 15px; color: var(--slate); outline: none;
    transition: border-color 0.2s;
  }
  .passphrase-input:focus { border-color: var(--navy); }
  .strength-label {
    font-size: 12px; font-weight: 700; text-transform: uppercase;
    letter-spacing: 0.8px;
  }
  .example-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
  .example-chip {
    background: var(--off); border: 1px solid var(--line);
    border-radius: 20px; padding: 5px 12px;
    font-size: 12.5px; color: var(--navy); font-weight: 500;
    cursor: pointer; transition: all 0.18s;
  }
  .example-chip:active { background: var(--navy); color: white; }

  /* ── Audit checklist ── */
  .audit-section-title {
    font-size: 11px; font-weight: 700; color: var(--muted);
    text-transform: uppercase; letter-spacing: 1px;
    margin: 20px 0 8px; padding: 0 4px;
  }
  .audit-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 13px 14px; background: white; border-radius: var(--r-sm);
    margin-bottom: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    cursor: pointer; transition: all 0.18s;
    border: 1.5px solid transparent;
  }
  .audit-item.checked { border-color: var(--teal); background: var(--teal-light); }
  .audit-item.failed { border-color: var(--red); background: var(--red-light); }
  .audit-check {
    width: 22px; height: 22px; border-radius: 6px;
    border: 2px solid var(--line); flex-shrink: 0; margin-top: 1px;
    display: flex; align-items: center; justify-content: center;
    transition: all 0.18s;
  }
  .audit-item.checked .audit-check { background: var(--teal); border-color: var(--teal); color: white; }
  .audit-item.failed .audit-check { background: var(--red); border-color: var(--red); color: white; }
  .audit-text { font-size: 13.5px; line-height: 1.5; flex: 1; }
  .audit-fail-btn {
    background: none; border: none; font-size: 11px;
    color: var(--muted); cursor: pointer; margin-top: 2px;
    text-decoration: underline; flex-shrink: 0;
  }

  /* ── Pledge ── */
  .pledge-item {
    display: flex; align-items: flex-start; gap: 12px;
    padding: 14px 16px; background: white; border-radius: var(--r-sm);
    margin-bottom: 8px; box-shadow: 0 1px 4px rgba(0,0,0,0.04);
    cursor: pointer; transition: all 0.18s;
    border: 2px solid var(--line);
  }
  .pledge-item.pledged { border-color: var(--navy); background: #EFF6FF; }
  .pledge-num {
    width: 28px; height: 28px; border-radius: 50%;
    background: var(--off); border: 2px solid var(--line);
    flex-shrink: 0; display: flex; align-items: center; justify-content: center;
    font-weight: 700; font-size: 13px; color: var(--muted);
    transition: all 0.18s;
  }
  .pledge-item.pledged .pledge-num { background: var(--navy); border-color: var(--navy); color: white; }
  .pledge-text { flex: 1; }
  .pledge-main { font-size: 14px; font-weight: 600; color: var(--slate); line-height: 1.4; }
  .pledge-cat { font-size: 11.5px; color: var(--muted); margin-top: 2px; }
  .pledge-count {
    text-align: center; font-size: 13px; color: var(--muted);
    margin: 8px 0; font-weight: 500;
  }
  .pledge-min {
    font-size: 11px; color: var(--amber); font-weight: 700;
    text-align: center; margin-bottom: 12px;
    display: flex; align-items: center; justify-content: center; gap: 4px;
  }

  /* ── Score ── */
  .score-circle {
    width: 110px; height: 110px; border-radius: 50%;
    background: var(--navy-dark); margin: 0 auto 16px;
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
  }
  .score-num {
    font-family: 'DM Serif Display', serif;
    font-size: 38px; color: white; line-height: 1;
  }
  .score-denom { font-size: 13px; color: #9BB4D4; }
  .result-row {
    display: flex; align-items: center; gap: 10px;
    padding: 10px 14px; border-radius: var(--r-sm);
    margin-bottom: 6px; font-size: 13.5px;
  }
  .result-correct { background: var(--green-light); }
  .result-wrong { background: var(--red-light); }

  /* ── Welcome ── */
  .welcome-hero {
    background: var(--navy-dark); border-radius: var(--r);
    padding: 28px 22px; margin-bottom: 16px; text-align: center;
  }
  .welcome-icon { font-size: 42px; margin-bottom: 12px; }
  .welcome-title {
    font-family: 'DM Serif Display', serif;
    font-size: 28px; color: white; margin-bottom: 8px; line-height: 1.2;
  }
  .welcome-sub { color: #9BB4D4; font-size: 14px; line-height: 1.6; }

  .step-list { list-style: none; padding: 0; }
  .step-list li {
    display: flex; gap: 12px; align-items: flex-start;
    padding: 10px 0; border-bottom: 1px solid var(--line);
  }
  .step-list li:last-child { border-bottom: none; }
  .step-num {
    width: 26px; height: 26px; background: var(--navy);
    color: white; border-radius: 50%; flex-shrink: 0;
    display: flex; align-items: center; justify-content: center;
    font-size: 12px; font-weight: 700;
  }
  .step-info strong { display: block; font-size: 14px; color: var(--navy-dark); }
  .step-info span { font-size: 12.5px; color: var(--muted); }

  /* ── Completion ── */
  .completion-header {
    background: linear-gradient(135deg, var(--navy-dark), #1B4A8A);
    border-radius: var(--r); padding: 32px 22px; text-align: center;
    margin-bottom: 16px;
  }
  .completion-title {
    font-family: 'DM Serif Display', serif;
    font-size: 30px; color: white; margin: 12px 0 8px;
  }
  .completion-sub { color: #9BB4D4; font-size: 14px; line-height: 1.6; }
  .commitment-card {
    background: var(--navy-dark); border-radius: var(--r-sm);
    padding: 14px 16px; margin-bottom: 8px;
    display: flex; align-items: center; gap: 12px;
  }
  .commitment-icon { font-size: 20px; flex-shrink: 0; }
  .commitment-text { color: white; font-size: 13.5px; line-height: 1.4; }

  /* ── Nav ── */
  .bottom-nav {
    position: fixed; bottom: 0; left: 0; right: 0;
    background: white; border-top: 1px solid var(--line);
    padding: 10px 16px 20px;
    display: flex; gap: 8px;
    max-width: 540px; margin: 0 auto;
    box-shadow: 0 -4px 20px rgba(0,0,0,0.06);
  }

  /* ── Tags ── */
  .trigger-chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
  .trigger-chip {
    padding: 4px 10px; border-radius: 20px;
    font-size: 12px; font-weight: 600;
  }
  .chip-fear { background: #FEE2E2; color: var(--red); }
  .chip-greed { background: #FEF3C7; color: var(--amber); }
  .chip-authority { background: #DBEAFE; color: #1E40AF; }
  .chip-trust { background: #D1FAE5; color: var(--green); }
  .chip-urgency { background: #FEE2E2; color: var(--red); }
  .chip-secrecy { background: #F3E8FF; color: #6B21A8; }
  .chip-social { background: var(--teal-light); color: var(--teal); }
  .chip-love { background: #FCE7F3; color: #9D174D; }

  /* ── Section break ── */
  .section-intro {
    background: var(--navy); border-radius: var(--r);
    padding: 22px 20px; margin-bottom: 16px; text-align: center;
    color: white;
  }
  .section-intro-num {
    font-family: 'DM Serif Display', serif;
    font-size: 52px; color: var(--red); line-height: 1;
  }
  .section-intro-title {
    font-family: 'DM Serif Display', serif;
    font-size: 22px; margin: 8px 0 6px;
  }
  .section-intro-sub { color: #9BB4D4; font-size: 13px; }
`;

// ─── PASSPHRASE STRENGTH ──────────────────────────────────────────────────────

function calcStrength(pass) {
  if (!pass) return { score: 0, label: "", color: "" };
  const len = pass.length;
  const words = pass.split(/[\s\-_.,!@#$%^&*]+/).filter(Boolean).length;
  const hasNum = /\d/.test(pass);
  const hasSym = /[!@#$%^&*\-_.,]/.test(pass);
  const hasUpper = /[A-Z]/.test(pass);
  let score = 0;
  if (len >= 8) score += 15;
  if (len >= 14) score += 20;
  if (len >= 20) score += 20;
  if (words >= 3) score += 20;
  if (hasNum) score += 10;
  if (hasSym) score += 10;
  if (hasUpper) score += 5;
  score = Math.min(score, 100);
  if (score < 30) return { score, label: "Very Weak", color: "#EF4444" };
  if (score < 50) return { score, label: "Weak", color: "#F97316" };
  if (score < 70) return { score, label: "Moderate", color: "#EAB308" };
  if (score < 85) return { score, label: "Strong", color: "#22C55E" };
  return { score, label: "Very Strong 🔒", color: "#0EA5E9" };
}

const EXAMPLE_PASSPHRASES = [
  "Kucing-Nasi-Lemak-2025",
  "Harimau!Lompat#Putrajaya77",
  "Ikan_Bilis_Goreng_88!",
  "Kopi-Tumpah-Meja-Panas",
];

// ─── COMPONENTS ──────────────────────────────────────────────────────────────

function TriggerChip({ label }) {
  const map = {
    "Fear": "chip-fear", "Greed": "chip-greed", "Authority": "chip-authority",
    "Trust / Rapport": "chip-trust", "Urgency": "chip-urgency",
    "Secrecy": "chip-secrecy", "Social Proof": "chip-social",
    "Love / Loyalty": "chip-love", "Trust": "chip-trust",
  };
  return <span className={`trigger-chip ${map[label] || "chip-authority"}`}>{label}</span>;
}

// ─── SCREENS ─────────────────────────────────────────────────────────────────

function Welcome({ participantName, onParticipantNameChange, onStart }) {
  return (
    <div className="screen">
      <div className="welcome-hero">
        <div className="welcome-icon">🛡️</div>
        <div className="welcome-title">Cybersecurity Awareness Workshop</div>
        <div className="welcome-sub">Your interactive companion for today's session. Complete all 6 activities at your own pace.</div>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy-dark)", marginBottom: 14 }}>
          What you'll do today
        </div>
        <ul className="step-list">
          {[
            ["Scam or Legit?", "Test your instincts on real scam examples"],
            ["Scam Scenarios", "Analyse 4 real Malaysian cases and decide what to do"],
            ["Passphrase Builder", "Create a password that takes centuries to crack"],
            ["Phone Security Audit", "Check your own phone for vulnerabilities"],
            ["STOP → CHECK → REPORT", "Apply the 3-step framework to real situations"],
            ["Action Pledge", "Commit to 5 changes you'll make this week"],
          ].map(([name, desc], i) => (
            <li key={i}>
              <div className="step-num">{i + 1}</div>
              <div className="step-info">
                <strong>{name}</strong>
                <span>{desc}</span>
              </div>
            </li>
          ))}
        </ul>
      </div>
      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy-dark)", marginBottom: 10 }}>
          Participant name
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 12 }}>
          Optional, but useful if you want to identify each participant's submission in Supabase.
        </div>
        <input
          className="passphrase-input"
          type="text"
          value={participantName}
          onChange={(event) => onParticipantNameChange(event.target.value)}
          placeholder="e.g. Zaid Ahmad"
          autoComplete="name"
        />
      </div>
      <button className="btn-primary" onClick={onStart} style={{ fontSize: 16, padding: 18 }}>
        Start the Workshop →
      </button>
    </div>
  );
}

function ScamOrLegit({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [answers, setAnswers] = useState({});
  const [revealed, setRevealed] = useState({});
  const q = SCAM_QUESTIONS[current];
  const answered = answers[q.id] !== undefined;
  const isCorrect = answers[q.id] === q.answer;
  const allDone = Object.keys(answers).length === SCAM_QUESTIONS.length;
  const score = SCAM_QUESTIONS.filter((item) => answers[item.id] === item.answer).length;

  const vote = (choice) => {
    if (answered) return;
    setAnswers(p => ({ ...p, [q.id]: choice }));
    setRevealed(p => ({ ...p, [q.id]: true }));
  };

  return (
    <div className="screen">
      <div className="screen-tag">Activity 1 of 6</div>
      <div className="screen-title">Scam or Legit?</div>
      <div className="screen-desc">Read each message carefully and decide. Trust your instincts first — then we'll explain.</div>

      {!allDone ? (
        <div className="card">
          <div className="q-counter">Message {current + 1} of {SCAM_QUESTIONS.length}</div>
          <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy-dark)", marginBottom: 4 }}>
            {q.label}
          </div>
          <div className="msg-bubble">
            <div className="msg-channel">📱 {q.channel}</div>
            {q.message}
          </div>
          <div className="vote-row">
            <button
              className={`vote-btn vote-scam ${answers[q.id] === "SCAM" ? "selected-scam" : ""} ${answered && answers[q.id] !== "SCAM" ? "disabled" : ""}`}
              onClick={() => vote("SCAM")}>
              🚨 SCAM
            </button>
            <button
              className={`vote-btn vote-legit ${answers[q.id] === "LEGIT" ? "selected-legit" : ""} ${answered && answers[q.id] !== "LEGIT" ? "disabled" : ""}`}
              onClick={() => vote("LEGIT")}>
              ✅ LEGIT
            </button>
          </div>
          {revealed[q.id] && (
            <div className={`reveal ${isCorrect ? "reveal-correct" : "reveal-wrong"}`}>
              <div className="reveal-verdict">
                {isCorrect ? "✅" : "❌"}
                <span>{isCorrect ? "Correct! " : "Not quite — "}{q.answer === "SCAM" ? "This IS a scam." : "This is LEGITIMATE."}</span>
              </div>
              <div className="reveal-explanation">{q.explanation}</div>
              <div className="flags">{q.flags.map(f => <span className="flag-chip" key={f}>⚑ {f}</span>)}</div>
            </div>
          )}
          {answered && (
            <button
              className="btn-primary"
              style={{ marginTop: 16 }}
              onClick={() => {
                if (current < SCAM_QUESTIONS.length - 1) setCurrent(c => c + 1);
              }}
              disabled={current === SCAM_QUESTIONS.length - 1}>
              {current < SCAM_QUESTIONS.length - 1 ? "Next Message →" : "See Results"}
            </button>
          )}
          {answered && current === SCAM_QUESTIONS.length - 1 && (
            <button className="btn-primary" style={{ marginTop: 8 }} onClick={() => setCurrent(0)}>
              Review All Messages
            </button>
          )}
        </div>
      ) : null}

      {/* Mini score summary always visible when all done */}
      {allDone && (
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="score-circle">
              <div className="score-num">
                {score}
              </div>
              <div className="score-denom">out of {SCAM_QUESTIONS.length}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy-dark)" }}>
              {score === SCAM_QUESTIONS.length
                ? "Perfect score! 🎉" : "Good effort — let's review what you missed."}
            </div>
          </div>
          {SCAM_QUESTIONS.map(q => (
            <div key={q.id}
              className={`result-row ${answers[q.id] === q.answer ? "result-correct" : "result-wrong"}`}>
              <span>{answers[q.id] === q.answer ? "✅" : "❌"}</span>
              <span style={{ fontWeight: 600, minWidth: 18 }}>{q.id}.</span>
              <span style={{ flex: 1 }}>{q.label}</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>{q.answer}</span>
            </div>
          ))}
          <button className="btn-primary" style={{ marginTop: 16 }} onClick={() => onComplete({
            score,
            total: SCAM_QUESTIONS.length,
            answers: SCAM_QUESTIONS.map((item) => ({
              questionId: item.id,
              label: item.label,
              selectedAnswer: answers[item.id],
              correctAnswer: item.answer,
              isCorrect: answers[item.id] === item.answer,
            })),
          })}>
            Continue to Scenarios →
          </button>
        </div>
      )}
    </div>
  );
}

function Scenarios({ onComplete }) {
  const [current, setCurrent] = useState(0);
  const [selected, setSelected] = useState({});
  const [revealed, setRevealed] = useState({});
  const sc = SCENARIOS[current];
  const isRevealed = revealed[sc.id];
  const colorMap = { A: "#1B3A6B", B: "#B45309", C: "#B31B1B", D: "#0E7490" };

  const options = [
    "Transfer the money immediately — it sounds urgent.",
    "Hang up / ignore and do nothing.",
    "Call back on an official / known number to verify before acting.",
    "Share the message with a family member and decide together.",
  ];
  const correctIdx = 2;
  const score = SCENARIOS.filter((scenario) => selected[scenario.id] === correctIdx).length;

  return (
    <div className="screen">
      <div className="screen-tag">Activity 2 of 6</div>
      <div className="screen-title">Real Scenarios</div>
      <div className="screen-desc">Analyse each scenario. What type of scam is it, and what should you do?</div>

      <div className="scenario-card">
        <div className="scenario-header" style={{ background: colorMap[sc.id] + "18" }}>
          <div className="scenario-letter" style={{ background: colorMap[sc.id] }}>
            {sc.id}
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy-dark)" }}>{sc.title}</div>
            <span className={`risk-badge ${sc.risk === "HIGH" ? "risk-high" : "risk-medium"}`}>
              {sc.risk} RISK
            </span>
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)", fontWeight: 600 }}>
            {current + 1}/{SCENARIOS.length}
          </div>
        </div>
        <div className="scenario-body">
          <div className="scenario-story">{sc.story}</div>

          {!isRevealed ? (
            <>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", marginBottom: 10, textTransform: "uppercase", letterSpacing: "0.8px" }}>
                What should you do?
              </div>
              {options.map((opt, i) => (
                <div key={i}
                  className={`answer-option ${selected[sc.id] === i ? "selected" : ""}`}
                  onClick={() => setSelected(p => ({ ...p, [sc.id]: i }))}>
                  <div className="option-dot" />
                  <span>{opt}</span>
                </div>
              ))}
              <button
                className="btn-primary"
                disabled={selected[sc.id] === undefined}
                onClick={() => setRevealed(p => ({ ...p, [sc.id]: true }))}>
                Reveal Answer
              </button>
            </>
          ) : (
            <div>
              <div style={{ marginBottom: 14 }}>
                {options.map((opt, i) => (
                  <div key={i}
                    className={`answer-option ${i === correctIdx ? "correct-reveal" : selected[sc.id] === i && i !== correctIdx ? "wrong-reveal" : ""}`}
                    style={{ cursor: "default" }}>
                    <div className="option-dot" style={i === correctIdx ? { background: "var(--green)", borderColor: "var(--green)" } : {}} />
                    <span>{opt}</span>
                  </div>
                ))}
              </div>
              <div style={{ padding: "14px", background: "var(--navy-dark)", borderRadius: "10px", marginBottom: 14 }}>
                <div style={{ color: "#9BB4D4", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", marginBottom: 6 }}>
                  Scam Type: {sc.scamType}
                </div>
                <div style={{ color: "white", fontSize: 13.5, lineHeight: 1.6 }}>{sc.correctAction}</div>
              </div>
              <div>
                <div style={{ fontSize: 12, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 6 }}>
                  Psychological triggers used:
                </div>
                <div className="trigger-chips">
                  {sc.triggers.map(t => <TriggerChip key={t} label={t} />)}
                </div>
              </div>
              <button
                className="btn-primary"
                style={{ marginTop: 16 }}
                onClick={() => {
                  if (current < SCENARIOS.length - 1) setCurrent(c => c + 1);
                  else onComplete({
                    score,
                    total: SCENARIOS.length,
                    answers: SCENARIOS.map((scenario) => ({
                      scenarioId: scenario.id,
                      title: scenario.title,
                      selectedOptionIndex: selected[scenario.id] ?? null,
                      selectedOption: selected[scenario.id] !== undefined ? options[selected[scenario.id]] : null,
                      correctOptionIndex: correctIdx,
                      correctOption: options[correctIdx],
                      isCorrect: selected[scenario.id] === correctIdx,
                      scamType: scenario.scamType,
                      triggers: scenario.triggers,
                    })),
                  });
                }}>
                {current < SCENARIOS.length - 1 ? "Next Scenario →" : "Continue →"}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function PassphraseBuilder({ onComplete }) {
  const [passphrase, setPassphrase] = useState("");
  const strength = calcStrength(passphrase);
  const ready = strength.score >= 70;
  const wordCount = passphrase.split(/[\s\-_.,!@#$%^&*]+/).filter(Boolean).length;
  const hasNumber = /\d/.test(passphrase);
  const hasSymbol = /[!@#$%^&*\-_.,]/.test(passphrase);
  const hasUppercase = /[A-Z]/.test(passphrase);

  return (
    <div className="screen">
      <div className="screen-tag">Activity 3 of 6</div>
      <div className="screen-title">Passphrase Builder</div>
      <div className="screen-desc">Create a passphrase that's both memorable and virtually uncrackable. Use 3–4 random words + a number + a symbol.</div>

      <div className="card">
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--muted)", textTransform: "uppercase", letterSpacing: "0.8px", marginBottom: 10 }}>
          Your passphrase
        </div>
        <input
          className="passphrase-input"
          type="text"
          placeholder="e.g. Kucing-Nasi-Lemak-2025"
          value={passphrase}
          onChange={e => setPassphrase(e.target.value)}
          autoComplete="off"
          spellCheck={false}
        />
        <div className="strength-bar-wrap">
          <div className="strength-bar" style={{
            width: `${strength.score}%`,
            background: strength.color || "var(--line)"
          }} />
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div className="strength-label" style={{ color: strength.color || "var(--muted)" }}>
            {strength.label || "Start typing…"}
          </div>
          <div style={{ fontSize: 12, color: "var(--muted)" }}>{strength.score}/100</div>
        </div>
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy-dark)", marginBottom: 8 }}>
          The Formula
        </div>
        <div style={{ background: "var(--navy-dark)", borderRadius: 8, padding: "12px 14px", marginBottom: 12 }}>
          <div style={{ color: "var(--teal-light)", fontSize: 13, fontWeight: 700, letterSpacing: 0.5, textAlign: "center" }}>
            [Word] + [Word] + [Word] + [Number] + [Symbol]
          </div>
        </div>
        <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
          Tap an example to use it as a starting point:
        </div>
        <div className="example-chips">
          {EXAMPLE_PASSPHRASES.map(p => (
            <span key={p} className="example-chip" onClick={() => setPassphrase(p)}>{p}</span>
          ))}
        </div>
      </div>

      <div className="card" style={{ background: "var(--off)", boxShadow: "none", border: "1px solid var(--line)" }}>
        <div style={{ display: "flex", gap: 12 }}>
          {[
            ["123456", "< 1 sec", "#EF4444"],
            ["Ahmad2024", "3 min", "#F97316"],
            ["KucingNasiLemak2025!", "centuries", "#22C55E"],
          ].map(([ex, time, col]) => (
            <div key={ex} style={{ flex: 1, textAlign: "center" }}>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 4 }}>{ex}</div>
              <div style={{ fontWeight: 800, fontSize: 16, color: col }}>{time}</div>
              <div style={{ fontSize: 10, color: "var(--muted)" }}>to crack</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn-primary" disabled={!ready} onClick={() => onComplete({
        score: strength.score,
        label: strength.label,
        length: passphrase.length,
        wordCount,
        hasNumber,
        hasSymbol,
        hasUppercase,
        usedExample: EXAMPLE_PASSPHRASES.includes(passphrase),
      })}>
        {ready ? "Great passphrase! Continue →" : `Needs to be stronger (${strength.score}/70)`}
      </button>
      {!ready && (
        <div style={{ textAlign: "center", fontSize: 12.5, color: "var(--muted)", marginTop: 8 }}>
          Add more words, numbers, or symbols to strengthen it
        </div>
      )}
    </div>
  );
}

function PhoneAudit({ onComplete }) {
  const [states, setStates] = useState({});
  const sections = [...new Set(PHONE_AUDIT.map(i => i.section))];
  const checkedCount = Object.values(states).filter(v => v === "ok").length;
  const failCount = Object.values(states).filter(v => v === "fail").length;
  const totalDone = checkedCount + failCount;

  const toggle = (id) => {
    setStates(p => {
      const cur = p[id];
      if (!cur) return { ...p, [id]: "ok" };
      if (cur === "ok") return { ...p, [id]: "fail" };
      return { ...p, [id]: undefined };
    });
  };

  return (
    <div className="screen">
      <div className="screen-tag">Activity 4 of 6</div>
      <div className="screen-title">Phone Security Audit</div>
      <div className="screen-desc">Open your phone Settings right now and work through each item. Tap ✓ if done, then tap again to mark ✗ if you need to fix it.</div>

      <div className="card" style={{ padding: "14px 16px" }}>
        <div style={{ display: "flex", justifyContent: "space-between" }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--teal)" }}>{checkedCount}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>✓ Done</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--red)" }}>{failCount}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>✗ Need to fix</div>
          </div>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--muted)" }}>{PHONE_AUDIT.length - totalDone}</div>
            <div style={{ fontSize: 11, color: "var(--muted)" }}>Remaining</div>
          </div>
        </div>
      </div>

      {sections.map(section => (
        <div key={section}>
          <div className="audit-section-title">{section}</div>
          {PHONE_AUDIT.filter(i => i.section === section).map(item => (
            <div key={item.id}
              className={`audit-item ${states[item.id] === "ok" ? "checked" : states[item.id] === "fail" ? "failed" : ""}`}
              onClick={() => toggle(item.id)}>
              <div className="audit-check">
                {states[item.id] === "ok" && "✓"}
                {states[item.id] === "fail" && "✗"}
              </div>
              <div className="audit-text">{item.text}</div>
            </div>
          ))}
        </div>
      ))}

      {failCount > 0 && (
        <div style={{ background: "var(--red-light)", border: "1px solid #FECACA", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 12 }}>
          <div style={{ fontWeight: 700, fontSize: 14, color: "var(--red)", marginBottom: 6 }}>
            ⚠️ {failCount} item{failCount > 1 ? "s" : ""} to fix
          </div>
          <div style={{ fontSize: 13, color: "var(--slate)", lineHeight: 1.5 }}>
            Add these to your to-do list. Each one is a door a scammer could walk through.
          </div>
        </div>
      )}

      <button
        className="btn-primary"
        disabled={totalDone < PHONE_AUDIT.length * 0.7}
        onClick={() => onComplete({
          checkedCount,
          failCount,
          totalDone,
          totalItems: PHONE_AUDIT.length,
          responses: PHONE_AUDIT.map((item) => ({
            itemId: item.id,
            section: item.section,
            prompt: item.text,
            status: states[item.id] ?? null,
          })),
        })}>
        {totalDone >= PHONE_AUDIT.length * 0.7
          ? "Continue to STOP → CHECK → REPORT →"
          : `Check at least ${Math.ceil(PHONE_AUDIT.length * 0.7) - totalDone} more items`}
      </button>
    </div>
  );
}

function StopCheckReport({ onComplete }) {
  const [stage, setStage] = useState(0);
  const [answers, setAnswers] = useState({});

  const drills = [
    {
      id: "d1",
      prompt: "You receive an SMS: 'Your Maybank account is suspended. Click here to restore: bit.ly/mbb-verify'",
      question: "Which STOP → CHECK → REPORT step do you apply FIRST?",
      options: [
        "Click the link carefully to see if it's real",
        "STOP — do not click anything. The link is suspicious.",
        "Call the number in the SMS to verify",
        "Forward it to a friend to check",
      ],
      correct: 1,
      explanation: "STOP is always first. The bit.ly shortlink and urgency are immediate red flags. Never click before stopping and thinking.",
    },
    {
      id: "d2",
      prompt: "Your boss WhatsApps from an unknown number: 'I'm in a meeting, can you transfer RM 2,000 to this supplier? I'll explain later.'",
      question: "What is the correct CHECK step here?",
      options: [
        "Transfer it — your boss needs it urgently",
        "Reply asking for more details via WhatsApp",
        "Call your boss on their known personal number to verify voice-to-voice",
        "Email the accounts department",
      ],
      correct: 2,
      explanation: "The CHECK step means verifying through an independent channel — call the number you already have for your boss. Never verify by replying to the suspicious message itself.",
    },
    {
      id: "d3",
      prompt: "You receive a suspicious phone call and hang up. You check and it's definitely a scam attempt.",
      question: "What is the best REPORT action?",
      options: [
        "Block the number and forget about it",
        "Post about it on Facebook",
        "Call NSRC (997) or NACSA Cyber999 (1300-882-999) and report the number",
        "Wait and see if they call again",
      ],
      correct: 2,
      explanation: "Reporting to NSRC (997) creates data that flags the number for other Malaysians and enables law enforcement action. Every report protects others.",
    },
  ];

  const drill = drills[stage];
  const answered = answers[drill?.id] !== undefined;
  const isCorrect = answers[drill?.id] === drill?.correct;
  const allDone = stage >= drills.length;
  const score = drills.filter((item) => answers[item.id] === item.correct).length;

  return (
    <div className="screen">
      <div className="screen-tag">Activity 5 of 6</div>
      <div className="screen-title">STOP → CHECK → REPORT</div>
      <div className="screen-desc">Practice applying the 3-step framework to real situations.</div>

      {!allDone ? (
        <>
          <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
            {["STOP", "CHECK", "REPORT"].map((step, i) => (
              <div key={step} style={{
                flex: 1, textAlign: "center", padding: "10px 4px",
                borderRadius: "var(--r-sm)",
                background: stage === i ? (i === 0 ? "#FEE2E2" : i === 1 ? "#FEF3C7" : "#D1FAE5") : "white",
                border: `2px solid ${stage === i ? (i === 0 ? "var(--red)" : i === 1 ? "var(--amber)" : "var(--green)") : "var(--line)"}`,
              }}>
                <div style={{
                  fontWeight: 800, fontSize: 13,
                  color: stage === i ? (i === 0 ? "var(--red)" : i === 1 ? "var(--amber)" : "var(--green)") : "var(--muted)"
                }}>{step}</div>
              </div>
            ))}
          </div>

          <div className="card">
            <div className="msg-bubble">{drill.prompt}</div>
            <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy-dark)", margin: "14px 0 10px" }}>
              {drill.question}
            </div>
            {drill.options.map((opt, i) => (
              <div key={i}
                className={`answer-option ${
                  !answered ? (answers[drill.id] === i ? "selected" : "")
                  : i === drill.correct ? "correct-reveal"
                  : answers[drill.id] === i ? "wrong-reveal"
                  : ""
                }`}
                onClick={() => !answered && setAnswers(p => ({ ...p, [drill.id]: i }))}>
                <div className="option-dot"
                  style={!answered && answers[drill.id] === i ? { background: "var(--navy)", borderColor: "var(--navy)" } : {}} />
                <span>{opt}</span>
              </div>
            ))}

            {!answered && (
              <button className="btn-primary"
                disabled={answers[drill.id] === undefined}
                onClick={() => setAnswers(p => ({ ...p, [drill.id]: p[drill.id] }))}>
                Check Answer
              </button>
            )}

            {answered && (
              <>
                <div className={`reveal ${isCorrect ? "reveal-correct" : "reveal-wrong"}`} style={{ marginTop: 14 }}>
                  <div className="reveal-verdict">
                    {isCorrect ? "✅ Correct!" : "❌ Not quite — "}
                  </div>
                  <div className="reveal-explanation">{drill.explanation}</div>
                </div>
                <button className="btn-primary" style={{ marginTop: 12 }}
                  onClick={() => {
                    if (stage < drills.length - 1) setStage(s => s + 1);
                    else setStage(drills.length);
                  }}>
                  {stage < drills.length - 1 ? "Next Drill →" : "See Summary →"}
                </button>
              </>
            )}
          </div>
        </>
      ) : (
        <div className="card">
          <div style={{ textAlign: "center", marginBottom: 16 }}>
            <div className="score-circle">
              <div className="score-num">
                {score}
              </div>
              <div className="score-denom">of {drills.length}</div>
            </div>
            <div style={{ fontWeight: 700, fontSize: 16, color: "var(--navy-dark)", marginBottom: 4 }}>
              Framework Drill Complete
            </div>
            <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
              Remember: STOP is always first. Every second you pause gives you time to think — and that's what scammers are trying to take away.
            </div>
          </div>
          <div style={{ background: "var(--navy-dark)", borderRadius: "var(--r-sm)", padding: "14px 16px", marginBottom: 16 }}>
            {[["NACSA Cyber999", "1300-882-999"], ["NSRC Hotline", "997"]].map(([name, num]) => (
              <div key={name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <div style={{ color: "#9BB4D4", fontSize: 13 }}>{name}</div>
                <div style={{ color: "white", fontWeight: 800, fontSize: 16 }}>{num}</div>
              </div>
            ))}
          </div>
          <button className="btn-primary" onClick={() => onComplete({
            score,
            total: drills.length,
            answers: drills.map((item) => ({
              drillId: item.id,
              prompt: item.prompt,
              selectedOptionIndex: answers[item.id] ?? null,
              selectedOption: answers[item.id] !== undefined ? item.options[answers[item.id]] : null,
              correctOptionIndex: item.correct,
              correctOption: item.options[item.correct],
              isCorrect: answers[item.id] === item.correct,
            })),
          })}>
            Final Step: Action Pledge →
          </button>
        </div>
      )}
    </div>
  );
}

function ActionPledge({ onComplete }) {
  const [pledged, setPledged] = useState(new Set());
  const toggle = (id) => {
    setPledged(p => {
      const n = new Set(p);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });
  };
  const count = pledged.size;
  const ready = count >= 5;

  return (
    <div className="screen">
      <div className="screen-tag">Activity 6 of 6</div>
      <div className="screen-title">Action Pledge</div>
      <div className="screen-desc">Knowledge without action changes nothing. Select at least 5 commitments you will complete this week.</div>

      <div className="pledge-min">
        {!ready ? `⚠️ Select at least 5 (${count} selected)` : `✅ ${count} commitments selected — ready to pledge!`}
      </div>

      {PLEDGE_ITEMS.map(item => (
        <div key={item.id}
          className={`pledge-item ${pledged.has(item.id) ? "pledged" : ""}`}
          onClick={() => toggle(item.id)}>
          <div className="pledge-num">{pledged.has(item.id) ? "✓" : item.id}</div>
          <div className="pledge-text">
            <div className="pledge-main">{item.text}</div>
            <div className="pledge-cat">{item.category}</div>
          </div>
        </div>
      ))}

      <button className="btn-primary" style={{ marginTop: 8, fontSize: 16, padding: 18 }}
        disabled={!ready}
        onClick={() => onComplete({
          selectedIds: [...pledged],
          selectedItems: PLEDGE_ITEMS.filter((item) => pledged.has(item.id)),
          count,
        })}>
        {ready ? "I Pledge — Complete Workshop ✓" : `Select ${5 - count} more to continue`}
      </button>
    </div>
  );
}

function Completion({ participantName, pledgeItems, submissionState, submissionError, onRetrySave }) {
  const selectedItems = pledgeItems?.selectedItems ?? [];
  const isSaving = submissionState === "saving";
  const isSaved = submissionState === "saved";
  const isConfigMissing = submissionState === "config-missing";
  const isError = submissionState === "error";

  return (
    <div className="screen">
      <div className="completion-header">
        <div style={{ fontSize: 48 }}>🎓</div>
        <div className="completion-title">Workshop Complete</div>
        <div className="completion-sub">
          You've finished all 6 activities. You are now meaningfully more prepared than you were an hour ago.
        </div>
      </div>

      <div className="card" style={{ border: "1px solid var(--line)" }}>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy-dark)", marginBottom: 8 }}>
          Response sync
        </div>
        {participantName && (
          <div style={{ fontSize: 13, color: "var(--muted)", marginBottom: 10 }}>
            Participant: <strong style={{ color: "var(--navy-dark)" }}>{participantName}</strong>
          </div>
        )}
        {isSaving && (
          <div style={{ fontSize: 13.5, color: "var(--muted)", lineHeight: 1.5 }}>
            Saving this participant's responses to Supabase…
          </div>
        )}
        {isSaved && (
          <div style={{ fontSize: 13.5, color: "var(--green)", lineHeight: 1.5, fontWeight: 700 }}>
            Responses saved successfully.
          </div>
        )}
        {isConfigMissing && (
          <div style={{ fontSize: 13.5, color: "var(--amber)", lineHeight: 1.5 }}>
            Supabase is not configured yet. Add `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` to your `.env` file, then redeploy.
          </div>
        )}
        {isError && (
          <>
            <div style={{ fontSize: 13.5, color: "var(--red)", lineHeight: 1.5, marginBottom: 10 }}>
              Could not save this response: {submissionError}
            </div>
            <button className="btn-secondary" onClick={onRetrySave}>
              Retry save
            </button>
          </>
        )}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--navy-dark)", marginBottom: 12 }}>
          Your commitments for this week:
        </div>
        {selectedItems.map((item, i) => (
          <div key={item.id} className="commitment-card">
            <div className="commitment-icon">
              {["🔐", "🔑", "📱", "👨‍👩‍👧", "🛑", "🔒", "📢"][i % 7]}
            </div>
            <div className="commitment-text">{item.text}</div>
          </div>
        ))}
      </div>

      <div className="card">
        <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy-dark)", marginBottom: 10 }}>
          Emergency contacts — save these now
        </div>
        {[
          ["NACSA Cyber999", "1300-882-999", "Cybercrime reporting"],
          ["NSRC Hotline", "997", "National Scam Response Centre"],
          ["SC Investor Alert", "sc.com.my/investor-alert", "Verify investment platforms"],
        ].map(([name, contact, desc]) => (
          <div key={name} style={{ padding: "10px 0", borderBottom: "1px solid var(--line)", display: "flex", gap: 12, alignItems: "flex-start" }}>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, fontSize: 14, color: "var(--navy-dark)" }}>{name}</div>
              <div style={{ fontSize: 13, color: "var(--muted)" }}>{desc}</div>
            </div>
            <div style={{ fontWeight: 800, fontSize: 16, color: "var(--red)" }}>{contact}</div>
          </div>
        ))}
      </div>

      <div style={{ textAlign: "center", padding: "12px 0 8px" }}>
        <div style={{ fontSize: 13, color: "var(--muted)", fontStyle: "italic", lineHeight: 1.6 }}>
          "Scammers don't hack systems.<br />They hack you."
        </div>
        <div style={{ fontWeight: 700, fontSize: 15, color: "var(--teal)", marginTop: 8 }}>
          STOP · CHECK · REPORT
        </div>
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────

const SCREENS = ["welcome", "scam-or-legit", "scenarios", "passphrase", "phone-audit", "scr", "pledge", "done"];
const SCREEN_LABELS = ["Welcome", "Scam/Legit", "Scenarios", "Passphrase", "Phone Audit", "SCR", "Pledge", "Done"];

export default function WorkshopApp() {
  const [screen, setScreen] = useState("welcome");
  const [workshopState, setWorkshopState] = useState(createInitialWorkshopState);
  const [submissionState, setSubmissionState] = useState("idle");
  const [submissionError, setSubmissionError] = useState("");
  const topRef = useRef(null);
  const idx = SCREENS.indexOf(screen);

  const go = (s) => {
    setScreen(s);
    topRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const updateWorkshopState = (updates) => {
    setWorkshopState((currentState) => ({
      ...currentState,
      ...updates,
    }));
  };

  const submitWorkshopResponse = async (nextState) => {
    if (!isSupabaseConfigured()) {
      setSubmissionState("config-missing");
      setSubmissionError("");
      return;
    }

    setSubmissionState("saving");
    setSubmissionError("");

    const { error } = await saveWorkshopResponse(buildWorkshopRow(nextState));

    if (error) {
      setSubmissionState("error");
      setSubmissionError(error.message);
      return;
    }

    setSubmissionState("saved");
  };

  const finalizeWorkshop = async (pledge) => {
    const nextState = {
      ...workshopState,
      pledge,
      completedAt: new Date().toISOString(),
    };

    setWorkshopState(nextState);
    go("done");
    await submitWorkshopResponse(nextState);
  };

  return (
    <>
      <style>{css}</style>
      <div ref={topRef} />
      <div className="app-header">
        <div className="app-header-inner">
          <div className="app-logo">🛡️</div>
          <div>
            <div className="app-title">Cybersecurity Workshop</div>
            <div className="app-sub">{screen !== "welcome" && screen !== "done" ? SCREEN_LABELS[idx] : ""}</div>
          </div>
        </div>
        {screen !== "welcome" && (
          <div className="progress-bar">
            {SCREENS.slice(1).map((s, i) => (
              <div key={s} className={`prog-step ${i < idx - 1 ? "done" : i === idx - 1 ? "active" : ""}`} />
            ))}
          </div>
        )}
      </div>

      {screen === "welcome" && (
        <Welcome
          participantName={workshopState.participantName}
          onParticipantNameChange={(participantName) => updateWorkshopState({ participantName })}
          onStart={() => go("scam-or-legit")}
        />
      )}
      {screen === "scam-or-legit" && <ScamOrLegit onComplete={(scamOrLegit) => {
        updateWorkshopState({ scamOrLegit });
        go("scenarios");
      }} />}
      {screen === "scenarios" && <Scenarios onComplete={(scenarios) => {
        updateWorkshopState({ scenarios });
        go("passphrase");
      }} />}
      {screen === "passphrase" && <PassphraseBuilder onComplete={(passphrase) => {
        updateWorkshopState({ passphrase });
        go("phone-audit");
      }} />}
      {screen === "phone-audit" && <PhoneAudit onComplete={(phoneAudit) => {
        updateWorkshopState({ phoneAudit });
        go("scr");
      }} />}
      {screen === "scr" && <StopCheckReport onComplete={(stopCheckReport) => {
        updateWorkshopState({ stopCheckReport });
        go("pledge");
      }} />}
      {screen === "pledge" && <ActionPledge onComplete={finalizeWorkshop} />}
      {screen === "done" && (
        <Completion
          participantName={workshopState.participantName}
          pledgeItems={workshopState.pledge}
          submissionState={submissionState}
          submissionError={submissionError}
          onRetrySave={() => submitWorkshopResponse(workshopState)}
        />
      )}
    </>
  );
}
