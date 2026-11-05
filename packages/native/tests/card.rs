//! Tests d'intégration du rendu complet, via l'API publique du crate.

use std::io::Cursor;

use image::{ImageFormat, Rgba, RgbaImage};
use sakutina_native::card::{
    CardError, CardSpec, HEIGHT, MAX_AVATAR_BYTES, MAX_STATS, Stat, WIDTH, avatar_center, render,
};

fn stat(label: &str, value: &str) -> Stat {
    Stat {
        label: label.into(),
        value: value.into(),
    }
}

fn spec() -> CardSpec {
    CardSpec {
        title: "Camille".into(),
        subtitle: Some("Uwu Server".into()),
        accent: None,
        avatar: None,
        stats: vec![stat("Messages", "1 204"), stat("Vocal", "3 h 05 min")],
    }
}

fn solid_png(color: [u8; 4], size: u32) -> Vec<u8> {
    let mut out = Cursor::new(Vec::new());
    RgbaImage::from_pixel(size, size, Rgba(color))
        .write_to(&mut out, ImageFormat::Png)
        .expect("encode");
    out.into_inner()
}

fn decode(png: &[u8]) -> RgbaImage {
    image::load_from_memory(png).expect("valid png").to_rgba8()
}

#[test]
fn render_should_produce_a_png_of_the_expected_size() {
    let png = render(&spec()).expect("render");

    assert_eq!(&png[..8], b"\x89PNG\r\n\x1a\n");
    assert_eq!(decode(&png).dimensions(), (WIDTH, HEIGHT));
}

#[test]
fn render_should_be_deterministic() {
    assert_eq!(render(&spec()).unwrap(), render(&spec()).unwrap());
}

#[test]
fn render_should_change_with_the_content() {
    let mut other = spec();
    other.title = "Zoé".into();
    let mut accented = spec();
    accented.accent = Some("#4fb3a9".into());

    assert_ne!(render(&spec()).unwrap(), render(&other).unwrap());
    assert_ne!(render(&spec()).unwrap(), render(&accented).unwrap());
}

#[test]
fn render_should_reject_invalid_stat_counts() {
    let mut none = spec();
    none.stats.clear();
    let mut many = spec();
    many.stats = (0..=MAX_STATS).map(|i| stat("x", &i.to_string())).collect();

    assert_eq!(render(&none), Err(CardError::InvalidStatCount(0)));
    assert_eq!(
        render(&many),
        Err(CardError::InvalidStatCount(MAX_STATS + 1))
    );
}

#[test]
fn render_should_reject_invalid_accent_colors() {
    for accent in ["red", "#12345", "#12345g", "123456", ""] {
        let mut invalid = spec();
        invalid.accent = Some(accent.into());

        assert!(
            matches!(render(&invalid), Err(CardError::InvalidAccent(_))),
            "{accent}"
        );
    }
}

#[test]
fn render_should_fall_back_when_the_avatar_is_unreadable() {
    let mut broken = spec();
    broken.avatar = Some(b"definitely not an image".to_vec());
    let mut oversized = spec();
    oversized.avatar = Some(vec![0; MAX_AVATAR_BYTES + 1]);

    assert!(render(&oversized).is_ok());
    // Un avatar illisible donne exactement la carte sans avatar.
    assert_eq!(render(&broken).unwrap(), render(&spec()).unwrap());
}

#[test]
fn render_should_draw_the_avatar_inside_a_circle() {
    let mut with_avatar = spec();
    with_avatar.avatar = Some(solid_png([200, 30, 30, 255], 300));
    let image = decode(&render(&with_avatar).unwrap());

    let (cx, cy) = avatar_center();
    let center = image.get_pixel(cx, cy);
    let corner = image.get_pixel(cx - 62, cy - 62);

    assert_eq!(center.0, [200, 30, 30, 255]);
    assert_ne!(corner.0, [200, 30, 30, 255]);
}

#[test]
fn render_should_handle_hostile_text_without_failing() {
    let mut hostile = spec();
    hostile.title = format!("{}\n\u{0}\u{202e}😀", "W".repeat(500));
    hostile.subtitle = Some("é".repeat(500));
    hostile.stats = vec![stat(&"L".repeat(200), &"9".repeat(200)); MAX_STATS];

    assert!(render(&hostile).is_ok());
}
