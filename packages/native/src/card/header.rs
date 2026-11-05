//! En-tête : titre, sous-titre et barre d'accent.

use ab_glyph::FontRef;
use tiny_skia::Pixmap;

use super::error::CardError;
use super::layout::{
    ACCENT_BAR_HEIGHT, ACCENT_BAR_WIDTH, ACCENT_BAR_Y, MARGIN, SUBTITLE_BASELINE, SUBTITLE_SIZE,
    TEXT_X, TITLE_BASELINE, TITLE_SIZE, WIDTH,
};
use super::palette::{MUTED, TEXT};
use super::shapes::fill_rounded;
use super::spec::CardSpec;
use super::text::{clean, draw_text, fit_text};

pub(super) fn draw(
    pixmap: &mut Pixmap,
    font: &FontRef<'_>,
    spec: &CardSpec,
    accent: [u8; 4],
) -> Result<(), CardError> {
    let available = WIDTH as f32 - TEXT_X - MARGIN;

    let title = fit_text(font, TITLE_SIZE, &clean(&spec.title), available);
    draw_text(pixmap, font, &title, (TEXT_X, TITLE_BASELINE), TITLE_SIZE, TEXT);

    if let Some(subtitle) = &spec.subtitle {
        let subtitle = fit_text(font, SUBTITLE_SIZE, &clean(subtitle), available);
        draw_text(
            pixmap,
            font,
            &subtitle,
            (TEXT_X, SUBTITLE_BASELINE),
            SUBTITLE_SIZE,
            MUTED,
        );
    }

    fill_rounded(
        pixmap,
        (TEXT_X, ACCENT_BAR_Y, ACCENT_BAR_WIDTH, ACCENT_BAR_HEIGHT),
        ACCENT_BAR_HEIGHT / 2.0,
        accent,
    )
}
