//! Rendu déterministe de cartes de profil en PNG.
//!
//! Le module est pur Rust, sans dépendance à Node-API : il se teste seul
//! (`cargo test`). Le contenu (textes déjà formatés, couleur) est décidé par
//! l'appelant TypeScript ; ici on ne fait que dessiner.
//!
//! Chaque zone de la carte a son module : `background`, `avatar`,
//! `header` et `stats` ; `layout`, `palette`, `shapes` et `text` fournissent
//! la géométrie, les couleurs et les primitives de dessin.

mod avatar;
mod background;
mod error;
mod header;
mod layout;
mod palette;
mod shapes;
mod spec;
mod stats;
mod text;

use tiny_skia::Pixmap;

pub use error::CardError;
pub use layout::{HEIGHT, WIDTH, avatar_center};
pub use spec::{CardSpec, MAX_AVATAR_BYTES, MAX_STATS, Stat};

/// Dessine la carte et renvoie les octets d'un PNG.
///
/// # Errors
///
/// Renvoie une erreur si les statistiques ou la couleur d'accent sont
/// invalides, ou si le dessin / l'encodage échoue. Un avatar illisible n'est
/// pas une erreur : un avatar de remplacement est dessiné.
pub fn render(spec: &CardSpec) -> Result<Vec<u8>, CardError> {
    spec.validate()?;

    let accent = palette::parse_hex(spec.accent.as_deref().unwrap_or(palette::DEFAULT_ACCENT))?;
    let font = text::load_font()?;
    let mut pixmap = Pixmap::new(WIDTH, HEIGHT)
        .ok_or_else(|| CardError::Render("could not allocate the canvas".into()))?;

    background::draw(&mut pixmap)?;
    avatar::draw(&mut pixmap, &font, &spec.title, spec.avatar.as_deref(), accent)?;
    header::draw(&mut pixmap, &font, spec, accent)?;
    stats::draw(&mut pixmap, &font, &spec.stats)?;

    pixmap
        .encode_png()
        .map_err(|e| CardError::Render(e.to_string()))
}
