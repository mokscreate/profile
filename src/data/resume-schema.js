// === IDs ===
let _counter = 0;
export function uid(prefix = 'id') {
  return `${prefix}_${Date.now()}_${(++_counter).toString(36)}`;
}

// === Experience Library Items ===
export function createExperienceEntry() {
  return {
    id: uid('exp'),
    type: 'work', // 'work' | 'project' | 'education' | 'award'
    company: '',
    role: '',
    startDate: '',
    endDate: '',
    tags: [],
    bullets: [createBullet()],
    aiConversation: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createProjectEntry() {
  return {
    id: uid('proj'),
    type: 'project',
    name: '',
    role: '',
    startDate: '',
    endDate: '',
    tags: [],
    techStack: [],
    bullets: [createBullet()],
    aiConversation: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createEducationEntry() {
  return {
    id: uid('edu'),
    type: 'education',
    school: '',
    major: '',
    degree: '本科',
    startDate: '',
    endDate: '',
    gpa: '',
    highlights: [],
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createAwardEntry() {
  return {
    id: uid('award'),
    type: 'award',
    title: '',
    date: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

export function createBullet() {
  return {
    id: uid('b'),
    original: '',
    enhanced: '',
    useEnhanced: false
  };
}

// === Resume (references library items by ID) ===
export function createResume() {
  return {
    id: uid('resume'),
    title: '未命名简历',
    targetRole: '',
    jd: '',
    basic: {
      name: '',
      phone: '',
      email: '',
      location: '',
      links: []
    },
    selectedExperiences: [],   // IDs from library
    selectedProjects: [],      // IDs from library
    selectedEducation: [],     // IDs from library
    selectedAwards: [],        // IDs from library
    skills: {
      technical: [],
      tools: [],
      languages: []
    },
    templateId: 'classic',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

// === App State Root ===
export function createAppData() {
  return {
    profile: {
      name: '',
      phone: '',
      email: '',
      location: '',
      links: []
    },
    library: {
      experiences: [],
      projects: [],
      education: [],
      awards: []
    },
    resumes: [],
    settings: {
      apiKey: ''
    },
    version: 2
  };
}
