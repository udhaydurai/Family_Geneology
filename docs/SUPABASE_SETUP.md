# Supabase Setup — Step by Step

## Step 1: Create a Supabase Account

1. Go to https://supabase.com
2. Click **Start your project** (top right)
3. Sign in with your **GitHub account** (easiest since you already have one)

## Step 2: Create a New Project

1. After signing in, click **New project**
2. Fill in:
   - **Organization**: Select your default org (or create one, name doesn't matter)
   - **Project name**: `family-tree`
   - **Database password**: Pick something strong (you won't need it often, but save it somewhere)
   - **Region**: Pick the closest to you (e.g., `US East` if you're on the East Coast)
3. Click **Create new project**
4. Wait ~2 minutes for it to provision

## Step 3: Run the Database Schema

1. In your Supabase dashboard, click **SQL Editor** in the left sidebar
2. Click **New query**
3. Copy-paste the entire contents of `supabase/schema.sql` from this repo
4. Click **Run** (or Cmd+Enter)
5. You should see "Success. No rows returned" — that means the tables were created

## Step 4: Get Your API Keys

1. In the left sidebar, click **Project Settings** (gear icon at bottom)
2. Click **API** in the settings menu
3. You'll see two values you need:
   - **Project URL**: Looks like `https://abcdefghij.supabase.co`
   - **anon public key**: A long string starting with `eyJ...`

## Step 5: Configure Your App

1. In your project folder, copy the example env file:
   ```bash
   cp .env.example .env
   ```

2. Edit `.env` and paste your values:
   ```
   VITE_SUPABASE_URL=https://abcdefghij.supabase.co
   VITE_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...your-full-key-here
   ```

3. Restart your dev server:
   ```bash
   npm run dev
   ```

4. The app will now read/write to Supabase instead of localStorage

## Step 6: Verify It Works

1. Open http://localhost:8080
2. Load test data or import a CSV
3. In Supabase dashboard, click **Table Editor** in the left sidebar
4. Click the `people` table — you should see your data there
5. Click the `relationships` table — relationships should be there too

---

## Useful SQL Scripts

### See all people
```sql
SELECT id, name, gender, birth_date, birth_place FROM people ORDER BY name;
```

### See all relationships
```sql
SELECT
  r.relationship_type,
  p1.name AS person,
  p2.name AS related_to
FROM relationships r
JOIN people p1 ON r.person_id = p1.id
JOIN people p2 ON r.related_person_id = p2.id
ORDER BY r.relationship_type, p1.name;
```

### Find potential duplicates (similar names)
```sql
SELECT
  a.id AS id_a, a.name AS name_a,
  b.id AS id_b, b.name AS name_b
FROM people a
JOIN people b ON a.id < b.id
WHERE LOWER(REPLACE(a.name, ' ', '')) = LOWER(REPLACE(b.name, ' ', ''))
   OR SIMILARITY(LOWER(a.name), LOWER(b.name)) > 0.6
ORDER BY a.name;
```
(Note: SIMILARITY requires `pg_trgm` extension. If it errors, use just the first WHERE condition.)

### Merge duplicate: move all relationships from person B to person A, then delete B
```sql
-- Replace 'KEEP_ID' with the person you want to keep
-- Replace 'DELETE_ID' with the duplicate to remove

-- Move relationships where duplicate is the subject
UPDATE relationships SET person_id = 'KEEP_ID' WHERE person_id = 'DELETE_ID';

-- Move relationships where duplicate is the related person
UPDATE relationships SET related_person_id = 'KEEP_ID' WHERE related_person_id = 'DELETE_ID';

-- Delete any relationships that now point to themselves
DELETE FROM relationships WHERE person_id = related_person_id;

-- Delete duplicate relationships (same person_id + related_person_id + type)
DELETE FROM relationships a
USING relationships b
WHERE a.id > b.id
  AND a.person_id = b.person_id
  AND a.related_person_id = b.related_person_id
  AND a.relationship_type = b.relationship_type;

-- Finally delete the duplicate person
DELETE FROM people WHERE id = 'DELETE_ID';
```

### Delete a person and all their relationships
```sql
DELETE FROM people WHERE id = 'PERSON_ID';
-- (relationships auto-delete via ON DELETE CASCADE)
```

### Count people and relationships
```sql
SELECT
  (SELECT COUNT(*) FROM people) AS total_people,
  (SELECT COUNT(*) FROM relationships) AS total_relationships;
```

### Export all data as JSON (for backup)
```sql
SELECT json_build_object(
  'people', (SELECT json_agg(row_to_json(p)) FROM people p),
  'relationships', (SELECT json_agg(row_to_json(r)) FROM relationships r)
) AS backup;
```

---

## Troubleshooting

**"relation does not exist"**: You haven't run the schema.sql yet. Go to SQL Editor and run it.

**App still uses localStorage**: Check that `.env` has both `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set, and restart the dev server.

**Can't see data in Table Editor**: Click the refresh button in Table Editor. Data should appear after any import or add operation in the app.

**"permission denied for table"**: RLS might be enabled. Run this in SQL Editor:
```sql
ALTER TABLE people DISABLE ROW LEVEL SECURITY;
ALTER TABLE relationships DISABLE ROW LEVEL SECURITY;
```
