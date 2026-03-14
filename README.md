# Family Tree

A collaborative family tree app built for preserving family history. Family members can contribute; an admin reviews and approves changes so data isn't accidentally overwritten.

## Features

### Interactive Tree Visualization
- D3.js force-directed network graph with generational layering
- Click any node to see all their relationships in a detail panel
- Hover to highlight connections; non-connected nodes dim for clarity
- Relationship labels appear on lines when a node is selected
- Drag nodes to rearrange; zoom, pan, fit-to-view controls

### Relationship Filtering
- Toggle relationship types on/off via checkboxes in the legend
- Defaults to Parent/Child + Spouse + Sibling (clean view)
- Enable Grandparent, Aunt/Uncle, Cousin, In-law as needed
- Color-coded lines with distinct dash patterns per type

### Relationship Inference
- Automatically derives siblings, grandparents, aunts/uncles, cousins, and in-laws from parent/child + spouse data
- One-click "Infer" button in the header

### Collaboration (Supabase)
- Google sign-in or magic link authentication
- Contributors submit changes → Admin reviews in a queue → Approve or reject
- Row-level security ensures only admins can modify live data
- Works fully offline with localStorage when Supabase is not configured

### Export & Print
- **Print / PDF** — opens a clean print window with browser "Save as PDF"
- **PNG export** — high-resolution 2x image
- **SVG export** — vector format, scales perfectly
- Filters control what's visible in all exports

## Quick Start

```bash
npm install
npm run dev
# Open http://localhost:8080
# Click "Load Test Data" to see a 4-generation family
# Click "Infer" to auto-derive relationships
```

### Docker
```bash
docker build -t family-tree .
docker run -p 4173:4173 family-tree
```

## Setting Up Collaboration (Optional)

1. Create a free project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the Supabase SQL Editor
3. Enable Google auth in Dashboard > Auth > Providers
4. Copy `.env.example` to `.env` and fill in your keys:
   ```
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   ```
5. Sign up, then make yourself admin:
   ```sql
   INSERT INTO user_roles (user_id, role, display_name)
   VALUES ('YOUR_USER_ID', 'admin', 'Your Name');
   ```
6. Deploy to Vercel with the same env vars

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite
- **UI**: shadcn/ui, Tailwind CSS, Lucide icons
- **Visualization**: D3.js v7
- **Backend** (optional): Supabase (Postgres + Auth + RLS)
- **Deployment**: Docker or Vercel

## Project Structure

```
src/
  pages/Index.tsx              — Main page (Tree, People, Relationships, Review Queue)
  contexts/AuthContext.tsx      — Auth state and role management
  components/
    D3NetworkGraph.tsx         — Primary visualization with filters, detail panel, export
    AuthGate.tsx               — Login screen
    ReviewQueue.tsx            — Admin approval queue
    PersonForm.tsx             — Add/edit person
    RelationshipManager.tsx    — Manage relationships
  hooks/
    useFamilyTree.ts           — localStorage data layer + inference engine
    useSupabaseData.ts         — Supabase data layer + approval workflow
  lib/
    supabase.ts                — Supabase client
    relationshipGraph.ts       — Graph algorithms, BFS path-finding
  types/family.ts              — All TypeScript interfaces
  data/testFamilyData.ts       — 15-person test family (4 generations)
supabase/
  schema.sql                   — Database schema with RLS policies
```

## Test Data

The included test dataset is a 4-generation Tamil family with 15 people and 24 direct relationships. After inference, it produces siblings, cousins, grandparents, aunts/uncles, and in-laws — useful for testing all visualization features.

## License

MIT
