//! Formes de base : rectangles arrondis et remplissages.

use tiny_skia::{FillRule, Paint, Path, PathBuilder, Pixmap, Transform};

use super::error::CardError;

/// Rectangle aux coins arrondis, tracé avec des courbes de Bézier.
pub(super) fn rounded_rect(x: f32, y: f32, w: f32, h: f32, r: f32) -> Result<Path, CardError> {
    let r = r.min(w / 2.0).min(h / 2.0);
    let k = r * 0.552_284_8;
    let mut builder = PathBuilder::new();

    builder.move_to(x + r, y);
    builder.line_to(x + w - r, y);
    builder.cubic_to(x + w - r + k, y, x + w, y + r - k, x + w, y + r);
    builder.line_to(x + w, y + h - r);
    builder.cubic_to(x + w, y + h - r + k, x + w - r + k, y + h, x + w - r, y + h);
    builder.line_to(x + r, y + h);
    builder.cubic_to(x + r - k, y + h, x, y + h - r + k, x, y + h - r);
    builder.line_to(x, y + r);
    builder.cubic_to(x, y + r - k, x + r - k, y, x + r, y);
    builder.close();

    builder
        .finish()
        .ok_or_else(|| CardError::Render("invalid rounded rectangle".into()))
}

/// Remplit un tracé d'une couleur unie, avec anti-crénelage.
pub(super) fn fill_path(pixmap: &mut Pixmap, path: &Path, color: [u8; 4]) {
    let mut paint = Paint {
        anti_alias: true,
        ..Paint::default()
    };
    paint.set_color_rgba8(color[0], color[1], color[2], color[3]);
    pixmap.fill_path(path, &paint, FillRule::Winding, Transform::identity(), None);
}

/// Remplit un rectangle arrondi d'une couleur unie.
pub(super) fn fill_rounded(
    pixmap: &mut Pixmap,
    rect: (f32, f32, f32, f32),
    radius: f32,
    color: [u8; 4],
) -> Result<(), CardError> {
    let (x, y, w, h) = rect;
    let path = rounded_rect(x, y, w, h, radius)?;
    fill_path(pixmap, &path, color);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn fill_rounded_should_paint_inside_and_leave_the_corner_empty() {
        let mut pixmap = Pixmap::new(40, 40).unwrap();
        fill_rounded(&mut pixmap, (0.0, 0.0, 40.0, 40.0), 12.0, [255, 0, 0, 255]).unwrap();

        assert_eq!(pixmap.pixel(20, 20).unwrap().alpha(), 255);
        assert_eq!(pixmap.pixel(0, 0).unwrap().alpha(), 0);
    }

    #[test]
    fn rounded_rect_should_clamp_an_oversized_radius() {
        assert!(rounded_rect(0.0, 0.0, 10.0, 10.0, 500.0).is_ok());
    }
}
