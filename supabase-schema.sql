-- ============================================================
-- СОЮЗ КАРТ — Database Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New Query)
-- ============================================================

-- Players table (auto-populated on first login)
CREATE TABLE IF NOT EXISTS players (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Товарищ',
  avatar_url TEXT,
  total_races INTEGER NOT NULL DEFAULT 0,
  total_wins INTEGER NOT NULL DEFAULT 0,
  best_time_ms INTEGER, -- Best race time in milliseconds
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Race results table
CREATE TABLE IF NOT EXISTS race_results (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES players(id) ON DELETE CASCADE,
  race_time_ms INTEGER NOT NULL, -- Race time in milliseconds
  laps INTEGER NOT NULL DEFAULT 3,
  track_name TEXT NOT NULL DEFAULT 'soviet_circuit',
  position INTEGER, -- 1st, 2nd, 3rd etc (null for solo)
  total_players INTEGER DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE players ENABLE ROW LEVEL SECURITY;
ALTER TABLE race_results ENABLE ROW LEVEL SECURITY;

-- Policies: anyone can read, only the owner can insert/update their own data
CREATE POLICY "Anyone can view players"
  ON players FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own profile"
  ON players FOR INSERT
  WITH CHECK (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON players FOR UPDATE
  USING (auth.uid() = id);

CREATE POLICY "Anyone can view race results"
  ON race_results FOR SELECT
  USING (true);

CREATE POLICY "Users can insert their own results"
  ON race_results FOR INSERT
  WITH CHECK (auth.uid() = player_id);

-- Index for leaderboard queries
CREATE INDEX IF NOT EXISTS idx_race_results_time ON race_results(race_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_players_best_time ON players(best_time_ms ASC);
CREATE INDEX IF NOT EXISTS idx_race_results_created ON race_results(created_at DESC);
