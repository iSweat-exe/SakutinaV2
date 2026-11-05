#![deny(missing_docs)]
//! Calculs CPU de Sakutina exposés à Bun via Node-API.
//!
//! Les règles métier restent en TypeScript : ce crate ne fait que du travail
//! lourd (aujourd'hui, le rendu d'images) hors du thread principal.
//!
//! - `card` : logique de rendu, en Rust pur et testable seule.
//! - `bindings` : fonctions exposées à JavaScript, une par fonctionnalité.

pub mod bindings;
pub mod card;
