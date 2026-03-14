import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import * as d3 from 'd3';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Download, Search, X, Printer, FileDown } from 'lucide-react';

interface D3NetworkGraphProps {
  people: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
  onDeleteRelationship?: (relationshipId: string) => void;
  onUpdateRelationship?: (relationship: Relationship) => void;
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

// ── Relationship categories for filtering ──
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

const NODE_COLORS = {
  male: '#3b82f6',
  female: '#ec4899',
  other: '#8b5cf6',
  deceased: '#9ca3af',
};

const getCategoryForType = (type: string) => REL_CATEGORIES.find(c => c.types.includes(type));

// ── Generation assignment via BFS from roots ──
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
        const spouseId = r.personId === id ? r.relatedPersonId : (r.relatedPersonId === id ? r.personId : null);
        if (spouseId && !visited.has(spouseId)) queue.unshift({ id: spouseId, gen });
      }
    });

    (childOf.get(id) ?? []).forEach(childId => {
      if (!visited.has(childId)) queue.push({ id: childId, gen: gen + 1 });
    });
  }

  people.forEach(p => { if (!(p.id in generations)) generations[p.id] = 0; });
  return generations;
}

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
        links.push({
          source: rel.personId, target: rel.relatedPersonId,
          type: rel.relationshipType, relId: rel.id,
          category: cat?.key ?? 'in_law',
        });
      }
    }
  });

  return links;
}

// ── Spouse pair detection for horizontal layout ──
function getSpousePairs(relationships: Relationship[]): Map<string, string> {
  const pairs = new Map<string, string>();
  const seen = new Set<string>();
  relationships.forEach(r => {
    if (r.relationshipType === 'spouse') {
      const key = [r.personId, r.relatedPersonId].sort().join('-');
      if (!seen.has(key)) {
        seen.add(key);
        pairs.set(r.personId, r.relatedPersonId);
        pairs.set(r.relatedPersonId, r.personId);
      }
    }
  });
  return pairs;
}

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

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({ visible: false, x: 0, y: 0 });
  const [exporting, setExporting] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const [selectedPerson, setSelectedPerson] = useState<SelectedPersonInfo | null>(null);
  const [visibleCategories, setVisibleCategories] = useState<Set<RelCategory>>(
    new Set(['parent_child', 'spouse', 'sibling'])
  );
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Close menus on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  const toggleCategory = useCallback((cat: RelCategory) => {
    setVisibleCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  }, []);

  // Build person relationships for the detail panel
  const getPersonRelationships = useCallback((personId: string): SelectedPersonInfo['relationships'] => {
    const rels: SelectedPersonInfo['relationships'] = [];
    const seen = new Set<string>();

    relationships.forEach(r => {
      if (r.personId === personId) {
        const key = `${r.relatedPersonId}-${r.relationshipType}`;
        if (!seen.has(key)) {
          seen.add(key);
          const person = people.find(p => p.id === r.relatedPersonId);
          if (person) {
            rels.push({ type: r.relationshipType, name: person.name, personId: person.id });
          }
        }
      } else if (r.relatedPersonId === personId) {
        const reverseType = r.relationshipType === 'parent' ? 'child' :
          r.relationshipType === 'child' ? 'parent' : r.relationshipType;
        const key = `${r.personId}-${reverseType}`;
        if (!seen.has(key)) {
          seen.add(key);
          const person = people.find(p => p.id === r.personId);
          if (person) {
            rels.push({ type: reverseType, name: person.name, personId: person.id });
          }
        }
      }
    });

    // Sort: spouse first, then parents, children, siblings, others
    const order: Record<string, number> = { spouse: 0, parent: 1, child: 2, sibling: 3 };
    rels.sort((a, b) => (order[a.type] ?? 10) - (order[b.type] ?? 10));
    return rels;
  }, [people, relationships]);

  // ── Main D3 render ──
  useEffect(() => {
    if (!svgRef.current || people.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    const nodes = people.map(p => ({ ...p }));
    const allLinks = buildLinks(relationships);
    const visibleLinks = allLinks.filter(l => visibleCategories.has(l.category));
    const generations = assignGenerations(people, relationships);
    const spousePairs = getSpousePairs(relationships);

    // Count generations for spacing
    const genValues = Object.values(generations);
    const maxGen = Math.max(...genValues, 0);
    const genSpacing = Math.max(220, height / (maxGen + 2));

    // ── SVG defs ──
    const defs = svg.append('defs');
    defs.html(`
      <marker id="arrow-pc" viewBox="0 0 10 6" refX="38" refY="3" markerWidth="7" markerHeight="5" orient="auto">
        <path d="M0,0 L10,3 L0,6 Z" fill="#6366f1" opacity="0.6"/>
      </marker>
      <filter id="shadow" x="-30%" y="-30%" width="160%" height="160%">
        <feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="#000" flood-opacity="0.08"/>
      </filter>
    `);

    const g = svg.append('g').attr('class', 'graph');
    gRef.current = g.node();

    // Zoom
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on('zoom', (event) => g.attr('transform', event.transform));
    zoomRef.current = zoom;
    svg.call(zoom as any);

    // ── Links ──
    const linkGroup = g.append('g').attr('class', 'links');

    const link = linkGroup.selectAll('path.link-line')
      .data(visibleLinks)
      .enter().append('path')
      .attr('class', 'link-line')
      .attr('fill', 'none')
      .attr('stroke', d => getCategoryForType(d.type)?.color ?? '#a3a3a3')
      .attr('stroke-width', d => d.category === 'parent_child' ? 2.5 : d.category === 'spouse' ? 2.5 : 1.8)
      .attr('stroke-dasharray', d => getCategoryForType(d.type)?.dash ?? '')
      .attr('opacity', 0.55)
      .attr('marker-end', d => d.category === 'parent_child' ? 'url(#arrow-pc)' : '')
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

    // Link labels (hidden by default, shown on hover/click)
    const linkLabels = linkGroup.selectAll('text.link-label')
      .data(visibleLinks)
      .enter().append('text')
      .attr('class', 'link-label')
      .attr('font-size', '10px')
      .attr('font-weight', '500')
      .attr('fill', d => getCategoryForType(d.type)?.color ?? '#666')
      .attr('text-anchor', 'middle')
      .attr('dy', -6)
      .attr('opacity', 0) // hidden by default to reduce clutter
      .text(d => {
        const cat = getCategoryForType(d.type);
        return cat?.label ?? d.type;
      });

    // ── Nodes ──
    const nodeRadius = 30;
    const node = g.append('g').attr('class', 'nodes')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .call(d3.drag<any, any>()
        .on('start', (event, d) => {
          if (!event.active) simulationRef.current?.alphaTarget(0.3).restart();
          d.fx = d.x; d.fy = d.y;
        })
        .on('drag', (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on('end', (event, d) => {
          if (!event.active) simulationRef.current?.alphaTarget(0);
          d.fx = event.x; d.fy = event.y;
        })
      );

    // Outer glow ring for selected
    node.append('circle')
      .attr('class', 'select-ring')
      .attr('r', nodeRadius + 5)
      .attr('fill', 'none')
      .attr('stroke', 'transparent')
      .attr('stroke-width', 3);

    // Main circle
    node.append('circle')
      .attr('class', 'main-circle')
      .attr('r', nodeRadius)
      .attr('fill', d => d.isDeceased ? NODE_COLORS.deceased : (NODE_COLORS as any)[d.gender] ?? NODE_COLORS.other)
      .attr('stroke', '#fff')
      .attr('stroke-width', 3)
      .attr('filter', 'url(#shadow)');

    // Deceased indicator
    node.filter(d => !!d.isDeceased)
      .append('line')
      .attr('x1', -nodeRadius * 0.5).attr('y1', -nodeRadius * 0.5)
      .attr('x2', nodeRadius * 0.5).attr('y2', nodeRadius * 0.5)
      .attr('stroke', '#fff').attr('stroke-width', 2).attr('opacity', 0.4)
      .attr('pointer-events', 'none');

    // Initials
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.38em')
      .attr('font-size', '16px')
      .attr('font-weight', '700')
      .attr('fill', 'white')
      .attr('pointer-events', 'none')
      .text(d => d.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2));

    // Name label
    node.append('text')
      .attr('class', 'name-label')
      .attr('y', nodeRadius + 16)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('font-weight', '600')
      .attr('fill', '#1e293b')
      .attr('pointer-events', 'none')
      .text(d => d.name);

    // Years label
    node.append('text')
      .attr('y', nodeRadius + 29)
      .attr('text-anchor', 'middle')
      .attr('font-size', '10px')
      .attr('fill', '#94a3b8')
      .attr('pointer-events', 'none')
      .text(d => {
        if (!d.birthDate) return '';
        const year = new Date(d.birthDate).getFullYear();
        if (d.isDeceased && d.deathDate) return `${year} - ${new Date(d.deathDate).getFullYear()}`;
        return `b. ${year}`;
      });

    // ── Click: select node, show relationships, highlight connected ──
    node.on('click', (event, d: any) => {
      event.stopPropagation();
      const connectedIds = new Set<string>([d.id]);
      const connectedLinkIndices = new Set<number>();

      visibleLinks.forEach((l, i) => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        if (sid === d.id || tid === d.id) {
          connectedIds.add(sid);
          connectedIds.add(tid);
          connectedLinkIndices.add(i);
        }
      });

      // Dim non-connected nodes
      node.select('.main-circle')
        .transition().duration(200)
        .attr('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.2);
      node.select('.name-label')
        .transition().duration(200)
        .attr('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.15);
      node.select('.select-ring')
        .attr('stroke', (n: any) => n.id === d.id ? '#fbbf24' : connectedIds.has(n.id) ? '#fbbf2480' : 'transparent');

      // Highlight connected links, show their labels
      link.transition().duration(200)
        .attr('opacity', (l: any, i: number) => connectedLinkIndices.has(i) ? 0.9 : 0.06)
        .attr('stroke-width', (l: any, i: number) => connectedLinkIndices.has(i) ? 3.5 : 1);
      linkLabels.transition().duration(200)
        .attr('opacity', (l: any, i: number) => connectedLinkIndices.has(i) ? 1 : 0)
        .attr('font-size', (l: any, i: number) => connectedLinkIndices.has(i) ? '11px' : '10px');

      // Show detail panel
      const person = people.find(p => p.id === d.id);
      if (person) {
        setSelectedPerson({
          person,
          relationships: getPersonRelationships(d.id),
        });
      }
    });

    // Click on background to deselect
    svg.on('click', () => {
      node.select('.main-circle').transition().duration(200).attr('opacity', 1);
      node.select('.name-label').transition().duration(200).attr('opacity', 1);
      node.select('.select-ring').attr('stroke', 'transparent');
      link.transition().duration(200)
        .attr('opacity', 0.55)
        .attr('stroke-width', (d: any) => d.category === 'parent_child' ? 2.5 : d.category === 'spouse' ? 2.5 : 1.8);
      linkLabels.transition().duration(200).attr('opacity', 0);
      setSelectedPerson(null);
    });

    // Hover: subtle highlight without changing selection
    node.on('mouseover', function (event, d: any) {
      if (selectedPerson) return; // don't override click selection
      const connectedIds = new Set<string>([d.id]);
      visibleLinks.forEach(l => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        if (sid === d.id) connectedIds.add(tid);
        if (tid === d.id) connectedIds.add(sid);
      });
      node.select('.main-circle')
        .attr('opacity', (n: any) => connectedIds.has(n.id) ? 1 : 0.3);
      link.attr('opacity', (l: any) => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        return (sid === d.id || tid === d.id) ? 0.9 : 0.1;
      });
      linkLabels.attr('opacity', (l: any) => {
        const sid = (l.source as any).id ?? l.source;
        const tid = (l.target as any).id ?? l.target;
        return (sid === d.id || tid === d.id) ? 1 : 0;
      });
    })
    .on('mouseout', function () {
      if (selectedPerson) return;
      node.select('.main-circle').attr('opacity', 1);
      link.attr('opacity', 0.55);
      linkLabels.attr('opacity', 0);
    });

    // ── Simulation ──
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(visibleLinks as any).id((d: any) => d.id).distance(200).strength(0.5))
      .force('charge', d3.forceManyBody().strength(-500))
      .force('center', d3.forceCenter(width / 2, height / 2).strength(0.02))
      .force('collide', d3.forceCollide(nodeRadius + 40))
      // Vertical layering by generation
      .force('y', d3.forceY((d: any) => (generations[d.id] ?? 0) * genSpacing + genSpacing).strength(0.9))
      // Gentle horizontal centering
      .force('x', d3.forceX((d: any) => {
        // Pull spouses together
        const spouseId = spousePairs.get(d.id);
        if (spouseId) {
          const spouseNode = nodes.find(n => n.id === spouseId);
          if (spouseNode && (spouseNode as any).x) return (spouseNode as any).x;
        }
        return width / 2;
      }).strength(0.05))
      .alpha(0.8)
      .alphaDecay(0.025);

    simulationRef.current = simulation;

    simulation.on('tick', () => {
      link.attr('d', (d: any) => {
        const sx = d.source.x, sy = d.source.y;
        const tx = d.target.x, ty = d.target.y;
        if (d.category === 'spouse') {
          return `M${sx},${sy} L${tx},${ty}`;
        }
        if (d.category === 'parent_child') {
          // Smooth S-curve top to bottom
          const my = (sy + ty) / 2;
          return `M${sx},${sy} C${sx},${my} ${tx},${my} ${tx},${ty}`;
        }
        // Curved arc for sibling/cousin/etc (offset to avoid overlap with vertical lines)
        const dx = tx - sx;
        const dy = ty - sy;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const bend = dist * 0.2;
        const mx = (sx + tx) / 2 - (dy / dist) * bend;
        const my = (sy + ty) / 2 + (dx / dist) * bend;
        return `M${sx},${sy} Q${mx},${my} ${tx},${ty}`;
      });

      linkLabels
        .attr('x', (d: any) => (d.source.x + d.target.x) / 2)
        .attr('y', (d: any) => {
          if (d.category === 'parent_child') return (d.source.y + d.target.y) / 2 - 6;
          // Offset for curved links
          const dx = d.target.x - d.source.x;
          const dy = d.target.y - d.source.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const bend = dist * 0.2;
          return (d.source.y + d.target.y) / 2 + (dx / dist) * bend - 6;
        });

      node.attr('transform', (d: any) => `translate(${d.x},${d.y})`);
    });

    simulation.on('end', () => fitToView());

    return () => { simulation.stop(); };
  }, [people, relationships, width, height, visibleCategories, getPersonRelationships]);

  // ── Controls ──
  const handleZoom = useCallback((factor: number) => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.scaleBy, factor);
    }
  }, []);

  const handleCenter = useCallback(() => {
    if (zoomRef.current && svgRef.current) {
      d3.select(svgRef.current).transition().duration(300).call(zoomRef.current.transform, d3.zoomIdentity);
    }
  }, []);

  const fitToView = useCallback(() => {
    if (!gRef.current || !svgRef.current || !zoomRef.current) return;
    const bounds = gRef.current.getBBox();
    if (bounds.width === 0 || bounds.height === 0) return;
    const pad = 80;
    const scale = Math.min(
      (width - pad * 2) / bounds.width,
      (height - pad * 2) / bounds.height,
      1.0
    );
    const tx = width / 2 - scale * (bounds.x + bounds.width / 2);
    const ty = height / 2 - scale * (bounds.y + bounds.height / 2);
    d3.select(svgRef.current).transition().duration(500).call(
      zoomRef.current.transform,
      d3.zoomIdentity.translate(tx, ty).scale(scale)
    );
  }, [width, height]);

  // ── Export ──
  const exportSVG = useCallback(() => {
    if (!svgRef.current) return;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    // Expand viewBox to fit content
    if (gRef.current) {
      const bounds = gRef.current.getBBox();
      const pad = 40;
      clone.setAttribute('viewBox', `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`);
      clone.setAttribute('width', String(bounds.width + pad * 2));
      clone.setAttribute('height', String(bounds.height + pad * 2));
      // Remove the transform on <g class="graph"> so it renders at actual coords
      const gElem = clone.querySelector('.graph');
      if (gElem) gElem.removeAttribute('transform');
    }
    const svgData = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.download = `family_tree_${new Date().toISOString().split('T')[0]}.svg`;
    link.href = url;
    link.click();
    URL.revokeObjectURL(url);
    setShowExportMenu(false);
  }, []);

  const exportPNG = useCallback(async () => {
    if (!svgRef.current || !gRef.current) return;
    setExporting(true);
    try {
      const bounds = gRef.current.getBBox();
      const pad = 60;
      const exportWidth = bounds.width + pad * 2;
      const exportHeight = bounds.height + pad * 2;
      const scale = 2;

      const canvas = document.createElement('canvas');
      canvas.width = exportWidth * scale;
      canvas.height = exportHeight * scale;
      const ctx = canvas.getContext('2d')!;
      ctx.scale(scale, scale);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, exportWidth, exportHeight);

      const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
      clone.setAttribute('viewBox', `${bounds.x - pad} ${bounds.y - pad} ${exportWidth} ${exportHeight}`);
      clone.setAttribute('width', String(exportWidth));
      clone.setAttribute('height', String(exportHeight));
      const gElem = clone.querySelector('.graph');
      if (gElem) gElem.removeAttribute('transform');

      const svgData = new XMLSerializer().serializeToString(clone);
      const img = new Image();
      const blob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, 0, 0, exportWidth, exportHeight);
          URL.revokeObjectURL(url);
          const pngUrl = canvas.toDataURL('image/png');
          const link = document.createElement('a');
          link.download = `family_tree_${new Date().toISOString().split('T')[0]}.png`;
          link.href = pngUrl;
          link.click();
          resolve();
        };
        img.onerror = reject;
        img.src = url;
      });
    } finally {
      setExporting(false);
      setShowExportMenu(false);
    }
  }, []);

  const printView = useCallback(() => {
    if (!svgRef.current || !gRef.current) return;
    const bounds = gRef.current.getBBox();
    const pad = 60;
    const clone = svgRef.current.cloneNode(true) as SVGSVGElement;
    clone.setAttribute('viewBox', `${bounds.x - pad} ${bounds.y - pad} ${bounds.width + pad * 2} ${bounds.height + pad * 2}`);
    clone.setAttribute('width', '100%');
    clone.setAttribute('height', '100%');
    const gElem = clone.querySelector('.graph');
    if (gElem) gElem.removeAttribute('transform');

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html><html><head><title>Family Tree</title>
        <style>
          body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: white; }
          svg { max-width: 100%; max-height: 100vh; }
          @media print { body { margin: 0; } svg { width: 100%; height: auto; } }
        </style>
        </head><body>${clone.outerHTML}</body></html>
      `);
      printWindow.document.close();
      setTimeout(() => printWindow.print(), 500);
    }
    setShowExportMenu(false);
  }, []);

  const handleSearchSelect = (personId: string) => {
    setSearchOpen(false);
    setSearchValue('');
    if (gRef.current && zoomRef.current && svgRef.current) {
      const nodeData = d3.select(gRef.current).selectAll<SVGGElement, any>('.nodes g')
        .filter((d: any) => d.id === personId);
      if (!nodeData.empty()) {
        const d: any = nodeData.datum();
        const scale = 1.2;
        d3.select(svgRef.current).transition().duration(500).call(
          zoomRef.current.transform,
          d3.zoomIdentity.translate(width / 2 - scale * d.x, height / 2 - scale * d.y).scale(scale)
        );
        nodeData.select('.select-ring')
          .attr('stroke', '#fbbf24')
          .transition().duration(2000)
          .attr('stroke', 'transparent');
      }
    }
  };

  const handleDeleteRelationship = () => {
    if (contextMenu.relationship && onDeleteRelationship) {
      onDeleteRelationship(contextMenu.relationship.id);
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  if (people.length === 0) {
    return (
      <div className="w-full h-full flex items-center justify-center text-muted-foreground">
        <div className="text-center">
          <p className="text-lg font-medium mb-2">No family members yet</p>
          <p className="text-sm">Add people to see the family tree visualization</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative w-full h-full">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="bg-white"
        style={{ width: '100%', height: '100%' }}
      />

      {/* ── Legend + Filters (bottom-left) ── */}
      <div className="absolute bottom-3 left-3 bg-white/95 backdrop-blur-sm rounded-lg shadow border px-3 py-2.5 text-xs max-w-[280px] z-20">
        <div className="font-semibold text-gray-700 mb-2">Show / Hide Relationships</div>

        {/* Node colors */}
        <div className="flex items-center gap-3 mb-2 pb-2 border-b border-gray-100">
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.male }} /> Male
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.female }} /> Female
          </div>
          <div className="flex items-center gap-1">
            <span className="w-3 h-3 rounded-full" style={{ background: NODE_COLORS.deceased }} /> Deceased
          </div>
        </div>

        {/* Relationship toggles */}
        <div className="space-y-1">
          {REL_CATEGORIES.map(cat => (
            <label key={cat.key} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
              <input
                type="checkbox"
                checked={visibleCategories.has(cat.key)}
                onChange={() => toggleCategory(cat.key)}
                className="rounded border-gray-300"
              />
              <svg width="24" height="10" className="shrink-0">
                <line x1="0" y1="5" x2="24" y2="5"
                  stroke={cat.color} strokeWidth="2.5"
                  strokeDasharray={cat.dash || 'none'} />
              </svg>
              <span className="text-gray-700">{cat.label}</span>
            </label>
          ))}
        </div>
      </div>

      {/* ── Selected Person Detail Panel (bottom-right) ── */}
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
            <button onClick={() => setSelectedPerson(null)} className="p-1 hover:bg-gray-100 rounded">
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="px-3 py-2">
            <div className="text-xs font-medium text-gray-500 mb-1">
              Relationships ({selectedPerson.relationships.length})
            </div>
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

      {/* ── Search (top-left) ── */}
      <div className="absolute top-3 left-3 z-30">
        <button
          className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border"
          title="Search"
          onClick={() => setSearchOpen(v => !v)}
        >
          <Search className="w-4 h-4" />
        </button>
        {searchOpen && (
          <div className="mt-1 bg-white border rounded-lg shadow-lg p-2 w-64">
            <input
              type="text"
              className="w-full border rounded px-2 py-1 mb-1 text-sm"
              placeholder="Search by name..."
              value={searchValue}
              onChange={e => setSearchValue(e.target.value)}
              autoFocus
            />
            <div className="max-h-40 overflow-y-auto">
              {people.filter(p => p.name.toLowerCase().includes(searchValue.toLowerCase())).map(p => (
                <div
                  key={p.id}
                  className="px-2 py-1 hover:bg-indigo-50 cursor-pointer rounded text-sm"
                  onClick={() => handleSearchSelect(p.id)}
                >
                  {p.name}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Zoom + Export Controls (top-right) ── */}
      <div className="absolute top-3 right-3 flex flex-col gap-1 z-20">
        <button onClick={() => handleZoom(1.3)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Zoom In"><ZoomIn className="w-4 h-4" /></button>
        <button onClick={() => handleZoom(1 / 1.3)} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Zoom Out"><ZoomOut className="w-4 h-4" /></button>
        <button onClick={handleCenter} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Reset View"><RotateCcw className="w-4 h-4" /></button>
        <button onClick={fitToView} className="p-2 bg-white rounded-lg shadow-sm hover:bg-gray-50 border" title="Fit to View"><Maximize2 className="w-4 h-4" /></button>

        {/* Export dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(v => !v)}
            className="p-2 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 border border-indigo-700"
            title="Export / Print"
          >
            <Download className="w-4 h-4" />
          </button>
          {showExportMenu && (
            <div className="absolute right-0 mt-1 bg-white border rounded-lg shadow-lg py-1 w-44 z-50">
              <button onClick={printView} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <Printer className="w-4 h-4" /> Print / PDF
              </button>
              <button onClick={exportPNG} disabled={exporting} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2 disabled:opacity-50">
                <FileDown className="w-4 h-4" /> Export as PNG
              </button>
              <button onClick={exportSVG} className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2">
                <FileDown className="w-4 h-4" /> Export as SVG
              </button>
            </div>
          )}
        </div>
      </div>

      {/* ── Context Menu ── */}
      {contextMenu.visible && contextMenu.relationship && (
        <div
          className="absolute z-50 bg-white rounded-lg shadow-lg border py-1 min-w-[180px]"
          style={{ left: contextMenu.x, top: contextMenu.y, transform: 'translate(-50%, -110%)' }}
          onClick={e => e.stopPropagation()}
        >
          <div className="px-3 py-2 border-b">
            <div className="text-xs text-gray-500 capitalize">{contextMenu.relationship.relationshipType}</div>
            <div className="text-sm font-medium">
              {people.find(p => p.id === contextMenu.relationship?.personId)?.name} &rarr;{' '}
              {people.find(p => p.id === contextMenu.relationship?.relatedPersonId)?.name}
            </div>
          </div>
          <button
            onClick={handleDeleteRelationship}
            className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50"
          >
            Delete Relationship
          </button>
        </div>
      )}
    </div>
  );
};
