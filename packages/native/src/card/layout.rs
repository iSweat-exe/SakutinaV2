//! Géométrie de la carte, en pixels.

/// Largeur de la carte.
pub const WIDTH: u32 = 840;
/// Hauteur de la carte.
pub const HEIGHT: u32 = 300;

pub(super) const CORNER_RADIUS: f32 = 28.0;
pub(super) const MARGIN: f32 = 40.0;

pub(super) const AVATAR_SIZE: u32 = 128;
pub(super) const AVATAR_X: i32 = 40;
pub(super) const AVATAR_Y: i32 = 40;
pub(super) const AVATAR_RING_GAP: f32 = 6.0;
pub(super) const AVATAR_RING_WIDTH: f32 = 4.0;

/// Début des textes d'en-tête, à droite de l'avatar.
pub(super) const TEXT_X: f32 = AVATAR_X as f32 + AVATAR_SIZE as f32 + 32.0;
pub(super) const TITLE_SIZE: f32 = 44.0;
pub(super) const TITLE_BASELINE: f32 = 96.0;
pub(super) const SUBTITLE_SIZE: f32 = 22.0;
pub(super) const SUBTITLE_BASELINE: f32 = 134.0;
pub(super) const ACCENT_BAR_Y: f32 = 152.0;
pub(super) const ACCENT_BAR_WIDTH: f32 = 64.0;
pub(super) const ACCENT_BAR_HEIGHT: f32 = 5.0;

pub(super) const TILE_Y: f32 = 192.0;
pub(super) const TILE_HEIGHT: f32 = 76.0;
pub(super) const TILE_GAP: f32 = 16.0;
pub(super) const TILE_RADIUS: f32 = 16.0;
pub(super) const TILE_PADDING: f32 = 16.0;
pub(super) const LABEL_SIZE: f32 = 16.0;
pub(super) const LABEL_BASELINE: f32 = 28.0;
pub(super) const VALUE_SIZE: f32 = 28.0;
pub(super) const VALUE_BASELINE: f32 = 60.0;

/// Centre de l'avatar, en pixels depuis le coin haut gauche.
pub fn avatar_center() -> (u32, u32) {
    (
        AVATAR_X as u32 + AVATAR_SIZE / 2,
        AVATAR_Y as u32 + AVATAR_SIZE / 2,
    )
}
