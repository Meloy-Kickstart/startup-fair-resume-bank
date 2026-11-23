// Content that staff may want to change before the fair. Edit here, then redeploy.

export const EVENT = {
  name: 'Startup Career Fair',
  title: 'Meloy Startup Career Fair',
  org: 'Meloy Program',
  orgLong: 'Meloy Engineering Innovation and Entrepreneurship Program',
};

// Buttons on the page a student sees after check-in. `key` is used to count clicks.
export const MAIN_LINKS = [
  { key: 'apply', label: 'Apply to the Meloy Program', note: 'Courses, mentors and funding for student founders', url: 'https://tamu.qualtrics.com/jfe/form/SV_6D88B5GK3qCE7zM' },
  { key: 'newsletter', label: 'Get the Meloy Minute newsletter', note: 'Events, grants and startup jobs', url: 'https://tx.ag/MeloyNews' },
  { key: 'kickstart', label: 'Come to a Meloy Kickstart meeting', note: 'The student org for founders and builders', url: 'https://tx.ag/meloykickstart' },
  { key: 'groupme', label: 'Join the Meloy GroupMe', note: 'Quick news from the program', url: 'https://groupme.com/join_group/76550403/W3SN1k1t' },
  { key: 'instagram', label: 'Follow Meloy on Instagram', note: '@meloy.engineering', url: 'https://www.instagram.com/meloy.engineering' },
  { key: 'linkedin', label: 'Follow Meloy on LinkedIn', note: 'Program news and alumni', url: 'https://www.linkedin.com/company/meloy-engineering-innovation-and-entrepreneurship-program-at-texas-a-m-university/' },
];

export const ALL_LINKS = { key: 'all', label: 'See all Meloy links', url: 'https://tx.ag/meloyprogram' };

// Bachelor's majors from catalog.tamu.edu (Nov 2026), plus General Engineering and Undeclared.
// Students can also type a major that is not in the list.
export const MAJORS = [
  'Accounting',
  'Aerospace Engineering',
  'Agribusiness',
  'Agricultural Communications and Journalism',
  'Agricultural Economics',
  'Agricultural Education',
  'Agricultural Leadership and Development',
  'Agricultural Systems Management',
  'Animal Science',
  'Anthropology',
  'Applied Mathematics',
  'Architectural Engineering',
  'Architecture',
  'Behavioral and Cognitive Neuroscience',
  'Biochemistry',
  'Bioenvironmental Sciences',
  'Bioinformatics',
  'Biological and Agricultural Engineering',
  'Biology',
  'Biomedical Engineering',
  'Biomedical Sciences',
  'Business',
  'Business Honors',
  'Chemical Engineering',
  'Chemistry',
  'Civil Engineering',
  'Classics',
  'Coaching and Teaching in Secondary Education',
  'Coastal Resilience and Environmental Science',
  'Communication',
  'Computer Engineering',
  'Computer Science',
  'Construction Science',
  'Dance Science',
  'Data Engineering',
  'Dental Hygiene',
  'Early Childhood Development and Education',
  'Ecology and Conservation Biology',
  'Economics',
  'Education',
  'Electrical Engineering',
  'Electronic Systems Engineering Technology',
  'English',
  'Entomology',
  'Environmental and Sustainability Studies',
  'Environmental Engineering',
  'Environmental Studies',
  'Environmental Systems Science',
  'Finance',
  'Financial Planning',
  'Food Science and Technology',
  'Forensic and Investigative Sciences',
  'General Engineering',
  'Genetics',
  'Geographic Information Science and Technology',
  'Geography',
  'Geology',
  'Geophysics',
  'Global Studies',
  'History',
  'Horticulture',
  'Hospitality, Hotel Management and Tourism',
  'Human Development and Family Sciences',
  'Human Resource Development',
  'Industrial Distribution',
  'Industrial Engineering',
  'Interdisciplinary Engineering',
  'International Affairs',
  'Journalism',
  'Kinesiology',
  'Landscape Architecture',
  'Learning Technology and Performance Systems',
  'Management',
  'Management Information Systems',
  'Manufacturing and Mechanical Engineering Technology',
  'Marine Biology',
  'Marine Engineering Technology',
  'Marine Fisheries',
  'Marine Sciences',
  'Marine Transportation',
  'Maritime Business Administration',
  'Maritime Operations',
  'Maritime Studies',
  'Marketing',
  'Materials Science and Engineering',
  'Mathematics',
  'Mechanical Engineering',
  'Meteorology',
  'Microbiology',
  'Modern Languages',
  'Molecular and Cell Biology',
  'Multidisciplinary Engineering Technology',
  'Music Performance',
  'Neurobiology',
  'Nuclear Engineering',
  'Nursing',
  'Nutrition',
  'Ocean Engineering',
  'Ocean Studies',
  'Oceanography',
  'Performance and Visual Studies',
  'Petroleum Engineering',
  'Philosophy',
  'Physics',
  'Plant and Environmental Soil Science',
  'Political Science',
  'Poultry Science',
  'Psychology',
  'Public Health',
  'Public Service and Administration',
  'Rangeland, Wildlife and Fisheries Management',
  'Society, Ethics, and Law',
  'Sociology',
  'Space Engineering',
  'Spanish',
  'Sport Management',
  'Statistics',
  'Supply Chain Management',
  'Telecommunication Media Studies',
  'Theatre',
  'Turfgrass Science',
  'Undeclared',
  'University Studies',
  'Urban and Regional Planning',
  'Visualization',
  'Zoology',
];

export const DEGREES = ['Bachelor’s', 'Master’s', 'PhD', 'MBA', 'Other'];

export const LOOKING_FOR = ['Internship', 'Co-op', 'Full-time', 'Part-time', 'Research', 'Join a startup team'];

export function gradTerms(now = new Date()) {
  const y = now.getFullYear();
  const terms = [];
  for (let year = y; year <= y + 5; year++) for (const t of ['Spring', 'Summer', 'Fall']) terms.push(`${t} ${year}`);
  return terms;
}

export const MAX_RESUME_MB = 5;

// Shown on the company registration form. Confirm each item before you send the form.
export const FAIR_PROVIDES = [
  'A table and a tablecloth',
  'Validated parking',
  'Lunch',
  'Study rooms where your team can take a break',
];
export const FAIR_BRING =
  'Your own banner, giveaways, promotional items and anything else your table needs. We do not provide swag for students.';
