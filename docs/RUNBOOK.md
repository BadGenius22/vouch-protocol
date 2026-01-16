# Vouch Protocol - Incident Response Runbook

## Quick Reference

| Service | Health Check | Logs |
|---------|--------------|------|
| Web App + Verifier | `https://vouch.dev/api/health` | Vercel Dashboard |
| Verifier Info | `https://vouch.dev/api/verifier` | Vercel Dashboard |
| Solana Program | Solscan/Solana Explorer | N/A |

> **Note:** Verifier runs as a Next.js API route (`/api/verify`) - single Vercel deployment.

---

## 1. Service Health Checks

### Web App (Next.js on Vercel)

```bash
# Check health
curl https://vouch.dev/api/health

# Expected response
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "version": "0.1.0",
  "environment": "mainnet-beta",
  "checks": {
    "app": "ok",
    "memory": "ok (128/512MB - 25%)"
  }
}
```

### Verifier (API Route)

```bash
# Check verifier info
curl https://vouch.dev/api/verifier

# Expected response
{
  "publicKey": "VouchVerifier...",
  "circuitsLoaded": {
    "developer": false,
    "whale": false
  },
  "message": "Register this public key..."
}
```

> **Note:** `circuitsLoaded` shows `false` until first verification request (lazy loading).

### Solana Program

```bash
# Check program exists and is executable
solana program show VouchXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX

# View recent transactions
# Go to: https://solscan.io/account/VouchXXX...
```

---

## 2. Common Issues & Solutions

### Issue: Proof Generation Fails

**Symptoms:**
- Users see "Proof generation failed" error
- Console shows WASM or circuit loading errors

**Diagnosis:**
```bash
# Check circuit files are served correctly
curl -I https://vouch.dev/circuits/dev_reputation.json
# Should return 200 OK with correct headers
```

**Solutions:**
1. **COOP/COEP headers missing:** Check vercel.json has correct headers for `/circuits/*`
2. **Circuit file corrupted:** Re-upload circuit artifacts
3. **Memory pressure:** Ask user to close other tabs, refresh page

---

### Issue: Verifier API Failing

**Symptoms:**
- Proof verification hangs or returns 500
- `/api/verify` returns errors

**Diagnosis:**
```bash
# Check verifier status
curl https://vouch.dev/api/verifier

# Check general health
curl https://vouch.dev/api/health

# Check Vercel function logs in dashboard
```

**Solutions:**
1. **Timeout:** Proof verification can take time - Vercel Pro allows 60s
2. **Circuit not found:** Check `/circuits/*.json` files are in public directory
3. **Keypair issue:** Verify `VERIFIER_PRIVATE_KEY` is set in Vercel env vars
4. **Cold start:** First request loads circuits - may be slower

**Redeploy:**
```bash
# Trigger new deployment
git push origin main

# Or use Vercel CLI
vercel --prod
```

---

### Issue: Transaction Fails

**Symptoms:**
- "Transaction failed" error after proof verification
- Solana transaction simulation fails

**Diagnosis:**
```bash
# Check recent program logs
solana logs VouchXXX... --url mainnet-beta

# Check account state
solana account <NULLIFIER_PDA> --url mainnet-beta
```

**Common Causes & Solutions:**

| Error | Cause | Solution |
|-------|-------|----------|
| `NullifierAlreadyUsed` | Duplicate proof attempt | Expected behavior - user already proved |
| `InsufficientFunds` | Wallet has no SOL | User needs to fund wallet |
| `InvalidProof` | Proof verification failed | Check verifier service logs |
| `ProgramPaused` | Admin paused program | Check if intentional, unpause if needed |

---

### Issue: RPC Rate Limits

**Symptoms:**
- 429 errors from Solana RPC
- Slow or failing transactions

**Diagnosis:**
```bash
# Check Helius dashboard for rate limit status
# https://dashboard.helius.dev
```

**Solutions:**
1. **Upgrade Helius plan** if hitting limits
2. **Add RPC fallback** in environment config
3. **Implement client-side retry with backoff**

---

### Issue: High Error Rate

**Symptoms:**
- Spike in user-reported errors
- Health check shows degraded status

**Diagnosis:**
1. Check Vercel function logs
2. Check verifier service logs
3. Check browser console errors (common issues)

**Immediate Actions:**
1. **If verifier-specific:** Restart verifier service
2. **If Solana-wide:** Check Solana status (status.solana.com)
3. **If code regression:** Rollback to previous deployment

**Rollback Web App (Vercel):**
```bash
# List deployments
vercel ls

# Promote previous deployment
vercel promote <DEPLOYMENT_URL>
```

---

## 3. Escalation Procedures

### Severity Levels

| Level | Description | Response Time | Examples |
|-------|-------------|---------------|----------|
| **P1** | Complete outage | Immediate | Service down, all proofs failing |
| **P2** | Degraded service | 1 hour | High error rate, slow performance |
| **P3** | Minor issue | 4 hours | UI bug, non-critical feature broken |
| **P4** | Enhancement | 24 hours | Feature request, improvement |

### Contacts

| Role | Contact | When to Escalate |
|------|---------|------------------|
| On-call Engineer | [Your contact] | P1, P2 |
| Team Lead | [Your contact] | P1 unresolved > 30min |
| Solana Expert | [Your contact] | On-chain issues |

---

## 4. Maintenance Procedures

### Deploying Updates

```bash
# 1. Create PR to develop branch
git checkout -b feature/my-update
git push origin feature/my-update

# 2. PR triggers staging deployment
# 3. Test on staging.vouch.dev

# 4. Merge to main for production
git checkout main
git merge develop
git push origin main

# 5. Verify production deployment
curl https://vouch.dev/api/health
```

### Pausing the Protocol (Emergency)

If critical vulnerability discovered:

```bash
# 1. Pause Solana program (if admin controls implemented)
# Use your admin wallet
anchor run pause

# 2. Update web app to show maintenance message
# Update apps/web/.env.production:
NEXT_PUBLIC_MAINTENANCE_MODE=true

# 3. Redeploy
git add . && git commit -m "Enable maintenance mode"
git push origin main
```

### Updating Circuit Artifacts

```bash
# 1. Compile circuits
cd circuits
nargo compile

# 2. Copy to web app
cp target/*.json ../apps/web/public/circuits/

# 3. Test locally
cd ../apps/web
pnpm dev

# 4. Deploy
git add public/circuits/
git commit -m "Update circuit artifacts"
git push origin main
```

---

## 5. Monitoring Dashboards

### Key Metrics to Watch

| Metric | Warning Threshold | Critical Threshold |
|--------|------------------|-------------------|
| Error rate | > 1% | > 5% |
| P95 response time | > 5s | > 15s |
| Proof generation time | > 30s | > 60s |
| Verification success rate | < 99% | < 95% |
| Memory usage | > 75% | > 90% |

### Log Queries

**Find failed verifications:**
```
status:error "verification failed"
```

**Find slow proofs:**
```
proof.generation.duration > 30000
```

**Find transaction errors:**
```
"Transaction failed" OR "simulation failed"
```

---

## 6. Post-Incident Checklist

After any P1 or P2 incident:

- [ ] Incident documented with timeline
- [ ] Root cause identified
- [ ] Fix deployed and verified
- [ ] Monitoring updated if needed
- [ ] Team notified of resolution
- [ ] Post-mortem scheduled (for P1)

### Post-Mortem Template

```markdown
## Incident: [Title]
**Date:** [Date]
**Duration:** [Time]
**Severity:** P[1/2]

### Summary
[Brief description of what happened]

### Timeline
- HH:MM - Issue detected
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Service restored

### Root Cause
[What caused the incident]

### Resolution
[How it was fixed]

### Action Items
- [ ] [Preventive measure 1]
- [ ] [Preventive measure 2]
```

---

## 7. Useful Commands

```bash
# === Vercel ===
vercel ls                        # List deployments
vercel logs                      # View function logs
vercel promote <url>             # Rollback to deployment

# === Solana ===
solana logs <program_id>         # View program logs
solana program show <program_id> # Check program status
solana balance <wallet>          # Check SOL balance

# === Anchor ===
anchor test                      # Run tests
anchor deploy                    # Deploy program
anchor upgrade                   # Upgrade program

# === Health Checks ===
curl https://vouch.dev/api/health
curl https://verifier.vouch.dev/health
```
