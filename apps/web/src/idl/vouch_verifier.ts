/**
 * Program IDL in camelCase format in order to be used in JS/TS.
 *
 * Note that this is only a type helper and is not the actual IDL. The original
 * IDL can be found at `target/idl/vouch_verifier.json`.
 */
export type VouchVerifier = {
  "address": "EhSkCuohWP8Sdfq6yHoKih6r2rsNoYYPZZSfpnyELuaD",
  "metadata": {
    "name": "vouchVerifier",
    "version": "0.1.0",
    "spec": "0.1.0",
    "description": "Vouch Protocol - ZK Proof Verifier for Solana"
  },
  "docs": [
    "Vouch Protocol - ZK Proof Verifier",
    "",
    "This program verifies zero-knowledge proofs and manages:",
    "- Nullifier registry (prevents double-proving)",
    "- Credential minting (issues reputation NFTs)",
    "- Commitment storage (links wallets to anonymous proofs)",
    "- Attestation recording (off-chain verification results)",
    "- Rate limiting (prevents spam)",
    "- Admin controls (pause/unpause for emergencies)"
  ],
  "instructions": [
    {
      "name": "addVerifier",
      "docs": [
        "Add an authorized verifier",
        "Only admin can add verifiers"
      ],
      "discriminator": [
        165,
        72,
        135,
        225,
        67,
        181,
        255,
        135
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "verifierAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "verifierPubkey"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "verifierPubkey",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "claimAirdrop",
      "docs": [
        "Claim airdrop tokens from a campaign",
        "Only registered users can claim",
        "Tokens are transferred from campaign vault to claimer's ATA"
      ],
      "discriminator": [
        137,
        50,
        122,
        111,
        89,
        254,
        8,
        20
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "campaignVault",
          "docs": [
            "Campaign token vault (ATA owned by campaign PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "Token mint for the campaign"
          ]
        },
        {
          "name": "registration",
          "docs": [
            "Registration proving eligibility"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "registration.nullifier",
                "account": "airdropRegistrationAccount"
              }
            ]
          }
        },
        {
          "name": "claimerTokenAccount",
          "docs": [
            "Claimer's token account to receive tokens"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "claimer"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "claimer",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "closeAirdropRegistration",
      "docs": [
        "Close registration for a campaign (prevents new registrations)",
        "Only campaign creator can close"
      ],
      "discriminator": [
        242,
        109,
        65,
        233,
        29,
        124,
        242,
        167
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "completeAirdropCampaign",
      "docs": [
        "Complete an airdrop campaign (marks as fully distributed)",
        "Only campaign creator can complete"
      ],
      "discriminator": [
        71,
        192,
        208,
        217,
        216,
        121,
        189,
        58
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "createAirdropCampaign",
      "docs": [
        "Create a new airdrop campaign",
        "Only the campaign creator can distribute to registered addresses",
        "Create a tiered airdrop campaign",
        "- base_amount: Everyone gets this (open registration)",
        "- dev_bonus: Additional amount for verified developers",
        "- whale_bonus: Additional amount for verified whales"
      ],
      "discriminator": [
        137,
        20,
        107,
        226,
        116,
        34,
        27,
        215
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "arg",
                "path": "campaignId"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "campaignId",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "name",
          "type": "string"
        },
        {
          "name": "tokenMint",
          "type": "pubkey"
        },
        {
          "name": "baseAmount",
          "type": "u64"
        },
        {
          "name": "devBonus",
          "type": "u64"
        },
        {
          "name": "whaleBonus",
          "type": "u64"
        },
        {
          "name": "registrationDeadline",
          "type": "i64"
        }
      ]
    },
    {
      "name": "createCommitment",
      "docs": [
        "Initialize a new commitment for a wallet",
        "The commitment = hash(wallet_pubkey + secret) is stored on-chain"
      ],
      "discriminator": [
        232,
        31,
        118,
        65,
        229,
        2,
        2,
        170
      ],
      "accounts": [
        {
          "name": "commitmentAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  109,
                  109,
                  105,
                  116,
                  109,
                  101,
                  110,
                  116
                ]
              },
              {
                "kind": "arg",
                "path": "commitment"
              }
            ]
          }
        },
        {
          "name": "owner",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "commitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "fundAirdropCampaign",
      "docs": [
        "Fund an airdrop campaign's token vault",
        "Only campaign creator can fund",
        "Tokens are transferred from creator's ATA to campaign vault"
      ],
      "discriminator": [
        204,
        227,
        11,
        42,
        142,
        44,
        121,
        87
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "campaignVault",
          "docs": [
            "Campaign token vault (ATA owned by campaign PDA)"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "tokenMint",
          "docs": [
            "Token mint for the campaign"
          ]
        },
        {
          "name": "creatorTokenAccount",
          "docs": [
            "Creator's token account to fund from"
          ],
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "account",
                "path": "creator"
              },
              {
                "kind": "const",
                "value": [
                  6,
                  221,
                  246,
                  225,
                  215,
                  101,
                  161,
                  147,
                  217,
                  203,
                  225,
                  70,
                  206,
                  235,
                  121,
                  172,
                  28,
                  180,
                  133,
                  237,
                  95,
                  91,
                  55,
                  145,
                  58,
                  140,
                  245,
                  133,
                  126,
                  255,
                  0,
                  169
                ]
              },
              {
                "kind": "account",
                "path": "tokenMint"
              }
            ],
            "program": {
              "kind": "const",
              "value": [
                140,
                151,
                37,
                143,
                78,
                36,
                137,
                241,
                187,
                61,
                16,
                41,
                20,
                142,
                13,
                131,
                11,
                90,
                19,
                153,
                218,
                255,
                16,
                132,
                4,
                142,
                123,
                216,
                219,
                233,
                248,
                89
              ]
            }
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        },
        {
          "name": "tokenProgram",
          "address": "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA"
        },
        {
          "name": "associatedTokenProgram",
          "address": "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL"
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "amount",
          "type": "u64"
        }
      ]
    },
    {
      "name": "initNullifier",
      "docs": [
        "Initialize a nullifier account (must be called before record_attestation)",
        "This separates account creation from verification for security"
      ],
      "discriminator": [
        187,
        124,
        88,
        139,
        111,
        232,
        162,
        236
      ],
      "accounts": [
        {
          "name": "nullifierAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "nullifier"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        }
      ]
    },
    {
      "name": "initRateLimit",
      "docs": [
        "Initialize rate limit tracking for a wallet",
        "Creates a WalletRateLimit PDA for the wallet"
      ],
      "discriminator": [
        251,
        4,
        23,
        48,
        120,
        61,
        159,
        135
      ],
      "accounts": [
        {
          "name": "rateLimit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  116,
                  101,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "wallet"
              }
            ]
          }
        },
        {
          "name": "wallet"
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "initializeConfig",
      "docs": [
        "Initialize the protocol configuration",
        "Must be called once by the deployer"
      ],
      "discriminator": [
        208,
        127,
        21,
        1,
        194,
        190,
        196,
        70
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": []
    },
    {
      "name": "markAirdropDistributed",
      "docs": [
        "Mark a registration as distributed (after sending via ShadowWire)",
        "Only campaign creator can mark distributions"
      ],
      "discriminator": [
        87,
        183,
        242,
        84,
        106,
        43,
        9,
        210
      ],
      "accounts": [
        {
          "name": "campaign",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "registration",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "registration.nullifier",
                "account": "airdropRegistrationAccount"
              }
            ]
          }
        },
        {
          "name": "creator",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "txSignature",
          "type": "string"
        }
      ]
    },
    {
      "name": "pauseProtocol",
      "docs": [
        "Pause the protocol (emergency stop)",
        "Only pause_authority can call this"
      ],
      "discriminator": [
        144,
        95,
        0,
        107,
        119,
        39,
        248,
        141
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "recordAttestation",
      "docs": [
        "Record a verified attestation from an authorized verifier",
        "This is the production-ready verification flow:",
        "1. Client generates proof",
        "2. Off-chain verifier verifies proof and signs attestation",
        "3. Client submits attestation to this instruction",
        "4. On-chain program validates signature and records result",
        "",
        "New parameters (v2):",
        "- epoch: Day number since Unix epoch (prevents replay attacks)",
        "- data_hash: Hash of private data (ensures data integrity)"
      ],
      "discriminator": [
        148,
        43,
        225,
        77,
        15,
        134,
        217,
        54
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "verifierAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "verifier_account.verifier",
                "account": "verifierAccount"
              }
            ]
          }
        },
        {
          "name": "nullifierAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "arg",
                "path": "nullifier"
              }
            ]
          }
        },
        {
          "name": "rateLimit",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  114,
                  97,
                  116,
                  101,
                  95,
                  108,
                  105,
                  109,
                  105,
                  116
                ]
              },
              {
                "kind": "account",
                "path": "recipient"
              }
            ]
          }
        },
        {
          "name": "recipient",
          "docs": [
            "The wallet receiving the credential"
          ]
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "instructionsSysvar",
          "docs": [
            "Instructions sysvar for Ed25519 signature verification"
          ],
          "address": "Sysvar1nstructions1111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "attestationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "proofTypeValue",
          "type": "u8"
        },
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "epoch",
          "type": "u64"
        },
        {
          "name": "dataHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          }
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          }
        }
      ]
    },
    {
      "name": "registerForAirdrop",
      "docs": [
        "Register for an airdrop campaign using a verified Vouch credential",
        "Gets base_amount + bonus (dev_bonus or whale_bonus based on credential)",
        "Links the user's nullifier to their ShadowWire address for private distribution"
      ],
      "discriminator": [
        165,
        43,
        118,
        222,
        66,
        37,
        79,
        178
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "nullifierAccount",
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  110,
                  117,
                  108,
                  108,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "nullifier_account.nullifier",
                "account": "nullifierAccount"
              }
            ]
          }
        },
        {
          "name": "registration",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "nullifier_account.nullifier",
                "account": "nullifierAccount"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "shadowWireAddress",
          "type": "string"
        }
      ]
    },
    {
      "name": "registerForAirdropOpen",
      "docs": [
        "Register for an airdrop campaign without verification (open registration)",
        "Gets only base_amount (no bonus)",
        "Uses wallet pubkey hash as unique identifier to prevent double registration"
      ],
      "discriminator": [
        111,
        225,
        229,
        73,
        34,
        45,
        222,
        212
      ],
      "accounts": [
        {
          "name": "campaign",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  99,
                  97,
                  109,
                  112,
                  97,
                  105,
                  103,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign.campaign_id",
                "account": "airdropCampaign"
              }
            ]
          }
        },
        {
          "name": "registration",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  97,
                  105,
                  114,
                  100,
                  114,
                  111,
                  112,
                  95,
                  114,
                  101,
                  103,
                  105,
                  115,
                  116,
                  114,
                  97,
                  116,
                  105,
                  111,
                  110
                ]
              },
              {
                "kind": "account",
                "path": "campaign"
              },
              {
                "kind": "account",
                "path": "payer"
              }
            ]
          }
        },
        {
          "name": "payer",
          "writable": true,
          "signer": true
        },
        {
          "name": "systemProgram",
          "address": "11111111111111111111111111111111"
        }
      ],
      "args": [
        {
          "name": "shadowWireAddress",
          "type": "string"
        }
      ]
    },
    {
      "name": "removeVerifier",
      "docs": [
        "Remove an authorized verifier"
      ],
      "discriminator": [
        179,
        9,
        132,
        183,
        233,
        23,
        172,
        111
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "verifierAccount",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  118,
                  101,
                  114,
                  105,
                  102,
                  105,
                  101,
                  114
                ]
              },
              {
                "kind": "account",
                "path": "verifier_account.verifier",
                "account": "verifierAccount"
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "transferAdmin",
      "docs": [
        "Transfer admin authority to a new address",
        "Only current admin can call this"
      ],
      "discriminator": [
        42,
        242,
        66,
        106,
        228,
        10,
        111,
        156
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "pubkey"
        }
      ]
    },
    {
      "name": "unpauseProtocol",
      "docs": [
        "Unpause the protocol (resume operations)",
        "Only pause_authority can call this"
      ],
      "discriminator": [
        183,
        154,
        5,
        183,
        105,
        76,
        87,
        18
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": []
    },
    {
      "name": "updateRateLimits",
      "docs": [
        "Update rate limit configuration",
        "Only admin can call this"
      ],
      "discriminator": [
        247,
        36,
        121,
        254,
        22,
        16,
        226,
        1
      ],
      "accounts": [
        {
          "name": "config",
          "writable": true,
          "pda": {
            "seeds": [
              {
                "kind": "const",
                "value": [
                  99,
                  111,
                  110,
                  102,
                  105,
                  103
                ]
              }
            ]
          }
        },
        {
          "name": "admin",
          "writable": true,
          "signer": true
        }
      ],
      "args": [
        {
          "name": "maxProofsPerDay",
          "type": "u32"
        },
        {
          "name": "cooldownSeconds",
          "type": "i64"
        }
      ]
    }
  ],
  "accounts": [
    {
      "name": "airdropCampaign",
      "discriminator": [
        235,
        102,
        51,
        70,
        37,
        179,
        248,
        13
      ]
    },
    {
      "name": "airdropRegistrationAccount",
      "discriminator": [
        201,
        136,
        215,
        80,
        195,
        228,
        3,
        44
      ]
    },
    {
      "name": "commitmentAccount",
      "discriminator": [
        155,
        206,
        108,
        147,
        168,
        110,
        100,
        181
      ]
    },
    {
      "name": "configAccount",
      "discriminator": [
        189,
        255,
        97,
        70,
        186,
        189,
        24,
        102
      ]
    },
    {
      "name": "nullifierAccount",
      "discriminator": [
        250,
        31,
        238,
        177,
        213,
        98,
        48,
        172
      ]
    },
    {
      "name": "verifierAccount",
      "discriminator": [
        81,
        120,
        248,
        87,
        107,
        174,
        58,
        157
      ]
    },
    {
      "name": "walletRateLimit",
      "discriminator": [
        38,
        240,
        43,
        94,
        91,
        36,
        101,
        179
      ]
    }
  ],
  "events": [
    {
      "name": "adminTransferred",
      "discriminator": [
        255,
        147,
        182,
        5,
        199,
        217,
        38,
        179
      ]
    },
    {
      "name": "airdropCampaignCompleted",
      "discriminator": [
        186,
        127,
        220,
        41,
        180,
        108,
        224,
        1
      ]
    },
    {
      "name": "airdropCampaignCreated",
      "discriminator": [
        14,
        65,
        106,
        129,
        21,
        122,
        161,
        18
      ]
    },
    {
      "name": "airdropCampaignFunded",
      "discriminator": [
        76,
        62,
        77,
        52,
        243,
        202,
        108,
        242
      ]
    },
    {
      "name": "airdropClaimed",
      "discriminator": [
        125,
        251,
        195,
        183,
        202,
        126,
        89,
        68
      ]
    },
    {
      "name": "airdropDistributed",
      "discriminator": [
        150,
        40,
        93,
        36,
        137,
        4,
        173,
        131
      ]
    },
    {
      "name": "airdropRegistration",
      "discriminator": [
        213,
        182,
        106,
        29,
        31,
        253,
        128,
        201
      ]
    },
    {
      "name": "airdropRegistrationClosed",
      "discriminator": [
        149,
        90,
        172,
        193,
        234,
        84,
        243,
        184
      ]
    },
    {
      "name": "attestationRecorded",
      "discriminator": [
        207,
        97,
        52,
        58,
        217,
        238,
        97,
        21
      ]
    },
    {
      "name": "commitmentCreated",
      "discriminator": [
        179,
        58,
        10,
        188,
        241,
        19,
        191,
        229
      ]
    },
    {
      "name": "configInitialized",
      "discriminator": [
        181,
        49,
        200,
        156,
        19,
        167,
        178,
        91
      ]
    },
    {
      "name": "protocolPaused",
      "discriminator": [
        35,
        111,
        245,
        138,
        237,
        199,
        79,
        223
      ]
    },
    {
      "name": "protocolUnpaused",
      "discriminator": [
        248,
        204,
        112,
        239,
        72,
        67,
        127,
        216
      ]
    },
    {
      "name": "rateLimitInitialized",
      "discriminator": [
        220,
        98,
        146,
        167,
        68,
        140,
        70,
        158
      ]
    },
    {
      "name": "rateLimitsUpdated",
      "discriminator": [
        32,
        232,
        72,
        132,
        73,
        25,
        219,
        10
      ]
    },
    {
      "name": "verifierAdded",
      "discriminator": [
        113,
        131,
        132,
        161,
        53,
        64,
        96,
        78
      ]
    },
    {
      "name": "verifierRemoved",
      "discriminator": [
        87,
        0,
        8,
        47,
        151,
        131,
        51,
        99
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "invalidProofType",
      "msg": "Invalid proof type"
    },
    {
      "code": 6001,
      "name": "nullifierAlreadyUsed",
      "msg": "Nullifier has already been used"
    },
    {
      "code": 6002,
      "name": "commitmentNotFound",
      "msg": "Commitment not found"
    },
    {
      "code": 6003,
      "name": "invalidCommitment",
      "msg": "Invalid commitment"
    },
    {
      "code": 6004,
      "name": "unauthorized",
      "msg": "unauthorized"
    },
    {
      "code": 6005,
      "name": "verifierNotAuthorized",
      "msg": "Verifier not authorized"
    },
    {
      "code": 6006,
      "name": "invalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6007,
      "name": "protocolPaused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6008,
      "name": "notPaused",
      "msg": "Protocol is not paused"
    },
    {
      "code": 6009,
      "name": "alreadyPaused",
      "msg": "Protocol is already paused"
    },
    {
      "code": 6010,
      "name": "rateLimitCooldown",
      "msg": "Rate limit cooldown not elapsed"
    },
    {
      "code": 6011,
      "name": "dailyRateLimitExceeded",
      "msg": "Daily rate limit exceeded"
    },
    {
      "code": 6012,
      "name": "invalidRateLimit",
      "msg": "Invalid rate limit configuration"
    },
    {
      "code": 6013,
      "name": "overflow",
      "msg": "Arithmetic overflow"
    },
    {
      "code": 6014,
      "name": "epochTooOld",
      "msg": "Proof epoch is too old (replay attack prevention)"
    },
    {
      "code": 6015,
      "name": "epochInFuture",
      "msg": "Proof epoch is in the future (clock manipulation)"
    },
    {
      "code": 6016,
      "name": "nameTooLong",
      "msg": "Campaign name too long (max 64 chars)"
    },
    {
      "code": 6017,
      "name": "invalidDeadline",
      "msg": "Registration deadline must be in the future"
    },
    {
      "code": 6018,
      "name": "invalidAmount",
      "msg": "Amount must be greater than zero"
    },
    {
      "code": 6019,
      "name": "campaignNotOpen",
      "msg": "Campaign is not open for registration"
    },
    {
      "code": 6020,
      "name": "registrationClosed",
      "msg": "Campaign registration period has closed"
    },
    {
      "code": 6021,
      "name": "nullifierNotVerified",
      "msg": "Nullifier has not been verified (no Vouch credential)"
    },
    {
      "code": 6022,
      "name": "invalidShadowWireAddress",
      "msg": "Invalid ShadowWire address format"
    },
    {
      "code": 6023,
      "name": "alreadyDistributed",
      "msg": "Airdrop has already been distributed to this registration"
    },
    {
      "code": 6024,
      "name": "campaignNotClosed",
      "msg": "Campaign must be closed before completing"
    },
    {
      "code": 6025,
      "name": "invalidCampaign",
      "msg": "Registration does not belong to this campaign"
    },
    {
      "code": 6026,
      "name": "insufficientFunds",
      "msg": "Insufficient funds in campaign vault"
    },
    {
      "code": 6027,
      "name": "alreadyClaimed",
      "msg": "Airdrop has already been claimed"
    },
    {
      "code": 6028,
      "name": "invalidMint",
      "msg": "Token mint does not match campaign"
    }
  ],
  "types": [
    {
      "name": "adminTransferred",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "oldAdmin",
            "type": "pubkey"
          },
          {
            "name": "newAdmin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropCampaign",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "docs": [
              "Unique campaign identifier (hash)"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "creator",
            "docs": [
              "Campaign creator (project distributing tokens)"
            ],
            "type": "pubkey"
          },
          {
            "name": "name",
            "docs": [
              "Human-readable campaign name"
            ],
            "type": "string"
          },
          {
            "name": "tokenMint",
            "docs": [
              "Token mint for the airdrop"
            ],
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "docs": [
              "Base amount for anyone (tiered: open registration)"
            ],
            "type": "u64"
          },
          {
            "name": "devBonus",
            "docs": [
              "Bonus amount for verified developers (gets base + dev_bonus)"
            ],
            "type": "u64"
          },
          {
            "name": "whaleBonus",
            "docs": [
              "Bonus amount for verified whales (gets base + whale_bonus)"
            ],
            "type": "u64"
          },
          {
            "name": "registrationDeadline",
            "docs": [
              "Registration deadline (unix timestamp)"
            ],
            "type": "i64"
          },
          {
            "name": "status",
            "docs": [
              "Campaign status"
            ],
            "type": {
              "defined": {
                "name": "campaignStatus"
              }
            }
          },
          {
            "name": "totalRegistrations",
            "docs": [
              "Total number of registrations"
            ],
            "type": "u32"
          },
          {
            "name": "openRegistrations",
            "docs": [
              "Number of open (unverified) registrations"
            ],
            "type": "u32"
          },
          {
            "name": "devRegistrations",
            "docs": [
              "Number of developer registrations"
            ],
            "type": "u32"
          },
          {
            "name": "whaleRegistrations",
            "docs": [
              "Number of whale registrations"
            ],
            "type": "u32"
          },
          {
            "name": "createdAt",
            "docs": [
              "Campaign creation timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "completedAt",
            "docs": [
              "Campaign completion timestamp (0 if not completed)"
            ],
            "type": "i64"
          },
          {
            "name": "vaultBalance",
            "docs": [
              "Current vault balance (tokens available for claims)"
            ],
            "type": "u64"
          },
          {
            "name": "totalClaimed",
            "docs": [
              "Total number of claims made"
            ],
            "type": "u32"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "airdropCampaignCompleted",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalDistributed",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropCampaignCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "creator",
            "type": "pubkey"
          },
          {
            "name": "name",
            "type": "string"
          },
          {
            "name": "tokenMint",
            "type": "pubkey"
          },
          {
            "name": "baseAmount",
            "type": "u64"
          },
          {
            "name": "devBonus",
            "type": "u64"
          },
          {
            "name": "whaleBonus",
            "type": "u64"
          },
          {
            "name": "registrationDeadline",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropCampaignFunded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "funder",
            "type": "pubkey"
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "totalFunded",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropClaimed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "claimer",
            "type": "pubkey"
          },
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "amount",
            "type": "u64"
          },
          {
            "name": "proofType",
            "type": {
              "defined": {
                "name": "proofType"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropDistributed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "shadowWireAddress",
            "type": "string"
          },
          {
            "name": "txSignature",
            "type": "string"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropRegistration",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "shadowWireAddress",
            "type": "string"
          },
          {
            "name": "proofType",
            "type": {
              "defined": {
                "name": "proofType"
              }
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "airdropRegistrationAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaign",
            "docs": [
              "Campaign this registration belongs to"
            ],
            "type": "pubkey"
          },
          {
            "name": "nullifier",
            "docs": [
              "Nullifier from the Vouch credential"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "shadowWireAddress",
            "docs": [
              "User's ShadowWire address for private receipt"
            ],
            "type": "string"
          },
          {
            "name": "proofType",
            "docs": [
              "Type of credential (dev or whale)"
            ],
            "type": {
              "defined": {
                "name": "proofType"
              }
            }
          },
          {
            "name": "registeredAt",
            "docs": [
              "Registration timestamp"
            ],
            "type": "i64"
          },
          {
            "name": "isDistributed",
            "docs": [
              "Whether tokens have been distributed (ShadowWire flow)"
            ],
            "type": "bool"
          },
          {
            "name": "distributedAt",
            "docs": [
              "Distribution timestamp (0 if not distributed)"
            ],
            "type": "i64"
          },
          {
            "name": "distributionTx",
            "docs": [
              "Distribution transaction signature"
            ],
            "type": "string"
          },
          {
            "name": "isClaimed",
            "docs": [
              "Whether tokens have been claimed (direct claim flow)"
            ],
            "type": "bool"
          },
          {
            "name": "claimedAt",
            "docs": [
              "Claim timestamp (0 if not claimed)"
            ],
            "type": "i64"
          },
          {
            "name": "claimedAmount",
            "docs": [
              "Amount of tokens claimed"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "airdropRegistrationClosed",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "campaignId",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "totalRegistrations",
            "type": "u32"
          },
          {
            "name": "devRegistrations",
            "type": "u32"
          },
          {
            "name": "whaleRegistrations",
            "type": "u32"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "attestationRecorded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "attestationHash",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch (day number) when proof was generated"
            ],
            "type": "u64"
          },
          {
            "name": "dataHash",
            "docs": [
              "Hash of private data for integrity verification"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "proofType",
            "type": {
              "defined": {
                "name": "proofType"
              }
            }
          },
          {
            "name": "recipient",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          },
          {
            "name": "signature",
            "type": {
              "array": [
                "u8",
                64
              ]
            }
          }
        ]
      }
    },
    {
      "name": "campaignStatus",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "open"
          },
          {
            "name": "registrationClosed"
          },
          {
            "name": "completed"
          }
        ]
      }
    },
    {
      "name": "commitmentAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "createdAt",
            "type": "i64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "commitmentCreated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "owner",
            "type": "pubkey"
          },
          {
            "name": "commitment",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "configAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Protocol admin with full control"
            ],
            "type": "pubkey"
          },
          {
            "name": "pauseAuthority",
            "docs": [
              "Authority that can pause/unpause (initially same as admin)"
            ],
            "type": "pubkey"
          },
          {
            "name": "verifierCount",
            "docs": [
              "Number of active verifiers"
            ],
            "type": "u32"
          },
          {
            "name": "isPaused",
            "docs": [
              "Whether the protocol is paused"
            ],
            "type": "bool"
          },
          {
            "name": "maxProofsPerDay",
            "docs": [
              "Maximum proofs per wallet per day"
            ],
            "type": "u32"
          },
          {
            "name": "cooldownSeconds",
            "docs": [
              "Cooldown seconds between proofs"
            ],
            "type": "i64"
          },
          {
            "name": "maxEpochAge",
            "docs": [
              "Maximum age of epoch in days (proofs older than this are rejected)"
            ],
            "type": "u64"
          },
          {
            "name": "totalProofsVerified",
            "docs": [
              "Total proofs verified across all wallets"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "configInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "maxProofsPerDay",
            "type": "u32"
          },
          {
            "name": "cooldownSeconds",
            "type": "i64"
          },
          {
            "name": "maxEpochAge",
            "type": "u64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "nullifierAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "nullifier",
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "isUsed",
            "type": "bool"
          },
          {
            "name": "usedAt",
            "type": "i64"
          },
          {
            "name": "epoch",
            "docs": [
              "Epoch (day number) when proof was generated - prevents replay attacks"
            ],
            "type": "u64"
          },
          {
            "name": "dataHash",
            "docs": [
              "Hash of private data - ensures data integrity"
            ],
            "type": {
              "array": [
                "u8",
                32
              ]
            }
          },
          {
            "name": "proofType",
            "type": {
              "defined": {
                "name": "proofType"
              }
            }
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "proofType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "unset"
          },
          {
            "name": "developerReputation"
          },
          {
            "name": "whaleTrading"
          }
        ]
      }
    },
    {
      "name": "protocolPaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "protocolUnpaused",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rateLimitInitialized",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "rateLimitsUpdated",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "oldMaxProofsPerDay",
            "type": "u32"
          },
          {
            "name": "newMaxProofsPerDay",
            "type": "u32"
          },
          {
            "name": "oldCooldownSeconds",
            "type": "i64"
          },
          {
            "name": "newCooldownSeconds",
            "type": "i64"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifierAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "isActive",
            "type": "bool"
          },
          {
            "name": "addedAt",
            "type": "i64"
          },
          {
            "name": "attestationCount",
            "type": "u64"
          },
          {
            "name": "bump",
            "type": "u8"
          }
        ]
      }
    },
    {
      "name": "verifierAdded",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "verifierRemoved",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "pubkey"
          },
          {
            "name": "admin",
            "type": "pubkey"
          },
          {
            "name": "timestamp",
            "type": "i64"
          }
        ]
      }
    },
    {
      "name": "walletRateLimit",
      "docs": [
        "Rate limit tracking per wallet"
      ],
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "wallet",
            "docs": [
              "The wallet being rate limited"
            ],
            "type": "pubkey"
          },
          {
            "name": "proofsToday",
            "docs": [
              "Number of proofs submitted today"
            ],
            "type": "u32"
          },
          {
            "name": "lastProofAt",
            "docs": [
              "Timestamp of last proof submission"
            ],
            "type": "i64"
          },
          {
            "name": "dayStart",
            "docs": [
              "Start of current day (for daily reset)"
            ],
            "type": "i64"
          },
          {
            "name": "totalProofs",
            "docs": [
              "Total proofs ever submitted by this wallet"
            ],
            "type": "u64"
          },
          {
            "name": "bump",
            "docs": [
              "PDA bump"
            ],
            "type": "u8"
          }
        ]
      }
    }
  ]
};
