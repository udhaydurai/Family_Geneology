import React, { useMemo } from 'react';
import { FamilyTreeNode } from '@/types/family';
import { FamilyTreeNode as FamilyTreeNodeComponent } from './FamilyTreeNode';

interface FamilyTreeVisualizationProps {
  treeData: FamilyTreeNode | null;
  onNodeClick: (personId: string) => void;
  onNodeEdit: (personId: string) => void;
  layout: 'horizontal' | 'vertical';
  compact: boolean;
}

export const FamilyTreeVisualization: React.FC<FamilyTreeVisualizationProps> = ({
  treeData,
  onNodeClick,
  onNodeEdit,
  layout = 'horizontal',
  compact = false
}) => {
  const { nodes, connections } = useMemo(() => {
    if (!treeData) return { nodes: [], connections: [] };

    const nodes: Array<FamilyTreeNode & { x: number; y: number }> = [];
    const connections: Array<{ from: string; to: string; type: 'parent-child' | 'spouse' }> = [];
    
    const nodeSpacing = compact ? 180 : 220;
    const levelSpacing = compact ? 120 : 150;
    
    const processNode = (
      node: FamilyTreeNode, 
      x: number, 
      y: number, 
      visited = new Set<string>()
    ) => {
      if (visited.has(node.person.id)) return;
      visited.add(node.person.id);
      
      const positionedNode = { ...node, x, y };
      nodes.push(positionedNode);
      
      // Process parents (above current node)
      node.parents.forEach((parent, index) => {
        const parentX = x + (index - (node.parents.length - 1) / 2) * nodeSpacing;
        const parentY = y - levelSpacing;
        processNode(parent, parentX, parentY, visited);
        connections.push({
          from: parent.person.id,
          to: node.person.id,
          type: 'parent-child'
        });
      });
      
      // Process children (below current node)
      node.children.forEach((child, index) => {
        const childX = x + (index - (node.children.length - 1) / 2) * nodeSpacing;
        const childY = y + levelSpacing;
        processNode(child, childX, childY, visited);
        connections.push({
          from: node.person.id,
          to: child.person.id,
          type: 'parent-child'
        });
      });
      
      // Process spouses (side by side)
      node.spouses.forEach((spouse, index) => {
        const spouseX = x + (index + 1) * (nodeSpacing * 0.7);
        const spouseY = y;
        processNode(spouse, spouseX, spouseY, visited);
        connections.push({
          from: node.person.id,
          to: spouse.person.id,
          type: 'spouse'
        });
      });
    };
    
    processNode(treeData, 0, 0);
    
    return { nodes, connections };
  }, [treeData, compact]);

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

  const minX = Math.min(...nodes.map(n => n.x)) - 100;
  const maxX = Math.max(...nodes.map(n => n.x)) + 100;
  const minY = Math.min(...nodes.map(n => n.y)) - 100;
  const maxY = Math.max(...nodes.map(n => n.y)) + 100;
  
  const width = maxX - minX;
  const height = maxY - minY;

  return (
    <div className="w-full h-full overflow-auto">
      <svg
        width={Math.max(width, 800)}
        height={Math.max(height, 600)}
        viewBox={`${minX} ${minY} ${width} ${height}`}
        className="border border-gray-200 bg-gradient-to-br from-blue-50 to-purple-50"
      >
        <defs>
          <marker
            id="arrowhead"
            markerWidth="10"
            markerHeight="7"
            refX="9"
            refY="3.5"
            orient="auto"
          >
            <polygon
              points="0 0, 10 3.5, 0 7"
              fill="#6366f1"
            />
          </marker>
        </defs>
        
        {/* Render connections */}
        {connections.map((connection, index) => {
          const fromNode = nodes.find(n => n.person.id === connection.from);
          const toNode = nodes.find(n => n.person.id === connection.to);
          
          if (!fromNode || !toNode) return null;
          
          const isSpouse = connection.type === 'spouse';
          
          return (
            <line
              key={index}
              x1={fromNode.x}
              y1={fromNode.y}
              x2={toNode.x}
              y2={toNode.y}
              stroke={isSpouse ? "#8b5cf6" : "#6366f1"}
              strokeWidth={isSpouse ? 3 : 2}
              strokeDasharray={isSpouse ? "5,5" : "none"}
              markerEnd={!isSpouse ? "url(#arrowhead)" : "none"}
              opacity={0.7}
            />
          );
        })}
        
        {/* Render nodes */}
        {nodes.map((node) => (
          <g key={node.person.id} transform={`translate(${node.x}, ${node.y})`}>
            <FamilyTreeNodeComponent
              person={node.person}
              onClick={() => onNodeClick(node.person.id)}
              onEdit={() => onNodeEdit(node.person.id)}
              showDetails={!compact}
            />
          </g>
        ))}
      </svg>
    </div>
  );
};
