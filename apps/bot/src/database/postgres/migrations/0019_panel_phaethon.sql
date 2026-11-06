-- Panneau : Phaéthon. Liste de surveillance, score de risque expliqué, dossier de chaque compte, et les décisions
-- d'un administrateur (surveiller, écarter, bannir).
--
-- Le score est calculé à la lecture, à partir de ce que le bot conserve déjà (jamais le contenu d'un message) :
--   intégrité du compte (25) : âge du compte Discord (déduit de son identifiant), compte créé juste avant d'arriver,
--                              changements de nom ou d'avatar ;
--   coordination (25)        : comptes arrivés dans les mêmes deux minutes, même avatar, même nom (l'un des deux
--                              comptes de moins de 90 jours), arrivée juste après un bannissement ;
--   automatisation (20)      : actif presque toutes les heures d'une même journée, rafale dans une heure ;
--   contenu (15)             : interventions de l'auto-modération, mentions de masse ;
--   économie (10)            : récompense quotidienne réclamée à la même seconde chaque jour, gros transferts,
--                              chance au casino hors de ce que le hasard permet ;
--   antécédents (5)          : avertissements, sanctions passées.
-- Chaque point vient d'un seuil nommé ci-dessous : un score reste explicable, ce n'est jamais un jugement.
--
-- `phaethon_review` : la décision d'un administrateur sur un compte. « watch » le garde dans la liste quel que soit
--   son score ; « dismissed » l'en retire tant que son score ne monte pas de 10 points. Purgée à 30 jours,
--   effacée par `/me forget`.
-- `moderation_command` accepte une seconde action, « ban » : le panneau n'a aucun accès à Discord, il écrit la
--   demande, le bot bannit, journalise au nom de l'administrateur et clôt la demande.

CREATE TABLE IF NOT EXISTS phaethon_review (
  guild_id text NOT NULL,
  member_id text NOT NULL,
  status text NOT NULL,
  score integer NOT NULL DEFAULT 0,
  reviewed_by text NOT NULL,
  reviewed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (guild_id, member_id),
  CONSTRAINT phaethon_review_status CHECK (status IN ('watch', 'dismissed'))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS phaethon_review_time_idx ON phaethon_review (reviewed_at);
--> statement-breakpoint
ALTER TABLE phaethon_review ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE moderation_command ADD COLUMN IF NOT EXISTS action text NOT NULL DEFAULT 'revoke';
--> statement-breakpoint
ALTER TABLE moderation_command ADD COLUMN IF NOT EXISTS member_id text;
--> statement-breakpoint
ALTER TABLE moderation_command ADD COLUMN IF NOT EXISTS reason text;
--> statement-breakpoint
ALTER TABLE moderation_command ALTER COLUMN sanction_id DROP NOT NULL;
--> statement-breakpoint
ALTER TABLE moderation_command ADD CONSTRAINT moderation_command_action CHECK (
  (action = 'revoke' AND sanction_id IS NOT NULL)
  OR (action = 'ban' AND member_id IS NOT NULL AND reason IS NOT NULL AND char_length(reason) BETWEEN 1 AND 300)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS moderation_command_member_idx ON moderation_command (guild_id, member_id) WHERE member_id IS NOT NULL;
--> statement-breakpoint
-- Comptes liés entre eux à l'instant `p_at` : une ligne par (membre, autre compte, raison).
CREATE OR REPLACE FUNCTION phaethon_links(p_guild_id text, p_at timestamptz)
RETURNS TABLE (member_id text, other_id text, relation text)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH members AS (
    SELECT
      p.member_id,
      p.joined_at,
      p.avatar,
      CASE WHEN char_length(regexp_replace(lower(coalesce(p.display_name, '')), '[^a-z]', '', 'g')) >= 4
        THEN regexp_replace(lower(p.display_name), '[^a-z]', '', 'g') END AS name_key,
      CASE WHEN p.member_id ~ '^[0-9]{15,19}$'
        THEN to_timestamp(((p.member_id::bigint >> 22) + 1420070400000) / 1000.0) END AS created_at
    FROM member_profile p
    WHERE p.guild_id = p_guild_id AND p.first_seen_at <= p_at AND (p.left_at IS NULL OR p.left_at > p_at)
  )
  -- Arrivés à deux minutes d'écart, dans les 30 derniers jours, l'un des deux avec un compte de moins de 30 jours.
  SELECT a.member_id, b.member_id, 'join'
  FROM members a
  JOIN members b ON b.member_id <> a.member_id
    AND b.joined_at BETWEEN a.joined_at - interval '2 minutes' AND a.joined_at + interval '2 minutes'
  WHERE a.joined_at > p_at - interval '30 days' AND a.joined_at <= p_at
    AND (a.joined_at - a.created_at < interval '30 days' OR b.joined_at - b.created_at < interval '30 days')
  UNION
  SELECT a.member_id, b.member_id, 'avatar'
  FROM members a
  JOIN members b ON b.member_id <> a.member_id AND b.avatar = a.avatar
  WHERE a.avatar IS NOT NULL
  UNION
  SELECT a.member_id, b.member_id, 'name'
  FROM members a
  JOIN members b ON b.member_id <> a.member_id AND b.name_key = a.name_key
  -- Deux anciens membres qui portent le même prénom courant ne sont pas liés : l'un des deux doit être récent.
  WHERE a.name_key IS NOT NULL AND (p_at - a.created_at < interval '90 days' OR p_at - b.created_at < interval '90 days')
  UNION
  -- Arrivé dans l'heure qui suit un bannissement, avec un compte de moins de 30 jours : contournement probable.
  SELECT a.member_id, s.member_id, 'after-ban'
  FROM members a
  JOIN moderation_sanction s ON s.guild_id = p_guild_id AND s.kind = 'ban' AND s.member_id <> a.member_id
    AND a.joined_at BETWEEN s.created_at AND s.created_at + interval '1 hour'
  WHERE s.created_at <= p_at AND a.joined_at - a.created_at < interval '30 days'
$$;
--> statement-breakpoint
-- Score de risque de chaque membre présent à l'instant `p_at`, facteur par facteur, avec les signaux qui l'expliquent.
CREATE OR REPLACE FUNCTION phaethon_risk(p_guild_id text, p_at timestamptz)
RETURNS TABLE (
  member_id text,
  integrity integer,
  coordination integer,
  automation integer,
  content integer,
  economy integer,
  history integer,
  flags text[],
  messages_7d integer
)
LANGUAGE sql STABLE SET search_path = public, pg_temp AS $$
  WITH members AS (
    SELECT
      p.member_id,
      p.joined_at,
      CASE WHEN p.member_id ~ '^[0-9]{15,19}$'
        THEN to_timestamp(((p.member_id::bigint >> 22) + 1420070400000) / 1000.0) END AS created_at
    FROM member_profile p
    WHERE p.guild_id = p_guild_id AND p.first_seen_at <= p_at AND (p.left_at IS NULL OR p.left_at > p_at)
  ),
  churn AS (
    SELECT e.member_id, count(*) AS n
    FROM identity_event e
    WHERE e.guild_id = p_guild_id AND e.kind IN ('nickname', 'username', 'display-name', 'avatar')
      AND e.occurred_at > p_at - interval '7 days' AND e.occurred_at <= p_at
    GROUP BY e.member_id
  ),
  links AS (
    SELECT l.member_id, count(DISTINCT l.other_id) AS n, array_agg(DISTINCT l.relation) AS relations
    FROM phaethon_links(p_guild_id, p_at) l
    GROUP BY l.member_id
  ),
  days AS (
    SELECT h.member_id, h.day, count(*) AS active_hours, max(h.messages) AS peak, sum(h.messages) AS total
    FROM member_hour_daily h
    WHERE h.guild_id = p_guild_id AND h.messages > 0
      AND h.day > (p_at AT TIME ZONE 'UTC')::date - 7
      AND (h.day + make_interval(hours => h.hour)) AT TIME ZONE 'UTC' <= p_at
    GROUP BY h.member_id, h.day
  ),
  rhythm AS (
    SELECT d.member_id, max(d.active_hours) AS hours_in_day, max(d.peak) AS peak, sum(d.total) AS messages
    FROM days d
    GROUP BY d.member_id
  ),
  automod AS (
    SELECT a.target_id AS member_id, count(*) AS n
    FROM audit_event a
    WHERE a.guild_id = p_guild_id AND a.action LIKE 'automod.%' AND a.target_id IS NOT NULL
      AND a.occurred_at > p_at - interval '30 days' AND a.occurred_at <= p_at
    GROUP BY a.target_id
  ),
  mentions AS (
    SELECT d.member_id, max(d.mentions) AS peak
    FROM activity_daily d
    WHERE d.guild_id = p_guild_id AND d.day > (p_at AT TIME ZONE 'UTC')::date - 30 AND d.day <= (p_at AT TIME ZONE 'UTC')::date
    GROUP BY d.member_id
  ),
  eco AS (
    SELECT
      l.member_id,
      coalesce(sum(l.amount) FILTER (WHERE l.reason LIKE 'pay:to:%'), 0) AS sent,
      coalesce(sum(l.amount) FILTER (WHERE l.reason LIKE 'pay:from:%'), 0) AS received,
      count(*) FILTER (WHERE l.reason ~ '^casino:(slots|roulette|coinflip):(win|jackpot)$') AS casino_won,
      count(*) FILTER (WHERE l.reason ~ '^casino:(slots|roulette|coinflip):(win|jackpot|loss)$') AS casino_played,
      count(*) FILTER (WHERE l.reason = 'salary:daily') AS claims,
      stddev_pop(extract(epoch FROM (l.created_at AT TIME ZONE 'UTC')::time)) FILTER (WHERE l.reason = 'salary:daily') AS claim_spread
    FROM economy_ledger l
    WHERE l.guild_id = p_guild_id AND l.created_at > p_at - interval '30 days' AND l.created_at <= p_at
    GROUP BY l.member_id
  ),
  warns AS (
    SELECT w.member_id, count(*) AS n
    FROM moderation_warning w
    WHERE w.guild_id = p_guild_id AND w.created_at > p_at - interval '365 days' AND w.created_at <= p_at
    GROUP BY w.member_id
  ),
  sanctions AS (
    SELECT s.member_id, count(*) AS n
    FROM moderation_sanction s
    WHERE s.guild_id = p_guild_id AND s.created_at <= p_at
    GROUP BY s.member_id
  ),
  signals AS (
    SELECT
      m.member_id,
      extract(epoch FROM p_at - m.created_at) / 86400 AS age_days,
      m.joined_at - m.created_at < interval '1 day' AS fresh_at_join,
      coalesce(c.n, 0) AS churn,
      coalesce(k.n, 0) AS links,
      coalesce(k.relations, '{}'::text[]) AS relations,
      coalesce(r.hours_in_day, 0) AS hours_in_day,
      coalesce(r.peak, 0) AS peak,
      coalesce(r.messages, 0) AS messages,
      coalesce(a.n, 0) AS automod,
      coalesce(t.peak, 0) AS mention_peak,
      greatest(coalesce(e.sent, 0), coalesce(e.received, 0)) AS transfers,
      coalesce(e.casino_won, 0) AS casino_won,
      coalesce(e.casino_played, 0) AS casino_played,
      coalesce(e.claims, 0) >= 5 AND e.claim_spread < 120 AS scripted_claims,
      coalesce(w.n, 0) AS warnings,
      coalesce(s.n, 0) AS sanctions
    FROM members m
    LEFT JOIN churn c ON c.member_id = m.member_id
    LEFT JOIN links k ON k.member_id = m.member_id
    LEFT JOIN rhythm r ON r.member_id = m.member_id
    LEFT JOIN automod a ON a.member_id = m.member_id
    LEFT JOIN mentions t ON t.member_id = m.member_id
    LEFT JOIN eco e ON e.member_id = m.member_id
    LEFT JOIN warns w ON w.member_id = m.member_id
    LEFT JOIN sanctions s ON s.member_id = m.member_id
  )
  SELECT
    g.member_id,
    least(25,
      CASE WHEN g.age_days < 1 THEN 14 WHEN g.age_days < 7 THEN 10 WHEN g.age_days < 30 THEN 5 ELSE 0 END
      + CASE WHEN g.fresh_at_join THEN 4 ELSE 0 END
      + CASE WHEN g.churn >= 4 THEN 7 WHEN g.churn >= 2 THEN 3 ELSE 0 END
    )::integer,
    greatest(
      CASE WHEN g.links >= 5 THEN 25 WHEN g.links >= 3 THEN 20 WHEN g.links = 2 THEN 14 WHEN g.links = 1 THEN 8 ELSE 0 END,
      CASE WHEN 'after-ban' = ANY (g.relations) THEN 20 ELSE 0 END
    )::integer,
    least(20,
      CASE WHEN g.hours_in_day >= 20 THEN 12 WHEN g.hours_in_day >= 16 THEN 6 ELSE 0 END
      + CASE WHEN g.peak >= 120 THEN 8 WHEN g.peak >= 60 THEN 4 ELSE 0 END
    )::integer,
    least(15, g.automod * 5 + CASE WHEN g.mention_peak >= 50 THEN 5 ELSE 0 END)::integer,
    least(10,
      CASE WHEN g.scripted_claims THEN 4 ELSE 0 END
      + CASE WHEN g.transfers >= 10000 THEN 4 WHEN g.transfers >= 3000 THEN 2 ELSE 0 END
      + CASE WHEN g.casino_played >= 20 AND g.casino_won >= 0.7 * g.casino_played THEN 4 ELSE 0 END
    )::integer,
    least(5,
      CASE WHEN g.warnings >= 2 THEN 4 WHEN g.warnings = 1 THEN 2 ELSE 0 END
      + CASE WHEN g.sanctions >= 1 THEN 2 ELSE 0 END
    )::integer,
    array_remove(ARRAY[
      CASE WHEN g.age_days < 7 THEN 'new-account' WHEN g.age_days < 30 THEN 'young-account' END,
      CASE WHEN g.fresh_at_join THEN 'fresh-at-join' END,
      CASE WHEN g.churn >= 2 THEN 'identity-churn' END,
      CASE WHEN 'join' = ANY (g.relations) THEN 'join-cluster' END,
      CASE WHEN 'avatar' = ANY (g.relations) THEN 'same-avatar' END,
      CASE WHEN 'name' = ANY (g.relations) THEN 'same-name' END,
      CASE WHEN 'after-ban' = ANY (g.relations) THEN 'after-ban' END,
      CASE WHEN g.hours_in_day >= 16 THEN 'sleepless' END,
      CASE WHEN g.peak >= 60 THEN 'burst' END,
      CASE WHEN g.automod > 0 THEN 'automod' END,
      CASE WHEN g.mention_peak >= 50 THEN 'mass-mentions' END,
      CASE WHEN g.scripted_claims THEN 'scripted-claims' END,
      CASE WHEN g.transfers >= 3000 THEN 'big-transfers' END,
      CASE WHEN g.casino_played >= 20 AND g.casino_won >= 0.7 * g.casino_played THEN 'casino-luck' END,
      CASE WHEN g.warnings > 0 THEN 'warned' END,
      CASE WHEN g.sanctions > 0 THEN 'sanctioned' END
    ], NULL),
    g.messages::integer
  FROM signals g
$$;
--> statement-breakpoint
-- Phaéthon d'un serveur : chiffres d'en-tête, puis les 30 comptes les plus à risque (score d'au moins 25, ou
-- surveillés), chacun avec son dossier complet. Consulter est journalisé (une fois par heure et par administrateur).
CREATE OR REPLACE FUNCTION panel_phaethon(p_guild_id text) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller text;
  v_now timestamptz := now();
  v_hour timestamptz := date_trunc('hour', now());
  v_today date := (now() AT TIME ZONE 'UTC')::date;
  v_median numeric;
  v_entries jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  v_caller := panel_caller_discord_id();

  IF NOT EXISTS (
    SELECT 1 FROM audit_event
    WHERE guild_id = p_guild_id AND action = 'phaethon.viewed' AND actor_id IS NOT DISTINCT FROM v_caller
      AND occurred_at > v_now - interval '1 hour'
  ) THEN
    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (gen_random_uuid(), 'phaethon.viewed', p_guild_id, v_now, v_caller, NULL, jsonb_build_object('source', 'panel'));
  END IF;

  -- Une heure active « ordinaire » du serveur : médiane des heures où un membre a écrit, sur 7 jours.
  SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY h.messages)
  INTO v_median
  FROM member_hour_daily h
  WHERE h.guild_id = p_guild_id AND h.messages > 0 AND h.day > v_today - 7;

  WITH scored AS MATERIALIZED (
    SELECT r.member_id, ARRAY[r.integrity, r.coordination, r.automation, r.content, r.economy, r.history] AS pts,
      r.integrity + r.coordination + r.automation + r.content + r.economy + r.history AS score, r.flags, r.messages_7d AS messages
    FROM phaethon_risk(p_guild_id, v_now) r
  ),
  previous AS (
    SELECT r.member_id, r.integrity + r.coordination + r.automation + r.content + r.economy + r.history AS score
    FROM phaethon_risk(p_guild_id, v_now - interval '24 hours') r
  ),
  listed AS (
    SELECT s.*, s.score - coalesce(p.score, 0) AS delta, v.status AS review
    FROM scored s
    LEFT JOIN previous p ON p.member_id = s.member_id
    LEFT JOIN phaethon_review v ON v.guild_id = p_guild_id AND v.member_id = s.member_id
    WHERE (s.score >= 25 AND (v.status IS DISTINCT FROM 'dismissed' OR s.score >= v.score + 10)) OR v.status = 'watch'
    ORDER BY (v.status = 'watch') DESC NULLS LAST, s.score DESC, s.member_id
    LIMIT 30
  )
  SELECT coalesce(jsonb_agg(item ORDER BY score DESC, member_id), '[]'::jsonb)
  INTO v_entries
  FROM (
    SELECT
      l.score,
      l.member_id,
      jsonb_build_object(
        'member_id', l.member_id,
        'name', pr.display_name,
        'avatar', pr.avatar,
        'created_at', CASE WHEN l.member_id ~ '^[0-9]{15,19}$'
          THEN to_timestamp(((l.member_id::bigint >> 22) + 1420070400000) / 1000.0) END,
        'joined_at', pr.joined_at,
        'last_active_at', pr.last_active_at,
        'points', to_jsonb(l.pts),
        'delta', l.delta,
        'confidence', least(99, 35 + 12 * (SELECT count(*) FROM unnest(l.pts) x WHERE x > 0) + least(20, l.messages / 5)),
        'flags', to_jsonb(l.flags),
        'review', l.review,
        'ban_status', (
          SELECT c.status FROM moderation_command c
          WHERE c.guild_id = p_guild_id AND c.action = 'ban' AND c.member_id = l.member_id AND c.status <> 'done'
          ORDER BY c.requested_at DESC LIMIT 1
        ),
        'links', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'member_id', k.other_id,
            'name', op.display_name,
            'relations', to_jsonb(k.relations),
            'score', os.score,
            'banned', k.banned
          ) ORDER BY k.banned DESC, os.score DESC NULLS LAST, k.other_id), '[]'::jsonb)
          FROM (
            SELECT lk.other_id, array_agg(DISTINCT lk.relation ORDER BY lk.relation) AS relations, bool_or(lk.relation = 'after-ban') AS banned
            FROM phaethon_links(p_guild_id, v_now) lk
            WHERE lk.member_id = l.member_id
            GROUP BY lk.other_id
            ORDER BY bool_or(lk.relation = 'after-ban') DESC, count(*) DESC, lk.other_id
            LIMIT 8
          ) k
          LEFT JOIN member_profile op ON op.guild_id = p_guild_id AND op.member_id = k.other_id
          LEFT JOIN scored os ON os.member_id = k.other_id
        ),
        -- Messages par heure UTC sur les 7 derniers jours : 7 lignes de 24, la plus ancienne d'abord.
        'heat', (
          SELECT jsonb_agg(jsonb_build_object('day', d.day, 'hours', (
            SELECT jsonb_agg(coalesce(h.messages, 0) ORDER BY hr)
            FROM generate_series(0, 23) hr
            LEFT JOIN member_hour_daily h ON h.guild_id = p_guild_id AND h.member_id = l.member_id AND h.day = d.day AND h.hour = hr
          )) ORDER BY d.day)
          FROM (SELECT (v_today - n) AS day FROM generate_series(0, 6) n) d
        ),
        -- Messages par heure sur les 72 dernières heures, la plus ancienne d'abord (la dernière est l'heure en cours).
        'rate', (
          SELECT jsonb_agg(coalesce(h.messages, 0) ORDER BY t.at)
          FROM (SELECT v_hour - make_interval(hours => n) AS at FROM generate_series(0, 71) n) t
          LEFT JOIN member_hour_daily h ON h.guild_id = p_guild_id AND h.member_id = l.member_id
            AND h.day = (t.at AT TIME ZONE 'UTC')::date AND h.hour = extract(hour FROM t.at AT TIME ZONE 'UTC')
        ),
        'transfers', (
          SELECT coalesce(jsonb_agg(jsonb_build_object(
            'member_id', x.other_id, 'name', xp.display_name, 'direction', x.direction, 'coins', x.coins
          ) ORDER BY x.coins DESC, x.other_id), '[]'::jsonb)
          FROM (
            SELECT
              split_part(e.reason, ':', 3) AS other_id,
              CASE WHEN e.reason LIKE 'pay:to:%' THEN 'out' ELSE 'in' END AS direction,
              sum(e.amount) AS coins
            FROM economy_ledger e
            WHERE e.guild_id = p_guild_id AND e.member_id = l.member_id AND e.created_at > v_now - interval '30 days'
              AND (e.reason LIKE 'pay:to:%' OR e.reason LIKE 'pay:from:%')
            GROUP BY 1, 2
            ORDER BY sum(e.amount) DESC
            LIMIT 5
          ) x
          LEFT JOIN member_profile xp ON xp.guild_id = p_guild_id AND xp.member_id = x.other_id
        ),
        'casino', (
          SELECT jsonb_build_object(
            'won', count(*) FILTER (WHERE e.reason ~ ':(win|jackpot)$'),
            'played', count(*)
          )
          FROM economy_ledger e
          WHERE e.guild_id = p_guild_id AND e.member_id = l.member_id AND e.created_at > v_now - interval '30 days'
            AND e.reason ~ '^casino:(slots|roulette|coinflip):(win|jackpot|loss)$'
        ),
        -- Les faits derrière le score, du plus ancien au plus récent (les 10 derniers).
        'events', (
          SELECT coalesce(jsonb_agg(jsonb_build_object('at', ev.at, 'kind', ev.kind, 'detail', ev.detail) ORDER BY ev.at), '[]'::jsonb)
          FROM (
            SELECT * FROM (
              SELECT pr.joined_at AS at, 'join' AS kind, '{}'::jsonb AS detail
              WHERE pr.joined_at IS NOT NULL
              UNION ALL
              SELECT ie.occurred_at, 'identity', jsonb_build_object('change', ie.kind)
              FROM identity_event ie
              WHERE ie.guild_id = p_guild_id AND ie.member_id = l.member_id AND ie.kind IN ('nickname', 'username', 'display-name', 'avatar')
              UNION ALL
              SELECT ae.occurred_at, ae.action, jsonb_strip_nulls(jsonb_build_object(
                'rule', ae.metadata ->> 'rule',
                'by', CASE WHEN ae.action LIKE 'automod.%' THEN NULL ELSE ap.display_name END
              ))
              FROM audit_event ae
              LEFT JOIN member_profile ap ON ap.guild_id = p_guild_id AND ap.member_id = ae.actor_id
              WHERE ae.guild_id = p_guild_id AND ae.target_id = l.member_id
                AND (ae.action LIKE 'automod.%' OR ae.action LIKE 'moderation.%')
                AND (ae.metadata ->> 'result' IS NULL OR ae.metadata ->> 'result' = 'ok')
            ) all_events
            ORDER BY at DESC
            LIMIT 10
          ) ev
        )
      ) AS item
    FROM listed l
    LEFT JOIN member_profile pr ON pr.guild_id = p_guild_id AND pr.member_id = l.member_id
  ) entries;

  RETURN jsonb_build_object(
    'generated_at', v_now,
    'members_tracked', (SELECT count(*) FROM member_profile WHERE guild_id = p_guild_id AND left_at IS NULL),
    'banned_7d', (
      SELECT count(*) FROM audit_event
      WHERE guild_id = p_guild_id AND action = 'moderation.ban' AND occurred_at > v_now - interval '7 days'
        AND (metadata ->> 'result' IS NULL OR metadata ->> 'result' = 'ok')
    ),
    'dismissed_7d', (
      SELECT count(*) FROM audit_event
      WHERE guild_id = p_guild_id AND action = 'phaethon.review' AND occurred_at > v_now - interval '7 days'
        AND metadata ->> 'status' = 'dismissed'
    ),
    'server_median', round(coalesce(v_median, 0), 1),
    'entries', v_entries
  );
END;
$$;
--> statement-breakpoint
-- Résumé du tableau de bord : les comptes les plus à risque (score et signaux, sans dossier), et leur nombre.
CREATE OR REPLACE FUNCTION panel_phaethon_top(p_guild_id text, p_limit integer DEFAULT 3) RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  WITH listed AS (
    SELECT s.member_id, s.score, s.flags
    FROM (
      SELECT r.member_id, r.integrity + r.coordination + r.automation + r.content + r.economy + r.history AS score, r.flags
      FROM phaethon_risk(p_guild_id, now()) r
    ) s
    LEFT JOIN phaethon_review v ON v.guild_id = p_guild_id AND v.member_id = s.member_id
    WHERE (s.score >= 25 AND (v.status IS DISTINCT FROM 'dismissed' OR s.score >= v.score + 10)) OR v.status = 'watch'
  )
  SELECT jsonb_build_object(
    'count', (SELECT count(*) FROM listed),
    'top', coalesce((
      SELECT jsonb_agg(jsonb_build_object(
        'member_id', t.member_id, 'name', p.display_name, 'avatar', p.avatar, 'score', t.score, 'flags', to_jsonb(t.flags)
      ) ORDER BY t.score DESC, t.member_id)
      FROM (SELECT * FROM listed ORDER BY score DESC, member_id LIMIT least(greatest(coalesce(p_limit, 3), 1), 10)) t
      LEFT JOIN member_profile p ON p.guild_id = p_guild_id AND p.member_id = t.member_id
    ), '[]'::jsonb)
  )
  INTO v_result;

  RETURN v_result;
END;
$$;
--> statement-breakpoint
-- Décision d'un administrateur sur un compte : « watch » (garder dans la liste), « dismissed » (fausse alerte),
-- « clear » (retirer la décision). Renvoie {"status": "watch"|"dismissed"|null}.
CREATE OR REPLACE FUNCTION panel_set_phaethon_review(
  p_guild_id text,
  p_member_id text DEFAULT NULL,
  p_status text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller text;
  v_score integer;
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  v_caller := panel_caller_discord_id();

  IF p_status IS NULL OR p_status NOT IN ('watch', 'dismissed', 'clear') OR p_member_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM member_profile WHERE guild_id = p_guild_id AND member_id = p_member_id) THEN
    RAISE EXCEPTION 'invalid review' USING ERRCODE = '22023';
  END IF;

  IF p_status = 'clear' THEN
    DELETE FROM phaethon_review WHERE guild_id = p_guild_id AND member_id = p_member_id;
  ELSE
    SELECT r.integrity + r.coordination + r.automation + r.content + r.economy + r.history
    INTO v_score
    FROM phaethon_risk(p_guild_id, now()) r
    WHERE r.member_id = p_member_id;

    INSERT INTO phaethon_review (guild_id, member_id, status, score, reviewed_by, reviewed_at)
    VALUES (p_guild_id, p_member_id, p_status, coalesce(v_score, 0), coalesce(v_caller, 'unknown'), now())
    ON CONFLICT (guild_id, member_id) DO UPDATE SET
      status = excluded.status, score = excluded.score, reviewed_by = excluded.reviewed_by, reviewed_at = excluded.reviewed_at;
  END IF;

  INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
  VALUES (gen_random_uuid(), 'phaethon.review', p_guild_id, now(), v_caller, p_member_id,
          jsonb_strip_nulls(jsonb_build_object('status', p_status, 'score', v_score, 'source', 'panel')));

  RETURN jsonb_build_object('status', CASE WHEN p_status = 'clear' THEN NULL ELSE p_status END);
END;
$$;
--> statement-breakpoint
-- Demande de bannissement depuis Phaéthon. Le bot l'exécute sur Discord (hiérarchie des rôles comprise) et la
-- journalise au nom de l'administrateur. Refusée pour le propriétaire du serveur, ses administrateurs et l'appelant.
-- Renvoie {"status": "pending"}.
CREATE OR REPLACE FUNCTION panel_request_ban(
  p_guild_id text,
  p_member_id text DEFAULT NULL,
  p_reason text DEFAULT NULL
) RETURNS jsonb
LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_caller text;
  v_reason text := btrim(coalesce(p_reason, ''));
BEGIN
  PERFORM panel_assert_admin(p_guild_id);

  v_caller := panel_caller_discord_id();

  IF p_member_id IS NULL OR p_member_id !~ '^[0-9]{5,25}$' OR char_length(v_reason) NOT BETWEEN 1 AND 300
     OR p_member_id = v_caller
     OR NOT EXISTS (SELECT 1 FROM member_profile WHERE guild_id = p_guild_id AND member_id = p_member_id AND left_at IS NULL)
     OR EXISTS (SELECT 1 FROM bot_guild WHERE guild_id = p_guild_id AND owner_id = p_member_id)
     OR EXISTS (SELECT 1 FROM panel_admin WHERE guild_id = p_guild_id AND discord_id = p_member_id)
     OR EXISTS (SELECT 1 FROM guild_manager WHERE guild_id = p_guild_id AND member_id = p_member_id) THEN
    RAISE EXCEPTION 'invalid ban' USING ERRCODE = '22023';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM moderation_command
    WHERE guild_id = p_guild_id AND action = 'ban' AND member_id = p_member_id AND status = 'pending'
  ) THEN
    INSERT INTO moderation_command (guild_id, action, member_id, reason, requested_by)
    VALUES (p_guild_id, 'ban', p_member_id, v_reason, coalesce(v_caller, 'unknown'));

    INSERT INTO audit_event (id, action, guild_id, occurred_at, actor_id, target_id, metadata)
    VALUES (gen_random_uuid(), 'phaethon.ban_requested', p_guild_id, now(), v_caller, p_member_id,
            jsonb_build_object('reason', v_reason, 'source', 'panel'));
  END IF;

  RETURN jsonb_build_object('status', 'pending');
END;
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION phaethon_links(text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION phaethon_risk(text, timestamptz) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_phaethon(text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_phaethon_top(text, integer) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_set_phaethon_review(text, text, text) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION panel_request_ban(text, text, text) FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon') THEN
    REVOKE ALL ON FUNCTION phaethon_links(text, timestamptz) FROM anon;
    REVOKE ALL ON FUNCTION phaethon_risk(text, timestamptz) FROM anon;
    REVOKE ALL ON FUNCTION panel_phaethon(text) FROM anon;
    REVOKE ALL ON FUNCTION panel_phaethon_top(text, integer) FROM anon;
    REVOKE ALL ON FUNCTION panel_set_phaethon_review(text, text, text) FROM anon;
    REVOKE ALL ON FUNCTION panel_request_ban(text, text, text) FROM anon;
  END IF;

  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
    -- Calculs internes : appelés seulement par les fonctions panel_* ci-dessus.
    REVOKE ALL ON FUNCTION phaethon_links(text, timestamptz) FROM authenticated;
    REVOKE ALL ON FUNCTION phaethon_risk(text, timestamptz) FROM authenticated;
    GRANT EXECUTE ON FUNCTION panel_phaethon(text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_phaethon_top(text, integer) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_set_phaethon_review(text, text, text) TO authenticated;
    GRANT EXECUTE ON FUNCTION panel_request_ban(text, text, text) TO authenticated;
  END IF;
END;
$$;
