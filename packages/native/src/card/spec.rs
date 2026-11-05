//! Description d'une carte et limites acceptées.

use super::error::CardError;

/// Nombre maximal de statistiques affichées.
pub const MAX_STATS: usize = 6;
/// Taille maximale acceptée pour une image d'avatar encodée.
pub const MAX_AVATAR_BYTES: usize = 2 * 1024 * 1024;

/// Une statistique : un libellé et sa valeur, déjà formatés.
#[derive(Debug, Clone)]
pub struct Stat {
    /// Libellé court (ex. « Messages »).
    pub label: String,
    /// Valeur à afficher (ex. « 1 204 »).
    pub value: String,
}

/// Description complète d'une carte.
#[derive(Debug, Clone)]
pub struct CardSpec {
    /// Titre principal (nom du membre).
    pub title: String,
    /// Sous-titre optionnel (nom du serveur).
    pub subtitle: Option<String>,
    /// Couleur d'accent `#RRGGBB`.
    pub accent: Option<String>,
    /// Image d'avatar encodée (PNG, JPEG ou WebP) ; ignorée si illisible.
    pub avatar: Option<Vec<u8>>,
    /// Entre 1 et [`MAX_STATS`] statistiques.
    pub stats: Vec<Stat>,
}

impl CardSpec {
    /// Vérifie le nombre de statistiques.
    pub(super) fn validate(&self) -> Result<(), CardError> {
        if self.stats.is_empty() || self.stats.len() > MAX_STATS {
            return Err(CardError::InvalidStatCount(self.stats.len()));
        }

        Ok(())
    }
}
