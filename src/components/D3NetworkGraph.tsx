import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as d3 from 'd3';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, Search, X, Printer, FileDown } from 'lucide-react';

interface D3NetworkGraphProps {
  people: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
  onDeleteRelationship?: (relationshipId: string) => void;
  onAddRelationship?: (personId: string, relatedPersonId: string, relationshipType: RelationshipType) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  relationship?: Relationship;
}

interface SelectedPersonInfo {
  person: Person;
  relationships: Array<{ type: string; name: string; personId: string }>;
}

// ── Relationship categories ──
type RelCategory = 'parent_child' | 'spouse' | 'sibling' | 'grandparent' | 'aunt_uncle' | 'cousin' | 'in_law';

const REL_CATEGORIES: { key: RelCategory; label: string; types: string[]; color: string; dash: string }[] = [
  { key: 'parent_child', label: 'Parent / Child', types: ['Parent/Child', 'parent', 'child'], color: '#6366f1', dash: '' },
  { key: 'spouse', label: 'Spouse', types: ['spouse'], color: '#e11d48', dash: '8,4' },
  { key: 'sibling', label: 'Sibling', types: ['sibling'], color: '#10b981', dash: '5,5' },
  { key: 'grandparent', label: 'Grandparent', types: ['grandparent', 'grandchild'], color: '#7c3aed', dash: '12,4' },
  { key: 'aunt_uncle', label: 'Aunt / Uncle', types: ['aunt', 'uncle', 'niece', 'nephew'], color: '#f97316', dash: '3,3' },
  { key: 'cousin', label: 'Cousin', types: ['cousin'], color: '#06b6d4', dash: '6,3,2,3' },
  { key: 'in_law', label: 'In-law', types: ['in-law'], color: '#a3a3a3', dash: '2,4' },
];

const NODE_COLORS: Record<string, string> = {
  male: '#3b82f6',
  female: '#ec4899',
  other: '#8b5cf6',
  deceased: '#9ca3af',
};

const getCategoryForType = (type: string) => REL_CATEGORIES.find(c => c.types.includes(type));

// ── Deduplicate links ──
interface GraphLink {
  source: string;
  target: string;
  type: string;
  relId: string;
  category: RelCategory;
}

function buildLinks(relationships: Relationship[]): GraphLink[] {
  const seen = new Set<string>();
  const links: GraphLink[] = [];
  relationships.forEach(rel => {
    if (rel.relationshipType === 'parent' || rel.relationshipType === 'child') {
      const parentId = rel.relationshipType === 'parent' ? rel.personId : rel.relatedPersonId;
      const childId = rel.relationshipType === 'parent' ? rel.relatedPersonId : rel.personId;
      const key = `pc:${[parentId, childId].sort().join('-')}`;
      if (!seen.has(key)) {
        seen.add(key);
        links.push({ source: parentId, target: childId, type: 'Parent/Child', relId: rel.id, category: 'parent_child' });
      }
    } else {
      const key = `${rel.relationshipType}:${[rel.personId, rel.relatedPersonId].sort().join('-')}`;
      if (!seen.has(key)) {
        seen.add(key);
        const cat = getCategoryForType(rel.relationshipType);
        links.push({ source: rel.personId, target: rel.relatedPersonId, type: rel.relationshipType, relId: rel.id, category: cat?.key ?? 'in_law' });
      }
    }
  });
  return links;
}

// ── Family units: group couple + children for compound path rendering ──
interface FamilyUnit {
  parents: string[];
  children: string[];
}

function buildFamilyUnits(relationships: Relationship[]): FamilyUnit[] {
  const spouseOf = new Map<string, string>();
  const parentChildEdges: { parentId: string; childId: string }[] = [];
  const seen = new Set<string>();

  relationships.forEach(r => {
    if (r.relationshipType === 'spouse') {
      if (!spouseOf.has(r.personId)) spouseOf.set(r.personId, r.relatedPersonId);
      if (!spouseOf.has(r.relatedPersonId)) spouseOf.set(r.relatedPersonId, r.personId);
    } else if (r.relationshipType === 'parent' || r.relationshipType === 'child') {
      const pid = r.relationshipType === 'parent' ? r.personId : r.relatedPersonId;
      const cid = r.relationshipType === 'parent' ? r.relatedPersonId : r.personId;
      const key = `${pid}-${cid}`;
      if (!seen.has(key)) { seen.add(key); parentChildEdges.push({ parentId: pid, childId: cid }); }
    }
  });

  // Group by couple (spouse pair) or by shared children (co-parents without spouse link)
  const familyMap = new Map<string, FamilyUnit>();

  // First: find co-parents (two parents sharing a child)
  const childToParents = new Map<string, string[]>();
  parentChildEdges.forEach(({ parentId, childId }) => {
    if (!childToParents.has(childId)) childToParents.set(childId, []);
    const parents = childToParents.get(childId)!;
    if (!parents.includes(parentId)) parents.push(parentId);
  });

  // Build family units from co-parent pairs
  parentChildEdges.forEach(({ parentId, childId }) => {
    // Find the couple: either via spouse link or via shared children
    const spouse = spouseOf.get(parentId);
    const coParents = childToParents.get(childId) ?? [parentId];
    let partners: string[];
    if (spouse && coParents.includes(spouse)) {
      partners = [parentId, spouse].sort();
    } else if (coParents.length === 2) {
      partners = [...coParents].sort();
    } else {
      partners = [parentId];
    }
    const coupleKey = partners.join('-');

    if (!familyMap.has(coupleKey)) {
      familyMap.set(coupleKey, { parents: partners, children: [] });
    }
    const unit = familyMap.get(coupleKey)!;
    if (!unit.children.includes(childId)) unit.children.push(childId);
  });

  return Array.from(familyMap.values());
}

// ── Force-layout generation assignment ──
function assignGenerations(people: Person[], relationships: Relationship[]): Record<string, number> {
  const generations: Record<string, number> = {};
  const parentOf = new Map<string, string[]>();
  const childOf = new Map<string, string[]>();
  relationships.forEach(r => {
    if (r.relationshipType === 'parent') {
      if (!childOf.has(r.personId)) childOf.set(r.personId, []);
      childOf.get(r.personId)!.push(r.relatedPersonId);
      if (!parentOf.has(r.relatedPersonId)) parentOf.set(r.relatedPersonId, []);
      parentOf.get(r.relatedPersonId)!.push(r.personId);
    } else if (r.relationshipType === 'child') {
      if (!childOf.has(r.relatedPersonId)) childOf.set(r.relatedPersonId, []);
      childOf.get(r.relatedPersonId)!.push(r.personId);
      if (!parentOf.has(r.personId)) parentOf.set(r.personId, []);
      parentOf.get(r.personId)!.push(r.relatedPersonId);
    }
  });
  const roots = people.filter(p => !parentOf.has(p.id) || parentOf.get(p.id)!.length === 0);
  const queue: { id: string; gen: number }[] = roots.map(r => ({ id: r.id, gen: 0 }));
  const visited = new Set<string>();
  while (queue.length > 0) {
    const { id, gen } = queue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    generations[id] = gen;
    relationships.forEach(r => {
      if (r.relationshipType === 'spouse') {
        const sid = r.personId === id ? r.relatedPersonId : (r.relatedPersonId === id ? r.personId : null);
        if (sid && !visited.has(sid)) queue.unshift({ id: sid, gen });
      }
    });
    (childOf.get(id) ?? []).forEach(cid => { if (!visited.has(cid)) queue.push({ id: cid, gen: gen + 1 }); });
  }
  people.forEach(p => { if (!(p.id in generations)) generations[p.id] = 0; });
  return generations;
}

// ── Spouse pair detection ──
function getSpousePairs(relationships: Relationship[]): Map<string, string> {
  const pairs = new Map<string, string>();
  const seen = new Set<string>();
  relationships.forEach(r => {
    if (r.relationshipType === 'spouse') {
      const key = [r.personId, r.relatedPersonId].sort().join('-');
      if (!seen.has(key)) { seen.add(key); pairs.set(r.personId, r.relatedPersonId); pairs.set(r.relatedPersonId, r.personId); }
    }
  });
  return pairs;
}

// ══════════════════════════════════════════════════════════
// ── HIERARCHICAL LAYOUT (subtree-width approach) ──
// ══════════════════════════════════════════════════════════

interface HierPos { x: number; y: number; gen: number }

interface LayoutUnit {
  id: string;
  primary: string;
  spouse: string | null;
  gen: number;
  childUnits: LayoutUnit[];
  subtreeWidth: number;
}

function computeHierarchicalLayout(
  rootId: string,
  relationships: Relationship[],
  centerX: number,
  centerY: number
): Record<string, HierPos> {
  const ROW_SPACING = 280;
  const UNIT_WIDTH = 280;
  const SPOUSE_GAP = 140;
  const UNIT_GAP = 60;

  const nameOf = (id: string): string => {
    // lightweight name lookup for debug only
    return id.slice(0, 8);
  };

  // ── Build adjacency ──
  const parentsOf = new Map<string, string[]>();
  const childrenOf = new Map<string, string[]>();
  const spouseOf = new Map<string, string>();

  relationships.forEach(r => {
    if (r.relationshipType === 'parent') {
      if (!childrenOf.has(r.personId)) childrenOf.set(r.personId, []);
      childrenOf.get(r.personId)!.push(r.relatedPersonId);
      if (!parentsOf.has(r.relatedPersonId)) parentsOf.set(r.relatedPersonId, []);
      parentsOf.get(r.relatedPersonId)!.push(r.personId);
    } else if (r.relationshipType === 'child') {
      if (!childrenOf.has(r.relatedPersonId)) childrenOf.set(r.relatedPersonId, []);
      childrenOf.get(r.relatedPersonId)!.push(r.personId);
      if (!parentsOf.has(r.personId)) parentsOf.set(r.personId, []);
      parentsOf.get(r.personId)!.push(r.relatedPersonId);
    } else if (r.relationshipType === 'spouse') {
      if (!spouseOf.has(r.personId)) spouseOf.set(r.personId, r.relatedPersonId);
      if (!spouseOf.has(r.relatedPersonId)) spouseOf.set(r.relatedPersonId, r.personId);
    }
  });

  // ── BFS from root to assign generations + hop distance ──
  const genMap: Record<string, number> = {};
  const bfsDistance: Record<string, number> = {};
  const visited = new Set<string>();
  const bfsQueue: { id: string; gen: number; dist: number }[] = [{ id: rootId, gen: 0, dist: 0 }];

  while (bfsQueue.length > 0) {
    const { id, gen, dist } = bfsQueue.shift()!;
    if (visited.has(id)) continue;
    visited.add(id);
    genMap[id] = gen;
    bfsDistance[id] = dist;

    const sp = spouseOf.get(id);
    if (sp && !visited.has(sp)) bfsQueue.unshift({ id: sp, gen, dist: dist + 1 });
    (parentsOf.get(id) ?? []).forEach(pid => {
      if (!visited.has(pid)) bfsQueue.push({ id: pid, gen: gen - 1, dist: dist + 1 });
    });
    (childrenOf.get(id) ?? []).forEach(cid => {
      if (!visited.has(cid)) bfsQueue.push({ id: cid, gen: gen + 1, dist: dist + 1 });
    });
  }

  // ── Build family units (person + optional spouse) ──
  const unitOf = new Map<string, LayoutUnit>();
  const allUnits: LayoutUnit[] = [];
  const assigned = new Set<string>();

  const allPeopleIds = Object.keys(genMap).sort((a, b) => (bfsDistance[a] ?? 999) - (bfsDistance[b] ?? 999));

  for (const id of allPeopleIds) {
    if (assigned.has(id)) continue;
    assigned.add(id);

    const sp = spouseOf.get(id);
    let spouseId: string | null = null;
    if (sp && sp in genMap && !assigned.has(sp)) {
      spouseId = sp;
      assigned.add(sp);
    }

    const unit: LayoutUnit = {
      id: spouseId ? [id, spouseId].sort().join('-') : id,
      primary: id,
      spouse: spouseId,
      gen: genMap[id],
      childUnits: [],
      subtreeWidth: UNIT_WIDTH,
    };

    allUnits.push(unit);
    unitOf.set(id, unit);
    if (spouseId) unitOf.set(spouseId, unit);
  }

  // ── Link child units to parent units ──
  // Each child unit is owned by exactly ONE parent unit (closest to BFS root)
  const parentUnitOf = new Map<LayoutUnit, LayoutUnit>();

  for (const unit of allUnits) {
    const members = [unit.primary];
    if (unit.spouse) members.push(unit.spouse);

    const childIds = new Set<string>();
    for (const pid of members) {
      for (const cid of (childrenOf.get(pid) ?? [])) {
        if (cid in genMap) childIds.add(cid);
      }
    }

    const childUnitSet = new Set<LayoutUnit>();
    for (const cid of childIds) {
      const cu = unitOf.get(cid);
      if (cu && cu !== unit) childUnitSet.add(cu);
    }

    for (const cu of childUnitSet) {
      const existing = parentUnitOf.get(cu);
      if (!existing) {
        parentUnitOf.set(cu, unit);
        unit.childUnits.push(cu);
      } else {
        const existingDist = Math.min(
          bfsDistance[existing.primary] ?? 999,
          existing.spouse ? (bfsDistance[existing.spouse] ?? 999) : 999
        );
        const newDist = Math.min(
          bfsDistance[unit.primary] ?? 999,
          unit.spouse ? (bfsDistance[unit.spouse] ?? 999) : 999
        );
        if (newDist < existingDist) {
          existing.childUnits = existing.childUnits.filter(c => c !== cu);
          parentUnitOf.set(cu, unit);
          unit.childUnits.push(cu);
        }
      }
    }
  }

  // Sort child units by BFS distance (closer to root = left)
  for (const unit of allUnits) {
    unit.childUnits.sort((a, b) => (bfsDistance[a.primary] ?? 999) - (bfsDistance[b.primary] ?? 999));
  }

  // ── Bottom-up: compute subtree widths ──
  const unitsByGen = new Map<number, LayoutUnit[]>();
  for (const unit of allUnits) {
    if (!unitsByGen.has(unit.gen)) unitsByGen.set(unit.gen, []);
    unitsByGen.get(unit.gen)!.push(unit);
  }

  const gensSorted = [...unitsByGen.keys()].sort((a, b) => b - a);
  for (const gen of gensSorted) {
    for (const unit of unitsByGen.get(gen)!) {
      if (unit.childUnits.length === 0) {
        unit.subtreeWidth = UNIT_WIDTH;
      } else {
        const childrenTotalWidth = unit.childUnits.reduce((sum, cu) => sum + cu.subtreeWidth, 0)
          + (unit.childUnits.length - 1) * UNIT_GAP;
        unit.subtreeWidth = Math.max(UNIT_WIDTH, childrenTotalWidth);
      }
    }
  }

  // ── Top-down: place units ──
  const positions: Record<string, HierPos> = {};
  const placedUnits = new Set<string>();

  function placeUnit(unit: LayoutUnit, cx: number) {
    if (placedUnits.has(unit.id)) return;
    placedUnits.add(unit.id);

    const rowY = centerY + unit.gen * ROW_SPACING;
    if (unit.spouse) {
      positions[unit.primary] = { x: cx - SPOUSE_GAP / 2, y: rowY, gen: unit.gen };
      positions[unit.spouse] = { x: cx + SPOUSE_GAP / 2, y: rowY, gen: unit.gen };
    } else {
      positions[unit.primary] = { x: cx, y: rowY, gen: unit.gen };
    }

    if (unit.childUnits.length > 0) {
      const totalChildWidth = unit.childUnits.reduce((sum, cu) => sum + cu.subtreeWidth, 0)
        + (unit.childUnits.length - 1) * UNIT_GAP;
      let childStartX = cx - totalChildWidth / 2;

      for (const childUnit of unit.childUnits) {
        const childCx = childStartX + childUnit.subtreeWidth / 2;
        placeUnit(childUnit, childCx);
        childStartX += childUnit.subtreeWidth + UNIT_GAP;
      }
    }
  }

  // ── Find top-level units and in-law bridges ──
  const topLevelUnits = allUnits.filter(u => !parentUnitOf.has(u));
  topLevelUnits.sort((a, b) => (bfsDistance[a.primary] ?? 999) - (bfsDistance[b.primary] ?? 999));

  const mainTree = topLevelUnits[0];

  // Place main tree centered
  if (mainTree) {
    placeUnit(mainTree, centerX);
  }

  // Collect main tree members to find bridge connections
  const mainTreeIds = new Set<string>();
  function collectIds(unit: LayoutUnit) {
    mainTreeIds.add(unit.primary);
    if (unit.spouse) mainTreeIds.add(unit.spouse);
    unit.childUnits.forEach(collectIds);
  }
  if (mainTree) collectIds(mainTree);

  // Place secondary top-level units adjacent to their bridge person
  for (let i = 1; i < topLevelUnits.length; i++) {
    const unit = topLevelUnits[i];
    if (placedUnits.has(unit.id)) continue;

    // Find bridge: someone in this subtree whose child is in the main tree
    const inlawMembers: string[] = [];
    function collectInlaw(u: LayoutUnit) {
      inlawMembers.push(u.primary);
      if (u.spouse) inlawMembers.push(u.spouse);
      u.childUnits.forEach(collectInlaw);
    }
    collectInlaw(unit);

    let bridgePersonX: number | null = null;
    for (const pid of inlawMembers) {
      for (const cid of (childrenOf.get(pid) ?? [])) {
        if (mainTreeIds.has(cid) && positions[cid]) {
          bridgePersonX = positions[cid].x;
          break;
        }
      }
      if (bridgePersonX !== null) break;
    }

    if (bridgePersonX !== null) {
      placeUnit(unit, bridgePersonX + unit.subtreeWidth / 2 + UNIT_GAP);
    } else {
      const allXs = Object.values(positions).map(p => p.x);
      const rightEdge = allXs.length > 0 ? Math.max(...allXs) + UNIT_WIDTH : centerX;
      placeUnit(unit, rightEdge + unit.subtreeWidth / 2);
    }
  }

  // ── Debug logging ──
  console.log('=== Hierarchical Layout (subtree-width) ===');
  console.log(`Root: ${nameOf(rootId)}, ${allUnits.length} units, ${Object.keys(positions).length} positioned`);

  return positions;
}

// ── Path drawing: orthogonal elbow connectors ──
// linkIndex is used to offset parallel elbows so they don't overlap
function computeLinkPath(d: any, _i?: number, _nodes?: any): string {
  const sx = (d.source as any).x ?? d.source.x;
  const sy = (d.source as any).y ?? d.source.y;
  const tx = (d.target as any).x ?? d.target.x;
  const ty = (d.target as any).y ?? d.target.y;

  if (d.category === 'spouse') {
    // Horizontal line between spouses
    return `M${sx},${sy} L${tx},${ty}`;
  }
  if (d.category === 'parent_child') {
    // Elbow: down from parent, horizontal to child's X, down to child
    // Offset the midpoint-Y slightly based on source X to prevent overlapping horizontal segments
    const baseY = sy + (ty - sy) * 0.4;
    const offset = (sx - (sx + tx) / 2) * 0.08;
    const my = baseY + offset;
    return `M${sx},${sy} L${sx},${my} L${tx},${my} L${tx},${ty}`;
  }
  // Other relationships: straight diagonal to keep them visually distinct from parent/child
  return `M${sx},${sy} L${tx},${ty}`;
}

function computeLinkLabelPos(d: any): { x: number; y: number } {
  const sx = (d.source as any).x ?? d.source.x;
  const sy = (d.source as any).y ?? d.source.y;
  const tx = (d.target as any).x ?? d.target.x;
  const ty = (d.target as any).y ?? d.target.y;

  if (d.category === 'spouse') {
    return { x: (sx + tx) / 2, y: (sy + ty) / 2 - 8 };
  }
  // Label on the horizontal segment of the elbow
  const baseY = sy + (ty - sy) * 0.4;
  const offset = (sx - (sx + tx) / 2) * 0.08;
  return { x: (sx + tx) / 2, y: baseY + offset - 8 };
}

// ══════════════════════════════════════════════════════════
// ── COMPONENT ──
// ══════════════════════════════════════════════════════════

export const D3NetworkGraph: React.FC<D3NetworkGraphProps> = ({
  people,
  relationships,
  width = 1200,
  height = 700,
  onDeleteRelationship,
  onAddRelationship
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const gRef = useRef<SVGGElement | null>(null);
  const simulationRef = useRef<d3.Simulation<any, any> | null>(null);

  // D3 selection refs (so click handlers can access them without re-render)
  const nodeSelRef = useRef<d3.Selection<any, any, any, any> | null>(null);
  const linkSelRef = useRef<d3.Selection<any, any, any, any> | null>(null);
  const linkLabelSelRef = useRef<d3.Selection<any, any, any, any> | null>(null);
  const layoutModeRef = useRef<'force' | 'hierarchical'>('force');
  const isTransitioningRef = useRef(false);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<SelectedPersonInfo | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<Set<RelCategory>>(
    new Set(['parent_child', 'spouse'])
  );
  const [showExportMenu, setShowExportMenu] = useState(false);

  useEffect(() => {
    const handler = () => setContextMenu(prev => ({ ...prev, visible: false }));
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleCategory = useCallback((cat: RelCategory) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  }, []);

  const getPersonRelationships = useCallback((personId: string): SelectedPersonInfo['relationships'] => {
    const rels: SelectedPersonInfo['relationships'] = [];
    const seen = new Set<string>();
    relationships.forEach(r => {
      if (r.personId === personId) {
        const key = `${r.relatedPersonId}-${r.relationshipType}`;
        if (!seen.has(key)) {
          seen.add(key);
          const p = people.find(pp => pp.id === r.relatedPersonId);
          if (p) rels.push({ type: r.relationshipType, name: p.name, personId: p.id });
        }
      } else if (r.relatedPersonId === personId) {
        const rev = r.relationshipType === 'parent' ? 'child' : r.relationshipType === 'child' ? 'parent' : r.relationshipType;
        const key = `${r.personId}-${rev}`;
        if (!seen.has(key)) {
          seen.add(key);
          const p = people.find(pp => pp.id === r.personId);
          if (p) rels.push({ type: rev, name: p.name, personId: p.id });
        }
      }
    });
    const order: Record<string, number> = { spouse: 0, parent: 1, child: 2, sibling: 3 };
    rels.sort((a, b) => (order[a.type] ?? 10) - (order[b.type] ?? 10));
    return rels;
  }, [people, relationships]);

  // ══════════════════════════════════════════════════════════
  // ── MAIN D3 RENDER ──
  // ══════════════════════════════════════════════════════════
  useEffect(() => {
    if (!svgRef.current || people.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();
    layoutModeRef.current = 'force';

    const nodes = people.map(p => ({ ...p }));
    const allLinks = buildLinks(relationships);
    const visibleLinks = allLinks.filter(l => visibleCategories.has(l.category));
    // Family units for compound parent-child connector rendering
    const familyUnits = visibleCategories.has('parent_child') ? buildFamilyUnits(relationships) : [];
    const generations = assignGenerations(people, relationships);
    const spousePairs = getSpousePairs(relationships);
    const maxGen = Math.max(...Object.values(generations), 0);
    const genSpacing = Math.max(280, height / (maxGen + 2));

    // SVG defs
    svg.append('defs').html(`
      <marker id="arrow-pc" viewBox="0 0 10 6" refX="38" refY="3" markerWidth="7" markerHeight="5" orient="auto">
        <path d="M0,0 L10,3 L0,6 Z" fill="#6366f1" opacity="0.6"/>
      </marker>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.08"/>
      </filter>
    `);

    const g = svg.append('g').attr('class', 'graph');
    gRef.current = g.node();

    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    zoomRef.current = zoom;
    svg.call(zoom as any);

    // ── Links (non-parent-child only — parent-child rendered as family connectors) ──
    const nonPcLinks = visibleLinks.filter(l => l.category !== 'parent_child');
    const linkGroup = g.append('g').attr('class', 'links');
    const link = linkGroup.selectAll('path.link-line')
      .data(nonPcLinks).enter().append('path')
      .attr('class', 'link-line')
      .attr('fill', 'none')
      .attr('stroke', d => getCategoryForType(d.type)?.color ?? '#a3a3a3')
      .attr('stroke-width', d => d.category === 'spouse' ? 2.5 : 1.8)
      .attr('stroke-dasharray', d => getCategoryForType(d.type)?.dash ?? '')
      .attr('opacity', 0.55)
      .style('cursor', 'pointer')
      .on('contextmenu', (event, d: any) => {
        event.preventDefault();
        const rel = relationships.find(r => r.id === d.relId) ??
          relationships.find(r =>
            (r.personId === (d.source.id ?? d.source) && r.relatedPersonId === (d.target.id ?? d.target)) ||
            (r.personId === (d.target.id ?? d.target) && r.relatedPersonId === (d.source.id ?? d.source))
          );
        if (rel) setContextMenu({ visible: true, x: event.clientX, y: event.clientY, relationship: rel });
      });

    // Labels only for non-parent-child links (parent-child is obvious from hierarchy)
    const linkLabels = linkGroup.selectAll('text.link-label')
      .data(nonPcLinks.filter(l => l.category === 'spouse')).enter().append('text')
      .attr('class', 'link-label')
      .attr('font-size', '10px').attr('font-weight', '500')
      .attr('fill', d => getCategoryForType(d.type)?.color ?? '#666')
      .attr('text-anchor', 'middle').attr('dy', -6).attr('opacity', 0)
      .text(d => getCategoryForType(d.type)?.label ?? d.type);

    // ── Family connectors: one compound path per couple → children ──
    const pcColor = REL_CATEGORIES.find(c => c.key === 'parent_child')?.color ?? '#6366f1';
    const familyConnectorGroup = g.append('g').attr('class', 'family-connectors');

    // Function to compute a family connector compound path from current node positions
    // Each family unit gets a unique junction Y offset to prevent horizontal bars from overlapping
    const computeFamilyPath = (fu: FamilyUnit, fuIndex: number): string => {
      const getPos = (id: string) => {
        const n = nodes.find(nn => nn.id === id) as any;
        return n ? { x: n.x ?? 0, y: n.y ?? 0 } : { x: 0, y: 0 };
      };
      const parentPositions = fu.parents.map(getPos);
      const childPositions = fu.children.map(getPos);
      if (parentPositions.length === 0 || childPositions.length === 0) return '';

      const parentMidX = parentPositions.reduce((s, p) => s + p.x, 0) / parentPositions.length;
      const parentY = parentPositions[0].y;
      const childY = childPositions[0].y;
      const gap = childY - parentY;
      // Stagger junction Y: base at 35% of gap, offset by 12px per family unit index
      const junctionY = parentY + gap * 0.35 + (fuIndex % 5) * 12;

      let path = '';
      // Vertical drop from parent midpoint to junction
      path += `M${parentMidX},${parentY + 35} L${parentMidX},${junctionY} `;

      // Horizontal bar: spans from parent midpoint to all children
      const allXs = [parentMidX, ...childPositions.map(c => c.x)];
      const minX = Math.min(...allXs);
      const maxX = Math.max(...allXs);
      if (minX !== maxX) {
        path += `M${minX},${junctionY} L${maxX},${junctionY} `;
      }

      // Vertical drops from junction bar to each child
      childPositions.forEach(c => {
        path += `M${c.x},${junctionY} L${c.x},${c.y - 35} `;
      });

      return path;
    };

    const familyPaths = familyConnectorGroup.selectAll('path.family-connector')
      .data(familyUnits).enter().append('path')
      .attr('class', 'family-connector')
      .attr('fill', 'none')
      .attr('stroke', pcColor)
      .attr('stroke-width', 2.5)
      .attr('opacity', 0.55)
      .attr('marker-end', 'url(#arrow-pc)')
      .attr('d', computeFamilyPath);

    linkSelRef.current = link;
    linkLabelSelRef.current = linkLabels;

    // ── Nodes ──
    const nodeRadius = 30;
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g').data(nodes).enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<SVGGElement, any>()
        .on('start', function (event, d) {
          if (layoutModeRef.current === 'force') {
            if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
          }
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', function (event, d) {
          d.x = event.x; d.y = event.y;
          d.fx = event.x; d.fy = event.y;
          // Move this node group
          d3.select(this).attr('transform', `translate(${d.x},${d.y})`);
          if (layoutModeRef.current === 'hierarchical') {
            link.attr('d', computeLinkPath);
            linkLabels.attr('x', (dd: any) => computeLinkLabelPos(dd).x).attr('y', (dd: any) => computeLinkLabelPos(dd).y);
            familyPaths.attr('d', computeFamilyPath);
          }
        })
        .on('end', function (event, d) {
          if (layoutModeRef.current === 'force') {
            if (!event.active) simulationRef.current?.alphaTarget(0);
            // Unpin so simulation can settle naturally
            d.fx = null; d.fy = null;
          }
          // In hierarchical mode, keep pinned at dragged position
          // (fx/fy already set from 'drag' handler)
        })
      );

    node.append('circle').attr('class', 'select-ring').attr('r', nodeRadius + 5).attr('fill', 'none').attr('stroke', 'transparent').attr('stroke-width', 3);
    node.append('circle').attr('class', 'main-circle').attr('r', nodeRadius)
      .attr('fill', d => d.isDeceased ? NODE_COLORS.deceased : NODE_COLORS[d.gender] ?? NODE_COLORS.other)
      .attr('stroke', '#fff').attr('stroke-width', 3).attr('filter', 'url(#shadow)');
    node.filter(d => !!d.isDeceased).append('line')
      .attr('x1', -nodeRadius * 0.5).attr('y1', -nodeRadius * 0.5).attr('x2', nodeRadius * 0.5).attr('y2', nodeRadius * 0.5)
      .attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 0.4).attr('pointer-events', 'none');
    node.append('text').attr('text-anchor', 'middle').attr('dy', '0.38em').attr('font-size', '16px').attr('font-weight', '700').attr('fill', 'white').attr('pointer-events', 'none')
      .text(d => d.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2));
    // Name label: split into first name / last name on two lines
    const nameLabel = node.append('text').attr('class', 'name-label').attr('text-anchor', 'middle').attr('font-size', '11px').attr('font-weight', '600').attr('fill', '#1e293b').attr('pointer-events', 'none');
    nameLabel.each(function (d: any) {
      const parts = d.name.trim().split(/\s+/);
      const el = d3.select(this);
      if (parts.length === 1) {
        el.append('tspan').attr('x', 0).attr('dy', nodeRadius + 14).text(parts[0]);
      } else {
        el.append('tspan').attr('x', 0).attr('dy', nodeRadius + 14).text(parts.slice(0, -1).join(' '));
        el.append('tspan').attr('x', 0).attr('dy', 13).text(parts[parts.length - 1]);
      }
    });
    node.append('text').attr('y', nodeRadius + 42).attr('text-anchor', 'middle').attr('font-size', '10px').attr('fill', '#94a3b8').attr('pointer-events', 'none')
      .text(d => { if (!d.birthDate) return ''; const y = new Date(d.birthDate).getFullYear(); if (d.isDeceased && d.deathDate) return `${y} - ${new Date(d.deathDate).getFullYear()}`; return `b. ${y}`; });

    nodeSelRef.current = node;

    // ── Click: hierarchical layout ──
    node.on('click', (event, d: any) => {
      event.stopPropagation();
      if (isTransitioningRef.current) return;
      isTransitioningRef.current = true;

      // Stop simulation
      simulationRef.current?.stop();
      layoutModeRef.current = 'hierarchical';

      // Compute hierarchical positions
      const hierPos = computeHierarchicalLayout(d.id, relationships, width / 2, height / 2);
      const connectedIds = new Set(Object.keys(hierPos));

      const DURATION = 800;

      // Animate nodes to hierarchical positions
      node.transition().duration(DURATION).ease(d3.easeCubicInOut)
        .attr('transform', (n: any) => {
          const pos = hierPos[n.id];
          if (pos) {
            n.x = pos.x; n.y = pos.y; n.fx = pos.x; n.fy = pos.y;
            return `translate(${pos.x},${pos.y})`;
          }
          n.fx = n.x; n.fy = n.y;
          return `translate(${n.x},${n.y})`;
        });

      // Animate non-parent-child links
      link.transition().duration(DURATION).ease(d3.easeCubicInOut)
        .attr('d', computeLinkPath)
        .attr('opacity', (l: any) => {
          const sid = (l.source as any).id ?? l.source;
          const tid = (l.target as any).id ?? l.target;
          return (connectedIds.has(sid) && connectedIds.has(tid)) ? 0.7 : 0.04;
        })
        .attr('stroke-width', (l: any) => {
          const sid = (l.source as any).id ?? l.source;
          const tid = (l.target as any).id ?? l.target;
          return (connectedIds.has(sid) && connectedIds.has(tid)) ? 3 : 0.5;
        });

      // Animate family connectors
      familyPaths.transition().duration(DURATION).ease(d3.easeCubicInOut)
        .attr('d', computeFamilyPath)
        .attr('opacity', (fu: FamilyUnit) => {
          const allConnected = [...fu.parents, ...fu.children].every(id => connectedIds.has(id));
          return allConnected ? 0.7 : 0.04;
        });

      // Spouse labels
      linkLabels.transition().duration(DURATION).ease(d3.easeCubicInOut)
        .attr('x', (dd: any) => computeLinkLabelPos(dd).x)
        .attr('y', (dd: any) => computeLinkLabelPos(dd).y)
        .attr('opacity', (l: any) => {
          const sid = (l.source as any).id ?? l.source;
          const tid = (l.target as any).id ?? l.target;
          return (connectedIds.has(sid) && connectedIds.has(tid)) ? 1 : 0;
        });

      // Dim/highlight nodes
      node.select('.main-circle').transition().duration(DURATION)
        .attr('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.12);
      node.select('.name-label').transition().duration(DURATION)
        .attr('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.08);
      node.select('.select-ring')
        .attr('stroke', (n: any) => n.id === d.id ? '#fbbf24' : connectedIds.has(n.id) ? '#fbbf2480' : 'transparent');

      // Detail panel
      const person = people.find(p => p.id === d.id);
      if (person) {
        setSelectedPerson({ person, relationships: getPersonRelationships(d.id) });
      }

      // Fit to view after transition
      setTimeout(() => {
        fitToView();
        isTransitioningRef.current = false;
      }, DURATION + 100);
    });

    // ── Background click: return to force layout ──
    svg.on('click', () => {
      if (isTransitioningRef.current) return;

      if (layoutModeRef.current === 'hierarchical') {
        isTransitioningRef.current = true;
        layoutModeRef.current = 'force';

        // Unpin all nodes
        nodes.forEach((n: any) => { n.fx = null; n.fy = null; });

        // Reset visual state
        node.select('.main-circle').transition().duration(400).attr('opacity', 1);
        node.select('.name-label').transition().duration(400).attr('opacity', 1);
        node.select('.select-ring').attr('stroke', 'transparent');
        link.transition().duration(400)
          .attr('opacity', 0.55)
          .attr('stroke-width', (dd: any) => dd.category === 'spouse' ? 2.5 : 1.8);
        familyPaths.transition().duration(400).attr('opacity', 0.55).attr('stroke-width', 2.5);
        linkLabels.transition().duration(400).attr('opacity', 0);

        // Restart simulation
        simulationRef.current?.alpha(0.5).restart();

        setTimeout(() => { isTransitioningRef.current = false; }, 500);
      }

      setSelectedPerson(null);
    });

    // ── Hover ──
    node.on('mouseover', function (_event, d: any) {
      if (layoutModeRef.current === 'hierarchical') return;
      const connIds = new Set<string>([d.id]);
      visibleLinks.forEach(l => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        if (sid === d.id) connIds.add(tid);
        if (tid === d.id) connIds.add(sid);
      });
      node.select('.main-circle').attr('opacity', (n: any) => connIds.has(n.id) ? 1 : 0.3);
      link.attr('opacity', (l: any) => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        return (sid === d.id || tid === d.id) ? 0.9 : 0.1;
      });
      // Highlight family connectors involving this person
      familyPaths.attr('opacity', (fu: FamilyUnit) => {
        return fu.parents.includes(d.id) || fu.children.includes(d.id) ? 0.9 : 0.1;
      });
      // Show spouse labels on hover
      linkLabels.attr('opacity', (l: any) => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        return (sid === d.id || tid === d.id) ? 1 : 0;
      });
    })
    .on('mouseout', function () {
      if (layoutModeRef.current === 'hierarchical') return;
      node.select('.main-circle').attr('opacity', 1);
      link.attr('opacity', 0.55);
      familyPaths.attr('opacity', 0.55);
      linkLabels.attr('opacity', 0);
    });

    // ── Force simulation ──
    // Group nodes by generation to assign spread-out X targets
    const genMembers = new Map<number, string[]>();
    Object.entries(generations).forEach(([id, gen]) => {
      if (!genMembers.has(gen)) genMembers.set(gen, []);
      genMembers.get(gen)!.push(id);
    });

    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(visibleLinks as any).id((d: any) => d.id).distance(280).strength(0.3))
      .force('charge', d3.forceManyBody().strength(-1200))
      .force('collide', d3.forceCollide(nodeRadius + 70))
      .force('y', d3.forceY((d: any) => (generations[d.id] ?? 0) * genSpacing + genSpacing).strength(0.95))
      .force('x', d3.forceX((d: any) => {
        // Spouses attract to each other
        const sp = spousePairs.get(d.id);
        if (sp) {
          const sn = nodes.find(n => n.id === sp);
          if (sn && (sn as any).x) return (sn as any).x;
        }
        // Spread nodes across the width based on their position in their generation
        const gen = generations[d.id] ?? 0;
        const members = genMembers.get(gen) ?? [d.id];
        const idx = members.indexOf(d.id);
        const count = members.length;
        if (count <= 1) return width / 2;
        const spacing = Math.min(300, (width - 200) / count);
        return (width / 2) - ((count - 1) * spacing / 2) + idx * spacing;
      }).strength(0.12))
      .alpha(0.8).alphaDecay(0.02);

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      if (layoutModeRef.current !== 'force') return;
      link.attr('d', computeLinkPath);
      linkLabels.attr('x', (d: any) => computeLinkLabelPos(d).x).attr('y', (d: any) => computeLinkLabelPos(d).y);
      familyPaths.attr('d', computeFamilyPath);
      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    simulation.on('end', () => { if (layoutModeRef.current === 'force') fitToView(); });

    return () => { simulation.stop(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [people, relationships, width, height, visibleCategories]);

  // ── Controls ──
  const handleZoom = useCallback((f: number) => {
    if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, f);
  }, []);

  const handleCenter = useCallback(() => {
    if (zoomRef.current && svgRef.current) d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
  }, []);

  const fitToView = useCallback(() => {
    if (!gRef.current || !svgRef.current || !zoomRef.current) return;
    const bounds = gRef.current.getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;
    const pad = 80;
    const scale = Math.min((width - pad * 2) / bounds.width, (height - pad * 2) / bounds.height, 2.0);
    const tx = width / 2 - scale * (bounds.x + bounds.width / 2);
    const ty = height / 2 - scale * (bounds.y + bounds.height / 2);
    d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.translate(tx, ty).scale(scale));
  }, [width, height]);

  // ── Export helpers ──
  const freezeTransitions = useCallback(() => {
    if (svgRef.current) d3.select(svgRef.current).selectAll('*').interrupt();
  }, []);

  const buildExportClone = useCallback((opts: { includeRelList?: boolean } = {}) => {
    if (!svgRef.current || !gRef.current) return null;
    freezeTransitions();

    const bounds = gRef.current.getBBox();
    const pad = 60;
    const legendHeight = 80;
    const relListWidth = opts.includeRelList && selectedPerson ? 260 : 0;
    const titleHeight = selectedPerson ? 50 : 30;
    const totalWidth = bounds.width + pad * 2 + relListWidth;
    const totalHeight = bounds.height + pad * 2 + titleHeight + legendHeight;

    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
    clone.setAttribute('width', String(totalWidth));
    clone.setAttribute('height', String(totalHeight));
    clone.removeAttribute('class');
    clone.removeAttribute('style');

    const graphG = clone.querySelector('.graph');
    if (graphG) { graphG.removeAttribute('transform'); graphG.setAttribute('transform', `translate(${-bounds.x + pad},${-bounds.y + pad + titleHeight})`); }
    clone.setAttribute('viewBox', `0 0 ${totalWidth} ${totalHeight}`);

    // Background
    const bg = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    bg.setAttribute('width', String(totalWidth)); bg.setAttribute('height', String(totalHeight)); bg.setAttribute('fill', 'white');
    clone.insertBefore(bg, clone.firstChild);

    // Title
    const titleG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    const titleText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
    titleText.setAttribute('x', String(pad)); titleText.setAttribute('y', '32'); titleText.setAttribute('font-size', '20'); titleText.setAttribute('font-weight', '700'); titleText.setAttribute('fill', '#1e293b'); titleText.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
    titleText.textContent = selectedPerson ? `Family of ${selectedPerson.person.name}` : 'Family Tree';
    titleG.appendChild(titleText);
    if (selectedPerson) {
      const sub = document.createElementNS('http://www.w3.org/2000/svg', 'text');
      sub.setAttribute('x', String(pad)); sub.setAttribute('y', '48'); sub.setAttribute('font-size', '12'); sub.setAttribute('fill', '#94a3b8'); sub.setAttribute('font-family', 'system-ui, -apple-system, sans-serif');
      const parts: string[] = [];
      if (selectedPerson.person.birthDate) parts.push(`b. ${new Date(selectedPerson.person.birthDate).getFullYear()}`);
      if (selectedPerson.person.birthPlace) parts.push(selectedPerson.person.birthPlace);
      sub.textContent = parts.join(' · ');
      titleG.appendChild(sub);
    }
    clone.appendChild(titleG);

    // Legend
    const legendY = totalHeight - legendHeight + 10;
    const legendG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
    legendG.setAttribute('transform', `translate(${pad},${legendY})`);
    const div = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    div.setAttribute('x1', '0'); div.setAttribute('y1', '-5'); div.setAttribute('x2', String(totalWidth - pad * 2)); div.setAttribute('y2', '-5'); div.setAttribute('stroke', '#e2e8f0'); div.setAttribute('stroke-width', '1');
    legendG.appendChild(div);

    [{ color: NODE_COLORS.male, label: 'Male' }, { color: NODE_COLORS.female, label: 'Female' }, { color: NODE_COLORS.deceased, label: 'Deceased' }].forEach((item, i) => {
      const cx = i * 80;
      const c = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); c.setAttribute('cx', String(cx + 6)); c.setAttribute('cy', '10'); c.setAttribute('r', '5'); c.setAttribute('fill', item.color); legendG.appendChild(c);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', String(cx + 16)); t.setAttribute('y', '14'); t.setAttribute('font-size', '11'); t.setAttribute('fill', '#64748b'); t.setAttribute('font-family', 'system-ui, -apple-system, sans-serif'); t.textContent = item.label; legendG.appendChild(t);
    });

    REL_CATEGORIES.filter(c => visibleCategories.has(c.key)).forEach((cat, i) => {
      const cx = i * 110; const ly = 35;
      const l = document.createElementNS('http://www.w3.org/2000/svg', 'line'); l.setAttribute('x1', String(cx)); l.setAttribute('y1', String(ly)); l.setAttribute('x2', String(cx + 22)); l.setAttribute('y2', String(ly)); l.setAttribute('stroke', cat.color); l.setAttribute('stroke-width', '2.5'); if (cat.dash) l.setAttribute('stroke-dasharray', cat.dash); legendG.appendChild(l);
      const t = document.createElementNS('http://www.w3.org/2000/svg', 'text'); t.setAttribute('x', String(cx + 28)); t.setAttribute('y', String(ly + 4)); t.setAttribute('font-size', '11'); t.setAttribute('fill', '#64748b'); t.setAttribute('font-family', 'system-ui, -apple-system, sans-serif'); t.textContent = cat.label; legendG.appendChild(t);
    });
    clone.appendChild(legendG);

    // Relationship list sidebar
    if (opts.includeRelList && selectedPerson && selectedPerson.relationships.length > 0) {
      const listX = totalWidth - relListWidth + 10;
      const listG = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      listG.setAttribute('transform', `translate(${listX},${titleHeight + pad})`);
      const listBg = document.createElementNS('http://www.w3.org/2000/svg', 'rect'); listBg.setAttribute('x', '-10'); listBg.setAttribute('y', '-10'); listBg.setAttribute('width', String(relListWidth - 10)); listBg.setAttribute('height', String(Math.min(selectedPerson.relationships.length * 22 + 40, bounds.height))); listBg.setAttribute('fill', '#f8fafc'); listBg.setAttribute('rx', '8'); listBg.setAttribute('stroke', '#e2e8f0'); listG.appendChild(listBg);
      const hdr = document.createElementNS('http://www.w3.org/2000/svg', 'text'); hdr.setAttribute('y', '8'); hdr.setAttribute('font-size', '13'); hdr.setAttribute('font-weight', '600'); hdr.setAttribute('fill', '#1e293b'); hdr.setAttribute('font-family', 'system-ui, -apple-system, sans-serif'); hdr.textContent = `Relationships (${selectedPerson.relationships.length})`; listG.appendChild(hdr);
      selectedPerson.relationships.forEach((rel, i) => {
        const y = 30 + i * 22; const cat = getCategoryForType(rel.type);
        const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('cx', '4'); dot.setAttribute('cy', String(y)); dot.setAttribute('r', '3'); dot.setAttribute('fill', cat?.color ?? '#999'); listG.appendChild(dot);
        const tt = document.createElementNS('http://www.w3.org/2000/svg', 'text'); tt.setAttribute('x', '14'); tt.setAttribute('y', String(y + 4)); tt.setAttribute('font-size', '11'); tt.setAttribute('fill', '#94a3b8'); tt.setAttribute('font-family', 'system-ui, -apple-system, sans-serif'); tt.textContent = rel.type; listG.appendChild(tt);
        const nt = document.createElementNS('http://www.w3.org/2000/svg', 'text'); nt.setAttribute('x', '90'); nt.setAttribute('y', String(y + 4)); nt.setAttribute('font-size', '11'); nt.setAttribute('font-weight', '500'); nt.setAttribute('fill', '#1e293b'); nt.setAttribute('font-family', 'system-ui, -apple-system, sans-serif'); nt.textContent = rel.name; listG.appendChild(nt);
      });
      clone.appendChild(listG);
    }

    return { clone, totalWidth, totalHeight, bounds, pad, titleHeight };
  }, [freezeTransitions, selectedPerson, visibleCategories]);

  const exportSVG = useCallback(() => {
    if (isTransitioningRef.current) return;
    const result = buildExportClone(); if (!result) return;
    const svgData = new XMLSerializer().serializeToString(result.clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const suffix = selectedPerson ? `_${selectedPerson.person.name.replace(/\s+/g, '_')}` : '';
    a.download = `family_tree${suffix}_${new Date().toISOString().split('T')[0]}.svg`; a.href = url; a.click(); URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, [buildExportClone, selectedPerson]);

  const exportPNG = useCallback(async () => {
    if (isTransitioningRef.current) return;
    const result = buildExportClone(); if (!result) return;
    setExporting(true);
    try {
      const { clone, totalWidth, totalHeight } = result;
      const scale = 2;
      const canvas = document.createElement('canvas'); canvas.width = totalWidth * scale; canvas.height = totalHeight * scale;
      const ctx = canvas.getContext('2d')!; ctx.scale(scale, scale); ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, totalWidth, totalHeight);
      const svgData = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' }); const url = URL.createObjectURL(blob);
      await new Promise<void>((resolve, reject) => {
        img.onload = () => { ctx.drawImage(img, 0, 0, totalWidth, totalHeight); URL.revokeObjectURL(url); const pngUrl = canvas.toDataURL('image/png'); const a = document.createElement('a'); const suffix = selectedPerson ? `_${selectedPerson.person.name.replace(/\s+/g, '_')}` : ''; a.download = `family_tree${suffix}_${new Date().toISOString().split('T')[0]}.png`; a.href = pngUrl; a.click(); resolve(); };
        img.onerror = reject; img.src = url;
      });
    } finally { setExporting(false); setShowExportMenu(false); }
  }, [buildExportClone, selectedPerson]);

  const printView = useCallback(() => {
    if (isTransitioningRef.current) return;
    const result = buildExportClone({ includeRelList: true }); if (!result) return;
    const { clone } = result; clone.setAttribute('width', '100%'); clone.setAttribute('height', ''); clone.style.maxHeight = '100vh';
    const title = selectedPerson ? `Family Tree — ${selectedPerson.person.name}` : 'Family Tree';
    const pw = window.open('', '_blank');
    if (pw) {
      pw.document.write(`<!DOCTYPE html><html><head><title>${title}</title><style>body{margin:20px;background:white;font-family:system-ui,-apple-system,sans-serif}svg{width:100%;height:auto;max-height:90vh;display:block}@media print{body{margin:10px}svg{width:100%;height:auto;page-break-inside:avoid}}</style></head><body>${clone.outerHTML}</body></html>`);
      pw.document.close(); setTimeout(() => pw.print(), 500);
    }
    setShowExportMenu(false);
  }, [buildExportClone, selectedPerson]);

  const handleSearchSelect = (personId: string) => {
    setSearchOpen(false); setSearchValue('');
    if (gRef.current && zoomRef.current && svgRef.current) {
      const nd = d3.select(gRef.current).selectAll<SVGGElement, any>('.nodes g').filter((d: any) => d.id === personId);
      if (!nd.empty()) {
        const d: any = nd.datum(); const scale = 1.2;
        d3.select(svgRef.current).transition().duration(500).call(zoomRef.current.transform, d3.zoomIdentity.translate(width / 2 - scale * d.x, height / 2 - scale * d.y).scale(scale));
        nd.select('.select-ring').attr('stroke', '#fbbf24').transition().duration(2000).attr('stroke', 'transparent');
      }
    }
  };

  const handleDeleteRelationship = () => {
    if (contextMenu.relationship && onDeleteRelationship) { onDeleteRelationship(contextMenu.relationship.id); setContextMenu(prev => ({ ...prev, visible: false })); }
  };

  if (people.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center"><p className="text-lg font-medium mb-2">No family members yet</p><p className="text-sm">Add people to see the family tree visualization</p></div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg ref={svgRef} width={width} height={height} className="bg-white" style={{ width: '100%', height: '100%' }} />

      {/* Legend + Filters */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg shadow border px-3 py-2.5 text-xs max-w-[280px] z-20">
        <div className="font-semibold text-gray-700 mb-2">Show / Hide Relationships</div>
        <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.male }} /> Male</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.female }} /> Female</div>
          <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.deceased }} /> Deceased</div>
        </div>
        <div className="space-y-1">
          {REL_CATEGORIES.map(cat => (
            <label key={cat.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
              <input type="checkbox" checked={visibleCategories.has(cat.key)} onChange={() => toggleCategory(cat.key)} className="rounded border-gray-300" />
              <svg width="24" height="10" className="shrink-0"><line x1="0" y1="5" x2="24" y2="5" stroke={cat.color} strokeWidth="2.5" strokeDasharray={cat.dash || 'none'} /></svg>
              <span className="text-gray-700">{cat.label}</span>
            </label>
          ))}
        </div>
        <div className="mt-2 pt-2 border-t border-gray-100 text-gray-400">Click a person for hierarchy view</div>
      </div>

      {/* Selected Person Detail Panel */}
      {selectedPerson && (
        <div className="absolute bottom-3 right-14 bg-white/95 backdrop-blur-sm rounded-lg shadow-lg border w-72 max-h-[320px] overflow-y-auto z-20">
          <div className="sticky top-0 bg-white border-b px-3 py-2 flex items-center justify-between">
            <div>
              <div className="font-semibold text-sm">{selectedPerson.person.name}</div>
              <div className="text-xs text-muted-foreground capitalize">
                {selectedPerson.person.gender}
                {selectedPerson.person.birthDate && ` · b. ${new Date(selectedPerson.person.birthDate).getFullYear()}`}
                {selectedPerson.person.birthPlace && ` · ${selectedPerson.person.birthPlace}`}
              </div>
            </div>
            <button onClick={() => setSelectedPerson(null)} className="p-1 hover:bg-gray-100 rounded"><X className="w-3.5 h-3.5" /></button>
          </div>
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-gray-500 mb-1">Relationships ({selectedPerson.relationships.length})</div>
            {selectedPerson.relationships.length === 0 ? (
              <div className="text-xs text-gray-400 py-2">No relationships found</div>
            ) : (
              <div className="space-y-1">
                {selectedPerson.relationships.map((rel, i) => {
                  const cat = getCategoryForType(rel.type);
                  return (
                    <div key={i} className="flex items-center gap-2 text-xs py-0.5">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ background: cat?.color ?? '#999' }} />
                      <span className="text-gray-500 w-20 shrink-0 capitalize">{rel.type}</span>
                      <span className="font-medium text-gray-800 truncate">{rel.name}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="absolute top-3 left-3 z-30">
        <button className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Search" onClick={() => setSearchOpen(v => !v)}><Search className="w-4 h-4" /></button>
        {searchOpen && (
          <div className="mt-1 bg-white border rounded-lg shadow-lg p-2 w-64">
            <input type="text" className="w-full border rounded px-2 py-1 mb-1 text-sm" placeholder="Search by name..." value={searchValue} onChange={e => setSearchValue(e.target.value)} autoFocus />
            <div className="max-h-40 overflow-y-auto">
              {people.filter(p => p.name.toLowerCase().includes(searchValue.toLowerCase())).map(p => (
                <div key={p.id} className="px-2 py-1 hover:bg-indigo-50 cursor-pointer rounded text-sm" onClick={() => handleSearchSelect(p.id)}>{p.name}</div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Zoom + Export Controls */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        <button onClick={() => handleZoom(1.3)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => handleZoom(1 / 1.3)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={handleCenter} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Reset View"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={fitToView} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Fit to View"><Maximize2 className="w-4 h-4" /></button>
        <div className="relative">
          <button onClick={() => setShowExportMenu(v => !v)} className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 border border-indigo-700" title="Export / Print"><Download className="w-4 h-4" /></button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 w-56 z-50">
              {selectedPerson && <div className="px-3 py-1.5 text-xs text-indigo-600 font-medium border-b border-gray-100">Exporting: {selectedPerson.person.name}'s family</div>}
              <button onClick={printView} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><Printer className="w-4 h-4" /> Print / Save as PDF</button>
              <button onClick={exportPNG} disabled={exporting} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50"><FileDown className="w-4 h-4" /> Export as PNG</button>
              <button onClick={exportSVG} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"><FileDown className="w-4 h-4" /> Export as SVG</button>
              {!selectedPerson && <div className="px-3 py-1.5 text-xs text-gray-400 border-t border-gray-100">Tip: Click a person first to export their family view</div>}
            </div>
          )}
        </div>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && contextMenu.relationship && (
        <div className="absolute z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[180px]" style={{ left: contextMenu.x, top: contextMenu.y, transform: 'translate(-50%, -110%)' }} onClick={e => e.stopPropagation()}>
          <div className="px-3 py-2 border-b">
            <div className="text-xs text-gray-500 capitalize">{contextMenu.relationship.relationshipType}</div>
            <div className="text-sm font-medium">{people.find(p => p.id === contextMenu.relationship?.personId)?.name} &rarr; {people.find(p => p.id === contextMenu.relationship?.relatedPersonId)?.name}</div>
          </div>
          <button onClick={handleDeleteRelationship} className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50">Delete Relationship</button>
        </div>
      )}
    </div>
  );
};
