import { Person, Relationship } from '@/types/family';

// Complex 4-generation family with multiple branches, spouses, and edge cases.
// Grandparents → Parents (with spouses) → Children → Grandchildren
//
// Generation 0 (Great-grandparents):
//   Rajan + Lakshmi
//
// Generation 1 (Grandparents):
//   Kumar (son of Rajan+Lakshmi) + Priya
//   Meena (daughter of Rajan+Lakshmi) + Suresh
//
// Generation 2 (Parents):
//   Udhay (son of Kumar+Priya) + Divya
//   Karthik (son of Kumar+Priya)
//   Anitha (daughter of Meena+Suresh) + Ravi
//   Deepak (son of Meena+Suresh)
//
// Generation 3 (Children):
//   Aarav (son of Udhay+Divya)
//   Nila (daughter of Udhay+Divya)
//   Arjun (son of Anitha+Ravi)
//
// Expected inferred relationships:
//   Kumar ↔ Meena: siblings
//   Udhay ↔ Karthik: siblings
//   Anitha ↔ Deepak: siblings
//   Udhay ↔ Anitha: cousins (via Kumar-Meena sibling)
//   Udhay ↔ Deepak: cousins
//   Karthik ↔ Anitha: cousins
//   Karthik ↔ Deepak: cousins
//   Rajan/Lakshmi → Udhay/Karthik: grandparents
//   Rajan/Lakshmi → Anitha/Deepak: grandparents
//   Meena → Aarav/Nila: not direct (great-aunt via inference?)
//   Suresh → Udhay: in-law (via Meena being Kumar's sibling's spouse? no, Suresh married Meena)
//   Divya → Kumar/Priya: in-law
//   Aarav ↔ Nila: siblings
//   Aarav ↔ Arjun: second cousins / related via parents being cousins

export const testPeople: Person[] = [
  // Gen 0 — Great-grandparents
  { id: 'rajan', name: 'Rajan Durai', firstName: 'Rajan', lastName: 'Durai', gender: 'male', birthDate: '1935-03-15', isDeceased: true, deathDate: '2010-08-20', birthPlace: 'Madurai, Tamil Nadu', occupation: 'Teacher' },
  { id: 'lakshmi', name: 'Lakshmi Durai', firstName: 'Lakshmi', lastName: 'Durai', gender: 'female', birthDate: '1938-07-22', isDeceased: true, deathDate: '2015-01-10', birthPlace: 'Madurai, Tamil Nadu', occupation: 'Homemaker' },

  // Gen 1 — Grandparents
  { id: 'kumar', name: 'Kumar Durai', firstName: 'Kumar', lastName: 'Durai', gender: 'male', birthDate: '1958-11-05', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Engineer' },
  { id: 'priya', name: 'Priya Durai', firstName: 'Priya', lastName: 'Durai', gender: 'female', birthDate: '1960-02-14', birthPlace: 'Coimbatore, Tamil Nadu', occupation: 'Doctor' },
  { id: 'meena', name: 'Meena Suresh', firstName: 'Meena', lastName: 'Suresh', gender: 'female', birthDate: '1962-06-30', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Accountant' },
  { id: 'suresh', name: 'Suresh Iyer', firstName: 'Suresh', lastName: 'Iyer', gender: 'male', birthDate: '1960-09-12', birthPlace: 'Trichy, Tamil Nadu', occupation: 'Banker' },

  // Gen 2 — Parents
  { id: 'udhay', name: 'Udhay Kumar', firstName: 'Udhay', lastName: 'Kumar', gender: 'male', birthDate: '1985-04-10', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Software Engineer' },
  { id: 'divya', name: 'Divya Kumar', firstName: 'Divya', lastName: 'Kumar', gender: 'female', birthDate: '1987-08-25', birthPlace: 'Bangalore, Karnataka', occupation: 'Designer' },
  { id: 'karthik', name: 'Karthik Durai', firstName: 'Karthik', lastName: 'Durai', gender: 'male', birthDate: '1988-12-01', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Doctor' },
  { id: 'anitha', name: 'Anitha Ravi', firstName: 'Anitha', lastName: 'Ravi', gender: 'female', birthDate: '1986-03-18', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Lawyer' },
  { id: 'ravi', name: 'Ravi Krishnan', firstName: 'Ravi', lastName: 'Krishnan', gender: 'male', birthDate: '1984-07-05', birthPlace: 'Hyderabad, Telangana', occupation: 'Manager' },
  { id: 'deepak', name: 'Deepak Iyer', firstName: 'Deepak', lastName: 'Iyer', gender: 'male', birthDate: '1990-11-15', birthPlace: 'Chennai, Tamil Nadu', occupation: 'Artist' },

  // Gen 3 — Children
  { id: 'aarav', name: 'Aarav Kumar', firstName: 'Aarav', lastName: 'Kumar', gender: 'male', birthDate: '2015-01-20', birthPlace: 'San Francisco, CA', occupation: 'Student' },
  { id: 'nila', name: 'Nila Kumar', firstName: 'Nila', lastName: 'Kumar', gender: 'female', birthDate: '2018-05-12', birthPlace: 'San Francisco, CA' },
  { id: 'arjun', name: 'Arjun Krishnan', firstName: 'Arjun', lastName: 'Krishnan', gender: 'male', birthDate: '2016-09-08', birthPlace: 'Chennai, Tamil Nadu' },
];

// Only direct relationships — siblings, grandparents, cousins etc. should be inferred
export const testRelationships: Relationship[] = [
  // Gen 0: Rajan + Lakshmi are spouses
  { id: 'rel_spouse_rajan_lakshmi', personId: 'rajan', relatedPersonId: 'lakshmi', relationshipType: 'spouse', confidence: 1.0 },

  // Gen 0 → Gen 1: Rajan & Lakshmi are parents of Kumar and Meena
  { id: 'rel_parent_rajan_kumar', personId: 'rajan', relatedPersonId: 'kumar', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_lakshmi_kumar', personId: 'lakshmi', relatedPersonId: 'kumar', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_rajan_meena', personId: 'rajan', relatedPersonId: 'meena', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_lakshmi_meena', personId: 'lakshmi', relatedPersonId: 'meena', relationshipType: 'parent', confidence: 1.0 },

  // Gen 1: Kumar + Priya, Meena + Suresh are spouses
  { id: 'rel_spouse_kumar_priya', personId: 'kumar', relatedPersonId: 'priya', relationshipType: 'spouse', confidence: 1.0 },
  { id: 'rel_spouse_meena_suresh', personId: 'meena', relatedPersonId: 'suresh', relationshipType: 'spouse', confidence: 1.0 },

  // Gen 1 → Gen 2: Kumar & Priya are parents of Udhay and Karthik
  { id: 'rel_parent_kumar_udhay', personId: 'kumar', relatedPersonId: 'udhay', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_priya_udhay', personId: 'priya', relatedPersonId: 'udhay', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_kumar_karthik', personId: 'kumar', relatedPersonId: 'karthik', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_priya_karthik', personId: 'priya', relatedPersonId: 'karthik', relationshipType: 'parent', confidence: 1.0 },

  // Gen 1 → Gen 2: Meena & Suresh are parents of Anitha and Deepak
  { id: 'rel_parent_meena_anitha', personId: 'meena', relatedPersonId: 'anitha', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_suresh_anitha', personId: 'suresh', relatedPersonId: 'anitha', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_meena_deepak', personId: 'meena', relatedPersonId: 'deepak', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_suresh_deepak', personId: 'suresh', relatedPersonId: 'deepak', relationshipType: 'parent', confidence: 1.0 },

  // Gen 2: Udhay + Divya, Anitha + Ravi are spouses
  { id: 'rel_spouse_udhay_divya', personId: 'udhay', relatedPersonId: 'divya', relationshipType: 'spouse', confidence: 1.0 },
  { id: 'rel_spouse_anitha_ravi', personId: 'anitha', relatedPersonId: 'ravi', relationshipType: 'spouse', confidence: 1.0 },

  // Gen 2 → Gen 3: Udhay & Divya are parents of Aarav and Nila
  { id: 'rel_parent_udhay_aarav', personId: 'udhay', relatedPersonId: 'aarav', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_divya_aarav', personId: 'divya', relatedPersonId: 'aarav', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_udhay_nila', personId: 'udhay', relatedPersonId: 'nila', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_divya_nila', personId: 'divya', relatedPersonId: 'nila', relationshipType: 'parent', confidence: 1.0 },

  // Gen 2 → Gen 3: Anitha & Ravi are parents of Arjun
  { id: 'rel_parent_anitha_arjun', personId: 'anitha', relatedPersonId: 'arjun', relationshipType: 'parent', confidence: 1.0 },
  { id: 'rel_parent_ravi_arjun', personId: 'ravi', relatedPersonId: 'arjun', relationshipType: 'parent', confidence: 1.0 },
];
