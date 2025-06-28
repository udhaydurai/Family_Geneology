import React, { useState } from 'react';
import { Person, RelationshipType } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Brain } from 'lucide-react';

interface RelationshipManagerProps {
  people: Person[];
  relationships: Array<{
    id: string;
    personId: string;
    relatedPersonId: string;
    relationshipType: RelationshipType;
    isInferred?: boolean;
  }>;
  onAddRelationship: (personId: string, relatedPersonId: string, relationshipType: RelationshipType) => void;
  onDeleteRelationship: (relationshipId: string) => void;
  onInferRelationships: () => void;
}

const relationshipTypes: { value: RelationshipType; label: string }[] = [
  { value: 'parent', label: 'Parent' },
  { value: 'child', label: 'Child' },
  { value: 'spouse', label: 'Spouse' },
  { value: 'sibling', label: 'Sibling' },
  { value: 'grandparent', label: 'Grandparent' },
  { value: 'grandchild', label: 'Grandchild' },
  { value: 'aunt', label: 'Aunt' },
  { value: 'uncle', label: 'Uncle' },
  { value: 'niece', label: 'Niece' },
  { value: 'nephew', label: 'Nephew' },
  { value: 'cousin', label: 'Cousin' },
  { value: 'step-parent', label: 'Step Parent' },
  { value: 'step-child', label: 'Step Child' },
  { value: 'adopted-parent', label: 'Adopted Parent' },
  { value: 'adopted-child', label: 'Adopted Child' },
  { value: 'in-law', label: 'In-law' }
];

export const RelationshipManager: React.FC<RelationshipManagerProps> = ({
  people,
  relationships,
  onAddRelationship,
  onDeleteRelationship,
  onInferRelationships
}) => {
  const [selectedPerson1, setSelectedPerson1] = useState<string>('');
  const [selectedPerson2, setSelectedPerson2] = useState<string>('');
  const [selectedRelationship, setSelectedRelationship] = useState<RelationshipType>('parent');

  const handleAddRelationship = () => {
    if (selectedPerson1 && selectedPerson2 && selectedPerson1 !== selectedPerson2) {
      onAddRelationship(selectedPerson1, selectedPerson2, selectedRelationship);
      setSelectedPerson1('');
      setSelectedPerson2('');
    }
  };

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || 'Unknown';
  };

  const getRelationshipLabel = (type: RelationshipType) => {
    const relationship = relationshipTypes.find(r => r.value === type);
    return relationship?.label || type;
  };

  return (
    <div className="space-y-6">
      {/* Add New Relationship */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Plus className="w-5 h-5" />
            <span>Add Relationship</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Person 1</label>
              <Select value={selectedPerson1} onValueChange={setSelectedPerson1}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {people.map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Relationship</label>
              <Select value={selectedRelationship} onValueChange={(value) => setSelectedRelationship(value as RelationshipType)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {relationshipTypes.map(type => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Person 2</label>
              <Select value={selectedPerson2} onValueChange={setSelectedPerson2}>
                <SelectTrigger>
                  <SelectValue placeholder="Select person" />
                </SelectTrigger>
                <SelectContent>
                  {people.filter(p => p.id !== selectedPerson1).map(person => (
                    <SelectItem key={person.id} value={person.id}>
                      {person.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="flex space-x-2">
            <Button 
              onClick={handleAddRelationship}
              disabled={!selectedPerson1 || !selectedPerson2 || selectedPerson1 === selectedPerson2}
              className="bg-genealogy-primary hover:bg-genealogy-secondary"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Relationship
            </Button>
            
            <Button 
              onClick={onInferRelationships}
              variant="outline"
              className="border-genealogy-accent text-genealogy-accent hover:bg-genealogy-accent hover:text-white"
            >
              <Brain className="w-4 h-4 mr-2" />
              Auto-Infer Relationships
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Existing Relationships */}
      <Card>
        <CardHeader>
          <CardTitle>Existing Relationships ({relationships.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {relationships.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <div className="text-4xl mb-2">👥</div>
              <p>No relationships defined yet</p>
              <p className="text-sm">Add relationships above or use auto-inference</p>
            </div>
          ) : (
            <div className="space-y-3 max-h-96 overflow-y-auto">
              {relationships.map(relationship => (
                <div key={relationship.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center space-x-3">
                    <span className="font-medium">
                      {getPersonName(relationship.personId)}
                    </span>
                    <span className="text-muted-foreground">is</span>
                    <Badge variant="secondary" className="bg-genealogy-primary/10 text-genealogy-primary">
                      {getRelationshipLabel(relationship.relationshipType)}
                    </Badge>
                    <span className="text-muted-foreground">of</span>
                    <span className="font-medium">
                      {getPersonName(relationship.relatedPersonId)}
                    </span>
                    {relationship.isInferred && (
                      <Badge variant="outline" className="text-xs">
                        Inferred
                      </Badge>
                    )}
                  </div>
                  
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onDeleteRelationship(relationship.id)}
                    className="text-red-500 hover:text-red-700 hover:bg-red-50"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
