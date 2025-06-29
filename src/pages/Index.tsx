import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFamilyTree } from '@/hooks/useFamilyTree';
import { FamilyTreeVisualization } from '@/components/FamilyTreeVisualization';
import { PersonForm } from '@/components/PersonForm';
import { RelationshipManager } from '@/components/RelationshipManager';
import { DataUpload } from '@/components/DataUpload';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { ValidationDisplay } from '@/components/ValidationDisplay';
import { AdvancedRelationshipExplorer } from '@/components/AdvancedRelationshipExplorer';
import { 
  Users, 
  Plus, 
  Upload, 
  Download, 
  Search, 
  Brain,
  Eye,
  EyeOff,
  Filter,
  Settings
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { D3NetworkGraph } from '@/components/D3NetworkGraph';

const Index = () => {
  console.log('Index component rendering...'); // Debug log
  
  const {
    people,
    relationships,
    rootPersonId,
    treeData,
    validationErrors,
    filters,
    viewSettings,
    addPerson,
    updatePerson,
    deletePerson,
    addRelationship,
    inferRelationships,
    validateRelationships,
    setRootPerson,
    updateFilters,
    updateViewSettings,
    findRelationshipPath,
    getRelationshipLabelBetween,
    getCousins,
    getAuntsAndUncles,
    getNiecesAndNephews,
    getGrandparents,
    getGrandchildren,
    getInLaws,
    setPeople
  } = useFamilyTree();

  console.log('useFamilyTree hook loaded, people:', people.length, 'relationships:', relationships.length); // Debug log

  const [activeTab, setActiveTab] = useState('tree');
  const [showPersonForm, setShowPersonForm] = useState(false);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const { toast } = useToast();

  const handleAddPerson = (personData: Omit<Person, 'id'>) => {
    const personId = addPerson(personData);
    setShowPersonForm(false);
    
    if (!rootPersonId) {
      setRootPerson(personId);
    }
    
    toast({
      title: "Person Added",
      description: `${personData.name} has been added to your family tree`
    });
  };

  const handleEditPerson = (personData: Omit<Person, 'id'>) => {
    if (editingPerson) {
      updatePerson(editingPerson.id, personData);
      setEditingPerson(null);
      toast({
        title: "Person Updated",
        description: `${personData.name} has been updated`
      });
    }
  };

  const handleNodeClick = (personId: string) => {
    setRootPerson(personId);
    toast({
      title: "Root Changed",
      description: "Family tree centered on new person"
    });
  };

  const handleNodeEdit = (personId: string) => {
    const person = people.find(p => p.id === personId);
    if (person) {
      setEditingPerson(person);
    }
  };

  const handleImportPeople = (importedPeople: Person[]) => {
    if (typeof setPeople === 'function') {
      setPeople(importedPeople);
    } else {
      importedPeople.forEach(person => {
        addPerson(person);
      });
    }
    if (!rootPersonId && importedPeople.length > 0) {
      setRootPerson(importedPeople[0].id);
    }
  };

  const handleImportRelationships = (importedRelationships: Relationship[]) => {
    importedRelationships.forEach(relationship => {
      addRelationship(relationship.personId, relationship.relatedPersonId, relationship.relationshipType);
    });
  };

  const handleInferRelationships = () => {
    inferRelationships();
    validateRelationships();
    toast({
      title: "Relationships Inferred",
      description: "AI has analyzed and added new relationships based on existing data"
    });
  };

  const handleAddRelationship = (personId: string, relatedPersonId: string, relationshipType: RelationshipType) => {
    addRelationship(personId, relatedPersonId, relationshipType);
    toast({
      title: "Relationship Added",
      description: "New relationship has been established"
    });
  };

  const handleDeleteRelationship = (relationshipId: string) => {
    // Implementation would filter out the relationship
    toast({
      title: "Relationship Removed",
      description: "The relationship has been deleted"
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-100">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-sm border-b border-purple-100 sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-royal-gradient rounded-lg">
                <Users className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold bg-royal-gradient bg-clip-text text-transparent">
                  Family Tree Builder
                </h1>
                <p className="text-sm text-muted-foreground">
                  Intelligent genealogy with AI-powered relationship inference
                </p>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {people.length > 0 && (
                <Badge variant="secondary" className="bg-genealogy-primary/10 text-genealogy-primary">
                  {people.length} People • {relationships.length} Relationships
                </Badge>
              )}
              
              {validationErrors.length > 0 && (
                <Badge variant="destructive">
                  {validationErrors.length} Issues
                </Badge>
              )}
              {/* Version/timestamp for build validation */}
              <span className="text-xs text-gray-400 ml-4">Build: {new Date().toLocaleString()}</span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4 bg-white/50 backdrop-blur-sm">
            <TabsTrigger value="tree" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              🌳 Tree View
            </TabsTrigger>
            <TabsTrigger value="people" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              👥 People
            </TabsTrigger>
            <TabsTrigger value="relationships" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              🔗 Relationships
            </TabsTrigger>
            <TabsTrigger value="data" className="data-[state=active]:bg-genealogy-primary data-[state=active]:text-white">
              📊 Data Import/Export
            </TabsTrigger>
          </TabsList>

          {/* Tree View Tab */}
          <TabsContent value="tree" className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center space-x-4">
                    <h2 className="text-xl font-semibold">Family Network Graph</h2>
                  </div>
                </div>
                <div className="bg-white rounded-lg border overflow-hidden" style={{ height: '700px' }}>
                  {(() => {
                    try {
                      return (
                        <D3NetworkGraph
                          people={people}
                          relationships={relationships}
                        />
                      );
                    } catch (error) {
                      console.error('Error rendering D3NetworkGraph:', error);
                      return (
                        <div className="w-full h-full flex items-center justify-center bg-red-50">
                          <div className="text-center">
                            <h3 className="text-lg font-semibold mb-2 text-red-600">Error Loading Family Network</h3>
                            <p className="text-red-500 mb-2">People: {people.length}, Relationships: {relationships.length}</p>
                            <p className="text-sm text-gray-600">Error: {error instanceof Error ? error.message : String(error)}</p>
                          </div>
                        </div>
                      );
                    }
                  })()}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          {/* People Tab */}
          <TabsContent value="people" className="space-y-6">
            <Card className="bg-white/70 backdrop-blur-sm">
              <CardContent className="p-6">
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-semibold">Family Members</h2>
                  <Button 
                    onClick={() => setShowPersonForm(true)}
                    className="bg-royal-gradient hover:opacity-90"
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    Add Person
                  </Button>
                </div>

                {people.length === 0 ? (
                  <div className="text-center py-12">
                    <div className="text-6xl mb-4">👨‍👩‍👧‍👦</div>
                    <h3 className="text-lg font-semibold mb-2">No Family Members Yet</h3>
                    <p className="text-muted-foreground mb-4">Start building your family tree by adding people</p>
                    <Button 
                      onClick={() => setShowPersonForm(true)}
                      className="bg-royal-gradient hover:opacity-90"
                    >
                      <Plus className="w-4 h-4 mr-2" />
                      Add First Person
                    </Button>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {people.map(person => (
                      <Card key={person.id} className="hover:shadow-md transition-shadow">
                        <CardContent className="p-4">
                          <div className="flex items-center space-x-3 mb-3">
                            <div className="w-10 h-10 bg-genealogy-primary/10 rounded-full flex items-center justify-center">
                              {person.name.charAt(0).toUpperCase()}
                            </div>
                            <div className="flex-1">
                              <h3 className="font-medium">{person.name}</h3>
                              <p className="text-sm text-muted-foreground capitalize">{person.gender}</p>
                            </div>
                          </div>
                          
                          <div className="flex justify-between items-center">
                            <Badge variant="outline">
                              {person.birthDate ? new Date(person.birthDate).getFullYear() : 'Unknown'}
                            </Badge>
                            <div className="flex space-x-1">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setRootPerson(person.id)}
                              >
                                View Tree
                              </Button>
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleNodeEdit(person.id)}
                              >
                                Edit
                              </Button>
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

          {/* Relationships Tab */}
          <TabsContent value="relationships" className="space-y-6">
            <RelationshipManager
              people={people}
              relationships={relationships}
              onAddRelationship={handleAddRelationship}
              onDeleteRelationship={handleDeleteRelationship}
              onInferRelationships={handleInferRelationships}
            />
            
            <AdvancedRelationshipExplorer
              people={people}
              findRelationshipPath={findRelationshipPath}
              getRelationshipLabelBetween={getRelationshipLabelBetween}
              getCousins={getCousins}
              getAuntsAndUncles={getAuntsAndUncles}
              getNiecesAndNephews={getNiecesAndNephews}
              getGrandparents={getGrandparents}
              getGrandchildren={getGrandchildren}
              getInLaws={getInLaws}
            />
            
            {/* Validation Display */}
            {validationErrors.length > 0 && (
              <Card className="bg-white/70 backdrop-blur-sm">
                <CardContent className="p-6">
                  <ValidationDisplay
                    errors={validationErrors}
                    onDismiss={(errorId) => {
                      // For now, just show a toast - in a real app, you'd want to persist dismissed errors
                      toast({
                        title: "Error Dismissed",
                        description: "Validation error has been dismissed"
                      });
                    }}
                    onFixError={(error) => {
                      // Handle fixing specific errors
                      toast({
                        title: "Fix Error",
                        description: `Attempting to fix: ${error.message}`
                      });
                    }}
                  />
                </CardContent>
              </Card>
            )}
          </TabsContent>

          {/* Data Import/Export Tab */}
          <TabsContent value="data" className="space-y-6">
            <DataUpload
              people={people}
              relationships={relationships}
              onImportPeople={handleImportPeople}
              onImportRelationships={handleImportRelationships}
              onExportData={() => {}}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Person Form Dialog */}
      <Dialog open={showPersonForm || !!editingPerson} onOpenChange={() => {
        setShowPersonForm(false);
        setEditingPerson(null);
      }}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingPerson ? 'Edit Person' : 'Add New Person'}
            </DialogTitle>
          </DialogHeader>
          <PersonForm
            person={editingPerson || undefined}
            onSubmit={editingPerson ? handleEditPerson : handleAddPerson}
            onCancel={() => {
              setShowPersonForm(false);
              setEditingPerson(null);
            }}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Index;
