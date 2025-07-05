import React from 'react';
import { Person, Relationship } from '@/types/family';

interface TreeLayoutGraphProps {
  people: Person[];
  relationships: Relationship[];
  width?: number;
  height?: number;
}

export const TreeLayoutGraph: React.FC<TreeLayoutGraphProps> = ({
  people,
  relationships,
  width = 1200,
  height = 700
}) => {
  return (
    <div className="w-full h-full flex items-center justify-center bg-white border rounded-lg" style={{ minHeight: height }}>
      <div className="text-center">
        <div className="text-6xl mb-4">🌳</div>
        <h3 className="text-lg font-semibold mb-2">Hierarchical Tree Layout (Coming Soon)</h3>
        <p className="text-muted-foreground">This view will show a left-to-right family tree with all nodes and relationships.</p>
        <p className="text-xs mt-2 text-gray-400">People: {people.length}, Relationships: {relationships.length}</p>
      </div>
    </div>
  );
}; 