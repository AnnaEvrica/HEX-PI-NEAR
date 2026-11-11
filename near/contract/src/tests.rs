use super::*;
use near_sdk::test_utils::{accounts, VMContextBuilder};
use near_sdk::testing_env;
use sha2::{Digest, Sha256};

const DAY: u64 = 86_400_000_000_000; // one day in nanoseconds

fn hash_of(salt: &str, call: &str) -> String {
    hex::encode(Sha256::digest(format!("{salt}:{call}").as_bytes()))
}

fn at(who: AccountId, time: u64) {
    testing_env!(VMContextBuilder::new().predecessor_account_id(who).block_timestamp(time).build());
}

fn ledger() -> Ledger {
    at(accounts(0), DAY);
    Ledger::new(accounts(0))
}

const CALL: &str = r#"{"engine":"hex7","probability":0.61,"read":"MOVE","series_id":"CHI-TEMP"}"#;
const SALT: &str = "4f2a9c";

/// near/bridge/commitment.test.mjs pins the same vector, so the bridge and the
/// contract are held to one preimage format.
#[test]
fn hash_vector_matches_the_bridge() {
    let expected = "3d619ffa053c255cb924b2be09a10366b142d99001815e7321d1388794ad15c6";
    assert_eq!(hash_of(SALT, CALL), expected);
    let mut l = ledger();
    l.commit("v".into(), expected.into(), U64(2 * DAY));
    at(accounts(0), 2 * DAY);
    l.reveal("v".into(), CALL.into(), SALT.into(), "{}".into()); // contract's own sha256 agrees
}

#[test]
fn commit_then_reveal_after_the_outcome() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
    at(accounts(0), 2 * DAY + 1);
    l.reveal("c1".into(), CALL.into(), SALT.into(), r#"{"outcome":1}"#.into());
    let c = l.get_call("c1".into()).unwrap();
    assert_eq!(c.committed_at, U64(DAY));
    assert_eq!(c.reveal.unwrap().call, CALL);
    let s = l.stats();
    assert_eq!((s.committed, s.revealed, s.pending), (1, 1, 0));
}

#[test]
#[should_panic(expected = "too late")]
fn commit_after_the_outcome_time_is_refused() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(DAY)); // outcome time == now
}

#[test]
#[should_panic(expected = "too early")]
fn reveal_before_the_outcome_time_is_refused() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
    l.reveal("c1".into(), CALL.into(), SALT.into(), "{}".into());
}

#[test]
#[should_panic(expected = "does not match")]
fn an_altered_call_cannot_be_revealed() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
    at(accounts(0), 3 * DAY);
    let altered = CALL.replace("0.61", "0.71");
    l.reveal("c1".into(), altered, SALT.into(), "{}".into());
}

#[test]
#[should_panic(expected = "already committed")]
fn a_call_cannot_be_committed_twice() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
    l.commit("c1".into(), hash_of("other", CALL), U64(2 * DAY));
}

#[test]
#[should_panic(expected = "already revealed")]
fn a_call_cannot_be_revealed_twice() {
    let mut l = ledger();
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
    at(accounts(0), 3 * DAY);
    l.reveal("c1".into(), CALL.into(), SALT.into(), "{}".into());
    l.reveal("c1".into(), CALL.into(), SALT.into(), "{}".into());
}

#[test]
#[should_panic(expected = "only the owner")]
fn only_the_owner_may_commit() {
    let mut l = ledger();
    at(accounts(1), DAY);
    l.commit("c1".into(), hash_of(SALT, CALL), U64(2 * DAY));
}

#[test]
#[should_panic(expected = "64 lowercase hex")]
fn a_malformed_hash_is_refused() {
    let mut l = ledger();
    l.commit("c1".into(), "ABC".into(), U64(2 * DAY));
}

#[test]
fn unrevealed_calls_stay_visible_as_pending() {
    let mut l = ledger();
    l.commit_batch(vec![
        CommitInput { id: "a".into(), hash: hash_of(SALT, CALL), outcome_after: U64(2 * DAY) },
        CommitInput { id: "b".into(), hash: hash_of("s2", CALL), outcome_after: U64(2 * DAY) },
        CommitInput { id: "c".into(), hash: hash_of("s3", CALL), outcome_after: U64(2 * DAY) },
    ]);
    at(accounts(0), 3 * DAY);
    l.reveal("a".into(), CALL.into(), SALT.into(), "{}".into());
    let s = l.stats();
    assert_eq!((s.committed, s.revealed, s.pending), (3, 1, 2));
    let ids: Vec<String> = l.get_calls(0, 10).into_iter().map(|e| e.id).collect();
    assert_eq!(ids, vec!["a", "b", "c"]);
    assert_eq!(l.get_calls(1, 1)[0].id, "b");
    assert!(l.get_calls(5, 10).is_empty());
}

#[test]
#[should_panic(expected = "too late")]
fn a_batch_is_all_or_nothing() {
    let mut l = ledger();
    l.commit_batch(vec![
        CommitInput { id: "a".into(), hash: hash_of(SALT, CALL), outcome_after: U64(2 * DAY) },
        CommitInput { id: "late".into(), hash: hash_of("s2", CALL), outcome_after: U64(DAY / 2) },
    ]);
}
