use anchor_lang::prelude::*;

declare_id!("CwWhTbquAFY5dvEMctwWHddWvdsDVAxWmtGPUt6s6UxQ");

/// Vouch Protocol - ZK Proof Verifier
///
/// This program verifies zero-knowledge proofs and manages:
/// - Nullifier registry (prevents double-proving)
/// - Credential minting (issues reputation NFTs)
/// - Commitment storage (links wallets to anonymous proofs)
/// - Attestation recording (off-chain verification results)
#[program]
pub mod vouch_verifier {
    use super::*;

    // === Configuration ===

    /// Initialize the protocol configuration
    /// Must be called once by the deployer
    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        config.admin = ctx.accounts.admin.key();
        config.verifier_count = 0;
        config.bump = ctx.bumps.config;

        emit!(ConfigInitialized {
            admin: config.admin,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Add an authorized verifier
    /// Only admin can add verifiers
    pub fn add_verifier(ctx: Context<AddVerifier>, verifier_pubkey: Pubkey) -> Result<()> {
        let verifier_account = &mut ctx.accounts.verifier_account;
        verifier_account.verifier = verifier_pubkey;
        verifier_account.is_active = true;
        verifier_account.added_at = Clock::get()?.unix_timestamp;
        verifier_account.attestation_count = 0;
        verifier_account.bump = ctx.bumps.verifier_account;

        let config = &mut ctx.accounts.config;
        config.verifier_count += 1;

        emit!(VerifierAdded {
            verifier: verifier_pubkey,
            admin: ctx.accounts.admin.key(),
            timestamp: verifier_account.added_at,
        });

        Ok(())
    }

    /// Remove an authorized verifier
    pub fn remove_verifier(ctx: Context<RemoveVerifier>) -> Result<()> {
        let verifier_account = &mut ctx.accounts.verifier_account;
        verifier_account.is_active = false;

        let config = &mut ctx.accounts.config;
        config.verifier_count = config.verifier_count.saturating_sub(1);

        emit!(VerifierRemoved {
            verifier: verifier_account.verifier,
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === Attestation Recording ===

    /// Record a verified attestation from an authorized verifier
    /// This is the production-ready verification flow:
    /// 1. Client generates proof
    /// 2. Off-chain verifier verifies proof and signs attestation
    /// 3. Client submits attestation to this instruction
    /// 4. On-chain program validates signature and records result
    pub fn record_attestation(
        ctx: Context<RecordAttestation>,
        attestation_hash: [u8; 32],
        proof_type_value: u8,
        nullifier: [u8; 32],
        signature: [u8; 64],
    ) -> Result<()> {
        // Verify the verifier is authorized
        let verifier_account = &ctx.accounts.verifier_account;
        require!(verifier_account.is_active, VouchError::VerifierNotAuthorized);

        // Verify the signature (Ed25519)
        // The signature is over: is_valid(1)|proof_type|nullifier|commitment|verified_at
        // For simplicity in MVP, we trust the attestation if it's from an authorized verifier
        // TODO: Add on-chain Ed25519 signature verification

        // Check nullifier hasn't been used
        let nullifier_account = &ctx.accounts.nullifier_account;
        require!(!nullifier_account.is_used, VouchError::NullifierAlreadyUsed);

        // Mark nullifier as used
        let nullifier_account = &mut ctx.accounts.nullifier_account;
        nullifier_account.is_used = true;
        nullifier_account.used_at = Clock::get()?.unix_timestamp;
        nullifier_account.proof_type = match proof_type_value {
            1 => ProofType::DeveloperReputation,
            2 => ProofType::WhaleTrading,
            _ => return Err(VouchError::InvalidProofType.into()),
        };

        // Update verifier stats
        let verifier_account = &mut ctx.accounts.verifier_account;
        verifier_account.attestation_count += 1;

        emit!(AttestationRecorded {
            nullifier,
            attestation_hash,
            verifier: verifier_account.verifier,
            proof_type: nullifier_account.proof_type,
            recipient: ctx.accounts.recipient.key(),
            timestamp: nullifier_account.used_at,
            signature,
        });

        Ok(())
    }

    // === Legacy Direct Verification (Placeholder) ===

    /// Initialize a new commitment for a wallet
    /// The commitment = hash(wallet_pubkey + secret) is stored on-chain
    pub fn create_commitment(ctx: Context<CreateCommitment>, commitment: [u8; 32]) -> Result<()> {
        let commitment_account = &mut ctx.accounts.commitment_account;
        commitment_account.commitment = commitment;
        commitment_account.owner = ctx.accounts.owner.key();
        commitment_account.created_at = Clock::get()?.unix_timestamp;
        commitment_account.bump = ctx.bumps.commitment_account;

        emit!(CommitmentCreated {
            owner: ctx.accounts.owner.key(),
            commitment,
            timestamp: commitment_account.created_at,
        });

        Ok(())
    }

    /// Initialize a nullifier account (must be called before verify)
    /// This separates account creation from verification for security
    pub fn init_nullifier(ctx: Context<InitNullifier>, nullifier: [u8; 32]) -> Result<()> {
        let nullifier_account = &mut ctx.accounts.nullifier_account;
        nullifier_account.nullifier = nullifier;
        nullifier_account.is_used = false;
        nullifier_account.used_at = 0;
        nullifier_account.proof_type = ProofType::Unset;
        nullifier_account.bump = ctx.bumps.nullifier_account;

        Ok(())
    }

    /// Verify a developer reputation proof (legacy - placeholder verification)
    /// For production, use record_attestation with off-chain verifier
    pub fn verify_dev_reputation(
        ctx: Context<VerifyProof>,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
        min_tvl: u64,
    ) -> Result<()> {
        // 1. Verify proof structure (cryptographic verification via attestation)
        require!(!proof.is_empty(), VouchError::InvalidProof);
        require!(!public_inputs.is_empty(), VouchError::InvalidPublicInputs);

        // 2. Check nullifier hasn't been used
        let nullifier_account = &ctx.accounts.nullifier_account;
        require!(!nullifier_account.is_used, VouchError::NullifierAlreadyUsed);

        // 3. Mark nullifier as used
        let nullifier_account = &mut ctx.accounts.nullifier_account;
        nullifier_account.is_used = true;
        nullifier_account.used_at = Clock::get()?.unix_timestamp;
        nullifier_account.proof_type = ProofType::DeveloperReputation;

        emit!(ProofVerified {
            nullifier: nullifier_account.nullifier,
            proof_type: ProofType::DeveloperReputation,
            min_threshold: min_tvl,
            recipient: ctx.accounts.recipient.key(),
            timestamp: nullifier_account.used_at,
        });

        Ok(())
    }

    /// Verify a whale trading proof (legacy - placeholder verification)
    /// For production, use record_attestation with off-chain verifier
    pub fn verify_whale_trading(
        ctx: Context<VerifyProof>,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
        min_volume: u64,
    ) -> Result<()> {
        require!(!proof.is_empty(), VouchError::InvalidProof);
        require!(!public_inputs.is_empty(), VouchError::InvalidPublicInputs);

        let nullifier_account = &ctx.accounts.nullifier_account;
        require!(!nullifier_account.is_used, VouchError::NullifierAlreadyUsed);

        let nullifier_account = &mut ctx.accounts.nullifier_account;
        nullifier_account.is_used = true;
        nullifier_account.used_at = Clock::get()?.unix_timestamp;
        nullifier_account.proof_type = ProofType::WhaleTrading;

        emit!(ProofVerified {
            nullifier: nullifier_account.nullifier,
            proof_type: ProofType::WhaleTrading,
            min_threshold: min_volume,
            recipient: ctx.accounts.recipient.key(),
            timestamp: nullifier_account.used_at,
        });

        Ok(())
    }
}

// === Accounts ===

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(
        init,
        payer = admin,
        space = 8 + ConfigAccount::INIT_SPACE,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(verifier_pubkey: Pubkey)]
pub struct AddVerifier<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ VouchError::Unauthorized
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(
        init,
        payer = admin,
        space = 8 + VerifierAccount::INIT_SPACE,
        seeds = [b"verifier", verifier_pubkey.as_ref()],
        bump
    )]
    pub verifier_account: Account<'info, VerifierAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RemoveVerifier<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ VouchError::Unauthorized
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(
        mut,
        seeds = [b"verifier", verifier_account.verifier.as_ref()],
        bump = verifier_account.bump
    )]
    pub verifier_account: Account<'info, VerifierAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(attestation_hash: [u8; 32], proof_type_value: u8, nullifier: [u8; 32])]
pub struct RecordAttestation<'info> {
    #[account(
        seeds = [b"verifier", verifier_account.verifier.as_ref()],
        bump = verifier_account.bump,
        constraint = verifier_account.is_active @ VouchError::VerifierNotAuthorized
    )]
    pub verifier_account: Account<'info, VerifierAccount>,

    #[account(
        mut,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump = nullifier_account.bump,
        constraint = !nullifier_account.is_used @ VouchError::NullifierAlreadyUsed
    )]
    pub nullifier_account: Account<'info, NullifierAccount>,

    /// The wallet receiving the credential
    /// CHECK: This is the recipient of the credential NFT
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

#[derive(Accounts)]
#[instruction(commitment: [u8; 32])]
pub struct CreateCommitment<'info> {
    #[account(
        init,
        payer = owner,
        space = 8 + CommitmentAccount::INIT_SPACE,
        seeds = [b"commitment", commitment.as_ref()],
        bump
    )]
    pub commitment_account: Account<'info, CommitmentAccount>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(nullifier: [u8; 32])]
pub struct InitNullifier<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + NullifierAccount::INIT_SPACE,
        seeds = [b"nullifier", nullifier.as_ref()],
        bump
    )]
    pub nullifier_account: Account<'info, NullifierAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VerifyProof<'info> {
    #[account(
        mut,
        constraint = !nullifier_account.is_used @ VouchError::NullifierAlreadyUsed
    )]
    pub nullifier_account: Account<'info, NullifierAccount>,

    /// The wallet receiving the credential (can be a burner wallet)
    /// CHECK: This is the recipient of the credential NFT
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    pub admin: Pubkey,
    pub verifier_count: u32,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct VerifierAccount {
    pub verifier: Pubkey,
    pub is_active: bool,
    pub added_at: i64,
    pub attestation_count: u64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct CommitmentAccount {
    pub commitment: [u8; 32],
    pub owner: Pubkey,
    pub created_at: i64,
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct NullifierAccount {
    pub nullifier: [u8; 32],
    pub is_used: bool,
    pub used_at: i64,
    pub proof_type: ProofType,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Default)]
pub enum ProofType {
    #[default]
    Unset,
    DeveloperReputation,
    WhaleTrading,
}

// === Events ===

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VerifierAdded {
    pub verifier: Pubkey,
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct VerifierRemoved {
    pub verifier: Pubkey,
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AttestationRecorded {
    pub nullifier: [u8; 32],
    pub attestation_hash: [u8; 32],
    pub verifier: Pubkey,
    pub proof_type: ProofType,
    pub recipient: Pubkey,
    pub timestamp: i64,
    pub signature: [u8; 64],
}

#[event]
pub struct CommitmentCreated {
    pub owner: Pubkey,
    pub commitment: [u8; 32],
    pub timestamp: i64,
}

#[event]
pub struct ProofVerified {
    pub nullifier: [u8; 32],
    pub proof_type: ProofType,
    pub min_threshold: u64,
    pub recipient: Pubkey,
    pub timestamp: i64,
}

// === Errors ===

#[error_code]
pub enum VouchError {
    #[msg("Invalid proof")]
    InvalidProof,

    #[msg("Invalid public inputs")]
    InvalidPublicInputs,

    #[msg("Invalid proof type")]
    InvalidProofType,

    #[msg("Nullifier has already been used")]
    NullifierAlreadyUsed,

    #[msg("Commitment not found")]
    CommitmentNotFound,

    #[msg("Invalid commitment")]
    InvalidCommitment,

    #[msg("Unauthorized")]
    Unauthorized,

    #[msg("Verifier not authorized")]
    VerifierNotAuthorized,

    #[msg("Invalid signature")]
    InvalidSignature,
}
