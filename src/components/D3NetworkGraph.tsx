import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Person, Relationship } from '@/types/family';

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

    // Create simulation
    const simulation = d3.forceSimulation(nodes as any)
      .force('link', d3.forceLink(links as any).id((d: any) => d.id).distance(120))
      .force('charge', d3.forceManyBody().strength(-400))
      .force('center', d3.forceCenter(width / 2, height / 2))
      .force('collide', d3.forceCollide(50));

    // Zoom/pan
    const g = svg.append('g');
    svg.call(d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 2])
      .on('zoom', (event) => {
        g.attr('transform', event.transform);
      })
    );

    // Draw links
    const link = g.append('g')
      .attr('stroke', '#bbb')
      .attr('stroke-width', 2)
      .selectAll('line')
      .data(links)
      .enter().append('line')
      .attr('stroke-dasharray', d => d.type === 'spouse' ? '5,5' : '');

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
      link
        .attr('x1', d => (d.source as any).x)
        .attr('y1', d => (d.source as any).y)
        .attr('x2', d => (d.target as any).x)
        .attr('y2', d => (d.target as any).y);
      node
        .attr('transform', d => `translate(${d.x},${d.y})`);
    });

    // Cleanup
    return () => {
      simulation.stop();
    };
  }, [people, relationships, width, height]);

  return (
    <div ref={containerRef} className="w-full h-full relative">
      <svg ref={svgRef} width={width} height={height} className="w-full h-full" />
    </div>
  );
}; 