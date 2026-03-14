-- Family Genealogy Database Schema (Simple Mode)
-- Run this in your Supabase SQL Editor
-- No auth/RLS — you are the sole operator

-- 1. People table
CREATE TABLE IF NOT EXISTS people (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  first_name TEXT,
  last_name TEXT,
  birth_date TEXT,
  death_date TEXT,
  gender TEXT NOT NULL CHECK (gender IN ('male', 'female', 'other')),
  is_deceased BOOLEAN DEFAULT FALSE,
  profile_image TEXT,
  notes TEXT,
  birth_place TEXT,
  occupation TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Relationships table
CREATE TABLE IF NOT EXISTS relationships (
  id TEXT PRIMARY KEY,
  person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  related_person_id TEXT NOT NULL REFERENCES people(id) ON DELETE CASCADE,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN (
    'parent', 'child', 'spouse', 'sibling', 'grandparent', 'grandchild',
    'aunt', 'uncle', 'niece', 'nephew', 'cousin',
    'step-parent', 'step-child', 'adopted-parent', 'adopted-child', 'in-law'
  )),
  is_inferred BOOLEAN DEFAULT FALSE,
  confidence REAL DEFAULT 1.0,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_rel_person ON relationships(person_id);
CREATE INDEX IF NOT EXISTS idx_rel_related ON relationships(related_person_id);
CREATE INDEX IF NOT EXISTS idx_rel_type ON relationships(relationship_type);

-- 4. Disable RLS (you're the only operator)
ALTER TABLE people DISABLE ROW LEVEL SECURITY;
ALTER TABLE relationships DISABLE ROW LEVEL SECURITY;
