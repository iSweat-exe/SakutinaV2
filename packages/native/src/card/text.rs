//! Texte : police embarquée, mesure, troncature et dessin.

use ab_glyph::{Font, FontRef, PxScale, ScaleFont};
use tiny_skia::Pixmap;

use super::error::CardError;

const FONT_BYTES: &[u8] = include_bytes!("../../assets/Geist-Regular.ttf");

/// Charge la police embarquée.
pub(super) fn load_font() -> Result<FontRef<'static>, CardError> {
    FontRef::try_from_slice(FONT_BYTES).map_err(|e| CardError::Render(e.to_string()))
}

/// Remplace les caractères de contrôle par des espaces.
pub(super) fn clean(text: &str) -> String {
    text.chars()
        .map(|c| if c.is_control() { ' ' } else { c })
        .collect()
}

/// Largeur du texte en pixels ; un glyphe absent de la police compte comme une espace.
pub(super) fn text_width(font: &FontRef<'_>, size: f32, text: &str) -> f32 {
    let scaled = font.as_scaled(PxScale::from(size));
    let space = scaled.h_advance(font.glyph_id(' '));
    let mut width = 0.0;
    let mut previous = None;

    for character in text.chars() {
        let id = font.glyph_id(character);

        if id.0 == 0 {
            width += space;
            previous = None;
            continue;
        }

        if let Some(before) = previous {
            width += scaled.kern(before, id);
        }

        width += scaled.h_advance(id);
        previous = Some(id);
    }

    width
}

/// Tronque avec « ... » pour tenir dans `max_width`.
pub(super) fn fit_text(font: &FontRef<'_>, size: f32, text: &str, max_width: f32) -> String {
    if text_width(font, size, text) <= max_width {
        return text.to_string();
    }

    let mut kept: Vec<char> = text.chars().collect();

    while !kept.is_empty() {
        kept.pop();
        let candidate = format!("{}...", kept.iter().collect::<String>().trim_end());

        if text_width(font, size, &candidate) <= max_width {
            return candidate;
        }
    }

    String::new()
}

/// Dessine `text` à partir de `x`, sur la ligne de base `baseline`.
pub(super) fn draw_text(
    pixmap: &mut Pixmap,
    font: &FontRef<'_>,
    text: &str,
    position: (f32, f32),
    size: f32,
    color: [u8; 4],
) {
    let (x, baseline) = position;
    let scale = PxScale::from(size);
    let scaled = font.as_scaled(scale);
    let space = scaled.h_advance(font.glyph_id(' '));
    let mut cursor = x;
    let mut previous = None;

    for character in text.chars() {
        let id = font.glyph_id(character);

        if id.0 == 0 {
            cursor += space;
            previous = None;
            continue;
        }

        if let Some(before) = previous {
            cursor += scaled.kern(before, id);
        }

        let glyph = id.with_scale_and_position(scale, ab_glyph::point(cursor, baseline));
        cursor += scaled.h_advance(id);
        previous = Some(id);

        if let Some(outlined) = font.outline_glyph(glyph) {
            let bounds = outlined.px_bounds();
            outlined.draw(|gx, gy, coverage| {
                blend(
                    pixmap,
                    bounds.min.x as i32 + gx as i32,
                    bounds.min.y as i32 + gy as i32,
                    color,
                    coverage,
                );
            });
        }
    }
}

/// Mélange un pixel de texte dans le pixmap (alpha prémultiplié).
fn blend(pixmap: &mut Pixmap, x: i32, y: i32, color: [u8; 4], coverage: f32) {
    let (width, height) = (pixmap.width() as i32, pixmap.height() as i32);

    if x < 0 || y < 0 || x >= width || y >= height {
        return;
    }

    let alpha = (coverage * f32::from(color[3]) / 255.0).clamp(0.0, 1.0);

    if alpha <= 0.0 {
        return;
    }

    let index = ((y * width + x) * 4) as usize;
    let data = pixmap.data_mut();
    let inverse = 1.0 - alpha;

    for channel in 0..3 {
        let blended = f32::from(color[channel]) * alpha + f32::from(data[index + channel]) * inverse;
        data[index + channel] = blended.round().min(255.0) as u8;
    }

    data[index + 3] = (255.0 * alpha + f32::from(data[index + 3]) * inverse)
        .round()
        .min(255.0) as u8;
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fit_text_should_truncate_to_the_available_width() {
        let font = load_font().unwrap();
        let fitted = fit_text(&font, 44.0, &"W".repeat(100), 300.0);

        assert!(fitted.ends_with("..."));
        assert!(text_width(&font, 44.0, &fitted) <= 300.0);
        assert_eq!(fit_text(&font, 44.0, "Ok", 300.0), "Ok");
    }

    #[test]
    fn text_width_should_count_missing_glyphs_as_spaces() {
        let font = load_font().unwrap();

        assert!(text_width(&font, 20.0, "\u{1F600}") > 0.0);
        assert_eq!(
            text_width(&font, 20.0, "\u{1F600}"),
            text_width(&font, 20.0, " ")
        );
    }

    #[test]
    fn clean_should_replace_control_characters() {
        assert_eq!(clean("a\nb\u{0}c"), "a b c");
    }

    #[test]
    fn draw_text_should_leave_pixels_inside_the_canvas_only() {
        let font = load_font().unwrap();
        let mut pixmap = Pixmap::new(60, 30).unwrap();

        draw_text(&mut pixmap, &font, "Hi", (-20.0, 20.0), 24.0, [255, 255, 255, 255]);
        draw_text(&mut pixmap, &font, "Hi", (50.0, 20.0), 24.0, [255, 255, 255, 255]);

        assert!(pixmap.pixels().iter().any(|pixel| pixel.alpha() > 0));
    }
}
