//! Couleurs de la carte et lecture de la couleur d'accent.

use super::error::CardError;

pub(super) const DEFAULT_ACCENT: &str = "#f2a65a";
pub(super) const TEXT: [u8; 4] = [244, 245, 247, 255];
pub(super) const MUTED: [u8; 4] = [154, 160, 171, 255];
pub(super) const TILE: [u8; 4] = [38, 42, 50, 255];
pub(super) const BACKGROUND_TOP: [u8; 4] = [27, 29, 35, 255];
pub(super) const BACKGROUND_BOTTOM: [u8; 4] = [20, 22, 26, 255];

/// Lit une couleur `#RRGGBB` en RGBA opaque.
pub(super) fn parse_hex(value: &str) -> Result<[u8; 4], CardError> {
    let invalid = || CardError::InvalidAccent(value.to_string());
    let digits = value.strip_prefix('#').ok_or_else(invalid)?;

    if digits.len() != 6 || !digits.chars().all(|c| c.is_ascii_hexdigit()) {
        return Err(invalid());
    }

    let channel = |range: std::ops::Range<usize>| {
        u8::from_str_radix(&digits[range], 16).map_err(|_| invalid())
    };

    Ok([channel(0..2)?, channel(2..4)?, channel(4..6)?, 255])
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_hex_should_read_rgb_channels() {
        assert_eq!(parse_hex("#f2a65a").unwrap(), [242, 166, 90, 255]);
        assert_eq!(parse_hex("#F2A65A").unwrap(), [242, 166, 90, 255]);
    }

    #[test]
    fn parse_hex_should_reject_malformed_colors() {
        for value in ["red", "#12345", "#1234567", "#12345g", "123456", ""] {
            assert!(
                matches!(parse_hex(value), Err(CardError::InvalidAccent(_))),
                "{value}"
            );
        }
    }
}
