//! Avatar : décodage sûr, recadrage carré, masque circulaire et anneau d'accent.

use std::io::Cursor;

use ab_glyph::FontRef;
use image::imageops::FilterType;
use image::{ImageReader, Limits};
use tiny_skia::{
    FillRule, IntSize, Mask, Paint, PathBuilder, Pixmap, PixmapPaint, Stroke, Transform,
};

use super::error::CardError;
use super::layout::{
    AVATAR_RING_GAP, AVATAR_RING_WIDTH, AVATAR_SIZE, AVATAR_X, AVATAR_Y, HEIGHT, WIDTH,
};
use super::palette::{MUTED, TILE};
use super::shapes::fill_path;
use super::spec::MAX_AVATAR_BYTES;
use super::text::{clean, draw_text, text_width};

const MAX_DIMENSION: u32 = 2048;
const MAX_ALLOC_BYTES: u64 = 64 * 1024 * 1024;
const PLACEHOLDER_SIZE: f32 = 56.0;

/// Dessine l'avatar (ou une initiale de remplacement) puis son anneau d'accent.
pub(super) fn draw(
    pixmap: &mut Pixmap,
    font: &FontRef<'_>,
    title: &str,
    avatar: Option<&[u8]>,
    accent: [u8; 4],
) -> Result<(), CardError> {
    let radius = AVATAR_SIZE as f32 / 2.0;
    let cx = AVATAR_X as f32 + radius;
    let cy = AVATAR_Y as f32 + radius;
    let circle = PathBuilder::from_circle(cx, cy, radius)
        .ok_or_else(|| CardError::Render("invalid avatar circle".into()))?;

    match avatar.and_then(decode) {
        Some(image) => {
            let mut mask = Mask::new(WIDTH, HEIGHT)
                .ok_or_else(|| CardError::Render("could not allocate the mask".into()))?;
            mask.fill_path(&circle, FillRule::Winding, true, Transform::identity());
            pixmap.draw_pixmap(
                AVATAR_X,
                AVATAR_Y,
                image.as_ref(),
                &PixmapPaint::default(),
                Transform::identity(),
                Some(&mask),
            );
        }
        None => {
            fill_path(pixmap, &circle, TILE);
            let initial = clean(title)
                .chars()
                .next()
                .map(|c| c.to_uppercase().to_string())
                .unwrap_or_default();
            let width = text_width(font, PLACEHOLDER_SIZE, &initial);
            draw_text(
                pixmap,
                font,
                &initial,
                (cx - width / 2.0, cy + 19.0),
                PLACEHOLDER_SIZE,
                MUTED,
            );
        }
    }

    let ring = PathBuilder::from_circle(cx, cy, radius + AVATAR_RING_GAP)
        .ok_or_else(|| CardError::Render("invalid avatar ring".into()))?;
    let mut paint = Paint {
        anti_alias: true,
        ..Paint::default()
    };
    paint.set_color_rgba8(accent[0], accent[1], accent[2], 255);
    let stroke = Stroke {
        width: AVATAR_RING_WIDTH,
        ..Stroke::default()
    };
    pixmap.stroke_path(&ring, &paint, &stroke, Transform::identity(), None);

    Ok(())
}

/// Décode, recadre au centre en carré et redimensionne ; `None` si illisible.
///
/// Les limites de taille protègent contre les images « bombes de décompression ».
fn decode(bytes: &[u8]) -> Option<Pixmap> {
    if bytes.is_empty() || bytes.len() > MAX_AVATAR_BYTES {
        return None;
    }

    let mut reader = ImageReader::new(Cursor::new(bytes))
        .with_guessed_format()
        .ok()?;
    let mut limits = Limits::default();
    limits.max_image_width = Some(MAX_DIMENSION);
    limits.max_image_height = Some(MAX_DIMENSION);
    limits.max_alloc = Some(MAX_ALLOC_BYTES);
    reader.limits(limits);

    let image = reader.decode().ok()?.to_rgba8();
    let (width, height) = image.dimensions();
    let side = width.min(height);
    let square =
        image::imageops::crop_imm(&image, (width - side) / 2, (height - side) / 2, side, side)
            .to_image();
    let resized = image::imageops::resize(&square, AVATAR_SIZE, AVATAR_SIZE, FilterType::Lanczos3);

    let mut data = resized.into_raw();
    for pixel in data.as_chunks_mut::<4>().0 {
        let alpha = u16::from(pixel[3]);
        for channel in &mut pixel[..3] {
            *channel = ((u16::from(*channel) * alpha + 127) / 255) as u8;
        }
    }

    Pixmap::from_vec(data, IntSize::from_wh(AVATAR_SIZE, AVATAR_SIZE)?)
}

#[cfg(test)]
mod tests {
    use super::*;
    use image::{ImageFormat, Rgba, RgbaImage};

    fn png(width: u32, height: u32, color: [u8; 4]) -> Vec<u8> {
        let mut out = Cursor::new(Vec::new());
        RgbaImage::from_pixel(width, height, Rgba(color))
            .write_to(&mut out, ImageFormat::Png)
            .unwrap();
        out.into_inner()
    }

    #[test]
    fn decode_should_reject_unreadable_or_oversized_input() {
        assert!(decode(b"").is_none());
        assert!(decode(b"definitely not an image").is_none());
        assert!(decode(&vec![0; MAX_AVATAR_BYTES + 1]).is_none());
    }

    #[test]
    fn decode_should_crop_non_square_images_to_the_avatar_size() {
        let pixmap = decode(&png(300, 100, [10, 20, 30, 255])).unwrap();

        assert_eq!((pixmap.width(), pixmap.height()), (AVATAR_SIZE, AVATAR_SIZE));
    }

    #[test]
    fn decode_should_reject_images_above_the_dimension_limit() {
        assert!(decode(&png(MAX_DIMENSION + 1, 1, [0, 0, 0, 255])).is_none());
    }

    #[test]
    fn decode_should_premultiply_transparent_pixels() {
        let pixmap = decode(&png(64, 64, [200, 100, 50, 0])).unwrap();

        assert_eq!(pixmap.pixel(10, 10).unwrap().alpha(), 0);
        assert_eq!(pixmap.pixel(10, 10).unwrap().red(), 0);
    }
}
