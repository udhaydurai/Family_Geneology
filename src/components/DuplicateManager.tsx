import React, { useMemo, useState } from 'react';
import { Person, Relationship } from '@/types/family';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Merge, Trash2, Check, AlertTriangle } from 'lucide-react';

interface DuplicateManagerProps {
  people: Person[];
  relationships: Relationship[];
  onMerge: (keepId: string, deleteId: string) => void;
  onDelete: (personId: string) => void;
}

interface DuplicateGroup {
  people: Person[];
  similarity: 'exact' | 'likely' | 'possible';
}

// Normalize name for comparison
function normalizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z]/g, '');
}

// Levenshtein edit distance
function editDistance(a: string, b: string): number {
  const m = a.length, n = b.length;
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      dp[i][j] = a[i - 1] === b[j - 1]
        ? dp[i - 1][j - 1]
        : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
    }
  }
  return dp[m][n];
}

// Word-based name similarity — designed for Indian names where sharing a surname is common
function nameSimilarity(a: string, b: string): number {
  const na = normalizeName(a);
  const nb = normalizeName(b);
  if (na === nb) return 1.0;

  // Word-level comparison (more meaningful than character-set overlap)
  const wordsA = a.trim().toLowerCase().split(/\s+/);
  const wordsB = b.trim().toLowerCase().split(/\s+/);

  // Check if all words match (possibly reordered) — e.g., "Durai Kumar" vs "Kumar Durai"
  if (wordsA.length === wordsB.length && wordsA.every(w => wordsB.includes(w))) return 0.95;

  // One name is a subset of the other — e.g., "Kumar" vs "Kumar Durai"
  if (wordsA.every(w => wordsB.includes(w)) || wordsB.every(w => wordsA.includes(w))) return 0.8;

  // Edit distance on the full normalized name — catches typos like "Udhay" vs "Udhaya"
  const dist = editDistance(na, nb);
  const maxLen = Math.max(na.length, nb.length);
  const similarity = 1 - dist / maxLen;

  // Only flag if very similar (within 2-3 character edits on the full name)
  if (similarity >= 0.85) return similarity;

  // Not a duplicate — sharing one word (like a surname) is NOT enough
  return 0;
}

function findDuplicates(people: Person[]): DuplicateGroup[] {
  const groups: DuplicateGroup[] = [];
  const used = new Set<string>();

  for (let i = 0; i < people.length; i++) {
    if (used.has(people[i].id)) continue;

    const group: Person[] = [people[i]];

    for (let j = i + 1; j < people.length; j++) {
      if (used.has(people[j].id)) continue;
      const sim = nameSimilarity(people[i].name, people[j].name);
      if (sim >= 0.8) {
        group.push(people[j]);
      }
    }

    if (group.length > 1) {
      group.forEach(p => used.add(p.id));

      // Classify similarity
      const allExact = group.every(p => normalizeName(p.name) === normalizeName(group[0].name));
      const similarity = allExact ? 'exact' : nameSimilarity(group[0].name, group[1].name) >= 0.9 ? 'likely' : 'possible';

      groups.push({ people: group, similarity });
    }
  }

  return groups;
}

function getRelCount(personId: string, relationships: Relationship[]): number {
  return relationships.filter(r => r.personId === personId || r.relatedPersonId === personId).length;
}

const SIMILARITY_COLORS: Record<string, string> = {
  exact: 'bg-red-100 text-red-800',
  likely: 'bg-orange-100 text-orange-800',
  possible: 'bg-yellow-100 text-yellow-800',
};

export const DuplicateManager: React.FC<DuplicateManagerProps> = ({
  people,
  relationships,
  onMerge,
  onDelete,
}) => {
  const duplicates = useMemo(() => findDuplicates(people), [people]);
  const [resolved, setResolved] = useState<Set<string>>(new Set());

  const handleMerge = (keepId: string, deleteId: string) => {
    onMerge(keepId, deleteId);
    setResolved(prev => new Set([...prev, `${keepId}-${deleteId}`]));
  };

  const visibleDuplicates = duplicates.filter(
    g => !g.people.every(p => resolved.has(p.id))
  );

  if (visibleDuplicates.length === 0) {
    return (
      <Card className="bg-white/70 backdrop-blur-sm">
        <CardContent className="p-8 text-center">
          <Check className="w-10 h-10 mx-auto text-green-500 mb-3" />
          <h3 className="text-lg font-semibold mb-1">No Duplicates Found</h3>
          <p className="text-muted-foreground text-sm">
            All {people.length} people have unique names. Import another sheet to check for overlaps.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-white/70 backdrop-blur-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-5 h-5 text-orange-500" />
          Potential Duplicates ({visibleDuplicates.length} groups)
        </CardTitle>
        <p className="text-sm text-muted-foreground">
          These people may be the same person entered from different sheets.
          Click "Keep" on the correct one — their relationships will be merged.
        </p>
      </CardHeader>
      <CardContent className="space-y-4">
        {visibleDuplicates.map((group, gi) => (
          <Card key={gi} className="border">
            <CardContent className="p-4">
              <div className="flex items-center gap-2 mb-3">
                <Badge className={SIMILARITY_COLORS[group.similarity]}>
                  {group.similarity === 'exact' ? 'Exact Match' : group.similarity === 'likely' ? 'Likely Match' : 'Possible Match'}
                </Badge>
                <span className="text-xs text-muted-foreground">
                  {group.people.length} entries
                </span>
              </div>

              <div className="space-y-2">
                {group.people.map((person, pi) => {
                  const relCount = getRelCount(person.id, relationships);
                  const otherIds = group.people.filter(p => p.id !== person.id).map(p => p.id);

                  return (
                    <div key={person.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                          person.gender === 'male' ? 'bg-blue-500' :
                          person.gender === 'female' ? 'bg-pink-500' : 'bg-purple-500'
                        }`}>
                          {person.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-sm">{person.name}</div>
                          <div className="text-xs text-muted-foreground">
                            {person.gender}
                            {person.birthDate && ` · b. ${new Date(person.birthDate).getFullYear()}`}
                            {person.birthPlace && ` · ${person.birthPlace}`}
                            {' · '}{relCount} relationship{relCount !== 1 ? 's' : ''}
                          </div>
                        </div>
                      </div>

                      <div className="flex gap-1">
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-green-700 border-green-300 hover:bg-green-50 h-7 text-xs"
                          onClick={() => {
                            otherIds.forEach(otherId => handleMerge(person.id, otherId));
                          }}
                          title="Keep this person, merge others into it"
                        >
                          <Merge className="w-3 h-3 mr-1" />
                          Keep
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="text-red-500 hover:bg-red-50 h-7 text-xs"
                          onClick={() => onDelete(person.id)}
                          title="Delete this person"
                        >
                          <Trash2 className="w-3 h-3" />
                        </Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        ))}
      </CardContent>
    </Card>
  );
};
