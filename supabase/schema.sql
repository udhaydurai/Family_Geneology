-- Family Genealogy Database Schema
-- Run this in your Supabase SQL Editor to set up the database

-- 1. People table
CREATE TABLE people (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 2. Relationships table
CREATE TABLE relationships (
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID REFERENCES auth.users(id)
);

-- 3. Pending changes (approval workflow)
CREATE TABLE pending_changes (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  change_type TEXT NOT NULL CHECK (change_type IN ('add_person', 'edit_person', 'delete_person', 'add_relationship', 'delete_relationship')),
  payload JSONB NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  submitted_by UUID REFERENCES auth.users(id),
  submitted_by_email TEXT,
  reviewed_by UUID REFERENCES auth.users(id),
  review_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  reviewed_at TIMESTAMPTZ
);

-- 4. User roles
CREATE TABLE user_roles (
  user_id UUID REFERENCES auth.users(id) PRIMARY KEY,
  role TEXT NOT NULL DEFAULT 'contributor' CHECK (role IN ('admin', 'contributor')),
  display_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Enable Row Level Security
ALTER TABLE people ENABLE ROW LEVEL SECURITY;
ALTER TABLE relationships ENABLE ROW LEVEL SECURITY;
ALTER TABLE pending_changes ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_roles ENABLE ROW LEVEL SECURITY;

-- 6. RLS Policies

-- Everyone can read people and relationships
CREATE POLICY "Anyone can read people" ON people FOR SELECT USING (true);
CREATE POLICY "Anyone can read relationships" ON relationships FOR SELECT USING (true);

-- Only admins can directly insert/update/delete people and relationships
CREATE POLICY "Admins can insert people" ON people FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update people" ON people FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete people" ON people FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

CREATE POLICY "Admins can insert relationships" ON relationships FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update relationships" ON relationships FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can delete relationships" ON relationships FOR DELETE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- Pending changes: anyone authenticated can submit, only admins can review
CREATE POLICY "Authenticated users can submit changes" ON pending_changes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "Users can see their own pending changes" ON pending_changes FOR SELECT
  USING (submitted_by = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can update pending changes" ON pending_changes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- User roles: admins can manage, users can read their own
CREATE POLICY "Users can read own role" ON user_roles FOR SELECT
  USING (user_id = auth.uid() OR EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));
CREATE POLICY "Admins can manage roles" ON user_roles FOR ALL
  USING (EXISTS (SELECT 1 FROM user_roles WHERE user_id = auth.uid() AND role = 'admin'));

-- 7. Helper: Make the first user who signs up an admin
-- Run this AFTER your first sign-up, replacing YOUR_USER_ID:
-- INSERT INTO user_roles (user_id, role, display_name) VALUES ('YOUR_USER_ID', 'admin', 'Udhay');
