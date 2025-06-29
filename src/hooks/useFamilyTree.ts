import { useState, useCallback, useMemo, useEffect } from 'react';
import { Person, Relationship, RelationshipType, FamilyTreeState, ValidationError, FamilyTreeNode } from '@/types/family';
import { 
  buildRelationshipGraph, 
  findRelationshipPaths, 
  getRelationshipLabel, 
  getAllRelatives, 
  relationshipFilters,
  type RelationshipPath,
  type RelationshipGraph 
} from '@/lib/relationshipGraph';

const STORAGE_KEY = 'family-tree-data';

const getInitialState = (): FamilyTreeState => {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (error) {
    console.warn('Failed to load family tree data from localStorage:', error);
  }
  
  return {
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
  };
};

export const useFamilyTree = () => {
  const [state, setState] = useState<FamilyTreeState>(getInitialState);

  // Save to localStorage whenever state changes
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch (error) {
      console.warn('Failed to save family tree data to localStorage:', error);
    }
  }, [state]);

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
      
      // Helper function to check if relationship already exists
      const relationshipExists = (person1: string, person2: string, type: RelationshipType) => {
        return newRelationships.some(rel => 
          (rel.personId === person1 && rel.relatedPersonId === person2 && rel.relationshipType === type) ||
          (rel.personId === person2 && rel.relatedPersonId === person1 && rel.relationshipType === type)
        );
      };

      // Helper function to add relationship if it doesn't exist
      const addRelationshipIfNotExists = (person1: string, person2: string, type: RelationshipType, confidence = 0.95) => {
        if (!relationshipExists(person1, person2, type)) {
          newRelationships.push({
            id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            personId: person1,
            relatedPersonId: person2,
            relationshipType: type,
            isInferred: true,
            confidence
          });
          
          // Add reciprocal relationship
          const reciprocalType = getReciprocalRelationship(type);
          if (reciprocalType && !relationshipExists(person2, person1, reciprocalType)) {
            newRelationships.push({
              id: `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
              personId: person2,
              relatedPersonId: person1,
              relationshipType: reciprocalType,
              isInferred: true,
              confidence
            });
          }
        }
      };

      // 1. Infer sibling relationships
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
            addRelationshipIfNotExists(children[i], children[j], 'sibling');
          }
        }
      });

      // 2. Infer grandparent relationships
      childrenByParent.forEach((children, parentId) => {
        // Find grandparents of this parent
        const grandparentRels = parentChildRels.filter(rel => rel.relatedPersonId === parentId);
        grandparentRels.forEach(gpRel => {
          children.forEach(childId => {
            addRelationshipIfNotExists(gpRel.personId, childId, 'grandparent', 0.9);
          });
        });
      });

      // 3. Infer aunt/uncle relationships
      childrenByParent.forEach((children, parentId) => {
        // Find siblings of this parent
        const parentSiblingRels = newRelationships.filter(rel => 
          rel.relationshipType === 'sibling' && 
          (rel.personId === parentId || rel.relatedPersonId === parentId)
        );
        
        parentSiblingRels.forEach(siblingRel => {
          const auntUncleId = siblingRel.personId === parentId ? siblingRel.relatedPersonId : siblingRel.personId;
          const auntUncle = people.find(p => p.id === auntUncleId);
          
          if (auntUncle) {
            children.forEach(childId => {
              const relationshipType = auntUncle.gender === 'female' ? 'aunt' : 'uncle';
              addRelationshipIfNotExists(auntUncleId, childId, relationshipType, 0.85);
            });
          }
        });
      });

      // 4. Infer cousin relationships
      childrenByParent.forEach((children1, parent1Id) => {
        childrenByParent.forEach((children2, parent2Id) => {
          if (parent1Id !== parent2Id) {
            // Check if parents are siblings
            const parentsAreSiblings = relationshipExists(parent1Id, parent2Id, 'sibling');
            
            if (parentsAreSiblings) {
              children1.forEach(child1Id => {
                children2.forEach(child2Id => {
                  addRelationshipIfNotExists(child1Id, child2Id, 'cousin', 0.8);
                });
              });
            }
          }
        });
      });

      // 5. Infer in-law relationships
      const spouseRels = prev.relationships.filter(rel => rel.relationshipType === 'spouse');
      spouseRels.forEach(spouseRel => {
        const spouse1 = spouseRel.personId;
        const spouse2 = spouseRel.relatedPersonId;
        
        // Spouse's parents become in-laws
        const spouse1Parents = parentChildRels.filter(rel => rel.relatedPersonId === spouse1);
        spouse1Parents.forEach(parentRel => {
          addRelationshipIfNotExists(parentRel.personId, spouse2, 'in-law', 0.7);
        });
        
        const spouse2Parents = parentChildRels.filter(rel => rel.relatedPersonId === spouse2);
        spouse2Parents.forEach(parentRel => {
          addRelationshipIfNotExists(parentRel.personId, spouse1, 'in-law', 0.7);
        });
      });

      return {
        ...prev,
        relationships: newRelationships
      };
    });
  }, []);

  const validateRelationships = useCallback(() => {
    const errors: ValidationError[] = [];
    
    // Helper function to get person by ID
    const getPerson = (id: string) => state.people.find(p => p.id === id);
    
    // Helper function to parse date safely
    const parseDate = (dateString?: string) => {
      if (!dateString) return null;
      const date = new Date(dateString);
      return isNaN(date.getTime()) ? null : date;
    };
    
    // 1. Check for circular references
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

    // 2. Check for age conflicts and birth date validation
    state.relationships.forEach(relationship => {
      if (relationship.relationshipType === 'parent') {
        const parent = getPerson(relationship.personId);
        const child = getPerson(relationship.relatedPersonId);
        
        if (parent && child) {
          const parentBirth = parseDate(parent.birthDate);
          const childBirth = parseDate(child.birthDate);
          
          if (parentBirth && childBirth && parentBirth > childBirth) {
            errors.push({
              id: `age_conflict_${relationship.id}`,
              type: 'age_conflict',
              severity: 'error',
              message: `${parent.name} cannot be the parent of ${child.name} - birth date conflict`,
              affectedPersons: [parent.id, child.id],
              suggestedAction: 'Check and correct birth dates'
            });
          }
          
          // Check if parent is too young (less than 10 years older than child)
          if (parentBirth && childBirth) {
            const ageDiff = childBirth.getTime() - parentBirth.getTime();
            const yearsDiff = ageDiff / (1000 * 60 * 60 * 24 * 365.25);
            
            if (yearsDiff < 10) {
              errors.push({
                id: `young_parent_${relationship.id}`,
                type: 'logical_error',
                severity: 'warning',
                message: `${parent.name} is unusually young to be the parent of ${child.name} (${Math.round(yearsDiff)} years difference)`,
                affectedPersons: [parent.id, child.id],
                suggestedAction: 'Verify parent-child relationship and birth dates'
              });
            }
          }
        }
      }
    });

    // 3. Check for duplicate relationships
    const relationshipMap = new Map<string, Set<string>>();
    
    state.relationships.forEach(relationship => {
      const key = `${relationship.personId}-${relationship.relationshipType}`;
      if (!relationshipMap.has(key)) {
        relationshipMap.set(key, new Set());
      }
      relationshipMap.get(key)!.add(relationship.relatedPersonId);
    });
    
    relationshipMap.forEach((relatedPersons, key) => {
      if (relatedPersons.size > 1) {
        const [personId, relationshipType] = key.split('-');
        const person = getPerson(personId);
        
        errors.push({
          id: `duplicate_${key}`,
          type: 'duplicate_relationship',
          severity: 'warning',
          message: `${person?.name || 'Unknown'} has multiple ${relationshipType} relationships`,
          affectedPersons: [personId, ...Array.from(relatedPersons)],
          suggestedAction: 'Review and consolidate duplicate relationships'
        });
      }
    });

    // 4. Check for missing critical data
    state.people.forEach(person => {
      if (!person.birthDate && !person.isDeceased) {
        errors.push({
          id: `missing_birth_${person.id}`,
          type: 'missing_data',
          severity: 'info',
          message: `${person.name} is missing birth date`,
          affectedPersons: [person.id],
          suggestedAction: 'Add birth date for better relationship validation'
        });
      }
      
      if (person.isDeceased && !person.deathDate) {
        errors.push({
          id: `missing_death_${person.id}`,
          type: 'missing_data',
          severity: 'info',
          message: `${person.name} is marked as deceased but missing death date`,
          affectedPersons: [person.id],
          suggestedAction: 'Add death date or unmark as deceased'
        });
      }
    });

    // 5. Check for logical inconsistencies in spouse relationships
    const spouseRels = state.relationships.filter(rel => rel.relationshipType === 'spouse');
    spouseRels.forEach(spouseRel => {
      const spouse1 = getPerson(spouseRel.personId);
      const spouse2 = getPerson(spouseRel.relatedPersonId);
      
      if (spouse1 && spouse2) {
        const spouse1Birth = parseDate(spouse1.birthDate);
        const spouse2Birth = parseDate(spouse2.birthDate);
        
        if (spouse1Birth && spouse2Birth) {
          const ageDiff = Math.abs(spouse1Birth.getTime() - spouse2Birth.getTime());
          const yearsDiff = ageDiff / (1000 * 60 * 60 * 24 * 365.25);
          
          if (yearsDiff > 50) {
            errors.push({
              id: `age_gap_${spouseRel.id}`,
              type: 'logical_error',
              severity: 'warning',
              message: `${spouse1.name} and ${spouse2.name} have a large age gap (${Math.round(yearsDiff)} years)`,
              affectedPersons: [spouse1.id, spouse2.id],
              suggestedAction: 'Verify spouse relationship and birth dates'
            });
          }
        }
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
    console.log('Generating tree data:', {
      hasRootPerson: !!state.rootPersonId,
      rootPersonId: state.rootPersonId,
      peopleCount: state.people.length,
      relationshipsCount: state.relationships.length
    });
    
    if (!state.rootPersonId) {
      console.log('No root person set, returning null');
      return null;
    }
    
    const buildTreeNode = (personId: string, generation = 0, visited = new Set<string>()): FamilyTreeNode | null => {
      if (visited.has(personId)) return null;
      visited.add(personId);
      
      const person = state.people.find(p => p.id === personId);
      if (!person) {
        console.log('Person not found:', personId);
        return null;
      }

      console.log('Building tree node for:', person.name, 'generation:', generation);

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

      const treeNode = {
        person,
        x: 0,
        y: 0,
        generation,
        side: (generation === 0 ? 'direct' : (generation < 0 ? 'paternal' : 'maternal')) as 'maternal' | 'paternal' | 'direct',
        children,
        parents,
        spouses,
        isRoot: personId === state.rootPersonId,
        isHighlighted: false
      };

      console.log('Created tree node:', {
        name: person.name,
        parentsCount: parents.length,
        childrenCount: children.length,
        spousesCount: spouses.length,
        isRoot: treeNode.isRoot
      });

      return treeNode;
    };

    const result = buildTreeNode(state.rootPersonId);
    console.log('Tree data generation complete:', {
      hasResult: !!result,
      rootPersonName: result?.person?.name
    });
    return result;
  }, [state.rootPersonId, state.people, state.relationships]);

  // Graph-based relationship functions
  const relationshipGraph = useMemo(() => {
    return buildRelationshipGraph(state.people, state.relationships);
  }, [state.people, state.relationships]);

  const findRelationshipPath = useCallback((
    fromPersonId: string,
    toPersonId: string,
    maxDistance: number = 6
  ): RelationshipPath[] => {
    return findRelationshipPaths(relationshipGraph, fromPersonId, toPersonId, maxDistance);
  }, [relationshipGraph]);

  const getRelationshipLabelBetween = useCallback((
    fromPersonId: string,
    toPersonId: string
  ): string => {
    const fromPerson = state.people.find(p => p.id === fromPersonId);
    const toPerson = state.people.find(p => p.id === toPersonId);
    
    if (!fromPerson || !toPerson) return 'Unknown';
    
    const paths = findRelationshipPaths(relationshipGraph, fromPersonId, toPersonId, 6);
    if (paths.length === 0) return 'No relationship found';
    
    const shortestPath = paths[0];
    return getRelationshipLabel(shortestPath.path, fromPerson, toPerson, state.people);
  }, [relationshipGraph, state.people]);

  const getAllRelativesOf = useCallback((
    personId: string,
    filter: (path: RelationshipPath) => boolean,
    maxDistance: number = 6
  ): Array<{ personId: string; paths: RelationshipPath[] }> => {
    return getAllRelatives(relationshipGraph, personId, filter, maxDistance);
  }, [relationshipGraph]);

  // Convenience functions for common relationship queries
  const getCousins = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.cousins);
  }, [getAllRelativesOf]);

  const getAuntsAndUncles = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.auntsAndUncles);
  }, [getAllRelativesOf]);

  const getNiecesAndNephews = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.niecesAndNephews);
  }, [getAllRelativesOf]);

  const getGrandparents = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.grandparents);
  }, [getAllRelativesOf]);

  const getGrandchildren = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.grandchildren);
  }, [getAllRelativesOf]);

  const getInLaws = useCallback((personId: string) => {
    return getAllRelativesOf(personId, relationshipFilters.inLaws);
  }, [getAllRelativesOf]);

  const setPeople = useCallback((people: Person[]) => {
    setState(prev => ({
      ...prev,
      people
    }));
  }, []);

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
    updateViewSettings,
    // Graph-based relationship functions
    findRelationshipPath,
    getRelationshipLabelBetween,
    getAllRelativesOf,
    getCousins,
    getAuntsAndUncles,
    getNiecesAndNephews,
    getGrandparents,
    getGrandchildren,
    getInLaws,
    setPeople
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
