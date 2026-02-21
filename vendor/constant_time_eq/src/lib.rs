#![no_std]

/// Returns `true` if `a` and `b` are equal, in (roughly) constant time with
/// respect to their contents.
#[inline]
pub fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }

    let mut diff = 0u8;
    for (&x, &y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Compare up to `n` bytes from `a` and `b` in constant time.
#[inline]
pub fn constant_time_eq_n(a: &[u8], b: &[u8], n: usize) -> bool {
    if a.len() < n || b.len() < n {
        return false;
    }

    let mut diff = 0u8;
    for i in 0..n {
        diff |= a[i] ^ b[i];
    }
    diff == 0
}
