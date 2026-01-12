import * as anchor from '@coral-xyz/anchor';
import { Program } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';
import { expect } from 'chai';
import { VouchVerifier } from '../target/types/vouch_verifier';

describe('vouch-verifier', () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.VouchVerifier as Program<VouchVerifier>;
  const payer = provider.wallet as anchor.Wallet;

  // Test data
  const testCommitment = new Uint8Array(32).fill(1);
  const testProof = new Uint8Array(256).fill(3);
  const testPublicInputs = new Uint8Array(64).fill(4);

  describe('create_commitment', () => {
    it('should create a new commitment', async () => {
      const [commitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('commitment'), Buffer.from(testCommitment)],
        program.programId
      );

      await program.methods
        .createCommitment(Array.from(testCommitment) as number[] & { length: 32 })
        .accounts({
          commitmentAccount: commitmentPda,
          owner: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const account = await program.account.commitmentAccount.fetch(commitmentPda);
      expect(account.owner.toBase58()).to.equal(payer.publicKey.toBase58());
      expect(Buffer.from(account.commitment).equals(Buffer.from(testCommitment))).to.be.true;
    });

    it('should fail to create duplicate commitment', async () => {
      const [commitmentPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('commitment'), Buffer.from(testCommitment)],
        program.programId
      );

      try {
        await program.methods
          .createCommitment(Array.from(testCommitment) as number[] & { length: 32 })
          .accounts({
            commitmentAccount: commitmentPda,
            owner: payer.publicKey,
            systemProgram: anchor.web3.SystemProgram.programId,
          })
          .rpc();
        expect.fail('Should have thrown an error');
      } catch (error) {
        expect(error).to.exist;
      }
    });
  });

  describe('verify_dev_reputation', () => {
    const recipient = Keypair.generate();
    let uniqueNullifier: Uint8Array;
    let nullifierPda: PublicKey;

    beforeEach(async () => {
      // Generate unique nullifier for each test
      uniqueNullifier = new Uint8Array(32);
      crypto.getRandomValues(uniqueNullifier);

      [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), Buffer.from(uniqueNullifier)],
        program.programId
      );

      // Initialize nullifier account first
      await program.methods
        .initNullifier(Array.from(uniqueNullifier) as number[] & { length: 32 })
        .accounts({
          nullifierAccount: nullifierPda,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it('should verify a valid developer reputation proof', async () => {
      await program.methods
        .verifyDevReputation(
          Buffer.from(testProof),
          Buffer.from(testPublicInputs),
          new anchor.BN(100000) // min_tvl: 100K
        )
        .accounts({
          nullifierAccount: nullifierPda,
          recipient: recipient.publicKey,
          payer: payer.publicKey,
        })
        .rpc();

      const account = await program.account.nullifierAccount.fetch(nullifierPda);
      expect(account.isUsed).to.be.true;
      expect(account.proofType).to.deep.equal({ developerReputation: {} });
    });

    it('should reject reused nullifier', async () => {
      // First verification
      await program.methods
        .verifyDevReputation(
          Buffer.from(testProof),
          Buffer.from(testPublicInputs),
          new anchor.BN(100000)
        )
        .accounts({
          nullifierAccount: nullifierPda,
          recipient: recipient.publicKey,
          payer: payer.publicKey,
        })
        .rpc();

      // Second verification should fail
      try {
        await program.methods
          .verifyDevReputation(
            Buffer.from(testProof),
            Buffer.from(testPublicInputs),
            new anchor.BN(100000)
          )
          .accounts({
            nullifierAccount: nullifierPda,
            recipient: recipient.publicKey,
            payer: payer.publicKey,
          })
          .rpc();
        expect.fail('Should have thrown NullifierAlreadyUsed error');
      } catch (error) {
        expect(error.toString()).to.include('NullifierAlreadyUsed');
      }
    });
  });

  describe('verify_whale_trading', () => {
    const recipient = Keypair.generate();
    let uniqueNullifier: Uint8Array;
    let nullifierPda: PublicKey;

    beforeEach(async () => {
      uniqueNullifier = new Uint8Array(32);
      crypto.getRandomValues(uniqueNullifier);

      [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), Buffer.from(uniqueNullifier)],
        program.programId
      );

      await program.methods
        .initNullifier(Array.from(uniqueNullifier) as number[] & { length: 32 })
        .accounts({
          nullifierAccount: nullifierPda,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();
    });

    it('should verify a valid whale trading proof', async () => {
      await program.methods
        .verifyWhaleTrading(
          Buffer.from(testProof),
          Buffer.from(testPublicInputs),
          new anchor.BN(50000) // min_volume: 50K
        )
        .accounts({
          nullifierAccount: nullifierPda,
          recipient: recipient.publicKey,
          payer: payer.publicKey,
        })
        .rpc();

      const account = await program.account.nullifierAccount.fetch(nullifierPda);
      expect(account.isUsed).to.be.true;
      expect(account.proofType).to.deep.equal({ whaleTrading: {} });
    });
  });

  describe('init_nullifier', () => {
    it('should initialize a new nullifier account', async () => {
      const uniqueNullifier = new Uint8Array(32);
      crypto.getRandomValues(uniqueNullifier);

      const [nullifierPda] = PublicKey.findProgramAddressSync(
        [Buffer.from('nullifier'), Buffer.from(uniqueNullifier)],
        program.programId
      );

      await program.methods
        .initNullifier(Array.from(uniqueNullifier) as number[] & { length: 32 })
        .accounts({
          nullifierAccount: nullifierPda,
          payer: payer.publicKey,
          systemProgram: anchor.web3.SystemProgram.programId,
        })
        .rpc();

      const account = await program.account.nullifierAccount.fetch(nullifierPda);
      expect(account.isUsed).to.be.false;
      expect(account.proofType).to.deep.equal({ unset: {} });
    });
  });
});
