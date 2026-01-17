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
        "4. On-chain program validates signature and records result"
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
