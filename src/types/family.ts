
export interface Person {
  id: string;
  name: string;
  firstName?: string;
  lastName?: string;
  birthDate?: string;
  deathDate?: string;
  gender: 'male' | 'female' | 'other';
  isDeceased?: boolean;
  profileImage?: string;
  notes?: string;
  birthPlace?: string;
  occupation?: string;
}

export interface Relationship {
  id: string;
  personId: string;
  relatedPersonId: string;
  relationshipType: RelationshipType;
  isInferred?: boolean;
  confidence?: number;
  notes?: string;
}

export type RelationshipType = 
  | 'parent'
  | 'child'
  | 'spouse'
  | 'sibling'
  | 'grandparent'
  | 'grandchild'
  | 'aunt'
  | 'uncle'
  | 'niece'
  | 'nephew'
  | 'cousin'
  | 'step-parent'
  | 'step-child'
  | 'adopted-parent'
  | 'adopted-child'
  | 'in-law';

export interface FamilyTreeNode {
  person: Person;
  x: number;
  y: number;
  generation: number;
  side: 'maternal' | 'paternal' | 'direct';
  children: FamilyTreeNode[];
  parents: FamilyTreeNode[];
  spouses: FamilyTreeNode[];
  isRoot?: boolean;
  isHighlighted?: boolean;
}

export interface ValidationError {
  id: string;
  type: 'age_conflict' | 'circular_reference' | 'duplicate_relationship' | 'missing_data' | 'logical_error';
  severity: 'error' | 'warning' | 'info';
  message: string;
  affectedPersons: string[];
  suggestedAction?: string;
}

export interface FamilyTreeState {
  people: Person[];
  relationships: Relationship[];
  rootPersonId: string | null;
  validationErrors: ValidationError[];
  filters: {
    generation: number | null;
    side: 'all' | 'maternal' | 'paternal' | 'direct';
    relationshipType: RelationshipType | 'all';
    showDeceased: boolean;
  };
  viewSettings: {
    layout: 'horizontal' | 'vertical';
    compact: boolean;
    showPhotos: boolean;
    showDates: boolean;
  };
}
