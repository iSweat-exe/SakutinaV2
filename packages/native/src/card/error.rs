//! Erreurs de validation ou de rendu.

use std::fmt;

use super::spec::MAX_STATS;

/// Erreurs de validation ou de rendu.
#[derive(Debug, PartialEq, Eq)]
pub enum CardError {
    /// Le nombre de statistiques n'est pas compris entre 1 et [`MAX_STATS`].
    InvalidStatCount(usize),
    /// La couleur d'accent n'est pas de la forme `#RRGGBB`.
    InvalidAccent(String),
    /// Échec interne de dessin ou d'encodage.
    Render(String),
}

impl fmt::Display for CardError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            Self::InvalidStatCount(count) => {
                write!(f, "Expected between 1 and {MAX_STATS} stats, got {count}.")
            }
            Self::InvalidAccent(value) => {
                write!(f, "Accent must look like #RRGGBB, got \"{value}\".")
            }
            Self::Render(reason) => write!(f, "Card rendering failed: {reason}"),
        }
    }
}

impl std::error::Error for CardError {}
