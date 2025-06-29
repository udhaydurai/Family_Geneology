import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Person, Relationship } from '@/types/family';
import { ZoomIn, ZoomOut, Maximize2, RotateCcw } from 'lucide-react';

interface D3NetworkGraphProps {
  people: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
}

export const D3NetworkGraph: React.FC<D3NetworkGraphProps> = ({
  people,
  relationships,
  width = 1200,
  height = 700
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();
  const gRef = useRef<SVGGElement>(null);

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
      .attr('opacity', 0.7);

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
      );

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
      const firstLabel = linkLabelGroup.select('text').nodes()[0];
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
    simulation.force('x', d3.forceX(width / 2).strength(0.05));

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [people, relationships, width, height]);

  // Control handlers
  const handleZoom = (factor: number) => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(300).call(zoomRef.current.scaleBy, factor);
  };
  const handleCenter = () => {
    if (!svgRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    svg.transition().duration(500).call(zoomRef.current.translateTo, width / 2, height / 2);
  };
  const handleFit = () => {
    if (!svgRef.current || !gRef.current || !zoomRef.current) return;
    const svg = d3.select(svgRef.current);
    const g = d3.select(gRef.current);
    const bbox = g.node()?.getBBox();
    if (bbox) {
      const scale = Math.min(width / bbox.width, height / bbox.height) * 0.8;
      const x = width / 2 - (bbox.x + bbox.width / 2) * scale;
      const y = height / 2 - (bbox.y + bbox.height / 2) * scale;
      svg.transition().duration(500).call(
        zoomRef.current.transform,
        d3.zoomIdentity.translate(x, y).scale(scale)
      );
    }
  };

  return (
    <div ref={containerRef} className="w-full h-full relative">
      {/* Floating Controls */}
      <div className="absolute top-4 right-4 z-10 flex flex-col space-y-2 bg-white/80 rounded-lg shadow p-2 backdrop-blur-sm">
        <button onClick={() => handleZoom(1.2)} className="p-2 hover:bg-gray-100 rounded transition"><ZoomIn className="w-5 h-5" /></button>
        <button onClick={() => handleZoom(1/1.2)} className="p-2 hover:bg-gray-100 rounded transition"><ZoomOut className="w-5 h-5" /></button>
        <button onClick={handleFit} className="p-2 hover:bg-gray-100 rounded transition"><Maximize2 className="w-5 h-5" /></button>
        <button onClick={handleCenter} className="p-2 hover:bg-gray-100 rounded transition"><RotateCcw className="w-5 h-5" /></button>
      </div>
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />
    </div>
  );
}; 