export type VouchVerifier = {
  "version": "0.1.0",
  "name": "vouch_verifier",
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
      "name": "initializeConfig",
      "docs": [
        "Initialize the protocol configuration",
        "Must be called once by the deployer"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "pauseProtocol",
      "docs": [
        "Pause the protocol (emergency stop)",
        "Only pause_authority can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    },
    {
      "name": "unpauseProtocol",
      "docs": [
        "Unpause the protocol (resume operations)",
        "Only pause_authority can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
    },
    {
      "name": "transferAdmin",
      "docs": [
        "Transfer admin authority to a new address",
        "Only current admin can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "initRateLimit",
      "docs": [
        "Initialize rate limit tracking for a wallet",
        "Creates a WalletRateLimit PDA for the wallet"
      ],
      "accounts": [
        {
          "name": "rateLimit",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "wallet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addVerifier",
      "docs": [
        "Add an authorized verifier",
        "Only admin can add verifiers"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "verifierPubkey",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "removeVerifier",
      "docs": [
        "Remove an authorized verifier"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
        "4. On-chain program validates signature and records result"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nullifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rateLimit",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "The wallet receiving the credential"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "instructionsSysvar",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Instructions sysvar for Ed25519 signature verification"
          ]
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
      "name": "createCommitment",
      "docs": [
        "Initialize a new commitment for a wallet",
        "The commitment = hash(wallet_pubkey + secret) is stored on-chain"
      ],
      "accounts": [
        {
          "name": "commitmentAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "initNullifier",
      "docs": [
        "Initialize a nullifier account (must be called before verify)",
        "This separates account creation from verification for security"
      ],
      "accounts": [
        {
          "name": "nullifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
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
    }
  ],
  "accounts": [
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
            "type": "publicKey"
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
      "name": "configAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Protocol admin with full control"
            ],
            "type": "publicKey"
          },
          {
            "name": "pauseAuthority",
            "docs": [
              "Authority that can pause/unpause (initially same as admin)"
            ],
            "type": "publicKey"
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
            "name": "proofType",
            "type": {
              "defined": "ProofType"
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
      "name": "verifierAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "publicKey"
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
            "type": "publicKey"
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
  ],
  "types": [
    {
      "name": "ProofType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unset"
          },
          {
            "name": "DeveloperReputation"
          },
          {
            "name": "WhaleTrading"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "AdminTransferred",
      "fields": [
        {
          "name": "oldAdmin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "newAdmin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "AttestationRecorded",
      "fields": [
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "attestationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "proofType",
          "type": {
            "defined": "ProofType"
          },
          "index": false
        },
        {
          "name": "recipient",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          },
          "index": false
        }
      ]
    },
    {
      "name": "CommitmentCreated",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "commitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ConfigInitialized",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "maxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "cooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ProtocolPaused",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ProtocolUnpaused",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "RateLimitInitialized",
      "fields": [
        {
          "name": "wallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "RateLimitsUpdated",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "oldMaxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "newMaxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "oldCooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "newCooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "VerifierAdded",
      "fields": [
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "VerifierRemoved",
      "fields": [
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidProofType",
      "msg": "Invalid proof type"
    },
    {
      "code": 6001,
      "name": "NullifierAlreadyUsed",
      "msg": "Nullifier has already been used"
    },
    {
      "code": 6002,
      "name": "CommitmentNotFound",
      "msg": "Commitment not found"
    },
    {
      "code": 6003,
      "name": "InvalidCommitment",
      "msg": "Invalid commitment"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6005,
      "name": "VerifierNotAuthorized",
      "msg": "Verifier not authorized"
    },
    {
      "code": 6006,
      "name": "InvalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6007,
      "name": "ProtocolPaused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6008,
      "name": "NotPaused",
      "msg": "Protocol is not paused"
    },
    {
      "code": 6009,
      "name": "AlreadyPaused",
      "msg": "Protocol is already paused"
    },
    {
      "code": 6010,
      "name": "RateLimitCooldown",
      "msg": "Rate limit cooldown not elapsed"
    },
    {
      "code": 6011,
      "name": "DailyRateLimitExceeded",
      "msg": "Daily rate limit exceeded"
    },
    {
      "code": 6012,
      "name": "InvalidRateLimit",
      "msg": "Invalid rate limit configuration"
    },
    {
      "code": 6013,
      "name": "Overflow",
      "msg": "Arithmetic overflow"
    }
  ]
};

export const IDL: VouchVerifier = {
  "version": "0.1.0",
  "name": "vouch_verifier",
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
      "name": "initializeConfig",
      "docs": [
        "Initialize the protocol configuration",
        "Must be called once by the deployer"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "pauseProtocol",
      "docs": [
        "Pause the protocol (emergency stop)",
        "Only pause_authority can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": []
    },
    {
      "name": "unpauseProtocol",
      "docs": [
        "Unpause the protocol (resume operations)",
        "Only pause_authority can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
    },
    {
      "name": "transferAdmin",
      "docs": [
        "Transfer admin authority to a new address",
        "Only current admin can call this"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        }
      ],
      "args": [
        {
          "name": "newAdmin",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "initRateLimit",
      "docs": [
        "Initialize rate limit tracking for a wallet",
        "Creates a WalletRateLimit PDA for the wallet"
      ],
      "accounts": [
        {
          "name": "rateLimit",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "wallet",
          "isMut": false,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": []
    },
    {
      "name": "addVerifier",
      "docs": [
        "Add an authorized verifier",
        "Only admin can add verifiers"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
        }
      ],
      "args": [
        {
          "name": "verifierPubkey",
          "type": "publicKey"
        }
      ]
    },
    {
      "name": "removeVerifier",
      "docs": [
        "Remove an authorized verifier"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "admin",
          "isMut": true,
          "isSigner": true
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
        "4. On-chain program validates signature and records result"
      ],
      "accounts": [
        {
          "name": "config",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "verifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "nullifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "rateLimit",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "recipient",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "The wallet receiving the credential"
          ]
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "instructionsSysvar",
          "isMut": false,
          "isSigner": false,
          "docs": [
            "Instructions sysvar for Ed25519 signature verification"
          ]
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
      "name": "createCommitment",
      "docs": [
        "Initialize a new commitment for a wallet",
        "The commitment = hash(wallet_pubkey + secret) is stored on-chain"
      ],
      "accounts": [
        {
          "name": "commitmentAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "owner",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
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
      "name": "initNullifier",
      "docs": [
        "Initialize a nullifier account (must be called before verify)",
        "This separates account creation from verification for security"
      ],
      "accounts": [
        {
          "name": "nullifierAccount",
          "isMut": true,
          "isSigner": false
        },
        {
          "name": "payer",
          "isMut": true,
          "isSigner": true
        },
        {
          "name": "systemProgram",
          "isMut": false,
          "isSigner": false
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
    }
  ],
  "accounts": [
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
            "type": "publicKey"
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
      "name": "configAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "admin",
            "docs": [
              "Protocol admin with full control"
            ],
            "type": "publicKey"
          },
          {
            "name": "pauseAuthority",
            "docs": [
              "Authority that can pause/unpause (initially same as admin)"
            ],
            "type": "publicKey"
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
            "name": "proofType",
            "type": {
              "defined": "ProofType"
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
      "name": "verifierAccount",
      "type": {
        "kind": "struct",
        "fields": [
          {
            "name": "verifier",
            "type": "publicKey"
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
            "type": "publicKey"
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
  ],
  "types": [
    {
      "name": "ProofType",
      "type": {
        "kind": "enum",
        "variants": [
          {
            "name": "Unset"
          },
          {
            "name": "DeveloperReputation"
          },
          {
            "name": "WhaleTrading"
          }
        ]
      }
    }
  ],
  "events": [
    {
      "name": "AdminTransferred",
      "fields": [
        {
          "name": "oldAdmin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "newAdmin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "AttestationRecorded",
      "fields": [
        {
          "name": "nullifier",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "attestationHash",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "proofType",
          "type": {
            "defined": "ProofType"
          },
          "index": false
        },
        {
          "name": "recipient",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        },
        {
          "name": "signature",
          "type": {
            "array": [
              "u8",
              64
            ]
          },
          "index": false
        }
      ]
    },
    {
      "name": "CommitmentCreated",
      "fields": [
        {
          "name": "owner",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "commitment",
          "type": {
            "array": [
              "u8",
              32
            ]
          },
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ConfigInitialized",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "maxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "cooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ProtocolPaused",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "ProtocolUnpaused",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "RateLimitInitialized",
      "fields": [
        {
          "name": "wallet",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "RateLimitsUpdated",
      "fields": [
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "oldMaxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "newMaxProofsPerDay",
          "type": "u32",
          "index": false
        },
        {
          "name": "oldCooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "newCooldownSeconds",
          "type": "i64",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "VerifierAdded",
      "fields": [
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    },
    {
      "name": "VerifierRemoved",
      "fields": [
        {
          "name": "verifier",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "admin",
          "type": "publicKey",
          "index": false
        },
        {
          "name": "timestamp",
          "type": "i64",
          "index": false
        }
      ]
    }
  ],
  "errors": [
    {
      "code": 6000,
      "name": "InvalidProofType",
      "msg": "Invalid proof type"
    },
    {
      "code": 6001,
      "name": "NullifierAlreadyUsed",
      "msg": "Nullifier has already been used"
    },
    {
      "code": 6002,
      "name": "CommitmentNotFound",
      "msg": "Commitment not found"
    },
    {
      "code": 6003,
      "name": "InvalidCommitment",
      "msg": "Invalid commitment"
    },
    {
      "code": 6004,
      "name": "Unauthorized",
      "msg": "Unauthorized"
    },
    {
      "code": 6005,
      "name": "VerifierNotAuthorized",
      "msg": "Verifier not authorized"
    },
    {
      "code": 6006,
      "name": "InvalidSignature",
      "msg": "Invalid signature"
    },
    {
      "code": 6007,
      "name": "ProtocolPaused",
      "msg": "Protocol is paused"
    },
    {
      "code": 6008,
      "name": "NotPaused",
      "msg": "Protocol is not paused"
    },
    {
      "code": 6009,
      "name": "AlreadyPaused",
      "msg": "Protocol is already paused"
    },
    {
      "code": 6010,
      "name": "RateLimitCooldown",
      "msg": "Rate limit cooldown not elapsed"
    },
    {
      "code": 6011,
      "name": "DailyRateLimitExceeded",
      "msg": "Daily rate limit exceeded"
    },
    {
      "code": 6012,
      "name": "InvalidRateLimit",
      "msg": "Invalid rate limit configuration"
    },
    {
      "code": 6013,
      "name": "Overflow",
      "msg": "Arithmetic overflow"
    }
  ]
};
