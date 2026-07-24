// ─────────────────────────────────────────────────────────────────────────
// Industry Vocabulary Registry
//
// Single source of truth for every industry-specific label in the app.
// Adding a new industry means adding one entry here — no hunting through
// components for hardcoded "School" / "Teacher" strings.
//
// `key` values are stored on the School document's `industry` field.
// 'school' is the default/original industry and MUST always be present,
// since every pre-existing company in the database has no industry value
// on disk yet and falls back to it (see getIndustry() below).
// ─────────────────────────────────────────────────────────────────────────

export const INDUSTRIES = {
  school: {
    key: 'school',
    label: 'School',
    icon: 'school',
    orgNoun: 'School',                 // "Create New School"
    orgNounPlural: 'Schools',          // sidebar "Schools" link
    personNoun: 'Teacher',             // "Add Teacher"
    personNounPlural: 'Teachers',      // sidebar "Teachers" link
    adminLabel: 'School Admin',
    dashboardSubtitle: 'School Administration',
    secondaryGroup: null,              // schools only track one group: teachers
  },
  company: {
    key: 'company',
    label: 'Company',
    icon: 'building',
    orgNoun: 'Company',
    orgNounPlural: 'Companies',
    personNoun: 'Employee',
    personNounPlural: 'Employees',
    adminLabel: 'Company Admin',
    dashboardSubtitle: 'Company Administration',
    secondaryGroup: { key: 'contractor', label: 'Contractor', labelPlural: 'Contractors' },
  },
  business: {
    key: 'business',
    label: 'Business',
    icon: 'building',
    orgNoun: 'Business',
    orgNounPlural: 'Businesses',
    personNoun: 'Staff Member',
    personNounPlural: 'Staff',
    adminLabel: 'Business Admin',
    dashboardSubtitle: 'Business Administration',
    secondaryGroup: null,
  },
  hospital: {
    key: 'hospital',
    label: 'Hospital',
    icon: 'building',
    orgNoun: 'Hospital',
    orgNounPlural: 'Hospitals',
    personNoun: 'Staff Member',
    personNounPlural: 'Staff',
    adminLabel: 'Hospital Admin',
    dashboardSubtitle: 'Hospital Administration',
    secondaryGroup: { key: 'doctor', label: 'Doctor', labelPlural: 'Doctors' },
  },
  factory: {
    key: 'factory',
    label: 'Factory / Warehouse',
    icon: 'building',
    orgNoun: 'Facility',
    orgNounPlural: 'Facilities',
    personNoun: 'Worker',
    personNounPlural: 'Workers',
    adminLabel: 'Facility Admin',
    dashboardSubtitle: 'Facility Administration',
    secondaryGroup: { key: 'supervisor', label: 'Supervisor', labelPlural: 'Supervisors' },
  },
  other: {
    key: 'other',
    label: 'Other',
    icon: 'building',
    orgNoun: 'Organization',
    orgNounPlural: 'Organizations',
    personNoun: 'Employee',
    personNounPlural: 'Employees',
    adminLabel: 'Organization Admin',
    dashboardSubtitle: 'Organization Administration',
    secondaryGroup: null,
  },
}

export const INDUSTRY_LIST = Object.values(INDUSTRIES)

// Always resolves to a valid vocabulary entry — legacy companies created
// before the industry field existed have no value in the database, so any
// falsy/unknown key safely falls back to 'school' (the original behavior).
export function getIndustry(key) {
  return INDUSTRIES[key] || INDUSTRIES.school
}
