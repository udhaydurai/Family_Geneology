# Family Genealogy Project

## What This Is
A collaborative family tree web app so that Udhay's son (and extended family) can see and maintain family relationships. Family members contribute; Udhay reviews and approves changes (Wikipedia-style editorial control).

## Tech Stack
- **Frontend**: React 18 + TypeScript, Vite, Tailwind CSS, shadcn/ui
- **Visualization**: D3.js v7 (force-directed network graph)
- **Backend**: Supabase (Postgres + Auth + Row-Level Security)
- **Hosting**: Vercel (planned, free tier)
- **Fallback**: Works fully offline with localStorage when Supabase is not configured

## Architecture
```
src/
  pages/Index.tsx              — Main page: 3 tabs (Tree, People, Relationships) + Review Queue for admin
  contexts/AuthContext.tsx      — Auth state, role management, Google/magic-link sign-in
  components/
    AuthGate.tsx               — Login screen gate (bypassed in local mode)
    D3NetworkGraph.tsx         — Primary visualization (force-directed graph, 666 lines)
    PersonForm.tsx             — Add/edit person dialog
    RelationshipManager.tsx    — Add/manage relationships between people
    ReviewQueue.tsx            — Admin approval queue for pending contributor changes
    AdvancedRelationshipExplorer.tsx — Path finding & relationship queries
    DataUpload.tsx             — CSV import/export (admin tool)
    ValidationDisplay.tsx      — Data integrity checks
  hooks/
    useFamilyTree.ts           — Original localStorage-based state (used as fallback)
    useSupabaseData.ts         — Supabase-backed CRUD with approval workflow
    use-toast.ts               — Toast notifications
  lib/
    supabase.ts                — Supabase client (reads VITE_SUPABASE_URL/VITE_SUPABASE_ANON_KEY)
    relationshipGraph.ts       — Graph algorithms, BFS path-finding
  types/
    family.ts                  — Person, Relationship, PendingChange, UserRole interfaces
supabase/
  schema.sql                   — Full database schema with RLS policies (run in Supabase SQL Editor)
```

## Data Model
- **Person**: id, name, firstName, lastName, birthDate, deathDate, gender, isDeceased, profileImage, notes, birthPlace, occupation
- **Relationship**: id, personId, relatedPersonId, relationshipType, isInferred, confidence, notes
- **PendingChange**: id, change_type, payload (JSON), status, submitted_by_email, review_note
- **UserRole**: admin (Udhay) or contributor (family members)
- **16 relationship types**: parent, child, spouse, sibling, grandparent, grandchild, aunt, uncle, niece, nephew, cousin, step-parent, step-child, adopted-parent, adopted-child, in-law

## How Collaboration Works
1. Family members sign in via Google or magic link
2. New users are automatically "contributors" — they can view everything but edits go to a pending queue
3. Admin (Udhay) sees a "Review Queue" tab with approve/reject for each change
4. Approved changes are applied to the live database
5. First user must be manually set as admin: `INSERT INTO user_roles (user_id, role, display_name) VALUES ('YOUR_USER_ID', 'admin', 'Udhay');`

## Dual Mode
- **Cloud mode** (Supabase configured via .env): Full collaboration with auth, RLS, approval workflow
- **Local mode** (no .env): Falls back to localStorage, no auth required — good for development

## Development
```bash
npm run dev       # Dev server on localhost:8080
npm run build     # Production build
npm run preview   # Preview production build
```

## Setup Steps for Supabase
1. Create a free project at supabase.com
2. Run `supabase/schema.sql` in the SQL Editor
3. Enable Google auth in Supabase Dashboard > Auth > Providers
4. Copy `.env.example` to `.env` and fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`
5. Sign up, then run the INSERT INTO user_roles SQL to make yourself admin
6. Deploy to Vercel and set the same env vars there

## Remaining Work
- Deploy to Vercel
- Enable Google OAuth in Supabase dashboard
- Optionally clean up unused legacy components: D3FamilyTree.tsx, FamilyTreeVisualization.tsx, FamilyNetworkGraph.tsx, FamilyTreeNode.tsx, TreeLayoutGraph.tsx
- Add profile photo upload (Supabase Storage)
- Mobile layout refinements

## Constraints
- Keep it simple — one-time project, minimize ongoing maintenance
- Free tier services only (Supabase free, Vercel free)
- Don't over-engineer permissions — just admin + contributor roles
- Mobile-responsive web, no native app
