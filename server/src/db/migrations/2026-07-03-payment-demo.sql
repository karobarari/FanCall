-- FanCall migration — demo payment gate
-- Date: 2026-07-03
--
-- Adds users.paid, defaulting to false. There is no real payment processor
-- yet (that's roadmap step 18) — POST /api/payment/pay just flips this flag
-- so the signup -> pay -> predict loop can be tested end to end. The admin
-- account (matching ADMIN_EMAIL) is auto-marked paid at signup so testing
-- settle/predict never requires clicking through the demo payment screen.
--
-- Existing accounts default to paid = false — they'll see the payment
-- screen next time they hit a gated route, same as any other user. If you
-- have an existing dev account you want to keep testing with, flip it
-- manually: update users set paid = true where email = '<your email>';
--
-- Safe to run on a populated DB — additive only. Re-runnable.
--
-- Run:  psql -d karod        -f db/migrations/2026-07-03-payment-demo.sql
--       psql -d fancall_test -f db/migrations/2026-07-03-payment-demo.sql

alter table users add column if not exists paid boolean not null default false;
