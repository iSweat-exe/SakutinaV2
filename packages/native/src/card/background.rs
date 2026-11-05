//! Fond de la carte : dégradé vertical dans un rectangle arrondi.

use tiny_skia::{
    Color, FillRule, GradientStop, LinearGradient, Paint, Pixmap, Point, SpreadMode, Transform,
};

use super::error::CardError;
use super::layout::{CORNER_RADIUS, HEIGHT, WIDTH};
use super::palette::{BACKGROUND_BOTTOM, BACKGROUND_TOP};
use super::shapes::rounded_rect;

fn color(rgba: [u8; 4]) -> Color {
    Color::from_rgba8(rgba[0], rgba[1], rgba[2], rgba[3])
}

pub(super) fn draw(pixmap: &mut Pixmap) -> Result<(), CardError> {
    let shader = LinearGradient::new(
        Point::from_xy(0.0, 0.0),
        Point::from_xy(0.0, HEIGHT as f32),
        vec![
            GradientStop::new(0.0, color(BACKGROUND_TOP)),
            GradientStop::new(1.0, color(BACKGROUND_BOTTOM)),
        ],
        SpreadMode::Pad,
        Transform::identity(),
    )
    .ok_or_else(|| CardError::Render("invalid gradient".into()))?;
    let paint = Paint {
        shader,
        anti_alias: true,
        ..Paint::default()
    };

    let path = rounded_rect(0.0, 0.0, WIDTH as f32, HEIGHT as f32, CORNER_RADIUS)?;
    pixmap.fill_path(&path, &paint, FillRule::Winding, Transform::identity(), None);

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn draw_should_fill_the_center_and_round_the_corners() {
        let mut pixmap = Pixmap::new(WIDTH, HEIGHT).unwrap();
        draw(&mut pixmap).unwrap();

        assert_eq!(pixmap.pixel(WIDTH / 2, HEIGHT / 2).unwrap().alpha(), 255);
        assert_eq!(pixmap.pixel(0, 0).unwrap().alpha(), 0);
    }
}
