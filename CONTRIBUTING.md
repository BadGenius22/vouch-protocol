<h1 align="center">🤝 Contributing to Vouch Protocol</h1>

<p align="center">
  <strong>Thank you for your interest in contributing!</strong><br/>
  Every contribution helps make privacy on Solana more accessible
</p>

<p align="center">
  <a href="#-quick-start">Quick Start</a> •
  <a href="#-development-setup">Development</a> •
  <a href="#-contribution-types">Contribution Types</a> •
  <a href="#-pull-request-process">PR Process</a> •
  <a href="#-code-style">Code Style</a>
</p>

---

## 📋 Table of Contents

- [Quick Start](#-quick-start)
- [Code of Conduct](#-code-of-conduct)
- [Development Setup](#-development-setup)
- [Project Structure](#-project-structure)
- [Contribution Types](#-contribution-types)
- [Pull Request Process](#-pull-request-process)
- [Code Style Guidelines](#-code-style-guidelines)
- [Testing Requirements](#-testing-requirements)
- [Documentation](#-documentation)
- [Security](#-security)
- [Getting Help](#-getting-help)

---

## 🚀 Quick Start

```bash
# 1. Fork the repository on GitHub

# 2. Clone your fork
git clone https://github.com/YOUR_USERNAME/vouch-protocol.git
cd vouch-protocol

# 3. Add upstream remote
git remote add upstream https://github.com/BadGenius22/vouch-protocol.git

# 4. Install dependencies
pnpm install

# 5. Create a branch for your work
git checkout -b feature/your-feature-name

# 6. Make your changes and test
pnpm build
pnpm test

# 7. Commit and push
git add .
git commit -m "feat: add your feature"
git push origin feature/your-feature-name

# 8. Open a Pull Request on GitHub
```

---

## 📜 Code of Conduct

### Our Pledge

We are committed to providing a welcoming and inclusive environment for everyone. We pledge to:

- 🤝 **Be respectful** - Treat all contributors with dignity and respect
- 🌍 **Be inclusive** - Welcome contributors of all backgrounds and experience levels
- 💬 **Be constructive** - Provide helpful feedback and accept criticism gracefully
- 🎯 **Be focused** - Keep discussions on topic and productive

### Unacceptable Behavior

- Harassment, discrimination, or personal attacks
- Trolling or inflammatory comments
- Publishing others' private information
- Any conduct that could be considered inappropriate

### Reporting Issues

Report unacceptable behavior to: conduct@vouch-protocol.com

---

## 🛠️ Development Setup

### Prerequisites

| Requirement | Version | Check Command |
|-------------|---------|---------------|
| Node.js | ≥ 20.0.0 | `node --version` |
| pnpm | ≥ 8.0.0 | `pnpm --version` |
| Rust | Latest stable | `rustc --version` |
| Solana CLI | ≥ 1.18.0 | `solana --version` |
| Anchor | 0.32.1 | `anchor --version` |
| Nargo (Noir) | 1.0.0-beta.18 | `nargo --version` |

### Environment Setup

```bash
# 1. Install pnpm (if not already installed)
npm install -g pnpm

# 2. Install dependencies
pnpm install

# 3. Set up environment variables
cp apps/web/.env.example apps/web/.env.local

# 4. Edit .env.local with your values
# NEXT_PUBLIC_SOLANA_NETWORK=devnet
# NEXT_PUBLIC_SOLANA_RPC_URL=https://api.devnet.solana.com
# HELIUS_API_KEY=your-optional-helius-key
```

### Development Commands

```bash
# ┌─────────────────────────────────────────────────────────────┐
# │                    DEVELOPMENT WORKFLOW                      │
# ├─────────────────────────────────────────────────────────────┤
# │                                                              │
# │  Start Development:                                          │
# │  $ pnpm dev           # Start Next.js dev server             │
# │                                                              │
# │  Build & Verify:                                             │
# │  $ pnpm build         # Build all packages                   │
# │  $ pnpm typecheck     # TypeScript type checking             │
# │  $ pnpm lint          # ESLint check                         │
# │                                                              │
# │  Testing:                                                    │
# │  $ pnpm test          # Run all tests                        │
# │  $ pnpm test:watch    # Watch mode                           │
# │                                                              │
# │  Circuits (Noir):                                            │
# │  $ pnpm circuits:compile   # Compile ZK circuits             │
# │  $ pnpm circuits:test      # Test circuits                   │
# │                                                              │
# │  Anchor (Solana):                                            │
# │  $ pnpm anchor:build      # Build Solana program             │
# │  $ pnpm anchor:test       # Run integration tests            │
# │                                                              │
# └─────────────────────────────────────────────────────────────┘
```

---

## 📁 Project Structure

```
vouch-protocol/
├── 📱 apps/
│   └── web/                    # Next.js frontend application
│       ├── src/
│       │   ├── app/            # App Router pages & layouts
│       │   ├── components/     # React components
│       │   └── lib/            # Core library (proof generation, etc.)
│       └── public/
│           └── circuits/       # Compiled circuit artifacts
│
├── 📦 packages/
│   └── sdk/                    # Public SDK package
│       └── src/                # SDK entry point (re-exports from web)
│
├── 🔐 circuits/
│   ├── dev_reputation/         # Developer reputation circuit
│   └── whale_trading/          # Whale trading circuit
│
├── ⚓ programs/
│   └── vouch-verifier/         # Anchor program
│       ├── src/                # Rust source code
│       └── tests/              # Integration tests
│
├── 📚 docs/                    # Documentation
│
└── 🔧 Configuration files
```

### Key Files

| File | Purpose |
|------|---------|
| `apps/web/src/lib/proof.ts` | ZK proof generation (browser) |
| `apps/web/src/lib/verify.ts` | On-chain verification |
| `apps/web/src/lib/types.ts` | TypeScript types & errors |
| `circuits/*/src/main.nr` | Noir circuit definitions |
| `programs/vouch-verifier/src/lib.rs` | Anchor program logic |

---

## 🎯 Contribution Types

### 🐛 Bug Reports

**Before reporting:**
1. Search existing issues to avoid duplicates
2. Verify the bug on the latest `main` branch
3. Prepare minimal reproduction steps

**Template:**
```markdown
## Bug Description
A clear description of the bug.

## Steps to Reproduce
1. Go to '...'
2. Click on '...'
3. See error

## Expected Behavior
What should happen.

## Actual Behavior
What actually happens.

## Environment
- OS: [e.g., macOS 14.0]
- Browser: [e.g., Chrome 120]
- Node.js: [e.g., 20.10.0]

## Screenshots/Logs
If applicable.
```

---

### ✨ Feature Requests

**Before requesting:**
1. Check the roadmap and existing issues
2. Consider if it aligns with project goals
3. Think about implementation complexity

**Template:**
```markdown
## Feature Description
A clear description of the feature.

## Use Case
Why this feature would be useful.

## Proposed Solution
How you think it should work.

## Alternatives Considered
Other approaches you've thought about.

## Additional Context
Any other relevant information.
```

---

### 💻 Code Contributions

#### Types of Contributions Welcome

| Type | Description | Label |
|------|-------------|-------|
| 🐛 Bug fixes | Fix reported issues | `bug` |
| ✨ Features | Add new functionality | `enhancement` |
| 📚 Documentation | Improve docs | `documentation` |
| 🧪 Tests | Add/improve tests | `testing` |
| 🔧 Tooling | Build/CI improvements | `tooling` |
| ♻️ Refactoring | Code cleanup | `refactor` |

#### Good First Issues

Look for issues labeled:
- `good first issue` - Beginner-friendly
- `help wanted` - Community contribution welcome
- `documentation` - Often easier to start with

---

## 📝 Pull Request Process

### 1️⃣ Before You Start

```
┌─────────────────────────────────────────────────────────────────────┐
│                         PR PREPARATION CHECKLIST                     │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  □ Issue exists for the change (create one if needed)               │
│  □ You've discussed approach for large changes                       │
│  □ Branch is up-to-date with main                                   │
│  □ You understand the related code areas                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

### 2️⃣ Development Workflow

```bash
# Ensure you're on main and up-to-date
git checkout main
git pull upstream main

# Create a feature branch
git checkout -b feature/your-feature-name

# Make changes...

# Run all checks locally
pnpm build
pnpm typecheck
pnpm lint
pnpm test

# Commit with conventional commit format
git add .
git commit -m "feat(scope): description"
```

### 3️⃣ Commit Message Format

We use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <description>

[optional body]

[optional footer]
```

**Types:**

| Type | Description | Example |
|------|-------------|---------|
| `feat` | New feature | `feat(sdk): add cost estimation API` |
| `fix` | Bug fix | `fix(proof): handle null circuit input` |
| `docs` | Documentation | `docs: update integration guide` |
| `style` | Formatting | `style: fix indentation` |
| `refactor` | Code restructure | `refactor(lib): extract helper functions` |
| `test` | Tests | `test: add proof generation tests` |
| `chore` | Maintenance | `chore: update dependencies` |
| `perf` | Performance | `perf(circuit): optimize constraint count` |

**Scopes:**

| Scope | Area |
|-------|------|
| `sdk` | SDK package |
| `web` | Web application |
| `proof` | Proof generation |
| `circuit` | Noir circuits |
| `anchor` | Solana program |
| `docs` | Documentation |

### 4️⃣ Pull Request Template

```markdown
## Description
Brief description of changes.

## Related Issue
Fixes #123

## Type of Change
- [ ] Bug fix (non-breaking change that fixes an issue)
- [ ] New feature (non-breaking change that adds functionality)
- [ ] Breaking change (fix or feature that changes existing functionality)
- [ ] Documentation update

## Checklist
- [ ] My code follows the project's style guidelines
- [ ] I have performed a self-review of my code
- [ ] I have commented complex code sections
- [ ] I have updated the documentation
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] All tests pass locally
- [ ] Any dependent changes have been merged

## Screenshots (if applicable)
Add screenshots for UI changes.
```

### 5️⃣ Review Process

```
┌──────────────────────────────────────────────────────────────────────┐
│                        PR REVIEW WORKFLOW                             │
├──────────────────────────────────────────────────────────────────────┤
│                                                                       │
│  1. Submit PR                                                         │
│     └──▶ Automated checks run (CI)                                   │
│                                                                       │
│  2. Review Assignment                                                 │
│     └──▶ Maintainer reviews code                                     │
│                                                                       │
│  3. Feedback Loop                                                     │
│     ├──▶ Address requested changes                                   │
│     └──▶ Re-request review when ready                                │
│                                                                       │
│  4. Approval                                                          │
│     └──▶ At least 1 maintainer approval required                     │
│                                                                       │
│  5. Merge                                                             │
│     └──▶ Squash and merge to main                                    │
│                                                                       │
└──────────────────────────────────────────────────────────────────────┘
```

---

## 💅 Code Style Guidelines

### TypeScript

```typescript
// ✅ Good: Use explicit types for function parameters and returns
function generateProof(input: ProofInput): Promise<ProofResult> {
  // ...
}

// ❌ Bad: Implicit any
function generateProof(input) {
  // ...
}

// ✅ Good: Use readonly for immutable data
interface Config {
  readonly apiUrl: string;
  readonly timeout: number;
}

// ✅ Good: Prefer interfaces for object shapes
interface UserData {
  id: string;
  name: string;
}

// ✅ Good: Use type for unions/intersections
type ProofType = 'developer' | 'whale';

// ✅ Good: Async/await over promise chains
async function fetchData() {
  const response = await fetch(url);
  return response.json();
}

// ❌ Bad: Nested promises
function fetchData() {
  return fetch(url).then(res => res.json());
}
```

### React Components

```tsx
// ✅ Good: Function components with explicit props
interface ButtonProps {
  label: string;
  onClick: () => void;
  disabled?: boolean;
}

export function Button({ label, onClick, disabled = false }: ButtonProps) {
  return (
    <button onClick={onClick} disabled={disabled}>
      {label}
    </button>
  );
}

// ✅ Good: Use hooks appropriately
function useProofGeneration() {
  const [status, setStatus] = useState<'idle' | 'loading' | 'success'>('idle');

  const generate = useCallback(async (input: ProofInput) => {
    setStatus('loading');
    try {
      const result = await generateProof(input);
      setStatus('success');
      return result;
    } catch (error) {
      setStatus('idle');
      throw error;
    }
  }, []);

  return { status, generate };
}
```

### Noir Circuits

```noir
// ✅ Good: Clear constraint documentation
fn verify_tvl_threshold(
    tvl_amounts: [u64; MAX_PROGRAMS],
    min_tvl: pub u64
) {
    // Sum all TVL values across programs
    let mut total_tvl: u64 = 0;
    for i in 0..MAX_PROGRAMS {
        total_tvl += tvl_amounts[i];
    }

    // Constraint: Total TVL must meet minimum threshold
    assert(total_tvl >= min_tvl);
}

// ✅ Good: Use constants for magic numbers
global MAX_PROGRAMS: u32 = 5;
global DOMAIN_SEPARATOR_SIZE: u32 = 32;
```

### Rust (Anchor)

```rust
// ✅ Good: Comprehensive error handling
#[error_code]
pub enum VouchError {
    #[msg("Nullifier has already been used")]
    NullifierAlreadyUsed,

    #[msg("Proof verification failed")]
    ProofVerificationFailed,

    #[msg("Invalid proof format")]
    InvalidProofFormat,
}

// ✅ Good: Clear account validation
#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + 32 + 1,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_account: Account<'info, NullifierAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}
```

---

## 🧪 Testing Requirements

### Test Coverage Expectations

| Component | Minimum Coverage | Focus Areas |
|-----------|-----------------|-------------|
| SDK | 80% | Public API functions |
| Circuits | 100% | All constraints |
| Anchor | 90% | Instructions & validation |
| React | 70% | User interactions |

### Writing Tests

```typescript
// ✅ Good: Descriptive test names
describe('generateDevReputationProof', () => {
  it('should generate valid proof for wallet with sufficient TVL', async () => {
    const input = createValidInput({ tvl: 100000 });
    const result = await generateDevReputationProof(input);

    expect(result.proof).toBeDefined();
    expect(result.nullifier).toHaveLength(64);
  });

  it('should throw THRESHOLD_NOT_MET error when TVL is below minimum', async () => {
    const input = createValidInput({ tvl: 100 });

    await expect(generateDevReputationProof(input))
      .rejects
      .toThrow(VouchErrorCode.THRESHOLD_NOT_MET);
  });
});

// ✅ Good: Test edge cases
describe('nullifier handling', () => {
  it('should generate deterministic nullifier for same wallet', async () => {
    const wallet = 'ABC123...';
    const nullifier1 = computeNullifier(wallet, 'developer');
    const nullifier2 = computeNullifier(wallet, 'developer');

    expect(nullifier1).toEqual(nullifier2);
  });

  it('should generate different nullifiers for different domains', async () => {
    const wallet = 'ABC123...';
    const devNullifier = computeNullifier(wallet, 'developer');
    const whaleNullifier = computeNullifier(wallet, 'whale');

    expect(devNullifier).not.toEqual(whaleNullifier);
  });
});
```

### Running Tests

```bash
# Run all tests
pnpm test

# Run specific test file
pnpm test src/lib/proof.test.ts

# Run tests in watch mode
pnpm test:watch

# Run tests with coverage
pnpm test:coverage

# Run circuit tests
cd circuits && nargo test

# Run Anchor tests
pnpm anchor:test
```

---

## 📚 Documentation

### When to Update Documentation

| Change Type | Documentation Required |
|------------|------------------------|
| New feature | README, API docs, examples |
| API change | API docs, migration guide |
| Bug fix | Only if workaround was documented |
| Config change | Installation/setup docs |

### Documentation Standards

```markdown
## Function Name

Brief description of what this function does.

### Parameters

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `input` | `ProofInput` | Yes | The proof input data |
| `options` | `Options` | No | Optional configuration |

### Returns

`Promise<ProofResult>` - The generated proof

### Example

\`\`\`typescript
const result = await functionName(input, { option: true });
console.log(result);
\`\`\`

### Errors

| Error Code | Cause | Solution |
|------------|-------|----------|
| `INVALID_INPUT` | Missing required field | Check input structure |
```

---

## 🔒 Security

### Reporting Vulnerabilities

**DO NOT** report security vulnerabilities through public GitHub issues.

Instead, please email: **security@vouch-protocol.com**

Include:
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Any suggested fixes

See [SECURITY.md](./SECURITY.md) for our full security policy.

### Security Best Practices

```
┌─────────────────────────────────────────────────────────────────────┐
│                    SECURITY GUIDELINES FOR CONTRIBUTORS              │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ✅ DO:                                                              │
│  • Validate all user inputs                                          │
│  • Use parameterized queries                                         │
│  • Follow the principle of least privilege                           │
│  • Keep dependencies updated                                         │
│  • Use secure random number generation                               │
│                                                                      │
│  ❌ DON'T:                                                           │
│  • Commit secrets, API keys, or credentials                          │
│  • Log sensitive user data                                           │
│  • Disable security features for convenience                         │
│  • Trust client-side validation alone                                │
│  • Use deprecated cryptographic functions                            │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## ❓ Getting Help

### Resources

| Resource | Use For |
|----------|---------|
| 📖 [Documentation](./docs/) | General usage and integration |
| 💬 GitHub Discussions | Questions and ideas |
| 🐛 GitHub Issues | Bug reports and features |
| 🔒 Security Email | Security vulnerabilities |

### Response Times

| Type | Expected Response |
|------|-------------------|
| Security issues | Within 24 hours |
| Bug reports | Within 48 hours |
| Feature requests | Within 1 week |
| Pull requests | Within 1 week |

### Asking Good Questions

1. **Search first** - Check if your question was already answered
2. **Be specific** - Include error messages, versions, steps
3. **Minimal example** - Provide smallest code that reproduces the issue
4. **Context** - What are you trying to achieve?

---

## 🏆 Recognition

Contributors are recognized in:

- **README.md** - Contributors section
- **Release notes** - Contribution mentions
- **Annual report** - Top contributors highlighted

---

## 👨‍💻 Maintainer

**Dewangga Praxindo** ([@BadGenius22](https://github.com/BadGenius22))

---

<p align="center">
  <strong>🙏 Thank you for contributing to Vouch Protocol!</strong><br/>
  Together we're making privacy accessible on Solana
</p>

<p align="center">
  <sub>Questions? Open a <a href="https://github.com/BadGenius22/vouch-protocol/discussions">GitHub Discussion</a> or contact <a href="https://github.com/BadGenius22">@BadGenius22</a></sub>
</p>
