import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { PersonForm } from '@/components/PersonForm';
import { RelationshipManager } from '@/components/RelationshipManager';
import { DataUpload } from '@/components/DataUpload';
import { DuplicateManager } from '@/components/DuplicateManager';
import { ReviewQueue } from '@/components/ReviewQueue';
import { D3NetworkGraph } from '@/components/D3NetworkGraph';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { useAuth } from '@/contexts/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { useSupabaseData } from '@/hooks/useSupabaseData';
import { testPeople, testRelationships } from '@/data/testFamilyData';
import {
  Users,
  Plus,
  LogOut,
  Database,
  Brain,
} from 'lucide-react';
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

  const handleImportPeople = (importedPeople: Person[]) => {
    if (!useCloud) {
      localTree.setPeople([...people, ...importedPeople]);
      toast({ title: 'People Imported', description: `${importedPeople.length} people added.` });
    }
  };

  const handleImportRelationships = (importedRels: Relationship[]) => {
    if (!useCloud) {
      importedRels.forEach(r => localTree.addRelationship(r.personId, r.relatedPersonId, r.relationshipType));
      setTimeout(() => localTree.inferRelationships(), 100);
      toast({ title: 'Relationships Imported', description: `${importedRels.length} relationships added. Inferring more...` });
    }
  };

  const handleMergePeople = (keepId: string, deleteId: string) => {
    if (!useCloud) {
      const keepPerson = people.find(p => p.id === keepId);
      const deletePerson = people.find(p => p.id === deleteId);
      localTree.mergePeople(keepId, deleteId);
      toast({ title: 'Merged', description: `"${deletePerson?.name}" merged into "${keepPerson?.name}". Relationships transferred.` });
    }
  };

  const handleDeletePerson = async (personId: string) => {
    const person = people.find(p => p.id === personId);
    await deletePerson(personId);
    toast({ title: 'Deleted', description: `${person?.name} removed.` });
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
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-royal-gradient rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-royal-gradient bg-clip-text text-transparent">
                  Family Tree
                </h1>
                <p className="text-sm text-muted-foreground">
                  {useCloud
                    ? `${user?.email ?? ''} (${isAdmin ? 'Admin' : 'Contributor'})`
                    : 'Local mode'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {people.length > 0 && (
                <Badge variant="secondary" className="bg-genealogy-primary/10 text-genealogy-primary">
                  {people.length} People &middot; {relationships.length} Relationships
                </Badge>
              )}
              {pendingChanges.length > 0 && isAdmin && (
                <Badge variant="destructive">{pendingChanges.length} Pending</Badge>
              )}
              {!useCloud && (
                <Button variant="outline" size="sm" onClick={handleLoadTestData}>
                  <Database className="w-4 h-4 mr-1" />
                  Load Test Data
                </Button>
              )}
              {!useCloud && people.length > 0 && (
                <Button variant="outline" size="sm" onClick={handleInferRelationships}>
                  <Brain className="w-4 h-4 mr-1" />
                  Infer
                </Button>
              )}
              {isAuthenticated && (
                <Button variant="ghost" size="sm" onClick={signOut}>
                  <LogOut className="w-4 h-4 mr-1" />
                  Sign Out
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
          <TabsList className="bg-white/50 backdrop-blur-sm">
            <TabsTrigger value="tree" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              Tree View
            </TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              People
            </TabsTrigger>
            <TabsTrigger value="relationships" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              Relationships
            </TabsTrigger>
            <TabsTrigger value="import" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              Import / Cleanup
            </TabsTrigger>
            {showReviewTab && (
              <TabsTrigger value="review" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
                Review
                {pendingChanges.length > 0 && (
                  <Badge variant="destructive" className="ml-2 h-5 px-1.5 text-xs">{pendingChanges.length}</Badge>
                )}
              </TabsTrigger>
            )}
          </TabsList>

          {/* Tree View */}
          <TabsContent value="tree">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-lg font-semibold">Family Network</h2>
                  <Button onClick={() => setShowPersonForm(true)} className="bg-royal-gradient hover:opacity-90" size="sm">
                    <Plus className="w-4 h-4 mr-1" /> Add Person
                  </Button>
                </div>
                <div className="bg-white rounded-lg border overflow-hidden" style={{ height: '700px' }}>
                  <D3NetworkGraph
                    people={people}
                    relationships={relationships}
                    onDeleteRelationship={handleDeleteRelationship}
                    onAddRelationship={handleAddRelationship}
                  />
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* People */}
          <TabsContent value="people">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Family Members</h2>
                  <Button onClick={() => setShowPersonForm(true)} className="bg-royal-gradient hover:opacity-90">
                    <Plus className="w-4 h-4 mr-2" /> Add Person
                  </Button>
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
                    {people.map(person => (
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
                            <Button variant="ghost" size="sm" onClick={() => handleNodeEdit(person.id)}>Edit</Button>
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
            />
            {people.length > 0 && (
              <DuplicateManager
                people={people}
                relationships={relationships}
                onMerge={handleMergePeople}
                onDelete={handleDeletePerson}
              />
            )}
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
        </Tabs>
      </main>

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
    </div>
  );
};

export default Index;
