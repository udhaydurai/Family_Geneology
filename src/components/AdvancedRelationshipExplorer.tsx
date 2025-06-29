import React, { useState } from 'react';
import { Person, RelationshipType } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Separator } from '@/components/ui/separator';
import { 
  Search, 
  Users, 
  UserCheck, 
  Network, 
  ArrowRight,
  Brain,
  Users2,
  Heart
} from 'lucide-react';
import { RelationshipPath } from '@/lib/relationshipGraph';

interface AdvancedRelationshipExplorerProps {
  people: Person[];
  findRelationshipPath: (fromPersonId: string, toPersonId: string, maxDistance?: number) => RelationshipPath[];
  getRelationshipLabelBetween: (fromPersonId: string, toPersonId: string) => string;
  getCousins: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
  getAuntsAndUncles: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
  getNiecesAndNephews: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
  getGrandparents: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
  getGrandchildren: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
  getInLaws: (personId: string) => Array<{ personId: string; paths: RelationshipPath[] }>;
}

export const AdvancedRelationshipExplorer: React.FC<AdvancedRelationshipExplorerProps> = ({
  people,
  findRelationshipPath,
  getRelationshipLabelBetween,
  getCousins,
  getAuntsAndUncles,
  getNiecesAndNephews,
  getGrandparents,
  getGrandchildren,
  getInLaws
}) => {
  const [selectedPerson1, setSelectedPerson1] = useState<string>('');
  const [selectedPerson2, setSelectedPerson2] = useState<string>('');
  const [selectedPersonForQueries, setSelectedPersonForQueries] = useState<string>('');
  const [relationshipResult, setRelationshipResult] = useState<{
    paths: RelationshipPath[];
    label: string;
  } | null>(null);
  const [queryResults, setQueryResults] = useState<{
    type: string;
    results: Array<{ personId: string; paths: RelationshipPath[] }>;
  } | null>(null);

  const handleFindRelationship = () => {
    if (selectedPerson1 && selectedPerson2) {
      const paths = findRelationshipPath(selectedPerson1, selectedPerson2);
      const label = getRelationshipLabelBetween(selectedPerson1, selectedPerson2);
      setRelationshipResult({ paths, label });
    }
  };

  const handleQueryRelatives = (queryType: string) => {
    if (!selectedPersonForQueries) return;

    let results;
    switch (queryType) {
      case 'cousins':
        results = getCousins(selectedPersonForQueries);
        break;
      case 'auntsAndUncles':
        results = getAuntsAndUncles(selectedPersonForQueries);
        break;
      case 'niecesAndNephews':
        results = getNiecesAndNephews(selectedPersonForQueries);
        break;
      case 'grandparents':
        results = getGrandparents(selectedPersonForQueries);
        break;
      case 'grandchildren':
        results = getGrandchildren(selectedPersonForQueries);
        break;
      case 'inLaws':
        results = getInLaws(selectedPersonForQueries);
        break;
      default:
        results = [];
    }

    setQueryResults({ type: queryType, results });
  };

  const getPersonName = (personId: string) => {
    const person = people.find(p => p.id === personId);
    return person?.name || 'Unknown';
  };

  const formatPath = (path: RelationshipType[]) => {
    if (path.length === 0) return 'self';
    return path.join(' → ');
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Network className="w-5 h-5" />
            <span>Advanced Relationship Explorer</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="pathfinder" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="pathfinder" className="flex items-center space-x-2">
                <Search className="w-4 h-4" />
                <span>Path Finder</span>
              </TabsTrigger>
              <TabsTrigger value="queries" className="flex items-center space-x-2">
                <Users className="w-4 h-4" />
                <span>Relationship Queries</span>
              </TabsTrigger>
            </TabsList>

            <TabsContent value="pathfinder" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-medium">Person 1</label>
                  <Select value={selectedPerson1} onValueChange={setSelectedPerson1}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select first person" />
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
                  <label className="text-sm font-medium">Person 2</label>
                  <Select value={selectedPerson2} onValueChange={setSelectedPerson2}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select second person" />
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

              <Button 
                onClick={handleFindRelationship}
                disabled={!selectedPerson1 || !selectedPerson2}
                className="w-full bg-genealogy-primary hover:bg-genealogy-secondary"
              >
                <Search className="w-4 h-4 mr-2" />
                Find Relationship Path
              </Button>

              {relationshipResult && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <h4 className="font-semibold text-lg mb-2">Relationship Found</h4>
                    <Badge variant="secondary" className="text-lg px-4 py-2">
                      {relationshipResult.label}
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div>
                    <h5 className="font-medium mb-2">Relationship Paths:</h5>
                    {relationshipResult.paths.length === 0 ? (
                      <p className="text-muted-foreground">No relationship path found</p>
                    ) : (
                      <div className="space-y-2">
                        {relationshipResult.paths.slice(0, 3).map((path: RelationshipPath, index: number) => (
                          <div key={index} className="flex items-center space-x-2 p-2 bg-background rounded">
                            <Badge variant="outline">{path.distance} steps</Badge>
                            <ArrowRight className="w-4 h-4" />
                            <span className="font-mono text-sm">{formatPath(path.path)}</span>
                            <Badge variant="secondary" className="ml-auto">
                              {Math.round(path.confidence * 100)}% confidence
                            </Badge>
                          </div>
                        ))}
                        {relationshipResult.paths.length > 3 && (
                          <p className="text-sm text-muted-foreground">
                            ... and {relationshipResult.paths.length - 3} more paths
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </TabsContent>

            <TabsContent value="queries" className="space-y-4">
              <div className="space-y-2">
                <label className="text-sm font-medium">Select Person</label>
                <Select value={selectedPersonForQueries} onValueChange={setSelectedPersonForQueries}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select person for queries" />
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

              <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('cousins')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <Users2 className="w-4 h-4" />
                  <span className="text-xs">Cousins</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('auntsAndUncles')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <Users className="w-4 h-4" />
                  <span className="text-xs">Aunts/Uncles</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('niecesAndNephews')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <UserCheck className="w-4 h-4" />
                  <span className="text-xs">Nieces/Nephews</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('grandparents')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <Brain className="w-4 h-4" />
                  <span className="text-xs">Grandparents</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('grandchildren')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <Heart className="w-4 h-4" />
                  <span className="text-xs">Grandchildren</span>
                </Button>
                
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleQueryRelatives('inLaws')}
                  disabled={!selectedPersonForQueries}
                  className="flex flex-col items-center space-y-1 h-auto py-3"
                >
                  <Network className="w-4 h-4" />
                  <span className="text-xs">In-Laws</span>
                </Button>
              </div>

              {queryResults && (
                <div className="space-y-4 p-4 bg-muted/50 rounded-lg">
                  <div className="text-center">
                    <h4 className="font-semibold text-lg mb-2">
                      {queryResults.type === 'cousins' && 'Cousins'}
                      {queryResults.type === 'auntsAndUncles' && 'Aunts & Uncles'}
                      {queryResults.type === 'niecesAndNephews' && 'Nieces & Nephews'}
                      {queryResults.type === 'grandparents' && 'Grandparents'}
                      {queryResults.type === 'grandchildren' && 'Grandchildren'}
                      {queryResults.type === 'inLaws' && 'In-Laws'}
                    </h4>
                    <Badge variant="secondary">
                      {queryResults.results.length} found
                    </Badge>
                  </div>
                  
                  <Separator />
                  
                  <div className="space-y-2 max-h-64 overflow-y-auto">
                    {queryResults.results.length === 0 ? (
                      <p className="text-muted-foreground text-center">No relatives found</p>
                    ) : (
                      queryResults.results.map((result: { personId: string; paths: RelationshipPath[] }) => (
                        <div key={result.personId} className="flex items-center justify-between p-2 bg-background rounded">
                          <span className="font-medium">
                            {getPersonName(result.personId)}
                          </span>
                          <Badge variant="outline" className="text-xs">
                            {result.paths.length} path{result.paths.length !== 1 ? 's' : ''}
                          </Badge>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}; 