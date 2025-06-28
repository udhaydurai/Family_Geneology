
import { useState, useCallback, useMemo } from 'react';
import { Person, Relationship, RelationshipType, FamilyTreeState, ValidationError, FamilyTreeNode } from '@/types/family';

export const useFamilyTree = () => {
  const [state, setState] = useState<FamilyTreeState>({
    people: [],
    relationships: [],
    rootPersonId: null,
    validationErrors: [],
    filters: {
      generation: null,
      side: 'all',
      relationshipType: 'all',
      showDeceased: true
    },
    viewSettings: {
      layout: 'horizontal',
      compact: false,
      showPhotos: true,
      showDates: true
    }
  });

  const addPerson = useCallback((person: Omit<Person, 'id'>) => {
    const newPerson: Person = {
      ...person,
      id: `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
    };
    
    setState(prev => ({
      ...prev,
      people: [...prev.people, newPerson]
    }));
    
    return newPerson.id;
  }, []);

  const updatePerson = useCallback((personId: string, updates: Partial<Person>) => {
    setState(prev => ({
      ...prev,
      people: prev.people.map(person => 
        person.id === personId ? { ...person, ...updates } : person
      )
    }));
  }, []);

  const deletePerson = useCallback((personId: string) => {
    setState(prev => ({
      ...prev,
      people: prev.people.filter(person => person.id !== personId),
      relationships: prev.relationships.filter(rel => 
        rel.personId !== personId && rel.relatedPersonId !== personId
      ),
      rootPersonId: prev.rootPersonId === personId ? null : prev.rootPersonId
    }));
  }, []);

  const addRelationship = useCallback((
    personId: string, 
    relatedPersonId: string, 
    relationshipType: RelationshipType,
    isInferred = false
  ) => {
    const newRelationship: Relationship = {
      id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      personId,
      relatedPersonId,
      relationshipType,
      isInferred,
      confidence: isInferred ? 0.8 : 1.0
    };

    setState(prev => {
      const relationships = [...prev.relationships, newRelationship];
      
      // Add reciprocal relationship
      const reciprocalType = getReciprocalRelationship(relationshipType);
      if (reciprocalType) {
        relationships.push({
          id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          personId: relatedPersonId,
          relatedPersonId: personId,
          relationshipType: reciprocalType,
          isInferred,
          confidence: isInferred ? 0.8 : 1.0
        });
      }

      return {
        ...prev,
        relationships
      };
    });
  }, []);

  const inferRelationships = useCallback(() => {
    console.log('Inferring relationships...');
    setState(prev => {
      const newRelationships = [...prev.relationships];
      const people = prev.people;
      
      // Infer sibling relationships
      const parentChildRels = prev.relationships.filter(rel => rel.relationshipType === 'parent');
      const childrenByParent = new Map<string, string[]>();
      
      parentChildRels.forEach(rel => {
        if (!childrenByParent.has(rel.personId)) {
          childrenByParent.set(rel.personId, []);
        }
        childrenByParent.get(rel.personId)!.push(rel.relatedPersonId);
      });

      // Add sibling relationships
      childrenByParent.forEach(children => {
        for (let i = 0; i < children.length; i++) {
          for (let j = i + 1; j < children.length; j++) {
            const child1 = children[i];
            const child2 = children[j];
            
            // Check if sibling relationship already exists
            const existingSibling = newRelationships.find(rel => 
              (rel.personId === child1 && rel.relatedPersonId === child2 && rel.relationshipType === 'sibling') ||
              (rel.personId === child2 && rel.relatedPersonId === child1 && rel.relationshipType === 'sibling')
            );
            
            if (!existingSibling) {
              newRelationships.push({
                id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                personId: child1,
                relatedPersonId: child2,
                relationshipType: 'sibling',
                isInferred: true,
                confidence: 0.95
              });
              
              newRelationships.push({
                id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
                personId: child2,
                relatedPersonId: child1,
                relationshipType: 'sibling',
                isInferred: true,
                confidence: 0.95
              });
            }
          }
        }
      });

      return {
        ...prev,
        relationships: newRelationships
      };
    });
  }, []);

  const validateRelationships = useCallback(() => {
    const errors: ValidationError[] = [];
    
    // Check for circular references
    const checkCircularReference = (personId: string, visited = new Set<string>()): boolean => {
      if (visited.has(personId)) return true;
      visited.add(personId);
      
      const parentRels = state.relationships.filter(rel => 
        rel.relatedPersonId === personId && rel.relationshipType === 'parent'
      );
      
      return parentRels.some(rel => checkCircularReference(rel.personId, new Set(visited)));
    };

    state.people.forEach(person => {
      if (checkCircularReference(person.id)) {
        errors.push({
          id: `circular_${person.id}`,
          type: 'circular_reference',
          severity: 'error',
          message: `Circular reference detected in family tree involving ${person.name}`,
          affectedPersons: [person.id],
          suggestedAction: 'Review and correct parent-child relationships'
        });
      }
    });

    setState(prev => ({
      ...prev,
      validationErrors: errors
    }));
  }, [state.relationships, state.people]);

  const setRootPerson = useCallback((personId: string) => {
    setState(prev => ({
      ...prev,
      rootPersonId: personId
    }));
  }, []);

  const updateFilters = useCallback((filters: Partial<typeof state.filters>) => {
    setState(prev => ({
      ...prev,
      filters: { ...prev.filters, ...filters }
    }));
  }, []);

  const updateViewSettings = useCallback((settings: Partial<typeof state.viewSettings>) => {
    setState(prev => ({
      ...prev,
      viewSettings: { ...prev.viewSettings, ...settings }
    }));
  }, []);

  const treeData = useMemo(() => {
    if (!state.rootPersonId) return null;
    
    const buildTreeNode = (personId: string, generation = 0, visited = new Set<string>()): FamilyTreeNode | null => {
      if (visited.has(personId)) return null;
      visited.add(personId);
      
      const person = state.people.find(p => p.id === personId);
      if (!person) return null;

      const parents = state.relationships
        .filter(rel => rel.relatedPersonId === personId && rel.relationshipType === 'parent')
        .map(rel => buildTreeNode(rel.personId, generation - 1, new Set(visited)))
        .filter(Boolean) as FamilyTreeNode[];

      const children = state.relationships
        .filter(rel => rel.personId === personId && rel.relationshipType === 'parent')
        .map(rel => buildTreeNode(rel.relatedPersonId, generation + 1, new Set(visited)))
        .filter(Boolean) as FamilyTreeNode[];

      const spouses = state.relationships
        .filter(rel => rel.personId === personId && rel.relationshipType === 'spouse')
        .map(rel => buildTreeNode(rel.relatedPersonId, generation, new Set(visited)))
        .filter(Boolean) as FamilyTreeNode[];

      return {
        person,
        x: 0,
        y: 0,
        generation,
        side: generation === 0 ? 'direct' : (generation < 0 ? 'paternal' : 'maternal'),
        children,
        parents,
        spouses,
        isRoot: personId === state.rootPersonId,
        isHighlighted: false
      };
    };

    return buildTreeNode(state.rootPersonId);
  }, [state.rootPersonId, state.people, state.relationships]);

  return {
    ...state,
    treeData,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    inferRelationships,
    validateRelationships,
    setRootPerson,
    updateFilters,
    updateViewSettings
  };
};

const getReciprocalRelationship = (relationshipType: RelationshipType): RelationshipType | null => {
  const reciprocals: Record<RelationshipType, RelationshipType> = {
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
  
  return reciprocals[relationshipType] || null;
};
