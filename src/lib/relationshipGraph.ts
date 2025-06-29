import { Person, Relationship, RelationshipType } from '@/types/family';

// Graph representation: Map of person ID to their relationships
export interface RelationshipGraph {
  [personId: string]: {
    [relatedPersonId: string]: RelationshipType;
  };
}

// Path segment with relationship type and person
export interface PathSegment {
  personId: string;
  relationshipType: RelationshipType;
  direction: 'forward' | 'reverse';
}

// Complete relationship path
export interface RelationshipPath {
  segments: PathSegment[];
  path: RelationshipType[];
  distance: number;
  confidence: number;
}

// Build adjacency map from people and relationships
export const buildRelationshipGraph = (
  people: Person[],
  relationships: Relationship[]
): RelationshipGraph => {
  const graph: RelationshipGraph = {};
  
  // Initialize graph with all people
  people.forEach(person => {
    graph[person.id] = {};
  });
  
  // Add relationships to graph
  relationships.forEach(relationship => {
    if (!graph[relationship.personId]) {
      graph[relationship.personId] = {};
    }
    if (!graph[relationship.relatedPersonId]) {
      graph[relationship.relatedPersonId] = {};
    }
    
    // Add forward relationship
    graph[relationship.personId][relationship.relatedPersonId] = relationship.relationshipType;
    
    // Add reverse relationship
    const reverseType = getReverseRelationship(relationship.relationshipType);
    if (reverseType) {
      graph[relationship.relatedPersonId][relationship.personId] = reverseType;
    }
  });
  
  return graph;
};

// Find all relationship paths between two people using BFS
export const findRelationshipPaths = (
  graph: RelationshipGraph,
  fromPersonId: string,
  toPersonId: string,
  maxDistance: number = 6
): RelationshipPath[] => {
  if (fromPersonId === toPersonId) {
    return [{
      segments: [],
      path: [],
      distance: 0,
      confidence: 1.0
    }];
  }
  
  const paths: RelationshipPath[] = [];
  const queue: Array<{
    personId: string;
    path: PathSegment[];
    distance: number;
  }> = [{ personId: fromPersonId, path: [], distance: 0 }];
  
  const visited = new Set<string>();
  
  while (queue.length > 0) {
    const { personId, path, distance } = queue.shift()!;
    
    if (distance > maxDistance) continue;
    
    if (personId === toPersonId) {
      const relationshipPath: RelationshipPath = {
        segments: path,
        path: path.map(segment => segment.relationshipType),
        distance,
        confidence: calculatePathConfidence(path)
      };
      paths.push(relationshipPath);
      continue;
    }
    
    if (visited.has(personId)) continue;
    visited.add(personId);
    
    const neighbors = graph[personId] || {};
    Object.entries(neighbors).forEach(([neighborId, relationshipType]) => {
      if (!visited.has(neighborId)) {
        const newSegment: PathSegment = {
          personId: neighborId,
          relationshipType,
          direction: 'forward'
        };
        
        queue.push({
          personId: neighborId,
          path: [...path, newSegment],
          distance: distance + 1
        });
      }
    });
  }
  
  // Sort by distance and confidence
  return paths.sort((a, b) => {
    if (a.distance !== b.distance) return a.distance - b.distance;
    return b.confidence - a.confidence;
  });
};

// Convert relationship path to human-readable label
export const getRelationshipLabel = (
  path: RelationshipType[],
  fromPerson: Person,
  toPerson: Person,
  people: Person[]
): string => {
  if (path.length === 0) return 'self';
  
  // Handle direct relationships
  if (path.length === 1) {
    return getDirectRelationshipLabel(path[0], fromPerson, toPerson);
  }
  
  // Handle common compound relationships
  const compoundLabel = getCompoundRelationshipLabel(path, fromPerson, toPerson, people);
  if (compoundLabel) return compoundLabel;
  
  // Generate descriptive path for complex relationships
  return generateDescriptivePath(path, fromPerson, toPerson, people);
};

// Get all relatives of a person based on a filter function
export const getAllRelatives = (
  graph: RelationshipGraph,
  personId: string,
  filter: (path: RelationshipPath) => boolean,
  maxDistance: number = 6
): Array<{ personId: string; paths: RelationshipPath[] }> => {
  const relatives = new Map<string, RelationshipPath[]>();
  
  Object.keys(graph).forEach(targetId => {
    if (targetId !== personId) {
      const paths = findRelationshipPaths(graph, personId, targetId, maxDistance);
      const filteredPaths = paths.filter(filter);
      
      if (filteredPaths.length > 0) {
        relatives.set(targetId, filteredPaths);
      }
    }
  });
  
  return Array.from(relatives.entries()).map(([personId, paths]) => ({
    personId,
    paths
  }));
};

// Helper function to get reverse relationship type
const getReverseRelationship = (relationshipType: RelationshipType): RelationshipType | null => {
  const reverseMap: Record<RelationshipType, RelationshipType> = {
    'parent': 'child',
    'child': 'parent',
    'spouse': 'spouse',
    'sibling': 'sibling',
    'grandparent': 'grandchild',
    'grandchild': 'grandparent',
    'aunt': 'niece',
    'uncle': 'nephew',
    'niece': 'aunt',
    'nephew': 'uncle',
    'cousin': 'cousin',
    'step-parent': 'step-child',
    'step-child': 'step-parent',
    'adopted-parent': 'adopted-child',
    'adopted-child': 'adopted-parent',
    'in-law': 'in-law'
  };
  
  return reverseMap[relationshipType] || null;
};

// Calculate confidence based on path complexity and inferred relationships
const calculatePathConfidence = (segments: PathSegment[]): number => {
  if (segments.length === 0) return 1.0;
  
  // Base confidence decreases with distance
  const confidence = Math.max(0.5, 1.0 - (segments.length - 1) * 0.1);
  
  // Additional confidence adjustments could be made here
  // based on relationship types, inferred vs direct relationships, etc.
  
  return confidence;
};

// Get label for direct relationships
const getDirectRelationshipLabel = (
  relationshipType: RelationshipType,
  fromPerson: Person,
  toPerson: Person
): string => {
  switch (relationshipType) {
    case 'parent':
      return toPerson.gender === 'female' ? 'mother' : 'father';
    case 'child':
      return toPerson.gender === 'female' ? 'daughter' : 'son';
    case 'spouse':
      return toPerson.gender === 'female' ? 'wife' : 'husband';
    case 'sibling':
      return toPerson.gender === 'female' ? 'sister' : 'brother';
    case 'grandparent':
      return toPerson.gender === 'female' ? 'grandmother' : 'grandfather';
    case 'grandchild':
      return toPerson.gender === 'female' ? 'granddaughter' : 'grandson';
    case 'aunt':
      return 'aunt';
    case 'uncle':
      return 'uncle';
    case 'niece':
      return 'niece';
    case 'nephew':
      return 'nephew';
    case 'cousin':
      return 'cousin';
    case 'step-parent':
      return toPerson.gender === 'female' ? 'stepmother' : 'stepfather';
    case 'step-child':
      return toPerson.gender === 'female' ? 'stepdaughter' : 'stepson';
    case 'adopted-parent':
      return toPerson.gender === 'female' ? 'adoptive mother' : 'adoptive father';
    case 'adopted-child':
      return toPerson.gender === 'female' ? 'adopted daughter' : 'adopted son';
    case 'in-law':
      return 'in-law';
    default:
      return relationshipType;
  }
};

// Get label for common compound relationships
const getCompoundRelationshipLabel = (
  path: RelationshipType[],
  fromPerson: Person,
  toPerson: Person,
  people: Person[]
): string | null => {
  // Mother-in-law: parent -> spouse
  if (path.length === 2 && path[0] === 'parent' && path[1] === 'spouse') {
    return 'mother-in-law';
  }
  
  // Father-in-law: parent -> spouse
  if (path.length === 2 && path[0] === 'parent' && path[1] === 'spouse') {
    return 'father-in-law';
  }
  
  // Sister-in-law: sibling -> spouse
  if (path.length === 2 && path[0] === 'sibling' && path[1] === 'spouse') {
    return 'sister-in-law';
  }
  
  // Brother-in-law: sibling -> spouse
  if (path.length === 2 && path[0] === 'sibling' && path[1] === 'spouse') {
    return 'brother-in-law';
  }
  
  // Daughter-in-law: child -> spouse
  if (path.length === 2 && path[0] === 'child' && path[1] === 'spouse') {
    return 'daughter-in-law';
  }
  
  // Son-in-law: child -> spouse
  if (path.length === 2 && path[0] === 'child' && path[1] === 'spouse') {
    return 'son-in-law';
  }
  
  // Step-sibling: parent -> spouse -> child
  if (path.length === 3 && path[0] === 'parent' && path[1] === 'spouse' && path[2] === 'child') {
    return 'step-sibling';
  }
  
  // Half-sibling: parent -> child (same parent, different other parent)
  if (path.length === 2 && path[0] === 'parent' && path[1] === 'child') {
    return 'half-sibling';
  }
  
  return null;
};

// Generate descriptive path for complex relationships
const generateDescriptivePath = (
  path: RelationshipType[],
  fromPerson: Person,
  toPerson: Person,
  people: Person[]
): string => {
  const labels = path.map((relType, index) => {
    if (index === 0) {
      return getDirectRelationshipLabel(relType, fromPerson, toPerson);
    }
    return relType;
  });
  
  return labels.join(' → ');
};

// Filter functions for common relationship queries
export const relationshipFilters = {
  // Get all cousins
  cousins: (path: RelationshipPath): boolean => {
    return path.path.length === 3 && 
           path.path[0] === 'parent' && 
           path.path[1] === 'sibling' && 
           path.path[2] === 'child';
  },
  
  // Get all aunts and uncles
  auntsAndUncles: (path: RelationshipPath): boolean => {
    return path.path.length === 2 && 
           path.path[0] === 'parent' && 
           path.path[1] === 'sibling';
  },
  
  // Get all nieces and nephews
  niecesAndNephews: (path: RelationshipPath): boolean => {
    return path.path.length === 2 && 
           path.path[0] === 'sibling' && 
           path.path[1] === 'child';
  },
  
  // Get all grandparents
  grandparents: (path: RelationshipPath): boolean => {
    return path.path.length === 2 && 
           path.path[0] === 'parent' && 
           path.path[1] === 'parent';
  },
  
  // Get all grandchildren
  grandchildren: (path: RelationshipPath): boolean => {
    return path.path.length === 2 && 
           path.path[0] === 'child' && 
           path.path[1] === 'child';
  },
  
  // Get all in-laws
  inLaws: (path: RelationshipPath): boolean => {
    return path.path.includes('spouse') && path.path.length > 1;
  }
}; 