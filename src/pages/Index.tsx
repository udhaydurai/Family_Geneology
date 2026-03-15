import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/components/PersonForm';
import { RelationshipManager } from '@/components/RelationshipManager';
import { DataUpload } from '@/components/DataUpload';

import { ReviewQueue } from '@/components/ReviewQueue';
import { D3NetworkGraph } from '@/components/D3NetworkGraph';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { testPeople, testRelationships } from '@/data/testFamilyData';
import {
  Plus,
  LogOut,
  Database,
  Brain,
  Search,
  Info,
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';

const Index = () => {
  const { user, isAdmin, signOut, isAuthenticated } = useAuth();
  const localTree = useFamilyTree();
  const supabaseData = useSupabaseData();
  const { toast } = useToast();

  // Use Supabase if configured (no auth required in simple mode)
  const useCloud = isSupabaseConfigured;
  const people = useCloud ? supabaseData.people : localTree.people;
  const relationships = useCloud ? supabaseData.relationships : localTree.relationships;
  const pendingChanges = useCloud ? supabaseData.pendingChanges : [];

  const addPerson = useCloud ? supabaseData.addPerson : async (p: Omit<Person, 'id'>) => localTree.addPerson(p);
  const updatePerson = useCloud ? supabaseData.updatePerson : async (id: string, u: Partial<Person>) => localTree.updatePerson(id, u);
  const deletePerson = useCloud ? supabaseData.deletePerson : async (id: string) => localTree.deletePerson(id);
  const addRelationship = useCloud
    ? supabaseData.addRelationship
    : async (a: string, b: string, t: RelationshipType) => localTree.addRelationship(a, b, t);
  const deleteRelationship = useCloud
    ? supabaseData.deleteRelationship
    : async (id: string) => localTree.deleteRelationship(id);

  const [activeTab, setActiveTab] = useState('tree');
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [peopleSearch, setPeopleSearch] = useState('');
  const [showAbout, setShowAbout] = useState(false);

  const handleAddPerson = async (personData: Omit<Person, 'id'>) => {
    await addPerson(personData);
    setShowPersonForm(false);
    toast({ title: 'Person Added', description: `${personData.name} has been added.` });
  };

  const handleEditPerson = async (personData: Omit<Person, 'id'>) => {
    if (editingPerson) {
      await updatePerson(editingPerson.id, personData);
      setEditingPerson(null);
      toast({ title: 'Person Updated', description: `${personData.name} has been updated.` });
    }
  };

  const handleNodeEdit = (personId: string) => {
    const person = people.find(p => p.id === personId);
    if (person) setEditingPerson(person);
  };

  const handleAddRelationship = async (personId: string, relatedPersonId: string, type: RelationshipType) => {
    await addRelationship(personId, relatedPersonId, type);
    toast({ title: 'Relationship Added', description: 'New relationship has been established.' });
  };

  const handleDeleteRelationship = async (relationshipId: string) => {
    await deleteRelationship(relationshipId);
    toast({ title: 'Relationship Removed', description: 'The relationship has been deleted.' });
  };

  // Track ID mapping from imported IDs to Supabase IDs
  const importIdMapRef = React.useRef<Record<string, string>>({});

  const handleImportPeople = async (importedPeople: Person[]) => {
    if (useCloud) {
      const idMap: Record<string, string> = {};
      let added = 0;
      for (const p of importedPeople) {
        const { id: oldId, ...rest } = p;
        const newId = await supabaseData.addPerson(rest);
        if (newId) {
          idMap[oldId] = newId;
          added++;
        }
      }
      importIdMapRef.current = idMap;
      toast({ title: 'People Imported', description: `${added} people added to database.` });
    } else {
      localTree.setPeople([...people, ...importedPeople]);
      toast({ title: 'People Imported', description: `${importedPeople.length} people added.` });
    }
  };

  const handleImportRelationships = async (importedRels: Relationship[]) => {
    if (useCloud) {
      const idMap = importIdMapRef.current;
      let added = 0;
      for (const r of importedRels) {
        const personId = idMap[r.personId] || r.personId;
        const relatedPersonId = idMap[r.relatedPersonId] || r.relatedPersonId;
        await addRelationship(personId, relatedPersonId, r.relationshipType);
        added++;
      }
      toast({ title: 'Relationships Imported', description: `${added} relationships added.` });
    } else {
      importedRels.forEach(r => localTree.addRelationship(r.personId, r.relatedPersonId, r.relationshipType));
      setTimeout(() => localTree.inferRelationships(), 100);
      toast({ title: 'Relationships Imported', description: `${importedRels.length} relationships added. Inferring more...` });
    }
  };



  const handleDeletePerson = async (personId: string) => {
    const person = people.find(p => p.id === personId);
    await deletePerson(personId);
    toast({ title: 'Deleted', description: `${person?.name} removed.` });
  };

  const handleClearAll = async () => {
    if (useCloud) {
      await supabaseData.clearAll();
    } else {
      localStorage.clear();
      window.location.reload();
    }
  };

  const handleInferRelationships = () => {
    if (!useCloud) {
      localTree.inferRelationships();
      localTree.validateRelationships();
    }
    toast({ title: 'Relationships Inferred', description: 'New relationships added based on existing data.' });
  };

  const handleLoadTestData = () => {
    if (!useCloud) {
      localTree.loadData(testPeople, testRelationships);
      // Auto-infer after a tick so state has settled
      setTimeout(() => {
        localTree.inferRelationships();
      }, 50);
      toast({ title: 'Test Data Loaded', description: `${testPeople.length} people and ${testRelationships.length} relationships loaded. Inferring additional relationships...` });
    }
  };

  const showReviewTab = isAdmin && useCloud;

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      <Tabs value={activeTab} onValueChange={setActiveTab}>
      {/* Compact Header: tabs + stats + actions in one row */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-1.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <img src="/veergal-logo.svg" alt="வேர்கள்" className="w-7 h-7 rounded-full" />
                  <span className="font-bold text-sm bg-royal-gradient bg-clip-text text-transparent">வேர்கள்</span>
                </div>
                <TabsList className="bg-white/50 backdrop-blur-sm h-8">
                  <TabsTrigger value="tree" className="text-xs h-7 data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                    Tree
                  </TabsTrigger>
                  <TabsTrigger value="people" className="text-xs h-7 data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                    People
                  </TabsTrigger>
                  <TabsTrigger value="relationships" className="text-xs h-7 data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                    Relationships
                  </TabsTrigger>
                  <TabsTrigger value="import" className="text-xs h-7 data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                    Import
                  </TabsTrigger>
                  {showReviewTab && (
                    <TabsTrigger value="review" className="text-xs h-7 data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                      Review
                      {pendingChanges.length > 0 && (
                        <Badge variant="destructive" className="ml-1 h-4 px-1 text-[10px]">{pendingChanges.length}</Badge>
                      )}
                    </TabsTrigger>
                  )}
                </TabsList>
              </div>

              <div className="flex items-center gap-2">
                {people.length > 0 && (
                  <span className="text-[11px] text-muted-foreground">
                    {people.length} people &middot; {relationships.length} rels
                  </span>
                )}
                {pendingChanges.length > 0 && isAdmin && (
                  <Badge variant="destructive" className="text-[10px] h-4 px-1">{pendingChanges.length} Pending</Badge>
                )}
                {!useCloud && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleLoadTestData}>
                    <Database className="w-3 h-3 mr-1" /> Test Data
                  </Button>
                )}
                {!useCloud && people.length > 0 && (
                  <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleInferRelationships}>
                    <Brain className="w-3 h-3 mr-1" /> Infer
                  </Button>
                )}
                {activeTab === 'tree' && (
                  <Button onClick={() => setShowPersonForm(true)} className="bg-royal-gradient hover:opacity-90 h-7 text-xs" size="sm">
                    <Plus className="w-3 h-3 mr-1" /> Add Person
                  </Button>
                )}
                <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setShowAbout(true)}>
                  <Info className="w-3 h-3 mr-1" /> About
                </Button>
                {isAuthenticated && (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={signOut}>
                    <LogOut className="w-3 h-3 mr-1" /> Sign Out
                  </Button>
                )}
              </div>
            </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-2">

          {/* Tree View */}
          <TabsContent value="tree" className="mt-0">
                <div className="bg-white rounded-lg border overflow-hidden" style={{ height: 'calc(100vh - 56px)' }}>
                  <D3NetworkGraph
                    people={people}
                    relationships={relationships}
                    onDeleteRelationship={handleDeleteRelationship}
                    onAddRelationship={handleAddRelationship}
                  />
                </div>
          </TabsContent>

          {/* People */}
          <TabsContent value="people">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Family Members</h2>
                  <div className="flex items-center gap-3">
                    {people.length > 0 && (
                      <div className="relative w-64">
                        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                        <Input
                          placeholder="Search people..."
                          value={peopleSearch}
                          onChange={e => setPeopleSearch(e.target.value)}
                          className="pl-8 h-9"
                        />
                      </div>
                    )}
                    <Button onClick={() => setShowPersonForm(true)} className="bg-royal-gradient hover:opacity-90">
                      <Plus className="w-4 h-4 mr-2" /> Add Person
                    </Button>
                  </div>
                </div>

                {people.length === 0 ? (
                  <div className="text-center py-12">
                    <h3 className="text-lg font-semibold mb-2">No Family Members Yet</h3>
                    <p className="text-muted-foreground mb-4">Start by adding people or loading test data</p>
                    <div className="flex gap-3 justify-center">
                      <Button onClick={() => setShowPersonForm(true)} className="bg-royal-gradient hover:opacity-90">
                        <Plus className="w-4 h-4 mr-2" /> Add First Person
                      </Button>
                      {!useCloud && (
                        <Button variant="outline" onClick={handleLoadTestData}>
                          <Database className="w-4 h-4 mr-2" /> Load Test Data
                        </Button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {people.filter(p => {
                      if (!peopleSearch) return true;
                      const q = peopleSearch.toLowerCase();
                      return p.name.toLowerCase().includes(q)
                        || (p.birthPlace && p.birthPlace.toLowerCase().includes(q))
                        || (p.gender && p.gender.toLowerCase().includes(q));
                    }).map(person => (
                      <Card key={person.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center font-medium text-white ${
                              person.isDeceased ? 'bg-gray-400' :
                              person.gender === 'male' ? 'bg-blue-500' :
                              person.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
                            }`}>
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{person.name}</h3>
                              <p className="text-sm text-muted-foreground capitalize">
                                {person.gender}
                                {person.isDeceased && ' · Deceased'}
                              </p>
                            </div>
                          </div>
                          <div className="flex justify-between items-center">
                            <div className="text-xs text-muted-foreground">
                              {person.birthDate && `b. ${new Date(person.birthDate).getFullYear()}`}
                              {person.birthPlace && ` · ${person.birthPlace}`}
                            </div>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="sm" onClick={() => handleNodeEdit(person.id)}>Edit</Button>
                              <Button variant="ghost" size="sm" className="text-red-500 hover:text-red-700 hover:bg-red-50" onClick={() => {
                                if (window.confirm(`Delete ${person.name}? This will also remove all their relationships.`)) {
                                  handleDeletePerson(person.id);
                                }
                              }}>Delete</Button>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* Relationships */}
          <TabsContent value="relationships">
            <RelationshipManager
              people={people}
              relationships={relationships}
              onAddRelationship={handleAddRelationship}
              onDeleteRelationship={handleDeleteRelationship}
              onInferRelationships={handleInferRelationships}
            />
          </TabsContent>

          {/* Import / Cleanup */}
          <TabsContent value="import" className="space-y-6">
            <DataUpload
              people={people}
              relationships={relationships}
              onImportPeople={handleImportPeople}
              onImportRelationships={handleImportRelationships}
              onExportData={() => {}}
              onClearAll={handleClearAll}
            />
          </TabsContent>

          {/* Review Queue (Admin only) */}
          {showReviewTab && (
            <TabsContent value="review">
              <ReviewQueue
                pendingChanges={pendingChanges}
                onApprove={supabaseData.approveChange}
                onReject={supabaseData.rejectChange}
              />
            </TabsContent>
          )}

      </main>
      </Tabs>

      {/* Person Form Dialog */}
      <Dialog open={showPersonForm || !!editingPerson} onOpenChange={() => {
        setShowPersonForm(false);
        setEditingPerson(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingPerson ? 'Edit Person' : 'Add New Person'}</DialogTitle>
          </DialogHeader>
          <PersonForm
            person={editingPerson || undefined}
            onSubmit={editingPerson ? handleEditPerson : handleAddPerson}
            onCancel={() => { setShowPersonForm(false); setEditingPerson(null); }}
          />
        </DialogContent>
      </Dialog>

      {/* About Dialog */}
      <Dialog open={showAbout} onOpenChange={setShowAbout}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3">
              <img src="/veergal-logo.svg" alt="வேர்கள்" className="w-10 h-10 rounded-full" />
              <div>
                <div className="text-lg">வேர்கள் <span className="text-sm font-normal text-muted-foreground">(Veergal)</span></div>
                <div className="text-xs font-normal text-muted-foreground italic">Every family has a story. This is ours.</div>
              </div>
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <p className="text-muted-foreground">
              வேர்கள் means <strong>"Roots"</strong> in Tamil. A family tree built as a gift from a father to his son —
              to preserve the connections, stories, and roots that bind our family together.
            </p>

            <div>
              <h3 className="font-semibold mb-2">How to Use</h3>
              <div className="space-y-2 text-muted-foreground text-xs">
                <div className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] shrink-0">Click</span>
                  <span>Click any person to see their family tree in a hierarchical view</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] shrink-0">+/−</span>
                  <span>Expand or collapse in-law branches using the toggle near spouse nodes</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] shrink-0">Scroll</span>
                  <span>Scroll wheel or pinch to zoom in/out. Drag to pan around</span>
                </div>
                <div className="flex gap-2">
                  <span className="font-mono bg-muted px-1.5 py-0.5 rounded text-[10px] shrink-0">Background</span>
                  <span>Click the background to return to the force-directed network view</span>
                </div>
              </div>
            </div>

            <div>
              <h3 className="font-semibold mb-2">Tabs</h3>
              <div className="space-y-1 text-muted-foreground text-xs">
                <p><strong>Tree</strong> — Interactive family network visualization</p>
                <p><strong>People</strong> — View and manage family members</p>
                <p><strong>Relationships</strong> — Add and search connections between people</p>
                <p><strong>Import</strong> — Bulk import from CSV and data cleanup</p>
              </div>
            </div>

            <div className="border-t pt-3 text-[10px] text-muted-foreground text-center">
              Built with love by Udhay Durai
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
