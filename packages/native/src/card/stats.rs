//! Rangée de tuiles de statistiques.

use ab_glyph::FontRef;
use tiny_skia::Pixmap;

use super::error::CardError;
use super::layout::{
    LABEL_BASELINE, LABEL_SIZE, MARGIN, TILE_GAP, TILE_HEIGHT, TILE_PADDING, TILE_RADIUS, TILE_Y,
    VALUE_BASELINE, VALUE_SIZE, WIDTH,
};
use super::palette::{MUTED, TEXT, TILE};
use super::shapes::fill_rounded;
use super::spec::Stat;
use super::text::{clean, draw_text, fit_text};

/// Largeur d'une tuile quand `count` tuiles se partagent la largeur utile.
fn tile_width(count: usize) -> f32 {
    let count = count as f32;

    (WIDTH as f32 - 2.0 * MARGIN - TILE_GAP * (count - 1.0)) / count
}

pub(super) fn draw(
    pixmap: &mut Pixmap,
    font: &FontRef<'_>,
    stats: &[Stat],
) -> Result<(), CardError> {
    let width = tile_width(stats.len());
    let inner = width - 2.0 * TILE_PADDING;

    for (index, stat) in stats.iter().enumerate() {
        let x = MARGIN + index as f32 * (width + TILE_GAP);
        fill_rounded(pixmap, (x, TILE_Y, width, TILE_HEIGHT), TILE_RADIUS, TILE)?;

        let label = fit_text(font, LABEL_SIZE, &clean(&stat.label), inner);
        draw_text(
            pixmap,
            font,
            &label,
            (x + TILE_PADDING, TILE_Y + LABEL_BASELINE),
            LABEL_SIZE,
            MUTED,
        );

        let value = fit_text(font, VALUE_SIZE, &clean(&stat.value), inner);
        draw_text(
            pixmap,
            font,
            &value,
            (x + TILE_PADDING, TILE_Y + VALUE_BASELINE),
            VALUE_SIZE,
            TEXT,
        );
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn tiles_should_share_the_usable_width_without_overflowing() {
        for count in 1..=6 {
            let used = tile_width(count) * count as f32 + TILE_GAP * (count as f32 - 1.0);

            assert!((used - (WIDTH as f32 - 2.0 * MARGIN)).abs() < 0.01, "{count}");
        }
    }
}
