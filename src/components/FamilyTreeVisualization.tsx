
import React, { useEffect, useRef, useMemo } from 'react';
import { FamilyTreeNode as TreeNode } from '@/types/family';
import { FamilyTreeNode } from './FamilyTreeNode';

interface FamilyTreeVisualizationProps {
  treeData: TreeNode | null;
  onNodeClick?: (personId: string) => void;
  onNodeEdit?: (personId: string) => void;
  layout?: 'horizontal' | 'vertical';
  compact?: boolean;
}

export const FamilyTreeVisualization: React.FC<FamilyTreeVisualizationProps> = ({
  treeData,
  onNodeClick,
  onNodeEdit,
  layout = 'horizontal',
  compact = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  
  const positionedNodes = useMemo(() => {
    if (!treeData) return [];
    
    const nodes: (TreeNode & { x: number; y: number })[] = [];
    const nodeSpacing = compact ? 160 : 200;
    const levelSpacing = compact ? 120 : 160;
    
    const positionNode = (node: TreeNode, x: number, y: number, level: number) => {
      const positionedNode = { ...node, x, y };
      nodes.push(positionedNode);
      
      // Position children
      if (node.children.length > 0) {
        const childrenWidth = (node.children.length - 1) * nodeSpacing;
        const startX = x - childrenWidth / 2;
        
        node.children.forEach((child, index) => {
          const childX = startX + index * nodeSpacing;
          const childY = layout === 'horizontal' ? y + levelSpacing : y + levelSpacing;
          positionNode(child, childX, childY, level + 1);
        });
      }
      
      // Position parents
      if (node.parents.length > 0) {
        const parentsWidth = (node.parents.length - 1) * nodeSpacing;
        const startX = x - parentsWidth / 2;
        
        node.parents.forEach((parent, index) => {
          const parentX = startX + index * nodeSpacing;
          const parentY = layout === 'horizontal' ? y - levelSpacing : y - levelSpacing;
          positionNode(parent, parentX, parentY, level - 1);
        });
      }
      
      // Position spouses
      if (node.spouses.length > 0) {
        node.spouses.forEach((spouse, index) => {
          const spouseX = x + (index + 1) * (nodeSpacing * 0.6);
          const spouseY = y;
          positionNode(spouse, spouseX, spouseY, level);
        });
      }
    };
    
    if (treeData) {
      positionNode(treeData, 0, 0, 0);
    }
    
    return nodes;
  }, [treeData, layout, compact]);

  const connections = useMemo(() => {
    const lines: Array<{ x1: number; y1: number; x2: number; y2: number; type: string }> = [];
    
    positionedNodes.forEach(node => {
      // Parent-child connections
      node.children.forEach(child => {
        const childNode = positionedNodes.find(n => n.person.id === child.person.id);
        if (childNode) {
          lines.push({
            x1: node.x,
            y1: node.y + 50,
            x2: childNode.x,
            y2: childNode.y - 50,
            type: 'parent-child'
          });
        }
      });
      
      // Spouse connections
      node.spouses.forEach(spouse => {
        const spouseNode = positionedNodes.find(n => n.person.id === spouse.person.id);
        if (spouseNode) {
          lines.push({
            x1: node.x + 100,
            y1: node.y,
            x2: spouseNode.x - 100,
            y2: spouseNode.y,
            type: 'spouse'
          });
        }
      });
    });
    
    return lines;
  }, [positionedNodes]);

  // Center the view on mount
  useEffect(() => {
    if (containerRef.current && positionedNodes.length > 0) {
      const container = containerRef.current;
      const rootNode = positionedNodes.find(n => n.isRoot);
      if (rootNode) {
        container.scrollLeft = (container.scrollWidth / 2) - (container.clientWidth / 2);
        container.scrollTop = (container.scrollHeight / 2) - (container.clientHeight / 2);
      }
    }
  }, [positionedNodes]);

  if (!treeData) {
    return (
      <div className="flex items-center justify-center h-64 text-muted-foreground">
        <div className="text-center">
          <div className="text-6xl mb-4">🌳</div>
          <h3 className="text-lg font-semibold mb-2">No Family Tree Selected</h3>
          <p>Select a root person to view the family tree</p>
        </div>
      </div>
    );
  }

  const minX = Math.min(...positionedNodes.map(n => n.x)) - 150;
  const maxX = Math.max(...positionedNodes.map(n => n.x)) + 150;
  const minY = Math.min(...positionedNodes.map(n => n.y)) - 100;
  const maxY = Math.max(...positionedNodes.map(n => n.y)) + 100;
  
  const viewBoxWidth = maxX - minX;
  const viewBoxHeight = maxY - minY;

  return (
    <div 
      ref={containerRef}
      className="relative w-full h-full overflow-auto bg-gradient-to-br from-blue-50 to-purple-50"
      style={{ minHeight: 600 }}
    >
      <div 
        className="relative"
        style={{
          width: Math.max(viewBoxWidth, 1200),
          height: Math.max(viewBoxHeight, 800),
          transform: `translate(${-minX + 150}px, ${-minY + 100}px)`
        }}
      >
        {/* SVG for connections */}
        <svg 
          className="absolute inset-0 pointer-events-none"
          style={{
            width: '100%',
            height: '100%'
          }}
        >
          {connections.map((connection, index) => (
            <g key={index}>
              {connection.type === 'parent-child' && (
                <path
                  d={`M ${connection.x1} ${connection.y1} Q ${connection.x1} ${connection.y1 + (connection.y2 - connection.y1) / 2} ${connection.x2} ${connection.y2}`}
                  className="relationship-line"
                  strokeDasharray={connection.type === 'spouse' ? '5,5' : ''}
                />
              )}
              {connection.type === 'spouse' && (
                <line
                  x1={connection.x1}
                  y1={connection.y1}
                  x2={connection.x2}
                  y2={connection.y2}
                  className="relationship-line"
                  strokeDasharray="3,3"
                  stroke="#f59e0b"
                />
              )}
            </g>
          ))}
        </svg>

        {/* Nodes */}
        {positionedNodes.map((node) => (
          <div
            key={node.person.id}
            className="absolute tree-node-animate"
            style={{
              left: node.x - 100,
              top: node.y - 75,
              transform: 'translate3d(0,0,0)'
            }}
          >
            <FamilyTreeNode
              person={node.person}
              isRoot={node.isRoot}
              isHighlighted={node.isHighlighted}
              onClick={() => onNodeClick?.(node.person.id)}
              onEdit={() => onNodeEdit?.(node.person.id)}
              showDetails={!compact}
            />
          </div>
        ))}
      </div>
    </div>
  );
};
