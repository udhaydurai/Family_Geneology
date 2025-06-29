import React from 'react';
import { ValidationError } from '@/types/family';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  AlertTriangle, 
  Info, 
  XCircle, 
  CheckCircle, 
  Eye,
  EyeOff
} from 'lucide-react';

interface ValidationDisplayProps {
  errors: ValidationError[];
  onDismiss?: (errorId: string) => void;
  onFixError?: (error: ValidationError) => void;
}

const getSeverityIcon = (severity: ValidationError['severity']) => {
  switch (severity) {
    case 'error':
      return <XCircle className="h-4 w-4 text-red-500" />;
    case 'warning':
      return <AlertTriangle className="h-4 w-4 text-yellow-500" />;
    case 'info':
      return <Info className="h-4 w-4 text-blue-500" />;
    default:
      return <Info className="h-4 w-4" />;
  }
};

const getSeverityColor = (severity: ValidationError['severity']) => {
  switch (severity) {
    case 'error':
      return 'border-red-200 bg-red-50';
    case 'warning':
      return 'border-yellow-200 bg-yellow-50';
    case 'info':
      return 'border-blue-200 bg-blue-50';
    default:
      return 'border-gray-200 bg-gray-50';
  }
};

export const ValidationDisplay: React.FC<ValidationDisplayProps> = ({
  errors,
  onDismiss,
  onFixError
}) => {
  const [showAll, setShowAll] = React.useState(false);
  
  const errorsBySeverity = errors.reduce((acc, error) => {
    if (!acc[error.severity]) {
      acc[error.severity] = [];
    }
    acc[error.severity].push(error);
    return acc;
  }, {} as Record<ValidationError['severity'], ValidationError[]>);

  const errorCount = errorsBySeverity.error?.length || 0;
  const warningCount = errorsBySeverity.warning?.length || 0;
  const infoCount = errorsBySeverity.info?.length || 0;

  if (errors.length === 0) {
    return (
      <Card className="border-green-200 bg-green-50">
        <CardContent className="p-4">
          <div className="flex items-center space-x-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <span className="text-green-800 font-medium">All validations passed!</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const displayErrors = showAll ? errors : errors.filter(e => e.severity === 'error');

  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h3 className="text-lg font-semibold">Validation Results</h3>
          <div className="flex space-x-2">
            {errorCount > 0 && (
              <Badge variant="destructive" className="bg-red-100 text-red-800 border-red-300">
                {errorCount} Error{errorCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {warningCount > 0 && (
              <Badge variant="secondary" className="bg-yellow-100 text-yellow-800 border-yellow-300">
                {warningCount} Warning{warningCount !== 1 ? 's' : ''}
              </Badge>
            )}
            {infoCount > 0 && (
              <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-300">
                {infoCount} Info
              </Badge>
            )}
          </div>
        </div>
        
        <Button
          variant="outline"
          size="sm"
          onClick={() => setShowAll(!showAll)}
          className="flex items-center space-x-2"
        >
          {showAll ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          <span>{showAll ? 'Show Errors Only' : 'Show All'}</span>
        </Button>
      </div>

      {/* Error List */}
      <div className="space-y-3">
        {displayErrors.map((error) => (
          <Card key={error.id} className={`border ${getSeverityColor(error.severity)}`}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex items-start space-x-3 flex-1">
                  {getSeverityIcon(error.severity)}
                  <div className="flex-1 space-y-2">
                    <div className="flex items-center space-x-2">
                      <span className="font-medium text-gray-900">
                        {error.message}
                      </span>
                      <Badge variant="outline" className="text-xs">
                        {error.type.replace('_', ' ')}
                      </Badge>
                    </div>
                    
                    {error.suggestedAction && (
                      <p className="text-sm text-gray-600">
                        <strong>Suggestion:</strong> {error.suggestedAction}
                      </p>
                    )}
                    
                    {error.affectedPersons.length > 0 && (
                      <div className="text-xs text-gray-500">
                        <strong>Affected:</strong> {error.affectedPersons.length} person{error.affectedPersons.length !== 1 ? 's' : ''}
                      </div>
                    )}
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  {onFixError && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => onFixError(error)}
                      className="text-xs"
                    >
                      Fix
                    </Button>
                  )}
                  {onDismiss && (
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => onDismiss(error.id)}
                      className="text-xs text-gray-400 hover:text-gray-600"
                    >
                      Dismiss
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Show More Button */}
      {!showAll && (warningCount > 0 || infoCount > 0) && (
        <div className="text-center">
          <Button
            variant="outline"
            onClick={() => setShowAll(true)}
            className="text-sm"
          >
            Show {warningCount + infoCount} more issue{warningCount + infoCount !== 1 ? 's' : ''}
          </Button>
        </div>
      )}
    </div>
  );
}; 