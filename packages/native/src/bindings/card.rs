//! Liaison Node-API du rendu de cartes de profil.

use napi::bindgen_prelude::{AsyncTask, Buffer};
use napi::{Env, Error, Result, Task};
use napi_derive::napi;

use crate::card;

/// Une statistique de carte : libellé et valeur déjà formatés.
#[napi(object)]
pub struct CardStat {
    /// Libellé court.
    pub label: String,
    /// Valeur à afficher.
    pub value: String,
}

/// Contenu d'une carte de profil.
#[napi(object)]
pub struct ProfileCardInput {
    /// Titre principal.
    pub title: String,
    /// Sous-titre optionnel.
    pub subtitle: Option<String>,
    /// Couleur d'accent `#RRGGBB`.
    pub accent: Option<String>,
    /// Avatar encodé (PNG, JPEG ou WebP) ; un avatar illisible est ignoré.
    pub avatar: Option<Buffer>,
    /// Entre 1 et 6 statistiques.
    pub stats: Vec<CardStat>,
}

/// Tâche exécutée sur le pool de threads libuv.
pub struct RenderCardTask {
    spec: card::CardSpec,
}

impl Task for RenderCardTask {
    type Output = Vec<u8>;
    type JsValue = Buffer;

    fn compute(&mut self) -> Result<Self::Output> {
        card::render(&self.spec).map_err(|error| Error::from_reason(error.to_string()))
    }

    fn resolve(&mut self, _env: Env, output: Self::Output) -> Result<Self::JsValue> {
        Ok(output.into())
    }
}

/// Dessine une carte de profil et renvoie un PNG.
///
/// Le calcul tourne hors du thread JavaScript : la promesse est résolue
/// quand le rendu est terminé, sans bloquer la boucle d'événements.
#[napi]
pub fn render_profile_card(input: ProfileCardInput) -> AsyncTask<RenderCardTask> {
    let spec = card::CardSpec {
        title: input.title,
        subtitle: input.subtitle,
        accent: input.accent,
        avatar: input.avatar.map(|bytes| bytes.to_vec()),
        stats: input
            .stats
            .into_iter()
            .map(|stat| card::Stat {
                label: stat.label,
                value: stat.value,
            })
            .collect(),
    };

    AsyncTask::new(RenderCardTask { spec })
}
