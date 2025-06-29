import React, { useMemo, useCallback, useState } from 'react';
import ReactFlow, {
  Node,
  Edge,
  Controls,
  Background,
  useNodesState,
  useEdgesState,
  Connection,
  addEdge,
  ReactFlowProvider,
  MiniMap,
  Panel,
  ReactFlowInstance,
  MarkerType
} from 'reactflow';
import 'reactflow/dist/style.css';
import { FamilyTreeNode } from '@/types/family';
import { FamilyTreeNode as FamilyTreeNodeComponent } from './FamilyTreeNode';
import { Button } from '@/components/ui/button';
import { ZoomIn, ZoomOut, RotateCcw, Maximize2 } from 'lucide-react';

interface FamilyTreeVisualizationProps {
  treeData: FamilyTreeNode | null;
  onNodeClick: (personId: string) => void;
  onNodeEdit: (personId: string) => void;
  layout: 'horizontal' | 'vertical';
  compact: boolean;
}

// Custom node type for family tree
const FamilyTreeNodeType = 'familyTreeNode';

const FamilyTreeVisualization: React.FC<FamilyTreeVisualizationProps> = ({
  treeData,
  onNodeClick,
  onNodeEdit,
  layout = 'horizontal',
  compact = false
}) => {
  const [reactFlowInstance, setReactFlowInstance] = useState<ReactFlowInstance | null>(null);

  // Add debugging
  console.log('FamilyTreeVisualization render:', {
    hasTreeData: !!treeData,
    treeDataPerson: treeData?.person?.name,
    layout,
    compact
  });

  const { nodes, edges } = useMemo(() => {
    if (!treeData) {
      console.log('No tree data available');
      return { nodes: [], edges: [] };
    }

    console.log('Building React Flow nodes and edges from tree data');
    const nodes: Node[] = [];
    const edges: Edge[] = [];
    const nodeSpacing = compact ? 200 : 250;
    const levelSpacing = compact ? 150 : 200;
    
    const processNode = (
      node: FamilyTreeNode, 
      x: number, 
      y: number, 
      visited = new Set<string>()
    ) => {
      if (visited.has(node.person.id)) return;
      visited.add(node.person.id);
      
      console.log('Processing node:', node.person.name, 'at position:', { x, y });
      
      // Create React Flow node
      const reactFlowNode: Node = {
        id: node.person.id,
        type: FamilyTreeNodeType,
        position: { x, y },
        data: {
          person: node.person,
          isRoot: node.isRoot,
          isHighlighted: node.isHighlighted,
          showDetails: !compact,
          onNodeClick: () => onNodeClick(node.person.id),
          onNodeEdit: () => onNodeEdit(node.person.id)
        },
        style: {
          width: compact ? 180 : 220,
          height: compact ? 120 : 160
        }
      };
      
      nodes.push(reactFlowNode);
      
      // Process parents (above current node)
      node.parents.forEach((parent, index) => {
        const parentX = x + (index - (node.parents.length - 1) / 2) * nodeSpacing;
        const parentY = layout === 'horizontal' ? y - levelSpacing : y;
        const parentXPos = layout === 'horizontal' ? parentX : x - levelSpacing;
        const parentYPos = layout === 'horizontal' ? parentY : y + (index - (node.parents.length - 1) / 2) * nodeSpacing;
        
        processNode(parent, parentXPos, parentYPos, visited);
        
        edges.push({
          id: `parent-${parent.person.id}-${node.person.id}`,
          source: parent.person.id,
          target: node.person.id,
          type: 'smoothstep',
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#6366f1'
          }
        });
      });
      
      // Process children (below current node)
      node.children.forEach((child, index) => {
        const childX = x + (index - (node.children.length - 1) / 2) * nodeSpacing;
        const childY = layout === 'horizontal' ? y + levelSpacing : y;
        const childXPos = layout === 'horizontal' ? childX : x + levelSpacing;
        const childYPos = layout === 'horizontal' ? childY : y + (index - (node.children.length - 1) / 2) * nodeSpacing;
        
        processNode(child, childXPos, childYPos, visited);
        
        edges.push({
          id: `child-${node.person.id}-${child.person.id}`,
          source: node.person.id,
          target: child.person.id,
          type: 'smoothstep',
          style: { stroke: '#6366f1', strokeWidth: 2 },
          markerEnd: {
            type: MarkerType.ArrowClosed,
            width: 20,
            height: 20,
            color: '#6366f1'
          }
        });
      });
      
      // Process spouses (side by side)
      node.spouses.forEach((spouse, index) => {
        const spouseX = layout === 'horizontal' ? x + (index + 1) * (nodeSpacing * 0.8) : x;
        const spouseY = layout === 'horizontal' ? y : y + (index + 1) * (nodeSpacing * 0.8);
        const spouseXPos = layout === 'horizontal' ? spouseX : x + (index + 1) * (nodeSpacing * 0.8);
        const spouseYPos = layout === 'horizontal' ? spouseY : y;
        
        processNode(spouse, spouseXPos, spouseYPos, visited);
        
        edges.push({
          id: `spouse-${node.person.id}-${spouse.person.id}`,
          source: node.person.id,
          target: spouse.person.id,
          type: 'smoothstep',
          style: { stroke: '#8b5cf6', strokeWidth: 3, strokeDasharray: '5,5' },
          animated: true
        });
      });
    };
    
    processNode(treeData, 0, 0);
    
    console.log('Generated React Flow data:', { nodesCount: nodes.length, edgesCount: edges.length });
    return { nodes, edges };
  }, [treeData, layout, compact, onNodeClick, onNodeEdit]);

  const [reactNodes, setReactNodes, onNodesChange] = useNodesState(nodes);
  const [reactEdges, setReactEdges, onEdgesChange] = useEdgesState(edges);

  const onConnect = useCallback(
    (params: Connection) => setReactEdges((eds) => addEdge(params, eds)),
    [setReactEdges]
  );

  const onInit = useCallback((instance: ReactFlowInstance) => {
    setReactFlowInstance(instance);
  }, []);

  const handleZoomIn = () => {
    reactFlowInstance?.zoomIn();
  };

  const handleZoomOut = () => {
    reactFlowInstance?.zoomOut();
  };

  const handleFitView = () => {
    reactFlowInstance?.fitView({ padding: 0.1 });
  };

  const handleResetView = () => {
    reactFlowInstance?.setViewport({ x: 0, y: 0, zoom: 1 });
  };

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
    <div className="w-full h-full">
      <ReactFlowProvider>
        <ReactFlow
          nodes={reactNodes}
          edges={reactEdges}
          onNodesChange={onNodesChange}
          onEdgesChange={onEdgesChange}
          onConnect={onConnect}
          onInit={onInit}
          nodeTypes={{ [FamilyTreeNodeType]: FamilyTreeNodeComponent }}
          fitView
          fitViewOptions={{ padding: 0.1 }}
          minZoom={0.1}
          maxZoom={2}
          defaultEdgeOptions={{
            type: 'smoothstep',
            style: { stroke: '#6366f1', strokeWidth: 2 }
          }}
          className="bg-gradient-to-br from-blue-50 to-purple-50"
        >
          <Background color="#cbd5e1" gap={20} />
          <Controls />
          <MiniMap 
            nodeColor="#6366f1"
            maskColor="rgba(0, 0, 0, 0.1)"
            style={{ backgroundColor: 'rgba(255, 255, 255, 0.8)' }}
          />
          
          <Panel position="top-right" className="space-y-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleZoomIn}
              className="bg-white/80 backdrop-blur-sm"
            >
              <ZoomIn className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleZoomOut}
              className="bg-white/80 backdrop-blur-sm"
            >
              <ZoomOut className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleFitView}
              className="bg-white/80 backdrop-blur-sm"
            >
              <Maximize2 className="w-4 h-4" />
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={handleResetView}
              className="bg-white/80 backdrop-blur-sm"
            >
              <RotateCcw className="w-4 h-4" />
            </Button>
          </Panel>
        </ReactFlow>
      </ReactFlowProvider>
    </div>
  );
};

export { FamilyTreeVisualization };
