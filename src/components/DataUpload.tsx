import React, { useState, useCallback } from 'react';
import { Person, Relationship, RelationshipType } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataUploadProps {
  people: Person[];
  relationships: Relationship[];
  onImportPeople: (people: Person[]) => void;
  onImportRelationships: (relationships: Relationship[]) => void;
  onExportData: () => void;
}

interface ImportResult {
  success: Person[];
  relationships: Relationship[];
  errors: Array<{ row: number; message: string; data: string[] }>;
}

// New template columns
const FAMILY_COLUMNS = [
  'Name', 'Relationship', 'Birthdate', 'Gender', 'Spouse', 'Children', 'Father', 'Mother'
];

export const DataUpload: React.FC<DataUploadProps> = ({
  people,
  relationships,
  onImportPeople,
  onImportRelationships,
  onExportData
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  // Download the new template
  const downloadTemplate = () => {
    const template = [
      FAMILY_COLUMNS,
      ['Udhayakumar Durai', 'Main', '', 'male', 'Sudha Thangavelu', 'Prithiv Udhayakumar', 'Durai Submaniam', 'Kumudham Venugopal'],
      ['Sudha Thangavelu', 'Spouse', '', 'female', 'Udhayakumar Durai', 'Prithiv Udhayakumar', 'Thangavelu Sowndappan', 'Pachainayaki Subramanian'],
      ['Prithiv Udhayakumar', 'Son', '', 'male', '', '', 'Udhayakumar Durai', 'Sudha Thangavelu'],
      ['Sudha Ganesh', 'Sister', '', 'female', 'Ganesh Muthuvel', 'Nandini Ganesh, Kavin Ganesh', 'Durai Submaniam', 'Kumudham Venugopal'],
      ['Lathika Thangavelu', 'Sister in Law', '', 'female', 'Selvaraj Venkatesan', 'Vihaan Selvaraj', 'Thangavelu Sowndappan', 'Pachainayaki Subramanian'],
      ['Kumudham Venugopal', 'Mother', '', 'female', 'Durai Submaniam', 'Udhayakumar Durai, Sudha Ganesh', 'Venugopal Gurusamy', 'Krishnaveni Venugopal'],
      ['Durai Submaniam', 'Father', '', 'male', 'Kumudham Venugopal', 'Udhayakumar Durai, Sudha Ganesh', 'Subramniam Arasappan', 'Pappu Subramaniam'],
      ['Thangavelu Sowndappan', 'Father in Law', '', 'male', 'Pachainayaki Subramanian', 'Sudha Thangavelu, Lathika Thangavelu', 'Sowndappan Samy', 'Venkattammal Sowndappan'],
      ['Pachainayaki Subramanian', 'Mother in Law', '', 'female', 'Thangavelu Sowndappan', 'Sudha Thangavelu, Lathika Thangavelu', 'Subramanian Samy', 'Patti Subramanian'],
      ['Ganesh Muthuvel', 'Brother in Law', '', 'male', 'Sudha Ganesh', 'Nandini Ganesh, Kavin Ganesh', 'Muthuvel Ramasamy', 'Leelavathy Ayyavu'],
      ['Selvaraj Venkatesan', 'Brother in Law', '', 'male', 'Lathika Thangavelu', 'Vihaan Selvaraj', 'Venkatesan Sindan', 'Seetha Venkatesan']
    ];
    const csvContent = template.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family_import_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);
    toast({
      title: "Template Downloaded",
      description: "Use this template to format your family data for upload. Only one table needed!"
    });
  };

  // Helper to deduplicate relationships
  function deduplicateRelationships(rels: Relationship[]): Relationship[] {
    const seen = new Set<string>();
    const result: Relationship[] = [];
    for (const rel of rels) {
      let key = '';
      if (rel.relationshipType === 'spouse') {
        // Spouse is bidirectional, so sort ids
        key = ['spouse', ...[rel.personId, rel.relatedPersonId].sort()].join('-');
      } else {
        key = [rel.relationshipType, rel.personId, rel.relatedPersonId].join('-');
      }
      if (!seen.has(key)) {
        seen.add(key);
        result.push(rel);
      }
    }
    return result;
  }

  // Helper to normalize names for matching
  const normalizeName = (name: string) => name.replace(/\s+/g, ' ').trim().toLowerCase();

  // Parse the new single-table format (improved matching, warnings, deduplication)
  const parseFamilyCSV = (text: string): ImportResult => {
    const rows = text.split(/\r?\n/).filter(Boolean).map(line => line.split(',').map(cell => cell.replace(/"/g, '').trim()));
    if (rows.length < 2) {
      return { success: [], relationships: [], errors: [{ row: 1, message: 'CSV must have at least a header and one data row', data: [] }] };
    }
    const header = rows[0].map(h => h.trim());
    const colIdx = (col: string) => header.findIndex(h => h.toLowerCase() === col.toLowerCase());
    // Map of normalized name to person object
    const peopleMap: Record<string, Person> = {};
    // List of relationships
    let relationships: Relationship[] = [];
    const errors: Array<{ row: number; message: string; data: string[] }> = [];
    // First pass: create all people
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = row[colIdx('Name')] || '';
      const gender = (row[colIdx('Gender')] || '').toLowerCase();
      if (!name) {
        errors.push({ row: i + 1, message: 'Name is required', data: row });
        continue;
      }
      if (!['male', 'female', 'other', 'm', 'f', 'o'].includes(gender)) {
        errors.push({ row: i + 1, message: `Gender must be 'male', 'female', or 'other'`, data: row });
        continue;
      }
      peopleMap[normalizeName(name)] = {
        id: `imported_${i}_${Date.now()}`,
        name: name.trim(),
        firstName: '',
        lastName: '',
        gender: gender.startsWith('m') ? 'male' : gender.startsWith('f') ? 'female' : 'other',
        birthDate: row[colIdx('Birthdate')] || undefined,
        notes: row[colIdx('Relationship')] || undefined
      };
    }
    // Helper to create a placeholder person if missing
    const ensurePerson = (rawName: string, relType: string): Person => {
      const norm = normalizeName(rawName);
      if (peopleMap[norm]) return peopleMap[norm];
      // Guess gender from relationship type if possible
      let gender: Person['gender'] = 'other';
      if (relType === 'Father') gender = 'male';
      if (relType === 'Mother') gender = 'female';
      if (relType === 'Spouse') gender = 'other';
      // Use the relationship type as a note
      const person: Person = {
        id: `placeholder_${norm}_${Date.now()}`,
        name: rawName.trim(),
        firstName: '',
        lastName: '',
        gender,
        notes: `Placeholder created for ${relType}`
      };
      peopleMap[norm] = person;
      return person;
    };
    // Second pass: create relationships (auto-create placeholders for missing people)
    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = row[colIdx('Name')];
      if (!name || !peopleMap[normalizeName(name)]) continue;
      const person = peopleMap[normalizeName(name)];
      // Spouse
      const spouse = row[colIdx('Spouse')];
      if (spouse) {
        const spouseNorm = normalizeName(spouse);
        const spousePerson = peopleMap[spouseNorm] || ensurePerson(spouse, 'Spouse');
        relationships.push({
          id: `rel_spouse_${person.id}_${spousePerson.id}`,
          personId: person.id,
          relatedPersonId: spousePerson.id,
          relationshipType: 'spouse',
          isInferred: false,
          confidence: 1.0
        });
      }
      // Children (comma-separated)
      const children = row[colIdx('Children')];
      if (children) {
        children.split(/[,;]/).map(c => c.trim()).filter(Boolean).forEach(childName => {
          const childNorm = normalizeName(childName);
          const childPerson = peopleMap[childNorm] || ensurePerson(childName, 'Child');
          relationships.push({
            id: `rel_child_${person.id}_${childPerson.id}`,
            personId: person.id,
            relatedPersonId: childPerson.id,
            relationshipType: 'parent',
            isInferred: false,
            confidence: 1.0
          });
        });
      }
      // Father
      const father = row[colIdx('Father')];
      if (father) {
        const fatherNorm = normalizeName(father);
        const fatherPerson = peopleMap[fatherNorm] || ensurePerson(father, 'Father');
        relationships.push({
          id: `rel_father_${person.id}_${fatherPerson.id}`,
          personId: fatherPerson.id,
          relatedPersonId: person.id,
          relationshipType: 'parent',
          isInferred: false,
          confidence: 1.0
        });
      }
      // Mother
      const mother = row[colIdx('Mother')];
      if (mother) {
        const motherNorm = normalizeName(mother);
        const motherPerson = peopleMap[motherNorm] || ensurePerson(mother, 'Mother');
        relationships.push({
          id: `rel_mother_${person.id}_${motherPerson.id}`,
          personId: motherPerson.id,
          relatedPersonId: person.id,
          relationshipType: 'parent',
          isInferred: false,
          confidence: 1.0
        });
      }
    }
    // Deduplicate relationships
    relationships = deduplicateRelationships(relationships);
    // Return as import result
    return {
      success: Object.values(peopleMap),
      relationships,
      errors
    };
  };

  // Handle file upload
  const handleFileUpload = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.name.toLowerCase().endsWith('.csv')) {
      toast({
        title: "Invalid File Type",
        description: "Please upload a CSV file.",
        variant: "destructive"
      });
      return;
    }
    setIsUploading(true);
    try {
      const text = await file.text();
      const result = parseFamilyCSV(text);
      setImportResult(result);
      if (result.success.length > 0 || result.relationships.length > 0) {
        toast({
          title: "Data Processed",
          description: `${result.success.length} people and ${result.relationships.length} relationships imported successfully${result.errors.length > 0 ? `, ${result.errors.length} errors found` : ''}`
        });
      }
    } catch (error) {
      toast({
        title: "Import Failed",
        description: error instanceof Error ? error.message : "Failed to process file",
        variant: "destructive"
      });
    } finally {
      setIsUploading(false);
    }
  }, [toast]);

  const confirmImport = () => {
    if (importResult) {
      if (importResult.success.length > 0) {
        onImportPeople(importResult.success);
      }
      if (importResult.relationships.length > 0) {
        onImportRelationships(importResult.relationships);
      }
      setImportResult(null);
      toast({
        title: "Import Complete",
        description: `${importResult.success.length} people and ${importResult.relationships.length} relationships added to your family tree`
      });
    }
  };

  const exportCurrentData = () => {
    if (people.length === 0) {
      toast({
        title: "No Data to Export",
        description: "Add some people to your family tree first.",
        variant: "destructive"
      });
      return;
    }

    // Export people data
    const peopleHeaders = ['Name', 'First Name', 'Last Name', 'Gender', 'Birth Date', 'Death Date', 'Is Deceased', 'Birth Place', 'Occupation', 'Notes'];
    const peopleRows = people.map(person => [
      person.name,
      person.firstName || '',
      person.lastName || '',
      person.gender,
      person.birthDate || '',
      person.deathDate || '',
      person.isDeceased || false,
      person.birthPlace || '',
      person.occupation || '',
      person.notes || ''
    ]);

    const peopleCsv = [peopleHeaders, ...peopleRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Export relationships data
    const relationshipHeaders = ['Person 1 Name', 'Person 2 Name', 'Relationship Type', 'Notes'];
    const relationshipRows = relationships.map(relationship => {
      const person1 = people.find(p => p.id === relationship.personId);
      const person2 = people.find(p => p.id === relationship.relatedPersonId);
      return [
        person1?.name || 'Unknown',
        person2?.name || 'Unknown',
        relationship.relationshipType,
        relationship.notes || ''
      ];
    });

    const relationshipsCsv = [relationshipHeaders, ...relationshipRows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    // Combine into a single CSV with sections
    const combinedCsv = `# People Data\n${peopleCsv}\n\n# Relationships Data\n${relationshipsCsv}`;

    const blob = new Blob([combinedCsv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family_tree_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: `Exported ${people.length} people and ${relationships.length} relationships as CSV`
    });
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Upload className="w-5 h-5" />
            <span>Import Family Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Button
                onClick={downloadTemplate}
                variant="outline"
                className="w-full border-genealogy-primary text-genealogy-primary hover:bg-genealogy-primary hover:text-white"
              >
                <FileSpreadsheet className="w-4 h-4 mr-2" />
                Download Template
              </Button>
              <p className="text-sm text-muted-foreground mt-2">
                Download a CSV template with the correct format (single table)
              </p>
            </div>
            <div>
              <input
                type="file"
                accept=".csv"
                onChange={handleFileUpload}
                className="hidden"
                id="csv-upload"
                disabled={isUploading}
              />
              <label htmlFor="csv-upload" className="block">
                <div className="w-full bg-genealogy-primary hover:bg-genealogy-secondary text-white px-4 py-2 rounded-md flex items-center justify-center cursor-pointer disabled:opacity-50">
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Processing...' : 'Upload CSV File'}
                </div>
              </label>
              <p className="text-sm text-muted-foreground mt-2">
                Select a CSV file with your family data (single table)
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Import Results */}
      {importResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-green-500" />
              <span>Import Results</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {importResult.success.length > 0 && (
              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  {importResult.success.length} people ready to import
                </AlertDescription>
              </Alert>
            )}
            {importResult.errors.length > 0 && (
              <Alert variant="destructive">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  {importResult.errors.length} errors found:
                  <ul className="mt-2 ml-4 list-disc">
                    {importResult.errors.slice(0, 5).map((error, index) => (
                      <li key={index} className="text-sm">{error.message}</li>
                    ))}
                    {importResult.errors.length > 5 && (
                      <li className="text-sm">...and {importResult.errors.length - 5} more</li>
                    )}
                  </ul>
                </AlertDescription>
              </Alert>
            )}
            {importResult.success.length > 0 && (
              <div className="flex space-x-2">
                <Button
                  onClick={confirmImport}
                  className="bg-green-600 hover:bg-green-700"
                >
                  Confirm Import ({importResult.success.length} people)
                </Button>
                <Button
                  variant="outline"
                  onClick={() => setImportResult(null)}
                >
                  Cancel
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Export Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Download className="w-5 h-5" />
            <span>Export Family Data</span>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium">Current Family Tree</p>
              <p className="text-sm text-muted-foreground">
                {people.length} people in your family tree
              </p>
            </div>
            <Button
              onClick={exportCurrentData}
              variant="outline"
              disabled={people.length === 0}
              className="border-genealogy-secondary text-genealogy-secondary hover:bg-genealogy-secondary hover:text-white"
            >
              <Download className="w-4 h-4 mr-2" />
              Export as CSV
            </Button>
          </div>
          {/* Clear All Data Button */}
          <div className="mt-6 flex items-center justify-end">
            <Button
              variant="destructive"
              onClick={() => {
                if (window.confirm('Are you sure you want to clear all family data? This cannot be undone.')) {
                  localStorage.clear();
                  window.location.reload();
                }
              }}
            >
              Clear All Data
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
