import React, { useState } from 'react';
import { Person, RelationshipType } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Command, CommandInput, CommandList, CommandEmpty, CommandGroup, CommandItem } from '@/components/ui/command';
import { Badge } from '@/components/ui/badge';
import { Trash2, Plus, Brain, ChevronsUpDown, Check, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

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
  const [open1, setOpen1] = useState(false);
  const [open2, setOpen2] = useState(false);
  const [relSearch, setRelSearch] = useState('');

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
              <Popover open={open1} onOpenChange={setOpen1}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={open1} className="w-full justify-between font-normal">
                    {selectedPerson1 ? getPersonName(selectedPerson1) : 'Search person...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name..." />
                    <CommandList>
                      <CommandEmpty>No person found.</CommandEmpty>
                      <CommandGroup>
                        {people.map(person => (
                          <CommandItem
                            key={person.id}
                            value={person.name}
                            onSelect={() => { setSelectedPerson1(person.id); setOpen1(false); }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedPerson1 === person.id ? 'opacity-100' : 'opacity-0')} />
                            <span>{person.name}</span>
                            {person.birthDate && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                b. {new Date(person.birthDate).getFullYear()}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
              <Popover open={open2} onOpenChange={setOpen2}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox" aria-expanded={open2} className="w-full justify-between font-normal">
                    {selectedPerson2 ? getPersonName(selectedPerson2) : 'Search person...'}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[250px] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Type a name..." />
                    <CommandList>
                      <CommandEmpty>No person found.</CommandEmpty>
                      <CommandGroup>
                        {people.filter(p => p.id !== selectedPerson1).map(person => (
                          <CommandItem
                            key={person.id}
                            value={person.name}
                            onSelect={() => { setSelectedPerson2(person.id); setOpen2(false); }}
                          >
                            <Check className={cn('mr-2 h-4 w-4', selectedPerson2 === person.id ? 'opacity-100' : 'opacity-0')} />
                            <span>{person.name}</span>
                            {person.birthDate && (
                              <span className="ml-auto text-xs text-muted-foreground">
                                b. {new Date(person.birthDate).getFullYear()}
                              </span>
                            )}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
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
          <div className="flex items-center justify-between">
            <CardTitle>Existing Relationships ({relationships.length})</CardTitle>
            {relationships.length > 0 && (
              <div className="relative w-64">
                <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search relationships..."
                  value={relSearch}
                  onChange={e => setRelSearch(e.target.value)}
                  className="pl-8 h-9"
                />
              </div>
            )}
          </div>
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
              {relationships.filter(r => {
                if (!relSearch) return true;
                const q = relSearch.toLowerCase();
                return getPersonName(r.personId).toLowerCase().includes(q)
                  || getPersonName(r.relatedPersonId).toLowerCase().includes(q)
                  || getRelationshipLabel(r.relationshipType).toLowerCase().includes(q);
              }).map(relationship => (
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
