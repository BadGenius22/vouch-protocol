use anchor_lang::prelude::*;

declare_id!("FGoZca8WMS9EK6TSgDf2cFdGH3uiwH3ThFKfE5KdjGAg");

/// Vouch Protocol - ZK Proof Verifier
///
/// This program verifies zero-knowledge proofs and manages:
/// - Nullifier registry (prevents double-proving)
/// - Credential minting (issues reputation NFTs)
/// - Commitment storage (links wallets to anonymous proofs)
#[program]
pub mod vouch_verifier {
    use super::*;

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

    /// Verify a developer reputation proof
    pub fn verify_dev_reputation(
        ctx: Context<VerifyProof>,
        proof: Vec<u8>,
        public_inputs: Vec<u8>,
        min_tvl: u64,
    ) -> Result<()> {
        // 1. Verify the ZK proof
        // TODO: Integrate with Groth16/UltraPlonk verifier
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

        // TODO: Mint credential NFT to recipient

        Ok(())
    }

    /// Verify a whale trading proof
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

    #[msg("Nullifier has already been used")]
    NullifierAlreadyUsed,

    #[msg("Commitment not found")]
    CommitmentNotFound,

    #[msg("Invalid commitment")]
    InvalidCommitment,
}
