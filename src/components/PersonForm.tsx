
import React from 'react';
import { useForm } from 'react-hook-form';
import { Person } from '@/types/family';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';

interface PersonFormProps {
  person?: Person;
  onSubmit: (data: Omit<Person, 'id'>) => void;
  onCancel: () => void;
}

export const PersonForm: React.FC<PersonFormProps> = ({
  person,
  onSubmit,
  onCancel
}) => {
  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<Omit<Person, 'id'>>({
    defaultValues: person ? {
      name: person.name,
      firstName: person.firstName || '',
      lastName: person.lastName || '',
      birthDate: person.birthDate || '',
      deathDate: person.deathDate || '',
      gender: person.gender,
      isDeceased: person.isDeceased || false,
      profileImage: person.profileImage || '',
      notes: person.notes || '',
      birthPlace: person.birthPlace || '',
      occupation: person.occupation || ''
    } : {
      name: '',
      firstName: '',
      lastName: '',
      birthDate: '',
      deathDate: '',
      gender: 'male',
      isDeceased: false,
      profileImage: '',
      notes: '',
      birthPlace: '',
      occupation: ''
    }
  });

  const isDeceased = watch('isDeceased');

  return (
    <Card className="w-full max-w-2xl mx-auto">
      <CardHeader>
        <CardTitle className="text-2xl font-bold bg-royal-gradient bg-clip-text text-transparent">
          {person ? 'Edit Person' : 'Add New Person'}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          {/* Basic Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="firstName">First Name</Label>
              <Input
                id="firstName"
                {...register('firstName', { required: 'First name is required' })}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
              />
              {errors.firstName && (
                <p className="text-sm text-red-500">{errors.firstName.message}</p>
              )}
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="lastName">Last Name</Label>
              <Input
                id="lastName"
                {...register('lastName', { required: 'Last name is required' })}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
              />
              {errors.lastName && (
                <p className="text-sm text-red-500">{errors.lastName.message}</p>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="name">Full Name</Label>
            <Input
              id="name"
              {...register('name', { required: 'Full name is required' })}
              className="border-genealogy-primary/20 focus:border-genealogy-primary"
              placeholder="e.g., John Michael Smith"
            />
            {errors.name && (
              <p className="text-sm text-red-500">{errors.name.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="gender">Gender</Label>
            <Select onValueChange={(value) => setValue('gender', value as 'male' | 'female' | 'other')}>
              <SelectTrigger className="border-genealogy-primary/20 focus:border-genealogy-primary">
                <SelectValue placeholder="Select gender" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="male">Male</SelectItem>
                <SelectItem value="female">Female</SelectItem>
                <SelectItem value="other">Other</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dates */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="birthDate">Birth Date</Label>
              <Input
                id="birthDate"
                type="date"
                {...register('birthDate')}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="deathDate">Death Date</Label>
              <Input
                id="deathDate"
                type="date"
                {...register('deathDate')}
                disabled={!isDeceased}
                className="border-genealogy-primary/20 focus:border-genealogy-primary disabled:opacity-50"
              />
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <Checkbox
              id="isDeceased"
              checked={isDeceased}
              onCheckedChange={(checked) => setValue('isDeceased', !!checked)}
            />
            <Label htmlFor="isDeceased">Deceased</Label>
          </div>

          {/* Additional Information */}
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="birthPlace">Birth Place</Label>
              <Input
                id="birthPlace"
                {...register('birthPlace')}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
                placeholder="e.g., New York, NY, USA"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="occupation">Occupation</Label>
              <Input
                id="occupation"
                {...register('occupation')}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
                placeholder="e.g., Engineer, Teacher, etc."
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="profileImage">Profile Image URL</Label>
              <Input
                id="profileImage"
                type="url"
                {...register('profileImage')}
                className="border-genealogy-primary/20 focus:border-genealogy-primary"
                placeholder="https://example.com/photo.jpg"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                {...register('notes')}
                className="border-genealogy-primary/20 focus:border-genealogy-primary min-h-[100px]"
                placeholder="Additional information, memories, stories..."
              />
            </div>
          </div>

          {/* Actions */}
          <div className="flex space-x-4 pt-6 border-t">
            <Button
              type="submit"
              className="flex-1 bg-royal-gradient hover:opacity-90 text-white"
            >
              {person ? 'Update Person' : 'Add Person'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              className="flex-1 border-genealogy-primary text-genealogy-primary hover:bg-genealogy-primary hover:text-white"
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
};
