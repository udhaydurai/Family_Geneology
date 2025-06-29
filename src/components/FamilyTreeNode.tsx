import React from 'react';
import { NodeProps } from 'reactflow';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Person } from '@/types/family';
import { Calendar, MapPin, Briefcase } from 'lucide-react';

interface FamilyTreeNodeData {
  person: Person;
  isRoot?: boolean;
  isHighlighted?: boolean;
  showDetails?: boolean;
  onNodeClick: () => void;
  onNodeEdit: () => void;
}

export const FamilyTreeNode: React.FC<NodeProps<FamilyTreeNodeData>> = ({
  data
}) => {
  const { person, isRoot = false, isHighlighted = false, showDetails = true, onNodeClick, onNodeEdit } = data;

  const getGenderColor = (gender: string) => {
    switch (gender) {
      case 'male': return 'bg-blue-100 border-blue-300 text-blue-800';
      case 'female': return 'bg-pink-100 border-pink-300 text-pink-800';
      default: return 'bg-purple-100 border-purple-300 text-purple-800';
    }
  };

  const formatDate = (dateString?: string) => {
    if (!dateString) return '';
    try {
      return new Date(dateString).getFullYear().toString();
    } catch {
      return dateString;
    }
  };

  return (
    <Card 
      className={`
        family-tree-node relative p-4 cursor-pointer transition-all duration-200 min-w-[200px] max-w-[280px]
        ${isRoot ? 'ring-2 ring-genealogy-primary shadow-lg scale-105' : ''}
        ${isHighlighted ? 'ring-2 ring-genealogy-accent shadow-md' : ''}
        ${person.isDeceased ? 'opacity-75 border-gray-400' : ''}
        hover:shadow-lg hover:scale-102
      `}
      onClick={onNodeClick}
    >
      {/* Deceased indicator */}
      {person.isDeceased && (
        <div className="absolute -top-2 -right-2 w-4 h-4 bg-gray-500 rounded-full border-2 border-white" />
      )}

      {/* Root indicator */}
      {isRoot && (
        <Badge className="absolute -top-2 left-1/2 transform -translate-x-1/2 bg-genealogy-primary">
          Root
        </Badge>
      )}

      <div className="space-y-3">
        {/* Profile Section */}
        <div className="flex items-center space-x-3">
          {person.profileImage ? (
            <img 
              src={person.profileImage} 
              alt={person.name}
              className="w-12 h-12 rounded-full object-cover border-2 border-white shadow-sm"
            />
          ) : (
            <div className={`
              w-12 h-12 rounded-full flex items-center justify-center text-lg font-semibold
              ${getGenderColor(person.gender)}
            `}>
              {person.name.charAt(0).toUpperCase()}
            </div>
          )}
          
          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm truncate">
              {person.name}
            </h3>
            <Badge variant="outline" className="text-xs mt-1">
              {person.gender.charAt(0).toUpperCase() + person.gender.slice(1)}
            </Badge>
          </div>
        </div>

        {/* Details Section */}
        {showDetails && (
          <div className="space-y-2 text-xs text-muted-foreground">
            {(person.birthDate || person.deathDate) && (
              <div className="flex items-center space-x-1">
                <Calendar className="w-3 h-3" />
                <span>
                  {formatDate(person.birthDate)}
                  {person.deathDate && ` - ${formatDate(person.deathDate)}`}
                </span>
              </div>
            )}
            
            {person.birthPlace && (
              <div className="flex items-center space-x-1">
                <MapPin className="w-3 h-3" />
                <span className="truncate">{person.birthPlace}</span>
              </div>
            )}
            
            {person.occupation && (
              <div className="flex items-center space-x-1">
                <Briefcase className="w-3 h-3" />
                <span className="truncate">{person.occupation}</span>
              </div>
            )}
          </div>
        )}

        {/* Action Buttons */}
        {onNodeEdit && (
          <div className="flex justify-end pt-2 border-t">
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={(e) => {
                e.stopPropagation();
                onNodeEdit();
              }}
              className="text-xs"
            >
              Edit
            </Button>
          </div>
        )}
      </div>
    </Card>
  );
};
