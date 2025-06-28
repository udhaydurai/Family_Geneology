
import React, { useState, useCallback } from 'react';
import { Person } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Upload, Download, FileSpreadsheet, CheckCircle, AlertCircle } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface DataUploadProps {
  people: Person[];
  onImportPeople: (people: Person[]) => void;
  onExportData: () => void;
}

interface ImportResult {
  success: Person[];
  errors: Array<{ row: number; message: string; data: any }>;
}

export const DataUpload: React.FC<DataUploadProps> = ({
  people,
  onImportPeople,
  onExportData
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const { toast } = useToast();

  const downloadTemplate = () => {
    const template = [
      ['Name', 'First Name', 'Last Name', 'Gender', 'Birth Date', 'Death Date', 'Is Deceased', 'Birth Place', 'Occupation', 'Notes'],
      ['John Smith', 'John', 'Smith', 'male', '1980-01-15', '', 'false', 'New York, NY', 'Engineer', 'Sample person'],
      ['Jane Doe', 'Jane', 'Doe', 'female', '1985-03-20', '', 'false', 'Los Angeles, CA', 'Teacher', 'Another sample']
    ];

    const csvContent = template.map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'family_tree_template.csv';
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Template Downloaded",
      description: "Use this template to format your family data for upload."
    });
  };

  const parseCSV = (text: string): string[][] => {
    const lines = text.split('\n');
    const result: string[][] = [];
    
    for (const line of lines) {
      if (line.trim() === '') continue;
      
      const row: string[] = [];
      let current = '';
      let inQuotes = false;
      
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === ',' && !inQuotes) {
          row.push(current.trim());
          current = '';
        } else {
          current += char;
        }
      }
      
      row.push(current.trim());
      result.push(row);
    }
    
    return result;
  };

  const validateAndParsePerson = (row: string[], index: number): { person?: Person; error?: string } => {
    const [name, firstName, lastName, gender, birthDate, deathDate, isDeceased, birthPlace, occupation, notes] = row;
    
    if (!name || !gender) {
      return { error: `Row ${index + 1}: Name and Gender are required` };
    }
    
    if (!['male', 'female', 'other'].includes(gender.toLowerCase())) {
      return { error: `Row ${index + 1}: Gender must be 'male', 'female', or 'other'` };
    }
    
    const person: Person = {
      id: `imported_${Date.now()}_${index}`,
      name: name.replace(/"/g, ''),
      firstName: firstName?.replace(/"/g, '') || '',
      lastName: lastName?.replace(/"/g, '') || '',
      gender: gender.toLowerCase() as 'male' | 'female' | 'other',
      birthDate: birthDate?.replace(/"/g, '') || undefined,
      deathDate: deathDate?.replace(/"/g, '') || undefined,
      isDeceased: isDeceased?.toLowerCase().replace(/"/g, '') === 'true',
      birthPlace: birthPlace?.replace(/"/g, '') || undefined,
      occupation: occupation?.replace(/"/g, '') || undefined,
      notes: notes?.replace(/"/g, '') || undefined
    };
    
    return { person };
  };

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
      const rows = parseCSV(text);
      
      if (rows.length < 2) {
        throw new Error('CSV file must contain at least a header row and one data row');
      }
      
      const [header, ...dataRows] = rows;
      const result: ImportResult = { success: [], errors: [] };
      
      dataRows.forEach((row, index) => {
        const { person, error } = validateAndParsePerson(row, index);
        
        if (error) {
          result.errors.push({ row: index + 2, message: error, data: row });
        } else if (person) {
          result.success.push(person);
        }
      });
      
      setImportResult(result);
      
      if (result.success.length > 0) {
        toast({
          title: "Data Processed",
          description: `${result.success.length} people imported successfully${result.errors.length > 0 ? `, ${result.errors.length} errors found` : ''}`
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
    if (importResult?.success) {
      onImportPeople(importResult.success);
      setImportResult(null);
      toast({
        title: "Import Complete",
        description: `${importResult.success.length} people added to your family tree`
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

    const headers = ['Name', 'First Name', 'Last Name', 'Gender', 'Birth Date', 'Death Date', 'Is Deceased', 'Birth Place', 'Occupation', 'Notes'];
    const rows = people.map(person => [
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

    const csvContent = [headers, ...rows].map(row => 
      row.map(cell => `"${cell}"`).join(',')
    ).join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `family_tree_export_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);

    toast({
      title: "Data Exported",
      description: "Your family tree data has been downloaded as CSV"
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
                Download a CSV template with the correct format
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
                <Button
                  as="span"
                  disabled={isUploading}
                  className="w-full bg-genealogy-primary hover:bg-genealogy-secondary cursor-pointer"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  {isUploading ? 'Processing...' : 'Upload CSV File'}
                </Button>
              </label>
              <p className="text-sm text-muted-foreground mt-2">
                Select a CSV file with your family data
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
        </CardContent>
      </Card>
    </div>
  );
};
