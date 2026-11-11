//! HEX [PI] call ledger on NEAR.
//!
//! Every call HEX [PI] makes is committed here as a SHA-256 hash before its
//! outcome can exist, and revealed after. The contract enforces the order:
//!
//! - `commit` is refused unless the block time is before the call's declared
//!   outcome time (`outcome_after`).
//! - `reveal` is refused before `outcome_after`, and refused unless
//!   sha256(salt + ":" + call) equals the committed hash.
//!
//! The declared outcome time is public, so anyone can check it against the
//! real data (for a daily series, the close of the bar the call is scored on).
//! Commits that are never revealed stay visible as pending, so a source that
//! reveals only its good calls is visible as one.
//!
//! The contract records; it never makes, changes or scores a call.

use near_sdk::json_types::U64;
use near_sdk::store::{LookupMap, Vector};
use near_sdk::{env, near, require, AccountId, BorshStorageKey, PanicOnDefault};

/// What is known when the call is committed.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Commitment {
    /// Lowercase hex SHA-256 of `salt + ":" + call`.
    pub hash: String,
    /// The earliest moment the outcome can exist, in nanoseconds since the Unix epoch.
    pub outcome_after: U64,
    /// Block time of the commit, in nanoseconds since the Unix epoch.
    pub committed_at: U64,
    pub committed_height: U64,
    pub reveal: Option<Reveal>,
}

/// What is added once the outcome exists.
#[near(serializers = [json, borsh])]
#[derive(Clone, Debug, PartialEq)]
pub struct Reveal {
    /// The call exactly as it was hashed (canonical JSON from the bridge).
    pub call: String,
    pub salt: String,
    /// The outcome as recorded by HEX [PI] (JSON from the bridge).
    pub outcome: String,
    pub revealed_at: U64,
}

#[near(serializers = [json])]
pub struct CommitInput {
    pub id: String,
    pub hash: String,
    pub outcome_after: U64,
}

#[near(serializers = [json])]
pub struct RevealInput {
    pub id: String,
    pub call: String,
    pub salt: String,
    pub outcome: String,
}

#[near(serializers = [json])]
pub struct Entry {
    pub id: String,
    pub commitment: Commitment,
}

#[near(serializers = [json])]
pub struct Stats {
    pub committed: u64,
    pub revealed: u64,
    /// Committed and not yet revealed, whether or not the outcome time has passed.
    pub pending: u64,
}

#[derive(BorshStorageKey)]
#[near]
enum Key {
    Calls,
    Order,
}

const MAX_ID: usize = 200;
const MAX_TEXT: usize = 4_000;
const MAX_BATCH: usize = 100;

#[near(contract_state)]
#[derive(PanicOnDefault)]
pub struct Ledger {
    owner: AccountId,
    calls: LookupMap<String, Commitment>,
    order: Vector<String>,
    revealed: u64,
}

#[near]
impl Ledger {
    /// `owner` is the only account that may commit and reveal: the account HEX [PI] writes from.
    #[init]
    pub fn new(owner: AccountId) -> Self {
        Self { owner, calls: LookupMap::new(Key::Calls), order: Vector::new(Key::Order), revealed: 0 }
    }

    // ---- writes (owner only) ------------------------------------------------

    pub fn commit(&mut self, id: String, hash: String, outcome_after: U64) {
        self.only_owner();
        self.commit_one(id, hash, outcome_after);
    }

    /// One night's calls in one transaction. All or nothing.
    pub fn commit_batch(&mut self, calls: Vec<CommitInput>) {
        self.only_owner();
        require!(!calls.is_empty() && calls.len() <= MAX_BATCH, "batch must hold 1 to 100 calls");
        for c in calls {
            self.commit_one(c.id, c.hash, c.outcome_after);
        }
    }

    pub fn reveal(&mut self, id: String, call: String, salt: String, outcome: String) {
        self.only_owner();
        self.reveal_one(id, call, salt, outcome);
    }

    pub fn reveal_batch(&mut self, calls: Vec<RevealInput>) {
        self.only_owner();
        require!(!calls.is_empty() && calls.len() <= MAX_BATCH, "batch must hold 1 to 100 calls");
        for c in calls {
            self.reveal_one(c.id, c.call, c.salt, c.outcome);
        }
    }

    // ---- reads (anyone) -----------------------------------------------------

    pub fn owner(&self) -> AccountId {
        self.owner.clone()
    }

    pub fn get_call(&self, id: String) -> Option<Commitment> {
        self.calls.get(&id).cloned()
    }

    /// Calls in the order they were committed.
    pub fn get_calls(&self, from_index: u64, limit: u64) -> Vec<Entry> {
        let n = self.order.len() as u64;
        let end = from_index.saturating_add(limit.min(100)).min(n);
        (from_index.min(n)..end)
            .filter_map(|i| {
                let id = self.order.get(i as u32)?.clone();
                let commitment = self.calls.get(&id)?.clone();
                Some(Entry { id, commitment })
            })
            .collect()
    }

    pub fn stats(&self) -> Stats {
        let committed = self.order.len() as u64;
        Stats { committed, revealed: self.revealed, pending: committed - self.revealed }
    }

    // ---- internals ----------------------------------------------------------

    fn only_owner(&self) {
        require!(env::predecessor_account_id() == self.owner, "only the owner may write");
    }

    fn commit_one(&mut self, id: String, hash: String, outcome_after: U64) {
        require!(!id.is_empty() && id.len() <= MAX_ID, "id must be 1 to 200 characters");
        require!(is_hex_sha256(&hash), "hash must be 64 lowercase hex characters");
        require!(!self.calls.contains_key(&id), "this call is already committed");
        let now = env::block_timestamp();
        require!(now < outcome_after.0, "too late: the outcome time has already passed");
        self.calls.insert(
            id.clone(),
            Commitment {
                hash,
                outcome_after,
                committed_at: U64(now),
                committed_height: U64(env::block_height()),
                reveal: None,
            },
        );
        self.order.push(id);
    }

    fn reveal_one(&mut self, id: String, call: String, salt: String, outcome: String) {
        require!(call.len() <= MAX_TEXT && outcome.len() <= MAX_TEXT && salt.len() <= 128, "reveal too large");
        let mut c = self.calls.get(&id).cloned().unwrap_or_else(|| env::panic_str("no such call"));
        require!(c.reveal.is_none(), "this call is already revealed");
        let now = env::block_timestamp();
        require!(now >= c.outcome_after.0, "too early: the outcome time has not passed");
        let preimage = format!("{salt}:{call}");
        require!(to_hex(&env::sha256(preimage.as_bytes())) == c.hash, "reveal does not match the committed hash");
        c.reveal = Some(Reveal { call, salt, outcome, revealed_at: U64(now) });
        self.calls.insert(id, c);
        self.revealed += 1;
    }
}

fn is_hex_sha256(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

fn to_hex(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut s = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        s.push(HEX[(b >> 4) as usize] as char);
        s.push(HEX[(b & 0xf) as usize] as char);
    }
    s
}

#[cfg(test)]
mod tests;
