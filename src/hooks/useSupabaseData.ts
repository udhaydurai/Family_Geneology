import { useState, useCallback, useEffect } from 'react';
import { supabase, isSupabaseConfigured } from '@/lib/supabase';
import { Person, Relationship, RelationshipType, PendingChange } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const toSnakeCase = (person: Omit<Person, 'id'> & { id?: string }) => ({
  id: person.id,
  name: person.name,
  first_name: person.firstName,
  last_name: person.lastName,
  birth_date: person.birthDate,
  death_date: person.deathDate,
  gender: person.gender,
  is_deceased: person.isDeceased,
  profile_image: person.profileImage,
  notes: person.notes,
  birth_place: person.birthPlace,
  occupation: person.occupation,
});

const toCamelCase = (row: Record<string, unknown>): Person => ({
  id: row.id as string,
  name: row.name as string,
  firstName: row.first_name as string | undefined,
  lastName: row.last_name as string | undefined,
  birthDate: row.birth_date as string | undefined,
  deathDate: row.death_date as string | undefined,
  gender: row.gender as 'male' | 'female' | 'other',
  isDeceased: row.is_deceased as boolean | undefined,
  profileImage: row.profile_image as string | undefined,
  notes: row.notes as string | undefined,
  birthPlace: row.birth_place as string | undefined,
  occupation: row.occupation as string | undefined,
});

const relToSnake = (rel: Relationship) => ({
  id: rel.id,
  person_id: rel.personId,
  related_person_id: rel.relatedPersonId,
  relationship_type: rel.relationshipType,
  is_inferred: rel.isInferred,
  confidence: rel.confidence,
  notes: rel.notes,
});

const relToCamel = (row: Record<string, unknown>): Relationship => ({
  id: row.id as string,
  personId: row.person_id as string,
  relatedPersonId: row.related_person_id as string,
  relationshipType: row.relationship_type as RelationshipType,
  isInferred: row.is_inferred as boolean | undefined,
  confidence: row.confidence as number | undefined,
  notes: row.notes as string | undefined,
});

export const useSupabaseData = () => {
  const [people, setPeople] = useState<Person[]>([]);
  const [relationships, setRelationships] = useState<Relationship[]>([]);
  const [pendingChanges, setPendingChanges] = useState<PendingChange[]>([]);
  const [loading, setLoading] = useState(true);
  const { user, isAdmin } = useAuth();
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    if (!supabase) return;
    setLoading(true);

    const [peopleRes, relsRes] = await Promise.all([
      supabase.from('people').select('*').order('created_at'),
      supabase.from('relationships').select('*'),
    ]);

    if (peopleRes.data) setPeople(peopleRes.data.map(toCamelCase));
    if (relsRes.data) setRelationships(relsRes.data.map(relToCamel));

    setLoading(false);
  }, []);

  const fetchPendingChanges = useCallback(async () => {
    // No pending_changes table in simple mode
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    fetchData();
  }, [fetchData]);

  const submitChange = useCallback(async (
    changeType: PendingChange['change_type'],
    payload: Record<string, unknown>
  ) => {
    if (!supabase || !user) return;

    const { error } = await supabase.from('pending_changes').insert({
      change_type: changeType,
      payload,
      submitted_by: user.id,
      submitted_by_email: user.email,
    });

    if (error) {
      toast({ title: 'Error', description: error.message, variant: 'destructive' });
    } else {
      toast({ title: 'Submitted for Review', description: 'An admin will review your change.' });
      fetchPendingChanges();
    }
  }, [user, toast, fetchPendingChanges]);

  const addPerson = useCallback(async (person: Omit<Person, 'id'>) => {
    const id = `person_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const newPerson = { ...person, id };

    if (supabase) {
      const { error } = await supabase.from('people').insert(toSnakeCase(newPerson));
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return '';
      }
      setPeople(prev => [...prev, newPerson as Person]);
      return id;
    } else {
      await submitChange('add_person', toSnakeCase(newPerson) as Record<string, unknown>);
      return '';
    }
  }, [isAdmin, toast, submitChange]);

  const updatePerson = useCallback(async (personId: string, updates: Partial<Person>) => {
    if (supabase) {
      const snakeUpdates: Record<string, unknown> = {};
      if (updates.name !== undefined) snakeUpdates.name = updates.name;
      if (updates.firstName !== undefined) snakeUpdates.first_name = updates.firstName;
      if (updates.lastName !== undefined) snakeUpdates.last_name = updates.lastName;
      if (updates.birthDate !== undefined) snakeUpdates.birth_date = updates.birthDate;
      if (updates.deathDate !== undefined) snakeUpdates.death_date = updates.deathDate;
      if (updates.gender !== undefined) snakeUpdates.gender = updates.gender;
      if (updates.isDeceased !== undefined) snakeUpdates.is_deceased = updates.isDeceased;
      if (updates.profileImage !== undefined) snakeUpdates.profile_image = updates.profileImage;
      if (updates.notes !== undefined) snakeUpdates.notes = updates.notes;
      if (updates.birthPlace !== undefined) snakeUpdates.birth_place = updates.birthPlace;
      if (updates.occupation !== undefined) snakeUpdates.occupation = updates.occupation;

      const { error } = await supabase.from('people').update(snakeUpdates).eq('id', personId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setPeople(prev => prev.map(p => p.id === personId ? { ...p, ...updates } : p));
    } else {
      await submitChange('edit_person', { id: personId, ...updates });
    }
  }, [isAdmin, toast, submitChange]);

  const deletePerson = useCallback(async (personId: string) => {
    if (supabase) {
      const { error } = await supabase.from('people').delete().eq('id', personId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setPeople(prev => prev.filter(p => p.id !== personId));
      setRelationships(prev => prev.filter(r => r.personId !== personId && r.relatedPersonId !== personId));
    } else {
      await submitChange('delete_person', { id: personId });
    }
  }, [toast, submitChange]);

  const addRelationship = useCallback(async (
    personId: string,
    relatedPersonId: string,
    relationshipType: RelationshipType
  ) => {
    const id = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const rel: Relationship = { id, personId, relatedPersonId, relationshipType, confidence: 1.0 };

    if (supabase) {
      const { error } = await supabase.from('relationships').insert(relToSnake(rel));
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setRelationships(prev => [...prev, rel]);

      const reciprocal = getReciprocalRelationship(relationshipType);
      if (reciprocal) {
        const recId = `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        const recRel: Relationship = { id: recId, personId: relatedPersonId, relatedPersonId: personId, relationshipType: reciprocal, confidence: 1.0 };
        await supabase.from('relationships').insert(relToSnake(recRel));
        setRelationships(prev => [...prev, recRel]);
      }
    } else {
      await submitChange('add_relationship', { personId, relatedPersonId, relationshipType });
    }
  }, [toast, submitChange]);

  const deleteRelationship = useCallback(async (relationshipId: string) => {
    if (supabase) {
      const { error } = await supabase.from('relationships').delete().eq('id', relationshipId);
      if (error) {
        toast({ title: 'Error', description: error.message, variant: 'destructive' });
        return;
      }
      setRelationships(prev => prev.filter(r => r.id !== relationshipId));
    } else {
      await submitChange('delete_relationship', { id: relationshipId });
    }
  }, [toast, submitChange]);

  // No-ops in simple mode (no pending_changes table)
  const approveChange = useCallback(async (_changeId: string) => {}, []);
  const rejectChange = useCallback(async (_changeId: string, _note?: string) => {}, []);

  const setPeopleDirectly = useCallback((newPeople: Person[]) => {
    setPeople(newPeople);
  }, []);

  return {
    people,
    relationships,
    pendingChanges,
    loading,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    deleteRelationship,
    approveChange,
    rejectChange,
    setPeople: setPeopleDirectly,
    refetch: fetchData,
  };
};

const getReciprocalRelationship = (type: RelationshipType): RelationshipType | null => {
  const map: Record<RelationshipType, RelationshipType> = {
    'parent': 'child', 'child': 'parent', 'spouse': 'spouse', 'sibling': 'sibling',
    'grandparent': 'grandchild', 'grandchild': 'grandparent',
    'aunt': 'niece', 'uncle': 'nephew', 'niece': 'aunt', 'nephew': 'uncle',
    'cousin': 'cousin', 'step-parent': 'step-child', 'step-child': 'step-parent',
    'adopted-parent': 'adopted-child', 'adopted-child': 'adopted-parent', 'in-law': 'in-law',
  };
  return map[type] ?? null;
};
