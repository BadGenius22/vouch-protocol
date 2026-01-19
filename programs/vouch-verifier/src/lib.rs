use anchor_lang::prelude::*;
use anchor_lang::solana_program::sysvar::instructions::{
    load_current_index_checked, load_instruction_at_checked,
};
use anchor_spl::associated_token::AssociatedToken;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};
use solana_sdk_ids::ed25519_program;

declare_id!("EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD");

/// Ed25519 signature verification constants
pub const ED25519_PUBKEY_SIZE: usize = 32;
pub const ED25519_SIGNATURE_SIZE: usize = 64;

/// Default rate limit: 10 proofs per day
pub const DEFAULT_MAX_PROOFS_PER_DAY: u32 = 10;
/// Default cooldown: 60 seconds between proofs
pub const DEFAULT_COOLDOWN_SECONDS: i64 = 60;
/// Seconds in a day for rate limit reset
pub const SECONDS_PER_DAY: i64 = 86400;

/// Vouch Protocol - ZK Proof Verifier
///
/// This program verifies zero-knowledge proofs and manages:
/// - Nullifier registry (prevents double-proving)
/// - Credential minting (issues reputation NFTs)
/// - Commitment storage (links wallets to anonymous proofs)
/// - Attestation recording (off-chain verification results)
/// - Rate limiting (prevents spam)
/// - Admin controls (pause/unpause for emergencies)
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
        config.is_paused = false;
        config.pause_authority = ctx.accounts.admin.key();
        config.max_proofs_per_day = DEFAULT_MAX_PROOFS_PER_DAY;
        config.cooldown_seconds = DEFAULT_COOLDOWN_SECONDS;
        config.total_proofs_verified = 0;
        config.bump = ctx.bumps.config;

        emit!(ConfigInitialized {
            admin: config.admin,
            max_proofs_per_day: config.max_proofs_per_day,
            cooldown_seconds: config.cooldown_seconds,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === Admin Controls ===

    /// Pause the protocol (emergency stop)
    /// Only pause_authority can call this
    pub fn pause_protocol(ctx: Context<AdminControl>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(!config.is_paused, VouchError::AlreadyPaused);

        config.is_paused = true;

        emit!(ProtocolPaused {
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Unpause the protocol (resume operations)
    /// Only pause_authority can call this
    pub fn unpause_protocol(ctx: Context<AdminControl>) -> Result<()> {
        let config = &mut ctx.accounts.config;
        require!(config.is_paused, VouchError::NotPaused);

        config.is_paused = false;

        emit!(ProtocolUnpaused {
            admin: ctx.accounts.admin.key(),
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Update rate limit configuration
    /// Only admin can call this
    pub fn update_rate_limits(
        ctx: Context<AdminControl>,
        max_proofs_per_day: u32,
        cooldown_seconds: i64,
    ) -> Result<()> {
        require!(max_proofs_per_day > 0, VouchError::InvalidRateLimit);
        require!(cooldown_seconds >= 0, VouchError::InvalidRateLimit);

        let config = &mut ctx.accounts.config;
        let old_max = config.max_proofs_per_day;
        let old_cooldown = config.cooldown_seconds;

        config.max_proofs_per_day = max_proofs_per_day;
        config.cooldown_seconds = cooldown_seconds;

        emit!(RateLimitsUpdated {
            admin: ctx.accounts.admin.key(),
            old_max_proofs_per_day: old_max,
            new_max_proofs_per_day: max_proofs_per_day,
            old_cooldown_seconds: old_cooldown,
            new_cooldown_seconds: cooldown_seconds,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Transfer admin authority to a new address
    /// Only current admin can call this
    pub fn transfer_admin(ctx: Context<AdminControl>, new_admin: Pubkey) -> Result<()> {
        let config = &mut ctx.accounts.config;
        let old_admin = config.admin;

        config.admin = new_admin;
        config.pause_authority = new_admin;

        emit!(AdminTransferred {
            old_admin,
            new_admin,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    // === Rate Limiting ===

    /// Initialize rate limit tracking for a wallet
    /// Creates a WalletRateLimit PDA for the wallet
    pub fn init_rate_limit(ctx: Context<InitRateLimit>) -> Result<()> {
        let rate_limit = &mut ctx.accounts.rate_limit;
        let now = Clock::get()?.unix_timestamp;

        rate_limit.wallet = ctx.accounts.wallet.key();
        rate_limit.proofs_today = 0;
        rate_limit.last_proof_at = 0;
        rate_limit.day_start = now;
        rate_limit.total_proofs = 0;
        rate_limit.bump = ctx.bumps.rate_limit;

        emit!(RateLimitInitialized {
            wallet: rate_limit.wallet,
            timestamp: now,
        });

        Ok(())
    }

    // === Verifier Management ===

    /// Add an authorized verifier
    /// Only admin can add verifiers
    pub fn add_verifier(ctx: Context<AddVerifier>, verifier_pubkey: Pubkey) -> Result<()> {
        // Check protocol is not paused
        require!(!ctx.accounts.config.is_paused, VouchError::ProtocolPaused);

        let verifier_account = &mut ctx.accounts.verifier_account;
        verifier_account.verifier = verifier_pubkey;
        verifier_account.is_active = true;
        verifier_account.added_at = Clock::get()?.unix_timestamp;
        verifier_account.attestation_count = 0;
        verifier_account.bump = ctx.bumps.verifier_account;

        let config = &mut ctx.accounts.config;
        config.verifier_count = config.verifier_count.checked_add(1).ok_or(VouchError::Overflow)?;

        emit!(VerifierAdded {
            verifier: verifier_pubkey,
            admin: ctx.accounts.admin.key(),
            timestamp: verifier_account.added_at,
        });

        Ok(())
    }

    /// Remove an authorized verifier
    pub fn remove_verifier(ctx: Context<RemoveVerifier>) -> Result<()> {
        // Check protocol is not paused
        require!(!ctx.accounts.config.is_paused, VouchError::ProtocolPaused);

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
        let config = &ctx.accounts.config;
        let now = Clock::get()?.unix_timestamp;

        // Check protocol is not paused
        require!(!config.is_paused, VouchError::ProtocolPaused);

        // Verify the verifier is authorized
        let verifier_account = &ctx.accounts.verifier_account;
        require!(verifier_account.is_active, VouchError::VerifierNotAuthorized);

        // Check and update rate limits
        let rate_limit = &mut ctx.accounts.rate_limit;
        check_and_update_rate_limit(rate_limit, config, now)?;

        // Build the attestation message that was signed
        let message = build_attestation_message(
            proof_type_value,
            &nullifier,
            &attestation_hash,
        );

        // Verify the Ed25519 signature using instruction introspection
        // The transaction must include an Ed25519Program verify instruction
        // immediately before this instruction
        verify_ed25519_signature(
            &ctx.accounts.instructions_sysvar.to_account_info(),
            &verifier_account.verifier,
            &signature,
            &message,
        )?;

        // Check nullifier hasn't been used
        let nullifier_account = &ctx.accounts.nullifier_account;
        require!(!nullifier_account.is_used, VouchError::NullifierAlreadyUsed);

        // Mark nullifier as used
        let nullifier_account = &mut ctx.accounts.nullifier_account;
        nullifier_account.is_used = true;
        nullifier_account.used_at = now;
        nullifier_account.proof_type = match proof_type_value {
            1 => ProofType::DeveloperReputation,
            2 => ProofType::WhaleTrading,
            _ => return Err(VouchError::InvalidProofType.into()),
        };

        // Update verifier stats
        let verifier_account = &mut ctx.accounts.verifier_account;
        verifier_account.attestation_count = verifier_account
            .attestation_count
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;

        // Update global stats
        let config = &mut ctx.accounts.config;
        config.total_proofs_verified = config
            .total_proofs_verified
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;

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

    // === Commitment & Nullifier Management ===

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

    /// Initialize a nullifier account (must be called before record_attestation)
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

    // NOTE: Direct on-chain proof verification instructions (verify_dev_reputation, verify_whale_trading)
    // have been removed. UltraHonk proofs cannot be verified natively on Solana.
    //
    // For production use, the correct flow is:
    // 1. Client generates UltraHonk proof in browser
    // 2. Client sends proof to off-chain verifier service
    // 3. Verifier cryptographically verifies proof and signs attestation
    // 4. Client calls record_attestation with the signed attestation
    // 5. On-chain program verifies Ed25519 signature and records result
    //
    // See: https://github.com/solana-foundation/noir-examples for Groth16 alternative

    // === Private Airdrop Registry ===
    // Enables privacy-preserving airdrops where:
    // - Recipients prove eligibility via Vouch credentials
    // - Distribution amounts are hidden via ShadowWire
    // - No one can link real wallets to airdrop amounts

    /// Create a new airdrop campaign
    /// Only the campaign creator can distribute to registered addresses
    /// Create a tiered airdrop campaign
    /// - base_amount: Everyone gets this (open registration)
    /// - dev_bonus: Additional amount for verified developers
    /// - whale_bonus: Additional amount for verified whales
    pub fn create_airdrop_campaign(
        ctx: Context<CreateAirdropCampaign>,
        campaign_id: [u8; 32],
        name: String,
        token_mint: Pubkey,
        base_amount: u64,
        dev_bonus: u64,
        whale_bonus: u64,
        registration_deadline: i64,
    ) -> Result<()> {
        require!(name.len() <= 64, VouchError::NameTooLong);
        require!(registration_deadline > Clock::get()?.unix_timestamp, VouchError::InvalidDeadline);
        // At least base amount must be set (tiered model requires base)
        require!(base_amount > 0, VouchError::InvalidAmount);

        let campaign = &mut ctx.accounts.campaign;
        campaign.campaign_id = campaign_id;
        campaign.creator = ctx.accounts.creator.key();
        campaign.name = name;
        campaign.token_mint = token_mint;
        campaign.base_amount = base_amount;
        campaign.dev_bonus = dev_bonus;
        campaign.whale_bonus = whale_bonus;
        campaign.registration_deadline = registration_deadline;
        campaign.status = CampaignStatus::Open;
        campaign.total_registrations = 0;
        campaign.open_registrations = 0;
        campaign.dev_registrations = 0;
        campaign.whale_registrations = 0;
        campaign.created_at = Clock::get()?.unix_timestamp;
        campaign.vault_balance = 0;
        campaign.total_claimed = 0;
        campaign.bump = ctx.bumps.campaign;

        emit!(AirdropCampaignCreated {
            campaign_id,
            creator: campaign.creator,
            name: campaign.name.clone(),
            token_mint,
            base_amount,
            dev_bonus,
            whale_bonus,
            registration_deadline,
            timestamp: campaign.created_at,
        });

        Ok(())
    }

    /// Register for an airdrop campaign using a verified Vouch credential
    /// Gets base_amount + bonus (dev_bonus or whale_bonus based on credential)
    /// Links the user's nullifier to their ShadowWire address for private distribution
    pub fn register_for_airdrop(
        ctx: Context<RegisterForAirdrop>,
        shadow_wire_address: String,
    ) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let nullifier_account = &ctx.accounts.nullifier_account;
        let now = Clock::get()?.unix_timestamp;

        // Verify campaign is open
        require!(campaign.status == CampaignStatus::Open, VouchError::CampaignNotOpen);
        require!(now < campaign.registration_deadline, VouchError::RegistrationClosed);

        // Verify nullifier is used (proves user has Vouch credential)
        require!(nullifier_account.is_used, VouchError::NullifierNotVerified);

        // Validate ShadowWire address format (base58, 32-44 chars)
        require!(
            shadow_wire_address.len() >= 32 && shadow_wire_address.len() <= 44,
            VouchError::InvalidShadowWireAddress
        );

        // Create registration
        let registration = &mut ctx.accounts.registration;
        registration.campaign = campaign.key();
        registration.nullifier = nullifier_account.nullifier;
        registration.shadow_wire_address = shadow_wire_address.clone();
        registration.proof_type = nullifier_account.proof_type;
        registration.registered_at = now;
        registration.is_distributed = false;
        registration.is_claimed = false;
        registration.claimed_at = 0;
        registration.claimed_amount = 0;
        registration.bump = ctx.bumps.registration;

        // Update campaign stats
        let campaign = &mut ctx.accounts.campaign;
        campaign.total_registrations = campaign
            .total_registrations
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;

        match nullifier_account.proof_type {
            ProofType::DeveloperReputation => {
                campaign.dev_registrations = campaign
                    .dev_registrations
                    .checked_add(1)
                    .ok_or(VouchError::Overflow)?;
            }
            ProofType::WhaleTrading => {
                campaign.whale_registrations = campaign
                    .whale_registrations
                    .checked_add(1)
                    .ok_or(VouchError::Overflow)?;
            }
            _ => return Err(VouchError::InvalidProofType.into()),
        }

        emit!(AirdropRegistration {
            campaign_id: campaign.campaign_id,
            nullifier: nullifier_account.nullifier,
            shadow_wire_address,
            proof_type: nullifier_account.proof_type,
            timestamp: now,
        });

        Ok(())
    }

    /// Register for an airdrop campaign without verification (open registration)
    /// Gets only base_amount (no bonus)
    /// Uses wallet pubkey hash as unique identifier to prevent double registration
    pub fn register_for_airdrop_open(
        ctx: Context<RegisterForAirdropOpen>,
        shadow_wire_address: String,
    ) -> Result<()> {
        let campaign = &ctx.accounts.campaign;
        let now = Clock::get()?.unix_timestamp;

        // Verify campaign is open
        require!(campaign.status == CampaignStatus::Open, VouchError::CampaignNotOpen);
        require!(now < campaign.registration_deadline, VouchError::RegistrationClosed);

        // Validate ShadowWire address format (base58, 32-44 chars)
        require!(
            shadow_wire_address.len() >= 32 && shadow_wire_address.len() <= 44,
            VouchError::InvalidShadowWireAddress
        );

        // Create unique identifier from wallet pubkey (hash to 32 bytes)
        let wallet_id = ctx.accounts.payer.key().to_bytes();

        // Create registration
        let registration = &mut ctx.accounts.registration;
        registration.campaign = campaign.key();
        registration.nullifier = wallet_id; // Use wallet pubkey as identifier
        registration.shadow_wire_address = shadow_wire_address.clone();
        registration.proof_type = ProofType::Unset; // No verification
        registration.registered_at = now;
        registration.is_distributed = false;
        registration.is_claimed = false;
        registration.claimed_at = 0;
        registration.claimed_amount = 0;
        registration.bump = ctx.bumps.registration;

        // Update campaign stats
        let campaign = &mut ctx.accounts.campaign;
        campaign.total_registrations = campaign
            .total_registrations
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;
        campaign.open_registrations = campaign
            .open_registrations
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;

        emit!(AirdropRegistration {
            campaign_id: campaign.campaign_id,
            nullifier: wallet_id,
            shadow_wire_address,
            proof_type: ProofType::Unset,
            timestamp: now,
        });

        Ok(())
    }

    /// Close registration for a campaign (prevents new registrations)
    /// Only campaign creator can close
    pub fn close_airdrop_registration(ctx: Context<CloseAirdropRegistration>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(campaign.status == CampaignStatus::Open, VouchError::CampaignNotOpen);

        campaign.status = CampaignStatus::RegistrationClosed;

        emit!(AirdropRegistrationClosed {
            campaign_id: campaign.campaign_id,
            total_registrations: campaign.total_registrations,
            dev_registrations: campaign.dev_registrations,
            whale_registrations: campaign.whale_registrations,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Mark a registration as distributed (after sending via ShadowWire)
    /// Only campaign creator can mark distributions
    pub fn mark_airdrop_distributed(
        ctx: Context<MarkAirdropDistributed>,
        tx_signature: String,
    ) -> Result<()> {
        let registration = &mut ctx.accounts.registration;

        require!(!registration.is_distributed, VouchError::AlreadyDistributed);

        registration.is_distributed = true;
        registration.distributed_at = Clock::get()?.unix_timestamp;
        registration.distribution_tx = tx_signature.clone();

        emit!(AirdropDistributed {
            campaign_id: ctx.accounts.campaign.campaign_id,
            nullifier: registration.nullifier,
            shadow_wire_address: registration.shadow_wire_address.clone(),
            tx_signature,
            timestamp: registration.distributed_at,
        });

        Ok(())
    }

    /// Complete an airdrop campaign (marks as fully distributed)
    /// Only campaign creator can complete
    pub fn complete_airdrop_campaign(ctx: Context<CompleteAirdropCampaign>) -> Result<()> {
        let campaign = &mut ctx.accounts.campaign;

        require!(
            campaign.status == CampaignStatus::RegistrationClosed,
            VouchError::CampaignNotClosed
        );

        campaign.status = CampaignStatus::Completed;
        campaign.completed_at = Clock::get()?.unix_timestamp;

        emit!(AirdropCampaignCompleted {
            campaign_id: campaign.campaign_id,
            total_distributed: campaign.total_registrations,
            timestamp: campaign.completed_at,
        });

        Ok(())
    }

    /// Fund an airdrop campaign's token vault
    /// Only campaign creator can fund
    /// Tokens are transferred from creator's ATA to campaign vault
    pub fn fund_airdrop_campaign(ctx: Context<FundAirdropCampaign>, amount: u64) -> Result<()> {
        let campaign = &ctx.accounts.campaign;

        require!(amount > 0, VouchError::InvalidAmount);
        require!(
            campaign.status == CampaignStatus::Open ||
            campaign.status == CampaignStatus::RegistrationClosed,
            VouchError::CampaignNotOpen
        );

        // Transfer tokens from creator to vault
        let cpi_accounts = Transfer {
            from: ctx.accounts.creator_token_account.to_account_info(),
            to: ctx.accounts.campaign_vault.to_account_info(),
            authority: ctx.accounts.creator.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
        token::transfer(cpi_ctx, amount)?;

        // Update campaign funding stats
        let campaign = &mut ctx.accounts.campaign;
        campaign.vault_balance = campaign
            .vault_balance
            .checked_add(amount)
            .ok_or(VouchError::Overflow)?;

        emit!(AirdropCampaignFunded {
            campaign_id: campaign.campaign_id,
            funder: ctx.accounts.creator.key(),
            amount,
            total_funded: campaign.vault_balance,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    /// Claim airdrop tokens from a campaign
    /// Only registered users can claim
    /// Tokens are transferred from campaign vault to claimer's ATA
    pub fn claim_airdrop(ctx: Context<ClaimAirdrop>) -> Result<()> {
        let registration = &ctx.accounts.registration;
        let campaign = &ctx.accounts.campaign;

        // Verify not already claimed
        require!(!registration.is_claimed, VouchError::AlreadyClaimed);

        // Calculate claim amount based on proof type
        let claim_amount = match registration.proof_type {
            ProofType::DeveloperReputation => {
                campaign.base_amount.checked_add(campaign.dev_bonus).ok_or(VouchError::Overflow)?
            }
            ProofType::WhaleTrading => {
                campaign.base_amount.checked_add(campaign.whale_bonus).ok_or(VouchError::Overflow)?
            }
            ProofType::Unset => campaign.base_amount, // Open registration gets base only
        };

        // Verify vault has enough tokens
        require!(
            ctx.accounts.campaign_vault.amount >= claim_amount,
            VouchError::InsufficientFunds
        );

        // Transfer tokens from vault to claimer
        let campaign_id = campaign.campaign_id;
        let bump = campaign.bump;
        let seeds = &[
            b"airdrop_campaign".as_ref(),
            campaign_id.as_ref(),
            &[bump],
        ];
        let signer_seeds = &[&seeds[..]];

        let cpi_accounts = Transfer {
            from: ctx.accounts.campaign_vault.to_account_info(),
            to: ctx.accounts.claimer_token_account.to_account_info(),
            authority: ctx.accounts.campaign.to_account_info(),
        };
        let cpi_program = ctx.accounts.token_program.to_account_info();
        let cpi_ctx = CpiContext::new_with_signer(cpi_program, cpi_accounts, signer_seeds);
        token::transfer(cpi_ctx, claim_amount)?;

        // Update registration
        let registration = &mut ctx.accounts.registration;
        registration.is_claimed = true;
        registration.claimed_at = Clock::get()?.unix_timestamp;
        registration.claimed_amount = claim_amount;

        // Update campaign stats
        let campaign = &mut ctx.accounts.campaign;
        campaign.vault_balance = campaign
            .vault_balance
            .saturating_sub(claim_amount);
        campaign.total_claimed = campaign
            .total_claimed
            .checked_add(1)
            .ok_or(VouchError::Overflow)?;

        emit!(AirdropClaimed {
            campaign_id: campaign.campaign_id,
            claimer: ctx.accounts.claimer.key(),
            nullifier: registration.nullifier,
            amount: claim_amount,
            proof_type: registration.proof_type,
            timestamp: registration.claimed_at,
        });

        Ok(())
    }
}

// === Helper Functions ===

/// Check and update rate limits for a wallet
fn check_and_update_rate_limit(
    rate_limit: &mut WalletRateLimit,
    config: &ConfigAccount,
    now: i64,
) -> Result<()> {
    // Check cooldown period
    let time_since_last = now.saturating_sub(rate_limit.last_proof_at);
    require!(
        time_since_last >= config.cooldown_seconds,
        VouchError::RateLimitCooldown
    );

    // Reset daily counter if new day
    if now.saturating_sub(rate_limit.day_start) >= SECONDS_PER_DAY {
        rate_limit.day_start = now;
        rate_limit.proofs_today = 0;
    }

    // Check daily limit
    require!(
        rate_limit.proofs_today < config.max_proofs_per_day,
        VouchError::DailyRateLimitExceeded
    );

    // Update rate limit counters
    rate_limit.proofs_today = rate_limit
        .proofs_today
        .checked_add(1)
        .ok_or(VouchError::Overflow)?;
    rate_limit.last_proof_at = now;
    rate_limit.total_proofs = rate_limit
        .total_proofs
        .checked_add(1)
        .ok_or(VouchError::Overflow)?;

    Ok(())
}

/// Build the attestation message that the verifier signs
/// Format: "vouch_attestation" | proof_type (1 byte) | nullifier (32 bytes) | attestation_hash (32 bytes)
pub fn build_attestation_message(
    proof_type_value: u8,
    nullifier: &[u8; 32],
    attestation_hash: &[u8; 32],
) -> [u8; 82] {
    let mut message = [0u8; 82];
    // Domain separator: "vouch_attestation" (17 bytes)
    message[0..17].copy_from_slice(b"vouch_attestation");
    // Proof type (1 byte)
    message[17] = proof_type_value;
    // Nullifier (32 bytes)
    message[18..50].copy_from_slice(nullifier);
    // Attestation hash (32 bytes)
    message[50..82].copy_from_slice(attestation_hash);
    message
}

/// Verify Ed25519 signature using instruction introspection
/// This function checks that a valid Ed25519Program instruction was included
/// in the transaction that verifies the signature over the attestation message
pub fn verify_ed25519_signature(
    instructions_sysvar: &AccountInfo,
    verifier_pubkey: &Pubkey,
    signature: &[u8; 64],
    message: &[u8],
) -> Result<()> {
    // Get the current instruction index
    let current_index = load_current_index_checked(instructions_sysvar)
        .map_err(|_| VouchError::InvalidSignature)?;

    // We expect the Ed25519 instruction to be right before this instruction
    // (index = current_index - 1)
    if current_index == 0 {
        return Err(VouchError::InvalidSignature.into());
    }

    let ed25519_ix_index = current_index - 1;

    // Load the Ed25519 instruction
    let ed25519_ix = load_instruction_at_checked(ed25519_ix_index as usize, instructions_sysvar)
        .map_err(|_| VouchError::InvalidSignature)?;

    // Verify it's an Ed25519 program instruction
    if ed25519_ix.program_id != ed25519_program::ID {
        return Err(VouchError::InvalidSignature.into());
    }

    // Parse and verify the Ed25519 instruction data
    // Ed25519 instruction format:
    // - 1 byte: number of signatures
    // - 1 byte: padding
    // For each signature:
    // - 2 bytes: signature offset
    // - 2 bytes: signature instruction index
    // - 2 bytes: public key offset
    // - 2 bytes: public key instruction index
    // - 2 bytes: message data offset
    // - 2 bytes: message data size
    // - 2 bytes: message instruction index
    // Then the actual data (signature, pubkey, message)

    let ix_data = &ed25519_ix.data;

    if ix_data.len() < 2 {
        return Err(VouchError::InvalidSignature.into());
    }

    let num_signatures = ix_data[0];
    if num_signatures != 1 {
        return Err(VouchError::InvalidSignature.into());
    }

    // Parse offsets (bytes 2-15)
    if ix_data.len() < 16 {
        return Err(VouchError::InvalidSignature.into());
    }

    let sig_offset = u16::from_le_bytes([ix_data[2], ix_data[3]]) as usize;
    let pubkey_offset = u16::from_le_bytes([ix_data[6], ix_data[7]]) as usize;
    let msg_offset = u16::from_le_bytes([ix_data[10], ix_data[11]]) as usize;
    let msg_size = u16::from_le_bytes([ix_data[12], ix_data[13]]) as usize;

    // Verify the instruction contains the expected data at the specified offsets
    if ix_data.len() < sig_offset + ED25519_SIGNATURE_SIZE {
        return Err(VouchError::InvalidSignature.into());
    }
    if ix_data.len() < pubkey_offset + ED25519_PUBKEY_SIZE {
        return Err(VouchError::InvalidSignature.into());
    }
    if ix_data.len() < msg_offset + msg_size {
        return Err(VouchError::InvalidSignature.into());
    }

    // Extract and verify signature matches
    let ix_signature = &ix_data[sig_offset..sig_offset + ED25519_SIGNATURE_SIZE];
    if ix_signature != signature.as_slice() {
        return Err(VouchError::InvalidSignature.into());
    }

    // Extract and verify public key matches the verifier
    let ix_pubkey = &ix_data[pubkey_offset..pubkey_offset + ED25519_PUBKEY_SIZE];
    if ix_pubkey != verifier_pubkey.as_ref() {
        return Err(VouchError::InvalidSignature.into());
    }

    // Extract and verify message matches
    let ix_message = &ix_data[msg_offset..msg_offset + msg_size];
    if ix_message != message {
        return Err(VouchError::InvalidSignature.into());
    }

    // If we get here, the Ed25519 program has verified the signature is valid
    // for the given public key and message
    Ok(())
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

/// Admin control context for pause/unpause and config updates
#[derive(Accounts)]
pub struct AdminControl<'info> {
    #[account(
        mut,
        seeds = [b"config"],
        bump = config.bump,
        constraint = config.admin == admin.key() @ VouchError::Unauthorized
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(mut)]
    pub admin: Signer<'info>,
}

/// Initialize rate limit tracking for a wallet
#[derive(Accounts)]
pub struct InitRateLimit<'info> {
    #[account(
        init,
        payer = payer,
        space = 8 + WalletRateLimit::INIT_SPACE,
        seeds = [b"rate_limit", wallet.key().as_ref()],
        bump
    )]
    pub rate_limit: Account<'info, WalletRateLimit>,

    /// CHECK: The wallet to track rate limits for
    pub wallet: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

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
        mut,
        seeds = [b"config"],
        bump = config.bump
    )]
    pub config: Account<'info, ConfigAccount>,

    #[account(
        mut,
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

    #[account(
        mut,
        seeds = [b"rate_limit", recipient.key().as_ref()],
        bump = rate_limit.bump
    )]
    pub rate_limit: Account<'info, WalletRateLimit>,

    /// The wallet receiving the credential
    /// CHECK: This is the recipient of the credential NFT
    pub recipient: UncheckedAccount<'info>,

    #[account(mut)]
    pub payer: Signer<'info>,

    /// Instructions sysvar for Ed25519 signature verification
    /// CHECK: This is the instructions sysvar
    #[account(address = anchor_lang::solana_program::sysvar::instructions::ID)]
    pub instructions_sysvar: UncheckedAccount<'info>,
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

// === Airdrop Registry Accounts ===

#[derive(Accounts)]
#[instruction(campaign_id: [u8; 32])]
pub struct CreateAirdropCampaign<'info> {
    #[account(
        init,
        payer = creator,
        space = 8 + AirdropCampaign::INIT_SPACE,
        seeds = [b"airdrop_campaign", campaign_id.as_ref()],
        bump
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct RegisterForAirdrop<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ VouchError::CampaignNotOpen
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(
        seeds = [b"nullifier", nullifier_account.nullifier.as_ref()],
        bump = nullifier_account.bump,
        constraint = nullifier_account.is_used @ VouchError::NullifierNotVerified
    )]
    pub nullifier_account: Account<'info, NullifierAccount>,

    #[account(
        init,
        payer = payer,
        space = 8 + AirdropRegistrationAccount::INIT_SPACE,
        seeds = [b"airdrop_registration", campaign.key().as_ref(), nullifier_account.nullifier.as_ref()],
        bump
    )]
    pub registration: Account<'info, AirdropRegistrationAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(shadow_wire_address: String)]
pub struct RegisterForAirdropOpen<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.status == CampaignStatus::Open @ VouchError::CampaignNotOpen
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(
        init,
        payer = payer,
        space = 8 + AirdropRegistrationAccount::INIT_SPACE,
        seeds = [b"airdrop_registration", campaign.key().as_ref(), payer.key().as_ref()],
        bump
    )]
    pub registration: Account<'info, AirdropRegistrationAccount>,

    #[account(mut)]
    pub payer: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct CloseAirdropRegistration<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.creator == creator.key() @ VouchError::Unauthorized
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct MarkAirdropDistributed<'info> {
    #[account(
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.creator == creator.key() @ VouchError::Unauthorized
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(
        mut,
        seeds = [b"airdrop_registration", campaign.key().as_ref(), registration.nullifier.as_ref()],
        bump = registration.bump,
        constraint = registration.campaign == campaign.key() @ VouchError::InvalidCampaign
    )]
    pub registration: Account<'info, AirdropRegistrationAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

#[derive(Accounts)]
pub struct CompleteAirdropCampaign<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.creator == creator.key() @ VouchError::Unauthorized
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    #[account(mut)]
    pub creator: Signer<'info>,
}

/// Fund an airdrop campaign's token vault
#[derive(Accounts)]
pub struct FundAirdropCampaign<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump,
        constraint = campaign.creator == creator.key() @ VouchError::Unauthorized
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    /// Campaign token vault (ATA owned by campaign PDA)
    #[account(
        init_if_needed,
        payer = creator,
        associated_token::mint = token_mint,
        associated_token::authority = campaign,
    )]
    pub campaign_vault: Account<'info, TokenAccount>,

    /// Token mint for the campaign
    #[account(
        constraint = token_mint.key() == campaign.token_mint @ VouchError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,

    /// Creator's token account to fund from
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = creator,
    )]
    pub creator_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

/// Claim airdrop tokens from a campaign
#[derive(Accounts)]
pub struct ClaimAirdrop<'info> {
    #[account(
        mut,
        seeds = [b"airdrop_campaign", campaign.campaign_id.as_ref()],
        bump = campaign.bump
    )]
    pub campaign: Account<'info, AirdropCampaign>,

    /// Campaign token vault (ATA owned by campaign PDA)
    #[account(
        mut,
        associated_token::mint = token_mint,
        associated_token::authority = campaign,
    )]
    pub campaign_vault: Account<'info, TokenAccount>,

    /// Token mint for the campaign
    #[account(
        constraint = token_mint.key() == campaign.token_mint @ VouchError::InvalidMint
    )]
    pub token_mint: Account<'info, Mint>,

    /// Registration proving eligibility
    #[account(
        mut,
        seeds = [b"airdrop_registration", campaign.key().as_ref(), registration.nullifier.as_ref()],
        bump = registration.bump,
        constraint = registration.campaign == campaign.key() @ VouchError::InvalidCampaign,
        constraint = !registration.is_claimed @ VouchError::AlreadyClaimed
    )]
    pub registration: Account<'info, AirdropRegistrationAccount>,

    /// Claimer's token account to receive tokens
    #[account(
        init_if_needed,
        payer = claimer,
        associated_token::mint = token_mint,
        associated_token::authority = claimer,
    )]
    pub claimer_token_account: Account<'info, TokenAccount>,

    #[account(mut)]
    pub claimer: Signer<'info>,

    pub token_program: Program<'info, Token>,
    pub associated_token_program: Program<'info, AssociatedToken>,
    pub system_program: Program<'info, System>,
}

// === State ===

#[account]
#[derive(InitSpace)]
pub struct ConfigAccount {
    /// Protocol admin with full control
    pub admin: Pubkey,
    /// Authority that can pause/unpause (initially same as admin)
    pub pause_authority: Pubkey,
    /// Number of active verifiers
    pub verifier_count: u32,
    /// Whether the protocol is paused
    pub is_paused: bool,
    /// Maximum proofs per wallet per day
    pub max_proofs_per_day: u32,
    /// Cooldown seconds between proofs
    pub cooldown_seconds: i64,
    /// Total proofs verified across all wallets
    pub total_proofs_verified: u64,
    /// PDA bump
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

/// Rate limit tracking per wallet
#[account]
#[derive(InitSpace)]
pub struct WalletRateLimit {
    /// The wallet being rate limited
    pub wallet: Pubkey,
    /// Number of proofs submitted today
    pub proofs_today: u32,
    /// Timestamp of last proof submission
    pub last_proof_at: i64,
    /// Start of current day (for daily reset)
    pub day_start: i64,
    /// Total proofs ever submitted by this wallet
    pub total_proofs: u64,
    /// PDA bump
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

// === Airdrop Registry State ===

#[account]
#[derive(InitSpace)]
pub struct AirdropCampaign {
    /// Unique campaign identifier (hash)
    pub campaign_id: [u8; 32],
    /// Campaign creator (project distributing tokens)
    pub creator: Pubkey,
    /// Human-readable campaign name
    #[max_len(64)]
    pub name: String,
    /// Token mint for the airdrop
    pub token_mint: Pubkey,
    /// Base amount for anyone (tiered: open registration)
    pub base_amount: u64,
    /// Bonus amount for verified developers (gets base + dev_bonus)
    pub dev_bonus: u64,
    /// Bonus amount for verified whales (gets base + whale_bonus)
    pub whale_bonus: u64,
    /// Registration deadline (unix timestamp)
    pub registration_deadline: i64,
    /// Campaign status
    pub status: CampaignStatus,
    /// Total number of registrations
    pub total_registrations: u32,
    /// Number of open (unverified) registrations
    pub open_registrations: u32,
    /// Number of developer registrations
    pub dev_registrations: u32,
    /// Number of whale registrations
    pub whale_registrations: u32,
    /// Campaign creation timestamp
    pub created_at: i64,
    /// Campaign completion timestamp (0 if not completed)
    pub completed_at: i64,
    /// Current vault balance (tokens available for claims)
    pub vault_balance: u64,
    /// Total number of claims made
    pub total_claimed: u32,
    /// PDA bump
    pub bump: u8,
}

#[account]
#[derive(InitSpace)]
pub struct AirdropRegistrationAccount {
    /// Campaign this registration belongs to
    pub campaign: Pubkey,
    /// Nullifier from the Vouch credential
    pub nullifier: [u8; 32],
    /// User's ShadowWire address for private receipt
    #[max_len(44)]
    pub shadow_wire_address: String,
    /// Type of credential (dev or whale)
    pub proof_type: ProofType,
    /// Registration timestamp
    pub registered_at: i64,
    /// Whether tokens have been distributed (ShadowWire flow)
    pub is_distributed: bool,
    /// Distribution timestamp (0 if not distributed)
    pub distributed_at: i64,
    /// Distribution transaction signature
    #[max_len(88)]
    pub distribution_tx: String,
    /// Whether tokens have been claimed (direct claim flow)
    pub is_claimed: bool,
    /// Claim timestamp (0 if not claimed)
    pub claimed_at: i64,
    /// Amount of tokens claimed
    pub claimed_amount: u64,
    /// PDA bump
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, InitSpace, Default)]
pub enum CampaignStatus {
    #[default]
    Open,
    RegistrationClosed,
    Completed,
}

// === Events ===

#[event]
pub struct ConfigInitialized {
    pub admin: Pubkey,
    pub max_proofs_per_day: u32,
    pub cooldown_seconds: i64,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolPaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct ProtocolUnpaused {
    pub admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RateLimitsUpdated {
    pub admin: Pubkey,
    pub old_max_proofs_per_day: u32,
    pub new_max_proofs_per_day: u32,
    pub old_cooldown_seconds: i64,
    pub new_cooldown_seconds: i64,
    pub timestamp: i64,
}

#[event]
pub struct AdminTransferred {
    pub old_admin: Pubkey,
    pub new_admin: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct RateLimitInitialized {
    pub wallet: Pubkey,
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

// === Airdrop Events ===

#[event]
pub struct AirdropCampaignCreated {
    pub campaign_id: [u8; 32],
    pub creator: Pubkey,
    pub name: String,
    pub token_mint: Pubkey,
    pub base_amount: u64,
    pub dev_bonus: u64,
    pub whale_bonus: u64,
    pub registration_deadline: i64,
    pub timestamp: i64,
}

#[event]
pub struct AirdropRegistration {
    pub campaign_id: [u8; 32],
    pub nullifier: [u8; 32],
    pub shadow_wire_address: String,
    pub proof_type: ProofType,
    pub timestamp: i64,
}

#[event]
pub struct AirdropRegistrationClosed {
    pub campaign_id: [u8; 32],
    pub total_registrations: u32,
    pub dev_registrations: u32,
    pub whale_registrations: u32,
    pub timestamp: i64,
}

#[event]
pub struct AirdropDistributed {
    pub campaign_id: [u8; 32],
    pub nullifier: [u8; 32],
    pub shadow_wire_address: String,
    pub tx_signature: String,
    pub timestamp: i64,
}

#[event]
pub struct AirdropCampaignCompleted {
    pub campaign_id: [u8; 32],
    pub total_distributed: u32,
    pub timestamp: i64,
}

#[event]
pub struct AirdropCampaignFunded {
    pub campaign_id: [u8; 32],
    pub funder: Pubkey,
    pub amount: u64,
    pub total_funded: u64,
    pub timestamp: i64,
}

#[event]
pub struct AirdropClaimed {
    pub campaign_id: [u8; 32],
    pub claimer: Pubkey,
    pub nullifier: [u8; 32],
    pub amount: u64,
    pub proof_type: ProofType,
    pub timestamp: i64,
}

// === Errors ===

#[error_code]
pub enum VouchError {
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

    // === Security Errors ===

    #[msg("Protocol is paused")]
    ProtocolPaused,

    #[msg("Protocol is not paused")]
    NotPaused,

    #[msg("Protocol is already paused")]
    AlreadyPaused,

    #[msg("Rate limit cooldown not elapsed")]
    RateLimitCooldown,

    #[msg("Daily rate limit exceeded")]
    DailyRateLimitExceeded,

    #[msg("Invalid rate limit configuration")]
    InvalidRateLimit,

    #[msg("Arithmetic overflow")]
    Overflow,

    // === Airdrop Errors ===

    #[msg("Campaign name too long (max 64 chars)")]
    NameTooLong,

    #[msg("Registration deadline must be in the future")]
    InvalidDeadline,

    #[msg("Amount must be greater than zero")]
    InvalidAmount,

    #[msg("Campaign is not open for registration")]
    CampaignNotOpen,

    #[msg("Campaign registration period has closed")]
    RegistrationClosed,

    #[msg("Nullifier has not been verified (no Vouch credential)")]
    NullifierNotVerified,

    #[msg("Invalid ShadowWire address format")]
    InvalidShadowWireAddress,

    #[msg("Airdrop has already been distributed to this registration")]
    AlreadyDistributed,

    #[msg("Campaign must be closed before completing")]
    CampaignNotClosed,

    #[msg("Registration does not belong to this campaign")]
    InvalidCampaign,

    #[msg("Insufficient funds in campaign vault")]
    InsufficientFunds,

    #[msg("Airdrop has already been claimed")]
    AlreadyClaimed,

    #[msg("Token mint does not match campaign")]
    InvalidMint,
}
