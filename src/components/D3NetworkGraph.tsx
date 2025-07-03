import React, { useEffect, useRef, useState } from 'react';
import * as d3 from 'd3';
import { Person, Relationship } from '@/types/family';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw, Trash2, Edit, Download } from 'lucide-react';
import html2canvas from 'html2canvas';

interface D3NetworkGraphProps {
  people: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
  onDeleteRelationship?: (relationshipId: string) => void;
  onUpdateRelationship?: (relationship: Relationship) => void;
}

interface ContextMenuState {
  visible: boolean;
  x: number;
  y: number;
  relationship?: Relationship;
  person?: Person;
}

export const D3NetworkGraph: React.FC<D3NetworkGraphProps> = ({
  people,
  relationships,
  width = 1200,
  height = 700,
  onDeleteRelationship,
  onUpdateRelationship
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const gRef = useRef<SVGGElement>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0
  });
  const [exporting, setExporting] = useState(false);

  // Close context menu when clicking outside
  useEffect(() => {
    const handleClickOutside = () => {
      setContextMenu(prev => ({ ...prev, visible: false }));
    };
    
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  // Export as PNG
  const handleExportPNG = async () => {
    setExporting(true);
    try {
      if (!containerRef.current) return;
      // Use html2canvas to capture the SVG (with zoom/pan)
      const svgElem = svgRef.current;
      if (!svgElem) return;
      // Clone the SVG node to avoid UI overlays
      const clone = svgElem.cloneNode(true) as SVGSVGElement;
      // Wrap in a div for html2canvas
      const wrapper = document.createElement('div');
      wrapper.appendChild(clone);
      wrapper.style.background = 'white';
      document.body.appendChild(wrapper);
      const canvas = await html2canvas(wrapper, {
        backgroundColor: '#fff',
        useCORS: true,
        logging: false,
        scale: 2
      });
      document.body.removeChild(wrapper);
      const link = document.createElement('a');
      link.download = `family_tree_${new Date().toISOString().split('T')[0]}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  // Only re-run D3 rendering when data or size changes
  useEffect(() => {
    if (!svgRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll('*').remove();

    // Prepare data
    const nodes = people.map(person => ({ ...person, id: person.id }));
    const links = relationships.map(rel => ({
      source: rel.personId,
      target: rel.relatedPersonId,
      type: rel.relationshipType
    }));

    // Deduplicate links for label display (show only one label per edge, order-independent)
    const uniqueLinks = Array.from(new Map(links.map(l => {
      const key = [l.source, l.target].sort().join('-');
      return [key, l];
    })).values());
    console.log('[D3NetworkGraph] Unique relationship labels:', uniqueLinks.length, uniqueLinks.map(l => l.type));

    // Create simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(200))
      .force('charge', d3.forceManyBody().strength(-600))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(60));

    // Zoom/pan
    const g = svg.append('g').attr('class', 'network-group');
    gRef.current = g.node() as SVGGElement;
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      });
    zoomRef.current = zoom;
    svg.call(zoom as any);

    // Draw links as blue, curvy lines (SVG paths)
    const linkGroup = g.append('g');
    const link = linkGroup
      .attr('stroke', '#3b82f6') // blue-500
      .attr('stroke-width', 1.5)
      .selectAll('path')
      .data(links)
      .enter().append('path')
      .attr('fill', 'none')
      .attr('opacity', 0.7)
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .on('contextmenu', (event, d: any) => {
        event.preventDefault();
        console.log('[D3NetworkGraph] Right-click on link:', d);
        console.log('[D3NetworkGraph] Available relationships:', relationships);
        
        const relationship = relationships.find(r => 
          (r.personId === d.source.id && r.relatedPersonId === d.target.id) ||
          (r.personId === d.target.id && r.relatedPersonId === d.source.id)
        );
        
        console.log('[D3NetworkGraph] Found relationship:', relationship);
        
        if (relationship) {
          setContextMenu({
            visible: true,
            x: event.clientX,
            y: event.clientY,
            relationship
          });
        } else {
          console.log('[D3NetworkGraph] No relationship found for link:', d);
        }
      });

    // Draw relationship labels as plain, small, gray text (no pill, no background, no border)
    const linkLabelGroup = linkGroup
      .selectAll('g.link-label')
      .data(uniqueLinks)
      .enter().append('g')
      .attr('class', 'link-label');

    linkLabelGroup.append('text')
      .attr('font-size', 8)
      .attr('font-weight', 'normal')
      .attr('fill', '#6b7280')
      .style('fill', '#6b7280')
      .attr('stroke', 'none')
      .style('paint-order', 'stroke fill markers')
      .attr('text-anchor', 'middle')
      .attr('alignment-baseline', 'middle')
      .text(d => d.type.charAt(0).toUpperCase() + d.type.slice(1));

    // Add SVG filter for shadow
    svg.insert('defs', ':first-child').html(`
      <filter id="label-shadow" x="-20%" y="-20%" width="140%" height="140%">
        <feDropShadow dx="0" dy="1" stdDeviation="1" flood-color="#bbb" flood-opacity="0.3"/>
      </filter>
    `);

    // Draw nodes
    const node = g.append('g')
      .selectAll('g')
      .data(nodes)
      .enter().append('g')
      .style('cursor', 'pointer')
      .style('pointer-events', 'all')
      .call(d3.drag()
        .on('start', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on('drag', (event, d: any) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on('end', (event, d: any) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      )
      .on('contextmenu', (event, d: any) => {
        event.preventDefault();
        console.log('[D3NetworkGraph] Right-click on node:', d);
        setContextMenu({
          visible: true,
          x: event.clientX,
          y: event.clientY,
          person: d
        });
      });

    // Node circles
    node.append('circle')
      .attr('r', 24)
      .attr('fill', d => {
        switch (d.gender) {
          case 'male': return '#3b82f6';
          case 'female': return '#ec4899';
          default: return '#8b5cf6';
        }
      })
      .attr('stroke', '#374151')
      .attr('stroke-width', 2);

    // Initials
    node.append('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '0.35em')
      .attr('font-size', '14px')
      .attr('font-weight', '600')
      .attr('fill', 'white')
      .text(d => d.name.split(' ').map((p: string) => p[0]).join('').toUpperCase().slice(0, 2));

    // Name labels
    node.append('text')
      .attr('y', 32)
      .attr('text-anchor', 'middle')
      .attr('font-size', '12px')
      .attr('fill', '#222')
      .text(d => d.name);

    // Simulation tick
    simulation.on('tick', () => {
      // Draw curvy links (cubic Bezier)
      link
        .attr('d', d => {
          const sx = (d.source as any).x;
          const sy = (d.source as any).y;
          const tx = (d.target as any).x;
          const ty = (d.target as any).y;
          // Curve control points: horizontally or vertically aligned
          const dx = tx - sx;
          const dy = ty - sy;
          const dr = Math.sqrt(dx * dx + dy * dy) * 0.3;
          // Use a cubic Bezier curve
          return `M${sx},${sy} C${sx},${sy + dr} ${tx},${ty - dr} ${tx},${ty}`;
        });
      linkLabelGroup
        .attr('transform', d => {
          const x = ((d.source as any).x + (d.target as any).x) / 2;
          const y = ((d.source as any).y + (d.target as any).y) / 2 - 14; // offset above line
          return `translate(${x},${y})`;
        });
      linkLabelGroup.select('text')
        .attr('y', 0)
        .attr('fill', '#6b7280')
        .style('fill', '#6b7280')
        .attr('font-weight', 'normal')
        .attr('font-size', 8)
        .attr('stroke', 'none')
        .style('paint-order', 'stroke fill markers');
      // Log the style of the first label
      const firstLabel = linkLabelGroup.select('text').nodes()[0] as Element;
      if (firstLabel) {
        const style = window.getComputedStyle(firstLabel);
        console.log('[D3NetworkGraph] First label style:', {
          fill: style.fill,
          fontSize: style.fontSize,
          fontWeight: style.fontWeight,
          text: firstLabel.textContent
        });
      }
      console.log('[D3NetworkGraph] Simulation tick');
      node
        .attr('transform', d => `translate(${(d as any).x},${(d as any).y})`);
    });

    // Improve node alignment: apply a vertical layering (tree-like) force
    simulation.force('y', d3.forceY((d: any) => {
      // Layer by generation if possible, else center
      return height / 2 + ((d.generation || 0) * 100);
    }).strength(0.2));

    return () => {
      simulation.stop();
    };
  }, [people, relationships, width, height]);

  // Fix zoom in/out to use d3.zoom().scaleBy on the SVG selection
  const handleZoom = (factor: number) => {
    if (zoomRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
    }
  };

  const handleCenter = () => {
    if (zoomRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      svg.transition().duration(300).call(
        zoomRef.current.transform,
        d3.zoomIdentity
      );
    }
  };

  const handleFit = () => {
    if (gRef.current && svgRef.current) {
      const svg = d3.select(svgRef.current);
      const g = d3.select(gRef.current);
             const bounds = g.node()?.getBBox();
       if (bounds) {
         const fullWidth = width;
         const fullHeight = height;
         const boundsWidth = bounds.width;
         const boundsHeight = bounds.height;
         const midX = bounds.x + boundsWidth / 2;
         const midY = bounds.y + boundsHeight / 2;
         if (boundsWidth === 0 || boundsHeight === 0) return;
         const scale = 0.9 / Math.max(boundsWidth / fullWidth, boundsHeight / fullHeight);
         const translate = [fullWidth / 2 - scale * midX, fullHeight / 2 - scale * midY];
         svg.transition().duration(300).call(
           zoomRef.current!.transform,
           d3.zoomIdentity.translate(translate[0], translate[1]).scale(scale)
         );
       }
    }
  };

  const handleDeleteRelationship = () => {
    if (contextMenu.relationship && onDeleteRelationship) {
      onDeleteRelationship(contextMenu.relationship.id);
      setContextMenu(prev => ({ ...prev, visible: false }));
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <svg
        ref={svgRef}
        width={width}
        height={height}
        className="border border-gray-200 rounded-lg bg-white"
      />
      
      {/* Zoom Controls + Export */}
      <div className="absolute top-4 right-4 flex flex-col space-y-2 z-20">
        <button
          onClick={() => handleZoom(1.2)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200"
          title="Zoom In"
        >
          <ZoomIn className="w-4 h-4" />
        </button>
        <button
          onClick={() => handleZoom(1/1.2)}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200"
          title="Zoom Out"
        >
          <ZoomOut className="w-4 h-4" />
        </button>
        <button
          onClick={handleCenter}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200"
          title="Reset View"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleFit}
          className="p-2 bg-white rounded-lg shadow-md hover:bg-gray-50 border border-gray-200"
          title="Fit to View"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
        <button
          onClick={handleExportPNG}
          className="p-2 bg-blue-600 text-white rounded-lg shadow-md border border-blue-700 hover:bg-blue-700 disabled:opacity-50"
          title="Export as PNG"
          disabled={exporting}
        >
          <Download className="w-4 h-4" />
        </button>
      </div>

      {/* Context Menu */}
      {contextMenu.visible && (
        <div
          className="absolute z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-2 min-w-[200px]"
          style={{
            left: contextMenu.x,
            top: contextMenu.y,
            transform: 'translate(-50%, -100%)'
          }}
          onClick={(e) => e.stopPropagation()}
        >
          {contextMenu.relationship && (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="font-medium text-sm text-gray-900">Relationship</div>
                <div className="text-xs text-gray-600">
                  {people.find(p => p.id === contextMenu.relationship?.personId)?.name} → 
                  {people.find(p => p.id === contextMenu.relationship?.relatedPersonId)?.name}
                </div>
                <div className="text-xs text-gray-500 capitalize">
                  {contextMenu.relationship.relationshipType}
                </div>
              </div>
              <button
                onClick={handleDeleteRelationship}
                className="w-full px-4 py-2 text-left text-sm text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Delete Relationship</span>
              </button>
            </>
          )}
          
          {contextMenu.person && (
            <>
              <div className="px-4 py-2 border-b border-gray-100">
                <div className="font-medium text-sm text-gray-900">Person</div>
                <div className="text-xs text-gray-600">{contextMenu.person.name}</div>
              </div>
              <button
                onClick={() => {
                  // TODO: Implement person edit functionality
                  setContextMenu(prev => ({ ...prev, visible: false }));
                }}
                className="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center space-x-2"
              >
                <Edit className="w-4 h-4" />
                <span>Edit Person</span>
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}; 