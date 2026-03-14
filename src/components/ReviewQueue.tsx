import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { PendingChange } from '@/types/family';
import { Check, X, Clock } from 'lucide-react';

interface ReviewQueueProps {
  pendingChanges: PendingChange[];
  onApprove: (changeId: string) => void;
  onReject: (changeId: string, note?: string) => void;
}

const changeTypeLabel: Record<string, string> = {
  add_person: 'Add Person',
  edit_person: 'Edit Person',
  delete_person: 'Delete Person',
  add_relationship: 'Add Relationship',
  delete_relationship: 'Delete Relationship',
};

const changeTypeBadgeColor: Record<string, string> = {
  add_person: 'bg-green-100 text-green-800',
  edit_person: 'bg-blue-100 text-blue-800',
  delete_person: 'bg-red-100 text-red-800',
  add_relationship: 'bg-green-100 text-green-800',
  delete_relationship: 'bg-red-100 text-red-800',
};

export const ReviewQueue: React.FC<ReviewQueueProps> = ({
  pendingChanges,
  onApprove,
  onReject,
}) => {
  const [rejectNotes, setRejectNotes] = useState<Record<string, string>>({});

  const formatPayload = (change: PendingChange) => {
    const p = change.payload;
    switch (change.change_type) {
      case 'add_person':
        return `${p.name || p.first_name} ${p.last_name || ''}`.trim() +
          (p.gender ? ` (${p.gender})` : '') +
          (p.birth_date ? ` - Born: ${p.birth_date}` : '');
      case 'edit_person':
        return `Editing: ${p.name || p.id}`;
      case 'delete_person':
        return `Deleting person: ${p.id}`;
      case 'add_relationship':
        return `${p.relationshipType}: ${p.personId} -> ${p.relatedPersonId}`;
      case 'delete_relationship':
        return `Removing relationship: ${p.id}`;
      default:
        return JSON.stringify(p);
    }
  };

  if (pendingChanges.length === 0) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardContent className="p-12 text-center">
          <Clock className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Pending Changes</h3>
          <p className="text-muted-foreground">
            All submissions have been reviewed. New changes from family members will appear here.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Review Queue
          <Badge variant="secondary">{pendingChanges.length} pending</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {pendingChanges.map(change => (
          <Card key={change.id} className="border">
            <CardContent className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2">
                    <Badge className={changeTypeBadgeColor[change.change_type] ?? ''}>
                      {changeTypeLabel[change.change_type] ?? change.change_type}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {change.submitted_by_email ?? 'Unknown'}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {new Date(change.created_at).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-sm font-medium mb-2">{formatPayload(change)}</p>
                  <details className="text-xs text-muted-foreground">
                    <summary className="cursor-pointer">Full details</summary>
                    <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(change.payload, null, 2)}
                    </pre>
                  </details>
                </div>
                <div className="flex flex-col gap-2 shrink-0">
                  <Button
                    size="sm"
                    onClick={() => onApprove(change.id)}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Check className="w-4 h-4 mr-1" />
                    Approve
                  </Button>
                  <div className="flex gap-1">
                    <Input
                      placeholder="Reason..."
                      className="h-8 text-xs w-28"
                      value={rejectNotes[change.id] ?? ''}
                      onChange={(e) => setRejectNotes(prev => ({ ...prev, [change.id]: e.target.value }))}
                    />
                    <Button
                      size="sm"
                      variant="destructive"
                      className="h-8"
                      onClick={() => onReject(change.id, rejectNotes[change.id])}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
