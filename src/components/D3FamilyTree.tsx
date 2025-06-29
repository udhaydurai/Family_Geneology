import React, { useEffect, useRef, useCallback } from 'react';
import * as d3 from 'd3';
import { Person, FamilyTreeNode } from '@/types/family';

interface D3FamilyTreeProps {
  treeData: FamilyTreeNode | null;
  onNodeClick: (personId: string) => void;
  onNodeEdit: (personId: string) => void;
  className?: string;
}

export const D3FamilyTree: React.FC<D3FamilyTreeProps> = ({
  treeData,
  onNodeClick,
  onNodeEdit,
  className = ""
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const zoomRef = useRef<d3.ZoomBehavior<SVGSVGElement, unknown>>();

  // Convert FamilyTreeNode to D3 hierarchy format
  const convertToD3Hierarchy = useCallback((node: FamilyTreeNode): any => {
    const d3Node = {
      name: node.person.name,
      data: node.person,
      type: 'person',
      relationship: '',
      children: [] as any[],
      parents: [] as any[],
      spouses: [] as any[]
    };

    // Add children
    node.children.forEach(child => {
      d3Node.children.push(convertToD3Hierarchy(child));
    });

    // Add spouses (as children with special type)
    node.spouses.forEach(spouse => {
      const spouseNode = convertToD3Hierarchy(spouse);
      spouseNode.type = 'spouse';
      spouseNode.relationship = 'spouse';
      d3Node.children.push(spouseNode);
    });

    return d3Node;
  }, []);

  const renderTree = useCallback(() => {
    if (!treeData || !svgRef.current || !containerRef.current) return;

    const container = containerRef.current;
    const width = container.clientWidth;
    const height = container.clientHeight;

    // Clear previous content
    d3.select(svgRef.current).selectAll("*").remove();

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height);

    // Create zoom behavior
    const zoom = d3.zoom<SVGSVGElement, unknown>()
      .scaleExtent([0.1, 3])
      .on("zoom", (event) => {
        g.attr("transform", event.transform);
      });

    zoomRef.current = zoom;
    svg.call(zoom);

    // Create main group
    const g = svg.append("g").attr("class", "tree-group");

    // Convert to D3 hierarchy
    const d3Data = convertToD3Hierarchy(treeData);
    const root = d3.hierarchy(d3Data);

    // Create tree layout
    const treeLayout = d3.tree<any>().size([height - 100, width - 200]);
    treeLayout(root);

    // Create links
    const links = root.links();
    
    g.selectAll(".tree-link")
      .data(links)
      .enter().append("path")
      .attr("class", "tree-link")
      .attr("d", d => {
        const sourceX = d.source.x;
        const sourceY = d.source.y;
        const targetX = d.target.x;
        const targetY = d.target.y;
        
        // Create curved path
        const midY = (sourceY + targetY) / 2;
        return `M${sourceY},${sourceX} C${midY},${sourceX} ${midY},${targetX} ${targetY},${targetX}`;
      })
      .attr("fill", "none")
      .attr("stroke", d => d.target.data.type === 'spouse' ? "#8b5cf6" : "#6366f1")
      .attr("stroke-width", d => d.target.data.type === 'spouse' ? 3 : 2)
      .attr("stroke-dasharray", d => d.target.data.type === 'spouse' ? "5,5" : "none");

    // Create nodes
    const nodes = g.selectAll(".tree-node")
      .data(root.descendants())
      .enter().append("g")
      .attr("class", "tree-node cursor-pointer")
      .attr("transform", (d) => `translate(${d.y},${d.x})`)
      .on("click", (event, d) => {
        event.stopPropagation();
        onNodeClick(d.data.data.id);
      })
      .on("contextmenu", (event, d) => {
        event.preventDefault();
        event.stopPropagation();
        onNodeEdit(d.data.data.id);
      });

    // Add node circles
    nodes.append("circle")
      .attr("r", (d) => d.data.data.id === treeData.person.id ? 20 : 16)
      .attr("fill", (d) => {
        const person = d.data.data;
        if (d.data.data.id === treeData.person.id) return "#6366f1";
        if (d.data.type === "spouse") return "#8b5cf6";
        
        // Generate color based on gender
        switch (person.gender) {
          case 'male': return "#3b82f6";
          case 'female': return "#ec4899";
          default: return "#8b5cf6";
        }
      })
      .attr("stroke", (d) => {
        if (d.data.data.id === treeData.person.id) return "#4338ca";
        if (d.data.type === "spouse") return "#7c3aed";
        return "#374151";
      })
      .attr("stroke-width", 2);

    // Add initials
    nodes.append("text")
      .attr("text-anchor", "middle")
      .attr("dy", "0.35em")
      .attr("font-size", (d) => d.data.data.id === treeData.person.id ? "12px" : "10px")
      .attr("font-weight", "600")
      .attr("fill", "white")
      .text((d) => {
        const name = d.data.data.name;
        return name.split(' ').map(part => part.charAt(0)).join('').toUpperCase().slice(0, 2);
      })
      .style("pointer-events", "none");

    // Add labels
    nodes.append("text")
      .attr("dy", (d) => d.data.data.id === treeData.person.id ? "2.8em" : "2.5em")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .text((d) => d.data.data.name)
      .attr("font-size", "12px")
      .attr("font-family", "Inter, sans-serif")
      .attr("font-weight", "500")
      .attr("fill", "#1f2937")
      .style("pointer-events", "none");

    // Add relationship labels
    nodes.append("text")
      .attr("dy", (d) => d.data.data.id === treeData.person.id ? "4.2em" : "3.8em")
      .attr("x", 0)
      .attr("text-anchor", "middle")
      .text((d) => d.data.relationship || '')
      .attr("font-size", "10px")
      .attr("font-family", "Inter, sans-serif")
      .attr("fill", "#6b7280")
      .style("pointer-events", "none");

    // Center the tree
    const bbox = g.node()?.getBBox();
    if (bbox) {
      const centerX = width / 2 - bbox.width / 2 - bbox.x;
      const centerY = height / 2 - bbox.height / 2 - bbox.y;
      svg.call(zoom.transform, d3.zoomIdentity.translate(centerX, centerY));
    }
  }, [treeData, convertToD3Hierarchy, onNodeClick, onNodeEdit]);

  // Re-render when data changes
  useEffect(() => {
    renderTree();
  }, [renderTree]);

  // Handle window resize
  useEffect(() => {
    const handleResize = () => {
      renderTree();
    };

    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, [renderTree]);

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="text-center">
          <div className="text-6xl mb-4">🌳</div>
          <h3 className="text-lg font-semibold mb-2">No Tree Data</h3>
          <p className="text-muted-foreground">Add people and relationships to see the family tree</p>
        </div>
      </div>
    );
  }

  return (
    <div ref={containerRef} className={`w-full h-full relative ${className}`}>
      <svg ref={svgRef} className="w-full h-full" />
    </div>
  );
}; 