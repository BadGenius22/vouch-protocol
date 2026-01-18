# Test Keypairs

These keypairs are **intentionally committed** for devnet testing. They allow anyone to run tests without generating new keypairs.

## Files

| File | Purpose | Public Key |
|------|---------|------------|
| `vouch_verifier-keypair.json` | Program ID (same for everyone) | `EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD` |
| `verifier-keypair.json` | Verifier service keypair | `26PHXVn171FimBEzPxguk2HtjkNMeBqRuochUtMKzwHf` |
| `test-wallet.json` | Test wallet for deployments | `3jryndGq8VRX8noTNGjAXbCSHWNs7rZ7Va6BQdfUBeGR` |

## Security

- **DEVNET ONLY** - Never use these for mainnet
- **NO REAL FUNDS** - Only airdropped devnet SOL
- **SAFE TO COMMIT** - These are test keys, not production secrets

## For Production

Production keypairs should:
- Be stored in a secrets manager (AWS Secrets Manager, HashiCorp Vault, etc.)
- Be passed via environment variables
- NEVER be committed to git
