import { pool } from '../../db/pool';

export type PlanChannel = 'season_ticket_addon' | 'direct' | 'subscription';
export type BillingInterval = 'one_time' | 'monthly';

export interface ClubPlan {
  id: string;
  team_id: string;
  channel: PlanChannel;
  price_pence: number;
  currency: string;
  billing_interval: BillingInterval;
  stripe_price_id: string | null;
  active: boolean;
}

export async function getClubPlans(teamId: string): Promise<ClubPlan[]> {
  const { rows } = await pool.query<ClubPlan>(
    `select id, team_id, channel, price_pence, currency, billing_interval, stripe_price_id, active
       from club_plans
      where team_id = $1
      order by channel`,
    [teamId]
  );
  return rows;
}

export interface ClubPlanInput {
  channel: PlanChannel;
  price_pence: number;
  billing_interval: BillingInterval;
  currency?: string;
  active?: boolean;
}

// Upserts one club's plan for a single channel — an admin configures pricing
// one channel at a time (season_ticket_addon / direct / subscription), so
// this never touches a club's other channels.
export async function upsertClubPlan(teamId: string, input: ClubPlanInput): Promise<ClubPlan> {
  const { rows } = await pool.query<ClubPlan>(
    `insert into club_plans (team_id, channel, price_pence, currency, billing_interval, active)
     values ($1, $2, $3, $4, $5, $6)
     on conflict (team_id, channel) do update
       set price_pence = excluded.price_pence,
           currency = excluded.currency,
           billing_interval = excluded.billing_interval,
           active = excluded.active,
           updated_at = now()
     returning id, team_id, channel, price_pence, currency, billing_interval, stripe_price_id, active`,
    [
      teamId,
      input.channel,
      input.price_pence,
      input.currency ?? 'gbp',
      input.billing_interval,
      input.active ?? true,
    ]
  );
  return rows[0];
}

// Stripe Connect identity + revenue-share config a club needs before any
// payment can be split automatically (roadmap "Stripe Connect payments").
// platform_fee_bps is nullable on teams — a per-club override; resolving it
// against the platform default is the caller's job (env.DEFAULT_PLATFORM_FEE_BPS
// once step 4 wires Stripe in), not this query's.
export interface ClubCommercialConfig {
  team_id: string;
  stripe_account_id: string | null;
  stripe_connect_status: 'not_started' | 'onboarding' | 'active' | 'restricted';
  platform_fee_bps: number | null;
}

export async function getClubCommercialConfig(teamId: string): Promise<ClubCommercialConfig | null> {
  const { rows } = await pool.query<ClubCommercialConfig>(
    `select id as team_id, stripe_account_id, stripe_connect_status, platform_fee_bps
       from teams
      where id = $1`,
    [teamId]
  );
  return rows[0] ?? null;
}
